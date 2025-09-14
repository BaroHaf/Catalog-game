// server/services/outfit-delta.services.ts
import { Players } from "@rbxts/services";
import { remotes, type OutfitDelta } from "shared/remotes";

/**
 * Coalesce 10Hz cho các thay đổi outfit gửi liên tục từ client.
 * - Mọi delta trong 0.1s được gộp lại rồi apply 1 lần.
 * - hard=true (mặc/cởi/reset) -> ApplyDescriptionReset đúng 1 lần ở nhịp đó.
 */

type Bucket = { pending?: OutfitDelta; scheduled?: boolean; lastHard?: boolean };
const buckets = new Map<Player, Bucket>();

function merge<T extends object>(to: T, from: Partial<T>) {
	for (const [k, v] of pairs(from as unknown as Record<string, unknown>)) {
		(to as unknown as Record<string, unknown>)[k] = v!;
	}
}

function clampScales(d: HumanoidDescription, patch: OutfitDelta) {
	const clamp = (x: number, a: number, b: number) => math.clamp(x, a, b);
	if (patch.HeightScale !== undefined) d.HeightScale = clamp(d.HeightScale, 0.9, 1.05);
	if (patch.WidthScale !== undefined) d.WidthScale = clamp(d.WidthScale, 0.7, 1.05);
	if (patch.DepthScale !== undefined) d.DepthScale = clamp(d.DepthScale, 0.9, 1.05);
	if (patch.HeadScale !== undefined) d.HeadScale = clamp(d.HeadScale, 0.95, 1.05);
	if (patch.BodyTypeScale !== undefined) d.BodyTypeScale = clamp(d.BodyTypeScale, 0, 1);
	if (patch.ProportionScale !== undefined) d.ProportionScale = clamp(d.ProportionScale, 0, 1);
}

/** Payload tuple từ client: [assetId, accessoryTypeValue, order] */
type LayeredPayloadTuple = [number, number, number];

function deserializeLayeredTuples(tuples: LayeredPayloadTuple[]): LayeredAccessoryInfo[] {
	const byValue = new Map<number, Enum.AccessoryType>();
	for (const et of Enum.AccessoryType.GetEnumItems()) byValue.set(et.Value, et);

	const out = new Array<LayeredAccessoryInfo>();
	for (let i = 0; i < tuples.size(); i++) {
		const [assetId, typeVal, order] = tuples[i];
		const et = byValue.get(typeVal);
		if (!et) continue;

		out.push({
			AssetId: assetId,
			AccessoryType: et,
			IsLayered: true,
			Order: order ?? 30,
		});
	}
	return out;
}

function applyPatchToDescription(desc: HumanoidDescription, patch: OutfitDelta) {
	// 1) Xử lý riêng LayeredAccessories (nếu có)
	const layeredAny = (patch as unknown as Record<string, unknown>)["LayeredAccessories"];
	if (layeredAny !== undefined) {
		const tuples = layeredAny as unknown as LayeredPayloadTuple[];
		const list = deserializeLayeredTuples(tuples);

		// Gọi SetAccessories(list, false) để CHỈ ghi layered, không đụng rigid
		const [ok, err] = pcall(() => desc.SetAccessories(list as Array<unknown>, false));
		if (!ok) warn("[SERVER][LAYERED] SetAccessories(false) failed:", err);
	}

	// 2) Gán các field còn lại (ignore 'hard' & 'LayeredAccessories')
	for (const [k, v] of pairs(patch as unknown as Record<string, unknown>)) {
		if (k === "hard" || k === "LayeredAccessories") continue;
		(desc as unknown as Record<string, unknown>)[k] = v!;
	}

	// 3) Clamp scales nếu patch có touch các scale
	clampScales(desc, patch);
}

function scheduleApply(plr: Player) {
	const b = buckets.get(plr)!;
	if (b.scheduled) return;
	b.scheduled = true;

	// 10Hz (0.1s một lần)
	task.delay(0.1, () => {
		b.scheduled = false;

		const hum = plr.Character?.FindFirstChildOfClass("Humanoid");
		const patch = b.pending;
		b.pending = undefined;
		if (!hum || !patch) return;

		const desc = hum.GetAppliedDescription();

		// Áp delta vào desc (bao gồm xử lý LayeredAccessories)
		applyPatchToDescription(desc, patch);

		// hard => Reset ; else => Apply
		(patch.hard ?? b.lastHard) ? hum.ApplyDescriptionReset(desc) : hum.ApplyDescription(desc);

		// Nếu vừa hard, tick sau default về soft
		b.lastHard = patch.hard === true;
	});
}

export function initOutfitDeltaService() {
	remotes.server.outfitDelta.connect((plr, delta) => {
		if (typeOf(delta) !== "table") return;
		if (!plr.Character?.FindFirstChildOfClass("Humanoid")) return;

		const bucket = buckets.get(plr) ?? (buckets.set(plr, {}), buckets.get(plr)!);
		const current = bucket.pending ?? {};
		merge(current, delta);
		bucket.pending = current;

		if (delta.hard) bucket.lastHard = true;

		scheduleApply(plr);
	});

	Players.PlayerRemoving.Connect((plr) => buckets.delete(plr));
}
