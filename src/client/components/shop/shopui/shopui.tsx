import React, { useEffect } from "@rbxts/react";
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
import { Lighting } from "@rbxts/services";

const BLUR_NAME = "ShopBlur"; // đặt trùng với cái bạn đã tạo sẵn

export function ShopUI() {
	const isOpen = useSelector(selectIsShopOpen);
	const checkout = useSelector(selectCheckout);
	const checkoutSolo = useSelector(selectCheckoutSolo);

	const viewportVisible = !checkout || (checkout && !checkoutSolo);
	const displayVisible = !checkout;
	const cartVisible = checkout;

	const rem = useRem();
	const [t, api] = useMotion(0);

	useEffect(() => {
		if (isOpen) api.spring(1, springs.gentle);
	}, []);
	useUpdateEffect(() => {
		api.spring(isOpen ? 1 : 0, springs.gentle);
	}, [isOpen]);

	// Bật/tắt blur theo trạng thái shop
	useEffect(() => {
		let blur = Lighting.FindFirstChild(BLUR_NAME) as BlurEffect;
		if (!blur) {
			blur = new Instance("BlurEffect");
			blur.Name = BLUR_NAME;
			blur.Parent = Lighting;
		}
		blur.Enabled = isOpen;

		// cleanup đảm bảo tắt blur khi ShopUI unmount
		return () => {
			if (blur?.Parent === Lighting) blur.Enabled = false;
		};
	}, [isOpen]);

	return (
		<>
			<Closebutton />
			<Frame
				size={new UDim2(0.9, 0, 0.9, 0)}
				anchorPoint={new Vector2(0.5, 0.5)}
				position={lerpBinding(t, new UDim2(0.5, 0, 1.5, 0), new UDim2(0.5, 0, 0.5, 0))}
				cornerRadius={new UDim(0, rem(1))}
				backgroundTransparency={1}
			>
				<uilistlayout Padding={new UDim(0.02, 0)} FillDirection="Horizontal" />

				<Frame size={new UDim2(0.3, 0, 1, 0)} visible={viewportVisible} backgroundTransparency={1}>
					<uilistlayout />
					<Viewportui size={new UDim2(1, 0, 1, 0)} />
					<Assetpanel />
				</Frame>

				<Displayitem visible={displayVisible} />
				<Checkincart visible={cartVisible} />
			</Frame>
		</>
	);
}
