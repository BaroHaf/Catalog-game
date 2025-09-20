// src/server/players/services/emote-anim.services.ts
import { InsertService, KeyframeSequenceProvider, Players } from "@rbxts/services";
import { remotes, type PlayEmoteOpts } from "shared/remotes";

/* ==========================================================
   1) CACHE & CONVERTER: EmoteID (UGC) -> AnimationId (ContentId)
   ========================================================== */

// Cache: emoteId -> "rbxassetid://<clipId>"
const EMOTE_TO_ANIM_CACHE = new Map<number, string>();

/**
 * Convert EmoteID -> AnimationId (rbxassetid://...)
 * Ưu tiên:
 *  1) InsertService.LoadAsset(emoteId) -> tìm Animation trước
 *  2) Nếu không có Animation, tìm KeyframeSequence -> RegisterKeyframeSequence
 *  3) Fallback: KSP:GetKeyframeSequenceAsync("rbxassetid://<id>") -> Register
 * Kết quả được cache.
 */
function convertEmoteToAnimationId(emoteId: number): string {
	if (emoteId <= 0) throw `Invalid emoteId ${emoteId}`;

	const hit = EMOTE_TO_ANIM_CACHE.get(emoteId);
	if (hit) return hit;

	// 1) Load cả asset model để tìm trực tiếp
	{
		const [ok, model] = pcall(() => InsertService.LoadAsset(emoteId));
		if (ok && model) {
			// 1a) Ưu tiên Animation node (phổ biến với nhiều UGC emote)
			const anim = model.FindFirstChildWhichIsA("Animation", true);
			if (anim) {
				const id = anim.AnimationId;
				model.Destroy();
				if (id && id !== "") {
					EMOTE_TO_ANIM_CACHE.set(emoteId, id);
					return id;
				}
			}

			// 1b) Không có Animation -> thử KeyframeSequence
			let kfs: KeyframeSequence | undefined;
			for (const d of model.GetDescendants()) {
				if (!kfs && d.IsA("KeyframeSequence")) {
					kfs = d;
					break;
				}
			}
			if (kfs) {
				const contentId = KeyframeSequenceProvider.RegisterKeyframeSequence(kfs);
				model.Destroy();
				EMOTE_TO_ANIM_CACHE.set(emoteId, contentId);
				return contentId;
			}

			model.Destroy();
		}
	}

	// 2) Fallback: KSP trực tiếp bằng content id
	{
		const contentId = `rbxassetid://${emoteId}`;
		const [ok, kfs] = pcall(() => KeyframeSequenceProvider.GetKeyframeSequenceAsync(contentId));
		if (ok && kfs && kfs.IsA("KeyframeSequence")) {
			const registered = KeyframeSequenceProvider.RegisterKeyframeSequence(kfs);
			EMOTE_TO_ANIM_CACHE.set(emoteId, registered);
			return registered;
		}
	}

	throw `Emote ${emoteId} không thể lấy Animation/KeyframeSequence (asset không chứa Animation/KeyframeSequence & KSP cũng thất bại)`;
}

/* ==========================================================
   2) HELPERS: Humanoid / Animator
   ========================================================== */

function getHumanoidOf(p: Player): Humanoid | undefined {
	const char = p.Character ?? p.CharacterAdded.Wait()[0];
	return char.FindFirstChildOfClass("Humanoid") as Humanoid | undefined;
}

function getOrCreateAnimator(h: Humanoid): Animator {
	let animator = h.FindFirstChildOfClass("Animator");
	if (!animator) {
		animator = new Instance("Animator");
		animator.Parent = h;
	}
	return animator;
}

/* ==========================================================
   3) INIT SERVICE: Remote handlers
   ========================================================== */

/**
 * Khởi tạo service:
 * - requestEmoteAnim: client hỏi server convert emoteId -> animId (để preview)
 * - playEmote: client yêu cầu server play emote (theo tên hoặc assetId) để replicate
 */
export function initEmoteAnimService() {
	/* ------ A) Convert emoteId -> AnimationId (trả về client) ------ */
	remotes.server.requestEmoteAnim.connect((player, reqId, emoteId) => {
		const [ok, result] = pcall(() => convertEmoteToAnimationId(emoteId));
		if (ok) {
			remotes.client.emoteAnimResponse.fire(player, reqId, emoteId, result as string);
		} else {
			warn("[EmoteAnimService] convert failed:", result);
			remotes.client.emoteAnimResponse.fire(player, reqId, emoteId, undefined, tostring(result));
		}
	});
	remotes.server.stopEmote.connect((player, fadeOut = 0.15) => {
		const hum = player.Character?.FindFirstChildOfClass("Humanoid");
		if (!hum) return;

		const animator = hum.FindFirstChildOfClass("Animator");
		if (!animator) return;

		for (const tr of animator.GetPlayingAnimationTracks()) {
			if (tr.IsPlaying) tr.Stop(fadeOut);
		}
	});

	/* ------ B) Server play emote: replicate cho tất cả ------ */
	remotes.server.playEmote.connect((player, payload, opts?: PlayEmoteOpts) => {
		const hum = getHumanoidOf(player);
		if (!hum || hum.Health <= 0) return;

		const options: Required<PlayEmoteOpts> = {
			priority: opts?.priority ?? Enum.AnimationPriority.Action,
			weight: opts?.weight ?? 1,
			fadeIn: opts?.fadeIn ?? 0.15,
			speed: opts?.speed ?? 1,
			looped: opts?.looped ?? true,
			stopOthers: opts?.stopOthers ?? true,
		};

		// (Tuỳ chọn) WHITELIST UGC emote IDs nếu muốn an toàn hơn
		// const ALLOW = new Set<number>([ /* ids... */ ]);

		// A) Emote theo TÊN (có trong HumanoidDescription.Emotes hoặc emote mặc định)
		// A) Emote theo TÊN
		if (payload.kind === "name") {
			const value = payload.value;
			if (typeOf(value) !== "string" || value === "") return;

			const ok = hum.PlayEmote(value); // <- trả về boolean trong rbxts
			if (!ok) warn("[Emote] PlayEmote(name) failed");
			return;
		}

		// B) Emote theo ASSET ID (UGC)
		const emoteId = payload.value;
		if (typeOf(emoteId) !== "number" || emoteId <= 0) return;
		// if (!ALLOW.has(emoteId)) return; // bật nếu cần whitelist

		let animId: string;
		{
			const [ok, result] = pcall(() => convertEmoteToAnimationId(emoteId));
			if (!ok) {
				warn("[Emote] convertEmoteToAnimationId failed:", result);
				return;
			}
			animId = result as string;
		}

		const animator = getOrCreateAnimator(hum);

		if (options.stopOthers) {
			for (const tr of animator.GetPlayingAnimationTracks()) tr.Stop(0.1);
		}

		const anim = new Instance("Animation");
		anim.AnimationId = animId;

		let track: AnimationTrack | undefined;
		const [ok, err] = pcall(() => (track = animator.LoadAnimation(anim)));
		if (!ok || !track) {
			warn("[Emote] LoadAnimation failed:", err);
			return;
		}

		track.Priority = options.priority;
		track.Looped = options.looped;
		track.Play(options.fadeIn, options.weight, options.speed);
	});
}
