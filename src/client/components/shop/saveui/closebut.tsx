import React, { useState } from "@rbxts/react";
import { ReactiveButtonDiff } from "client/components/ui/reactive-button-animationdiff";
import { useRem, useStore } from "client/hooks";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";

export function Closebutsaveui() {
  const rem = useRem();
  const store = useStore();
  const [hovered, setHovered] = useState(false);

  return (
    <ReactiveButtonDiff
      size={new UDim2(0, rem(5), 0, rem(5))}
      position={new UDim2(0, 0, 1, 0)}
      anchorPoint={new Vector2(1, 1)}
      backgroundTransparency={1}
      onHover={setHovered}
      onClick={() => {
        // HARD CLOSE: reset page về "shop", rồi đóng
        store.setMenuPage("shop");
        store.setShopOpen(false);
      }}
    >
      <Image
        image={images.ui.cancel_icon}
        size={new UDim2(1, 0, 1, 0)}
        backgroundTransparency={1}
        imageColor={hovered ? Color3.fromRGB(255, 0, 0) : Color3.fromRGB(255, 255, 255)}
      />
    </ReactiveButtonDiff>
  );
}
