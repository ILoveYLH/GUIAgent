"""Read source DICOM tags into the dicom_info.json format used by rebuild_dicom."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pydicom
from pydicom.datadict import keyword_for_tag
from pydicom.multival import MultiValue
from pydicom.sequence import Sequence
from pydicom.tag import Tag

REFERENCE_INFO_PATH = Path(__file__).resolve().parents[1] / "dicom_info.json"
TAG_RE = re.compile(r"\(([0-9A-Fa-f]{4}),\s*([0-9A-Fa-f]{4})\)")


def _tag_text(tag: Tag) -> str:
    return f"({tag.group:04X}, {tag.element:04X})"


def _parse_tag_text(tag_text: str) -> Tag:
    match = TAG_RE.fullmatch(tag_text.strip())
    if not match:
        raise ValueError(f"Invalid DICOM tag text: {tag_text}")
    return Tag(int(match.group(1), 16), int(match.group(2), 16))


def _description(elem: Any) -> str:
    keyword = getattr(elem, "keyword", "") or keyword_for_tag(elem.tag)
    return keyword or str(getattr(elem, "name", ""))


def _value_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, Sequence):
        return str(value)
    if isinstance(value, MultiValue) or isinstance(value, (list, tuple)):
        return ",".join(_value_text(v) for v in value)
    return str(value)


def _find_first_dcm(study_dir: Path) -> Path:
    if not study_dir.is_dir():
        raise FileNotFoundError(f"DICOM study directory not found: {study_dir}")
    files = sorted(study_dir.glob("*.dcm"))
    if not files:
        files = sorted(p for p in study_dir.iterdir() if p.is_file())
    if not files:
        raise FileNotFoundError(f"No DICOM files found in {study_dir}")
    return files[0]


def _load_reference_template(path: str | Path | None = None) -> list[dict[str, str]]:
    template_path = Path(path) if path else REFERENCE_INFO_PATH
    with open(template_path, "r", encoding="utf-8") as f:
        return json.load(f)


def read_first_dcm_metadata(
    batch_dicom_dir: str | Path,
    study_id: str,
    window_width: float = 2000.0,
    window_center: float = 0.0,
    reference_info_path: str | Path | None = None,
) -> list[dict[str, str]]:
    """Read tags from the first source DICOM, limited to the reference JSON fields."""
    root = Path(batch_dicom_dir).expanduser()
    if not root.is_absolute():
        cwd_root = (Path.cwd() / root).resolve()
        project_root = (Path(__file__).resolve().parents[2] / root).resolve()
        root = cwd_root if cwd_root.exists() else project_root
    study_dir = root / study_id
    first_dcm = _find_first_dcm(study_dir)
    ds = pydicom.dcmread(first_dcm, stop_before_pixels=True, force=True)
    template = _load_reference_template(reference_info_path)
    elements_by_tag = {Tag(elem.tag): elem for elem in ds.iterall() if elem.tag != Tag(0x7FE0, 0x0010)}

    rows: list[dict[str, str]] = []
    for item in template:
        tag = _parse_tag_text(item["tag"])
        description = item.get("description", "")
        elem = elements_by_tag.get(tag)
        value = _value_text(elem.value) if elem is not None else ""
        if description == "WindowWidth":
            value = str(int(window_width) if float(window_width).is_integer() else window_width)
        elif description == "WindowCenter":
            value = str(int(window_center) if float(window_center).is_integer() else window_center)
        rows.append(
            {
                "tag": item["tag"],
                "description": description,
                "value": value,
            }
        )

    return rows
