#!/usr/bin/env python3
"""
扫描 batch_dicom_data/，为每个 DICOM 序列生成本地测试链接。

用法:
  python3 scripts/generate_test_links.py
  npm run test:links

可选环境变量:
  BASE_URL=http://localhost:3001
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

try:
    import pydicom  # type: ignore[import-untyped]
except ImportError as exc:
    raise SystemExit(
        "缺少依赖 pydicom。请先运行: python3 -m pip install pydicom"
    ) from exc


BASE_URL = os.environ.get("BASE_URL", "http://localhost:3001").rstrip("/")


def _string_value(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).replace("^", " ").strip()
    return " ".join(text.split()) or fallback


def _format_dicom_date(value: Any) -> str:
    text = _string_value(value)
    if len(text) == 8 and text.isdigit():
        return f"{text[:4]}-{text[4:6]}-{text[6:8]}"
    return text


def _format_dicom_time(value: Any) -> str:
    text = "".join(ch for ch in _string_value(value) if ch.isdigit() or ch == ".")
    if len(text) < 4:
        return _string_value(value)
    hh = text[:2]
    mm = text[2:4]
    ss = text[4:6] if len(text) >= 6 else "00"
    return f"{hh}:{mm}:{ss}"


def _collect_dicom_files(series_dir: Path) -> list[Path]:
    return sorted(
        (
            path
            for path in series_dir.rglob("*")
            if path.is_file() and path.suffix.lower() == ".dcm"
        ),
        key=lambda path: path.as_posix().lower(),
    )


def _read_patient_summary(first_dicom: Path) -> dict[str, str]:
    ds = pydicom.dcmread(first_dicom, stop_before_pixels=True, force=True)
    return {
        "patient_name": _string_value(getattr(ds, "PatientName", None), "匿名患者"),
        "patient_id": _string_value(getattr(ds, "PatientID", None), "UNKNOWN"),
        "patient_sex": _string_value(getattr(ds, "PatientSex", None), "—"),
        "patient_birth_date": _format_dicom_date(getattr(ds, "PatientBirthDate", None))
        or "—",
        "patient_age": _string_value(getattr(ds, "PatientAge", None), "—"),
        "modality": _string_value(getattr(ds, "Modality", None), "CT"),
        "study_date": _format_dicom_date(getattr(ds, "StudyDate", None)) or "—",
        "study_time": _format_dicom_time(getattr(ds, "StudyTime", None)) or "—",
        "accession_number": _string_value(getattr(ds, "AccessionNumber", None), "—"),
        "study_description": _string_value(
            getattr(ds, "StudyDescription", None),
            "—",
        ),
        "series_description": _string_value(
            getattr(ds, "SeriesDescription", None),
            "—",
        ),
    }


def _build_link(study_id: str, dicom_count: int, first_dicom: Path) -> dict[str, Any]:
    encoded_study_id = quote(study_id, safe="")
    return {
        "study_id": study_id,
        "report_url": f"{BASE_URL}/report/{encoded_study_id}",
        "viewer_url": f"{BASE_URL}/hd?study={encoded_study_id}",
        "dicom_count": dicom_count,
        "patient": _read_patient_summary(first_dicom),
    }


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    data_dir = root / "batch_dicom_data"
    output_path = root / "test_links.json"

    if not data_dir.is_dir():
        raise SystemExit(f"未找到数据目录: {data_dir}")

    links: list[dict[str, Any]] = []
    skipped: list[str] = []

    for series_dir in sorted(
        (path for path in data_dir.iterdir() if path.is_dir()),
        key=lambda path: path.name,
    ):
        dicom_files = _collect_dicom_files(series_dir)
        if not dicom_files:
            skipped.append(series_dir.name)
            continue

        links.append(
            _build_link(
                study_id=series_dir.name,
                dicom_count=len(dicom_files),
                first_dicom=dicom_files[0],
            )
        )

    payload: dict[str, Any] = {
        "generated_at": datetime.now().replace(microsecond=0).isoformat(),
        "base_url": BASE_URL,
        "links": links,
    }
    if skipped:
        payload["skipped"] = skipped

    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Generated {len(links)} test links -> {output_path}")
    if skipped:
        print(f"Skipped empty series: {', '.join(skipped)}")

    if len(links) != 8:
        print(f"Warning: expected 8 links, generated {len(links)}", file=sys.stderr)


if __name__ == "__main__":
    main()
