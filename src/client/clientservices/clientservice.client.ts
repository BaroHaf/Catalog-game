// src/client/components/shop/shopui/DescriptionWatcher.client.ts
// (1) Bắt reset nhân vật -> onCharacterReset
// (2) Bắt thay outfit trên cùng Character -> onNewOutfitApplied
// (3) Nếu added >= BURST_THRESHOLD -> gửi full desc hiện tại cho server (hard)
// So sánh CHỈ dựa trên HumanoidDescription (kể cả layered qua GetAccessories(true)).

import { Players, RunService } from "@rbxts/services";
import { resetcharacter } from "client/components/shop/shopui/util/camerarotation";
import { remotes, BodyColorsData } from "shared/remotes";
import { applyDescriptionToAllTargets } from "client/components/shop/shopui/util/camerarotation";
import { initAvatarCache } from "./avatar-cache";
const LOCAL_PLAYER = Players.LocalPlayer!;
const POLL_INTERVAL_SEC = 1;
const BURST_THRESHOLD = 3;
const FORCE_WEAR_COOLDOWN_SEC = 2;

// ===== DEBUG =====
let lastForceWearAt = 0;
// thêm ở đầu file (gần các const khác)
const MOVE_STOP_COOLDOWN_SEC = 0.5; // tránh spam remote khi nhân vật đang chạy

// ===== HOOKS =====
function onCharacterReset(character: Model, humanoid: Humanoid) {
	resetcharacter();
}

function onNewOutfitApplied(newDesc: HumanoidDescription, added: number[], removed: number[]) {
	print("[Watcher] onNewOutfitApplied");
	print("  Added:", added);
	print("  Removed:", removed);

	if (added.size() >= BURST_THRESHOLD) {
		const now = os.clock();
		if (now - lastForceWearAt >= FORCE_WEAR_COOLDOWN_SEC) {
			lastForceWearAt = now;
			sendFullWear(newDesc);
		} else {
			print("[Watcher] (skip) cooldown");
		}
	}
}

// ===== TIỆN ÍCH =====
function csvToIds(csv: string): number[] {
	const out: number[] = [];
	if (csv.size() === 0) return out;
	for (const part of csv.split(",")) {
		const clean = part.gsub("%s+", "")[0];
		const n = tonumber(clean);
		if (n && n > 0) out.push(n);
	}
	return out;
}

// ===== GOM ASSET ID CHO SO SÁNH (CHỈ TỪ DESC) =====
// 1) Classic (quần áo, face, CSV accessories legacy, body parts, animations)
function collectClassicIds(desc: HumanoidDescription): number[] {
	const ids: number[] = [];

	// quần áo/face (đơn lẻ)
	if (desc.Shirt > 0) ids.push(desc.Shirt);
	if (desc.Pants > 0) ids.push(desc.Pants);
	if (desc.GraphicTShirt > 0) ids.push(desc.GraphicTShirt);
	if (desc.Face > 0) ids.push(desc.Face);

	// accessories CSV legacy
	const csvs = [
		desc.HatAccessory,
		desc.HairAccessory,
		desc.FaceAccessory,
		desc.NeckAccessory,
		desc.ShouldersAccessory,
		desc.FrontAccessory,
		desc.BackAccessory,
		desc.WaistAccessory,
	];
	for (const csv of csvs) for (const id of csvToIds(csv)) ids.push(id);

	// body parts + animations (giữ theo yêu cầu)
	const singles = [
		desc.Torso,
		desc.LeftArm,
		desc.RightArm,
		desc.LeftLeg,
		desc.RightLeg,
		desc.Head,
		desc.ClimbAnimation,
		desc.FallAnimation,
		desc.IdleAnimation,
		desc.JumpAnimation,
		desc.RunAnimation,
		desc.SwimAnimation,
		desc.WalkAnimation,
	];
	for (const id of singles) if (id > 0) ids.push(id);

	return ids;
}
// 2) Lấy ID accessories (kể cả layered) trực tiếp từ desc:GetAccessories(true)
function collectAccessoryIdsFromDesc(desc: HumanoidDescription): number[] {
	const out: number[] = [];

	// Gọi trực tiếp trên object để roblox-ts sinh dấu ':'
	const arr = (desc as HumanoidDescription).GetAccessories(true) as ReadonlyArray<{
		AssetId: number;
		AccessoryType: Enum.AccessoryType;
		IsLayered: boolean;
	}>;

	for (const acc of arr) {
		if (acc.AssetId > 0) out.push(acc.AssetId);
	}
	return out;
}

