import React, { useEffect, useState } from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { Button } from "client/components/ui/button";
import { Text } from "client/components/ui/text";
import { useRem } from "client/hooks";
import { fonts } from "client/constants/fonts";
import { palette } from "shared/constants/palette";
import { useMotion } from "@rbxts/pretty-react-hooks";

interface Props {
  open: boolean;
  cellW: number;
  onWear: () => void;
  onPublish: () => void;
}

export function DisplaySaveOpt({ open, cellW, onWear, onPublish }: Props) {
  const rem = useRem();
  const clamp = (v: number, lo: number, hi: number) => math.clamp(v, lo, hi);

  const labelSizeBase = math.floor(cellW * 0.085);
  const cornerPx      = clamp(math.floor(cellW * 0.08), 6, 12);
  const gapPx         = clamp(math.floor(cellW * 0.06), rem(0.6), rem(1.2));

  const maxPanelH     = cellW - rem(2);
  const maxBtnH       = math.floor((maxPanelH - gapPx) / 2);
  const btnHeightBase = math.floor(cellW * 0.28);

  const btnHeight = clamp(btnHeightBase, rem(6), maxBtnH);
  const labelSize = clamp(labelSizeBase, 6, 14);
  const mainBtnWidthScale = clamp(0.62 + (cellW / 400) * 0.05, 0.6, 0.72);

  const [shouldRender, setShouldRender] = useState(open);
  const [y, yMotion] = useMotion(1);
  const [a, aMotion] = useMotion(1);

  const SPRING_IN  = { tension: 220, friction: 20, mass: 1 };
  const SPRING_OUT = { tension: 230, friction: 18, mass: 1 };
  const FADE_IN    = { tension: 180, friction: 22, mass: 1 };
  const FADE_OUT   = { tension: 180, friction: 20, mass: 1 };

  useEffect(() => {
    if (open) {
      if (!shouldRender) setShouldRender(true);
      task.defer(() => {
        yMotion.spring(0, SPRING_IN);
        aMotion.spring(0, FADE_IN);
      });
    } else {
      yMotion.spring(1, SPRING_OUT);
      aMotion.spring(1, FADE_OUT);
      task.delay(0.25, () => setShouldRender(false));
    }
  }, [open]);

  if (!shouldRender) return undefined as unknown as JSX.Element;

  const pos  = y.map((v: number) => new UDim2(0, 0, v, 0));
  const fade = a.map((x: number) => math.clamp(x, 0, 1));

  return (
    <Frame size={new UDim2(1, 0, 1, 0)} backgroundTransparency={1} position={pos} zIndex={5}>
      <Frame
        size={new UDim2(1, 0, 0, btnHeight * 2 + gapPx)}
        anchorPoint={new Vector2(0.5, 0.5)}
        position={new UDim2(0.5, 0, 0.5, 0)}
        backgroundTransparency={1}
        zIndex={5}
      >
        <uilistlayout Padding={new UDim(0, gapPx)} HorizontalAlignment={"Center"} />

        {/* WEAR */}
        <Button
          size={new UDim2(mainBtnWidthScale, 0, 0, btnHeight)}
          backgroundColor={Color3.fromRGB(14, 250, 10)}
          zIndex={6}
          onClick={onWear}
        >
          <uicorner CornerRadius={new UDim(0, cornerPx)} />
          <Text
            text="WEAR"
            font={fonts.JosefinSans.bold}
            size={new UDim2(1, 0, 1, 0)}
            zIndex={7}
            textColor={palette.black}
            textSize={labelSize}
            textTransparency={fade}
          />
        </Button>

        {/* PUBLISH */}
        <Button
          size={new UDim2(mainBtnWidthScale, 0, 0, btnHeight)}
          backgroundColor={Color3.fromRGB(14, 250, 10)}
          zIndex={6}
          onClick={onPublish}
        >
          <uicorner CornerRadius={new UDim(0, cornerPx)} />
          <Text
            text="PUBLISH"
            font={fonts.JosefinSans.bold}
            size={new UDim2(1, 0, 1, 0)}
            zIndex={7}
            textColor={palette.black}
            textSize={labelSize}
            textTransparency={fade}
          />
        </Button>
      </Frame>
    </Frame>
  );
}
