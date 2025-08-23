// src/client/components/shop/shopui/special-panels/body-scales.tsx
import React, { useEffect, useRef, useState } from "@rbxts/react";
import { Button } from "client/components/ui/button";
import { Frame } from "client/components/ui/frame";
import { Text } from "client/components/ui/text";
import { fonts } from "client/constants/fonts";
import { useRem } from "client/hooks";
import { palette } from "shared/constants/palette";
import { InputCapture } from "client/components/ui/input-capture";
import { UserInputService } from "@rbxts/services";
import { getCurrentScales, setScalePct, type ScaleKey } from "../util/camerarotation";

export const SCALE_ROWS = [
  { key: "HeightScale", label: "Height" },
  { key: "WidthScale", label: "Width" },
  { key: "DepthScale", label: "Depth" },
  { key: "HeadScale", label: "Head" },
  { key: "BodyTypeScale", label: "Body Type" },
  { key: "BodyProportionScale", label: "Proportions" },
] as const;

export function BodyScalesPanel() {
  const rem = useRem();

  const [pcts, setPcts] = useState<Record<ScaleKey, number>>({
    HeightScale: 0.5,
    WidthScale: 0.5,
    DepthScale: 0.5,
    HeadScale: 0.5,
    BodyTypeScale: 0.5,
    BodyProportionScale: 0.5,
  });
  const [dragKey, setDragKey] = useState<ScaleKey | undefined>(undefined);

  // track refs
  const trackRefs = useRef(new Map<ScaleKey, Frame>()).current;
  const setTrackRef = (k: ScaleKey) => (inst?: Frame) => {
    if (inst) trackRefs.set(k, inst);
    else trackRefs.delete(k);
  };

  // load % từ model (giữ state giữa các lần mở)
  useEffect(() => {
    setPcts((prev) => ({ ...prev, ...getCurrentScales() }));
  }, []);

  // ------ helpers ------
  const knobPx = rem(3);

  const clampPctForKnob = (pct: number, trackPx: number) => {
    const w = math.max(0, trackPx);
    if (w <= knobPx) return 0.5;
    const half = (knobPx / w) / 2; // anchor (0.5,0.5)
    return math.clamp(pct, half, 1 - half);
  };

  const pctFromScreenX = (k: ScaleKey, screenX: number) => {
    const track = trackRefs.get(k);
    if (!track) return pcts[k];
    const x0 = track.AbsolutePosition.X;
    const w  = math.max(1, track.AbsoluteSize.X);
    const raw = (screenX - x0) / w;
    return clampPctForKnob(raw, w);
  };

  const getPointerX = (input: InputObject) => {
    if (
      input.UserInputType === Enum.UserInputType.MouseButton1 ||
      input.UserInputType === Enum.UserInputType.MouseMovement
    ) {
      return UserInputService.GetMouseLocation().X;
    }
    return input.Position.X;
  };

  // Global move/end (áp dụng khi đang kéo knob)
  const onGlobalMove = (_rbx: Frame, input: InputObject) => {
    if (
      input.UserInputType !== Enum.UserInputType.MouseMovement &&
      input.UserInputType !== Enum.UserInputType.Touch
    ) return;
    if (!dragKey) return;
    const sx = getPointerX(input);
    const pct = pctFromScreenX(dragKey, sx);
    setPcts((o) => ({ ...o, [dragKey]: pct }));
    setScalePct(dragKey, pct);
  };
  const onGlobalEnd = (_rbx: Frame, input: InputObject) => {
    if (
      input.UserInputType === Enum.UserInputType.MouseButton1 ||
      input.UserInputType === Enum.UserInputType.Touch
    ) setDragKey(undefined);
  };

  return (
    <Frame backgroundTransparency={1} size={new UDim2(1, 0, 1, 0)}>
      <uiflexitem FlexMode={"Fill"} />

      {/* ONE global capture for move/end only */}
      <InputCapture
        size={new UDim2(1, 0, 1, 0)}
        onInputChanged={onGlobalMove}
        onInputEnded={onGlobalEnd}
      />

      <scrollingframe Size={new UDim2(1, 0, 1, 0)} BackgroundTransparency={1}>
        <uilistlayout SortOrder={"LayoutOrder"} />

        {SCALE_ROWS.map((row, index) => {
          const k = row.key as ScaleKey;
          const pct = pcts[k];
          const track = trackRefs.get(k);
          const w = track ? math.max(0, track.AbsoluteSize.X) : 0;
          const pctForPos = track ? clampPctForKnob(pct, w) : math.clamp(pct, 0, 1);

          return (
            <Frame key={row.key} size={new UDim2(1, 0, 0.1, 0)} backgroundTransparency={1} layoutOrder={index}>
              {/* Track — local InputBegan ⇒ snap đúng row */}
              <Frame
                ref={setTrackRef(k)}
                size={new UDim2(1, 0, 0.2, 0)}
                backgroundColor={Color3.fromRGB(102, 102, 102)}
                anchorPoint={new Vector2(0.5, 0.5)}
                position={new UDim2(0.5, 0, 0.5, 0)}
                event={{
                  InputBegan: (_rbx, input) => {
                    if (
                      input.UserInputType === Enum.UserInputType.MouseButton1 ||
                      input.UserInputType === Enum.UserInputType.Touch
                    ) {
                      // SNAP only when click track (knob có handler riêng)
                      const sx = getPointerX(input);
                      const pct2 = pctFromScreenX(k, sx);
                      setPcts((o) => ({ ...o, [k]: pct2 }));
                      setScalePct(k, pct2);
                    }
                  },
                }}
              >
                {/* Knob — chỉ khi bấm vào knob mới bật drag */}
                <Button
                  size={new UDim2(0, knobPx, 0, knobPx)}
                  backgroundColor={palette.white}
                  backgroundTransparency={0}
                  anchorPoint={new Vector2(0.5, 0.5)}
                  position={new UDim2(pctForPos, 0, 0.5, 0)}
                  onMouseDown={() => setDragKey(k)}
                  onMouseUp={() => setDragKey(undefined)}
                >
                  <uicorner CornerRadius={new UDim(50, 50)} />
                </Button>
              </Frame>

              {/* Label */}
              <Text
                anchorPoint={new Vector2(1, 1)}
                position={new UDim2(0.95, 0, 1, 0)}
                size={new UDim2(0, rem(4), 0, rem(4))}
                backgroundTransparency={1}
                text={row.label}
                textSize={rem(2)}
                font={fonts.JosefinSans.bold}
                textColor={palette.white}
                textXAlignment={"Right"}
              />
            </Frame>
          );
        })}
      </scrollingframe>
    </Frame>
  );
}
