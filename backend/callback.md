# 一扫多查结果回调接口文档 v2.0

## 1. 接口说明

该接口用于接收"一扫多查"平台在完成医学影像分析后的结果回调。

流程如下：

1. 我方上传 DICOM 至指定目录
2. 一扫多查平台完成计算
3. 平台通过 HTTP POST 回调本接口
4. 返回分析报告 + **多病灶结构化数据（支持物理毫米坐标定位）**

---

## 2. 接口信息

- **接口地址**

```
POST /api/yisao-duocha/callback
```

- **请求方式**

```
POST
```

- **Content-Type**

```
application/json
```

---

## 3. 请求体结构

### 3.1 示例（成功）

```json
{
  "task_id": "task_20260422_001",
  "case_id": "case_001",
  "study_uid": "1.2.826.0.1.3680043.8.498.123456789",
  "series_uid": "1.2.826.0.1.3680043.8.498.987654321",
  "status": "success",
  "message": "calculation completed",
  "report": {
    "title": "一扫多查分析报告",
    "summary": "双肺可见小结节，右侧肋骨见骨折。",
    "detail": "右肺上叶尖段见实性结节，约7×5mm。右侧第11肋骨见错位性骨折。"
  },
  "lung_lesions": [
    {
      "findingUid": "lesion_001",
      "dangerStr": "低危",
      "boundingBox": [
        {"x": 153, "y": 220},
        {"x": 204, "y": 276}
      ],
      "sliceIndex": 10,
      "size": [24, 21],
      "originalSize": [24.188923084750982, 20.644887987102276],
      "hu": 82.11046990931574,
      "volume": 4450.05908203125,
      "type": "实性",
      "location": "右肺上叶前段",
      "symbol": "分叶、胸膜凹陷",
      "filePath": "/data/FileServer/20260322/CT/.../xxx.dcm",
      "likelihoodLevel": 1,
      "Probality": 0.6501529574394226,
      "Width": 21.233628273010254,
      "Height": 21.741793155670166,
      "Depth": 19.419865608215332,
      "CenterPointX": -42.47348213195801,
      "CenterPointY": -194.05539321899414,
      "CenterPointZ": 1405.472135925293
    }
  ],
  "rib_lesions": [
    {
      "FindingUID": "2e182d55-73a5-4626-b325-3e714ba45725",
      "CenterPointX": -59.140625,
      "CenterPointY": -232.3671875,
      "CenterPointZ": 1468.65,
      "Width": 13.13671875,
      "Height": 13.13671875,
      "Depth": 14.7,
      "Probality": 0.6,
      "LikelihoodLevel": 1,
      "BoneType": 1,
      "PreFindingType": 1,
      "SubFindingType": 1,
      "RibLabel": 2,
      "FindingType": 3
    }
  ],
  "bone_metastasis_lesions": [
    {
      "FindingUID": "c0ebffb3-59bb-43dd-b6ab-12ff2f0f2757",
      "CenterPointX": 11.987887531518936,
      "CenterPointY": -100.77305042743683,
      "CenterPointZ": 1423.4866114020347,
      "Width": 19.74530792236328,
      "Height": 17.81663703918457,
      "Depth": 15.307428359985352,
      "Probability": 0.982177734375,
      "LikelihoodLevel": 1,
      "BoneType": 2,
      "LocationFirst": 22,
      "LocationSecond": 6,
      "LesionType": 12,
      "Complication": "1,2"
    }
  ],
  "lymphnode_lesions": [
    {
      "FindingUID": "b69840d0-9ee9-400f-bd77-b1bf8d7096d6",
      "CenterPointX": 142.46444755792618,
      "CenterPointY": -155.40605732798576,
      "CenterPointZ": -147.1310546875,
      "Width": 25.83639907836914,
      "Height": 32.202080726623535,
      "Depth": 42.78077030181885,
      "Probability": 0.8878173828125,
      "Long_axis_mm": 31.570939202663457,
      "Short_axis_mm": 24.221624135971084,
      "Volume": 19285.52032470703,
      "AvgHU": 231,
      "Slice": 114,
      "LesionType": 1,
      "LocationType": 1
    }
  ],
  "callback_time": "2026-04-22T16:30:00"
}
```

### 3.2 示例（失败）

