// src/client/components/shop/toogle.tsx (giữ tên file của bạn)
import React, { Binding } from "@rbxts/react";
import { useSelector } from "@rbxts/react-reflex";
import { selectIsShopOpen } from "client/store/shop";
import { useMotion, useRem, useStore } from "client/hooks";
import { images } from "shared/assets";
import { palette } from "shared/constants/palette";
import { useButtonState } from "client/components/ui/reactive-button/use-button-state";
import { lerpBinding, useUpdateEffect } from "@rbxts/pretty-react-hooks";
import { Frame } from "client/components/ui/frame";
import { Image } from "client/components/ui/image";
import { Text } from "client/components/ui/text";
import { Button } from "client/components/ui/button";
import { fonts } from "client/constants/fonts";
import { selectMenuPage } from "client/store/shop";
function UIScale({ scale }: { scale: Binding<number> }) {
	return <uiscale Scale={scale} />;
}

export function CartUI() {
	const rem = useRem();
	const store = useStore();
	const isOpen = useSelector(selectIsShopOpen); // đúng nghĩa: true = UI đang mở
	const menuPage = useSelector(selectMenuPage);

	const isOpenOnShop = isOpen && menuPage === "shop";

	const [press, hover, buttonEvents] = useButtonState();
	const [motion, motionApi] = useMotion(0);
	const [scaleMotion, scaleApi] = useMotion(1);
	const [imageColorMotion, imageColorApi] = useMotion<Color3>(palette.pink);

	useUpdateEffect(() => {
		motionApi.spring(hover ? 1 : 0, { tension: 300 });
		imageColorApi.spring(hover ? palette.purple : palette.pink);
	}, [hover]);

	useUpdateEffect(() => {
		if (press) {
			scaleApi.spring(1.25, { tension: 700, friction: 8 });
			task.delay(0.12, () => scaleApi.spring(1, { tension: 400, friction: 20 }));
		}
	}, [press]);

	const baseSize = rem(6);
	const expandedSize = rem(14);

	return (
		<Button
			backgroundTransparency={1}
			onMouseEnter={buttonEvents.onMouseEnter}
			onMouseLeave={buttonEvents.onMouseLeave}
			onMouseDown={buttonEvents.onMouseDown}
			onMouseUp={buttonEvents.onMouseUp}
			onClick={() => {
				if (isOpenOnShop) {
					// Đang mở đúng trang shop -> đóng
					store.setCheckout(false);
					store.setCheckoutSolo(false);
					store.setShopOpen(false);
				} else {
					// Đang đóng, hoặc đang mở nhưng ở trang khác -> chuyển sang shop & mở
					store.setMenuPage("shop"); // ĐẶT TRANG TRƯỚC
					store.setCheckout(false);
					store.setCheckoutSolo(false);
					store.setShopOpen(true); // RỒI MỚI MỞ
				}
			}}
			size={lerpBinding(motion, new UDim2(0, baseSize, 0, baseSize), new UDim2(0, expandedSize, 0, baseSize))}
			position={new UDim2(0.5, 0, 0, 0)}
			anchorPoint={new Vector2(0.5, 0)}
		>
			<Frame
				backgroundColor={palette.white}
				size={new UDim2(1, 0, 1, 0)}
				cornerRadius={new UDim(0, 8)}
				clipsDescendants
				anchorPoint={new Vector2(0.5, 0.5)}
				position={new UDim2(0.5, 0, 0.5, 0)}
			>
				<UIScale scale={scaleMotion} />
				<uipadding PaddingLeft={new UDim(0, rem(1))} PaddingRight={new UDim(0, rem(1))} />
				<uilistlayout
					FillDirection="Horizontal"
					HorizontalAlignment="Left"
					VerticalAlignment="Center"
					Padding={new UDim(0, rem(1))}
				/>
				<Image
					image={images.ui.market_icon}
					imageColor={imageColorMotion}
					size={new UDim2(0, rem(4), 0, rem(4))}
				/>
				<Text
					text="Shop"
					textColor={Color3.fromRGB(0, 0, 0)}
					textSize={rem(2.6)}
					font={fonts.robotoMono.regular}
					textXAlignment="Left"
					size={new UDim2(1, 0, 1, 0)}
					textTransparency={lerpBinding(motion, 1, 0)}
				/>
			</Frame>
		</Button>
	);
}
