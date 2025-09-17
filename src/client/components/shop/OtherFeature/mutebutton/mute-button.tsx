import React from "@rbxts/react";
import { useSelector } from "@rbxts/react-reflex";
import { Text } from "client/components/ui/text";
import { fonts } from "client/constants/fonts";
import { ReactiveButton } from "client/components/ui/reactive-button";
import { useRem, useStore } from "client/hooks";
import { selectMusicEnabled } from "client/store/shop";

export function MuteButton() {
	const rem = useRem();
	const store = useStore();
	const musicEnabled = useSelector(selectMusicEnabled);

	return (
		<ReactiveButton
			size={new UDim2(1, 0, 0, rem(5))}
			backgroundTransparency={0}
			onClick={() => store.setMenuMusic(!musicEnabled)}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />

			<Text
				font={fonts.inter.medium}
				text={musicEnabled ? "🔊" : "🔇"}
				textSize={rem(2)}
				size={new UDim2(1, 0, 1, 0)}
			/>
		</ReactiveButton>
	);
}
