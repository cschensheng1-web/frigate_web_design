export type WorldPoint = {
  id: string;
  x: number;
  y: number;
  z: number;
};

export type PixelAnnotation = {
  world_point_id: string;
  pixel_x: number;
  pixel_y: number;
};

export type WorldCalibrationResult = {
  camera_id: string;
  ok: boolean;
  position?: [number, number, number];
  rvec?: number[];
  tvec?: number[];
  T_world_camera?: number[][];
  reproj_error_px?: number;
  point_count?: number;
  message?: string;
};

export type WildtrackCaptureResponse = {
  image_url?: string;
  image_base64?: string;
  width?: number;
  height?: number;
};
