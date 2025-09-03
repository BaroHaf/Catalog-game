// client/components/shop/saveui/utils/build-desc-from-outfit.ts
import { Players, MarketplaceService } from "@rbxts/services";
import { getHDKeyForAssetType } from "../../shopui/util/camerarotation";
import { Outfit, BodyColorsData, RGB } from "shared/remotes";

const assetTypeCache = new Map<number, number>(); // id -> AssetTypeId

function readAssetTypeId(id: number): number | undefined {
	const cached = assetTypeCache.get(id);
	if (cached !== undefined) return cached;

	const [ok, infoRaw] = pcall(() => MarketplaceService.GetProductInfo(id));
	if (!ok || typeOf(infoRaw) !== "table") return undefined;
	const info = infoRaw as unknown as { AssetTypeId?: number };
	if (!info.AssetTypeId) return undefined;

	assetTypeCache.set(id, info.AssetTypeId);
	return info.AssetTypeId;
}

function resetClothesAndAccessories(desc: HumanoidDescription) {
	(desc as unknown as Record<string, unknown>)["Shirt"] = 0;
	(desc as unknown as Record<string, unknown>)["Pants"] = 0;
	(desc as unknown as Record<string, unknown>)["GraphicTShirt"] = 0;
	(desc as unknown as Record<string, unknown>)["Face"] = 0;

	const accKeys = [
		"HatAccessory","HairAccessory","FaceAccessory","NeckAccessory",
		"ShouldersAccessory","FrontAccessory","BackAccessory","WaistAccessory",
	] as const;
	for (let i = 0; i < accKeys.size(); i++) {
		(desc as unknown as Record<string, unknown>)[accKeys[i]] = "";
	}
}

function copyScales(from: HumanoidDescription, to: HumanoidDescription) {
	to.BodyTypeScale   = from.BodyTypeScale;
	to.ProportionScale = from.ProportionScale;
	to.DepthScale      = from.DepthScale;
	to.WidthScale      = from.WidthScale;
	to.HeightScale     = from.HeightScale;
	to.HeadScale       = from.HeadScale;
}

function rgbToC3([r, g, b]: RGB) {
	return new Color3(r / 255, g / 255, b / 255);
}

function applyBodyColors(to: HumanoidDescription, colors?: BodyColorsData, fallbackFrom?: HumanoidDescription) {
	if (colors) {
		to.HeadColor     = rgbToC3(colors.head);
		to.TorsoColor    = rgbToC3(colors.torso);
		to.LeftArmColor  = rgbToC3(colors.leftArm);
		to.RightArmColor = rgbToC3(colors.rightArm);
		to.LeftLegColor  = rgbToC3(colors.leftLeg);
		to.RightLegColor = rgbToC3(colors.rightLeg);
	} else if (fallbackFrom) {
		to.HeadColor     = fallbackFrom.HeadColor;
		to.TorsoColor    = fallbackFrom.TorsoColor;
		to.LeftArmColor  = fallbackFrom.LeftArmColor;
		to.RightArmColor = fallbackFrom.RightArmColor;
		to.LeftLegColor  = fallbackFrom.LeftLegColor;
		to.RightLegColor = fallbackFrom.RightLegColor;
	}
}

export function buildDescriptionFromOutfit(of: Outfit): HumanoidDescription {
	const lp = Players.LocalPlayer!;
	const base =
		lp.Character?.FindFirstChildOfClass("Humanoid")?.GetAppliedDescription() ??
		Players.GetHumanoidDescriptionFromUserId(lp.UserId);

	const desc = new Instance("HumanoidDescription");
	copyScales(base, desc);
	applyBodyColors(desc, of.colors, base);
	resetClothesAndAccessories(desc);

	const lists = new Map<string, number[]>();

	for (const id of of.assets ?? []) {
		if (!id || id <= 0) continue;

		const typeId = readAssetTypeId(id);
		if (!typeId) continue;

		const assetType = Enum.AvatarAssetType.GetEnumItems().find((t) => t.Value === typeId);
		if (!assetType) continue;

		const key = getHDKeyForAssetType(assetType);
		if (!key) continue;

		if (key === "Shirt" || key === "Pants" || key === "GraphicTShirt" || key === "Face") {
			(desc as unknown as Record<string, number>)[key] = id;
		} else {
			const cur = lists.get(key) ?? [];
			cur.push(id);
			lists.set(key, cur);
		}
	}

	for (const [k, arr] of lists) {
		const seen = new Map<number, true>();
		const uniq = new Array<number>();
		for (let i = 0; i < arr.size(); i++) {
			const n = arr[i];
			if (!seen.get(n)) { seen.set(n, true as true); uniq.push(n); }
		}
		(desc as unknown as Record<string, string>)[k] = uniq.join(",");
	}

	return desc;
}
