// src/client/components/shop/shopui/util/camerarotation.ts
import { Players, ReplicatedStorage, MarketplaceService } from "@rbxts/services";
import { remotes, type OutfitDelta } from "shared/remotes";

/* =========================
   0) BUS SỰ KIỆN UI (tuỳ dùng)
   ========================= */
const AssetsChangedEvent = new Instance("BindableEvent");
export function onAssetsChanged(callback: () => void): RBXScriptConnection {
	return AssetsChangedEvent.Event.Connect(callback);
}
function notifyAssetsChanged() {
	AssetsChangedEvent.Fire();
}

/* =========================
   1) PUBLIC OPTIONS & DEFAULTS
   ========================= */
export type ViewportOpts = {
	fov?: number;
	yawDeg?: number;
	pitchDeg?: number;
	rollDeg?: number;
	paddingScale?: number;
	zoom?: number;
	light?: boolean;
	cache?: boolean;
	framing?: "full" | "half";
	focusYOffsetRatio?: number;
	lockFacing?: boolean;
};

export const DEFAULT_VIEWPORT_OPTS: Required<
	Pick<
		ViewportOpts,
		| "fov"
		| "yawDeg"
		| "pitchDeg"
		| "rollDeg"
		| "paddingScale"
		| "zoom"
		| "light"
		| "framing"
		| "focusYOffsetRatio"
		| "cache"
		| "lockFacing"
	>
> = {
	fov: 35,
	yawDeg: 0,
	pitchDeg: 0,
	rollDeg: 0,
	paddingScale: 1.12,
	zoom: 1,
	light: false,
	framing: "full",
	focusYOffsetRatio: -0.1,
	cache: true,
	lockFacing: false,
};
/** Field -> các AvatarAssetType hợp lệ (dùng để verify trước khi gán) */
const FIELD_EXPECTED_TYPES: Partial<Record<HDKey, Enum.AvatarAssetType[]>> = {
	// classic clothing + face
	Shirt: [Enum.AvatarAssetType.Shirt],
	Pants: [Enum.AvatarAssetType.Pants],
	GraphicTShirt: [Enum.AvatarAssetType.TShirt],
	Face: [Enum.AvatarAssetType.Face],

	// accessories (CSV)
	HatAccessory: [Enum.AvatarAssetType.Hat],
	HairAccessory: [Enum.AvatarAssetType.HairAccessory],
	FaceAccessory: [Enum.AvatarAssetType.FaceAccessory],
	NeckAccessory: [Enum.AvatarAssetType.NeckAccessory],
	ShouldersAccessory: [Enum.AvatarAssetType.ShoulderAccessory],
	FrontAccessory: [Enum.AvatarAssetType.FrontAccessory],
	BackAccessory: [Enum.AvatarAssetType.BackAccessory],
	WaistAccessory: [Enum.AvatarAssetType.WaistAccessory],

	// body (single-number)
	Head: [Enum.AvatarAssetType.Head, Enum.AvatarAssetType.DynamicHead],
	Torso: [Enum.AvatarAssetType.Torso],
	LeftArm: [Enum.AvatarAssetType.LeftArm],
	RightArm: [Enum.AvatarAssetType.RightArm],
	LeftLeg: [Enum.AvatarAssetType.LeftLeg],
	RightLeg: [Enum.AvatarAssetType.RightLeg],
};

/* =========================
   2) INTERNAL HELPERS
   ========================= */

type PlayersWithAsync = Players & {
	GetHumanoidDescriptionFromUserIdAsync: (userId: number) => HumanoidDescription;
};
type PlayersWithSync = Players & {
	GetHumanoidDescriptionFromUserId: (userId: number) => HumanoidDescription;
};
function hasAsyncAPI(p: unknown): p is PlayersWithAsync {
	return (p as Partial<PlayersWithAsync>).GetHumanoidDescriptionFromUserIdAsync !== undefined;
}
function hasSyncAPI(p: unknown): p is PlayersWithSync {
	return (p as Partial<PlayersWithSync>).GetHumanoidDescriptionFromUserId !== undefined;
}

function getHumanoidDescriptionCompat(userId: number): HumanoidDescription {
	if (hasAsyncAPI(Players)) {
		const [ok, desc] = pcall(() => (Players as PlayersWithAsync).GetHumanoidDescriptionFromUserIdAsync(userId));
		if (ok && desc) return desc;
		warn("[avatar] GetHumanoidDescriptionFromUserIdAsync failed, falling back sync…");
	}
	if (hasSyncAPI(Players)) {
		const [ok, desc] = pcall(() => (Players as PlayersWithSync).GetHumanoidDescriptionFromUserId(userId));
		if (ok && desc) return desc;
	}
	error("[avatar] Failed to get HumanoidDescription");
}

function getCacheFolder(userId: number): Folder {
	let root = ReplicatedStorage.FindFirstChild("cached") as Folder;
	if (!root) {
		root = new Instance("Folder");
		root.Name = "cached";
		root.Parent = ReplicatedStorage;
	}
	let pf = root.FindFirstChild(tostring(userId)) as Folder;
	if (!pf) {
		pf = new Instance("Folder");
		pf.Name = tostring(userId);
		pf.Parent = root;
	}
	return pf;
}

function buildViewportAvatar(userId: number): Model {
	const lp = Players.LocalPlayer!;
	const hum = lp.Character?.FindFirstChildOfClass("Humanoid");
	const desc = hum ? hum.GetAppliedDescription() : getHumanoidDescriptionCompat(userId);

	const model = Players.CreateHumanoidModelFromDescription(desc, Enum.HumanoidRigType.R15) as Model;
	model.Name = "Character";
	const hrp = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	if (hrp) model.PrimaryPart = hrp;
	return model;
}
function mergedOpts(overrides?: ViewportOpts) {
	return { ...DEFAULT_VIEWPORT_OPTS, ...(overrides ?? {}) };
}

/* =========================
   3) GLOBAL REGISTRY + HOOK BUS
   ========================= */

let Targets: Humanoid[] = []; // các humanoid trong mọi viewport
let Primary: Humanoid | undefined; // humanoid “chuẩn” để đọc/ghi desc

function registerHumanoid(h: Humanoid) {
	Targets.push(h);
	if (!Primary) Primary = h;
	safeBindClearOnDestroy(h);
	flushPendingIfReady();
}
function unregisterHumanoid(h: Humanoid) {
	const idx = Targets.indexOf(h);
	if (idx >= 0) Targets.remove(idx);
	if (Primary === h) Primary = Targets[0];
	if (Targets.size() === 0) Primary = undefined;
}
function getAnyTarget(): Humanoid | undefined {
	return Primary ?? Targets[0];
}
export function getPrimaryHumanoid(): Humanoid | undefined {
	return getAnyTarget();
}

