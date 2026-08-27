# Web Design Prototype

This folder is a copy of the Frigate web frontend for the summer project web work.

## Purpose

- Keep the teacher-provided Frigate source unchanged.
- Prototype web-side calibration workflow before cameras and backend APIs are ready.
- Prepare UI and API discussion material for the calibration plan meeting.

## Run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173/calibration
```

If port 5173 is busy:

```bash
npm run dev -- --port 5174
```

## Current Prototype

- New route: `/calibration`
- New page: `src/pages/Calibration.tsx`
- Mock camera list
- ChArUco board parameter controls
- Single-camera and dual-camera calibration modes
- Dual-camera preview layout for joint extrinsic calibration
- Mock capture progress
- Mock calibration result matrices
- Draft API list for later backend integration

## Camera List Management (2026-08-02)

- The `摄像头清单` panel on the calibration page now has working add / edit / delete controls.
- "添加" opens a form for name, IP, codec, resolution, and status; new cameras appear immediately.
- Each camera row has edit and delete buttons; delete asks for confirmation first.
- Changes are saved to `localStorage` under `web-design.calibration.cameras.v1`, so they survive page reloads.
- While local changes exist, a reset button (rotate icon) restores the list from the API.
- Backend not required for the demo: the list is managed locally until the `/api/cameras` endpoints are finalized.

## Confirmed Calibration Board

- Board type: checkerboard / QR-code style marker board
- Board size: 800mm x 800mm
- Border margin: 40mm on each side
- Active grid: 9 x 9 squares
- Square size: 80mm x 80mm
- Marker length: 60mm
- Dictionary: DICT_5X5_100
- If the backend uses normal checkerboard inner corners, confirm whether it expects 8 x 8.
- Frontend default: squaresX = 9, squaresY = 9, squareLength = 0.08m, markerLength = 0.06m

## Current Camera Inputs

- Camera 1: 192.168.0.64, H.265, 1920 x 1080, RTSP path `/Streaming/Channels/101`
- Camera 2: 192.168.0.65, H.264, 1280 x 720, RTSP path `/Streaming/Channels/101`
- Camera 3: 1280 x 720, not included in the current calibration workflow
- Camera credentials should stay in the backend/AI BOX/video service, not in frontend source code.

## Later Backend APIs To Confirm

```text
GET /api/cameras
POST /api/calibration/capture
POST /api/calibration/stereo/capture
POST /api/calibration/run
POST /api/calibration/stereo/run
GET /api/calibration/:camera/result
POST /api/calibration/:camera/save
```
