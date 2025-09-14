// src/client/components/shop/shopui/util/layered.ts
//
// Utilities cho Layered Clothing: Jacket / Sweater / Shorts / DressSkirt / LeftShoe / RightShoe
// - Không import @rbxts/types (Enum là global)
// - Chỉ thao tác trên viewport humanoids (getPrimaryHumanoid) & broadcast (applyDescriptionToAllTargets)
// - Chỉ đụng LAYERED bằng GetAccessories(false)/SetAccessories(list, false)
// - Có debug log và gửi payload lên server (remotes.server.outfitDelta.fire)
//
// Yêu cầu: file này ở cùng thư mục với camerarotation.ts

import { applyDescriptionToAllTargets, getPrimaryHumanoid } from "./camerarotation";
import { remotes, type OutfitDelta } from "shared/remotes";

/* =========================
   1) MAPPING & ORDER
   ========================= */

const ACC_TYPE_BY_AVATAR = new Map<number, Enum.AccessoryType>([
	[Enum.AvatarAssetType.JacketAccessory.Value, Enum.AccessoryType.Jacket],
	[Enum.AvatarAssetType.SweaterAccessory.Value, Enum.AccessoryType.Sweater],
	[Enum.AvatarAssetType.ShortsAccessory.Value, Enum.AccessoryType.Shorts],
	[Enum.AvatarAssetType.DressSkirtAccessory.Value, Enum.AccessoryType.DressSkirt],
	[Enum.AvatarAssetType.LeftShoeAccessory.Value, Enum.AccessoryType.LeftShoe],
	[Enum.AvatarAssetType.RightShoeAccessory.Value, Enum.AccessoryType.RightShoe],
]);

const DEFAULT_ORDER_BY_TYPE = new Map<number, number>([
	[Enum.AccessoryType.LeftShoe.Value, 5],
	[Enum.AccessoryType.RightShoe.Value, 10],
	[Enum.AccessoryType.Shorts.Value, 20],
	[Enum.AccessoryType.DressSkirt.Value, 25],
	[Enum.AccessoryType.Sweater.Value, 40],
	[Enum.AccessoryType.Jacket.Value, 50],
]);

/* =========================
   2) TYPE GUARD & HELPERS
   ========================= */

export function isLayeredAvatarAssetType(t: Enum.AvatarAssetType) {
	return (
		t === Enum.AvatarAssetType.JacketAccessory ||
		t === Enum.AvatarAssetType.SweaterAccessory ||
		t === Enum.AvatarAssetType.ShortsAccessory ||
		t === Enum.AvatarAssetType.DressSkirtAccessory ||
		t === Enum.AvatarAssetType.LeftShoeAccessory ||
		t === Enum.AvatarAssetType.RightShoeAccessory
	);
}

function toAccessoryType(assetType: Enum.AvatarAssetType): Enum.AccessoryType | undefined {
	return ACC_TYPE_BY_AVATAR.get(assetType.Value);
}

function getDesc(): HumanoidDescription | undefined {
	const h = getPrimaryHumanoid();
	return h?.GetAppliedDescription();
}

// Only layered: includeRigidAccessories=false
function readLayeredList(d: HumanoidDescription): Array<LayeredAccessoryInfo> {
	const arr = d.GetAccessories(false) as Array<LayeredAccessoryInfo>;
	return arr.map((x) => ({
		AssetId: x.AssetId,
		AccessoryType: x.AccessoryType,
		IsLayered: true, // ensure
		Order: x.Order,
	}));
}

function writeLayeredList(d: HumanoidDescription, list: Array<LayeredAccessoryInfo>) {
	for (let i = 0; i < list.size(); i++) {
		if (list[i].Order !== undefined) list[i].IsLayered = true;
	}
	const [ok, err] = pcall(() => d.SetAccessories(list as Array<unknown>, false));
	if (!ok) warn("[LAYERED][ERROR] HumanoidDescription:SetAccessories failed:", err);
}

// Chuẩn hoá list layered thành payload nhẹ để gửi server: [assetId, typeValue, order]
type LayeredPayloadTuple = [number, number, number];
function serializeLayered(list: Array<LayeredAccessoryInfo>): LayeredPayloadTuple[] {
	const out = new Array<LayeredPayloadTuple>();
	for (let i = 0; i < list.size(); i++) {
		const it = list[i];
		const typeVal = it.AccessoryType.Value;
		const order = it.Order ?? 30;
		out.push([it.AssetId, typeVal, order]);
	}
	return out;
}

