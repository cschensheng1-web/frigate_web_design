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
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  LuCheck,
  LuCircleAlert,
  LuImage,
  LuMapPinned,
  LuPencil,
  LuPlus,
  LuRotateCcw,
  LuSearchCode,
  LuTrash2,
  LuVideo,
  LuX,
  LuTriangleAlert,
} from "react-icons/lu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useSWR, { mutate } from "swr";
import axios from "axios";
import { toast } from "sonner";
import ActivityIndicator from "@/components/indicators/activity-indicator";
import type {
  CameraInfo,
  CameraStatus,
  CalibrationMode,
  BoardParams,
  CaptureItem,
  MultiCalibrationResult,
  SingleCalibrationResult,
  StereoCalibrationResult,
} from "@/types/calibration";
import { Link } from "react-router-dom";

// ─── 默认标定板参数 ───────────────────────────────────
const defaultBoardParams: BoardParams = {
  squaresX: "9",
  squaresY: "9",
  squareLength: "0.08",
  markerLength: "0.06",
  dictionary: "DICT_5X5_100",
};

const boardSpecSummary =
  "棋盘格 / 二维码形式，整板 800mm x 800mm，边缘留白 40mm，有效格子 9 x 9，小格 80mm x 80mm，marker 60mm";

// ─── 接口草案 ─────────────────────────────────────────
const apiDrafts = [
  { method: "GET", path: "/api/cameras" },
  { method: "POST", path: "/api/calibration/capture" },
  { method: "POST", path: "/api/calibration/stereo/capture" },
  { method: "POST", path: "/api/calibration/multi/capture" },
  { method: "POST", path: "/api/calibration/run" },
  { method: "POST", path: "/api/calibration/stereo/run" },
  { method: "GET", path: "/api/calibration/:camera/result" },
  { method: "POST", path: "/api/calibration/:camera/save" },
];

// ─── 本地摄像头清单管理 ───────────────────────────────
const LOCAL_CAMERAS_KEY = "web-design.calibration.cameras.v1";

type CameraDraft = Omit<CameraInfo, "id">;

const emptyCameraDraft: CameraDraft = {
  name: "",
  ip: "",
  codec: "H.265",
  status: "pending",
  resolution: "1920 x 1080",
};

function loadLocalCameras(): CameraInfo[] | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_CAMERAS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveLocalCameras(cameras: CameraInfo[]) {
  try {
    window.localStorage.setItem(LOCAL_CAMERAS_KEY, JSON.stringify(cameras));
  } catch {
    // 忽略隐私模式或存储额度限制
  }
}

function clearLocalCameras() {
  try {
    window.localStorage.removeItem(LOCAL_CAMERAS_KEY);
  } catch {
    // 忽略隐私模式或存储额度限制
  }
}

const statusLabels: Record<CameraStatus, string> = {
  planning: "待安装",
  pending: "待接线",
  offline: "未接入",
  online: "在线",
};

const statusStyles: Record<CameraStatus, string> = {
  planning: "border-selected/40 bg-selected/10 text-selected",
  pending: "border-warning/30 bg-warning/10 text-warning-foreground",
  offline: "border-muted bg-muted text-muted-foreground",
  online: "border-success/40 bg-success/10 text-success-foreground",
};

/** 判断是否为双摄像头标定结果 */
function isStereoResult(
  r: SingleCalibrationResult | StereoCalibrationResult | MultiCalibrationResult,
): r is StereoCalibrationResult {
  return "camera1ToCamera2" in r;
}

function isMultiResult(
  r: SingleCalibrationResult | StereoCalibrationResult | MultiCalibrationResult,
): r is MultiCalibrationResult {
  return "pairResults" in r;
}