```json
{
  "task_id": "task_20260422_001",
  "case_id": "case_001",
  "status": "failed",
  "message": "datacheck failed",
  "error_code": "DATACHECK_FAILED",
  "report": {
    "title": "一扫多查分析报告",
    "summary": "",
    "detail": ""
  },
  "lung_lesions": [],
  "rib_lesions": [],
  "bone_metastasis_lesions": [],
  "lymphnode_lesions": [],
  "callback_time": "2026-04-22T16:35:00"
}
```

---

## 4. 字段说明

### 4.1 顶层字段

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `task_id` | string | 是 | 任务唯一标识 |
| `case_id` | string | 否 | 病例编号 |
| `study_uid` | string | 否 | StudyInstanceUID |
| `series_uid` | string | 否 | SeriesInstanceUID |
| `status` | string | 是 | 状态：`success` / `failed` / `partial_success` |
| `message` | string | 否 | 补充说明或错误信息 |
| `error_code` | string | 否 | 错误码，如 `DATACHECK_FAILED` |
| `report` | object | 是 | 综合分析报告 |
| `lung_lesions` | array | 否 | 肺结节病灶列表 |
| `rib_lesions` | array | 否 | 肋骨骨折病灶列表 |
| `bone_metastasis_lesions` | array | 否 | 骨转移病灶列表 |
| `lymphnode_lesions` | array | 否 | 淋巴结病灶列表 |
| `callback_time` | string | 是 | 回调时间，ISO 8601 格式 |

### 4.2 report 字段

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `title` | string | 否 | 报告标题 |
| `summary` | string | 是 | 简要结论 |
| `detail` | string | 是 | 详细报告内容 |

---

### 4.3 肺结节病灶 (lung_lesions)

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `findingUid` | string | 是 | 病灶唯一标识 |
| `dangerStr` | string | 否 | 风险等级文字："高危" / "中危" / "低危" |
| `boundingBox` | array | 是 | 横断位2D框坐标，格式：`[{x:左上x, y:左上y}, {x:右下x, y:右下y}]` |
| `sliceIndex` | integer | 否 | 长短径交点所在层的索引（从0开始） |
| `size` | array\[number\] | 否 | 病灶长短径数值，单位 mm，格式：`[长径, 短径]` |
| `originalSize` | array\[number\] | 否 | 病灶长短径原始测量值 |
| `hu` | number | 否 | 病灶平均 CT 值 (HU) |
| `volume` | number | 否 | 病灶体积，单位 mm³ |
| `type` | string | 否 | 密度类型，如："实性" / "磨玻璃" / "混合性" |
| `location` | string | 是 | 解剖学位置描述，如："右肺上叶前段" |
| `symbol` | string | 否 | 影像征象描述，如："分叶、胸膜凹陷" |
| `filePath` | string | 否 | 长短径交点所在层的 DICOM 图像文件路径 |
| `likelihoodLevel` | integer | 否 | 算法敏感度档位：1低假阳 / 2中档 / 3高灵敏 |
| `Probality` | number | 否 | 算法原始置信度 (0~1) |
| **空间定位字段** | | | **三维物理坐标 (毫米)** |
| `Width` | number | 是 | 病灶3D框 X轴方向长度 (mm) |
| `Height` | number | 是 | 病灶3D框 Y轴方向长度 (mm) |
| `Depth` | number | 是 | 病灶3D框 Z轴方向长度 (mm) |
| `CenterPointX` | number | 是 | 病灶3D框中心 X 坐标 (mm) |
| `CenterPointY` | number | 是 | 病灶3D框中心 Y 坐标 (mm) |
| `CenterPointZ` | number | 是 | 病灶3D框中心 Z 坐标 (mm) |