let PendingOps: Array<() => void> = [];
function enqueueOrRun(op: () => void) {
	if (Targets.size() > 0) op();
	else PendingOps.push(op);
}
function flushPendingIfReady() {
	if (Targets.size() === 0 || PendingOps.size() === 0) return;
	const ops = PendingOps;
	PendingOps = [];
	for (const f of ops) {
		const [ok, err] = pcall(f);
		if (!ok) warn("[avatar] Pending op failed:", err);
	}
}

/** Reframe hooks – mỗi viewport đăng ký một cái */
let ReframeHooks = new Set<() => void>();
export function requestReframe() {
	for (const f of ReframeHooks) {
		const [ok, err] = pcall(f);
		if (!ok) warn("[avatar] Reframe hook error:", err);
	}
}

// clear target nếu viewport/model bị xóa
function safeBindClearOnDestroy(inst: Instance) {
	inst.AncestryChanged.Connect((_c, parent) => {
		if (!parent) {
			// unregister thực hiện ở cleanup
		}
	});
}

/* =========================
   4) ASSET ↔︎ HumanoidDescription KEYS
   ========================= */

type HDKey = keyof HumanoidDescription;

/** Map AvatarAssetType → field trong HumanoidDescription (KHÔNG include layered clothing) */
export function getHDKeyForAssetType(assetType: Enum.AvatarAssetType): HDKey | undefined {
	switch (assetType) {
		// clothing classic + face
		case Enum.AvatarAssetType.Shirt:
			return "Shirt";
		case Enum.AvatarAssetType.Pants:
			return "Pants";
		case Enum.AvatarAssetType.Face:
			return "Face";
		case Enum.AvatarAssetType.TShirt:
			return "GraphicTShirt";

		// accessories (CSV)
		case Enum.AvatarAssetType.Hat:
			return "HatAccessory";
		case Enum.AvatarAssetType.HairAccessory:
			return "HairAccessory";
		case Enum.AvatarAssetType.FaceAccessory:
			return "FaceAccessory";
		case Enum.AvatarAssetType.NeckAccessory:
			return "NeckAccessory";
		case Enum.AvatarAssetType.ShoulderAccessory:
			return "ShouldersAccessory";
		case Enum.AvatarAssetType.FrontAccessory:
			return "FrontAccessory";
		case Enum.AvatarAssetType.BackAccessory:
			return "BackAccessory";
		case Enum.AvatarAssetType.WaistAccessory:
			return "WaistAccessory";

		// BODY (single number)
		case Enum.AvatarAssetType.Head:
		case Enum.AvatarAssetType.DynamicHead:
			return "Head";
		case Enum.AvatarAssetType.Torso:
			return "Torso";
		case Enum.AvatarAssetType.LeftArm:
			return "LeftArm";
		case Enum.AvatarAssetType.RightArm:
			return "RightArm";
		case Enum.AvatarAssetType.LeftLeg:
			return "LeftLeg";
		case Enum.AvatarAssetType.RightLeg:
			return "RightLeg";
	}
	return undefined;
}

// xác định AvatarAssetType của 1 assetId để verify
function getAssetType(assetId: number): Enum.AvatarAssetType | undefined {
	if (assetId <= 0) return undefined;
	const [ok, infoRaw] = pcall(() => MarketplaceService.GetProductInfo(assetId));
	if (!ok || typeOf(infoRaw) !== "table") return undefined;
	const info = infoRaw as unknown as { AssetTypeId?: number };
	const at = info.AssetTypeId;
	if (!at) return undefined;
	return Enum.AvatarAssetType.GetEnumItems().find((x) => x.Value === at);
}

const toCsv = (ids: number[]) => ids.join(",");
const fromCsv = (s: string) => {
	const out = new Array<number>();
	if (s && s !== "")
		for (const raw of s.split(",")) {
			const n = tonumber(raw);
			if (n !== undefined) out.push(n);
		}
	return out;
};
const uniquePush = (list: number[], id: number) => {
	if (id > 0 && !list.includes(id)) list.push(id);
};

const ACCESSORY_KEYS = [
	"HatAccessory",
	"HairAccessory",
	"FaceAccessory",
	"NeckAccessory",
	"ShouldersAccessory",
	"FrontAccessory",
	"BackAccessory",
	"WaistAccessory",
] as const;
const CLOTH_KEYS = ["Shirt", "Pants", "GraphicTShirt", "Face"] as const;
// NEW: BODY keys
const BODY_KEYS = ["Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg"] as const;

/* =========================
   5) UNIFIED DESCRIPTION CACHE
   ========================= */

// Color keys
const COLOR_KEYS = [
	"HeadColor",
	"TorsoColor",
	"LeftArmColor",
	"RightArmColor",
	"LeftLegColor",
	"RightLegColor",
] as const;
type ColorKey = (typeof COLOR_KEYS)[number];

// Scale raw keys (field thật trong HumanoidDescription)
const SCALE_RAW_KEYS = [
	"HeightScale",
	"WidthScale",
	"DepthScale",
	"HeadScale",
	"BodyTypeScale",
	"ProportionScale",
] as const;
type ScaleRawKey = (typeof SCALE_RAW_KEYS)[number];

// Snapshot: clothes(numbers), accessories(csv), body(numbers), colors(Color3), scales(numbers)
// Snapshot: clothes(numbers), accessories(csv), body(numbers), colors(Color3), scales(numbers), layered(list)
type DescSnapshot = Partial<Record<(typeof CLOTH_KEYS)[number], number>> &
	Partial<Record<(typeof ACCESSORY_KEYS)[number], string>> &
	Partial<Record<(typeof BODY_KEYS)[number], number>> &
	Partial<Record<ColorKey, Color3>> &
	Partial<Record<ScaleRawKey, number>> & {
		// ✅ LAYERED: lưu cả danh sách layered (LayeredAccessoryInfo)
		// Đúng: lưu về AccessoryInfo[] cho an toàn
		LayeredAccessories?: AccessoryInfo[];
	};

let DescCache: DescSnapshot | undefined;

