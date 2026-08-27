import ActivityIndicator from "@/components/indicators/activity-indicator";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CameraInfo } from "@/types/calibration";
import type {
  PixelAnnotation,
  WildtrackCaptureResponse,
  WorldCalibrationResult,
  WorldPoint,
} from "@/types/worldCalibration";
import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  LuCheck,
  LuCrosshair,
  LuFileUp,
  LuImage,
  LuMousePointer2,
  LuRotateCcw,
  LuSave,
  LuTriangleAlert,
  LuUndo2,
} from "react-icons/lu";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import useSWR from "swr";

const samplePoints: WorldPoint[] = Array.from({ length: 12 }, (_, index) => ({
  id: `P${String(index + 1).padStart(2, "0")}`,
  x: index % 4,
  y: Math.floor(index / 4),
  z: 0,
}));

const fallbackCameras: CameraInfo[] = [
  { id: "camera_1", name: "摄像头 1", ip: "192.168.0.64", codec: "H.265", status: "online", resolution: "1920 x 1080" },
  { id: "camera_2", name: "摄像头 2", ip: "192.168.0.65", codec: "H.264", status: "online", resolution: "1280 x 720" },
  { id: "camera_3", name: "摄像头 3", ip: "192.168.0.66", codec: "H.264", status: "online", resolution: "1280 x 720" },
];

function parseCsv(text: string): WorldPoint[] {
  const rows = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length < 2) throw new Error("CSV 中没有坐标数据");
  const header = rows[0].split(",").map((value) => value.trim().toLowerCase());
  const idIndex = header.indexOf("point_id");
  const xIndex = header.indexOf("x");
  const yIndex = header.indexOf("y");
  const zIndex = header.indexOf("z");
  if ([idIndex, xIndex, yIndex, zIndex].some((index) => index < 0)) {
    throw new Error("CSV 表头必须是 point_id,x,y,z");
  }
  return rows.slice(1).map((row, rowIndex) => {
    const columns = row.split(",").map((value) => value.trim());
    const point = {
      id: columns[idIndex],
      x: Number(columns[xIndex]),
      y: Number(columns[yIndex]),
      z: Number(columns[zIndex]),
    };
    if (!point.id || [point.x, point.y, point.z].some(Number.isNaN)) {
      throw new Error(`CSV 第 ${rowIndex + 2} 行格式错误`);
    }
    return point;
  });
}

function loadLocalCameras() {
  try {
    const value = window.localStorage.getItem("web-design.calibration.cameras.v1");
    return value ? (JSON.parse(value) as CameraInfo[]) : null;
  } catch {
    return null;
  }
}