// 3) IDs dùng cho SO SÁNH (KHÔNG dùng humanoid ở đây!)
function getIdsFromDescOnly(desc: HumanoidDescription): number[] {
	const seen: { [k: number]: true } = {};
	const out: number[] = [];

	const push = (id: number) => {
		if (id > 0 && !seen[id]) {
			seen[id] = true;
			out.push(id);
		}
	};

	for (const id of collectClassicIds(desc)) push(id);
	for (const id of collectAccessoryIdsFromDesc(desc)) push(id);

	out.sort();
	return out;
}

function buildSignature(desc: HumanoidDescription): string {
	return getIdsFromDescOnly(desc).join(",");
}

function diffIds(prev: HumanoidDescription, curr: HumanoidDescription) {
	const a = getIdsFromDescOnly(prev);
	const b = getIdsFromDescOnly(curr);

	const setA: { [k: number]: true } = {};
	for (const id of a) setA[id] = true;

	const setB: { [k: number]: true } = {};
	for (const id of b) setB[id] = true;

	const added: number[] = [];
	const removed: number[] = [];

	for (const id of b) if (!setA[id]) added.push(id);
	for (const id of a) if (!setB[id]) removed.push(id);

	return { added, removed };
}

function waitHumanoid(character: Model): Humanoid {
	return character.WaitForChild("Humanoid") as Humanoid;
}

// ===== GỬI FULL WEAR LÊN SERVER (CÓ THỂ DÙNG FALLBACK TỪ HUMANOID) =====
// 3) (tuỳ chọn) Fallback từ humanoid:GetAccessories() — KHÔNG dùng any/call
function collectAccessoryIdsFromHumanoid(humanoid?: Humanoid): number[] {
	const out: number[] = [];
	if (!humanoid) return out;

	// Gọi trực tiếp -> roblox-ts sinh 'humanoid:GetAccessories()'
	const parts = (humanoid as Humanoid).GetAccessories() as ReadonlyArray<Instance>;

	for (const acc of parts) {
		const attr = (acc as unknown as { GetAttribute?: (k: string) => unknown }).GetAttribute?.("AssetId");
		if (typeOf(attr) === "number" && (attr as number) > 0) {
			out.push(attr as number);
			continue;
		}
		const nv = acc.FindFirstChild("AssetId");
		if (nv && nv.IsA("NumberValue") && nv.Value > 0) out.push(nv.Value);
	}
	return out;
}

/** IDs gửi lên server = DescOnly + (fallback từ humanoid nếu muốn chắc chắn gom đủ layered) */
function getIdsForSending(desc: HumanoidDescription, humanoid?: Humanoid): number[] {
	const seen: { [k: number]: true } = {};
	const out: number[] = [];
	const push = (id: number) => {
		if (id > 0 && !seen[id]) {
			seen[id] = true;
			out.push(id);
		}
	};

	for (const id of getIdsFromDescOnly(desc)) push(id);
	for (const id of collectAccessoryIdsFromHumanoid(humanoid)) push(id);

	out.sort();
	return out;
}

// ===== GỬI FULL WEAR BẰNG DESC (ĐƠN GIẢN) =====
function sendFullWear(_: HumanoidDescription) {
	const hum = LOCAL_PLAYER.Character?.FindFirstChildOfClass("Humanoid");
	if (!hum) return;

	// Lấy trạng thái hiện tại của nhân vật, ROBLOX sẽ trả về HumanoidDescription
	// đã bao gồm toàn bộ accessories, kể cả layered.
	const applied = hum.GetAppliedDescription();

	// Clone để tránh side-effect nếu hàm apply có Destroy/ghi đè
	const descToApply = applied.Clone() as HumanoidDescription;

	// Hard = true để ApplyDescriptionReset ở chỗ implement của bạn (nếu có)
	applyDescriptionToAllTargets(descToApply, true);
}

