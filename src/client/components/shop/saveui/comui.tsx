// src/client/components/shop/saveui/comui.tsx
import React, { useEffect, useMemo, useState } from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem } from "client/hooks";
import { remotes, type PublicOutfit, type PublicOutfitsPayload } from "shared/remotes";
import { CharField } from "./charfield";
import { buildDescriptionFromAssets } from "./utils/build-desc-from-assets";

export function ComUI(): JSX.Element {
  const rem = useRem();

  // layout constants
  const gap = rem(1);
  const sidePad = rem(1);
  const scrollBar = 8;
  const cellSize = rem(12);
  const cols = 5;
  const gridWidth = cols * cellSize + (cols - 1) * gap;

  // state
  const [outfits, setOutfits] = useState<Record<string, PublicOutfit>>({});

  // subscribe + GET full when mount (remo.connect returns a disconnect function)
  useEffect(() => {
    const disconnect = remotes.client.publicOutfitsSync.connect((payload: PublicOutfitsPayload) => {
      const anyPayload = payload as unknown as {
        full?: true;
        data?: Record<string, PublicOutfit>;
        patch?: Record<string, PublicOutfit>;
        remove?: string[];
      };

      setOutfits((prev) => {
        if (anyPayload.full && anyPayload.data) return anyPayload.data;

        const updatedMap: Record<string, PublicOutfit> = { ...prev };

        if (anyPayload.patch) {
          for (const [id, ofit] of pairs(anyPayload.patch)) {
            updatedMap[id as string] = ofit as PublicOutfit;
          }
        }
        if (anyPayload.remove) {
          for (const rid of anyPayload.remove) {
            delete updatedMap[rid as string];
          }
        }
        return updatedMap;
      });
    });

    // yêu cầu full list ngay khi mở tab
    task.defer(() => remotes.server.getPublicOutfits.fire());

    return () => disconnect();
  }, []);

  // order newest first (Luau comparator returns boolean)
  const orderedKeys = useMemo(() => {
    const arr = new Array<string>();
    for (const [k] of pairs(outfits)) arr.push(k as string);
    arr.sort((a, b) => {
      const ta = outfits[a]?.updatedAt ?? 0;
      const tb = outfits[b]?.updatedAt ?? 0;
      return ta > tb;
    });
    return arr;
  }, [outfits]);

  // Build & own HumanoidDescriptions (tạo một lần per render cycle)
  const descMap = useMemo(() => {
    const m = new Map<string, HumanoidDescription>();
    for (const id of orderedKeys) {
      const of = outfits[id];
      if (of) m.set(id, buildDescriptionFromAssets(of.assets));
    }
    return m;
  }, [orderedKeys, outfits]);

  // Cleanup descs khi deps thay đổi / unmount
  useEffect(() => {
    return () => {
      for (const [, d] of descMap) pcall(() => d.Destroy());
    };
  }, [descMap]);

  // UI
  return (
    <scrollingframe
      Size={UDim2.fromOffset(gridWidth + sidePad * 2 + scrollBar, rem(40))}
      AnchorPoint={new Vector2(0.5, 0.5)}
      Position={new UDim2(0.5, 0, 0.5, 0)}
      BackgroundColor3={Color3.fromRGB(38, 38, 39)}
      ScrollBarThickness={scrollBar}
      AutomaticCanvasSize={Enum.AutomaticSize.Y}
    >
      <uicorner CornerRadius={new UDim(0, rem(2))} />
      <uipadding
        PaddingTop={new UDim(0, gap)}
        PaddingLeft={new UDim(0, sidePad)}
        PaddingRight={new UDim(0, sidePad)}
        PaddingBottom={new UDim(0, gap)}
      />
      <uigridlayout
        CellSize={UDim2.fromOffset(cellSize, cellSize)}
        CellPadding={UDim2.fromOffset(gap, gap)}
        FillDirection={Enum.FillDirection.Horizontal}
        SortOrder={Enum.SortOrder.LayoutOrder}
        HorizontalAlignment={"Center"}
        StartCorner={Enum.StartCorner.TopLeft}
      />

      {(() => {
        const children: Record<string, React.Element> = {};

        if (orderedKeys.size() === 0) {
          children["_empty"] = (
            <textlabel
              Size={UDim2.fromOffset(gridWidth, rem(6))}
              BackgroundTransparency={1}
              Text="Chưa có public outfit nào."
              TextSize={rem(2)}
              TextColor3={Color3.fromRGB(200, 200, 200)}
            />
          );
          return children;
        }

        for (let i = 0; i < orderedKeys.size(); i++) {
          const id = orderedKeys[i];
          const desc = descMap.get(id);
          if (!desc) continue;

          children[`pub_${id}`] = (
            <Frame
              layoutOrder={i}
              size={UDim2.fromOffset(cellSize, cellSize)}
              backgroundTransparency={0.75}
              clipsDescendants
            >
              <uicorner CornerRadius={new UDim(0, rem(2))} />
              <CharField size={new UDim2(1, 0, 1, 0)} desc={desc} />
            </Frame>
          );
        }

        return children;
      })()}
    </scrollingframe>
  );
}
  