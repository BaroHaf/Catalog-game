import React from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem } from "client/hooks";
import { Button } from "client/components/ui/button";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";
import { remotes, BodyColorsData, RGB } from "shared/remotes";
import { getCurrentHumanoidAssets } from "client/components/shop/shopui/util/camerarotation";
import { Players } from "@rbxts/services";

function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function c3ToRgb255(c: Color3): RGB {
	const r = math.floor(clamp01(c.R) * 255 + 0.5);
	const g = math.floor(clamp01(c.G) * 255 + 0.5);
	const b = math.floor(clamp01(c.B) * 255 + 0.5);
	return [r, g, b];
}
function collectBodyColorsFromDesc(d: HumanoidDescription): BodyColorsData {
	return {
		head: c3ToRgb255(d.HeadColor),
		torso: c3ToRgb255(d.TorsoColor),
		leftArm: c3ToRgb255(d.LeftArmColor),
		rightArm: c3ToRgb255(d.RightArmColor),
		leftLeg: c3ToRgb255(d.LeftLegColor),
		rightLeg: c3ToRgb255(d.RightLegColor),
	};
}

function collectAssetIdsFromDesc(d: HumanoidDescription): number[] {
	const out = new Array<number>();
	const clothKeys = ["Shirt","Pants","GraphicTShirt","Face"] as const;
	for (let i = 0; i < clothKeys.size(); i++) {
		const k = clothKeys[i] as string;
		const v = (d as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "number" && (v as number) > 0) out.push(v as number);
	}
	const accKeys = ["HatAccessory","HairAccessory","FaceAccessory","NeckAccessory",
		"ShouldersAccessory","FrontAccessory","BackAccessory","WaistAccessory",] as const;
	for (let i = 0; i < accKeys.size(); i++) {
		const k = accKeys[i] as string;
		const v = (d as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "string" && (v as string) !== "") {
			for (const raw of (v as string).split(",")) {
				const n = tonumber(raw);
				if (n && n > 0) out.push(n);
			}
		}
	}
	const seen = new Map<number, true>(); const uniq = new Array<number>();
	for (let i = 0; i < out.size(); i++) { const id = out[i]; if (!seen.get(id)) { seen.set(id, true as true); uniq.push(id); } }
	return uniq;
}

export function Savebuttonui() {
	const rem = useRem();

	function saveNow() {
		const lp = Players.LocalPlayer!;
		const fromViewport = getCurrentHumanoidAssets().map(a => a.id);
		let assets = fromViewport;

		let colors: BodyColorsData | undefined;
		const hum = lp.Character?.FindFirstChildOfClass("Humanoid");
		if (hum) {
			const applied = hum.GetAppliedDescription();
			if (assets.size() === 0) assets = collectAssetIdsFromDesc(applied);
			colors = collectBodyColorsFromDesc(applied);
		} else {
			const base = Players.GetHumanoidDescriptionFromUserId(lp.UserId);
			if (assets.size() === 0) assets = collectAssetIdsFromDesc(base);
			colors = collectBodyColorsFromDesc(base);
		}

		const name = `preset-${tostring(os.time())}`;
		print(`[Savebuttonui] colors head=${colors?.head?.join(",")} torso=${colors?.torso?.join(",")}`);
		remotes.server.postOutfit.fire(name, assets, undefined, colors);
		print("[Savebuttonui] save request:", name, "count:", assets.size());
	}

	return (
		<Frame size={new UDim2(0, rem(50), 0, rem(40))}
			anchorPoint={new Vector2(0.5, 0.5)} position={new UDim2(0.5, 0, 0.5, 0)} backgroundTransparency={0.2}>
			<uicorner />
			<Button size={new UDim2(0, rem(14), 0, rem(6))}
				anchorPoint={new Vector2(0.5, 0.5)} position={new UDim2(0.5, 0, 0.5, 0)} onClick={saveNow}>
				<Image image={images.ui.plus_icon} size={new UDim2(0, rem(4), 0, rem(4))}
					anchorPoint={new Vector2(0.5, 0.5)} position={new UDim2(0.5, 0, 0.5, 0)} />
			</Button>
		</Frame>
	);
}