// ===== WATCHER =====
class DescriptionWatcher {
	private character?: Model;
	private humanoid?: Humanoid;

	private lastDesc?: HumanoidDescription;
	private lastSig = "";
	private justReset = false;

	private conns: RBXScriptConnection[] = [];
	private hb?: RBXScriptConnection;
	private pollAccum = 0;

	private charAddedConn?: RBXScriptConnection;

	constructor() {
		this.charAddedConn = LOCAL_PLAYER.CharacterAdded.Connect((char) => this.attach(char));
		if (LOCAL_PLAYER.Character) this.attach(LOCAL_PLAYER.Character);
	}

	private attach(character: Model) {
		this.cleanup();
		this.character = character;

		task.spawn(() => {
			const hum = waitHumanoid(character);
			this.humanoid = hum;

			this.justReset = true;
			onCharacterReset(character, hum);

			// ⬇️⬇️ NEW: auto stop emote khi nhân vật bắt đầu di chuyển
			let lastStopAt = 0;
			const runningConn = hum.Running.Connect((speed) => {
				if (speed > 0.1) {
					const now = os.clock();
					if (now - lastStopAt >= MOVE_STOP_COOLDOWN_SEC) {
						lastStopAt = now;
						// Dừng emote server (replicate)
						remotes.server.stopEmote.fire(0.12);
						// (tuỳ chọn) dừng emote local preview nếu bạn muốn:
						// stopEmote(0.12);
					}
				}
			});
			this.conns.push(runningConn);
			// ⬆️⬆️ END NEW

			const loaded = LOCAL_PLAYER.CharacterAppearanceLoaded.Connect((char) => {
				if (char === this.character && this.humanoid) this.captureBaseline();
			});
			this.conns.push(loaded);

			task.delay(1, () => this.captureBaseline());
			this.startPolling();
		});
	}

	private captureBaseline() {
		if (!this.humanoid) return;
		const desc = this.humanoid.GetAppliedDescription();
		this.lastDesc = desc;
		this.lastSig = buildSignature(desc); // ❗ so sánh CHỈ từ desc
		this.justReset = false;
		print("[Watcher] Baseline captured");
	}

	private startPolling() {
		if (this.hb && this.hb.Connected) return;
		this.hb = RunService.Heartbeat.Connect((dt) => this.onHeartbeat(dt));
	}

	private onHeartbeat(dt: number) {
		this.pollAccum += dt;
		if (this.pollAccum < POLL_INTERVAL_SEC) return;
		this.pollAccum = 0;

		if (!this.character || !this.character.Parent) return;
		if (!this.humanoid) return;

		const curr = this.humanoid.GetAppliedDescription();
		const sig = buildSignature(curr); // ❗ so sánh CHỈ từ desc

		if (!this.lastDesc) {
			this.lastDesc = curr;
			this.lastSig = sig;
			return;
		}

		if (sig !== this.lastSig) {
			const { added, removed } = diffIds(this.lastDesc, curr); // ❗ KHÔNG truyền humanoid

			if (this.justReset) {
				this.justReset = false;
				this.lastDesc = curr;
				this.lastSig = sig;
				return;
			}

			onNewOutfitApplied(curr, added, removed);
			this.lastDesc = curr;
			this.lastSig = sig;
		}
	}

	private cleanup() {
		for (const c of this.conns) if (c.Connected) c.Disconnect();
		this.conns.clear();

		if (this.hb && this.hb.Connected) this.hb.Disconnect();
		this.hb = undefined;

		this.lastDesc = undefined;
		this.lastSig = "";
		this.pollAccum = 0;
		this.justReset = false;
	}

	public destroy() {
		this.cleanup();
		if (this.charAddedConn && this.charAddedConn.Connected) this.charAddedConn.Disconnect();
		this.charAddedConn = undefined;
	}
}

// ===== BOOT =====
new DescriptionWatcher();
initAvatarCache();
