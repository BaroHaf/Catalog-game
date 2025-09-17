// src/client/components/shop/shopui/util/animations.ts
// Utilities cho Animation Packs (AvatarAnimations)
// - Không đụng remotes/server.
// - Chỉ preview bằng applyDescriptionToAllTargets(desc, hard=false).
// - Nhận bundleId (số nhỏ, vd 2623795) -> resolve outfitId -> đọc slots.
// - Có cache để tránh lag khi render hàng loạt.

import { Players, AssetService } from "@rbxts/services";
import { applyDescriptionToAllTargets, getPrimaryHumanoid } from "./camerarotation";

/* =========================
   1) TYPES & CACHE
   ========================= */

export type AnimationSlots = {
	Walk: number;
	Run: number;
	Idle: number;
	Jump: number;
	Fall: number;
	Swim: number;
	Climb: number;
};

// Cache: bundleId -> slots
const SlotsCache = new Map<number, AnimationSlots>();
// Cache phụ: bundleId -> outfitId
const OutfitIdCache = new Map<number, number>();

// Lưu slots “trước khi try-on bundle lần đầu” để có thể take off quay lại
let PrevSlots: AnimationSlots | undefined;

/* =========================
   2) RESOLVE HELPERS
   ========================= */

// Lấy outfitId duy nhất trong bundle (có cache)
function resolveOutfitIdFromBundle(bundleId: number): number | undefined {
	if (OutfitIdCache.has(bundleId)) return OutfitIdCache.get(bundleId);

	const [ok, bundle] = pcall(() => AssetService.GetBundleDetailsAsync(bundleId));
	if (!ok || !bundle) return undefined;

	const items = (bundle as unknown as { Items?: Array<{ Id?: number; Type?: string }> }).Items ?? [];
	for (const it of items) {
		if (it.Type === "UserOutfit" && typeOf(it.Id) === "number") {
			const id = it.Id as number;
			OutfitIdCache.set(bundleId, id);
			return id;
		}
	}
	return undefined;
}

// Lấy HumanoidDescription từ outfitId (API sync hợp lệ trên client)
function getDescFromOutfit(outfitId: number): HumanoidDescription | undefined {
	const [ok, desc] = pcall(() => Players.GetHumanoidDescriptionFromOutfitId(outfitId));
	return ok ? (desc as HumanoidDescription) : undefined;
}

// Trích slots từ HumanoidDescription
function readSlots(d: HumanoidDescription): AnimationSlots {
	return {
		Walk: d.WalkAnimation,
		Run: d.RunAnimation,
		Idle: d.IdleAnimation,
		Jump: d.JumpAnimation,
		Fall: d.FallAnimation,
		Swim: d.SwimAnimation,
		Climb: d.ClimbAnimation,
	};
}

// Gán slots vào HumanoidDescription (in-place)
function writeSlots(d: HumanoidDescription, s: AnimationSlots) {
	d.WalkAnimation = s.Walk;
	d.RunAnimation = s.Run;
	d.IdleAnimation = s.Idle;
	d.JumpAnimation = s.Jump;
	d.FallAnimation = s.Fall;
	d.SwimAnimation = s.Swim;
	d.ClimbAnimation = s.Climb;
}

/* =========================
   3) PUBLIC – BUNDLE LEVEL
   ========================= */

/** Lấy mapping slot -> assetId từ 1 bundle (có cache) */
export function getAnimationSlotsFromBundle(bundleId: number): AnimationSlots | undefined {
	if (bundleId <= 0) return undefined;
	const cached = SlotsCache.get(bundleId);
	if (cached) return cached;

	const outfitId = resolveOutfitIdFromBundle(bundleId);
	if (!outfitId) return undefined;

	const desc = getDescFromOutfit(outfitId);
	if (!desc) return undefined;

	const slots = readSlots(desc);
	SlotsCache.set(bundleId, slots);
	return slots;
}

/** Kiểm tra hiện đang “mặc” đúng các slot của bundle này chưa (đọc nhanh, có cache) */
export function isAnimationBundleApplied(bundleId: number): boolean {
	const hum = getPrimaryHumanoid();
	if (!hum) return false;

	const slots = getAnimationSlotsFromBundle(bundleId);
	if (!slots) return false;

	const now = readSlots(hum.GetAppliedDescription());
	return (
		now.Walk === slots.Walk &&
		now.Run === slots.Run &&
		now.Idle === slots.Idle &&
		now.Jump === slots.Jump &&
		now.Fall === slots.Fall &&
		now.Swim === slots.Swim &&
		now.Climb === slots.Climb
	);
}

