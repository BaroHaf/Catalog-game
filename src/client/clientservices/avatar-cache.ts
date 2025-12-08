// src/client/clientservices/avatar-cache.ts
import { Players } from "@rbxts/services";
import {
	getCurrentHumanoidAssetsFromDesc,
	type SimpleAssetInfo,
} from "client/components/shop/shopui/util/camerarotation";

let initialAssets: SimpleAssetInfo[] = [];
let initialized = false;

export function initAvatarCache() {
	if (initialized) return;
	initialized = true;

	const lp = Players.LocalPlayer;
	if (!lp) return;

	task.spawn(() => {
		const [ok, result] = pcall(() => {
			return Players.GetHumanoidDescriptionFromUserId(lp.UserId);
		});

		if (!ok || !result) {
			warn("Failed to load HumanoidDescription from userId");
			initialAssets = [];
			return;
		}

		const desc = result as HumanoidDescription;
		initialAssets = getCurrentHumanoidAssetsFromDesc(desc, false);
	});
}

export function getInitialAvatarAssets() {
	return initialAssets;
}
