import React from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem } from "client/hooks";
import { Button } from "client/components/ui/button";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";
import { remotes, BodyColorsData, RGB, ScalesData } from "shared/remotes";
import { getCurrentHumanoidAssets } from "client/components/shop/shopui/util/camerarotation";
import { Players, MarketplaceService } from "@rbxts/services";

/* ================= helpers ================= */
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
function collectScalesFromDesc(d: HumanoidDescription): ScalesData {
	return {
		HeightScale: d.HeightScale,
		WidthScale: d.WidthScale,
		DepthScale: d.DepthScale,
		HeadScale: d.HeadScale,
		BodyTypeScale: d.BodyTypeScale,
		ProportionScale: d.ProportionScale,
	};
}

/** ---- Asset type helpers ---- */
const typeCache = new Map<number, number>(); // assetId -> AssetTypeId
function readAssetTypeId(id: number): number | undefined {
	const cached = typeCache.get(id);
	if (cached !== undefined) return cached;

	const [ok, infoRaw] = pcall(() => MarketplaceService.GetProductInfo(id));
	if (!ok || typeOf(infoRaw) !== "table") return undefined;
	const info = infoRaw as { AssetTypeId?: number };
	if (!info.AssetTypeId) return undefined;

	typeCache.set(id, info.AssetTypeId);
	return info.AssetTypeId;
}
function isValidAvatarAsset(id: number): boolean {
	const typeId = readAssetTypeId(id);
	if (!typeId) return false;
	return Enum.AvatarAssetType.GetEnumItems().some((t) => t.Value === typeId);
}
function isLayeredTypeId(typeId: number): boolean {
	const L = Enum.AvatarAssetType;
	// Các loại layered clothing phổ biến
	return (
		typeId === L.JacketAccessory.Value ||
		typeId === L.ShirtAccessory.Value ||
		typeId === L.SweaterAccessory.Value ||
		typeId === L.TShirtAccessory.Value ||
		typeId === L.PantsAccessory.Value ||
		typeId === L.ShortsAccessory.Value ||
		typeId === L.DressSkirtAccessory.Value
	);
}

/** Lấy classic ids (Shirt/Pants/TShirt/Face + 8 CSV accessories) */
function collectClassicAssetIdsFromDesc(d: HumanoidDescription): number[] {
	const out: number[] = [];

	// single id
	if (d.Shirt > 0 && isValidAvatarAsset(d.Shirt)) out.push(d.Shirt);
	if (d.Pants > 0 && isValidAvatarAsset(d.Pants)) out.push(d.Pants);
	if (d.GraphicTShirt > 0 && isValidAvatarAsset(d.GraphicTShirt)) out.push(d.GraphicTShirt);
	if (d.Face > 0 && isValidAvatarAsset(d.Face)) out.push(d.Face);

	// csv accessories
	const csvList = [
		d.HatAccessory, d.HairAccessory, d.FaceAccessory, d.NeckAccessory,
		d.ShouldersAccessory, d.FrontAccessory, d.BackAccessory, d.WaistAccessory,
	] as const;

	for (const csv of csvList) {
		if (csv && csv !== "") {
			for (const raw of csv.split(",")) {
				const n = tonumber(raw);
				if (n && n > 0 && isValidAvatarAsset(n)) out.push(n);
			}
		}
	}
	return out;
}

/** Lấy layered clothing ids qua GetAccessories(true) và lọc đúng *layered types* */
function collectLayeredAssetIdsFromDesc(d: HumanoidDescription): number[] {
	const out: number[] = [];
	const arr = d.GetAccessories(true) as Array<{ AssetId?: number }>;
	for (const a of arr) {
		const id = a.AssetId;
		if (typeOf(id) === "number" && (id as number) > 0) {
			const typeId = readAssetTypeId(id as number);
			if (typeId && isLayeredTypeId(typeId)) out.push(id as number);
		}
	}
	return out;
}

/** Gộp + uniq */
function uniqMerge(...lists: number[][]): number[] {
	const seen = new Map<number, true>();
	const res: number[] = [];
	for (const list of lists) {
		for (const id of list) {
			if (!seen.get(id)) {
				seen.set(id, true as true);
				res.push(id);
			}
		}
	}
	return res;
}

/* ================= component ================= */
export function Savebuttonui() {
	const rem = useRem();

	function saveNow() {
		const lp = Players.LocalPlayer!;

		// assets từ viewport (nếu có), lọc hợp lệ
		const fromViewport = getCurrentHumanoidAssets()
			.map((a) => a.id)
			.filter((id) => id > 0 && isValidAvatarAsset(id));

		let colors: BodyColorsData | undefined;
		let scales: ScalesData | undefined;
		let classic: number[] = [];
		let layered: number[] = [];

		const hum = lp.Character?.FindFirstChildOfClass("Humanoid");
		if (hum) {
			const applied = hum.GetAppliedDescription();
			colors = collectBodyColorsFromDesc(applied);
			scales = collectScalesFromDesc(applied);
			classic = collectClassicAssetIdsFromDesc(applied);
			layered = collectLayeredAssetIdsFromDesc(applied);
		} else {
			const base = Players.GetHumanoidDescriptionFromUserId(lp.UserId);
			colors = collectBodyColorsFromDesc(base);
			scales = collectScalesFromDesc(base);
			classic = collectClassicAssetIdsFromDesc(base);
			layered = collectLayeredAssetIdsFromDesc(base);
		}

		const assets = uniqMerge(fromViewport, classic, layered);

		const name = `preset-${tostring(os.time())}`;
		print(`[Savebuttonui] save name=${name} count=${assets.size()} colors?=${colors !== undefined} scales?=${scales !== undefined}`);
		remotes.server.postOutfit.fire(name, assets, undefined, colors, scales);
	}

	return (
		<Frame
			size={new UDim2(0, rem(50), 0, rem(40))}
			anchorPoint={new Vector2(0.5, 0.5)}
			position={new UDim2(0.5, 0, 0.5, 0)}
			backgroundTransparency={0.2}
		>
			<uicorner />
			<Button
				size={new UDim2(0, rem(14), 0, rem(6))}
				anchorPoint={new Vector2(0.5, 0.5)}
				position={new UDim2(0.5, 0, 0.5, 0)}
				onClick={saveNow}
			>
				<Image
					image={images.ui.plus_icon}
					size={new UDim2(0, rem(4), 0, rem(4))}
					anchorPoint={new Vector2(0.5, 0.5)}
					position={new UDim2(0.5, 0, 0.5, 0)}
				/>
			</Button>
		</Frame>
	);
}
