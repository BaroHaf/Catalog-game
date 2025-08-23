// src/client/components/shop/ShopContainer.tsx
import React from "@rbxts/react";
import { useSelector } from "@rbxts/react-reflex";
import { DelayRender } from "client/components/ui/delay-render";
import { selectIsShopOpen, selectMenuPage } from "client/store/shop";
import { MenuPage } from "client/store/shop";

interface ShopContainerProps extends React.PropsWithChildren {
  readonly page?: MenuPage;       // "shop" | "community" | ...
  readonly unmountDelay?: number; // optional, mặc định 0
}

export function ShopContainer({ page, children, unmountDelay = 0 }: ShopContainerProps) {
  const isOpen = useSelector(selectIsShopOpen);
  const current = useSelector(selectMenuPage);

  const visible = isOpen && (page === undefined || current === page);

  return (
    <DelayRender shouldRender={visible} unmountDelay={unmountDelay}>
      {children}
    </DelayRender>
  );
}