function snapshotFromDesc(d: HumanoidDescription): DescSnapshot {
	const snap: DescSnapshot = {};

	// clothes (single-number)
	for (let i = 0; i < CLOTH_KEYS.size(); i++) {
		const k = CLOTH_KEYS[i] as string;
		const v = (d as unknown as Record<string, number>)[k];
		if (typeOf(v) === "number") (snap as unknown as Record<string, number>)[k] = v;
	}

	// accessories csv
	for (let i = 0; i < ACCESSORY_KEYS.size(); i++) {
		const k = ACCESSORY_KEYS[i] as string;
		const v = (d as unknown as Record<string, string>)[k];
		if (typeOf(v) === "string") (snap as unknown as Record<string, string>)[k] = v;
	}

	// body (single-number)
	for (let i = 0; i < BODY_KEYS.size(); i++) {
		const k = BODY_KEYS[i] as string;
		const v = (d as unknown as Record<string, number>)[k];
		if (typeOf(v) === "number") (snap as unknown as Record<string, number>)[k] = v;
	}

	// colors
	for (let i = 0; i < COLOR_KEYS.size(); i++) {
		const ck = COLOR_KEYS[i] as string;
		const v = (d as unknown as Record<string, Color3>)[ck];
		if (typeOf(v) === "Color3") (snap as unknown as Record<string, Color3>)[ck] = v;
	}

	// scales
	for (let i = 0; i < SCALE_RAW_KEYS.size(); i++) {
		const sk = SCALE_RAW_KEYS[i] as string;
		const v = (d as unknown as Record<string, number>)[sk];
		if (typeOf(v) === "number") (snap as unknown as Record<string, number>)[sk] = v;
	}

	// LAYERED: lưu các món IsLayered
	do {
		const [ok, accs] = pcall(() => d.GetAccessories(true));
		if (!ok || !accs) {
			snap.LayeredAccessories = [];
			break;
		}
		const layeredOnly = accs.filter((it) => {
			const a = it as unknown as { IsLayered?: boolean };
			return a.IsLayered === true;
		}) as AccessoryInfo[];
		snap.LayeredAccessories = layeredOnly;
	} while (false);

	// (tuỳ chọn) debug
	// print(`[SNAP][MAKE] layered=${snap.LayeredAccessories?.size() ?? 0}`);

	return snap;
}

function persistFromDesc(d: HumanoidDescription) {
	DescCache = snapshotFromDesc(d);
}
export function clearDescriptionCache() {
	DescCache = undefined;
}

/* =========================
   6) APPLY & BROADCAST CORE (an toàn)
   ========================= */

// Remove any duplicate usage of an ID across single-number fields vs accessory CSVs.
function dedupeAgainstBodyAndClothes(d: HumanoidDescription) {
	const singles = new Array<number>();
	for (let i = 0; i < CLOTH_KEYS.size(); i++) {
		const k = CLOTH_KEYS[i] as string;
		const v = (d as unknown as Record<string, number>)[k];
		if (typeOf(v) === "number" && (v as number) > 0) singles.push(v as number);
	}
	for (let i = 0; i < BODY_KEYS.size(); i++) {
		const k = BODY_KEYS[i] as string;
		const v = (d as unknown as Record<string, number>)[k];
		if (typeOf(v) === "number" && (v as number) > 0) singles.push(v as number);
	}
	if (singles.size() === 0) return;

	// remove those ids from all accessory CSVs
	for (let i = 0; i < ACCESSORY_KEYS.size(); i++) {
		const k = ACCESSORY_KEYS[i] as string;
		const s = (d as unknown as Record<string, string>)[k];
		if (typeOf(s) === "string" && s !== "") {
			const list = fromCsv(s as string).filter((id) => !singles.includes(id));
			(d as unknown as Record<string, string>)[k] = toCsv(list);
		}
	}
}

function safeApplyHumanoid(h: Humanoid, desc: HumanoidDescription, hard: boolean) {
	// thử lần 1
	{
		const [ok, err] = hard ? pcall(() => h.ApplyDescriptionReset(desc)) : pcall(() => h.ApplyDescription(desc));
		if (ok) return true;

		const msg = tostring(err);
		if (msg && msg.find("has the same asset used more than once") !== undefined) {
			warn("[avatar] duplicate detected, dedup and retry once…", msg);
			dedupeAgainstBodyAndClothes(desc);
		} else {
			warn("[avatar] apply failed:", err);
			return false;
		}
	}
	// thử lần 2 sau khi dedupe
	const [ok2, err2] = hard ? pcall(() => h.ApplyDescriptionReset(desc)) : pcall(() => h.ApplyDescription(desc));
	if (!ok2) {
		warn("[avatar] apply failed after dedupe:", err2);
		return false;
	}
	return true;
}

function applyClothesBodyAndAccessories(toHum: Humanoid, srcDesc: HumanoidDescription, hard = false) {
	const d = toHum.GetAppliedDescription();

	// clothes
	for (let i = 0; i < CLOTH_KEYS.size(); i++) {
		const k = CLOTH_KEYS[i] as string;
		(d as unknown as Record<string, unknown>)[k] = (srcDesc as unknown as Record<string, unknown>)[k];
	}
	// body singles
	for (let i = 0; i < BODY_KEYS.size(); i++) {
		const k = BODY_KEYS[i] as string;
		(d as unknown as Record<string, unknown>)[k] = (srcDesc as unknown as Record<string, unknown>)[k];
	}
	// accessories CSV
	for (let i = 0; i < ACCESSORY_KEYS.size(); i++) {
		const k = ACCESSORY_KEYS[i] as string;
		(d as unknown as Record<string, unknown>)[k] = (srcDesc as unknown as Record<string, unknown>)[k];
	}

	// ✅ NEW: COPY LAYERED ACCESSORIES (rất quan trọng)
	const layered = srcDesc.GetAccessories(true);
	d.SetAccessories(layered, true);

	dedupeAgainstBodyAndClothes(d);
	safeApplyHumanoid(toHum, d, hard);
}

/** đồng bộ prefab cache (nếu có) để lần mount sau clone ra đã đúng */
function refreshCachePrefab(userId: number) {
	if (!DescCache) return;
	const folder = getCacheFolder(userId);
	const prefab = folder.FindFirstChild("Character");
	if (prefab && prefab.IsA("Model")) {
		const hum = prefab.FindFirstChildOfClass("Humanoid");
		if (hum) applySnapshotToHumanoid(hum, DescCache, false);
	}
}

// soft/hard apply snapshot
function applySnapshotToHumanoid(h: Humanoid, snap: DescSnapshot, hard = false) {
	const d = h.GetAppliedDescription();
	// clothes
	for (let i = 0; i < CLOTH_KEYS.size(); i++) {
		const k = CLOTH_KEYS[i] as string;
		const v = (snap as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "number") (d as unknown as Record<string, number>)[k] = v as number;
	}
	// body
	for (let i = 0; i < BODY_KEYS.size(); i++) {
		const k = BODY_KEYS[i] as string;
		const v = (snap as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "number") (d as unknown as Record<string, number>)[k] = v as number;
	}
	// accessories
	for (let i = 0; i < ACCESSORY_KEYS.size(); i++) {
		const k = ACCESSORY_KEYS[i] as string;
		const v = (snap as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "string") (d as unknown as Record<string, string>)[k] = v as string;
	}
	// colors
	for (let i = 0; i < COLOR_KEYS.size(); i++) {
		const ck = COLOR_KEYS[i] as string;
		const v = (snap as unknown as Record<string, unknown>)[ck];
		if (typeOf(v) === "Color3") (d as unknown as Record<string, Color3>)[ck] = v as Color3;
	}
	// scales
	for (let i = 0; i < SCALE_RAW_KEYS.size(); i++) {
		const sk = SCALE_RAW_KEYS[i] as string;
		const v = (snap as unknown as Record<string, unknown>)[sk];
		if (typeOf(v) === "number") (d as unknown as Record<string, number>)[sk] = v as number;
	}
	// RESTORE LAYERED: set lại giống 1 "field"
	if (snap.LayeredAccessories !== undefined) {
		const onlyLayered = (snap.LayeredAccessories ?? []).filter((it) => {
			const a = it as unknown as { IsLayered?: boolean };
			return a.IsLayered === true;
		}) as AccessoryInfo[];
		d.SetAccessories(onlyLayered, false); // giữ nguyên rigid
	}

	dedupeAgainstBodyAndClothes(d);
	safeApplyHumanoid(h, d, hard);
}

