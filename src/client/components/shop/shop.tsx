import React from "@rbxts/react";
import { useSelector } from "@rbxts/react-reflex";
import { CartUI } from "./toogle";
import { ShopContainer } from "./shop-container";
import { ShopUI } from "./shopui";
import { Otherfeature } from "./OtherFeature";
import { selectIsShopOpen, selectMenuPage } from "client/store/shop";
import { SaveUI } from "./saveui/saveui";
import { Savebuttonui } from "./saveui/savebuttons";
import { ComUI } from "./saveui/comui";

export function Shop() {
  const isOpen = useSelector(selectIsShopOpen);
  const menuPage = useSelector(selectMenuPage);

  const showShop   = menuPage === "shop";    // 👈 chỉ mount khi đúng page
  const mountSaveUI = isOpen && menuPage === "saveui";
  const mountComUI = isOpen && menuPage === "community";

  return (
    <>
      {!(isOpen && showShop) && <CartUI />}

      {showShop && (
        <ShopContainer page="shop" unmountDelay={0.35}>
          <ShopUI />
        </ShopContainer>
      )}

      {mountSaveUI && (
        <ShopContainer page="saveui">
          <SaveUI />
        </ShopContainer>
      )}
      {mountComUI && (
        <ShopContainer page="community">
          <ComUI />
        </ShopContainer>
      )}
      {!isOpen && menuPage === "saveui" && <Savebuttonui />}

      <Otherfeature />
    </>
  );
}