/** TRY ON: áp toàn bộ slots của bundle vào tất cả viewport humanoids (SOFT apply) */
export function tryOnAnimationBundle(bundleId: number) {
	if (bundleId <= 0) return;

	const hum = getPrimaryHumanoid();
	if (!hum) return;

	const targetSlots = getAnimationSlotsFromBundle(bundleId);
	if (!targetSlots) {
		warn(`[ANIM] Cannot resolve slots from bundle ${bundleId}`);
		return;
	}

	// Lưu slots cũ lần đầu (để có thể take off quay lại)
	if (!PrevSlots) {
		const cur = hum.GetAppliedDescription();
		PrevSlots = readSlots(cur);
	}

	// Apply (soft)
	const d = hum.GetAppliedDescription();
	writeSlots(d, targetSlots);
	applyDescriptionToAllTargets(d, false); // ✅ soft apply, KHÔNG reset rig
}

/** TAKE OFF: khôi phục về slots trước khi tryOnAnimationBundle (SOFT apply) */
export function takeOffAnimationBundle() {
	const hum = getPrimaryHumanoid();
	if (!hum) return;
	if (!PrevSlots) return;

	const d = hum.GetAppliedDescription();
	writeSlots(d, PrevSlots);
	applyDescriptionToAllTargets(d, false); // ✅ soft apply
	PrevSlots = undefined;
}

/** Đọc nhanh slots hiện tại (tiện debug/UI) */
export function getCurrentAnimationSlots(): AnimationSlots | undefined {
	const hum = getPrimaryHumanoid();
	if (!hum) return undefined;
	return readSlots(hum.GetAppliedDescription());
}

/** Xoá bộ nhớ “trước khi try-on” (gọi sau khi Reset về Profile nếu muốn) */
export function clearSavedPrevSlots() {
	PrevSlots = undefined;
}

/* =========================
   4) PUBLIC – SINGLE ANIMATION
   ========================= */

/** Kiểm tra 1 animation asset (riêng lẻ) có đang được apply trong HumanoidDescription không */
export function isSingleAnimationApplied(assetId: number): boolean {
	const hum = getPrimaryHumanoid();
	if (!hum || assetId <= 0) return false;

	const d = hum.GetAppliedDescription();
	return (
		d.WalkAnimation === assetId ||
		d.RunAnimation === assetId ||
		d.IdleAnimation === assetId ||
		d.JumpAnimation === assetId ||
		d.FallAnimation === assetId ||
		d.SwimAnimation === assetId ||
		d.ClimbAnimation === assetId
	);
}

/** TAKE OFF 1 animation asset (bỏ riêng lẻ ra khỏi HumanoidDescription – SOFT apply) */
export function takeOffSingleAnimation(assetId: number) {
	const hum = getPrimaryHumanoid();
	if (!hum || assetId <= 0) return;

	const d = hum.GetAppliedDescription();

	// Reset slot nào trùng assetId về PrevSlots nếu có, nếu không thì 0
	if (d.WalkAnimation === assetId) d.WalkAnimation = PrevSlots ? PrevSlots.Walk : 0;
	if (d.RunAnimation === assetId) d.RunAnimation = PrevSlots ? PrevSlots.Run : 0;
	if (d.IdleAnimation === assetId) d.IdleAnimation = PrevSlots ? PrevSlots.Idle : 0;
	if (d.JumpAnimation === assetId) d.JumpAnimation = PrevSlots ? PrevSlots.Jump : 0;
	if (d.FallAnimation === assetId) d.FallAnimation = PrevSlots ? PrevSlots.Fall : 0;
	if (d.SwimAnimation === assetId) d.SwimAnimation = PrevSlots ? PrevSlots.Swim : 0;
	if (d.ClimbAnimation === assetId) d.ClimbAnimation = PrevSlots ? PrevSlots.Climb : 0;

	applyDescriptionToAllTargets(d, false); // ✅ soft apply
}
// an toàn với assetType nil và không đụng .Name
// util/animations.ts
export function isAnimationBundleType(bundleType?: Enum.BundleType): boolean {
	return bundleType === Enum.BundleType.Animations;
}