/** Broadcast một desc (đã chỉnh) tới tất cả humanoid & cập nhật cache hợp nhất */
function broadcastApplyFrom(srcDesc: HumanoidDescription, hard = false) {
	persistFromDesc(srcDesc);

	for (let i = 0; i < Targets.size(); i++) {
		const hum = Targets[i];
		applyClothesBodyAndAccessories(hum, srcDesc, hard);
		if (DescCache) applySnapshotToHumanoid(hum, DescCache, hard);
	}

	const uid = Players.LocalPlayer?.UserId;
	if (uid !== undefined) refreshCachePrefab(uid);

	requestReframe();
	notifyAssetsChanged();
}

/* =========================
   7) PUBLIC: OUTFIT OPS (BROADCAST)
   ========================= */

export function isAssetApplied(assetType: Enum.AvatarAssetType, assetId: number): boolean {
	const hum = getAnyTarget();
	if (!hum || assetId <= 0) return false;
	const key = getHDKeyForAssetType(assetType);
	if (!key) return false;

	const desc = hum.GetAppliedDescription();

	// single-number fields (clothes + body)
	if (CLOTH_KEYS.includes(key as never) || BODY_KEYS.includes(key as never)) {
		return (desc as unknown as Record<string, number>)[key] === assetId;
	}

	// CSV accessories
	const current = (desc as unknown as Record<string, string>)[key] as string | undefined;
	const list = fromCsv(current ?? "");
	return list.includes(assetId);
}

/** Gỡ đúng món ra khỏi mọi viewport (broadcast + gửi server) */
export function takeOffAsset(assetType: Enum.AvatarAssetType, assetId: number) {
	if (assetId <= 0) return;
	enqueueOrRun(() => {
		const base = getAnyTarget();
		if (!base) return;
		const desc = base.GetAppliedDescription();

		const key = getHDKeyForAssetType(assetType);
		if (!key) return;

		if (CLOTH_KEYS.includes(key as never) || BODY_KEYS.includes(key as never)) {
			const cur = (desc as unknown as Record<string, number>)[key];
			if (cur === assetId) (desc as unknown as Record<string, number>)[key] = 0;
		} else {
			const current = (desc as unknown as Record<string, string>)[key] as string | undefined;
			const list = fromCsv(current ?? "");
			const idx = list.indexOf(assetId);
			if (idx >= 0) list.remove(idx);
			(desc as unknown as Record<string, string>)[key] = toCsv(list);
		}

		// preview hard (đổi outfit)
		broadcastApplyFrom(desc, true);

		// gửi server (hard)
		if (CLOTH_KEYS.includes(key as never) || BODY_KEYS.includes(key as never)) {
			remotes.server.outfitDelta.fire({ [key]: 0, hard: true } as unknown as OutfitDelta);
		} else {
			const csv = (desc as unknown as Record<string, string>)[key] as string;
			remotes.server.outfitDelta.fire({ [key]: csv, hard: true } as unknown as OutfitDelta);
		}
	});
}

/** Áp món vào outfit (broadcast + gửi server) – an toàn & có verify type */
let tryOnInFlight = false;
export function tryOnAsset(assetType: Enum.AvatarAssetType, assetId: number, opts?: { replaceList?: boolean }) {
	if (assetId <= 0) return;
	if (tryOnInFlight) return;
	tryOnInFlight = true;
	task.defer(() => (tryOnInFlight = false));

	enqueueOrRun(() => {
		const base = getAnyTarget();
		if (!base) return;
		const desc = base.GetAppliedDescription();

		const key = getHDKeyForAssetType(assetType);
		if (!key) return;

		// verify asset type khớp field dự kiến (tránh nhầm Head -> Hat)
		const resolved = getAssetType(assetId);
		const expected = (FIELD_EXPECTED_TYPES[key] ?? []) as Enum.AvatarAssetType[];
		if (resolved && expected.size() > 0 && !expected.includes(resolved)) {
			warn(`[avatar] tryOn blocked: asset ${assetId} type=${resolved.Name} không khớp field ${key}`);
			return;
		}

		let payload: OutfitDelta;

		// single-number (clothes + body)
		if (CLOTH_KEYS.includes(key as never) || BODY_KEYS.includes(key as never)) {
			(desc as unknown as Record<string, number>)[key] = assetId;

			// nếu là BODY, remove id này khỏi mọi CSV accessories (chống trùng)
			if (BODY_KEYS.includes(key as never)) {
				for (let i = 0; i < ACCESSORY_KEYS.size(); i++) {
					const ak = ACCESSORY_KEYS[i] as string;
					const csv = (desc as unknown as Record<string, string>)[ak] as string | undefined;
					if (typeOf(csv) === "string" && csv !== "") {
						const list = fromCsv(csv as string).filter((id) => id !== assetId);
						(desc as unknown as Record<string, string>)[ak] = toCsv(list);
					}
				}
			}

			payload = { [key]: assetId, hard: true } as unknown as OutfitDelta;
		} else {
			// CSV accessories
			const current = (desc as unknown as Record<string, string>)[key] as string | undefined;
			const list = fromCsv(current ?? "");
			if (opts?.replaceList) {
				(desc as unknown as Record<string, string>)[key] = toCsv([assetId]);
			} else {
				uniquePush(list, assetId);
				(desc as unknown as Record<string, string>)[key] = toCsv(list);
			}
			payload = { [key]: (desc as unknown as Record<string, string>)[key], hard: true } as unknown as OutfitDelta;
		}

		// preview hard (đổi outfit)
		broadcastApplyFrom(desc, true);

		// gửi server (hard)
		remotes.server.outfitDelta.fire(payload);
	});
}

/** Reset nhanh (tuỳ chọn clear quần áo) – broadcast + gửi server */
export function resetTryOn(clearClothes = false) {
	enqueueOrRun(() => {
		const base = getAnyTarget();
		if (!base) return;
		const d = base.GetAppliedDescription();
		// clear accessories
		d.HatAccessory = "";
		d.HairAccessory = "";
		d.FaceAccessory = "";
		d.NeckAccessory = "";
		d.ShouldersAccessory = "";
		d.FrontAccessory = "";
		d.BackAccessory = "";
		d.WaistAccessory = "";
		if (clearClothes) {
			d.Shirt = 0;
			d.Pants = 0;
			d.GraphicTShirt = 0;
			// d.Face = 0;
		}
		// cập nhật cache & broadcast (hard cho chắc)
		persistFromDesc(d);
		broadcastApplyFrom(d, true);

		// gửi server (hard)
		const payload: OutfitDelta = {
			HatAccessory: "",
			HairAccessory: "",
			FaceAccessory: "",
			NeckAccessory: "",
			ShouldersAccessory: "",
			FrontAccessory: "",
			BackAccessory: "",
			WaistAccessory: "",
			hard: true,
		};
		if (clearClothes) {
			payload.Shirt = 0;
			payload.Pants = 0;
			payload.GraphicTShirt = 0;
		}
		remotes.server.outfitDelta.fire(payload);
	});
}

