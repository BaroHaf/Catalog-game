import React, { useEffect, useState } from "@rbxts/react";
import { useRem } from "client/hooks";
import { Itemremove } from "client/components/ui/Item-remove";
import {
	getCurrentHumanoidAssets,
	onAssetsChanged,
	getWornAssetTypeForId, // 👈 thay thế resolveAssetTypeOf
	type SimpleAssetInfo,
} from "./util/camerarotation";

export function Assetpanel() {
	const rem = useRem();
	const [assets, setAssets] = useState<SimpleAssetInfo[]>(() => getCurrentHumanoidAssets());

	useEffect(() => {
		const conn = onAssetsChanged(() => setAssets(getCurrentHumanoidAssets()));
		return () => conn.Disconnect();
	}, []);

	return (
		<scrollingframe
			Size={new UDim2(1, 0, 0, rem(11))}
			AutomaticSize={Enum.AutomaticSize.None}
			AutomaticCanvasSize={Enum.AutomaticSize.X}
			ScrollingDirection={Enum.ScrollingDirection.X}
			BackgroundTransparency={0}
			BackgroundColor3={Color3.fromRGB(38, 38, 39)}
			ScrollBarThickness={0}
			ScrollBarImageTransparency={1}
			ClipsDescendants
		>
			<uicorner CornerRadius={new UDim(0, rem(1))} />
			<uipadding
				PaddingTop={new UDim(0, rem(0.9))}
				PaddingBottom={new UDim(0, rem(0.9))}
				PaddingLeft={new UDim(0, rem(0.9))}
			/>
			<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, rem(0.8))} />

			{assets.map((a, i) => (
				<Itemremove key={`asset-${a.id}-${i}`} asset={a} index={i} />
			))}
		</scrollingframe>
	);
}
