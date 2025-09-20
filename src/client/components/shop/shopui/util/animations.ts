// src/client/components/shop/shopui/util/animations.ts
// Utilities cho Animation Packs (AvatarAnimations)
// - Không đụng remotes/server trực tiếp (chỉ preview applyDescription).
// - Server sync thông qua remotes.server.wearOutfit.
// - Có cache để tránh lag khi render hàng loạt.

import { Players, AssetService } from "@rbxts/services";
import { applyDescriptionToAllTargets, getPrimaryHumanoid, replayPlayerIdleAll } from "./camerarotation";
import { remotes, type OutfitDelta } from "shared/remotes";
import { sendAlert } from "client/alerts";
import { SHOP_ALERT_STYLE } from "shared/constants/constant";

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

const SlotsCache = new Map<number, AnimationSlots>(); // bundleId -> slots
const OutfitIdCache = new Map<number, number>(); // bundleId -> outfitId
let PrevSlots: AnimationSlots | undefined; // Lưu slots trước khi tryOn

/* =========================
   2) RESOLVE HELPERS
   ========================= */

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

function getDescFromOutfit(outfitId: number): HumanoidDescription | undefined {
	const [ok, desc] = pcall(() => Players.GetHumanoidDescriptionFromOutfitId(outfitId));
	return ok ? (desc as HumanoidDescription) : undefined;
}

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
   2.1) PROFILE SLOTS (gốc của player)
   ========================= */

function getProfileSlots(): AnimationSlots {
	const lp = Players.LocalPlayer!;
	const userId = lp.UserId;

	// Ưu tiên API profile
	const [ok, d] = pcall(() => Players.GetHumanoidDescriptionFromUserId(userId));
	if (ok && d) {
		return readSlots(d as HumanoidDescription);
	}

	// Fallback: đọc từ LocalPlayer.Animate
	const animate = lp.Character?.FindFirstChild("Animate");
	const animIdFrom = (key: string): number => {
		const node = animate?.FindFirstChild(key);
		if (!node) return 0;
		const anim = (node.IsA("Animation") && node) || node.FindFirstChildWhichIsA("Animation");
		if (!anim || !anim.IsA("Animation")) return 0;
		const raw = anim.AnimationId;
		const num = tonumber(raw.gsub("rbxassetid://", ""));
		return num ?? 0;
	};

	return {
		Walk: animIdFrom("walk"),
		Run: animIdFrom("run"),
		Idle: animIdFrom("idle"),
		Jump: animIdFrom("jump"),
		Fall: animIdFrom("fall"),
		Swim: animIdFrom("swim"),
		Climb: animIdFrom("climb"),
	};
}

/* =========================
   3) BUNDLE LEVEL
   ========================= */

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

export function tryOnAnimationBundle(bundleId: number) {
	if (bundleId <= 0) return;
	const hum = getPrimaryHumanoid();
	if (!hum) return;

	const targetSlots = getAnimationSlotsFromBundle(bundleId);
	if (!targetSlots) {
		warn(`[ANIM] Cannot resolve slots from bundle ${bundleId}`);
		return;
	}

	if (!PrevSlots) {
		const cur = hum.GetAppliedDescription();
		PrevSlots = readSlots(cur);
	}

	// Preview (soft)
	const d = hum.GetAppliedDescription();
	writeSlots(d, targetSlots);
	replayPlayerIdleAll();

	// Sync server
	remotes.server.wearOutfit.fire(`[ANIM_BUNDLE:${bundleId}]`, [], false, undefined, undefined, targetSlots);
}

export function takeOffAnimationBundle() {
	const hum = getPrimaryHumanoid();
	if (!hum) return;

	// về slots gốc (profile / Animate)
	const baseSlots = getProfileSlots();

	// Local revert
	const d = hum.GetAppliedDescription();
	writeSlots(d, baseSlots);
	applyDescriptionToAllTargets(d, false);

	// Phát lại Idle gốc ngay
	replayPlayerIdleAll();

	// Server revert
	remotes.server.wearOutfit.fire("[ANIM_TAKEOFF]", [], false, undefined, undefined, baseSlots);

	PrevSlots = undefined;
}

export function getCurrentAnimationSlots(): AnimationSlots | undefined {
	const hum = getPrimaryHumanoid();
	if (!hum) return undefined;
	return readSlots(hum.GetAppliedDescription());
}

export function clearSavedPrevSlots() {
	PrevSlots = undefined;
}

/* =========================
   4) SINGLE ANIMATION
   ========================= */

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

export function takeOffSingleAnimation(assetId: number) {
	const hum = getPrimaryHumanoid();
	if (!hum || assetId <= 0) return;

	const d = hum.GetAppliedDescription();
	const baseSlots = getProfileSlots();

	// build payload delta để server sync đúng slot
	const delta: Partial<OutfitDelta> = {};
	let touchedIdle = false;

	if (d.WalkAnimation === assetId) {
		d.WalkAnimation = baseSlots.Walk;
		delta.WalkAnimation = baseSlots.Walk;
	}
	if (d.RunAnimation === assetId) {
		d.RunAnimation = baseSlots.Run;
		delta.RunAnimation = baseSlots.Run;
	}
	if (d.IdleAnimation === assetId) {
		d.IdleAnimation = baseSlots.Idle;
		delta.IdleAnimation = baseSlots.Idle;
		touchedIdle = true;
	}
	if (d.JumpAnimation === assetId) {
		d.JumpAnimation = baseSlots.Jump;
		delta.JumpAnimation = baseSlots.Jump;
	}
	if (d.FallAnimation === assetId) {
		d.FallAnimation = baseSlots.Fall;
		delta.FallAnimation = baseSlots.Fall;
	}
	if (d.SwimAnimation === assetId) {
		d.SwimAnimation = baseSlots.Swim;
		delta.SwimAnimation = baseSlots.Swim;
	}
	if (d.ClimbAnimation === assetId) {
		d.ClimbAnimation = baseSlots.Climb;
		delta.ClimbAnimation = baseSlots.Climb;
	}

	// Preview mềm tại client
	applyDescriptionToAllTargets(d, false);

	// Nếu có đụng Idle thì phát lại để pose đúng liền
	if (touchedIdle) replayPlayerIdleAll();

	// 🔔 Sync server (soft)
	if (next(delta)) {
		remotes.server.outfitDelta.fire(delta as OutfitDelta);
	}
}

export function isAnimationBundleType(bundleType?: Enum.BundleType): boolean {
	return bundleType === Enum.BundleType.Animations;
}

/* =========================
   5) SAFE WRAPPERS
   ========================= */

let lastAction = 0;
const COOLDOWN = 0.3; // giây

function canProceed(): boolean {
	const now = time();
	if (now - lastAction < COOLDOWN) {
		sendAlert({
			...SHOP_ALERT_STYLE.error,
			message: "⏳ Please wait before trying again!",
		});
		return false;
	}
	lastAction = now;
	return true;
}

export function safeTryOnBundle(id: number) {
	if (!canProceed()) return;
	tryOnAnimationBundle(id);
}

export function safeTakeOffBundle() {
	if (!canProceed()) return;
	takeOffAnimationBundle();
}