/* =========================
   8) CONTROLLER + VIEWPORT
   ========================= */
export type ViewportController = {
	setYawPitch(yawDeg: number, pitchDeg: number): void;
	orbitBy(deltaYawDeg: number, deltaPitchDeg: number): void;
	setZoom(zoom: number): void;
	nudgeZoom(delta: number): void;
	getView(): { yawDeg: number; pitchDeg: number; zoom: number };
};

export function setupViewportFromCachedCharacter(
	viewport: ViewportFrame,
	userId: number,
	options?: ViewportOpts,
): { start: () => Promise<void>; cleanup: () => void; controller: ViewportController } {
	let cam: Camera | undefined;
	let world: WorldModel | undefined;
	let display: Model | undefined;
	let displayHum: Humanoid | undefined;

	const opts = mergedOpts(options);

	// data để tính camera
	let rawCenter = new Vector3(0, 0, 0);
	let rawSize = new Vector3(1, 1, 1);

	const recompute = () => {
		if (!cam || !display) return;

		const ui = viewport.AbsoluteSize;
		const aspect = ui.Y > 0 ? ui.X / ui.Y : 1;

		const vFov = math.rad(opts.fov);
		const hFov = 2 * math.atan(math.tan(vFov / 2) * aspect);

		const spanY = opts.framing === "half" ? rawSize.Y * 0.55 : rawSize.Y;
		const spanH = math.max(rawSize.X, rawSize.Z);

		const distV = spanY / 2 / math.tan(vFov / 2);
		const distH = spanH / 2 / math.tan(hFov / 2);

		const distBase = math.max(distV, distH) * opts.paddingScale;
		const dist = distBase * (opts.zoom ?? 1);

		const target = rawCenter.add(new Vector3(0, (opts.focusYOffsetRatio ?? 0) * rawSize.Y, 0));

		const yaw = math.rad(opts.yawDeg);
		const pitch = math.rad(opts.pitchDeg);
		const roll = math.rad(opts.rollDeg ?? 0);

		const rot = CFrame.fromEulerAnglesYXZ(-pitch, yaw, roll);
		const forward = rot.LookVector;
		const camPos = target.sub(forward.mul(dist));

		cam.FieldOfView = opts.fov;
		cam.CFrame = CFrame.lookAt(camPos, target);

		if (opts.lockFacing && display) {
			const pivot = display.GetPivot();
			display.PivotTo(CFrame.lookAt(pivot.Position, camPos));
		}
	};

	// hook riêng của viewport này
	const reframeThisViewport = () => {
		if (!display) return;
		const [bbCFrame, size] = display.GetBoundingBox();
		rawCenter = bbCFrame.Position;
		rawSize = size;
		recompute();
	};

	const controller: ViewportController = {
		setYawPitch(yawDeg, pitchDeg) {
			opts.yawDeg = yawDeg;
			opts.pitchDeg = math.clamp(pitchDeg, -85, 85);
			recompute();
		},
		orbitBy(dYaw, dPitch) {
			controller.setYawPitch((opts.yawDeg ?? 0) + dYaw, (opts.pitchDeg ?? 0) + dPitch);
		},
		setZoom(z) {
			opts.zoom = math.max(0.2, z);
			recompute();
		},
		nudgeZoom(delta) {
			controller.setZoom((opts.zoom ?? 1) + delta);
		},
		getView() {
			return { yawDeg: opts.yawDeg, pitchDeg: opts.pitchDeg, zoom: opts.zoom ?? 1 };
		},
	};

	const start = async () => {
		// 1) Build / cache model
		if (opts.cache) {
			const folder = getCacheFolder(userId);
			const existed = folder.FindFirstChild("Character");
			if (existed && existed.IsA("Model")) {
				display = (existed as Model).Clone();
			} else {
				const built = buildViewportAvatar(userId);
				built.Parent = folder;
				display = built.Clone();
			}
		} else {
			display = buildViewportAvatar(userId);
		}

		// 2) Hạ tầng viewport (CHƯA gán CurrentCamera)
		world = new Instance("WorldModel");
		world.Parent = viewport;

		cam = new Instance("Camera");
		cam.FieldOfView = opts.fov;
		cam.Parent = viewport;

		if (opts.light) {
			viewport.Ambient = new Color3(1, 1, 1);
			viewport.LightColor = new Color3(1, 1, 1);
		}

		// tránh chớp: ẩn viewport trong lúc setup
		const prevVisible = viewport.Visible;
		viewport.Visible = false;

		// 3) Đưa model vào world & lấy humanoid
		display.Parent = world;
		displayHum = display.FindFirstChildOfClass("Humanoid")!;
		registerHumanoid(displayHum);

		// 4) Reframe hook & ÁP LẠI DESC CACHE (nếu có) TRƯỚC khi show
		ReframeHooks.add(reframeThisViewport);
		applyCachedDescriptionIfAny(false); // apply mềm để tránh giật
		notifyAssetsChanged();

		// 5) Tính bbox + camera lần đầu
		const [bbCFrame, size] = display.GetBoundingBox();
		rawCenter = bbCFrame.Position;
		rawSize = size;
		recompute();

		// 6) Bây giờ mới gán CurrentCamera
		viewport.CurrentCamera = cam;

		// 7) Cho hiện lại
		viewport.Visible = prevVisible;

		// 8) Chạy các pending ops (nếu có)
		flushPendingIfReady();
	};

	const cleanup = () => {
		ReframeHooks.delete(reframeThisViewport);
		if (displayHum) unregisterHumanoid(displayHum);

		if (viewport && cam && viewport.CurrentCamera === cam) viewport.CurrentCamera = undefined;
		cam?.Destroy();
		world?.Destroy();
	};

	return { start, cleanup, controller };
}

/* =========================
   9) BODY COLOR + SELECTION (UI helpers)
   ========================= */

export type BodyRegion = "Head" | "Torso" | "LeftArm" | "RightArm" | "LeftLeg" | "RightLeg";
export type BodyRegionExt = BodyRegion | "All";

const REGIONS: BodyRegion[] = ["Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg"];

const BODY_SETTERS: Record<BodyRegion, (d: HumanoidDescription, c: Color3) => void> = {
	Head: (d, c) => (d.HeadColor = c),
	Torso: (d, c) => (d.TorsoColor = c),
	LeftArm: (d, c) => (d.LeftArmColor = c),
	RightArm: (d, c) => (d.RightArmColor = c),
	LeftLeg: (d, c) => (d.LeftLegColor = c),
	RightLeg: (d, c) => (d.RightLegColor = c),
};

