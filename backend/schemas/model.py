from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CallbackModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Point2D(CallbackModel):
    x: float
    y: float


class ReportSection(CallbackModel):
    title: str | None = None
    summary: str
    detail: str


class SpatialLesion(CallbackModel):
    FindingUID: str
    CenterPointX: float
    CenterPointY: float
    CenterPointZ: float
    Width: float
    Height: float
    Depth: float


class LungLesion(CallbackModel):
    findingUid: str
    dangerStr: str | None = None
    boundingBox: list[Point2D] = Field(min_length=2, max_length=2)
    sliceIndex: int | None = None
    size: list[float] | None = None
    originalSize: list[float] | None = None
    hu: float | None = None
    volume: float | None = None
    type: str | None = None
    location: str
    symbol: str | None = None
    filePath: str | None = None
    likelihoodLevel: int | None = None
    Probality: float | None = None
    Width: float
    Height: float
    Depth: float
    CenterPointX: float
    CenterPointY: float
    CenterPointZ: float


class RibLesion(SpatialLesion):
    Probality: float | None = None
    Probability: float | None = None
    LikelihoodLevel: int | None = None
    BoneType: int | None = None
    PreFindingType: int | None = None
    SubFindingType: int | None = None
    RibLabel: int | None = None
    FindingType: int | None = None


class BoneMetastasisLesion(SpatialLesion):
    Probality: float | None = None
    Probability: float | None = None
    LikelihoodLevel: int | None = None
    BoneType: int | None = None
    LocationFirst: int | None = None
    LocationSecond: int | None = None
    LesionType: int | None = None
    Complication: str | None = None


class LymphnodeLesion(SpatialLesion):
    Probality: float | None = None
    Probability: float | None = None
    Long_axis_mm: float | None = None
    Short_axis_mm: float | None = None
    Volume: float | None = None
    AvgHU: float | None = None
    Slice: int | None = None
    LesionType: int | None = None
    LocationType: int | None = None


class YisaoCallbackRequest(CallbackModel):
    task_id: str
    case_id: str | None = None
    study_uid: str | None = None
    series_uid: str | None = None
    status: Literal["success", "failed", "partial_success"]
    message: str | None = None
    error_code: str | None = None
    report: ReportSection
    lung_lesions: list[LungLesion] = Field(default_factory=list)
    rib_lesions: list[RibLesion] = Field(default_factory=list)
    bone_metastasis_lesions: list[BoneMetastasisLesion] = Field(default_factory=list)
    lymphnode_lesions: list[LymphnodeLesion] = Field(default_factory=list)
    callback_time: str
