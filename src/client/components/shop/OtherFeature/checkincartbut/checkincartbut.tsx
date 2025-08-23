import React from "@rbxts/react";
import { images } from "shared/assets";
import { ReactiveButton } from "client/components/ui/reactive-button";
import { Image } from "client/components/ui/image";
import { useRem, useStore } from "client/hooks";
import { useSelector } from "@rbxts/react-reflex";
import { selectCheckout, selectIsShopOpen, selectCheckoutSolo } from "client/store/shop";
interface Props {
	visible?: boolean;
}

export function Checkincart({ visible = true }: Props) {
	const rem = useRem();
	const store = useStore();
	const checkout = useSelector(selectCheckout);
	const isClosed = useSelector(selectIsShopOpen);
	const checkoutSolo = useSelector(selectCheckoutSolo);

	return (
		<ReactiveButton
			size={new UDim2(1, 0, 0, rem(5))}
			backgroundTransparency={0}
			// Checkincart.tsx — chỉ thay onClick
			onClick={() => {
				if (isClosed) {
					// UI đang TẮT → mở CART ở chế độ SOLO (chỉ CartPage)
					store.setCheckout(true);
					store.setCheckoutSolo(true);
					store.setShopOpen(false); // false = UI BẬT
					return;
				}

				if (checkout && checkoutSolo) {
					// Đang CART SOLO → chỉ ĐÓNG SHOP, KHÔNG đụng tới 2 cờ checkout
					// => Không có tick trung gian nhảy sang Viewport+Display
					store.setShopOpen(true); // true = UI TẮT
					return;
				}

				// Shop đang mở bình thường → toggle giữa Viewport+Display (checkout=false)
				// và Viewport+Cart (checkout=true). Luôn KHÔNG SOLO khi shop đang mở.
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
