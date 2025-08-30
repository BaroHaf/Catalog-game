// src/server/players/services/emote-anim.services.ts
import { InsertService, KeyframeSequenceProvider } from "@rbxts/services";
import { remotes } from "shared/remotes";

// Cache: emoteId -> "rbxassetid://<clipId>"
const CACHE = new Map<number, string>();

/**
 * Convert EmoteID -> AnimationId (rbxassetid://...)
 * - Ưu tiên: InsertService.LoadAsset + tìm Animation trước
 * - Fallback: tìm KeyframeSequence rồi RegisterKeyframeSequence
 * - Cuối cùng: KSP:GetKeyframeSequenceAsync("rbxassetid://<id>")
 * - Tất cả kết quả đều cache
 */
function convertEmoteToAnimationId(emoteId: number): string {
	if (emoteId <= 0) throw `Invalid emoteId ${emoteId}`;

	const hit = CACHE.get(emoteId);
	if (hit) return hit;

	// 1) Load asset model
	{
		const [ok, model] = pcall(() => InsertService.LoadAsset(emoteId));
		if (ok && model) {
			// 1a) Tìm Animation trực tiếp (nhiều UGC emote dùng cách này)
			const anim = model.FindFirstChildWhichIsA("Animation", true);
			if (anim) {
				const id = anim.AnimationId;
				model.Destroy();
				if (id && id !== "") {
					CACHE.set(emoteId, id);
					return id;
				}
			}

			// 1b) Không có Animation -> tìm KeyframeSequence
			let kfs: KeyframeSequence | undefined;
			model.GetDescendants().forEach((d) => {
				if (!kfs && d.IsA("KeyframeSequence")) kfs = d;
			});
			if (kfs) {
				const animId = KeyframeSequenceProvider.RegisterKeyframeSequence(kfs);
				model.Destroy();
				CACHE.set(emoteId, animId);
				return animId;
			}

			model.Destroy();
		}
	}

	// 2) Fallback: KSP với content id
	{
		const contentId = `rbxassetid://${emoteId}`;
		const [ok, kfs] = pcall(() => KeyframeSequenceProvider.GetKeyframeSequenceAsync(contentId));
		if (ok && kfs && kfs.IsA("KeyframeSequence")) {
			const animId = KeyframeSequenceProvider.RegisterKeyframeSequence(kfs);
			CACHE.set(emoteId, animId);
			return animId;
		}
	}

	throw `Emote ${emoteId} không thể lấy Animation/KeyframeSequence (asset không chứa Animation/KeyframeSequence & KSP cũng thất bại)`;
}

/** Init: listen remote request & reply */
export function initEmoteAnimService() {
	remotes.server.requestEmoteAnim.connect((player, reqId, emoteId) => {
		const [ok, result] = pcall(() => convertEmoteToAnimationId(emoteId));
		if (ok) {
			remotes.client.emoteAnimResponse.fire(player, reqId, emoteId, result as string);
		} else {
			warn("[EmoteAnimService] convert failed:", result);
			remotes.client.emoteAnimResponse.fire(player, reqId, emoteId, undefined, tostring(result));
		}
	});
}
