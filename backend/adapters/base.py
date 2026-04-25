"""
ViewerAdapter 抽象基类 — 所有查看器操作的统一接口。

切换 mock ↔ real 查看器时，只需实现新 adapter，
GUI Agent 核心逻辑完全不变。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.async_api import Page


@dataclass
class FrameMetadata:
    """单帧截图的完整元数据。"""

    index: int
    total_frames: int
    window_center: float
    window_width: float
    slice_location: float | None = None
    pixel_spacing: tuple[float, float] | None = None
    image_position: tuple[float, float, float] | None = None
    rows: int = 512
    columns: int = 512


@dataclass
class FrameCapture:
    """一帧的截图路径 + 元数据。"""

    screenshot_path: str
    metadata: FrameMetadata


@dataclass
class MedicalReport:
    """从报告页面提取的结构化报告。"""

    patient_name: str = ""
    patient_id: str = ""
    gender: str = ""
    age: str = ""
    study_date: str = ""
    modality: str = ""
    institution: str = ""
    findings: str = ""        # 影像所见
    diagnosis: str = ""       # 诊断意见
    raw: dict = field(default_factory=dict)  # 原始数据


@dataclass
class AgentResult:
    """GUI Agent 完整处理结果。"""

    report: MedicalReport
    frames: list[FrameCapture]
    study_id: str
    dicom_paths: list[str] = field(default_factory=list)  # 重建或直接加载的 DICOM


class ViewerAdapter(ABC):
    """查看器适配器抽象基类。"""

    @abstractmethod
    async def extract_report(self, page: Page) -> MedicalReport:
        """从当前页面提取医学报告。"""
        ...

    @abstractmethod
    async def switch_to_viewer(self, page: Page) -> None:
        """从报告页切换到影像浏览界面。"""
        ...

    @abstractmethod
    async def get_total_frames(self, page: Page) -> int:
        """获取当前序列的总帧数。"""
        ...

    @abstractmethod
    async def goto_frame(self, page: Page, index: int) -> None:
        """跳转到指定帧（0-indexed）。"""
        ...

    @abstractmethod
    async def get_frame_metadata(self, page: Page) -> FrameMetadata:
        """获取当前帧的窗宽窗位等元数据。"""
        ...

    @abstractmethod
    async def capture_frame(self, page: Page, output_dir: str, index: int) -> str:
        """
        对当前帧进行截图并保存。

        Returns:
            截图文件的绝对路径。
        """
        ...

    @abstractmethod
    async def wait_for_viewer_ready(self, page: Page) -> None:
        """等待影像查看器完全加载就绪。"""
        ...
