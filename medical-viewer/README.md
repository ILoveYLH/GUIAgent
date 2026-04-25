# Medical Viewer

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cornerstone](https://img.shields.io/badge/Cornerstone.js-4.x-0f766e)](https://www.cornerstonejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

一个面向专业阅片场景的 Web 医学影像工作站，基于 Next.js、TypeScript 与 Cornerstone.js 构建，提供接近 PACS 的序列浏览、布局切换、调窗、CINE 播放与本地影像导入能力。

项目重点围绕以下方向展开：

- 高性能渲染：基于 Cornerstone.js 的浏览器端影像渲染链路，支持 Web Worker 初始化，并在 WebGL 不可用时降级到 CPU 渲染。
- 多视口协同：支持多种视口布局、序列对比、切片联动与视口状态同步，适合临床浏览与教学演示。
- 国产化适配：界面与工作流采用中文医疗语义与深色阅片风格，适配本地化医院场景与医生使用习惯。

## Project Overview

`Medical Viewer` 是一个基于 Web 的专业医学影像阅片工作站原型，当前聚焦于 CT / CR 等序列浏览体验，覆盖从本地 DICOM 导入、序列挂载、窗宽窗位调节，到多视口协同、CINE 播放与角标信息展示等核心流程。

相比常规 Demo，它更强调真实工作站中的交互密度与专业信息表达，例如：

- 以视口为中心的布局编排与序列挂载
- 四角信息、方向标记、切片进度与 WL/WW 状态实时叠加
- 贴近医生工作流的工具栏、调窗预设与深色主题

## Core Features

### 功能总览

| 模块 | 当前状态 | 代码落点 |
| --- | --- | --- |
| 多维度布局控制 | 已实现全局视口布局切换；部分布局/模板入口已预留，实际胶片化工作流仍在完善 | `src/components/hd/HdModePage.tsx`, `src/components/hd/HdSidebarToolbar.tsx` |
| 专业影像操作 | 已实现窗宽窗位预设切换、切片浏览与视口状态反馈 | `src/components/hd/HdSidebarToolbar.tsx`, `src/components/hd/HdDicomViewport.tsx` |
| 3D CINE 电影播放 | 已实现多帧序列播放、FPS 调节、进度跳转与悬浮控制条 | `src/components/hd/CineControlBar.tsx`, `src/components/hd/HdDicomViewport.tsx` |
| 四角信息叠加 | 已实现 DICOM 元数据解析与视口角标叠加 | `src/components/hd/ViewportCell.tsx`, `src/lib/parseDicomOverlay.ts` |
| 本地数据导入 | 已实现本地 DICOM 拖拽/选择导入，并按序列分组排序 | `src/components/hd/HdSeriesSidebarList.tsx`, `src/lib/hdLocalDicomUpload.ts` |

### 1. 多维度布局控制

项目在布局层面提供了可直接使用的多视口编排能力：

- 全局视口布局：支持 `1x1`、`2x1`、`1x2`、`2x2`、`3x3` 以及多种非对称布局，如 `1-2_top`、`2-1_left`、`3-1_right`。

| 布局能力 | 说明 |
| --- | --- |
| 全局网格布局 | 适合单序列精读、多序列对照、教学演示与挂片浏览 |
| 非对称布局 | 支持大图带小图、多列多行等阅片工作站常见排布方式 |

### 2. 专业影像操作

项目当前已稳定可用的影像操作，主要集中在窗宽窗位预设、切片浏览与视口信息反馈。

| 功能 | 当前情况 |
| --- | --- |
| 窗宽窗位预设 | 已实现 `Brain`、`Bone`、`Lung`、`Mediastinum`、`Abdomen`、`Pelvic` 等 CT 常用预设 |
| 切片浏览 | 支持多层序列逐层浏览，并同步显示当前层号与总层数 |
| 视口状态反馈 | 实时显示当前 WL/WW、缩放倍率等浏览状态 |

当前预设窗参数来自项目内置配置：

| Preset | WL | WW |
| --- | ---: | ---: |
| Brain | 35 | 80 |
| Bone | 800 | 2600 |
| Lung | -600 | 1600 |
| Mediastinum | 40 | 400 |
| Abdomen | 40 | 300 |
| Pelvic | 30 | 400 |

### 3. 3D CINE 电影播放

针对多切片序列，系统支持 CINE 自动播放模式：

- 基于 `requestAnimationFrame` 驱动切片轮播
- 支持播放/暂停、首帧/末帧跳转、逐帧前后切换
- 支持 `1-60 FPS` 调节
- 悬浮式控制条仅在激活视口悬停时显示，保持界面干净

| 控件 | 说明 |
| --- | --- |
| Play / Pause | 开始或暂停自动播放 |
| First / Last | 快速跳转到首帧或末帧 |
| Prev / Next | 逐帧切换 |
| Seek Bar | 拖拽定位目标层面 |
| FPS 调节 | 控制电影播放速度 |

### 4. 四角信息叠加

影像视口支持专业 PACS 风格的四角信息叠加，包含：

- 患者信息：姓名、ID、性别/年龄
- 检查与设备信息：检查日期时间、机构、模态、厂商
- 序列状态：层厚、图像尺寸、层号/总层数、缩放倍率
- 显示参数：实时 `WL / WW`

这些信息由 DICOM 元数据解析得到，并在视口状态更新时与当前层面同步刷新。

### 5. 本地数据导入

项目当前已稳定支持面向临床测试与教学场景的本地 DICOM 导入：

- 支持拖拽或文件选择方式导入本地 DICOM
- 自动识别 `.dcm`、无扩展名 DICOM、DICOM MIME 文件
- 自动按 `SeriesInstanceUID` 分组
- 依据 `SliceLocation`、`ImagePositionPatient`、`InstanceNumber` 进行排序

## Quick Start

### 安装依赖

```bash
npm install
```

或：

```bash
yarn install
```

### 开发环境运行

```bash
npm run dev
```

默认开发地址：

```text
http://localhost:3001
```

启动成功后，可直接在浏览器打开 `http://localhost:3001` 查看项目。

### 打包构建

```bash
npm run build
```

### 生产启动

```bash
npm run start
```

## Tech Stack

| 分类 | 技术 |
| --- | --- |
| 框架 | Next.js 16（App Router）, React 19, TypeScript 5 |
| 样式系统 | Tailwind CSS 4 |
| UI 交互 | Radix UI primitives（Tooltip / Toggle Group） |
| 影像引擎 | `@cornerstonejs/core`, `@cornerstonejs/tools`, `@cornerstonejs/dicom-image-loader` |
| DICOM 解析 | `dicom-parser`, `dcmjs` |
| NIfTI 与压缩 | `nifti-reader-js`, `pako` |
| 其他能力 | `qrcode`, `lucide-react` |

说明：

- 当前项目已使用 Radix UI 原子组件能力。
- 仓库中暂未引入完整的 Shadcn UI 组件脚手架，但整体交互组织方式与其组合式设计思路兼容。
- 影像引擎基于 Cornerstone.js 4.x 生态，而不是旧版 v2/v3 API。

## Project Structure

```text
src/
  app/                    Next.js App Router 页面与 API 路由
    api/hd-share/         本地导入序列的分享接口
    hd/                   高清阅片工作站主页面
    film/                 胶片浏览页面
    cloud-film/           云胶片首页与落地页
    qr/                   二维码页面
  components/
    hd/                   阅片工作站核心业务组件
    film/                 胶片视图组件
    cloud-film/           首页/云胶片展示组件
  lib/                    影像数据、Cornerstone 初始化、布局配置、上传与工具逻辑
  types/                  三方库补充类型定义
public/                   示例 DICOM、PNG、NIfTI 与静态资源
scripts/                  数据清单构建与辅助脚本
```

结构说明：

- `src/app/`：负责页面路由、分享接口与应用入口。
- `src/components/hd/`：项目最核心的阅片工作站组件，包含侧边工具栏、序列列表、视口单元、CINE 控件等。
- `src/lib/`：承担“状态组织 + 工具能力 + 数据处理”的核心职责。当前项目没有独立的 `store/` 或 `hooks/` 目录，状态主要集中在 `HdModePage`，并由 `lib/` 中的配置与处理模块协同支撑。

## Visual Specification

项目采用“深度医疗黑”主题作为主视觉基调，目标是贴近真实医生阅片环境：

- 主背景以近黑色为主，降低长时间阅片的视觉疲劳
- 高亮状态使用冷色系蓝青色，突出激活视口与关键操作
- 影像层叠信息采用高对比黄字叠加，保留传统 PACS 的可读习惯
- 工具栏、浮层与控制条保持低干扰、强层级、轻装饰的专业风格

这种视觉规范适合：

- 放射科/影像科暗环境阅片
- 多视口长时间工作
- 教学演示与临床工作站风格统一

## Cornerstone Initialization

下面的代码片段展示了项目当前的 Cornerstone 初始化方式，包括一次性初始化、色图注册、DICOM Loader 初始化与 CPU 回退支持：

```ts
import { setUseCPURendering } from "@cornerstonejs/core";

let ready: Promise<void> | null = null;

export function ensureCornerstone(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (!ready) {
    ready = (async () => {
      const [{ init }, dicomLoader] = await Promise.all([
        import("@cornerstonejs/core"),
        import("@cornerstonejs/dicom-image-loader"),
      ]);
      init();
      dicomLoader.default.init({ maxWebWorkers: 6 });
      const { init: initTools } = await import("@cornerstonejs/tools");
      initTools();
    })();
  }
  return ready;
}

export function enableCpuRenderingFallback(): void {
  setUseCPURendering(true);
}
```

完整实现可参考 [src/lib/cornerstoneBootstrap.ts](/home/julia/Projects/medical-viewer-zs-web/src/lib/cornerstoneBootstrap.ts)。

## Available Scripts

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发环境，默认端口 `3001` |
| `npm run build` | 生成生产构建 |
| `npm run start` | 启动生产服务 |
| `npm run lint` | 运行 ESLint |
| `npm run dicom:manifest` | 生成 DICOM 清单 |

## Notes

- 仓库包含示例医学影像数据，仅建议在授权与脱敏前提下用于开发、测试与演示。
- 首次加载本地大体积序列时，浏览器会有一定解析与注册开销，属于预期行为。
- 部分工具与高级能力仍处于开发中，当前文档优先描述已验证可用或代码上较明确落地的功能。
