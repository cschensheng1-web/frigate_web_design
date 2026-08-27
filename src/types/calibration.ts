/** 摄像头连接状态 */
export type CameraStatus = "planning" | "pending" | "offline" | "online";

/** 标定模式 */
export type CalibrationMode = "single" | "stereo" | "multi";

/** ChArUco 标定板参数 */
export type BoardParams = {
  squaresX: string;
  squaresY: string;
  squareLength: string;
  markerLength: string;
  dictionary: string;
};

/** API 返回的摄像头信息 */
export type CameraInfo = {
  id: string;
  name: string;
  ip: string;
  codec: string;
  status: CameraStatus;
  resolution: string;
};

/** 单次采集结果 */
export type CaptureItem = {
  id: number;
  corners: number;
  error: number;
  thumbnail_url?: string;
  camera_id?: string;
  group_id?: string;
  image_id?: string;
  image_data?: string;
  capture_time?: string;
};

/** 标定结果矩阵 */
export type CalibrationMatrix = number[][];

/** 单摄像头标定结果 */
export type SingleCalibrationResult = {
  cameraMatrix: CalibrationMatrix;
  distCoeffs: CalibrationMatrix;
  groundH: CalibrationMatrix;
  reprojectionError: number;
  imageCount: number;
};

/** 双摄像头联合标定结果 */
export type StereoCalibrationResult = {
  camera1Extrinsic: CalibrationMatrix;
  camera2Extrinsic: CalibrationMatrix;
  camera1ToCamera2: CalibrationMatrix;
  reprojectionError: number;
  syncCount: number;
};

export type MultiCameraPairResult = {
  camera1Id: string;
  camera2Id: string;
  ok: boolean;
  pairCount: number;
  reprojectionError?: number;
  camera1ToCamera2?: CalibrationMatrix;
  message?: string;
};

export type MultiCalibrationResult = {
  pairResults: MultiCameraPairResult[];
  reprojectionError: number;
  syncCount: number;
};

/** 标定结果联合类型 */
export type CalibrationResultData =
  | SingleCalibrationResult
  | StereoCalibrationResult
  | MultiCalibrationResult;
