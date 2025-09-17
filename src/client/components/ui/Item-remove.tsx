import React, { useEffect, useState } from "@rbxts/react";
import { Frame } from "./frame";
import { Button } from "./button";
import { useRem } from "client/hooks";
import { DisplayOptions } from "client/components/shop/shopui/displayoptions";
import {
  type SimpleAssetInfo,
  getWornAssetTypeForId,
} from "client/components/shop/shopui/util/camerarotation";
import { useMotion } from "@rbxts/pretty-react-hooks";
import { MarketplaceService } from "@rbxts/services";

interface Props {
  asset: SimpleAssetInfo;
  assetType?: Enum.AvatarAssetType;
  index?: number; // dùng cho stagger
}

/** Lấy tên hiển thị an toàn cho asset */
function getAssetDisplayName(a: SimpleAssetInfo): string {
  // ưu tiên tên từ props (đã có sẵn trong SimpleAssetInfo)
  if (typeOf(a.name) === "string" && a.name.size() > 0) return a.name;

  // fallback: đọc từ MarketplaceService
  const [ok, infoRaw] = pcall(() => MarketplaceService.GetProductInfo(a.id));
  if (ok && typeOf(infoRaw) === "table") {
    const t = infoRaw as unknown as { Name?: string };
    if (typeOf(t.Name) === "string" && (t.Name as string).size() > 0) return t.Name as string;
  }

  // cuối cùng: hiển thị theo id
  return `Item ${a.id}`;
}

export function Itemremove({ asset, assetType, index = 0 }: Props) {
  const rem = useRem();
  const [open, setOpen] = useState(false);

  const effectiveType =
    assetType ?? getWornAssetTypeForId(asset.id) ?? Enum.AvatarAssetType.Hat;

  const displayName = getAssetDisplayName(asset);

  // ==== Motion: từ TRÁI → PHẢI (animate frame con, không phải slot) ====
  const startXOffset = -rem(2.2);
  const overshootRight = rem(0.5);
  const STAGGER = 0.07;
  const MAX_DELAY = 0.6;
  const SPRING_IN_1 = { tension: 220, friction: 16, mass: 1 };
  const SPRING_IN_2 = { tension: 180, friction: 20, mass: 1 };
  const FADE_SPRING = { tension: 160, friction: 22, mass: 1 };

  const [x, xMotion] = useMotion(startXOffset);
  const [alpha, alphaMotion] = useMotion(1);

  useEffect(() => {
    const delay = math.min(index * STAGGER, MAX_DELAY);
    task.delay(delay, () => {
      xMotion.spring(overshootRight, SPRING_IN_1);
      alphaMotion.spring(0, FADE_SPRING);
      task.delay(0.09, () => xMotion.spring(0, SPRING_IN_2));
    });
  }, [index]);

  const fade = alpha.map((a: number) => math.clamp(a, 0, 1));
  const xPos = x.map((v: number) => new UDim2(0, v, 0, 0));
  const bgTrans = fade.map((f: number) => math.clamp(0.7 + f * 0.3, 0, 1));

  return (
    // SLOT: cố định vị trí/size cho UIListLayout, không animate ở đây
    <Frame
      key={`asset-${asset.id}`}
      size={new UDim2(0, rem(9), 0, rem(9))}
      backgroundTransparency={1}
      clipsDescendants // che phần trượt vào
    >
      {/* CONTENT: frame con mới là phần animate */}
      <Frame
        size={new UDim2(1, 0, 1, 0)}
        position={xPos} // 👈 trượt ngang
        backgroundColor={Color3.fromRGB(112, 112, 112)}
        backgroundTransparency={bgTrans}
        zIndex={2}
      >
        <uicorner />

        <Button
          size={new UDim2(1, 0, 1, 0)}
          backgroundTransparency={1}
          active
          zIndex={3}
          onClick={() => setOpen((v) => !v)}
        />

        <imagelabel
          Image={`rbxthumb://type=Asset&id=${asset.id}&w=150&h=150`}
          AnchorPoint={new Vector2(0.5, 0.5)}
          Position={new UDim2(0.5, 0, 0.5, 0)}
          Size={UDim2.fromScale(1, 1)}
          BackgroundTransparency={1}
          ZIndex={4}
          ScaleType="Fit"
          ImageTransparency={fade} // fade-in ảnh
        />

        <frame Size={new UDim2(1, 0, 1, 0)} BackgroundTransparency={1} ZIndex={5}>
          <DisplayOptions
            open={open}
            assetType={effectiveType}
            assetId={asset.id}
            cellW={rem(9)}
            assetName={displayName} // 👈 truyền tên vào DisplayOptions
          />
        </frame>
      </Frame>
    </Frame>
  );
}
