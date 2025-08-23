// src/client/components/shop/ShopUI.tsx
import React, { useEffect, useState } from "@rbxts/react";
import { useSelector } from "@rbxts/react-reflex";
import { selectIsShopOpen, selectCheckout, selectCheckoutSolo } from "client/store/shop";
import { Frame } from "client/components/ui/frame";
import { Closebutton } from "./closebutton";
import { useMotion, useRem } from "client/hooks";
import { springs } from "client/constants/springs";
import { lerpBinding, useUpdateEffect } from "@rbxts/pretty-react-hooks";
import { Viewportui } from "./displayviewportui";
import { Displayitem } from "./displayitem";
import { Checkincart } from "./checkoutpage";
import { Assetpanel } from "./displaywearasset";

export function ShopUI() {
  const isOpen = useSelector(selectIsShopOpen); // true = UI MỞ
  const checkout = useSelector(selectCheckout);
  const checkoutSolo = useSelector(selectCheckoutSolo);

  const viewportVisible = !checkout || (checkout && !checkoutSolo);
  const displayVisible  = !checkout;
  const cartVisible     = checkout;

  const rem = useRem();

  // QUAN TRỌNG: luôn khởi tạo 0 để mỗi lần mount đều có enter animation
  const [t, api] = useMotion(0);

  // Mount: nếu đang mở, animate vào
  useEffect(() => {
    if (isOpen) api.spring(1, springs.gentle);
  }, []);

  // Update: mở -> 1, đóng -> 0 (để slide-out)
  useUpdateEffect(() => {
    api.spring(isOpen ? 1 : 0, springs.gentle);
  }, [isOpen]);

  // Trì hoãn mount nội dung nặng 1 nhịp để không nghẽn khung hình
  const [contentReady, setContentReady] = useState(false);
  useEffect(() => {
    task.defer(() => setContentReady(true));
    return () => setContentReady(false);
  }, []);

  return (
    <>
      <Closebutton />
      <Frame
        size={new UDim2(0.9, 0, 0.9, 0)}
        anchorPoint={new Vector2(0.5, 0.5)}
        position={lerpBinding(
          t,
          new UDim2(0.5, 0, 1.5, 0), // offscreen dưới
          new UDim2(0.5, 0, 0.5, 0)  // center
        )}
        backgroundColor={Color3.fromRGB(255, 255, 255)}
        cornerRadius={new UDim(0, rem(1))}
        backgroundTransparency={1}
      >
        <uilistlayout Padding={new UDim(0.02, 0)} FillDirection="Horizontal" />

        {/* SLOT #1 */}
        <Frame size={new UDim2(0.3, 0, 1, 0)} visible={viewportVisible} backgroundTransparency={1}>
          <uilistlayout />
          <Viewportui size={new UDim2(1, 0, 1, 0)} />
          <Assetpanel />
        </Frame>

        {/* SLOT #2 */}
        {contentReady && <Displayitem visible={displayVisible} />}

        {/* SLOT #3 */}
        <Checkincart visible={cartVisible} />
      </Frame>
    </>
  );
}