export function isViewportReady() {
	return Targets.size() > 0;
}

export function colorFromSliders(huePct: number, valPct: number) {
	const h = math.clamp(huePct, 0, 1);
	const v = math.clamp(valPct, 0, 1);
	return Color3.fromHSV(h, 1, v);
}

export function getCurrentBodyColor(): Color3 | undefined {
	if (DescCache?.TorsoColor) return DescCache.TorsoColor;
	const hum = getAnyTarget();
	if (hum) return hum.GetAppliedDescription().TorsoColor;
	return undefined;
}

let SelectedMap: Record<BodyRegionExt, boolean> = {
	All: true,
	Head: true,
	Torso: true,
	LeftArm: true,
	RightArm: true,
	LeftLeg: true,
	RightLeg: true,
};
function recomputeAll() {
	SelectedMap.All = REGIONS.every((k) => SelectedMap[k]);
}
export function getSelectedMap(): Readonly<Record<BodyRegionExt, boolean>> {
	return { ...SelectedMap };
}
export function setSelected(key: BodyRegionExt, value: boolean) {
	if (key === "All") {
		for (let i = 0; i < REGIONS.size(); i++) SelectedMap[REGIONS[i]] = value;
		SelectedMap.All = value;
	} else {
		SelectedMap[key] = value;
		recomputeAll();
	}
}
export function toggleSelected(key: BodyRegionExt) {
	setSelected(key, !SelectedMap[key]);
}

/** Áp màu (persist & broadcast – + gửi server) */
export function applyBodyColor(color: Color3, region?: BodyRegion, snapToBrick = false): boolean {
	const c3 = snapToBrick ? new BrickColor(color).Color : color;

	const targets: BodyRegion[] = region ? [region] : SelectedMap.All ? REGIONS : REGIONS.filter((r) => SelectedMap[r]);

	enqueueOrRun(() => {
		const base = getAnyTarget();
		if (!base) return;
		const desc = base.GetAppliedDescription();

		for (let i = 0; i < targets.size(); i++) BODY_SETTERS[targets[i]](desc, c3);

		// cập nhật cache hợp nhất
		if (!DescCache) DescCache = snapshotFromDesc(desc);
		for (let i = 0; i < targets.size(); i++) {
			const key = (targets[i] + "Color") as ColorKey;
			(DescCache as unknown as Record<string, Color3>)[key] = c3;
		}

		// preview soft
		broadcastApplyFrom(desc);

		// gửi server (soft) – chỉ những phần đổi
		const payload: Partial<OutfitDelta> = {};
		for (let i = 0; i < targets.size(); i++) {
			const k = (targets[i] + "Color") as keyof OutfitDelta;
			(payload as Record<string, Color3>)[k as string] = c3;
		}
		remotes.server.outfitDelta.fire(payload as OutfitDelta);
	});

	return true;
}

/* =========================
   10) BODY SCALES (UI helpers)
   ========================= */

export type ScaleKey =
	| "HeightScale"
	| "WidthScale"
	| "DepthScale"
	| "HeadScale"
	| "BodyTypeScale"
	| "BodyProportionScale"; // UI gọi “Proportions”

// Giới hạn an toàn cho R15
const SCALE_LIMITS: Record<ScaleKey, { min: number; max: number }> = {
	HeightScale: { min: 0.9, max: 1.05 },
	WidthScale: { min: 0.7, max: 1.05 },
	DepthScale: { min: 0.9, max: 1.05 },
	HeadScale: { min: 0.95, max: 1.05 },
	BodyTypeScale: { min: 0, max: 1 },
	BodyProportionScale: { min: 0, max: 1 }, // field thật là ProportionScale
};

// map UI key -> field thực trên HumanoidDescription
const SCALE_FIELD_MAP: Record<ScaleKey, keyof HumanoidDescription> = {
	HeightScale: "HeightScale",
	WidthScale: "WidthScale",
	DepthScale: "DepthScale",
	HeadScale: "HeadScale",
	BodyTypeScale: "BodyTypeScale",
	BodyProportionScale: "ProportionScale",
};

// convert % (0..1) <-> value thực (có clamp)
const toPct = (key: ScaleKey, value: number) => {
	const lim = SCALE_LIMITS[key];
	const span = math.max(1e-9, lim.max - lim.min);
	return math.clamp((value - lim.min) / span, 0, 1);
};
const fromPct = (key: ScaleKey, pct: number) => {
	const lim = SCALE_LIMITS[key];
	const v = lim.min + math.clamp(pct, 0, 1) * (lim.max - lim.min);
	return math.clamp(v, lim.min, lim.max);
};

function readScaleRaw(key: ScaleKey, d: HumanoidDescription): number {
	const field = SCALE_FIELD_MAP[key];
	return (d as unknown as Record<string, number>)[field];
}

/** Lấy % hiện tại cho UI (ưu tiên DescCache) */
export function getCurrentScales(): Record<ScaleKey, number> {
	const out: Record<ScaleKey, number> = {
		HeightScale: 0.5,
		WidthScale: 0.5,
		DepthScale: 0.5,
		HeadScale: 0.5,
		BodyTypeScale: 0.5,
		BodyProportionScale: 0.5,
	};

	if (DescCache) {
		out.HeightScale = toPct("HeightScale", DescCache.HeightScale ?? 1);
		out.WidthScale = toPct("WidthScale", DescCache.WidthScale ?? 1);
		out.DepthScale = toPct("DepthScale", DescCache.DepthScale ?? 1);
		out.HeadScale = toPct("HeadScale", DescCache.HeadScale ?? 1);
		out.BodyTypeScale = toPct("BodyTypeScale", DescCache.BodyTypeScale ?? 0.5);
		out.BodyProportionScale = toPct("BodyProportionScale", DescCache.ProportionScale ?? 0.5);
		return out;
	}

	const hum = getAnyTarget();
	if (!hum) return out;
	const d = hum.GetAppliedDescription();

	out.HeightScale = toPct("HeightScale", readScaleRaw("HeightScale", d));
	out.WidthScale = toPct("WidthScale", readScaleRaw("WidthScale", d));
	out.DepthScale = toPct("DepthScale", readScaleRaw("DepthScale", d));
	out.HeadScale = toPct("HeadScale", readScaleRaw("HeadScale", d));
	out.BodyTypeScale = toPct("BodyTypeScale", readScaleRaw("BodyTypeScale", d));
	out.BodyProportionScale = toPct("BodyProportionScale", readScaleRaw("BodyProportionScale", d));

	return out;
}

