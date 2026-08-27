export type BoundingBox = [number, number, number, number];

export type TrajectoryPoint = {
  timestamp: string;
  camera_id: string;
  world_x: number;
  world_y: number;
  confidence: number;
  frame_x?: number;
  frame_y?: number;
  bbox?: BoundingBox;
};

export type PersonTrajectory = {
  id: string;
  global_person_id: string;
  started_at: string;
  ended_at: string;
  cameras: string[];
  point_count: number;
  average_confidence: number;
  points: TrajectoryPoint[];
};

export type TrajectoryApiResponse = {
  items: PersonTrajectory[];
  total: number;
  field_width_m?: number;
  field_height_m?: number;
};
