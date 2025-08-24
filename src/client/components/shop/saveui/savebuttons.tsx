import React from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem } from "client/hooks";
import { Button } from "client/components/ui/button";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";
import { remotes } from "shared/remotes";
import { getCurrentHumanoidAssets } from "client/components/shop/shopui/util/camerarotation";
import { Players } from "@rbxts/services";

function collectAssetIdsFromDesc(d: HumanoidDescription): number[] {
  const out = new Array<number>();

  // cloth
  const clothKeys = ["Shirt","Pants","GraphicTShirt","Face"] as const;
  for (let i = 0; i < clothKeys.size(); i++) {
    const k = clothKeys[i] as string;
    const v = (d as unknown as Record<string, unknown>)[k];
    if (typeOf(v) === "number" && (v as number) > 0) out.push(v as number);
  }
  // accessories (CSV)
  const accKeys = [
    "HatAccessory","HairAccessory","FaceAccessory","NeckAccessory",
    "ShouldersAccessory","FrontAccessory","BackAccessory","WaistAccessory",
  ] as const;
  for (let i = 0; i < accKeys.size(); i++) {
    const k = accKeys[i] as string;
    const v = (d as unknown as Record<string, unknown>)[k];
    if (typeOf(v) === "string" && (v as string) !== "") {
      for (const raw of (v as string).split(",")) {
        const n = tonumber(raw);
        if (n && n > 0) out.push(n);
      }
    }
  }
  // unique
  const seen = new Map<number, true>();
  const uniq = new Array<number>();
  for (let i = 0; i < out.size(); i++) {
    const id = out[i];
    if (!seen.get(id)) { seen.set(id, true as true); uniq.push(id); }
  }
  return uniq;
}

export function Savebuttonui() {
  const rem = useRem();

  function saveNow() {
    // 1) thử lấy từ viewport cache (nếu còn)
    const fromViewport = getCurrentHumanoidAssets().map(a => a.id);
    let assets = fromViewport;

    // 2) nếu rỗng ⇒ fallback đọc trực tiếp từ nhân vật người chơi
    if (assets.size() === 0) {
      const lp = Players.LocalPlayer!;
      const hum = lp.Character?.FindFirstChildOfClass("Humanoid");
      if (hum) assets = collectAssetIdsFromDesc(hum.GetAppliedDescription());
    }

    const name = `preset-${tostring(os.time())}`;
    remotes.server.postOutfit.fire(name, assets);
    print("[Savebuttonui] save request:", name, "count:", assets.size());
  }

  return (
    <Frame
      size={new UDim2(0, rem(50), 0, rem(40))}
      anchorPoint={new Vector2(0.5, 0.5)}
      position={new UDim2(0.5, 0, 0.5, 0)}
      backgroundTransparency={0.2}
    >
      <uicorner />
      <Button
        size={new UDim2(0, rem(14), 0, rem(6))}
        anchorPoint={new Vector2(0.5, 0.5)}
        position={new UDim2(0.5, 0, 0.5, 0)}
        onClick={saveNow}
      >
        <Image
          image={images.ui.plus_icon}
          size={new UDim2(0, rem(4), 0, rem(4))}
          anchorPoint={new Vector2(0.5, 0.5)}
          position={new UDim2(0.5, 0, 0.5, 0)}
        />
      </Button>
    </Frame>
  );
}