/** Set theo % 0..1, cập nhật DescCache & broadcast + gửi server */
export function setScalePct(key: ScaleKey, pct: number) {
	const clamped = math.clamp(pct, 0, 1);

	enqueueOrRun(() => {
		const base = getAnyTarget();
		if (!base) return;

		const desc = base.GetAppliedDescription();
		const field = SCALE_FIELD_MAP[key] as string;
		(desc as unknown as Record<string, number>)[field] = fromPct(key, clamped);

		// cập nhật DescCache
		if (!DescCache) DescCache = snapshotFromDesc(desc);
		(DescCache as unknown as Record<string, number>)[field] = (desc as unknown as Record<string, number>)[field];

		// preview soft
		broadcastApplyFrom(desc);

		// gửi server (soft)
		const val = (desc as unknown as Record<string, number>)[field];
		remotes.server.outfitDelta.fire({ [field]: val } as unknown as OutfitDelta);
	});
}

/* =========================
   11) APPLY CACHE VÀO TẤT CẢ TARGETS
   ========================= */
export function applyCachedDescriptionIfAny(hard = false) {
	if (!DescCache) return;
	for (let i = 0; i < Targets.size(); i++) applySnapshotToHumanoid(Targets[i], DescCache, hard);
}
/** Apply 1 HumanoidDescription lên tất cả viewport humanoids + update DescCache. */
export function applyDescriptionToAllTargets(desc: HumanoidDescription, hard = false) {
	broadcastApplyFrom(desc, hard);
}

/** Từ 2 slider (hue 0..1, value 0..1) sinh Color3 rồi áp vào phần body chọn. */
export function applyBodyColorFromSliders(huePct: number, valPct: number, region?: BodyRegion, snapToBrick = false) {
	return applyBodyColor(colorFromSliders(huePct, valPct), region, snapToBrick);
}

/* =========================
   12) ASSET INSPECTION (IDs & Names)
   ========================= */

export type SimpleAssetInfo = { id: number; name: string };

function getAssetName(assetId: number): string {
	const [ok, info] = pcall(() => MarketplaceService.GetProductInfo(assetId));
	if (ok && typeOf(info) === "table") {
		const t = info as unknown as Record<string, unknown>;
		const nm = t.Name;
		if (typeOf(nm) === "string") return nm as string;
	}
	return `#${tostring(assetId)}`;
}

function collectAssetIdsFromDesc(d: HumanoidDescription): number[] {
	const ids = new Array<number>();

	for (let i = 0; i < CLOTH_KEYS.size(); i++) {
		const k = CLOTH_KEYS[i] as string;
		const v = (d as unknown as Record<string, number>)[k];
		if (typeOf(v) === "number" && (v as number) > 0) ids.push(v as number);
	}
	for (let i = 0; i < BODY_KEYS.size(); i++) {
		const k = BODY_KEYS[i] as string;
		const v = (d as unknown as Record<string, number>)[k];
		if (typeOf(v) === "number" && (v as number) > 0) ids.push(v as number);
	}
	for (let i = 0; i < ACCESSORY_KEYS.size(); i++) {
		const k = ACCESSORY_KEYS[i] as string;
		const v = (d as unknown as Record<string, string>)[k];
		if (typeOf(v) === "string") {
			const csv = v as string;
			if (csv !== "") {
				const parts = csv.split(",");
				for (let j = 0; j < parts.size(); j++) {
					const raw = parts[j];
					const n = tonumber(raw);
					if (n && n > 0) ids.push(n);
				}
			}
		}
	}

	const seen = new Map<number, true>();
	const out = new Array<number>();
	for (let i = 0; i < ids.size(); i++) {
		const id = ids[i];
		if (!seen.get(id)) {
			seen.set(id, true as true);
			out.push(id);
		}
	}
	return out;
}

function collectAssetIdsFromSnapshot(snap: DescSnapshot): number[] {
	const ids = new Array<number>();

	for (let i = 0; i < CLOTH_KEYS.size(); i++) {
		const k = CLOTH_KEYS[i] as string;
		const v = (snap as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "number" && (v as number) > 0) ids.push(v as number);
	}
	for (let i = 0; i < BODY_KEYS.size(); i++) {
		const k = BODY_KEYS[i] as string;
		const v = (snap as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "number" && (v as number) > 0) ids.push(v as number);
	}
	for (let i = 0; i < ACCESSORY_KEYS.size(); i++) {
		const k = ACCESSORY_KEYS[i] as string;
		const v = (snap as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "string") {
			const csv = v as string;
			if (csv !== "") {
				const parts = csv.split(",");
				for (let j = 0; j < parts.size(); j++) {
					const raw = parts[j];
					const n = tonumber(raw);
					if (n && n > 0) ids.push(n);
				}
			}
		}
	}

	const seen = new Map<number, true>();
	const out = new Array<number>();
	for (let i = 0; i < ids.size(); i++) {
		const id = ids[i];
		if (!seen.get(id)) {
			seen.set(id, true as true);
			out.push(id);
		}
	}
	return out;
}

export function getCurrentHumanoidAssets(): SimpleAssetInfo[] {
	const base = getPrimaryHumanoid();
	if (!base) return [];

	const ids = DescCache
		? collectAssetIdsFromSnapshot(DescCache)
		: collectAssetIdsFromDesc(base.GetAppliedDescription());
	const result = new Array<SimpleAssetInfo>();
	for (let i = 0; i < ids.size(); i++) {
		const id = ids[i];
		const name = getAssetName(id);
		result.push({ id, name });
	}
	return result;
}

const FIELD_TO_ASSETTYPE: Partial<Record<string, Enum.AvatarAssetType>> = {
	Shirt: Enum.AvatarAssetType.Shirt,
	Pants: Enum.AvatarAssetType.Pants,
	Face: Enum.AvatarAssetType.Face,
	GraphicTShirt: Enum.AvatarAssetType.TShirt,
	HatAccessory: Enum.AvatarAssetType.Hat,
	HairAccessory: Enum.AvatarAssetType.HairAccessory,
	FaceAccessory: Enum.AvatarAssetType.FaceAccessory,
	NeckAccessory: Enum.AvatarAssetType.NeckAccessory,
	ShouldersAccessory: Enum.AvatarAssetType.ShoulderAccessory,
	FrontAccessory: Enum.AvatarAssetType.FrontAccessory,
	BackAccessory: Enum.AvatarAssetType.BackAccessory,
	WaistAccessory: Enum.AvatarAssetType.WaistAccessory,

	Head: Enum.AvatarAssetType.Head,
	Torso: Enum.AvatarAssetType.Torso,
	LeftArm: Enum.AvatarAssetType.LeftArm,
	RightArm: Enum.AvatarAssetType.RightArm,
	LeftLeg: Enum.AvatarAssetType.LeftLeg,
	RightLeg: Enum.AvatarAssetType.RightLeg,
};