### 4.4 肋骨骨折病灶 (rib_lesions)

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `FindingUID` | string | 是 | 病灶唯一标识 |
| `Probality` | number | 否 | 算法原始置信度 (0~1) |
| `LikelihoodLevel` | integer | 否 | 算法敏感度档位：1低假阳 / 2中档 / 3高灵敏 |
| `BoneType` | integer | 否 | 骨头类型枚举值 (详见附录) |
| `PreFindingType` | integer | 否 | 病灶一级位置枚举值 (详见附录) |
| `SubFindingType` | integer | 否 | 病灶二级位置枚举值 (详见附录) |
| `RibLabel` | integer | 否 | 病灶三级位置（具体第几根肋骨） |
| `FindingType` | integer | 否 | 骨折类型枚举值 (详见附录) |
| **空间定位字段** | | | **三维物理坐标 (毫米)** |
| `Width` | number | 是 | 病灶3D框 X轴方向长度 (mm) |
| `Height` | number | 是 | 病灶3D框 Y轴方向长度 (mm) |
| `Depth` | number | 是 | 病灶3D框 Z轴方向长度 (mm) |
| `CenterPointX` | number | 是 | 病灶3D框中心 X 坐标 (mm) |
| `CenterPointY` | number | 是 | 病灶3D框中心 Y 坐标 (mm) |
| `CenterPointZ` | number | 是 | 病灶3D框中心 Z 坐标 (mm) |

### 4.5 骨转移病灶 (bone_metastasis_lesions)

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `FindingUID` | string | 是 | 病灶唯一标识 |
| `Probability` | number | 否 | 算法原始置信度 (0~1) |
| `LikelihoodLevel` | integer | 否 | 算法敏感度档位：1低假阳 / 2中档 / 3高灵敏 |
| `BoneType` | integer | 否 | 骨头类型枚举值 (详见附录) |
| `LocationFirst` | integer | 否 | 病灶一级位置枚举值 (详见附录) |
| `LocationSecond` | integer | 否 | 病灶二级位置枚举值 (详见附录) |
| `LesionType` | integer | 否 | 病变类型枚举值 (详见附录) |
| `Complication` | string | 否 | 伴随症状枚举值，多选用逗号分隔 (详见附录) |
| **空间定位字段** | | | **三维物理坐标 (毫米)** |
| `Width` | number | 是 | 病灶3D框 X轴方向长度 (mm) |
| `Height` | number | 是 | 病灶3D框 Y轴方向长度 (mm) |
| `Depth` | number | 是 | 病灶3D框 Z轴方向长度 (mm) |
| `CenterPointX` | number | 是 | 病灶3D框中心 X 坐标 (mm) |
| `CenterPointY` | number | 是 | 病灶3D框中心 Y 坐标 (mm) |
| `CenterPointZ` | number | 是 | 病灶3D框中心 Z 坐标 (mm) |

### 4.6 淋巴结病灶 (lymphnode_lesions)

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `FindingUID` | string | 是 | 病灶唯一标识 |
| `Probability` | number | 否 | 算法原始置信度 (0~1) |
| `Long_axis_mm` | number | 否 | 横断位病灶长轴长度 (mm) |
| `Short_axis_mm` | number | 否 | 横断位病灶短轴长度 (mm) |
| `Volume` | number | 否 | 体积 (mm³) |
| `AvgHU` | number | 否 | 平均 CT 值 (HU) |
| `Slice` | integer | 否 | 病灶长短径交点所在层索引（从0开始） |
| `LesionType` | integer | 否 | **0** 乳腺淋巴结 / **1** 腋下淋巴结 / **2** 纵隔淋巴结 |
| `LocationType` | integer | 否 | 位置类型枚举值 (需参考具体枚举文档) |
| **空间定位字段** | | | **三维物理坐标 (毫米)** |
| `Width` | number | 是 | 病灶3D框 X轴方向长度 (mm) |
| `Height` | number | 是 | 病灶3D框 Y轴方向长度 (mm) |
| `Depth` | number | 是 | 病灶3D框 Z轴方向长度 (mm) |
| `CenterPointX` | number | 是 | 病灶3D框中心 X 坐标 (mm) |
| `CenterPointY` | number | 是 | 病灶3D框中心 Y 坐标 (mm) |
| `CenterPointZ` | number | 是 | 病灶3D框中心 Z 坐标 (mm) |

---

## 5. 附录：骨转移算法枚举映射表

以下为骨转移病灶 (`bone_metastasis_lesions`) 相关字段的枚举值说明。

### 5.1 骨头类型 (`BoneType`)

| 骨头类型 | 算法输出值 |
| :--- | :--- |
| 肋骨 | 1 |
| 椎骨 | 2 |
| 盆骨 | 3 |
| 其他骨 | 99 |

### 5.2 病变类型 (`LesionType`)

