# web-design 使用说明

基于 Frigate 前端框架改造的跨摄像头多目标跟踪管理平台前端，负责实时监控、智能分析、人员轨迹和标定的 Web 界面。

> 重要：本说明按“Windows 开发 + Ubuntu 虚拟机运行”的实际环境编写。Frigate、标定后端、前端是三个独立部分，请先理解关系再操作。

## 〇、先分清三个东西

| 组件 | 作用 | 默认地址 | 是否必须 |
|---|---|---|---|
| 前端 web-design | 你要开发和交付的界面 | http://localhost:5173 | 必须 |
| Frigate | 实时监控后端，负责取摄像头画面并转流 | http://localhost:5000 | 实时监控需要 |
| 标定后端 | 负责抓标定帧、算内参/外参 | http://localhost:5000（与 Frigate 共用代理） | 标定页面需要 |

- **前端页面**（5173）负责展示和操作。
- **Frigate**（5000）不负责标定，只提供实时画面。
- **标定后端**才是标定真正干活的地方。前端标定页调用 /api/calibration/* 和 /api/wildtrack/*，这些必须有标定后端响应，否则界面会提示“摄像头列表加载失败”。

## 一、开发与运行环境

项目代码放在 Windows 的 G:summer projectweb-design。Ubuntu 虚拟机通过共享文件夹访问同一份代码，路径是 /media/sf_summer_project/web-design。

推荐做法：
- 改代码：在 Windows 上编辑 G:summer projectweb-design，改动自动同步到虚拟机。
- 跑网页：在虚拟机里执行 npm run dev，访问 http://localhost:5173。

⚠️ 不要在两套系统共用同一个 node_modules：Windows 装的依赖是 win32 版，Linux 需要 linux 版，跨平台会报错（例如 Cannot find module '@rollup/rollup-linux-x64-gnu'）。

## 二、环境要求

- 主机 Windows：Node.js 18+、npm
- 虚拟机 Ubuntu：Node.js 18+、npm、Docker（Frigate 用）

## 三、启动前端

在虚拟机终端：

```bash
cd /media/sf_summer_project/web-design
npm install        # 首次，装 Linux 版依赖
npm run dev        # 启动开发服务器
```

浏览器打开：http://localhost:5173

> 如果之前用 Windows 装过依赖，先在虚拟机里删除 node_modules 再重装，否则报平台错误。
> 端口占用时用 npm run dev -- --port 5174。

### 生产构建

```bash
npm run build      # 产物在 dist/
```

## 四、启动 Frigate（实时监控）

Frigate 用 Docker 在虚拟机里跑。

```bash
cd ~/frigate
docker compose up -d
docker compose logs -f
```

浏览器打开 http://localhost:5000，能看到摄像头画面即成功。

三个摄像头配置文件 ~/frigate/config/config.yml：

```yaml
mqtt:
  enabled: false

go2rtc:
  streams:
    camera_1:
      - rtsp://admin:shu%402026@192.168.0.64:554/Streaming/Channels/101
    camera_2:
      - rtsp://admin:shu%402026@192.168.0.66:554/Streaming/Channels/101
    camera_3:
      - rtsp://admin:shu%402026@192.168.0.65:554/Streaming/Channels/101

cameras:
  camera_1:
    ffmpeg:
      inputs:
        - path: rtsp://admin:shu%402026@192.168.0.64:554/Streaming/Channels/101
          roles: [detect]
    detect: { enabled: true }
    ui: { order: 1 }
  camera_2:
    ffmpeg:
      inputs:
        - path: rtsp://admin:shu%402026@192.168.0.66:554/Streaming/Channels/101
          roles: [detect]
    detect: { enabled: true }
    ui: { order: 2 }
  camera_3:
    ffmpeg:
      inputs:
        - path: rtsp://admin:shu%402026@192.168.0.65:554/Streaming/Channels/101
          roles: [detect]
    detect: { enabled: true }
    ui: { order: 3 }
```

> 摄像头 3 的 IP 以实际为准（此处按 192.168.0.65 示例）。改完配置后重启 Frigate。

## 五、页面导航

侧边栏四个主要功能：

| 菜单 | 路由 | 说明 |
|------|------|------|
| 📹 实时监控 | / | 多路摄像头实时画面（依赖 Frigate） |
| 🔍 智能分析 | /videopipe | VideoPipe 检测框 / 人员 ID / 世界坐标（依赖 VideoPipe 后端） |
| 🛤️ 人员轨迹 | /trajectories | 人员跨摄像头轨迹（依赖轨迹数据库后端） |
| 📐 内部标定 | /calibration | 单/双/三摄像头联合标定（依赖标定后端） |
| 🌍 场地坐标标定 | /calibration/world | CSV 世界点导入 / 像素标注 / 外参（依赖标定后端） |

> /calibration 和 /calibration/world 仅管理员可访问。

## 六、功能详解

### 1. 实时监控（/）

- 摄像头实时画面网格，每路独立显示。
- 画面来自 Frigate，浏览器能播放是因为 Frigate 把 RTSP 转成了可播放流。浏览器不能直接播 RTSP。
- Frigate 没启动时页面空白，不是前端坏了。

### 2. 智能分析（/videopipe）

VideoPipe 视频管道监控页：

- HLS 视频流、检测框、track_id、人员 ID（P-XXXX）、置信度、世界坐标。
- 状态指标：运行状态 / 推理帧率 / 管道数 / 目标数 / 运行时长。
- 接口：GET /api/videopipe/overview。未连接时显示演示数据，顶部有“接口待连接”标识。

### 3. 人员轨迹（/trajectories）

- 筛选：时间范围 / 人员 / 摄像头。
- 轨迹列表、场地坐标图、跨摄像头分段、轨迹明细。
- 接口：GET /api/person-trajectories。未连接时显示演示数据。

### 4. 内部标定（/calibration）

- 单摄、双摄、三摄联合标定。
- 标定板参数：squaresX、squaresY、squareLength、markerLength、dictionary。
- 采集图片 → 计算 → 结果展示（内参矩阵 / 畸变系数 / 外参 / 平移向量）。
- 接口：POST /api/calibration/run、POST /api/calibration/stereo/run、POST /api/calibration/:camera/save 等。

> 该页面必须启动标定后端。若后端未启动且浏览器本地无摄像头清单，会显示“摄像头列表加载失败，请确认后端服务已启动”。这个本地清单存在浏览器的 localStorage 里，换浏览器或换虚拟机后会变空，此时需要先启动后端或用“添加”按钮录入摄像头。

### 5. 场地坐标标定（/calibration/world）

- CSV 世界点导入（point_id,x,y,z），导入现场图/抓取高清帧，点击像素点标注，计算外参并保存。
- 接口：PUT wildtrack/world-points、POST wildtrack/calibrate、POST wildtrack/:cameraId/save。

## 七、演示数据说明

所有页面在接口未连接时：
- 显示带“演示/待连接”标识的 Mock 数据，明确标注“接口待连接”。
- 接口接通后自动切换为真实数据。

## 八、后端接口汇总

| 接口 | 用途 |
|------|------|
| GET /api/videopipe/overview | VideoPipe 检测总览 |
| GET /api/person-trajectories | 人员轨迹查询 |
| POST /api/calibration/run | 单摄像头标定 |
| POST /api/calibration/stereo/run | 双/多摄像头标定 |
| POST /api/calibration/:camera/save | 保存标定结果 |
| PUT wildtrack/world-points | 保存世界坐标点 |
| POST wildtrack/calibrate | 计算场地外参 |
| POST wildtrack/:cameraId/save | 保存外参 |

## 九、常见问题

**1. npm run dev 报端口占用**
```bash
npm run dev -- --port 5174
```

**2. 报找不到 rollup-linux-x64-gnu**
node_modules 是 Windows 版。在虚拟机里执行：
```bash
cd /media/sf_summer_project/web-design
rm -rf node_modules
npm install
```

**3. 共享文件夹里 rm -rf node_modules 报“协议错误”**
VirtualBox 共享文件系统限制导致。改用：
```bash
find node_modules -type f -delete
find node_modules -depth -type d -empty -delete
```
或者把项目复制到虚拟机本地再安装（不影响 Windows 源码）。

**4. 实时监控没画面**
先确认 http://localhost:5000（Frigate）能看到摄像头。Frigate 自己看不到，前端必然是空的。

**5. 标定页面报“摄像头列表加载失败”**
标定后端未启动，或浏览器本地清单为空。先启动标定后端；若后端暂缺，用“添加”按钮录入摄像头（本地演示）。

**6. 标定页面无法访问**
标定页仅管理员可见，需以 admin 角色登录。
