import ActivityIndicator from "@/components/indicators/activity-indicator";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { VideoPipeDetection, VideoPipeOverview } from "@/types/videopipe";
import Hls from "hls.js";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuActivity,
  LuCamera,
  LuCircleDot,
  LuClock3,
  LuCpu,
  LuRefreshCw,
  LuScanLine,
  LuTriangleAlert,
  LuUsers,
} from "react-icons/lu";
import useSWR from "swr";

const demoOverview: VideoPipeOverview = {
  status: {
    online: false,
    version: "等待联调",
    uptime_seconds: 0,
    pipeline_count: 3,
    inference_fps: 0,
    message: "VideoPipe 接口尚未连接",
  },
  cameras: [
    { id: "camera_1", name: "摄像头 1", source_status: "connecting", codec: "H.265", resolution: "1920 x 1080" },
    { id: "camera_2", name: "摄像头 2", source_status: "connecting", codec: "H.264", resolution: "1280 x 720" },
    { id: "camera_3", name: "摄像头 3", source_status: "connecting", codec: "H.264", resolution: "1280 x 720" },
  ],
  detections: [
    {
      id: "demo-detection-1",
      global_person_id: "P-0017",
      track_id: "T-1042",
      camera_id: "camera_1",
      timestamp: new Date().toISOString(),
      label: "person",
      confidence: 0.94,
      bbox: [760, 210, 220, 650],
      world_x: 7.21,
      world_y: 5.42,
    },
  ],
};

