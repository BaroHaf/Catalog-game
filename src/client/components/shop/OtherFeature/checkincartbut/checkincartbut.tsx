import React from "@rbxts/react";
import { images } from "shared/assets";
import { ReactiveButton } from "client/components/ui/reactive-button";
import { Image } from "client/components/ui/image";
import { useRem, useStore } from "client/hooks";
import { useSelector } from "@rbxts/react-reflex";
import { selectCheckout, selectIsShopOpen, selectCheckoutSolo } from "client/store/shop";

interface Props { visible?: boolean; }

export function Checkincart({ visible = true }: Props) {
  const rem = useRem();
  const store = useStore();

  const checkout     = useSelector(selectCheckout);       // đang bật panel Cart?
  const isOpen       = useSelector(selectIsShopOpen);     // ĐÚNG NGHĨA: true = UI đang mở
  const checkoutSolo = useSelector(selectCheckoutSolo);   // chế độ chỉ-hiện Cart khi mở từ ngoài

  return (
    <ReactiveButton
      size={new UDim2(1, 0, 0, rem(5))}
      backgroundTransparency={0}
      onClick={() => {
        if (!isOpen) {
          // UI đang TẮT -> mở shop với chế độ CART SOLO (Viewport + Cart)
          store.setCheckout(true);
          store.setCheckoutSolo(true);
          store.setShopOpen(true);
          store.setMenuPage("shop");
          return;
        }

        // UI đang MỞ:
        if (checkoutSolo) {
          // Đang ở chế độ Cart Solo -> nhấn lần nữa thì ĐÓNG shop
          store.setShopOpen(false);
          return;
        }

        // Shop đang mở bình thường -> bật/tắt panel Cart (Viewport luôn hiển thị)
        store.setCheckoutSolo(false);
        store.setCheckout(!checkout);
      }}
    >
      <uicorner CornerRadius={new UDim(0, 8)} />
      <Image
        image={images.ui.checkout_cart}
        size={new UDim2(0.7, 0, 0.7, 0)}
        backgroundTransparency={1}
        zIndex={1}
        anchorPoint={new Vector2(0.5, 0.5)}
        position={new UDim2(0.5, 0, 0.5, 0)}
        imageColor={Color3.fromRGB(57, 0, 245)}
      />
    </ReactiveButton>
  );
}
