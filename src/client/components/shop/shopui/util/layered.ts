// src/client/components/shop/shopui/util/layered.ts
//
// Utilities cho Layered Clothing: Jacket / Sweater / Shorts / DressSkirt / LeftShoe / RightShoe
// - Không import @rbxts/types (Enum là global) để tránh lỗi "is not a module"
// - Chỉ thao tác trên viewport humanoids: lấy desc từ getPrimaryHumanoid() rồi broadcast bằng applyDescriptionToAllTargets()
// - Sử dụng GetAccessories(false) / SetAccessories(list, false) để chỉ đụng tới layered, không ảnh hưởng rigid accessories.
// - Có debug log đầy đủ.
//
// Yêu cầu: file này ở cùng thư mục với camerarotation.ts

import { applyDescriptionToAllTargets, getPrimaryHumanoid } from "./camerarotation";

/* =========================
   1) MAPPING VÀ ORDER
   ========================= */

// AvatarAssetType (layered) -> AccessoryType
// Dùng Map<number, Enum.AccessoryType> với key = AvatarAssetType.Value để tránh lỗi type inference.
const ACC_TYPE_BY_AVATAR = new Map<number, Enum.AccessoryType>([
	[Enum.AvatarAssetType.JacketAccessory.Value, Enum.AccessoryType.Jacket],
	[Enum.AvatarAssetType.SweaterAccessory.Value, Enum.AccessoryType.Sweater],
	[Enum.AvatarAssetType.ShortsAccessory.Value, Enum.AccessoryType.Shorts],
	[Enum.AvatarAssetType.DressSkirtAccessory.Value, Enum.AccessoryType.DressSkirt],
	[Enum.AvatarAssetType.LeftShoeAccessory.Value, Enum.AccessoryType.LeftShoe],
	[Enum.AvatarAssetType.RightShoeAccessory.Value, Enum.AccessoryType.RightShoe],
]);

// Default Order cho từng loại Layered (key theo AccessoryType.Value -> number)
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

// Lấy HumanoidDescription của primary viewport humanoid
function getDesc(): HumanoidDescription | undefined {
	const h = getPrimaryHumanoid();
	if (!h) return undefined;
	return h.GetAppliedDescription();
}

// Chỉ đọc/ghi danh sách Layered (includeRigidAccessories = false)
function readLayeredList(d: HumanoidDescription): Array<LayeredAccessoryInfo> {
	// rbxts types: GetAccessories(false) trả Array<LayeredAccessoryInfo>
	const arr = d.GetAccessories(false) as Array<LayeredAccessoryInfo>;
	// clone nhẹ để tránh mutate trực tiếp mảng của engine
	return arr.map((x) => ({
		AssetId: x.AssetId,
		AccessoryType: x.AccessoryType,
		IsLayered: x.IsLayered,
		Order: x.Order,
	}));
}

function writeLayeredList(d: HumanoidDescription, list: Array<LayeredAccessoryInfo>) {
	// Lưu ý: nếu set Order, phải IsLayered = true
	for (let i = 0; i < list.size(); i++) {
		if (list[i].Order !== undefined && list[i].IsLayered !== true) {
			list[i].IsLayered = true;
		}
	}
	// includeRigidAccessories=false → chỉ update layered, không đụng rigid
	const [ok, err] = pcall(() => d.SetAccessories(list as Array<unknown>, false));
	if (!ok) warn("[LAYERED][ERROR] HumanoidDescription:SetAccessories failed:", err);
}

/* =========================
   3) PUBLIC API
   ========================= */

export function isLayeredApplied(assetType: Enum.AvatarAssetType, assetId: number): boolean {
	if (!isLayeredAvatarAssetType(assetType) || assetId <= 0) return false;

	const accType = toAccessoryType(assetType);
	if (!accType) {
		warn(`[LAYERED][DEBUG] No AccessoryType mapping for AvatarAssetType=${assetType.Name}`);
		return false;
	}

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
	order?: number; // nếu không cung cấp, lấy từ DEFAULT_ORDER_BY_TYPE
	replaceSameType?: boolean; // true = thay thế cùng loại, false = thêm vào (mặc nhiều layer cùng loại)
};

/** Mặc 1 món layered vào viewport humanoids (broadcast qua applyDescriptionToAllTargets) */
export function tryOnLayered(assetType: Enum.AvatarAssetType, assetId: number, opts?: TryOnLayeredOpts) {
	if (!isLayeredAvatarAssetType(assetType) || assetId <= 0) return;

	const accType = toAccessoryType(assetType);
	if (!accType) {
		warn(`[LAYERED][DEBUG] tryOnLayered: No AccessoryType for ${assetType.Name}`);
		return;
	}

	const base = getDesc();
	if (!base) return;

	const d = base; // chỉnh trực tiếp và broadcast
	const list = readLayeredList(d);

	// Nếu muốn thay thế cùng loại → xoá hết entries có AccessoryType này
	if (opts?.replaceSameType) {
		for (let i = list.size() - 1; i >= 0; i--) {
			if (list[i].AccessoryType === accType) list.remove(i);
		}
	} else {
		// nếu đã tồn tại chính assetId + loại này thì bỏ qua (tránh nhân đôi)
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
		IsLayered: true, // ⚠ bắt buộc true khi có Order
		Order: order,
	};
	list.push(entry);

	// Debug
	print(
		`[LAYERED][ADD] +${assetId} type=${accType.Name} order=${order} → size=${list.size()} (replace=${opts?.replaceSameType === true})`,
	);

	// Ghi lại vào desc, sau đó broadcast toàn bộ viewport humanoids (hard apply)
	writeLayeredList(d, list);
	applyDescriptionToAllTargets(d, true);
}

/** Gỡ 1 món layered (đúng id + đúng loại) khỏi viewport humanoids */
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

	writeLayeredList(d, list);
	applyDescriptionToAllTargets(d, true);
}

/* =========================
   4) DEBUG TIỆN DỤNG
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
		print(
			`  [${i}] id=${it.AssetId} type=${it.AccessoryType.Name} order=${it.Order} layered=${it.IsLayered ?? false}`,
		);
	}
}
