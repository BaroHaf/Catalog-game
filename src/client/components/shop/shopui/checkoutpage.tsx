// src/client/components/shop/shopui/checkincart.tsx
import React, { useEffect, useState } from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";
import { Text } from "client/components/ui/text";
import { fonts } from "client/constants/fonts";
import { useRem } from "client/hooks";
import { palette } from "shared/constants/palette";
import { remotes } from "shared/remotes";
import { subscribeCart, getCartTotal, getCartItems, removeFromCart } from "./util/savedata";
import { ItemData } from "shared/remotes";
import { ReactiveButtonDiff } from "client/components/ui/reactive-button-animationdiff";
import { Viewportui } from "./displayviewportui";

interface CheckProps {
	visible?: boolean;
}

export function Checkincart({ visible = true }: CheckProps) {
	const rem = useRem();

	const [total, setTotal] = useState(0);
	const [items, setItems] = useState<ItemData[]>([]);
	const [hoveredCheckout, setHoveredCheckout] = useState(false);
	const [hoveredMinusId, setHoveredMinusId] = useState<number | undefined>(undefined);

	// Lấy cart & listen thay đổi
	useEffect(() => {
		setTotal(getCartTotal());
		setItems(getCartItems());

		const unsub = subscribeCart(() => {
			setTotal(getCartTotal());
			setItems(getCartItems());
		});

		return () => unsub();
	}, []);

	const promptBulkPurchase = () => {
		remotes.server.checkoutRequest.fire(); // mở Bulk Purchase
	};

	return (
		<Frame size={new UDim2(1, 0, 1, 0)} backgroundTransparency={1} visible={visible}>
			<uiflexitem FlexMode={"Fill"} />
			<Image image={images.ui.background} size={new UDim2(1, 0, 1, 0)} zIndex={0} />

			{/* Thay viewportframe bằng Frame trống */}
			<Viewportui size={new UDim2(1,0,1,0 )}/>
			{/* ==== LIST ITEM TRONG SCROLLINGFRAME ==== */}
			<scrollingframe
				Size={new UDim2(0, rem(30), 1, 0)}
				BackgroundTransparency={1}
				ScrollBarImageTransparency={1}
				AutomaticCanvasSize={"Y"}
			>
				<uilistlayout Padding={new UDim(0, 6)} SortOrder={"LayoutOrder"} />

				{items.map((it, idx) => {
					const img = it.imageUrl ?? `rbxthumb://type=Asset&id=${it.id}&w=420&h=420`;
					const priceText = typeIs(it.price, "number") ? `${tostring(it.price)} R$` : "—";
					const isMinusHovered = hoveredMinusId === it.id;

					return (
						<Frame
							key={`cart-${it.id}`}
							size={new UDim2(1, 0, 0.2, 0)}
							backgroundTransparency={1}
							cornerRadius={new UDim(0, 8)}
							layoutOrder={idx}
						>
							<uilistlayout FillDirection={"Horizontal"} />
							<Image
								image={img}
								size={new UDim2(0.3, 0, 1, 0)}
								anchorPoint={new Vector2(0, 0)}
								zIndex={2}
								backgroundTransparency={1}
							/>

							<Text
								font={fonts.JosefinSans.bold}
								text={priceText}
								textSize={rem(3.5)}
								textColor={palette.white}
								textXAlignment={"Left"}
								textYAlignment={"Center"}
								size={new UDim2(0, rem(12), 1, 0)}
								anchorPoint={new Vector2(0, 0)}
							/>
							<ReactiveButtonDiff
								position={new UDim2(1, 0, 0.5, 0)}
								anchorPoint={new Vector2(1, 0.5)}
								size={new UDim2(0, rem(7), 0, rem(7))}
								backgroundTransparency={1}
								onHover={(h) => setHoveredMinusId(h ? it.id : undefined)}
								onClick={() => removeFromCart(it.id)}
							>
								<Image
									image={images.ui.minus_icon}
									size={new UDim2(0.7, 0, 0.7, 0)}
									position={new UDim2(0.5, 0, 0.5, 0)}
									anchorPoint={new Vector2(0.5, 0.5)}
									backgroundTransparency={1}
									imageColor={isMinusHovered ? Color3.fromRGB(255, 70, 70) : palette.white}
								/>
							</ReactiveButtonDiff>
						</Frame>
					);
				})}
			</scrollingframe>

			<Text
				font={fonts.JosefinSans.bold}
				position={new UDim2(0.5, 0, 1, 0)}
				size={new UDim2(0, rem(10), 0, rem(8))}
				anchorPoint={new Vector2(0.5, 1)}
				textSize={rem(3)}
				textColor={palette.white}
				text={`Total: ${tostring(total)} R$`}
				textXAlignment={"Center"}
				textYAlignment={"Bottom"}
			/>
			<ReactiveButtonDiff
				size={new UDim2(0, rem(5), 0, rem(5))}
				position={new UDim2(1, 0, 1, 0)}
				anchorPoint={new Vector2(1, 1)}
				backgroundColor={palette.white}
				onClick={promptBulkPurchase}
				onHover={setHoveredCheckout}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				<Image
					image={hoveredCheckout ? images.ui.checkout_alt : images.ui.checkout_icon}
					size={new UDim2(0.8, 0, 0.8, 0)}
					anchorPoint={new Vector2(0.5, 0.5)}
					position={new UDim2(0.5, 0, 0.5, 0)}
				/>
			</ReactiveButtonDiff>
		</Frame>
	);
}
