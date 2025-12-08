// src/client/components/shop/saveui/utils/build-desc-from-assets.ts
import { Players, MarketplaceService } from "@rbxts/services";
import { getHDKeyForAssetType } from "../../shopui/util/camerarotation";
import { Outfit, BodyColorsData, RGB, ScalesData } from "shared/remotes";

/* ========= Helpers ========= */
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

/* ========= Colors ========= */
function rgbToC3([r, g, b]: RGB) {
	return new Color3(r / 255, g / 255, b / 255);
}
function applyBodyColors(to: HumanoidDescription, colors?: BodyColorsData, fallbackFrom?: HumanoidDescription) {
	if (colors) {
		to.HeadColor = rgbToC3(colors.head);
		to.TorsoColor = rgbToC3(colors.torso);
		to.LeftArmColor = rgbToC3(colors.leftArm);
		to.RightArmColor = rgbToC3(colors.rightArm);
		to.LeftLegColor = rgbToC3(colors.leftLeg);
		to.RightLegColor = rgbToC3(colors.rightLeg);
	} else if (fallbackFrom) {
		to.HeadColor = fallbackFrom.HeadColor;
		to.TorsoColor = fallbackFrom.TorsoColor;
		to.LeftArmColor = fallbackFrom.LeftArmColor;
		to.RightArmColor = fallbackFrom.RightArmColor;
		to.LeftLegColor = fallbackFrom.LeftLegColor;
		to.RightLegColor = fallbackFrom.RightLegColor;
	}
}

/* ========= Scales ========= */
function copyScales(from: HumanoidDescription, to: HumanoidDescription) {
	to.BodyTypeScale = from.BodyTypeScale;
	to.ProportionScale = from.ProportionScale;
	to.DepthScale = from.DepthScale;
	to.WidthScale = from.WidthScale;
	to.HeightScale = from.HeightScale;
	to.HeadScale = from.HeadScale;
}
function applyScalesFromPreset(to: HumanoidDescription, scales?: ScalesData, fallbackFrom?: HumanoidDescription) {
	if (scales) {
		if (scales.BodyTypeScale !== undefined) to.BodyTypeScale = scales.BodyTypeScale!;
		if (scales.ProportionScale !== undefined) to.ProportionScale = scales.ProportionScale!;
		if (scales.DepthScale !== undefined) to.DepthScale = scales.DepthScale!;
		if (scales.WidthScale !== undefined) to.WidthScale = scales.WidthScale!;
		if (scales.HeightScale !== undefined) to.HeightScale = scales.HeightScale!;
		if (scales.HeadScale !== undefined) to.HeadScale = scales.HeadScale!;
	} else if (fallbackFrom) {
		copyScales(fallbackFrom, to);
	}
}

/* ========= Reset classic ========= */
function resetClassicSlots(desc: HumanoidDescription) {
	desc.Shirt = 0;
	desc.Pants = 0;
	desc.GraphicTShirt = 0;
	desc.Face = 0;

	desc.HatAccessory = "";
	desc.HairAccessory = "";
	desc.FaceAccessory = "";
	desc.NeckAccessory = "";
	desc.ShouldersAccessory = "";
	desc.FrontAccessory = "";
	desc.BackAccessory = "";
	desc.WaistAccessory = "";
}

/* ========= CSV helpers ========= */
type CsvAccKey =
	| "HatAccessory"
	| "HairAccessory"
	| "FaceAccessory"
	| "NeckAccessory"
	| "ShouldersAccessory"
	| "FrontAccessory"
	| "BackAccessory"
	| "WaistAccessory";

const CSV_KEYS: CsvAccKey[] = [
	"HatAccessory",
	"HairAccessory",
	"FaceAccessory",
	"NeckAccessory",
	"ShouldersAccessory",
	"FrontAccessory",
	"BackAccessory",
	"WaistAccessory",
];

function setCsv(desc: HumanoidDescription, key: CsvAccKey, values: number[]) {
	const seen = new Map<number, true>();
	const uniq: number[] = [];
	for (const id of values) {
		if (!seen.get(id)) {
			seen.set(id, true as true);
			uniq.push(id);
		}
	}
	const csv = uniq.join(",");
	switch (key) {
		case "HatAccessory":
			desc.HatAccessory = csv; break;
		case "HairAccessory":
			desc.HairAccessory = csv; break;
		case "FaceAccessory":
			desc.FaceAccessory = csv; break;
		case "NeckAccessory":
			desc.NeckAccessory = csv; break;
		case "ShouldersAccessory":
			desc.ShouldersAccessory = csv; break;
		case "FrontAccessory":
			desc.FrontAccessory = csv; break;
		case "BackAccessory":
			desc.BackAccessory = csv; break;
		case "WaistAccessory":
			desc.WaistAccessory = csv; break;
	}
}

