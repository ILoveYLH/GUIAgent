from __future__ import annotations

import random
from datetime import datetime
from pathlib import Path
from uuid import uuid4


LUNG_LOCATIONS = ["右肺上叶前段", "右肺下叶基底段", "左肺上叶舌段", "左肺下叶背段"]
LUNG_TYPES = ["实性", "磨玻璃", "混合性"]
DANGER_LEVELS = ["低危", "中危", "高危"]


def _round(value: float, digits: int = 2) -> float:
    return round(value, digits)


def _frame_count(output_dir: str) -> int:
    return len(list(Path(output_dir).glob("frame_*.png"))) or 1


def _rand_center() -> tuple[float, float, float]:
    return (
        _round(random.uniform(-80, 80)),
        _round(random.uniform(-240, -80)),
        _round(random.uniform(1200, 1500)),
    )


def _spatial_box(min_size: float = 8, max_size: float = 35) -> dict:
    cx, cy, cz = _rand_center()
    return {
        "CenterPointX": cx,
        "CenterPointY": cy,
        "CenterPointZ": cz,
        "Width": _round(random.uniform(min_size, max_size)),
        "Height": _round(random.uniform(min_size, max_size)),
        "Depth": _round(random.uniform(min_size, max_size)),
    }


def _lung_lesion(index: int, total_frames: int, output_dir: str) -> dict:
    slice_index = random.randint(0, max(total_frames - 1, 0))
    long_axis = _round(random.uniform(5.0, 14.0), 1)
    short_axis = _round(max(3.0, long_axis - random.uniform(1.0, 4.0)), 1)
    lesion_type = random.choice(LUNG_TYPES)
    location = random.choice(LUNG_LOCATIONS)
    danger = random.choice(DANGER_LEVELS)
    bbox = _lung_bbox(location)
    return {
        "findingUid": f"lung_{index:03d}_{uuid4().hex[:8]}",
        "dangerStr": danger,
        "boundingBox": bbox,
        "sliceIndex": slice_index,
        "size": [long_axis, short_axis],
        "originalSize": [_round(long_axis + random.uniform(-0.3, 0.3), 3), _round(short_axis + random.uniform(-0.3, 0.3), 3)],
        "hu": _round(random.uniform(-620, 120), 1),
        "volume": _round(random.uniform(120, 2200), 1),
        "type": lesion_type,
        "location": location,
        "symbol": random.choice(["边界清楚", "分叶、胸膜凹陷", "轻度毛刺", "边缘稍模糊"]),
        "filePath": str(Path(output_dir) / "reconstructed_dicom" / f"frame_{slice_index:04d}.dcm"),
        "likelihoodLevel": random.randint(1, 3),
        "Probality": _round(random.uniform(0.62, 0.94), 4),
        **_spatial_box(5, 24),
    }


def _lung_bbox(location: str) -> list[dict[str, int]]:
    box_w = random.randint(42, 76)
    box_h = random.randint(40, 74)
    regions = {
        # DICOM axial display convention: patient's right lung appears on image left.
        "右肺上叶前段": ((300, 455), (365, 555)),
        "右肺下叶基底段": ((285, 455), (515, 710)),
        "左肺上叶舌段": ((585, 760), (390, 580)),
        "左肺下叶背段": ((585, 755), (520, 725)),
    }
    (x_range, y_range) = regions.get(location, ((340, 705), (390, 690)))
    x1 = random.randint(x_range[0], x_range[1])
    y1 = random.randint(y_range[0], y_range[1])
    return [{"x": x1, "y": y1}, {"x": x1 + box_w, "y": y1 + box_h}]


def _rib_lesion(total_frames: int) -> dict:
    _ = total_frames
    return {
        "FindingUID": str(uuid4()),
        **_spatial_box(10, 22),
        "Probality": _round(random.uniform(0.58, 0.86), 4),
        "LikelihoodLevel": 1,
        "BoneType": 1,
        "PreFindingType": 1,
        "SubFindingType": 1,
        "RibLabel": random.randint(2, 11),
        "FindingType": 3,
    }


def _bone_metastasis_lesion(total_frames: int) -> dict:
    _ = total_frames
    return {
        "FindingUID": str(uuid4()),
        **_spatial_box(14, 32),
        "Probability": _round(random.uniform(0.74, 0.93), 4),
        "LikelihoodLevel": 1,
        "BoneType": 2,
        "LocationFirst": 22,
        "LocationSecond": random.randint(1, 12),
        "LesionType": random.choice([11, 12, 13]),
        "Complication": random.choice(["0", "1", "1,2"]),
    }


def _lymphnode_lesion(total_frames: int) -> dict:
    long_axis = _round(random.uniform(12, 32), 2)
    short_axis = _round(random.uniform(7, min(long_axis - 1, 22)), 2)
    slice_index = random.randint(0, max(total_frames - 1, 0))
    return {
        "FindingUID": str(uuid4()),
        **_spatial_box(12, 42),
        "Probability": _round(random.uniform(0.66, 0.9), 4),
        "Long_axis_mm": long_axis,
        "Short_axis_mm": short_axis,
        "Volume": _round(random.uniform(800, 19000), 2),
        "AvgHU": random.randint(20, 230),
        "Slice": slice_index,
        "LesionType": random.choice([1, 2]),
        "LocationType": random.randint(1, 3),
    }


def generate_mock_callback(task_id: str, study_id: str, output_dir: str) -> dict:
    """
    返回一个与 callback.md 成功示例格式一致的 dict。
    """
    total_frames = _frame_count(output_dir)
    random.seed(f"{task_id}:{study_id}:{total_frames}")

    lung_lesions = [_lung_lesion(i + 1, total_frames, output_dir) for i in range(random.randint(2, 3))]
    rib_lesions = [_rib_lesion(total_frames)] if random.random() > 0.35 else []
    bone_metastasis_lesions = [_bone_metastasis_lesion(total_frames)] if random.random() > 0.65 else []
    lymphnode_lesions = [_lymphnode_lesion(total_frames)] if random.random() > 0.55 else []

    lung_summary = "；".join(
        f"{item['location']}见{item['type']}结节，约{item['size'][0]}x{item['size'][1]}mm，{item['dangerStr']}"
        for item in lung_lesions
    )
    extra_parts = []
    if rib_lesions:
        extra_parts.append(f"肋骨可疑骨折灶{len(rib_lesions)}处")
    if bone_metastasis_lesions:
        extra_parts.append(f"骨转移可疑灶{len(bone_metastasis_lesions)}处")
    if lymphnode_lesions:
        extra_parts.append(f"淋巴结可疑增大{len(lymphnode_lesions)}处")

    summary = f"共检出肺结节{len(lung_lesions)}个"
    if extra_parts:
        summary += "，" + "，".join(extra_parts)
    detail = lung_summary
    if extra_parts:
        detail += "。另见" + "，".join(extra_parts)
    detail += "。建议结合原始报告、薄层图像及既往影像综合判断。"

    return {
        "task_id": task_id,
        "case_id": study_id,
        "study_uid": study_id,
        "series_uid": f"{study_id}.mock.series",
        "status": "success",
        "message": "mock calculation completed",
        "report": {
            "title": "一扫多查分析报告",
            "summary": summary,
            "detail": detail,
        },
        "lung_lesions": lung_lesions,
        "rib_lesions": rib_lesions,
        "bone_metastasis_lesions": bone_metastasis_lesions,
        "lymphnode_lesions": lymphnode_lesions,
        "callback_time": datetime.now().isoformat(timespec="seconds"),
    }
