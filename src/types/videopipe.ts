export type VideoPipeStatus = {
  online: boolean;
  version?: string;
  uptime_seconds?: number;
  pipeline_count: number;
  inference_fps?: number;
  message?: string;
};

export type VideoPipeCamera = {
  id: string;
  name: string;
  source_status: "online" | "offline" | "connecting";
  codec?: string;
  resolution?: string;
  processed_stream_url?: string;
};

export type VideoPipeDetection = {
  id: string;
  global_person_id?: string;
  track_id: string;
  camera_id: string;
  timestamp: string;
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
  world_x?: number;
  world_y?: number;
};

export type VideoPipeOverview = {
  status: VideoPipeStatus;
  cameras: VideoPipeCamera[];
  detections: VideoPipeDetection[];
};
