// src/client/components/shop/saveui/savebuttonui.tsx
import React, { useState } from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem } from "client/hooks";
import { Button } from "client/components/ui/button";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";
import { remotes, BodyColorsData, RGB, ScalesData } from "shared/remotes";
import { getCurrentHumanoidAssets } from "client/components/shop/shopui/util/camerarotation";
import { Players, MarketplaceService } from "@rbxts/services";
import { palette } from "shared/constants/palette";
import { fonts } from "client/constants/fonts";
import { ReactiveButtonDiff } from "client/components/ui/reactive-button-animationdiff";
import { Closebutton } from "../shopui/closebutton";
import { Closebutsaveui } from "./closebut";
import { sendAlert } from "client/alerts";
import { SHOP_ALERT_MSG, SHOP_ALERT_STYLE } from "shared/constants/constant";
/* ================= helpers ================= */
function clamp01(x: number) {
	return x < 0 ? 0 : x > 1 ? 1 : x;
}
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
		d.HatAccessory,
		d.HairAccessory,
		d.FaceAccessory,
		d.NeckAccessory,
		d.ShouldersAccessory,
		d.FrontAccessory,
		d.BackAccessory,
		d.WaistAccessory,
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

/** BodyParts: Head, Torso, LeftArm, RightArm, LeftLeg, RightLeg */
function collectBodyPartsFromDesc(d: HumanoidDescription): number[] {
	const out: number[] = [];

	if (d.Head > 0 && isValidAvatarAsset(d.Head)) out.push(d.Head);
	if (d.Torso > 0 && isValidAvatarAsset(d.Torso)) out.push(d.Torso);
	if (d.LeftArm > 0 && isValidAvatarAsset(d.LeftArm)) out.push(d.LeftArm);
	if (d.RightArm > 0 && isValidAvatarAsset(d.RightArm)) out.push(d.RightArm);
	if (d.LeftLeg > 0 && isValidAvatarAsset(d.LeftLeg)) out.push(d.LeftLeg);
	if (d.RightLeg > 0 && isValidAvatarAsset(d.RightLeg)) out.push(d.RightLeg);

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
export function Savebuttonui(): JSX.Element {
	const rem = useRem();
	const [hoveredKey, setHoveredKey] = useState<string | undefined>(undefined);

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
		let bodyparts: number[] = [];

		const hum = lp.Character?.FindFirstChildOfClass("Humanoid");
		if (hum) {
			const applied = hum.GetAppliedDescription();
			colors = collectBodyColorsFromDesc(applied);
			scales = collectScalesFromDesc(applied);
			classic = collectClassicAssetIdsFromDesc(applied);
			layered = collectLayeredAssetIdsFromDesc(applied);
			bodyparts = collectBodyPartsFromDesc(applied); // 🔥 thêm body parts
		} else {
			const base = Players.GetHumanoidDescriptionFromUserId(lp.UserId);
			colors = collectBodyColorsFromDesc(base);
			scales = collectScalesFromDesc(base);
			classic = collectClassicAssetIdsFromDesc(base);
			layered = collectLayeredAssetIdsFromDesc(base);
			bodyparts = collectBodyPartsFromDesc(base); // 🔥 thêm body parts
		}

		// Gộp tất cả
		const assets = uniqMerge(fromViewport, classic, layered, bodyparts);

		const name = `preset-${tostring(os.time())}`;
		print(
			`[Savebuttonui] save name=${name} count=${assets.size()} colors?=${colors !== undefined} scales?=${
				scales !== undefined
			}`,
		);
		remotes.server.postOutfit.fire(name, assets, undefined, colors, scales);
		sendAlert({
			...SHOP_ALERT_STYLE.saveoutfit,
			message: SHOP_ALERT_MSG.saveoutfit,
		});
	}

	return (
		<Frame
			size={new UDim2(0, rem(60), 0, rem(20))}
			anchorPoint={new Vector2(0.5, 0.5)}
			position={new UDim2(0.5, 0, 0.5, 0)}
			backgroundTransparency={0}
			backgroundColor={Color3.fromRGB(35, 35, 35)}
		>
			<uicorner />
			<textlabel
				Size={UDim2.fromScale(1, 1)}
				BackgroundTransparency={1}
				Text={"You want to save this outfits?"}
				TextSize={rem(2.5)}
				TextColor3={palette.white}
				TextXAlignment={Enum.TextXAlignment.Center}
				TextYAlignment={Enum.TextYAlignment.Center}
				FontFace={fonts.JosefinSans.bold}
			/>
			<ReactiveButtonDiff
				size={new UDim2(0, rem(5), 0, rem(5))}
				position={new UDim2(1, 0, 1, 0)}
				anchorPoint={new Vector2(1, 1)}
				onHover={(isHovering) => setHoveredKey(isHovering ? "save" : undefined)}
				onClick={saveNow}
				backgroundTransparency={1}
			>
				<Image
					image={images.ui.checked_icon}
					size={new UDim2(1, 0, 1, 0)}
					backgroundTransparency={1}
					imageColor={hoveredKey === "save" ? Color3.fromRGB(0, 255, 0) : palette.white}
				/>
			</ReactiveButtonDiff>

			<Closebutsaveui />
		</Frame>
	);
}