/** 把矩阵渲染为表格 */
function MatrixTable({ matrix }: { matrix: number[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-background_alt p-2">
      {matrix.map((row, ri) => (
        <div
          key={ri}
          className="grid grid-flow-col auto-cols-max gap-3 text-xs"
        >
          {row.map((val, ci) => (
            <span key={ci} className="w-16 text-right tabular-nums">
              {val}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── 子组件 ───────────────────────────────────────────

function CameraPreview({
  camera,
  boardParams,
  compact = false,
  title,
}: {
  camera: CameraInfo;
  boardParams: BoardParams;
  compact?: boolean;
  title?: string;
}) {
  const isOffline = camera.status === "offline";

  return (
    <div
      className={cn(
        "relative aspect-video min-w-0 overflow-hidden rounded-md border border-border bg-background_alt",
        compact ? "min-h-56" : "min-h-64",
        isOffline && "opacity-60",
      )}
    >
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="flex max-w-full flex-col items-center gap-3 text-muted-foreground">
          {isOffline ? (
            <LuTriangleAlert className="size-12 text-warning" />
          ) : (
            <LuVideo className="size-12" />
          )}
          <div className="max-w-[85%] break-all text-center text-xs md:text-sm">
            {camera.ip}
          </div>
        </div>
      </div>
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-md border border-border bg-background/90 px-3 py-2 text-sm">
        <span
          className={cn(
            "size-2 rounded-full",
            isOffline ? "bg-muted-foreground" : "bg-selected",
          )}
        />
        {statusLabels[camera.status]}
      </div>
      {title && (
        <div className="absolute right-4 top-4 rounded-md border border-border bg-background/90 px-3 py-2 text-sm font-medium">
          {title}
        </div>
      )}
      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <Metric label="地址" value={camera.ip} />
        <Metric label="编码" value={camera.codec} />
        <Metric label="分辨率" value={camera.resolution} />
        <Metric label="标定板" value={boardParams.dictionary} />
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background/95 px-3 py-2">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function ParamInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9"
      />
    </div>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-background_alt px-3 py-1 text-muted-foreground">
      {children}
    </span>
  );
}

// ─── 摄像头添加/编辑弹窗 ───────────────────────────────

function CameraFormDialog({
  open,
  camera,
  existingCameras,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  camera: CameraInfo | null;
  existingCameras: CameraInfo[];
  onOpenChange: (open: boolean) => void;
  onSave: (draft: CameraDraft, cameraId?: string) => void;
}) {
  const [draft, setDraft] = useState<CameraDraft>(emptyCameraDraft);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(
      camera
        ? {
            name: camera.name,
            ip: camera.ip,
            codec: camera.codec,
            status: camera.status,
            resolution: camera.resolution,
          }
        : emptyCameraDraft,
    );
    setFormError("");
  }, [open, camera]);

  const submit = () => {
    const name = draft.name.trim();
    const ip = draft.ip.trim();
    if (!name || !ip) {
      setFormError("名称和 IP 地址不能为空");
      return;
    }
    const duplicate = existingCameras.some(
      (existing) => existing.ip === ip && existing.id !== camera?.id,
    );
    if (duplicate) {
      setFormError("已存在相同 IP 的摄像头");
      return;
    }
    onSave({ ...draft, name, ip }, camera?.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{camera ? "编辑摄像头" : "添加摄像头"}</DialogTitle>
          <DialogDescription>
            {camera
              ? "修改点位信息后保存，列表会立即更新。"
              : "新增点位会保存到本地演示列表。"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                名称
              </Label>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft((cur) => ({ ...cur, name: event.target.value }))
                }
                placeholder="例如 摄像头 4"
                className="h-9"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                IP 地址
              </Label>
              <Input
                value={draft.ip}
                onChange={(event) =>
                  setDraft((cur) => ({ ...cur, ip: event.target.value }))
                }
                placeholder="192.168.0.67"
                className="h-9"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                编码
              </Label>
              <Select
                value={draft.codec}
                onValueChange={(codec) =>
                  setDraft((cur) => ({ ...cur, codec }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="H.264">H.264</SelectItem>
                  <SelectItem value="H.265">H.265</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                分辨率
              </Label>
              <Input
                value={draft.resolution}
                onChange={(event) =>
                  setDraft((cur) => ({
                    ...cur,
                    resolution: event.target.value,
                  }))
                }
                placeholder="1920 x 1080"
                className="h-9"
              />
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              状态
            </Label>
            <Select
              value={draft.status}
              onValueChange={(status) =>
                setDraft((cur) => ({
                  ...cur,
                  status: status as CameraStatus,
                }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">待安装</SelectItem>
                <SelectItem value="pending">待接线</SelectItem>
                <SelectItem value="offline">未接入</SelectItem>
                <SelectItem value="online">在线</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {formError}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button variant="select" onClick={submit}>
            <LuCheck className="mr-2 size-4" />
            {camera ? "保存修改" : "添加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDeleteDialog({
  camera,
  onOpenChange,
  onConfirm,
}: {
  camera: CameraInfo | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (camera: CameraInfo) => void;
}) {
  return (
    <Dialog open={camera !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>删除摄像头</DialogTitle>
          <DialogDescription>
            确定删除 {camera?.name}（{camera?.ip}）吗？该操作只修改本地演示列表。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => camera && onConfirm(camera)}
          >
            <LuTrash2 className="mr-2 size-4" />
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 主组件 ───────────────────────────────────────────

function Calibration() {
  // --- 摄像头列表（API） ---
  const {
    data: apiCameras,
    error: camerasError,
    isLoading: camerasLoading,
  } = useSWR<CameraInfo[]>("cameras", {
    revalidateOnFocus: false,
  });

  // --- 本地状态 ---
  const [calibrationMode, setCalibrationMode] =
    useState<CalibrationMode>("single");
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [secondaryCameraId, setSecondaryCameraId] = useState<string>("");
  const [thirdCameraId, setThirdCameraId] = useState<string>("");
  const [boardParams, setBoardParams] =
    useState<BoardParams>(defaultBoardParams);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [calibrationResult, setCalibrationResult] =
    useState<
      | SingleCalibrationResult
      | StereoCalibrationResult
      | MultiCalibrationResult
      | null
    >(null);
  const [localCameras, setLocalCameras] = useState<CameraInfo[] | null>(
    loadLocalCameras,
  );
  const [cameraFormOpen, setCameraFormOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<CameraInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CameraInfo | null>(null);

  // 本地演示列表优先，其次使用接口列表
  const cameras = useMemo(
    () => localCameras ?? apiCameras ?? [],
    [localCameras, apiCameras],
  );

  // 首次从接口拿到列表时，作为本地演示列表的基础
  useEffect(() => {
    if (localCameras === null && apiCameras && apiCameras.length > 0) {
      setLocalCameras(apiCameras);
    }
  }, [apiCameras, localCameras]);

  // 本地改动自动保存，刷新页面后仍然保留
  useEffect(() => {
    if (localCameras !== null) {
      saveLocalCameras(localCameras);
    }
  }, [localCameras]);

  // --- 回填默认选中 ---
  useEffect(() => {
    if (cameras && cameras.length > 0 && !selectedCameraId) {
      setSelectedCameraId(cameras[0].id);
      if (cameras.length > 1) {
        setSecondaryCameraId(cameras[1].id);
      }
      if (cameras.length > 2) {
        setThirdCameraId(cameras[2].id);
      }
    }
  }, [cameras, selectedCameraId]);

  // --- 衍生数据 ---
  const selectedCamera = useMemo(
    () => cameras?.find((c) => c.id === selectedCameraId) ?? null,
    [cameras, selectedCameraId],
  );

  const secondaryCamera = useMemo(
    () => cameras?.find((c) => c.id === secondaryCameraId) ?? null,
    [cameras, secondaryCameraId],
  );

  const thirdCamera = useMemo(
    () => cameras?.find((c) => c.id === thirdCameraId) ?? null,
    [cameras, thirdCameraId],
  );

  const previewCameras = useMemo(() => {
    if (calibrationMode === "stereo" || calibrationMode === "multi") {
      const list: (CameraInfo | null)[] = [selectedCamera, secondaryCamera];
      if (calibrationMode === "multi") list.push(thirdCamera);
      return list;
    }
    return [selectedCamera];
  }, [calibrationMode, selectedCamera, secondaryCamera, thirdCamera]);

  const captureUnit = calibrationMode === "single" ? "张" : "组";

  // 副摄像头不能和主摄像头相同
  useEffect(() => {
    if (
      calibrationMode !== "single" &&
      selectedCameraId === secondaryCameraId &&
      cameras &&
      cameras.length > 1
    ) {
      const alt = cameras.find((c) => c.id !== selectedCameraId);
      if (alt) setSecondaryCameraId(alt.id);
    }
  }, [calibrationMode, selectedCameraId, secondaryCameraId, cameras]);

  useEffect(() => {
    if (calibrationMode !== "multi" || cameras.length < 3) return;
    if (
      !thirdCameraId ||
      thirdCameraId === selectedCameraId ||
      thirdCameraId === secondaryCameraId
    ) {
      const alternate = cameras.find(
        (camera) =>
          camera.id !== selectedCameraId && camera.id !== secondaryCameraId,
      );
      if (alternate) setThirdCameraId(alternate.id);
    }
  }, [
    calibrationMode,
    cameras,
    selectedCameraId,
    secondaryCameraId,
    thirdCameraId,
  ]);

  useEffect(() => {
    document.title = "标定工作台";
  }, []);

  const updateParam = (key: keyof BoardParams, value: string) => {
    setBoardParams((cur) => ({ ...cur, [key]: value }));
  };

  // --- 摄像头添加/编辑/删除 ---
  const handleSaveCamera = (draft: CameraDraft, cameraId?: string) => {
    const base = localCameras ?? apiCameras ?? [];
    let next: CameraInfo[];
    let addedId: string | undefined;
    if (cameraId) {
      next = base.map((camera) =>
        camera.id === cameraId ? { ...camera, ...draft } : camera,
      );
    } else {
      addedId = `camera_${Date.now().toString(36)}`;
      next = [...base, { id: addedId, ...draft }];
    }
    setLocalCameras(next);
    setCameraFormOpen(false);
    setEditingCamera(null);
    if (addedId) setSelectedCameraId(addedId);
    toast.success(cameraId ? "摄像头已更新" : "摄像头已添加");
  };

  const handleDeleteCamera = (camera: CameraInfo) => {
    setLocalCameras(
      (cur) => (cur ?? apiCameras ?? []).filter((c) => c.id !== camera.id),
    );
    setDeleteTarget(null);
    if (selectedCameraId === camera.id) setSelectedCameraId("");
    if (secondaryCameraId === camera.id) setSecondaryCameraId("");
    if (thirdCameraId === camera.id) setThirdCameraId("");
    toast.success("摄像头已删除");
  };

  const resetCameraList = () => {
    clearLocalCameras();
    setLocalCameras(null);
    setSelectedCameraId("");
    setSecondaryCameraId("");
    setThirdCameraId("");
  };

  // --- 采集 ---
  const handleCapture = useCallback(async () => {
    if (!selectedCamera) return;
    setCapturing(true);
    try {
      if (calibrationMode === "multi") {
        if (!secondaryCamera || !thirdCamera) return;
        const { data } = await axios.post<CaptureItem[]>(
          "/api/calibration/multi/capture",
          {
            camera_ids: [
              selectedCamera.id,
              secondaryCamera.id,
              thirdCamera.id,
            ],
          },
        );
        setCaptures((prev) => [
          ...prev,
          ...data.map((item, index) => ({
            ...item,
            id: item.id || prev.length + index + 1,
          })),
        ]);
        toast.success("三路同步采集完成");
      } else if (calibrationMode === "stereo") {
        if (!secondaryCamera) return;
        const { data } = await axios.post<CaptureItem[]>(
          "/api/calibration/stereo/capture",
          {
            camera1_id: selectedCamera.id,
            camera2_id: secondaryCamera.id,
          },
        );
        setCaptures((prev) => [
          ...prev,
          ...data.map((d, i) => ({ ...d, id: d.id || prev.length + i + 1 })),
        ]);
        toast.success("同步采集完成");
      } else {
        const { data } = await axios.post<CaptureItem>(
          "/api/calibration/capture",
          {
            camera_id: selectedCamera.id,
          },
        );
        setCaptures((prev) => [
          ...prev,
          { ...data, id: data.id || prev.length + 1 },
        ]);
        toast.success("采集完成");
      }
    } catch (err) {
      toast.error(
        `采集失败: ${err instanceof Error ? err.message : "未知错误"}`,
      );
    } finally {
      setCapturing(false);
    }
  }, [calibrationMode, selectedCamera, secondaryCamera, thirdCamera]);

  // --- 开始标定 ---
  const handleCalibrate = useCallback(async () => {
    if (!selectedCamera) return;
    setCalibrating(true);
    setResultVisible(false);
    try {
      if (calibrationMode === "multi") {
        if (!secondaryCamera || !thirdCamera) return;
        const pairs: [CameraInfo, CameraInfo][] = [
          [selectedCamera, secondaryCamera],
          [secondaryCamera, thirdCamera],
          [selectedCamera, thirdCamera],
        ];
        const responses = await Promise.all(
          pairs.map(([camera1, camera2]) =>
            axios.post<StereoCalibrationResult>(
              "/api/calibration/stereo/run",
              {
                camera1_id: camera1.id,
                camera2_id: camera2.id,
                board_params: boardParams,
                images: captures,
              },
            ),
          ),
        );
        const values = responses.map((response) => response.data);
        setCalibrationResult({
          pairResults: values.map((value, index) => ({
            camera1Id: pairs[index][0].id,
            camera2Id: pairs[index][1].id,
            ok: true,
            pairCount: value.syncCount,
            reprojectionError: value.reprojectionError,
            camera1ToCamera2: value.camera1ToCamera2,
          })),
          reprojectionError:
            values.reduce((sum, value) => sum + value.reprojectionError, 0) /
            values.length,
          syncCount: Math.min(...values.map((value) => value.syncCount)),
        });
      } else if (calibrationMode === "stereo") {
        if (!secondaryCamera) return;
        const { data } = await axios.post<StereoCalibrationResult>(
          "/api/calibration/stereo/run",
          {
            camera1_id: selectedCamera.id,
            camera2_id: secondaryCamera.id,
            board_params: boardParams,
            images: captures,
          },
        );
        setCalibrationResult(data);
      } else {
        const { data } = await axios.post<SingleCalibrationResult>(
          "/api/calibration/run",
          {
            camera_id: selectedCamera.id,
            board_params: boardParams,
            images: captures,
          },
        );
        setCalibrationResult(data);
      }
      setResultVisible(true);
      toast.success("标定完成");
    } catch (err) {
      toast.error(
        `标定失败: ${err instanceof Error ? err.message : "未知错误"}`,
      );
    } finally {
      setCalibrating(false);
    }
  }, [
    calibrationMode,
    selectedCamera,
    secondaryCamera,
    thirdCamera,
    boardParams,
    captures,
  ]);

  // --- 保存 ---
  const handleSave = useCallback(async () => {
    if (!selectedCamera || !calibrationResult) return;
    setSaving(true);
    try {
      if (isMultiResult(calibrationResult)) {
        await axios.post("/api/calibration/multi/save", {
          camera_ids: [selectedCameraId, secondaryCameraId, thirdCameraId],
          result: calibrationResult,
        });
      } else {
        await axios.post(
          `/api/calibration/${selectedCamera.id}/save`,
          calibrationResult,
        );
      }
      toast.success("标定结果已保存");
    } catch (err) {
      toast.error(
        `保存失败: ${err instanceof Error ? err.message : "未知错误"}`,
      );
    } finally {
      setSaving(false);
    }
  }, [
    selectedCamera,
    calibrationResult,
    selectedCameraId,
    secondaryCameraId,
    thirdCameraId,
  ]);

  // --- 删除单次采集 ---
  const removeCapture = useCallback((id: number) => {
    setCaptures((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // --- 重置 ---
  const resetAll = useCallback(() => {
    setCaptures([]);
    setResultVisible(false);
    setCalibrationResult(null);
  }, []);

  // --- 加载中 ---
  if (camerasLoading && localCameras === null && apiCameras === undefined) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <ActivityIndicator className="w-10" />
      </div>
    );
  }

  // --- 加载失败 ---
  if (camerasError && localCameras === null) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <LuTriangleAlert className="size-10" />
          <div className="text-sm">
            摄像头列表加载失败，请确认后端服务已启动
          </div>
          <Button variant="outline" onClick={() => mutate("cameras")}>
            重试
          </Button>
        </div>
      </div>
    );
  }

  // --- 正常渲染 ---
  const cameraDisabled =
    !selectedCamera ||
    selectedCamera.status === "offline" ||
    (calibrationMode !== "single" &&
      (!secondaryCamera || secondaryCamera.status === "offline")) ||
    (calibrationMode === "multi" &&
      (!thirdCamera || thirdCamera.status === "offline"));

  return (
    <div className="scrollbar-container size-full overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 md:p-5">
        {/* ── Header ────────────────────────────────── */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xl font-semibold">
              <LuSearchCode className="size-5 text-selected" />
              标定工作台
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              ChArUco 参数、采集进度、结果格式和接口清单
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="select" size="sm" asChild>
                <Link to="/calibration">内参与联合标定</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/calibration/world">
                  <LuMapPinned className="mr-2 size-4" />
                  场地坐标标定
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusPill>接口待接入</StatusPill>
              <StatusPill>
                {calibrationMode === "multi"
                  ? "三摄像头"
                  : calibrationMode === "stereo"
                    ? "双摄像头"
                    : "单摄像头"}
              </StatusPill>
              <StatusPill>
                已采集 {captures.length} {captureUnit}
              </StatusPill>
            </div>
          </div>
        </header>

        {/* ── 主内容 ────────────────────────────────── */}
        <main className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_300px]">
          {/* ── 左侧 ──────────────────────────────── */}
          <section className="flex min-w-0 flex-col gap-4">
            {/* 标定模式 + 摄像头选择 */}
            <Panel>
              <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
                {/* 模式切换 */}
                <div>
                  <Label className="mb-2 block text-sm">标定模式</Label>
                  <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background_alt p-1">
                    <button
                      type="button"
                      className={cn(
                        "h-9 rounded px-3 text-sm transition-colors",
                        calibrationMode === "single"
                          ? "bg-selected text-white"
                          : "text-muted-foreground hover:bg-accent",
                      )}
                      onClick={() => setCalibrationMode("single")}
                    >
                      单摄像头
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "h-9 rounded px-3 text-sm transition-colors",
                        calibrationMode === "stereo"
                          ? "bg-selected text-white"
                          : "text-muted-foreground hover:bg-accent",
                      )}
                      onClick={() => setCalibrationMode("stereo")}
                    >
                      双摄像头
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "h-9 rounded px-3 text-sm transition-colors",
                        calibrationMode === "multi"
                          ? "bg-selected text-white"
                          : "text-muted-foreground hover:bg-accent",
                      )}
                      onClick={() => setCalibrationMode("multi")}
                    >
                      三摄像头
                    </button>
                  </div>
                </div>

                {/* 摄像头选择 */}
                <div
                  className={cn(
                    "grid min-w-0 gap-3",
                    calibrationMode === "stereo" && "md:grid-cols-2",
                    calibrationMode === "multi" && "md:grid-cols-3",
                  )}
                >
                  <div className="min-w-0">
                    <Label className="mb-2 block text-sm">
                      {calibrationMode === "single" ? "摄像头" : "主摄像头"}
                    </Label>
                    <Select
                      value={selectedCameraId}
                      onValueChange={setSelectedCameraId}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cameras.map((camera) => (
                          <SelectItem key={camera.id} value={camera.id}>
                            {camera.name} ({camera.ip})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {calibrationMode !== "single" && (
                    <div className="min-w-0">
                      <Label className="mb-2 block text-sm">副摄像头</Label>
                      <Select
                        value={secondaryCameraId}
                        onValueChange={setSecondaryCameraId}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {cameras
                            .filter((c) => c.id !== selectedCameraId)
                            .map((camera) => (
                              <SelectItem key={camera.id} value={camera.id}>
                                {camera.name} ({camera.ip})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {calibrationMode === "multi" && (
                    <div className="min-w-0">
                      <Label className="mb-2 block text-sm">第三摄像头</Label>
                      <Select
                        value={thirdCameraId}
                        onValueChange={setThirdCameraId}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {cameras
                            .filter(
                              (camera) =>
                                camera.id !== selectedCameraId &&
                                camera.id !== secondaryCameraId,
                            )
                            .map((camera) => (
                              <SelectItem key={camera.id} value={camera.id}>
                                {camera.name} ({camera.ip})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={cameraDisabled || capturing}
                    onClick={handleCapture}
                  >
                    {capturing ? (
                      <ActivityIndicator className="mr-2 w-4" size={14} />
                    ) : (
                      <LuImage className="mr-2 size-4" />
                    )}
                    {calibrationMode === "multi"
                      ? "同步采集三路"
                      : calibrationMode === "stereo"
                        ? "同步采集一组"
                        : "采集一张"}
                  </Button>
                  <Button
                    variant="select"
                    disabled={cameraDisabled || calibrating || captures.length === 0}
                    onClick={handleCalibrate}
                  >
                    {calibrating ? (
                      <ActivityIndicator className="mr-2 w-4" size={14} />
                    ) : (
                      <LuSearchCode className="mr-2 size-4" />
                    )}
                    {calibrationMode === "multi"
                      ? "开始三摄标定"
                      : calibrationMode === "stereo"
                        ? "开始联合标定"
                        : "开始标定"}
                  </Button>
                </div>
              </div>

              {/* 摄像头预览 */}
              <div
                className={cn(
                  "mt-4 grid gap-3",
                  calibrationMode === "stereo" && "lg:grid-cols-2",
                  calibrationMode === "multi" && "lg:grid-cols-3",
                )}
              >
                {previewCameras.map(
                  (camera, index) =>
                    camera && (
                      <CameraPreview
                        key={camera.id}
                        camera={camera}
                        boardParams={boardParams}
                        compact={calibrationMode !== "single"}
                        title={
                          calibrationMode !== "single"
                            ? index === 0
                              ? "主画面"
                              : index === 1
                                ? "副画面"
                                : "第三画面"
                            : undefined
                        }
                      />
                    ),
                )}
              </div>
            </Panel>

            {/* 标定板参数 */}
            <Panel>
              <div className="mb-3">
                <div className="flex items-center gap-2 font-medium">
                  <LuPencil className="size-4 text-selected" />
                  标定板参数
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {boardSpecSummary}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ParamInput
                  label="squaresX"
                  value={boardParams.squaresX}
                  onChange={(v) => updateParam("squaresX", v)}
                />
                <ParamInput
                  label="squaresY"
                  value={boardParams.squaresY}
                  onChange={(v) => updateParam("squaresY", v)}
                />
                <ParamInput
                  label="squareLength (m)"
                  value={boardParams.squareLength}
                  onChange={(v) => updateParam("squareLength", v)}
                />
                <ParamInput
                  label="markerLength (m)"
                  value={boardParams.markerLength}
                  onChange={(v) => updateParam("markerLength", v)}
                />
              </div>
            </Panel>

            {/* 采集进度 */}
            <Panel>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">采集进度</div>
                  <div className="text-sm text-muted-foreground">
                    已采集 {captures.length} {captureUnit}
                    {captures.length === 0 && "，请点击上方按钮开始采集"}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={captures.length === 0}
                  onClick={resetAll}
                >
                  重置
                </Button>
              </div>

              {/* 采集卡片网格 */}
              {captures.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                  {captures.map((capture) => (
                    <div
                      key={capture.id}
                      className="relative min-h-24 rounded-md border border-border bg-background_alt p-2"
                    >
                      <button
                        type="button"
                        className="absolute right-1.5 top-1.5 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => removeCapture(capture.id)}
                        aria-label="删除此采集"
                      >
                        <LuX className="size-3.5" />
                      </button>
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span>#{String(capture.id).padStart(2, "0")}</span>
                        <LuCheck className="size-4 text-success" />
                      </div>
                      <div className="grid h-12 place-items-center rounded border border-border bg-background text-xs text-muted-foreground">
                        corners {capture.corners}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        error {capture.error}px
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-24 place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                  暂无采集数据
                </div>
              )}
            </Panel>
          </section>

          {/* ── 右侧 ──────────────────────────────── */}
          <aside className="flex min-w-0 flex-col gap-4">
            {/* 摄像头清单 */}
            <Panel>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">摄像头清单</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {cameras.length} 个点位
                    {localCameras !== null && "（本地演示列表）"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {localCameras !== null && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="从接口恢复列表"
                      aria-label="从接口恢复列表"
                      onClick={resetCameraList}
                    >
                      <LuRotateCcw className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="select"
                    size="sm"
                    onClick={() => {
                      setEditingCamera(null);
                      setCameraFormOpen(true);
                    }}
                  >
                    <LuPlus className="mr-1 size-4" />
                    添加
                  </Button>
                </div>
              </div>

              {cameras.length > 0 ? (
                <div className="overflow-hidden rounded-md border border-border">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border bg-background_alt px-2.5 py-2 text-[11px] font-medium text-muted-foreground">
                    <span>点位</span>
                    <span>状态</span>
                    <span className="text-right">操作</span>
                  </div>
                  <div className="grid gap-px bg-border">
                    {cameras.map((camera) => {
                      const isSelected =
                        calibrationMode !== "single"
                          ? camera.id === selectedCameraId ||
                            camera.id === secondaryCameraId ||
                            (calibrationMode === "multi" &&
                              camera.id === thirdCameraId)
                          : camera.id === selectedCameraId;

                      return (
                        <div
                          key={camera.id}
                          className={cn(
                            "grid cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 bg-background px-2.5 py-2 transition-colors hover:bg-accent/60",
                            isSelected && "bg-selected/10",
                          )}
                          onClick={() => setSelectedCameraId(camera.id)}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {camera.name}
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {camera.ip}
                            </div>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[11px]",
                              statusStyles[camera.status],
                            )}
                          >
                            {statusLabels[camera.status]}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title="编辑"
                              aria-label={`编辑 ${camera.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingCamera(camera);
                                setCameraFormOpen(true);
                              }}
                            >
                              <LuPencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              title="删除"
                              aria-label={`删除 ${camera.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteTarget(camera);
                              }}
                            >
                              <LuTrash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid min-h-24 place-items-center rounded-md border border-dashed border-border text-center text-sm text-muted-foreground">
                  暂无摄像头，点击右上角“添加”
                </div>
              )}
            </Panel>

            {/* 接口草案 */}
            <Panel>
              <div className="mb-3 flex items-center gap-2 font-medium">
                <LuCircleAlert className="size-4 text-selected" />
                接口草案
              </div>
              <div className="grid gap-2">
                {apiDrafts.map((api) => (
                  <div
                    key={`${api.method} ${api.path}`}
                    className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background_alt px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-medium">
                      {api.method}
                    </span>
                    <code className="min-w-0 break-all leading-relaxed">
                      {api.path}
                    </code>
                  </div>
                ))}
              </div>
            </Panel>

            {/* 标定结果 */}
            <Panel>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="font-medium">标定结果</div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!calibrationResult || saving}
                  onClick={handleSave}
                >
                  {saving ? (
                    <ActivityIndicator className="mr-2 w-4" size={14} />
                  ) : (
                    <LuCheck className="mr-2 size-4" />
                  )}
                  保存
                </Button>
              </div>

              {resultVisible && calibrationResult ? (
                <div className="grid gap-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Metric
                      label="重投影误差"
                      value={`${calibrationResult.reprojectionError.toFixed(2)} px`}
                    />
                    <Metric
                      label={
                        isStereoResult(calibrationResult) ||
                        isMultiResult(calibrationResult)
                          ? "同步组数"
                          : "图像数量"
                      }
                      value={
                        isStereoResult(calibrationResult) ||
                        isMultiResult(calibrationResult)
                          ? `${calibrationResult.syncCount}`
                          : `${calibrationResult.imageCount}`
                      }
                    />
                    <Metric label="状态" value="待验证" />
                  </div>

                  {isMultiResult(calibrationResult) ? (
                    <div className="grid gap-3">
                      {calibrationResult.pairResults.map((pair) => (
                        <div
                          key={`${pair.camera1Id}-${pair.camera2Id}`}
                          className="border border-border bg-background_alt p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium">
                              {pair.camera1Id} ↔ {pair.camera2Id}
                            </span>
                            <span
                              className={
                                pair.ok ? "text-success" : "text-destructive"
                              }
                            >
                              {pair.ok ? `${pair.pairCount} 组有效` : "计算失败"}
                            </span>
                          </div>
                          {pair.camera1ToCamera2 && (
                            <MatrixTable matrix={pair.camera1ToCamera2} />
                          )}
                          {pair.message && (
                            <div className="mt-2 text-xs text-destructive">
                              {pair.message}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : isStereoResult(calibrationResult) ? (
                    <>
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">
                          camera1Extrinsic
                        </div>
                        <MatrixTable
                          matrix={calibrationResult.camera1Extrinsic}
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">
                          camera2Extrinsic
                        </div>
                        <MatrixTable
                          matrix={calibrationResult.camera2Extrinsic}
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">
                          camera1ToCamera2
                        </div>
                        <MatrixTable
                          matrix={calibrationResult.camera1ToCamera2}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">
                          cameraMatrix
                        </div>
                        <MatrixTable
                          matrix={calibrationResult.cameraMatrix}
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">
                          distCoeffs
                        </div>
                        <MatrixTable
                          matrix={calibrationResult.distCoeffs}
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">
                          ground H
                        </div>
                        <MatrixTable
                          matrix={calibrationResult.groundH}
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                  暂无结果
                </div>
              )}
            </Panel>
          </aside>
        </main>

        <CameraFormDialog
          open={cameraFormOpen}
          camera={editingCamera}
          existingCameras={cameras}
          onOpenChange={(open) => {
            setCameraFormOpen(open);
            if (!open) setEditingCamera(null);
          }}
          onSave={handleSaveCamera}
        />

        <ConfirmDeleteDialog
          camera={deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          onConfirm={handleDeleteCamera}
        />
      </div>
    </div>
  );
}

export default Calibration;
