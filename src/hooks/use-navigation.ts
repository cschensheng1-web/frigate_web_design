import { NavData } from "@/types/navigation";
import { useMemo } from "react";
import { LuCrosshair, LuRoute, LuScanLine, LuVideo } from "react-icons/lu";
import { useIsAdmin } from "./use-is-admin";

export const ID_LIVE = 1;
export const ID_VIDEOPIPE = 2;
export const ID_TRAJECTORIES = 3;
export const ID_CALIBRATION = 4;

export default function useNavigation(
  variant: "primary" | "secondary" = "primary",
) {
  const isAdmin = useIsAdmin();

  return useMemo(
    () =>
      [
        {
          id: ID_LIVE,
          variant,
          icon: LuVideo,
          title: "实时监控",
          url: "/",
        },
        {
          id: ID_VIDEOPIPE,
          variant,
          icon: LuScanLine,
          title: "智能分析",
          url: "/videopipe",
        },
        {
          id: ID_TRAJECTORIES,
          variant,
          icon: LuRoute,
          title: "人员轨迹",
          url: "/trajectories",
        },
        {
          id: ID_CALIBRATION,
          variant,
          icon: LuCrosshair,
          title: "内部标定",
          url: "/calibration",
          enabled: isAdmin,
        },
      ] as NavData[],
    [variant, isAdmin],
  );
}