/* =========================
   3) PUBLIC API
   ========================= */

export function isLayeredApplied(assetType: Enum.AvatarAssetType, assetId: number): boolean {
	if (!isLayeredAvatarAssetType(assetType) || assetId <= 0) return false;
	const accType = toAccessoryType(assetType);
	if (!accType) return false;
	const d = getDesc();
	if (!d) return false;
	const list = readLayeredList(d);
	for (let i = 0; i < list.size(); i++) {
		const it = list[i];
		if (it.AssetId === assetId && it.AccessoryType === accType) return true;
	}
	return false;
}

type TryOnLayeredOpts = {
	order?: number;
	replaceSameType?: boolean; // true = thay toàn bộ cùng loại
};

export function tryOnLayered(assetType: Enum.AvatarAssetType, assetId: number, opts?: TryOnLayeredOpts) {
	if (!isLayeredAvatarAssetType(assetType) || assetId <= 0) return;

	const accType = toAccessoryType(assetType);
	if (!accType) {
		warn(`[LAYERED][DEBUG] tryOnLayered: No AccessoryType for ${assetType.Name}`);
		return;
	}

	const base = getDesc();
	if (!base) return;

	const d = base;
	const list = readLayeredList(d);

	if (opts?.replaceSameType) {
		for (let i = list.size() - 1; i >= 0; i--) {
			if (list[i].AccessoryType === accType) list.remove(i);
		}
	} else {
		for (let i = 0; i < list.size(); i++) {
			if (list[i].AssetId === assetId && list[i].AccessoryType === accType) {
				warn(`[LAYERED][DEBUG] Asset ${assetId} (${accType.Name}) đã có trong list → bỏ qua`);
				return;
			}
		}
	}

	const defaultOrder = DEFAULT_ORDER_BY_TYPE.get(accType.Value) ?? 30;
	const order = opts?.order ?? defaultOrder;

	const entry: LayeredAccessoryInfo = {
		AssetId: assetId,
		AccessoryType: accType,
		IsLayered: true,
		Order: order,
	};
	list.push(entry);

	print(
		`[LAYERED][ADD] +${assetId} type=${accType.Name} order=${order} → size=${list.size()} (replace=${opts?.replaceSameType === true})`,
	);

	// Apply to local viewports
	writeLayeredList(d, list);
	applyDescriptionToAllTargets(d, true);

	// 🔥 Gửi server như tryOnAsset: hard=true + LayeredAccessories (tuple[])
	const payload = {
		LayeredAccessories: serializeLayered(list),
		hard: true,
	} as unknown as OutfitDelta;
	remotes.server.outfitDelta.fire(payload);
}

export function takeOffLayered(assetType: Enum.AvatarAssetType, assetId: number) {
	if (!isLayeredAvatarAssetType(assetType) || assetId <= 0) return;

	const accType = toAccessoryType(assetType);
	if (!accType) {
		warn(`[LAYERED][DEBUG] takeOffLayered: No AccessoryType for ${assetType.Name}`);
		return;
	}

	const base = getDesc();
	if (!base) return;

	const d = base;
	const list = readLayeredList(d);

	let removed = 0;
	for (let i = list.size() - 1; i >= 0; i--) {
		const it = list[i];
		if (it.AssetId === assetId && it.AccessoryType === accType) {
			list.remove(i);
			removed += 1;
		}
	}

	print(`[LAYERED][REMOVE] -${assetId} type=${accType.Name} removed=${removed} → size=${list.size()}`);

	// Apply to local viewports
	writeLayeredList(d, list);
	applyDescriptionToAllTargets(d, true);

	// 🔥 Gửi server sau khi remove
	const payload = {
		LayeredAccessories: serializeLayered(list),
		hard: true,
	} as unknown as OutfitDelta;
	remotes.server.outfitDelta.fire(payload);
}

/* =========================
   4) DEBUG
   ========================= */

export function debugDumpLayered() {
	const d = getDesc();
	if (!d) {
		warn("[LAYERED][DEBUG] No primary humanoid/description");
		return;
	}
	const list = readLayeredList(d);
	print(`[LAYERED][DUMP] count=${list.size()}`);
	for (let i = 0; i < list.size(); i++) {
		const it = list[i];
		print(`  [${i}] id=${it.AssetId} type=${it.AccessoryType.Name} order=${it.Order} layered=${it.IsLayered ?? false}`);
	}
}
