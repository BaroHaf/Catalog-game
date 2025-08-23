import React from "@rbxts/react";
import { useSelector } from "@rbxts/react-reflex";
import { CartUI } from "./toogle";
import { ShopContainer } from "./shop-container";
import { ShopUI } from "./shopui";
import { Otherfeature } from "./OtherFeature";
import { selectIsShopOpen, selectMenuPage } from "client/store/shop"; // 👈 thêm
import { Saveui } from "./shopui/saveui";
// import { Saveui } from "./shopui/saveui"; // (nếu không dùng, xoá import này)

export function Shop() {
  const isOpen = useSelector(selectIsShopOpen);
  const menuPage = useSelector(selectMenuPage); // 👈 đọc trang hiện tại
  print("isOpen:", isOpen, "menuPage:", menuPage);

  return (
    <>
      {/* Ẩn khi mở và đang ở trang 'shop' */}
      {!(isOpen && menuPage === "shop") && <CartUI />}

      <ShopContainer page="shop" unmountDelay={0.5}>
        <ShopUI />
      </ShopContainer >
	  <ShopContainer page="community" unmountDelay={0.5}>
		<Saveui/>
	  </ShopContainer>

      <Otherfeature />
    </>
  );
}
