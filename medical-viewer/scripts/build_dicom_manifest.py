#!/usr/bin/env python3
"""
生成 public/dicom-series.json，供 HD 阅片页加载。

CT：请将整套 .dcm 放在同一文件夹内，并将该文件夹置于 public/（如 dicom000），
在项目根目录运行本脚本。

默认只处理 public/ 下四个固定目录（顺序固定）：
  1. dicom000  — CT 数据集
  2. dicom001  — CT 数据集
  3. x-ray000 — X-ray 数据集
  4. x-ray001 — X-ray 数据集

同一目录内多个 .dcm 会合并为一条序列的 dcmPaths（多切片叠层）。

切片顺序（需 pydicom，生成清单时确定，翻页顺序与 dcmPaths 数组一致）：
  1) ImageOrientationPatient 与 ImagePositionPatient 计算「沿切片法向」的位置（点积），
     适用于任意体位/层面的 CT/MR 叠层；
  2) 若无方向信息，则 ImagePositionPatient 的 Z、或 SliceLocation；
  3) 再否则 InstanceNumber；
  4) 最后文件名。

缩略图（可选）：若存在 public/<folder>_pngs/（如 x-ray000 对应 x-ray000_pngs），
会从中选取一张图片写入 thumbnailPath（优先 thumb / preview 等文件名）。

用法（项目根目录）:
  python3 scripts/build_dicom_manifest.py
  npm run dicom:manifest

可选: pip install pydicom（推荐，用于 CT 切片排序与 Modality）
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# 固定顺序：仅这些 public 子目录会写入清单（可按需增删改 folder）
# hint: pydicom 不可用时用于展示标签；有 pydicom 时以文件内 Modality 为准
# ---------------------------------------------------------------------------
DATASETS: list[dict[str, str | None]] = [
    {"folder": "dicom000", "hint": "CT"},
    {"folder": "dicom001", "hint": "CT"},
    {"folder": "x-ray000", "hint": "DX"},
    {"folder": "x-ray001", "hint": "DX"},
]


def _try_read_dicom_order_key(
    path: Path,
) -> tuple[str | None, tuple]:
    """
    返回 (modality, sort_tuple)。sort_tuple 用于 sorted(..., key=)。
    优先用 IPP 在切片法向（IOP 的行列叉积）上的投影位置排序，避免仅用 IPP.z 导致非轴位序列颠倒。
    """
    try:
        import pydicom  # type: ignore[import-untyped]

        ds = pydicom.dcmread(path, stop_before_pixels=True, force=True)
        mod = getattr(ds, "Modality", None)
        mod_s = str(mod).strip() if mod is not None else None

        inst = getattr(ds, "InstanceNumber", None)
        inst_i: int | None = None
        if inst is not None and str(inst).strip() != "":
            try:
                inst_i = int(str(inst).strip())
            except ValueError:
                inst_i = None

        ipp = getattr(ds, "ImagePositionPatient", None)
        iop = getattr(ds, "ImageOrientationPatient", None)

        pos_along_normal: float | None = None
        if ipp is not None and iop is not None and len(ipp) >= 3 and len(iop) >= 6:
            try:
                rx, ry, rz = (float(iop[i]) for i in range(3))
                cx, cy, cz = (float(iop[i]) for i in range(3, 6))
                nx = ry * cz - rz * cy
                ny = rz * cx - rx * cz
                nz = rx * cy - ry * cx
                px, py, pz = (float(ipp[i]) for i in range(3))
                pos_along_normal = px * nx + py * ny + pz * nz
            except (TypeError, ValueError, IndexError):
                pos_along_normal = None

        if pos_along_normal is None and ipp is not None and len(ipp) >= 3:
            try:
                pos_along_normal = float(ipp[2])
            except (TypeError, ValueError):
                pass

        if pos_along_normal is None:
            sl = getattr(ds, "SliceLocation", None)
            if sl is not None and str(sl).strip() != "":
                try:
                    pos_along_normal = float(sl)
                except (TypeError, ValueError):
                    pass

        name = path.name.lower()
        inst_tie = float(inst_i) if inst_i is not None else -1e18

        if pos_along_normal is not None:
            return (mod_s, (0, pos_along_normal, inst_tie, name))
        if inst_i is not None:
            return (mod_s, (1, float(inst_i), name))
        return (mod_s, (2, name))
    except Exception:
        return (None, (3, path.name.lower()))


def _collect_dcms(public: Path, folder: str) -> list[Path]:
    """收集 public/<folder>/ 下（含子目录）所有 .dcm / .DCM（扩展名大小写不敏感）。"""
    base = public / folder
    if not base.is_dir():
        return []
    paths = [
        p
        for p in base.rglob("*")
        if p.is_file() and p.suffix.lower() == ".dcm"
    ]
    return sorted(paths, key=lambda p: p.as_posix().lower())


_THUMB_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def _find_thumbnail(public: Path, folder: str) -> str | None:
    """
    在 public/<folder>_pngs/ 下找一张预览图，返回相对 public 的路径。
    例如 folder=x-ray000 -> public/x-ray000_pngs/*.png
    """
    thumb_dir = public / f"{folder}_pngs"
    if not thumb_dir.is_dir():
        return None
    candidates: list[Path] = []
    for p in thumb_dir.rglob("*"):
        if p.is_file() and p.suffix.lower() in _THUMB_EXTS:
            candidates.append(p)
    if not candidates:
        return None

    preferred = (
        "thumb.png",
        "thumb.jpg",
        "thumbnail.png",
        "thumbnail.jpg",
        "preview.png",
        "preview.jpg",
    )
    for name in preferred:
        for p in candidates:
            if p.name.lower() == name:
                return p.relative_to(public).as_posix()

    candidates.sort(key=lambda p: p.as_posix().lower())
    return candidates[0].relative_to(public).as_posix()


def _majority_modality(metas: list[tuple[str | None, object]]) -> str | None:
    mods = [m[0] for m in metas if m[0]]
    if not mods:
        return None
    from collections import Counter

    return Counter(mods).most_common(1)[0][0]


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    public = root / "public"
    if not public.is_dir():
        raise SystemExit(f"未找到 public 目录: {public}")

    try:
        import pydicom  # noqa: F401

        has_pydicom = True
    except ImportError:
        has_pydicom = False

    series: list[dict] = []
    skipped: list[str] = []

    for cfg in DATASETS:
        folder = cfg["folder"]
        hint = cfg.get("hint")
        path_objs = _collect_dcms(public, folder)

        if not path_objs:
            skipped.append(folder)
            continue

        if has_pydicom:
            metas = [_try_read_dicom_order_key(p) for p in path_objs]
            modality = _majority_modality(metas)
            paired = list(zip(path_objs, metas))
            paired.sort(key=lambda x: x[1][1])
            sorted_paths = [p for p, _ in paired]
        else:
            modality = None
            sorted_paths = sorted(path_objs, key=lambda p: p.as_posix().lower())

        rel_paths = [p.relative_to(public).as_posix() for p in sorted_paths]

        mod_out = modality or (str(hint) if hint else None)
        if mod_out:
            label = f"{mod_out} · {folder}"
        else:
            label = f"序列 · {folder}"

        entry: dict = {
            # 与目录名一致，便于对照 public/<folder>/
            "id": folder.replace("\\", "/").replace("/", "-"),
            "label": label,
            "dcmPaths": rel_paths,
        }
        if mod_out:
            entry["modality"] = mod_out

        thumb = _find_thumbnail(public, folder)
        if thumb:
            entry["thumbnailPath"] = thumb

        series.append(entry)

    out: dict = {"generated": True, "series": series}
    if not has_pydicom:
        out["note"] = "未安装 pydicom：未从文件读取 Modality，标签使用目录 hint；CT 切片顺序为路径名。建议: pip install pydicom"
    if skipped:
        out["skippedEmptyFolders"] = skipped

    out_path = public / "dicom-series.json"
    out_path.write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    total_files = sum(len(s["dcmPaths"]) for s in series)
    print(f"已写入 {out_path}")
    print(f"  序列数: {len(series)}，.dcm 总数: {total_files}")
    if skipped:
        print(f"  跳过（目录不存在或无 .dcm）: {', '.join(skipped)}", file=sys.stderr)
    print(
        "  pydicom: "
        + ("已启用（排序/ modality）" if has_pydicom else "未安装，建议 pip install pydicom")
    )


if __name__ == "__main__":
    main()