function formatUptime(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} 小时 ${minutes} 分钟`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function parseResolution(value?: string) {
  const match = value?.match(/(\d+)\s*[xX×]\s*(\d+)/);
  return match ? [Number(match[1]), Number(match[2])] : [1920, 1080];
}

function HlsStream({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      return;
    }
    if (!Hls.isSupported()) return;
    const hls = new Hls({
      lowLatencyMode: true,
      backBufferLength: 10,
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [url]);

  return (
    <video
      ref={videoRef}
      className="size-full object-contain"
      autoPlay
      muted
      playsInline
      controls
    />
  );
}

function DetectionOverlay({
  detection,
  resolution,
}: {
  detection: VideoPipeDetection;
  resolution?: string;
}) {
  const [width, height] = parseResolution(resolution);
  const [x, y, boxWidth, boxHeight] = detection.bbox;
  return (
    <div
      className="pointer-events-none absolute border-2 border-emerald-400"
      style={{
        left: `${(x / width) * 100}%`,
        top: `${(y / height) * 100}%`,
        width: `${(boxWidth / width) * 100}%`,
        height: `${(boxHeight / height) * 100}%`,
      }}
    >
      <span className="absolute -top-6 left-[-2px] whitespace-nowrap bg-emerald-500 px-1.5 py-0.5 text-[11px] font-medium text-white">
        {detection.global_person_id ?? detection.track_id} · {(detection.confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function StatusMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof LuActivity;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3">
      <Icon className="size-4 shrink-0 text-selected" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium tabular-nums">{value}</div>
      </div>
    </div>
  );
}

export default function VideoPipe() {
  const [cameraId, setCameraId] = useState("camera_1");
  const { data, error, isLoading, isValidating, mutate } = useSWR<VideoPipeOverview>(
    "videopipe/overview",
    {
      refreshInterval: 2000,
      shouldRetryOnError: false,
      revalidateOnFocus: false,
    },
  );
  const usingDemo = Boolean(error && !data);
  const overview = data ?? demoOverview;
  const camera =
    overview.cameras.find((item) => item.id === cameraId) ??
    overview.cameras[0] ??
    null;
  const detections = useMemo(
    () => overview.detections.filter((item) => item.camera_id === camera?.id),
    [overview.detections, camera?.id],
  );

  useEffect(() => {
    document.title = "VideoPipe 智能分析";
  }, []);

  useEffect(() => {
    if (camera && camera.id !== cameraId) setCameraId(camera.id);
  }, [camera, cameraId]);

  if (isLoading && !usingDemo) {
    return <div className="grid size-full place-items-center bg-background"><ActivityIndicator className="w-10" /></div>;
  }

  return (
    <div className="scrollbar-container size-full overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-3 md:p-5">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xl font-semibold">
              <LuScanLine className="size-5 text-selected" />
              VideoPipe 智能分析
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              查看处理后视频、跟踪编号、检测框和世界坐标
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                overview.status.online && !usingDemo
                  ? "border-success/40 bg-success/10 text-success-foreground"
                  : "border-warning/40 bg-warning/10 text-warning-foreground",
              )}
            >
              {overview.status.online && !usingDemo ? "服务在线" : "接口待连接"}
            </span>
            <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
              <LuRefreshCw className={cn("mr-2 size-4", isValidating && "animate-spin")} />
              刷新
            </Button>
          </div>
        </header>

        <section className="grid border border-border bg-card sm:grid-cols-2 xl:grid-cols-5">
          <StatusMetric icon={LuActivity} label="运行状态" value={overview.status.online && !usingDemo ? "正常" : "等待联调"} />
          <StatusMetric icon={LuCpu} label="推理帧率" value={`${overview.status.inference_fps ?? 0} FPS`} />
          <StatusMetric icon={LuCamera} label="视频管道" value={`${overview.status.pipeline_count} 路`} />
          <StatusMetric icon={LuUsers} label="当前目标" value={`${overview.detections.length} 人`} />
          <StatusMetric icon={LuClock3} label="运行时长" value={formatUptime(overview.status.uptime_seconds)} />
        </section>

        <main className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">处理后视频</div>
                <div className="text-xs text-muted-foreground">
                  检测框由 VideoPipe 输出，视频地址由同源接口返回
                </div>
              </div>
              <Select value={camera?.id ?? ""} onValueChange={setCameraId}>
                <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {overview.cameras.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative aspect-video min-h-72 overflow-hidden bg-black">
              {camera?.processed_stream_url ? (
                <HlsStream url={camera.processed_stream_url} />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-neutral-950 text-neutral-400">
                  <div className="text-center">
                    <LuScanLine className="mx-auto mb-3 size-12" />
                    <div className="text-sm">等待 VideoPipe 返回浏览器可播放的视频流</div>
                    <div className="mt-1 text-xs text-neutral-500">processed_stream_url（HLS）</div>
                  </div>
                </div>
              )}
              {detections.map((detection) => (
                <DetectionOverlay key={detection.id} detection={detection} resolution={camera?.resolution} />
              ))}
              <div className="absolute left-3 top-3 flex items-center gap-2 bg-black/70 px-2 py-1 text-xs text-white">
                <LuCircleDot className={cn("size-3", camera?.source_status === "online" ? "text-emerald-400" : "text-amber-400")} />
                {camera?.name ?? "未选择摄像头"} · {camera?.resolution ?? "--"}
              </div>
            </div>
          </section>

          <aside className="min-w-0 border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <div className="font-medium">实时检测</div>
              <div className="text-xs text-muted-foreground">每 2 秒同步一次接口数据</div>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {detections.length === 0 ? (
                <div className="grid min-h-48 place-items-center px-6 text-center text-sm text-muted-foreground">
                  当前画面没有检测到人员
                </div>
              ) : (
                detections.map((detection) => (
                  <div key={detection.id} className="border-b border-border px-4 py-3 last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{detection.global_person_id ?? "等待 ReID"}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{(detection.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <span>Track: {detection.track_id}</span>
                      <span className="text-right">{formatTimestamp(detection.timestamp)}</span>
                      <span>{detection.camera_id.replace("camera_", "摄像头 ")}</span>
                      <span className="text-right tabular-nums">
                        {detection.world_x === undefined ? "坐标待标定" : `(${detection.world_x.toFixed(2)}, ${detection.world_y?.toFixed(2)}) m`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </main>

        {usingDemo && (
          <div className="flex items-start gap-2 border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            <LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              当前未连接 <code>/api/videopipe/overview</code>。检测框仅用于检查前端布局，接通接口后会自动替换为真实 VideoPipe 数据。
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
