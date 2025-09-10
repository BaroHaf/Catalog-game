import React from "@rbxts/react";
import { images } from "shared/assets";
import { ReactiveButton } from "client/components/ui/reactive-button";
import { Image } from "client/components/ui/image";
import { useRem, useStore } from "client/hooks";
import { resetToProfileOutfit } from "client/components/shop/shopui/util/camerarotation"; // ⬅️ import

interface Props {
	visible?: boolean;
}

export function ResetBut({ visible = true }: Props) {
	const rem = useRem();
	const store = useStore();

	return (
		<ReactiveButton
			size={new UDim2(1, 0, 0, rem(5))}
			backgroundTransparency={0}
			onClick={() => {
				resetToProfileOutfit(true); // ⬅️ gọi ở đây
			}}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<Image
				image={images.ui.reset_icon}
				size={new UDim2(0.7, 0, 0.7, 0)}
				backgroundTransparency={1}
				zIndex={1}
				anchorPoint={new Vector2(0.5, 0.5)}
				position={new UDim2(0.5, 0, 0.5, 0)}
				imageColor={Color3.fromRGB(0, 0, 0)}
			/>
		</ReactiveButton>
	);
}