/* ========= Layered detection ========= */
function isLayeredTypeId(typeId: number): boolean {
	const L = Enum.AvatarAssetType;
	return (
		typeId === L.JacketAccessory.Value ||
		typeId === L.ShirtAccessory.Value ||
		typeId === L.SweaterAccessory.Value ||
		typeId === L.TShirtAccessory.Value ||
		typeId === L.PantsAccessory.Value ||
		typeId === L.ShortsAccessory.Value ||
		typeId === L.DressSkirtAccessory.Value ||
		// tuỳ build có shoe hay không
		((L as unknown as Record<string, EnumItem>).LeftShoeAccessory &&
			typeId === (L as unknown as Record<string, EnumItem>).LeftShoeAccessory.Value) ||
		((L as unknown as Record<string, EnumItem>).RightShoeAccessory &&
			typeId === (L as unknown as Record<string, EnumItem>).RightShoeAccessory.Value)
	);
}
function toAccessoryType(typeId: number): Enum.AccessoryType | undefined {
	const A = Enum.AvatarAssetType;
	const T = Enum.AccessoryType;

	if (typeId === A.JacketAccessory.Value) return T.Jacket;
	if (typeId === A.ShirtAccessory.Value) return T.Shirt;
	if (typeId === A.SweaterAccessory.Value) return T.Sweater;
	if (typeId === A.TShirtAccessory.Value) return T.TShirt;
	if (typeId === A.PantsAccessory.Value) return T.Pants;
	if (typeId === A.ShortsAccessory.Value) return T.Shorts;
	if (typeId === A.DressSkirtAccessory.Value) return T.DressSkirt;

	// Shoes (nếu có enum trong build của bạn)
	const AAny = A as unknown as Record<string, EnumItem>;
	const TAny = T as unknown as Record<string, EnumItem>;
	if (AAny.LeftShoeAccessory && TAny.LeftShoe && typeId === AAny.LeftShoeAccessory.Value)
		return TAny.LeftShoe as Enum.AccessoryType;
	if (AAny.RightShoeAccessory && TAny.RightShoe && typeId === AAny.RightShoeAccessory.Value)
		return TAny.RightShoe as Enum.AccessoryType;

	return undefined;
}

/* ========= Build ========= */
export function buildDescriptionFromOutfit(of: Outfit): HumanoidDescription {
	const lp = Players.LocalPlayer!;
	const base =
		lp.Character?.FindFirstChildOfClass("Humanoid")?.GetAppliedDescription() ??
		Players.GetHumanoidDescriptionFromUserId(lp.UserId);

	const desc = new Instance("HumanoidDescription");

	applyBodyColors(desc, of.colors, base);
	applyScalesFromPreset(desc, (of as { scales?: ScalesData }).scales, base);
	resetClassicSlots(desc);

	const csvBuckets: Record<CsvAccKey, number[]> = {
		HatAccessory: [],
		HairAccessory: [],
		FaceAccessory: [],
		NeckAccessory: [],
		ShouldersAccessory: [],
		FrontAccessory: [],
		BackAccessory: [],
		WaistAccessory: [],
	};
	const layeredList: { AssetId: number; AccessoryType: Enum.AccessoryType; Order?: number }[] = [];
	let order = 50;

	for (const id of of.assets ?? []) {
		if (!id || id <= 0) continue;

		const typeId = readAssetTypeId(id);
		if (!typeId) continue;

		// ==== BODY PART / HEAD (DynamicHead + Head) ====
		const A = Enum.AssetType;
		if (typeId === A.DynamicHead.Value || typeId === A.Head.Value) {
			desc.Head = id;
			continue;
		}
		if (typeId === A.Torso.Value) { desc.Torso = id; continue; }
		if (typeId === A.LeftArm.Value) { desc.LeftArm = id; continue; }
		if (typeId === A.RightArm.Value) { desc.RightArm = id; continue; }
		if (typeId === A.LeftLeg.Value) { desc.LeftLeg = id; continue; }
		if (typeId === A.RightLeg.Value) { desc.RightLeg = id; continue; }

		// layered
		if (isLayeredTypeId(typeId)) {
			const at = toAccessoryType(typeId);
			if (at !== undefined) layeredList.push({ AssetId: id, AccessoryType: at, Order: order++ });
			continue;
		}

		// classic / accessory theo AvatarAssetType
		const assetType = Enum.AvatarAssetType.GetEnumItems().find((t) => t.Value === typeId);
		if (!assetType) continue;

		const key = getHDKeyForAssetType(assetType);
		if (!key) continue;

		switch (key) {
			case "Shirt": desc.Shirt = id; break;
			case "Pants": desc.Pants = id; break;
			case "GraphicTShirt": desc.GraphicTShirt = id; break;
			case "Face": desc.Face = id; break;
			case "HatAccessory":
			case "HairAccessory":
			case "FaceAccessory":
			case "NeckAccessory":
			case "ShouldersAccessory":
			case "FrontAccessory":
			case "BackAccessory":
			case "WaistAccessory":
				csvBuckets[key].push(id); break;
		}
	}

	for (const k of CSV_KEYS) setCsv(desc, k, csvBuckets[k]);

	if (layeredList.size() > 0) {
		desc.SetAccessories(layeredList as unknown[], false);
	}

	return desc;
}