function Matrix({ matrix }: { matrix?: number[][] }) {
  if (!matrix) return null;
  return (
    <div className="overflow-x-auto border border-border bg-background_alt p-2 font-mono text-xs">
      {matrix.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {row.map((value, columnIndex) => (
            <span key={columnIndex} className="w-20 text-right tabular-nums">{value.toFixed(5)}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function WorldCalibration() {
  const { data: apiCameras, error: camerasError } = useSWR<CameraInfo[]>("cameras", {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  const cameras = apiCameras ?? loadLocalCameras() ?? fallbackCameras;
  const [cameraId, setCameraId] = useState(cameras[0]?.id ?? "camera_1");
  const [worldPoints, setWorldPoints] = useState<WorldPoint[]>(samplePoints);
  const [selectedPointId, setSelectedPointId] = useState(samplePoints[0].id);
  const [annotationsByCamera, setAnnotationsByCamera] = useState<Record<string, PixelAnnotation[]>>({});
  const [imagesByCamera, setImagesByCamera] = useState<Record<string, string>>({});
  const [capturing, setCapturing] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [results, setResults] = useState<WorldCalibrationResult[]>([]);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const currentAnnotations = annotationsByCamera[cameraId] ?? [];
  const currentImage = imagesByCamera[cameraId];
  const selectedPoint = worldPoints.find((point) => point.id === selectedPointId);
  const currentResult = results.find((result) => result.camera_id === cameraId);

  useEffect(() => {
    document.title = "场地坐标标定";
  }, []);

  useEffect(() => {
    if (!cameras.some((camera) => camera.id === cameraId) && cameras[0]) {
      setCameraId(cameras[0].id);
    }
  }, [cameras, cameraId]);

  const annotationMap = useMemo(
    () => new Map(currentAnnotations.map((annotation) => [annotation.world_point_id, annotation])),
    [currentAnnotations],
  );

  const importCsv = async (file?: File) => {
    if (!file) return;
    try {
      const points = parseCsv(await file.text());
      setWorldPoints(points);
      setSelectedPointId(points[0]?.id ?? "");
      toast.success(`已导入 ${points.length} 个世界坐标点`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CSV 导入失败");
    }
  };

  const importImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImagesByCamera((current) => ({ ...current, [cameraId]: reader.result as string }));
        toast.success("标定图片已载入");
      }
    };
    reader.readAsDataURL(file);
  };

  const captureFrame = async () => {
    setCapturing(true);
    try {
      const { data } = await axios.post<WildtrackCaptureResponse>("wildtrack/capture", {
        camera_id: cameraId,
      });
      const source = data.image_url ?? (data.image_base64 ? `data:image/jpeg;base64,${data.image_base64}` : "");
      if (!source) throw new Error("接口没有返回图片");
      setImagesByCamera((current) => ({ ...current, [cameraId]: source }));
      toast.success("高清标定帧采集完成");
    } catch (error) {
      toast.error(`采集失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setCapturing(false);
    }
  };

  const annotate = (event: ReactMouseEvent<HTMLImageElement>) => {
    if (!selectedPoint || !imageRef.current) return;
    const image = imageRef.current;
    const rect = image.getBoundingClientRect();
    const pixel_x = ((event.clientX - rect.left) / rect.width) * image.naturalWidth;
    const pixel_y = ((event.clientY - rect.top) / rect.height) * image.naturalHeight;
    const annotation: PixelAnnotation = {
      world_point_id: selectedPoint.id,
      pixel_x: Number(pixel_x.toFixed(2)),
      pixel_y: Number(pixel_y.toFixed(2)),
    };
    setAnnotationsByCamera((current) => ({
      ...current,
      [cameraId]: [
        ...(current[cameraId] ?? []).filter((item) => item.world_point_id !== selectedPoint.id),
        annotation,
      ],
    }));
    const currentIndex = worldPoints.findIndex((point) => point.id === selectedPoint.id);
    const nextPoint = worldPoints[currentIndex + 1];
    if (nextPoint) setSelectedPointId(nextPoint.id);
  };

  const savePoints = async () => {
    try {
      await axios.put("wildtrack/world-points", { points: worldPoints });
      toast.success("世界坐标点已保存");
    } catch (error) {
      toast.error(`保存失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  };

  const saveAnnotations = async () => {
    try {
      await axios.put(`wildtrack/annotations/${cameraId}`, {
        camera_id: cameraId,
        annotations: currentAnnotations,
      });
      toast.success("像素标注已保存");
    } catch (error) {
      toast.error(`保存失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  };

  const calibrate = async () => {
    const cameraIds = Object.entries(annotationsByCamera)
      .filter(([, annotations]) => annotations.length >= 6)
      .map(([id]) => id);
    if (cameraIds.length === 0) {
      toast.error("至少为一台摄像头标注 6 个点");
      return;
    }
    setCalibrating(true);
    try {
      const annotations = Object.fromEntries(
        cameraIds.map((id) => [
          id,
          annotationsByCamera[id].map((annotation) => ({
            world_idx: worldPoints.findIndex((point) => point.id === annotation.world_point_id),
            world: (() => {
              const point = worldPoints.find((item) => item.id === annotation.world_point_id)!;
              return [point.x, point.y, point.z];
            })(),
            pixel: [annotation.pixel_x, annotation.pixel_y],
          })),
        ]),
      );
      const { data } = await axios.post<{ results: WorldCalibrationResult[] } | WorldCalibrationResult[]>(
        "wildtrack/calibrate",
        {
          camera_ids: cameraIds,
          world_points: worldPoints.map((point) => [point.x, point.y, point.z]),
          annotations,
        },
      );
      setResults(Array.isArray(data) ? data : data.results);
      toast.success("场地坐标外参计算完成");
    } catch (error) {
      toast.error(`标定失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setCalibrating(false);
    }
  };

  const saveResult = async () => {
    if (!currentResult) return;
    try {
      await axios.post(`wildtrack/${cameraId}/save`, currentResult);
      toast.success("外参结果已保存");
    } catch (error) {
      toast.error(`保存失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  };

  return (
    <div className="scrollbar-container size-full overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-3 md:p-5">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xl font-semibold">
              <LuCrosshair className="size-5 text-selected" />
              场地坐标标定
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              将摄像头像素坐标统一到现场世界坐标，用于跨摄像头轨迹融合
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild><Link to="/calibration">内参与联合标定</Link></Button>
            <Button variant="select" asChild><Link to="/calibration/world">场地坐标标定</Link></Button>
          </div>
        </header>

        <section className="grid gap-3 border-y border-border bg-background_alt py-3 md:grid-cols-[260px_auto_auto_1fr_auto] md:items-end md:px-3">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">当前摄像头</Label>
            <Select value={cameraId} onValueChange={setCameraId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {cameras.map((camera) => <SelectItem key={camera.id} value={camera.id}>{camera.name} ({camera.ip})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={captureFrame} disabled={capturing}>
            {capturing ? <ActivityIndicator className="mr-2 w-4" size={14} /> : <LuImage className="mr-2 size-4" />}
            抓取高清帧
          </Button>
          <Button variant="outline" onClick={() => imageInputRef.current?.click()}>
            <LuFileUp className="mr-2 size-4" />导入图片
          </Button>
          <div className="hidden md:block" />
          <Button variant="select" onClick={calibrate} disabled={calibrating}>
            {calibrating ? <ActivityIndicator className="mr-2 w-4" size={14} /> : <LuCrosshair className="mr-2 size-4" />}
            计算外参
          </Button>
          <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => importImage(event.target.files?.[0])} />
        </section>

        <main className="grid min-w-0 gap-4 xl:grid-cols-[270px_minmax(0,1fr)_300px]">
          <section className="min-w-0 border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-3 py-3">
              <div>
                <div className="font-medium">世界坐标点</div>
                <div className="text-xs text-muted-foreground">{worldPoints.length} 个测量点</div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" title="导入 CSV" onClick={() => csvInputRef.current?.click()}><LuFileUp className="size-4" /></Button>
                <Button variant="ghost" size="icon" title="保存坐标点" onClick={savePoints}><LuSave className="size-4" /></Button>
              </div>
              <input ref={csvInputRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => importCsv(event.target.files?.[0])} />
            </div>
            <div className="grid grid-cols-[58px_1fr_28px] border-b border-border bg-background_alt px-3 py-2 text-[11px] text-muted-foreground">
              <span>编号</span><span>坐标 (m)</span><span />
            </div>
            <div className="max-h-[590px] overflow-y-auto">
              {worldPoints.map((point) => {
                const marked = annotationMap.has(point.id);
                return (
                  <button
                    key={point.id}
                    type="button"
                    className={cn(
                      "grid w-full grid-cols-[58px_1fr_28px] items-center border-b border-border px-3 py-2 text-left text-xs hover:bg-accent/60",
                      point.id === selectedPointId && "bg-selected/10",
                    )}
                    onClick={() => setSelectedPointId(point.id)}
                  >
                    <span className="font-medium">{point.id}</span>
                    <span className="tabular-nums text-muted-foreground">{point.x}, {point.y}, {point.z}</span>
                    {marked && <LuCheck className="size-4 text-success" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="min-w-0 border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <div className="font-medium">画面标注</div>
                <div className="text-xs text-muted-foreground">
                  {selectedPoint ? `请点击 ${selectedPoint.id} 在画面中的准确位置` : "请先选择世界坐标点"}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="撤销最后一个点"
                  disabled={currentAnnotations.length === 0}
                  onClick={() => setAnnotationsByCamera((current) => ({ ...current, [cameraId]: currentAnnotations.slice(0, -1) }))}
                ><LuUndo2 className="size-4" /></Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="清空当前摄像头标注"
                  disabled={currentAnnotations.length === 0}
                  onClick={() => setAnnotationsByCamera((current) => ({ ...current, [cameraId]: [] }))}
                ><LuRotateCcw className="size-4" /></Button>
              </div>
            </div>
            <div className="relative flex aspect-video min-h-80 items-center justify-center overflow-hidden bg-neutral-950">
              {currentImage ? (
                <div className="relative max-h-full max-w-full">
                  <img
                    ref={imageRef}
                    src={currentImage}
                    alt={`${cameraId} 标定画面`}
                    className="block max-h-[650px] max-w-full cursor-crosshair object-contain"
                    onClick={annotate}
                  />
                  {currentAnnotations.map((annotation) => {
                    const image = imageRef.current;
                    if (!image?.naturalWidth || !image.naturalHeight) return null;
                    return (
                      <button
                        key={annotation.world_point_id}
                        type="button"
                        className="absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-selected text-[10px] font-bold text-white shadow"
                        style={{ left: `${(annotation.pixel_x / image.naturalWidth) * 100}%`, top: `${(annotation.pixel_y / image.naturalHeight) * 100}%` }}
                        onClick={(event) => { event.stopPropagation(); setSelectedPointId(annotation.world_point_id); }}
                        title={annotation.world_point_id}
                      >
                        {annotation.world_point_id.replace(/\D/g, "")}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-neutral-400">
                  <LuMousePointer2 className="mx-auto mb-3 size-12" />
                  <div className="text-sm">抓取高清帧或导入现场图片后开始标注</div>
                </div>
              )}
            </div>
          </section>

          <aside className="min-w-0 border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <div className="font-medium">标注与结果</div>
                <div className="text-xs text-muted-foreground">每台摄像头至少 6 个点</div>
              </div>
              <Button variant="outline" size="sm" onClick={saveAnnotations} disabled={currentAnnotations.length === 0}>
                <LuSave className="mr-1.5 size-4" />保存标注
              </Button>
            </div>

            <div className="border-b border-border px-4 py-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>当前进度</span>
                <span className={cn("font-medium tabular-nums", currentAnnotations.length >= 6 ? "text-success" : "text-warning-foreground")}>{currentAnnotations.length} / 6+</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-selected transition-all" style={{ width: `${Math.min(100, (currentAnnotations.length / 6) * 100)}%` }} />
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto border-b border-border">
              {currentAnnotations.map((annotation) => (
                <div key={annotation.world_point_id} className="grid grid-cols-[52px_1fr_auto] items-center border-b border-border px-4 py-2 text-xs last:border-b-0">
                  <span className="font-medium">{annotation.world_point_id}</span>
                  <span className="tabular-nums text-muted-foreground">({annotation.pixel_x.toFixed(1)}, {annotation.pixel_y.toFixed(1)}) px</span>
                  <button
                    type="button"
                    className="px-1 text-muted-foreground hover:text-destructive"
                    onClick={() => setAnnotationsByCamera((current) => ({ ...current, [cameraId]: currentAnnotations.filter((item) => item.world_point_id !== annotation.world_point_id) }))}
                    aria-label={`删除 ${annotation.world_point_id}`}
                  >×</button>
                </div>
              ))}
              {currentAnnotations.length === 0 && <div className="grid min-h-24 place-items-center text-xs text-muted-foreground">暂无像素标注</div>}
            </div>

            <div className="p-4">
              {currentResult ? (
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="border border-border bg-background_alt p-2"><div className="text-muted-foreground">重投影误差</div><div className="mt-1 font-medium tabular-nums">{currentResult.reproj_error_px?.toFixed(3) ?? "--"} px</div></div>
                    <div className="border border-border bg-background_alt p-2"><div className="text-muted-foreground">有效点数</div><div className="mt-1 font-medium tabular-nums">{currentResult.point_count ?? "--"}</div></div>
                  </div>
                  {currentResult.position && <div className="text-xs"><span className="text-muted-foreground">摄像头位置：</span><span className="tabular-nums">({currentResult.position.map((value) => value.toFixed(3)).join(", ")}) m</span></div>}
                  <Matrix matrix={currentResult.T_world_camera} />
                  <Button variant="select" onClick={saveResult}><LuSave className="mr-2 size-4" />保存当前外参</Button>
                </div>
              ) : (
                <div className="grid min-h-40 place-items-center text-center text-sm text-muted-foreground">完成标注并计算后显示外参结果</div>
              )}
            </div>
          </aside>
        </main>

        {camerasError && (
          <div className="flex items-start gap-2 border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            <LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
            摄像头接口未连接，当前使用本地摄像头清单；抓图和计算仍需要标定后端。
          </div>
        )}
      </div>
    </div>
  );
}
