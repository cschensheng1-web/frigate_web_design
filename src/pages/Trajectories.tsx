import ActivityIndicator from "@/components/indicators/activity-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  PersonTrajectory,
  TrajectoryApiResponse,
  TrajectoryPoint,
} from "@/types/trajectory";
import { useEffect, useMemo, useState } from "react";
import {
  LuCamera,
  LuClock3,
  LuDatabase,
  LuLocateFixed,
  LuRefreshCw,
  LuRoute,
  LuTriangleAlert,
  LuUsers,
} from "react-icons/lu";
import useSWR from "swr";

const cameraColors: Record<string, string> = {
  camera_1: "#2563eb",
  camera_2: "#16a34a",
  camera_3: "#ea580c",
};

const now = new Date();
const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const demoTrajectories: PersonTrajectory[] = [
  {
    id: "demo-track-001",
    global_person_id: "P-0017",
    started_at: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
    ended_at: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    cameras: ["camera_1", "camera_2"],
    point_count: 8,
    average_confidence: 0.93,
    points: [
      [2.1, 9.8, "camera_1"],
      [3.4, 9.2, "camera_1"],
      [5.1, 8.4, "camera_1"],
      [7.2, 7.5, "camera_1"],
      [9.1, 6.7, "camera_2"],
      [11.3, 5.8, "camera_2"],
      [13.7, 4.6, "camera_2"],
      [16.2, 3.1, "camera_2"],
    ].map(([world_x, world_y, camera_id], index) => ({
      timestamp: new Date(
        now.getTime() - (8 - index * 0.8) * 60 * 1000,
      ).toISOString(),
      camera_id: String(camera_id),
      world_x: Number(world_x),
      world_y: Number(world_y),
      confidence: 0.88 + index * 0.012,
      bbox: [420 + index * 12, 180, 82, 226],
    })),
  },
  {
    id: "demo-track-002",
    global_person_id: "P-0021",
    started_at: new Date(now.getTime() - 18 * 60 * 1000).toISOString(),
    ended_at: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
    cameras: ["camera_2", "camera_3"],
    point_count: 6,
    average_confidence: 0.89,
    points: [
      [17.8, 10.2, "camera_2"],
      [15.6, 9.2, "camera_2"],
      [13.2, 8.5, "camera_2"],
      [11.1, 8.1, "camera_3"],
      [8.7, 7.7, "camera_3"],
      [6.2, 7.1, "camera_3"],
    ].map(([world_x, world_y, camera_id], index) => ({
      timestamp: new Date(
        now.getTime() - (18 - index * 1.2) * 60 * 1000,
      ).toISOString(),
      camera_id: String(camera_id),
      world_x: Number(world_x),
      world_y: Number(world_y),
      confidence: 0.85 + index * 0.016,
    })),
  },
];

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function durationLabel(start: string, end: string) {
  const seconds = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000),
  );
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes} 分 ${seconds % 60} 秒` : `${seconds} 秒`;
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof LuUsers;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-r border-border px-4 last:border-r-0">
      <Icon className="size-4 shrink-0 text-selected" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function TrajectoryMap({
  trajectory,
  width,
  height,
}: {
  trajectory: PersonTrajectory | null;
  width: number;
  height: number;
}) {
  const scaleX = (x: number) => 44 + (x / width) * 812;
  const scaleY = (y: number) => 456 - (y / height) * 400;

  const segments = useMemo(() => {
    if (!trajectory) return [];
    return trajectory.points.reduce<TrajectoryPoint[][]>((groups, point) => {
      const current = groups[groups.length - 1];
      if (!current || current[current.length - 1].camera_id !== point.camera_id) {
        groups.push([point]);
      } else {
        current.push(point);
      }
      return groups;
    }, []);
  }, [trajectory]);

  return (
    <div className="aspect-[16/9] min-h-72 w-full overflow-hidden border border-border bg-background_alt">
      <svg
        viewBox="0 0 900 500"
        className="size-full"
        role="img"
        aria-label="人员世界坐标轨迹图"
      >
        <defs>
          <pattern id="trajectory-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeOpacity="0.1" />
          </pattern>
        </defs>
        <rect width="900" height="500" className="fill-background text-foreground" />
        <rect x="44" y="56" width="812" height="400" fill="url(#trajectory-grid)" className="text-foreground" />
        <rect x="44" y="56" width="812" height="400" fill="none" stroke="currentColor" strokeOpacity="0.3" />
        <text x="44" y="36" className="fill-muted-foreground text-[14px]">
          场地坐标（米）
        </text>
        <text x="856" y="478" textAnchor="end" className="fill-muted-foreground text-[12px]">
          X {width}m
        </text>
        <text x="12" y="68" className="fill-muted-foreground text-[12px]">
          Y {height}m
        </text>

        {segments.map((segment, index) => {
          const color = cameraColors[segment[0].camera_id] ?? "#64748b";
          const points = segment
            .map((point) => `${scaleX(point.world_x)},${scaleY(point.world_y)}`)
            .join(" ");
          return (
            <polyline
              key={`${segment[0].camera_id}-${index}`}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {trajectory?.points.map((point, index) => (
          <g key={`${point.timestamp}-${index}`}>
            <circle
              cx={scaleX(point.world_x)}
              cy={scaleY(point.world_y)}
              r={index === trajectory.points.length - 1 ? 8 : 5}
              fill={cameraColors[point.camera_id] ?? "#64748b"}
              stroke="white"
              strokeWidth="2"
            />
            {index === 0 && (
              <text
                x={scaleX(point.world_x) + 10}
                y={scaleY(point.world_y) - 10}
                className="fill-foreground text-[12px] font-medium"
              >
                起点
              </text>
            )}
          </g>
        ))}

        {!trajectory && (
          <text x="450" y="255" textAnchor="middle" className="fill-muted-foreground text-[16px]">
            选择一条人员轨迹查看场地路径
          </text>
        )}
      </svg>
    </div>
  );
}

export default function Trajectories() {
  const [from, setFrom] = useState(toLocalInput(thirtyMinutesAgo));
  const [to, setTo] = useState(toLocalInput(now));
  const [personId, setPersonId] = useState("");
  const [cameraId, setCameraId] = useState("all");
  const [selectedId, setSelectedId] = useState("");

  const query = useMemo(
    () => ({
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      ...(personId.trim() ? { person_id: personId.trim() } : {}),
      ...(cameraId !== "all" ? { camera_id: cameraId } : {}),
    }),
    [from, to, personId, cameraId],
  );

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    TrajectoryApiResponse | PersonTrajectory[]
  >(["person-trajectories", query], {
    refreshInterval: 5000,
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });

  const apiItems = Array.isArray(data) ? data : data?.items;
  const usingDemo = Boolean(error && !apiItems);
  const trajectories = useMemo(
    () => (usingDemo ? demoTrajectories : (apiItems ?? [])),
    [apiItems, usingDemo],
  );
  const selected =
    trajectories.find((trajectory) => trajectory.id === selectedId) ??
    trajectories[0] ??
    null;

  useEffect(() => {
    document.title = "人员轨迹";
  }, []);

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const fieldWidth = Array.isArray(data) ? 20 : (data?.field_width_m ?? 20);
  const fieldHeight = Array.isArray(data) ? 12 : (data?.field_height_m ?? 12);

  return (
    <div className="scrollbar-container size-full overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-3 md:p-5">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xl font-semibold">
              <LuRoute className="size-5 text-selected" />
              人员轨迹
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              查看跨摄像头人员身份、场地坐标和时间顺序
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "rounded-full border px-3 py-1",
                usingDemo
                  ? "border-warning/40 bg-warning/10 text-warning-foreground"
                  : "border-success/40 bg-success/10 text-success-foreground",
              )}
            >
              {usingDemo ? "接口未连接 · 演示数据" : "数据库已连接"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              disabled={isValidating}
            >
              <LuRefreshCw className={cn("mr-2 size-4", isValidating && "animate-spin")} />
              刷新
            </Button>
          </div>
        </header>

        <section className="grid gap-3 border-y border-border bg-background_alt py-3 md:grid-cols-[1fr_1fr_0.8fr_0.8fr_auto] md:items-end md:px-3">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">开始时间</Label>
            <Input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">结束时间</Label>
            <Input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">人员编号</Label>
            <Input value={personId} onChange={(event) => setPersonId(event.target.value)} placeholder="例如 P-0017" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">摄像头</Label>
            <Select value={cameraId} onValueChange={setCameraId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部摄像头</SelectItem>
                <SelectItem value="camera_1">摄像头 1</SelectItem>
                <SelectItem value="camera_2">摄像头 2</SelectItem>
                <SelectItem value="camera_3">摄像头 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="select" onClick={() => mutate()} disabled={isValidating}>
            查询
          </Button>
        </section>

        {isLoading && !usingDemo ? (
          <div className="grid min-h-72 place-items-center"><ActivityIndicator className="w-10" /></div>
        ) : (
          <>
            <section className="grid min-h-[70px] grid-cols-2 border border-border bg-card md:grid-cols-4">
              <Metric icon={LuUsers} label="轨迹数量" value={`${trajectories.length}`} />
              <Metric icon={LuCamera} label="覆盖摄像头" value={`${new Set(trajectories.flatMap((item) => item.cameras)).size}`} />
              <Metric icon={LuClock3} label="当前轨迹时长" value={selected ? durationLabel(selected.started_at, selected.ended_at) : "--"} />
              <Metric icon={LuLocateFixed} label="平均置信度" value={selected ? `${(selected.average_confidence * 100).toFixed(1)}%` : "--"} />
            </section>

            <main className="grid min-w-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
              <section className="min-w-0 border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <div className="font-medium">轨迹记录</div>
                  <div className="text-xs text-muted-foreground">按开始时间倒序</div>
                </div>
                <div className="max-h-[610px] overflow-y-auto">
                  {trajectories.length === 0 ? (
                    <div className="grid min-h-48 place-items-center px-5 text-center text-sm text-muted-foreground">
                      当前条件下没有人员轨迹
                    </div>
                  ) : (
                    trajectories.map((trajectory) => (
                      <button
                        key={trajectory.id}
                        type="button"
                        className={cn(
                          "w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent/60",
                          selected?.id === trajectory.id && "bg-selected/10",
                        )}
                        onClick={() => setSelectedId(trajectory.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{trajectory.global_person_id}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {(trajectory.average_confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatTime(trajectory.started_at)} · {trajectory.point_count} 个点
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {trajectory.cameras.map((camera) => (
                            <span key={camera} className="rounded border border-border px-1.5 py-0.5 text-[11px]">
                              {camera.replace("camera_", "摄像头 ")}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>

              <section className="min-w-0 border border-border bg-card">
                <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium">场地轨迹</div>
                    <div className="text-xs text-muted-foreground">
                      {selected ? `${selected.global_person_id} · ${formatTime(selected.started_at)} 至 ${formatTime(selected.ended_at)}` : "未选择轨迹"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {["camera_1", "camera_2", "camera_3"].map((camera) => (
                      <span key={camera} className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: cameraColors[camera] }} />
                        {camera.replace("camera_", "摄像头 ")}
                      </span>
                    ))}
                  </div>
                </div>
                <TrajectoryMap trajectory={selected} width={fieldWidth} height={fieldHeight} />

                <div className="border-t border-border">
                  <div className="grid grid-cols-[100px_110px_1fr_90px] border-b border-border bg-background_alt px-3 py-2 text-xs font-medium text-muted-foreground md:grid-cols-[130px_120px_1fr_100px]">
                    <span>时间</span><span>摄像头</span><span>世界坐标</span><span className="text-right">置信度</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {selected?.points.map((point, index) => (
                      <div key={`${point.timestamp}-${index}`} className="grid grid-cols-[100px_110px_1fr_90px] border-b border-border px-3 py-2 text-xs last:border-b-0 md:grid-cols-[130px_120px_1fr_100px]">
                        <span className="tabular-nums">{formatTime(point.timestamp).slice(6)}</span>
                        <span>{point.camera_id.replace("camera_", "摄像头 ")}</span>
                        <span className="tabular-nums">({point.world_x.toFixed(2)}, {point.world_y.toFixed(2)}) m</span>
                        <span className="text-right tabular-nums">{(point.confidence * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </main>
          </>
        )}

        {usingDemo && (
          <div className="flex items-start gap-2 border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            <LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              当前未连接 <code>/api/person-trajectories</code>，页面展示的是带标识的演示数据；接口接通后会自动切换到数据库结果。
            </span>
          </div>
        )}
        {!usingDemo && !error && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LuDatabase className="size-4" />
            数据每 5 秒自动刷新
          </div>
        )}
      </div>
    </div>
  );
}
