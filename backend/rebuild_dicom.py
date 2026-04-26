"""
rebuild_dicom.py — 从截图 + DICOM 元数据重建 CT DICOM 文件

从 WW/WL 渲染的 8-bit PNG 截图逆映射像素值到 HU 范围，
仅使用 dicom_info.json（第一帧的 DCM 信息）作为元数据来源，
生成标准的单帧 CT DICOM 文件。

重要：截图时的窗宽窗位（如 WW=2000, WL=0）需要通过命令行参数指定，
      不从 dicom_info.json 中读取（JSON 中存储的是原始默认值）。

注意：这是有损重建，窗宽窗位范围外的 HU 值不可恢复。
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image

import pydicom
from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
from pydicom.tag import Tag
from pydicom.uid import ExplicitVRLittleEndian, generate_uid

CT_IMAGE_STORAGE = "1.2.840.10008.5.1.4.1.1.2"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

# Tag 解析与写入

# dicom_info.json 中 tag 字符串的格式：(0028, 0010)
TAG_RE = re.compile(r"\(([0-9A-Fa-f]{4}),\s*([0-9A-Fa-f]{4})\)")

# 这些 tag 包含 Sequence 类型，解析复杂，暂跳过
SKIP_DESCRIPTIONS = {
    "ReferencedPerformedProcedureStepSequence",
    "ReferencedImageSequence",
}

# VR 类型中需要多值拆分的 tag（值以 \ 或 , 分隔）
MULTI_VALUE_TAGS = {
    Tag(0x0020, 0x0037),  # ImageOrientationPatient
    Tag(0x0020, 0x0032),  # ImagePositionPatient
    Tag(0x0028, 0x0030),  # PixelSpacing
    Tag(0x0018, 0x1190),  # FocalSpots
}

# 像素相关 tag，由脚本强制设置，不从 JSON 导入
PIXEL_TAGS = {
    Tag(0x0028, 0x0010),  # Rows
    Tag(0x0028, 0x0011),  # Columns
    Tag(0x0028, 0x0100),  # BitsAllocated
    Tag(0x0028, 0x0101),  # BitsStored
    Tag(0x0028, 0x0102),  # HighBit
    Tag(0x0028, 0x0103),  # PixelRepresentation
    Tag(0x0028, 0x0002),  # SamplesPerPixel
    Tag(0x0028, 0x0004),  # PhotometricInterpretation
    Tag(0x7FE0, 0x0010),  # PixelData
}


def parse_tag_string(tag_str: str) -> Tag | None:
    """解析 '(0028, 0010)' 格式的 tag 字符串"""
    m = TAG_RE.search(tag_str)
    if not m:
        return None
    return Tag(int(m.group(1), 16), int(m.group(2), 16))


def _try_numeric(value_str: str):
    """尝试将字符串转为数值"""
    try:
        v = int(value_str)
        return v
    except ValueError:
        pass
    try:
        v = float(value_str)
        return v
    except ValueError:
        pass
    return value_str


def set_tag_from_info(ds: Dataset, tag: Tag, value_str: str, description: str):
    """根据 tag 类型将字符串值写入 Dataset"""
    if tag in PIXEL_TAGS:
        return
    if description in SKIP_DESCRIPTIONS:
        return

    # 获取 VR 类型来决定如何转换
    try:
        vr = pydicom.datadict.dictionary_VR(tag)
    except KeyError:
        # 未知私有 tag，跳过
        return

    # Sequence 类型无法从纯文本还原，跳过
    if vr == "SQ":
        return

    # 处理条件 VR（如 "US or SS"、"OB or OW"）：取第一个
    if " or " in vr:
        vr = vr.split(" or ")[0].strip()

    # CS 类型多值标准分隔符为 \，兼容用逗号分隔的输入
    if vr == "CS" and "\\" not in value_str and "," in value_str:
        value_str = "\\".join(p.strip() for p in value_str.split(","))

    # DS/IS/FD/FL 等数值类型也可能用逗号分隔多值（非标准但常见），统一转为反斜线
    if vr in ("DS", "IS", "FD", "FL", "US", "SS", "UL", "SL") and "\\" not in value_str and "," in value_str:
        parts = [p.strip() for p in value_str.split(",") if p.strip()]
        if vr in ("DS", "FD", "FL"):
            values = [float(p) for p in parts]
        else:
            values = [int(float(p)) for p in parts]
        ds.add_new(tag, vr, values)
        return

    if tag in MULTI_VALUE_TAGS:
        # 多值字段，先按逗号拆，再按反斜线拆
        parts = re.split(r"[,\\]", value_str)
        values = [_try_numeric(p.strip()) for p in parts if p.strip()]
        if vr in ("DS", "FL", "FD"):
            values = [float(v) if not isinstance(v, float) else v for v in values]
        elif vr in ("IS", "US", "SS", "UL", "SL"):
            values = [int(float(v)) if not isinstance(v, int) else v for v in values]
        ds.add_new(tag, vr, values)
        return

    # 多值用反斜线分割（DICOM 标准）
    if "\\" in value_str and vr in ("DS", "IS", "CS", "LO", "SH"):
        parts = value_str.split("\\")
        if vr in ("DS",):
            values = [float(p.strip()) for p in parts if p.strip()]
        elif vr in ("IS",):
            values = [int(p.strip()) for p in parts if p.strip()]
        else:
            values = [p.strip() for p in parts]
        ds.add_new(tag, vr, values)
        return

    # 单值
    if vr in ("DS", "FL", "FD"):
        try:
            ds.add_new(tag, vr, float(value_str) if value_str else 0.0)
        except ValueError:
            ds.add_new(tag, vr, value_str)
    elif vr in ("IS", "US", "SS", "UL", "SL"):
        try:
            ds.add_new(tag, vr, int(float(value_str)) if value_str else 0)
        except ValueError:
            ds.add_new(tag, vr, value_str)
    elif vr == "UI":
        ds.add_new(tag, vr, value_str)
    else:
        ds.add_new(tag, vr, value_str)


# 像素逆映射

def screenshot_to_hu(
    img_path: Path,
    target_rows: int,
    target_cols: int,
    window_width: float,
    window_center: float,
    rescale_slope: float,
    rescale_intercept: float,
) -> np.ndarray:
    """
    从 PNG 截图逆映射到 DICOM stored pixel values (int16)。

    PNG (uint8 0-255) → HU → stored value
    HU = (pixel / 255) * WW + (WC - WW/2)
    stored = (HU - intercept) / slope
    """
    img = Image.open(img_path).convert("L")
    if img.size != (target_cols, target_rows):
        img = img.resize((target_cols, target_rows), Image.LANCZOS)

    arr = np.array(img, dtype=np.float64)

    # 逆窗宽窗位映射：uint8 → HU
    hu_min = window_center - window_width / 2.0
    hu = (arr / 255.0) * window_width + hu_min

    # HU → stored pixel value
    stored = (hu - rescale_intercept) / rescale_slope

    # Clamp 到 int16 范围
    stored = np.clip(stored, -32768, 32767)
    return stored.astype(np.int16)


# DICOM 文件构建

def _parse_dicom_info_value(dicom_info: list[dict], description: str) -> str | None:
    """从 dicom_info.json 中按 description 查找值"""
    for item in dicom_info:
        if item.get("description") == description:
            return item.get("value", "")
    return None


def _get_dicom_info_params(dicom_info: list[dict]) -> dict:
    """从 dicom_info.json 提取重建所需的关键参数"""
    def _float(v, default):
        try:
            return float(v) if v else default
        except (ValueError, TypeError):
            return default

    def _int(v, default):
        try:
            return int(float(v)) if v else default
        except (ValueError, TypeError):
            return default

    rows = _int(_parse_dicom_info_value(dicom_info, "Rows"), 512)
    cols = _int(_parse_dicom_info_value(dicom_info, "Columns"), 512)
    rescale_slope = _float(_parse_dicom_info_value(dicom_info, "RescaleSlope"), 1.0)
    rescale_intercept = _float(_parse_dicom_info_value(dicom_info, "RescaleIntercept"), -1024.0)
    slice_thickness = _float(_parse_dicom_info_value(dicom_info, "SliceThickness"), 5.0)
    instance_number = _int(_parse_dicom_info_value(dicom_info, "InstanceNumber"), 1)
    images_in_acquisition = _int(_parse_dicom_info_value(dicom_info, "ImagesInAcquisition"), None)
    sop_instance_uid = _parse_dicom_info_value(dicom_info, "SOPInstanceUID") or ""

    # ImagePositionPatient: "x,y,z"
    ipp_str = _parse_dicom_info_value(dicom_info, "ImagePositionPatient") or ""
    ipp_parts = [p.strip() for p in ipp_str.split(",") if p.strip()]
    ipp = [float(p) for p in ipp_parts] if len(ipp_parts) == 3 else None

    # SliceLocation
    slice_location = _float(_parse_dicom_info_value(dicom_info, "SliceLocation"), None)

    return {
        "rows": rows,
        "columns": cols,
        "rescale_slope": rescale_slope,
        "rescale_intercept": rescale_intercept,
        "slice_thickness": slice_thickness,
        "instance_number": instance_number,
        "images_in_acquisition": images_in_acquisition,
        "sop_instance_uid": sop_instance_uid,
        "image_position_patient": ipp,
        "slice_location": slice_location,
    }


def build_dicom(
    pixel_data: np.ndarray,
    dicom_info: list[dict],
    frame_index: int,
    total_frames: int,
    dicom_params: dict,
    output_path: Path,
):
    """
    构建并保存一个 CT DICOM 文件。

    仅使用 dicom_info.json（第一帧信息）作为元数据来源。
    每帧独有的字段（InstanceNumber, SOPInstanceUID, SliceLocation,
    ImagePositionPatient）基于首帧数据 + 帧序号计算。
    """

    # --- 计算每帧独有的字段 ---
    slice_thickness = dicom_params["slice_thickness"]
    frame_offset = frame_index - 1  # 第 1 帧 offset=0

    # SOPInstanceUID: 首帧 UID 的末尾数字递增以生成唯一 UID
    base_sop_uid = dicom_params["sop_instance_uid"]
    if frame_index == 1 and base_sop_uid:
        sop_uid = base_sop_uid
    else:
        sop_uid = generate_uid()

    # InstanceNumber: 从首帧编号起递增
    instance_number = dicom_params["instance_number"] + frame_offset

    # SliceLocation & ImagePositionPatient: 沿 z 轴按层厚递减
    base_slice_loc = dicom_params["slice_location"]
    base_ipp = dicom_params["image_position_patient"]

    if base_slice_loc is not None:
        slice_location = base_slice_loc - frame_offset * slice_thickness
    else:
        slice_location = None

    if base_ipp and len(base_ipp) == 3:
        ipp = [base_ipp[0], base_ipp[1], base_ipp[2] - frame_offset * slice_thickness]
    else:
        ipp = None

    # --- File Meta ---
    file_meta = FileMetaDataset()
    file_meta.FileMetaInformationVersion = b"\x00\x01"
    file_meta.MediaStorageSOPClassUID = CT_IMAGE_STORAGE
    file_meta.MediaStorageSOPInstanceUID = sop_uid
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    file_meta.ImplementationClassUID = "1.2.826.0.1.3680043.8.498.1"

    # --- Dataset ---
    ds = FileDataset(
        str(output_path),
        {},
        file_meta=file_meta,
        preamble=b"\x00" * 128,
    )

    # 1) 从 dicom_info.json 写入所有元数据 tag
    for item in dicom_info:
        tag = parse_tag_string(item.get("tag", ""))
        if tag is None:
            continue
        value = item.get("value", "")
        desc = item.get("description", "")
        set_tag_from_info(ds, tag, value, desc)

    # 2) 覆盖每帧独有的字段
    ds.SOPInstanceUID = sop_uid
    ds.SOPClassUID = CT_IMAGE_STORAGE
    ds.InstanceNumber = instance_number

    if slice_location is not None:
        ds.SliceLocation = f"{slice_location:.3f}"
    if ipp:
        ds.ImagePositionPatient = [f"{v:.6f}" for v in ipp]

    # 3) 强制写入像素相关 tag
    rows, cols = pixel_data.shape
    ds.Rows = rows
    ds.Columns = cols
    ds.BitsAllocated = 16
    ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 1  # signed
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.PixelData = pixel_data.tobytes()

    ds.save_as(str(output_path), enforce_file_format=True)
# 主流程

def rebuild_series(
    series_dir: Path,
    window_width: float = 2000.0,
    window_center: float = 0.0,
    output_subdir: str = "reconstructed_dicom",
) -> dict:
    """
    重建单个 series 的所有帧为 DICOM 文件。

    仅使用 dicom_info.json 作为元数据来源（第一帧的 DCM 信息）。
    帧列表通过扫描 frame_XXXX.png 文件确定。
    窗宽窗位使用命令行参数（截图时的实际值），不从 JSON 中读取。
    """

    dicom_info_path = series_dir / "dicom_info.json"
    if not dicom_info_path.exists():
        return {"status": "error", "error": f"dicom_info.json not found in {series_dir}"}

    with open(dicom_info_path, "r", encoding="utf-8") as f:
        dicom_info = json.load(f)

    # 从 dicom_info.json 提取关键参数
    dicom_params = _get_dicom_info_params(dicom_info)
    target_rows = dicom_params["rows"]
    target_cols = dicom_params["columns"]
    rescale_slope = dicom_params["rescale_slope"]
    rescale_intercept = dicom_params["rescale_intercept"]

    # 扫描 frame_XXXX.png 文件列表
    frame_pngs = sorted(series_dir.glob("frame_[0-9][0-9][0-9][0-9].png"))
    if not frame_pngs:
        return {"status": "error", "error": f"No frame_XXXX.png files found in {series_dir}"}

    total_frames = len(frame_pngs)
    logger.info("Found %d frame PNG files", total_frames)
    logger.info("DICOM params: Rows=%d, Cols=%d, RescaleSlope=%s, RescaleIntercept=%s",
                target_rows, target_cols, rescale_slope, rescale_intercept)
    logger.info("Capture WW/WL: %s/%s (用于像素逆映射，非 DICOM 原始值)",
                window_width, window_center)

    output_dir = series_dir / output_subdir
    output_dir.mkdir(parents=True, exist_ok=True)

    results = []
    success_count = 0
    error_count = 0

    for idx, frame_png in enumerate(frame_pngs, start=1):
        try:
            pixel_data = screenshot_to_hu(
                frame_png,
                target_rows=target_rows,
                target_cols=target_cols,
                window_width=window_width,
                window_center=window_center,
                rescale_slope=rescale_slope,
                rescale_intercept=rescale_intercept,
            )

            output_path = output_dir / f"{frame_png.stem}.dcm"
            build_dicom(
                pixel_data=pixel_data,
                dicom_info=dicom_info,
                frame_index=idx,
                total_frames=total_frames,
                dicom_params=dicom_params,
                output_path=output_path,
            )

            results.append({"frame": idx, "status": "success", "output": str(output_path)})
            success_count += 1
            logger.info("  [%d/%d] %s → %s", idx, total_frames, frame_png.name, output_path.name)

        except Exception as e:
            logger.error("  [%d] Error: %s", idx, e)
            results.append({"frame": idx, "status": "error", "error": str(e)})
            error_count += 1

    return {
        "status": "success" if error_count == 0 else "partial",
        "series_dir": str(series_dir),
        "output_dir": str(output_dir),
        "total_frames": total_frames,
        "success_count": success_count,
        "error_count": error_count,
        "capture_window_width": window_width,
        "capture_window_center": window_center,
        "rescale_slope": rescale_slope,
        "rescale_intercept": rescale_intercept,
        "target_size": f"{target_rows}x{target_cols}",
        "frames": results,
    }

def find_series_dirs(parent_dir: Path) -> list[Path]:
    """在父目录下查找所有包含 dicom_info.json 和 frame_XXXX.png 的子目录"""
    series_dirs = []
    for child in sorted(parent_dir.iterdir()):
        if not child.is_dir():
            continue
        if (child / "dicom_info.json").exists() and list(child.glob("frame[0-9][0-9][0-9][0-9].png")):
            series_dirs.append(child)
    return series_dirs


def _run_one_series(series_dir: Path, window_width: float, window_center: float, output_subdir: str) -> dict:
    """重建单个 series 并保存 summary 到 series 目录下（不放在输出子目录中）"""
    logger.info("=== Rebuilding: %s ===", series_dir.name)

    result = rebuild_series(
        series_dir=series_dir,
        window_width=window_width,
        window_center=window_center,
        output_subdir=output_subdir,
    )

    # summary 保存在 series 目录下，不放在 reconstructed_dicom 中
    result["rebuilt_at"] = datetime.now().astimezone().isoformat()
    summary_path = series_dir / "rebuild_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    logger.info("  Done: %d/%d success → %s", result["success_count"], result["total_frames"], summary_path.name)
    return result


def main():
    parser = argparse.ArgumentParser(description="从截图+DICOM元数据重建CT DICOM文件")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--series-dir",
        type=Path,
        help="单个 Series 目录，包含 frame_XXXX.png 和 dicom_info.json",
    )
    group.add_argument(
        "--batch-dir",
        type=Path,
        help="批量模式：父目录，自动查找其下所有含 dicom_info.json + frame PNG 的子目录",
    )
    parser.add_argument("--window-width", type=float, default=2000.0, help="截图时使用的窗宽 (default: 2000)")
    parser.add_argument("--window-center", type=float, default=0.0, help="截图时使用的窗位 (default: 0)")
    parser.add_argument("--output-subdir", type=str, default="reconstructed_dicom", help="输出子目录名")
    args = parser.parse_args()

    logger.info("=== DICOM Rebuild ===")
    logger.info("Window: WW=%s WL=%s", args.window_width, args.window_center)

    # 确定要处理的 series 目录列表
    if args.series_dir:
        series_dir = args.series_dir.resolve()
        if not series_dir.is_dir():
            logger.error("Series directory not found: %s", series_dir)
            return 1
        series_list = [series_dir]
    else:
        batch_dir = args.batch_dir.resolve()
        if not batch_dir.is_dir():
            logger.error("Batch directory not found: %s", batch_dir)
            return 1
        series_list = find_series_dirs(batch_dir)
        if not series_list:
            logger.error("No valid series directories found under: %s", batch_dir)
            return 1
        logger.info("Found %d series to rebuild under: %s", len(series_list), batch_dir)

    # 逐个处理
    all_results = []
    for sd in series_list:
        result = _run_one_series(sd, args.window_width, args.window_center, args.output_subdir)
        all_results.append(result)

    # 批量模式下保存总汇总
    if args.batch_dir:
        batch_summary = {
            "batch_dir": str(args.batch_dir.resolve()),
            "rebuilt_at": datetime.now().astimezone().isoformat(),
            "capture_window_width": args.window_width,
            "capture_window_center": args.window_center,
            "series_count": len(all_results),
            "total_success": sum(r["success_count"] for r in all_results),
            "total_errors": sum(r["error_count"] for r in all_results),
            "series": [
                {
                    "series_dir": r["series_dir"],
                    "status": r["status"],
                    "success_count": r["success_count"],
                    "total_frames": r["total_frames"],
                }
                for r in all_results
            ],
        }
        batch_summary_path = args.batch_dir.resolve() / "rebuild_batch_summary.json"
        with open(batch_summary_path, "w", encoding="utf-8") as f:
            json.dump(batch_summary, f, indent=2, ensure_ascii=False)
        logger.info("=== Batch summary: %s ===", batch_summary_path)

    total_ok = sum(r["success_count"] for r in all_results)
    total_all = sum(r["total_frames"] for r in all_results)
    logger.info("=== All done: %d/%d frames across %d series ===", total_ok, total_all, len(all_results))

    return 0 if all(r["status"] == "success" for r in all_results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
