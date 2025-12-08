import React, { useEffect } from "@rbxts/react";
import { palette } from "shared/constants/palette";
import { useRem } from "client/hooks";
import { fonts } from "client/constants/fonts";
import { Text } from "client/components/ui/text";
import { Frame } from "client/components/ui/frame";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";
import { Button } from "client/components/ui/button";
import { useMotion } from "@rbxts/pretty-react-hooks";
import { DisplayOptions } from "./displayoptions";

interface Props {
	id: number;
	name: string;
	price: number;
	imageUrl: string;
	creator: string;
	assetType: Enum.AvatarAssetType;
	bundleType?: Enum.BundleType; // 🔹 dùng để báo xuống DisplayOptions đây là bundle Animations
	LayoutOrder: number;
	cellW: number;
	index: number;
	open: boolean;
	onToggleOpen: () => void;
}

export function ItemField({
	id,
	name,
	price,
	imageUrl,
	assetType,
	bundleType, // 🔹 nhận prop mới
	LayoutOrder,
	cellW,
	index,
	open,
	onToggleOpen,
}: Props) {
	const rem = useRem();

	// Typography
	const clamp = (v: number, lo: number, hi: number) => math.clamp(v, lo, hi);
	const titleSize = clamp(math.floor(cellW * 0.095), 9, 14);
	const titleTwoLinesH = math.floor(titleSize * 2.05);
	const priceSize = clamp(math.floor(cellW * 0.14), 12, 20);
	const priceRowH = math.floor(priceSize * 1.32);

	// Motion
	const startYOffset = rem(2.2);
	const overshootUp = -rem(0.5);
	const STAGGER = 0.07;
	const MAX_DELAY = 0.6;
	const SPRING_IN_1 = { tension: 220, friction: 16, mass: 1 };
	const SPRING_IN_2 = { tension: 180, friction: 20, mass: 1 };
	const FADE_SPRING = { tension: 160, friction: 22, mass: 1 };

	const [y, yMotion] = useMotion(startYOffset);
	const [alpha, alphaMotion] = useMotion(1);

	useEffect(() => {
		const delay = math.min(index * STAGGER, MAX_DELAY);
		task.delay(delay, () => {
			yMotion.spring(overshootUp, SPRING_IN_1);
			alphaMotion.spring(0, FADE_SPRING);
			task.delay(0.09, () => yMotion.spring(0, SPRING_IN_2));
		});
	}, [index, cellW]);

	const fade = alpha.map((a: number) => math.clamp(a, 0, 1));
	const yPos = y.map((v: number) => new UDim2(0, 0, 0, v));
	const bgTrans = fade.map((f: number) => math.clamp(0.7 + f * 0.3, 0, 1));

	return (
		<Frame size={new UDim2(1, 0, 1, 0)} backgroundTransparency={1} layoutOrder={LayoutOrder}>
			<Button size={new UDim2(1, 0, 1, 0)} backgroundTransparency={1} active zIndex={1} onClick={onToggleOpen} />

			{/* Content */}
			<Frame size={new UDim2(1, 0, 1, 0)} backgroundTransparency={1} position={yPos} zIndex={3}>
				<uilistlayout Padding={new UDim(0, rem(0.8))} SortOrder="LayoutOrder" />

				<Frame
					layoutOrder={0}
					size={new UDim2(1, 0, 0, cellW)}
					backgroundTransparency={bgTrans}
					backgroundColor={Color3.fromRGB(112, 112, 112)}
					clipsDescendants
				>
					<uicorner CornerRadius={new UDim(0, 10)} />

					<imagelabel
						Image={imageUrl}
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={new UDim2(0.5, 0, 0.5, 0)}
						Size={UDim2.fromScale(0.8, 0.8)}
						BackgroundTransparency={1}
						ImageTransparency={fade}
						ScaleType="Fit"
					/>

					{/* Overlay options */}
					<DisplayOptions
						open={open}
						assetType={assetType}
						assetId={id}
						assetName={name}
						cellW={cellW}
						bundleType={bundleType} // 🔹 truyền xuống để DisplayOptions nhận biết bundle Animations
					/>
				</Frame>

				{/* Name */}
				<Text
					text={name}
					size={new UDim2(1, -rem(1.2), 0, titleTwoLinesH)}
					backgroundTransparency={1}
					textWrapped
					textTruncate="AtEnd"
					textXAlignment="Left"
					textYAlignment="Top"
					font={fonts.JosefinSans.regular}
					textColor={palette.white}
					textSize={titleSize}
					textTransparency={fade}
					layoutOrder={1}
				/>

				{/* Price */}
				<Frame layoutOrder={2} size={new UDim2(1, 0, 0, priceRowH)} backgroundTransparency={1}>
					<uilistlayout FillDirection="Horizontal" Padding={new UDim(0, rem(0.4))} />
					<Image
						image={images.ui.robuxicon}
						size={new UDim2(0, math.floor(priceSize * 1.05), 0, math.floor(priceSize * 1.05))}
						imageColor={Color3.fromRGB(180, 180, 180)}
						imageTransparency={fade}
					/>
					<Text
						text={`${price}`}
						textColor={Color3.fromRGB(210, 210, 210)}
						font={fonts.JosefinSans.bold}
						textSize={priceSize}
						size={new UDim2(0, priceSize * 2.5, 0, priceRowH)}
						textXAlignment="Left"
						textTransparency={fade}
						layoutOrder={1}
					/>
				</Frame>

				<Frame layoutOrder={3} size={new UDim2(1, 0, 0, rem(0.5))} backgroundTransparency={1} />
			</Frame>
		</Frame>
	);
}