export function getWornAssetTypeForId(assetId: number): Enum.AvatarAssetType | undefined {
	const hum = getPrimaryHumanoid();
	if (!hum || assetId <= 0) return undefined;

	const d = DescCache ? DescCache : snapshotFromDesc(hum.GetAppliedDescription());

	for (let i = 0; i < CLOTH_KEYS.size(); i++) {
		const k = CLOTH_KEYS[i] as string;
		const v = (d as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "number" && (v as number) === assetId) {
			return FIELD_TO_ASSETTYPE[k];
		}
	}
	for (let i = 0; i < BODY_KEYS.size(); i++) {
		const k = BODY_KEYS[i] as string;
		const v = (d as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "number" && (v as number) === assetId) {
			return FIELD_TO_ASSETTYPE[k];
		}
	}
	for (let i = 0; i < ACCESSORY_KEYS.size(); i++) {
		const k = ACCESSORY_KEYS[i] as string;
		const v = (d as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "string" && (v as string) !== "") {
			for (const raw of (v as string).split(",")) {
				const n = tonumber(raw);
				if (n && n === assetId) return FIELD_TO_ASSETTYPE[k];
			}
		}
	}
	return undefined;
}

/* =========================
   13) RESET VỀ OUTFIT HỒ SƠ ROBLOX (PROFILE)
   ========================= */

const c3ToRGB = (c: Color3) =>
	[math.floor(c.R * 255), math.floor(c.G * 255), math.floor(c.B * 255)] as [number, number, number];

// Chỉ dùng API sync hợp lệ trên Client. Nếu lỗi, fallback sang desc đang mặc trên nhân vật thật.
function getProfileDescriptionOf(userId: number): HumanoidDescription {
	const [ok, desc] = pcall(() => Players.GetHumanoidDescriptionFromUserId(userId));
	if (ok && desc) return desc;

	// fallback: lấy từ nhân vật thật hiện tại (nếu có)
	const lp = Players.LocalPlayer!;
	const hum = lp.Character?.FindFirstChildOfClass("Humanoid");
	if (hum) return hum.GetAppliedDescription();

	error("[avatar] Failed to get profile HumanoidDescription");
}

// Preview tất cả viewport + gửi server wearOutfit(name, assets, hard, colors)
export function resetToProfileOutfit(hard = true) {
	const lp = Players.LocalPlayer!;
	const userId = lp.UserId;

	// 1) Lấy desc của PROFILE (không phải bộ đang try-on trong viewport)
	const desc = getProfileDescriptionOf(userId);

	// 2) Preview lên tất cả viewport (đồng thời cập nhật cache)
	broadcastApplyFrom(desc, hard);

	// 3) Chuẩn hoá body colors -> RGB object
	const colors = {
		head: c3ToRGB(desc.HeadColor),
		torso: c3ToRGB(desc.TorsoColor),
		leftArm: c3ToRGB(desc.LeftArmColor),
		rightArm: c3ToRGB(desc.RightArmColor),
		leftLeg: c3ToRGB(desc.LeftLegColor),
		rightLeg: c3ToRGB(desc.RightLegColor),
	};

	// 4) Lấy danh sách asset id từ desc
	const assets = collectAssetIdsFromDesc(desc);
	remotes.server.wearOutfit.fire("[PROFILE]", assets, hard, colors);
}
/* =========================
   EMOTE UGC PLAYBACK (CLIENT)
   ========================= */

// Cache emoteId -> AnimationId
const EmoteAnimIdCache = new Map<number, string>();
// Mỗi humanoid chỉ giữ 1 track emote đang chạy để dừng dễ
const EmoteTrackByHumanoid = new WeakMap<Humanoid, AnimationTrack>();
// Request-id tăng dần để ghép response đúng
let _REQ_SEQ = 0;
function nextReqId() {
	_REQ_SEQ += 1;
	return _REQ_SEQ;
}

// Đợi server trả animId qua remote emoteAnimResponse (có timeout)
function fetchEmoteAnimationId(emoteId: number, timeoutSec = 8): Promise<string> {
	const cached = EmoteAnimIdCache.get(emoteId);
	if (cached) return Promise.resolve(cached);

	const reqId = nextReqId();
	return new Promise((resolve, reject) => {
		let done = false;

		const off = remotes.client.emoteAnimResponse.connect((rid, eid, animId, err) => {
			if (rid !== reqId) return; // không phải response của mình
			done = true;
			off();
			if (err) return reject(err as unknown as string);
			if (!animId) return reject("No AnimationId");
			EmoteAnimIdCache.set(eid, animId);
			resolve(animId);
		});

		task.delay(timeoutSec, () => {
			if (!done) {
				off();
				reject(`Timeout waiting emote animId for ${emoteId}`);
			}
		});

		remotes.server.requestEmoteAnim.fire(reqId, emoteId);
	});
}

function getOrCreateAnimator(h: Humanoid): Animator {
	let animator = h.FindFirstChildOfClass("Animator");
	if (!animator) {
		animator = new Instance("Animator");
		animator.Parent = h;
	}
	return animator;
}

type TryOnEmoteOpts = {
	priority?: Enum.AnimationPriority; // default Action
	weight?: number; // default 1
	fadeIn?: number; // default 0.15
	looped?: boolean; // default true
	stopOthers?: boolean; // default true
};

/** Play UGC emote lên TẤT CẢ Targets (viewport humanoids) */
export async function tryOnEmote(emoteAssetId: number, opts?: TryOnEmoteOpts) {
	if (emoteAssetId <= 0) return;

	const options: Required<TryOnEmoteOpts> = {
		priority: opts?.priority ?? Enum.AnimationPriority.Action,
		weight: opts?.weight ?? 1,
		fadeIn: opts?.fadeIn ?? 0.15,
		looped: opts?.looped ?? true,
		stopOthers: opts?.stopOthers ?? true,
	};

	enqueueOrRun(async () => {
		if (Targets.size() === 0) return;

		let animId: string;
		try {
			animId = await fetchEmoteAnimationId(emoteAssetId);
		} catch (e) {
			warn("[emote] fetch failed:", e);
			return;
		}

		for (let i = 0; i < Targets.size(); i++) {
			const hum = Targets[i];
			if (!hum || hum.Health <= 0) continue;

			if (options.stopOthers) {
				const old = EmoteTrackByHumanoid.get(hum);
				if (old && old.IsPlaying) old.Stop(0.1);
			}

			const animator = getOrCreateAnimator(hum);
			const anim = new Instance("Animation");
			anim.AnimationId = animId;

			let track: AnimationTrack | undefined;
			const [ok, err] = pcall(() => (track = animator.LoadAnimation(anim)));
			if (!ok || !track) {
				warn("[emote] LoadAnimation failed:", err);
				continue;
			}

			track.Priority = options.priority;
			track.Looped = options.looped;

			EmoteTrackByHumanoid.set(hum, track);
			track.Play(options.fadeIn, options.weight);
		}

		// Emote có thể thay pose -> reframe nếu cần
		requestReframe();
	});
}

/** Dừng emote hiện tại trên tất cả Targets */
export function stopEmote(fadeOut = 0.15) {
	enqueueOrRun(() => {
		for (let i = 0; i < Targets.size(); i++) {
			const hum = Targets[i];
			const tr = EmoteTrackByHumanoid.get(hum);
			if (tr && tr.IsPlaying) tr.Stop(fadeOut);
		}
	});
}
