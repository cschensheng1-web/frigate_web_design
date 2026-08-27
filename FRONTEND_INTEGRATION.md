# Web 前端联调说明

当前交付以 `web-design` 为主，保留 Frigate 实时监控能力，新增 VideoPipe 智能分析、人员轨迹和内部标定页面。

## 页面与权限

| 路径 | 页面 | 权限 |
|---|---|---|
| `/` | Frigate 实时监控 | 普通用户 |
| `/videopipe` | VideoPipe 处理后视频和检测结果 | 普通用户 |
| `/trajectories` | 跨摄像头人员轨迹 | 普通用户 |
| `/calibration` | 单目、双目、三摄像头标定 | 管理员 |
| `/calibration/world` | 世界坐标点标注和外参标定 | 管理员 |

未在主导航显示的 Frigate 原页面仍保留在代码中，便于后续恢复和升级。

## VideoPipe 接口

### `GET /api/videopipe/overview`

页面每 2 秒读取一次。

```json
{
  "status": {
    "online": true,
    "version": "1.0.0",
    "uptime_seconds": 3600,
    "pipeline_count": 3,
    "inference_fps": 24.8
  },
  "cameras": [
    {
      "id": "camera_1",
      "name": "摄像头 1",
      "source_status": "online",
      "codec": "H.265",
      "resolution": "1920 x 1080",
      "processed_stream_url": "/streams/camera_1/index.m3u8"
    }
  ],
  "detections": [
    {
      "id": "det-1",
      "global_person_id": "P-0017",
      "track_id": "T-1042",
      "camera_id": "camera_1",
      "timestamp": "2026-08-18T10:20:30.000Z",
      "label": "person",
      "confidence": 0.94,
      "bbox": [760, 210, 220, 650],
      "world_x": 7.21,
      "world_y": 5.42
    }
  ]
}
```

`bbox` 使用原始画面的 `[x, y, width, height]` 像素坐标。`processed_stream_url` 应为浏览器可播放的 HLS 地址，不要把带账号密码的 RTSP 地址返回给浏览器。

## 人员轨迹接口

### `GET /api/person-trajectories`

查询参数：`from`、`to`、可选 `person_id`、可选 `camera_id`。

```json
{
  "total": 1,
  "field_width_m": 20,
  "field_height_m": 12,
  "items": [
    {
      "id": "trajectory-1",
      "global_person_id": "P-0017",
      "started_at": "2026-08-18T10:20:30.000Z",
      "ended_at": "2026-08-18T10:24:10.000Z",
      "cameras": ["camera_1", "camera_2"],
      "point_count": 2,
      "average_confidence": 0.93,
      "points": [
        {
          "timestamp": "2026-08-18T10:20:30.000Z",
          "camera_id": "camera_1",
          "world_x": 7.21,
          "world_y": 5.42,
          "confidence": 0.94,
          "frame_x": 870,
          "frame_y": 535,
          "bbox": [760, 210, 220, 650]
        }
      ]
    }
  ]
}
```

页面每 5 秒读取一次。接口不可用时会明确显示“接口未连接 · 演示数据”。

## 标定接口

基础接口沿用 Qt 标定工具：

- `GET/PUT /api/cameras`
- `POST /api/calibration/capture`
- `POST /api/calibration/stereo/capture`
- `POST /api/calibration/multi/capture`
- `POST /api/calibration/run`
- `POST /api/calibration/stereo/run`
- `POST /api/calibration/:camera/save`
- `POST /api/calibration/multi/save`

三摄标定前端会依次计算 `camera_1-camera_2`、`camera_2-camera_3`、`camera_1-camera_3` 三组双目结果。

世界坐标标定接口沿用 Qt WildTrack 页面：

- `POST /api/wildtrack/capture`
- `GET/PUT /api/wildtrack/world-points`
- `GET/PUT /api/wildtrack/annotations/:camera`
- `POST /api/wildtrack/calibrate`
- `POST /api/wildtrack/:camera/save`

浏览器不能直接播放 RTSP，也不应接触摄像头密码。抓图和转流必须由 Frigate、go2rtc 或标定后端在服务器端完成。
