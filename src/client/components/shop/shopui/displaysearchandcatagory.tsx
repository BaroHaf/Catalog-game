import React, { useState } from "@rbxts/react";
import { palette } from "shared/constants/palette";
import { Frame } from "client/components/ui/frame";
import { Image } from "client/components/ui/image";
import { TextField } from "client/components/ui/text-field";
import { useRem } from "client/hooks";
import { images } from "shared/assets";
import { fonts } from "client/constants/fonts";
import { CATEGORIES } from "../../../../shared/constants/constant";
import { useRef, useEffect } from "@rbxts/react";
import { selectPage } from "client/store/shop";
import { useStore } from "client/hooks";
import { useSelector } from "@rbxts/react-reflex";
import { Button } from "client/components/ui/button";
import type { SubPageFilterType } from "client/store/shop/shop-slice";

export function Displaysearch() {
	const rem = useRem();
	const scrollRef = useRef<ScrollingFrame>();
	const page = useSelector(selectPage);
	const [keyword, setKeyword] = useState("");
	const store = useStore();
	useEffect(() => {
		const scroll = scrollRef.current;
		if (scroll) {
			const buttonWidth = rem(14);
			const padding = rem(1.5);
			const totalWidth = CATEGORIES.size() * (buttonWidth + padding);
			scroll.CanvasSize = new UDim2(0, totalWidth, 0, 0);
		}
	}, []);

	return (
		<Frame
			size={new UDim2(1, 0, 0, rem(5))}
			backgroundColor={palette.white}
			backgroundTransparency={1}
			clipsDescendants={true}
		>
			<Image
				image={images.ui.search_icon}
				imageColor={Color3.fromRGB(163, 162, 165)}
				imageTransparency={0.5}
				size={new UDim2(0, rem(5), 0, rem(5))}
				position={new UDim2(0, 0, 0, 0)}
				layoutOrder={0}
			/>
			<uilistlayout FillDirection={"Horizontal"} />
			<Frame size={new UDim2(1, 0, 1, 0)} backgroundTransparency={0} backgroundColor={Color3.fromRGB(68, 66, 66)}>
				<uicorner CornerRadius={new UDim(0, 15)} />
				<uiflexitem FlexMode={"Fill"} />
				<TextField
					text={keyword}
					clearTextOnFocus={false}
					placeholderText="Search..."
					placeholderColor={palette.black.Lerp(palette.white, 0.6)}
					textColor={palette.white}
					textSize={rem(3)}
					font={fonts.JosefinSans.regular}
					backgroundTransparency={1}
					size={new UDim2(1, 0, 1, 0)}
					textXAlignment="Center"
					layoutOrder={1}
					event={{
						FocusLost: (_rbx, enterPressed) => {
							if (enterPressed) {
								store.setKeyword(keyword);
							}
						},
					}}
					change={{
						Text: (rbx: TextBox) => setKeyword(rbx.Text),
					}}
				/>
			</Frame>

			<Frame size={new UDim2(0.6, 0, 1, 0)} backgroundTransparency={1} layoutOrder={2}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					SortOrder={Enum.SortOrder.LayoutOrder}
					HorizontalAlignment={Enum.HorizontalAlignment.Left}
				/>

				{/* 📌 Main category - nằm trên */}
				<Frame size={new UDim2(1, 0, 0.6, 0)} backgroundTransparency={1} layoutOrder={0}>
					<scrollingframe
						ref={scrollRef}
						Size={new UDim2(1, 0, 1, 0)}
						CanvasSize={new UDim2(0, 0, 0, 0)}
						ScrollBarThickness={0}
						ScrollingDirection={Enum.ScrollingDirection.X}
						BackgroundTransparency={1}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							Padding={new UDim(0, rem(1.5))}
							SortOrder={Enum.SortOrder.LayoutOrder}
							VerticalAlignment={Enum.VerticalAlignment.Center}
						/>
						{CATEGORIES.map((category) => (
							<Button
								key={category.name}
								size={new UDim2(0, rem(14), 0, rem(5.2))}
								backgroundTransparency={1}
								onClick={() => {
									store.setPage(category.name);
									store.setKeyword("");
								}}
							>
								<textlabel
									Size={UDim2.fromScale(1, 1)}
									BackgroundTransparency={1}
									Text={category.name}
									TextSize={rem(2)}
									TextColor3={palette.white}
									FontFace={fonts.JosefinSans.regular}
									TextXAlignment={Enum.TextXAlignment.Center}
									TextYAlignment={Enum.TextYAlignment.Center}
								/>
							</Button>
						))}
					</scrollingframe>
				</Frame>

				{/* 📌 Subcategory - nằm dưới nếu có */}
				<Frame
					size={new UDim2(1, 0, 0.4, 0)}
					backgroundTransparency={1}
					layoutOrder={1}
					visible={CATEGORIES.find((cat) => cat.name === page)?.children !== undefined}
				>
					<scrollingframe
						Size={new UDim2(1, 0, 1, 0)}
						CanvasSize={new UDim2(0, 0, 0, 0)}
						AutomaticCanvasSize="X"
						ScrollBarThickness={0}
						ScrollingDirection={Enum.ScrollingDirection.X}
						BackgroundTransparency={1}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							Padding={new UDim(0, rem(1.5))}
							SortOrder={Enum.SortOrder.LayoutOrder}
							VerticalAlignment={Enum.VerticalAlignment.Center}
						/>

						{CATEGORIES.find((cat) => cat.name === page)?.children?.map((child) => (
							<Button
								key={`${page}-${child.name}`}
								size={new UDim2(0, rem(14), 0, rem(5.5))}
								backgroundTransparency={1} // đổi theo style bạn muốn
								backgroundColor={palette.white} // hoặc để transparent như bên category
								onClick={() => {
									store.setKeyword("");
									if (child.name === "All") {
										store.setSubpage({ filterType: "", value: "" });
									} else {
										store.setSubpage({
											filterType: (child.filterType ?? "") as SubPageFilterType,
											value: (child.filterValue as string) ?? "", // KHÔNG tostring()
										});
									}
								}}
							>
								<textlabel
									Size={UDim2.fromScale(1, 1)}
									BackgroundTransparency={1}
									Text={child.name}
									TextSize={rem(1.5)}
									TextColor3={palette.white}
									FontFace={fonts.JosefinSans.regular}
									TextXAlignment={Enum.TextXAlignment.Center}
									TextYAlignment={Enum.TextYAlignment.Center}
								/>
							</Button>
						))}
					</scrollingframe>
				</Frame>
			</Frame>
		</Frame>
	);
}