| 病变类型 | 算法输出值 |
| :--- | :--- |
| 未定义 | 0 |
| 成骨性 | 11 |
| 溶骨性 | 12 |
| 混合性 | 13 |
| 血管瘤 | 21 |
| 骨肉瘤 | 22 |
| 骨岛 | 31 |
| 许莫氏结节 | 32 |
| 终板炎 | 33 |
| 骨质疏松 | 34 |
| 其他 | 99 |

### 5.3 骨头位置映射表

对应字段：**`LocationFirst`** (一级菜单)、**`LocationSecond`** (二级菜单)。

| 骨头类型 | 一级菜单文字 | `LocationFirst` 输出值 | 二级菜单文字 (无则为`/`) | `LocationSecond` 输出值 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **肋骨** | 肋骨 | 11 | 右1 ~ 左12 | 1 ~ 24 | 0 未定义 |
| **椎骨** | 颈椎 | 21 | C1 ~ C7 | 1 ~ 7 | |
| | 胸椎 | 22 | T1 ~ T12 | 1 ~ 12 | |
| | 腰椎 | 23 | L1 ~ L5 | 1 ~ 5 | |
| **盆骨** | 骶骨 | 31 | / | / | |
| | 尾骨 | 32 | / | / | |
| | 髋骨 | 33 | 右 1 / 左 2 | 1 ~ 2 | 0 未定义 |
| | 髂骨 | 34 | 右 1 / 左 2 | 1 ~ 2 | 0 未定义 |
| | 耻骨 | 35 | 右 1 / 左 2 | 1 ~ 2 | 0 未定义 |
| | 坐骨 | 36 | 右 1 / 左 2 | 1 ~ 2 | 0 未定义 |
| **其他骨** | 胸骨 | 41 | / | / | |
| | 肩胛骨 | 42 | 右 1 / 左 2 | 1 ~ 2 | 0 未定义 |
| | 锁骨 | 43 | 右 1 / 左 2 | 1 ~ 2 | 0 未定义 |
| | 肱骨 | 51 | 右 1 / 左 2 | 1 ~ 2 | 0 未定义 |
| | 股骨 | 52 | 右 1 / 左 2 | 1 ~ 2 | 0 未定义 |
| | 未定义 | 0 | / | / | |
| | 其他部位 | 99 | / | / | |

### 5.4 伴随症状 (`Complication`)

多选用逗号分隔的字符串，例如 `"1,2"`。

| 伴随症状名称 | 算法输出值 |
| :--- | :--- |
| 伴软组织肿块 | 1 |
| 伴病理性骨折 | 2 |
| 伴椎管狭窄 | 3 |
| 椎体伴压缩性骨折 | 4 |
| 无 | 0 |

---

## 6. 接口返回值

### 成功接收

```json
{
  "code": 0,
  "message": "success",
  "task_id": "task_20260422_001"
}
```

### 参数错误

```json
{
  "code": 400,
  "message": "invalid request"
}
```

### 系统异常

```json
{
  "code": 500,
  "message": "internal server error"
}
```

---

## 7. 设计说明（重要）

### 7.1 坐标体系变更说明

- **v1.0 旧版本**：基于像素坐标的 `bbox_3d` 对象。
- **v2.0 新版本**：`CenterPointX/Y/Z` 和 `Width/Height/Depth` 均基于 **DICOM 物理毫米坐标系** (Real-World Coordinates)。
- **2D 显示辅助**：肺结节仍保留 `boundingBox` 像素坐标及 `filePath` 以便前端快速定位和显示关键图像。

### 7.2 数据设计原则

- **结构化优先**：四类病灶独立数组存储，便于业务逻辑分离处理。
- **枚举值为主**：接口推送枚举数字以减少传输体积，但本文档附录提供了完整的文本映射表，供存储或展示时转换。

### 7.3 后续扩展建议

- 可能出现更多病灶类型数组（如 `liver_lesions`），请确保系统支持动态扩展而不报错。
- 淋巴结 `LocationType` 枚举及其他新增病灶的枚举表可能会更新，建议定期同步最新版本。

---

## 8. 注意事项

1. **`task_id` 必须唯一**，需保持幂等性，支持重复回调不产生脏数据。
2. **响应时效**：建议接口处理及响应时间 < 2 秒。
3. **数据完整性**：建议保存完整的原始 JSON 请求体，以备后续排查问题。
4. **坐标系处理**：解析 `CenterPointX/Y/Z` 时需注意 DICOM 坐标系的方向向量（`ImageOrientationPatient`）。
