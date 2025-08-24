// src/client/components/shop/shopui/util/camerarotation.ts
import { Players, ReplicatedStorage, MarketplaceService } from "@rbxts/services";

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
		warn("GetHumanoidDescriptionFromUserIdAsync failed, falling back…");
	}
	if (hasSyncAPI(Players)) {
		const [ok, desc] = pcall(() => (Players as PlayersWithSync).GetHumanoidDescriptionFromUserId(userId));
		if (ok && desc) return desc;
	}
	error("Failed to get HumanoidDescription");
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

let Targets = new Array<Humanoid>(); // các humanoid trong mọi viewport
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
		if (!ok) warn("Pending op failed:", err);
	}
}

/** Reframe hooks – mỗi viewport đăng ký một cái */
let ReframeHooks = new Set<() => void>();
export function requestReframe() {
	for (const f of ReframeHooks) {
		const [ok, err] = pcall(f);
		if (!ok) warn("Reframe hook error:", err);
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
   4) ACCESSORY & OUTFIT KEYS
   ========================= */

type HDKey = keyof HumanoidDescription;

/** Map AvatarAssetType → field trong HumanoidDescription */
export function getHDKeyForAssetType(assetType: Enum.AvatarAssetType): HDKey | undefined {
	switch (assetType) {
		case Enum.AvatarAssetType.Shirt:
			return "Shirt";
		case Enum.AvatarAssetType.Pants:
			return "Pants";
		case Enum.AvatarAssetType.Face:
			return "Face";
		case Enum.AvatarAssetType.TShirt:
			return "GraphicTShirt";
		// Accessories (CSV)
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
	}
	return undefined;
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

// Snapshot: clothes(numbers), accessories(csv), colors(Color3), scales(numbers)
type DescSnapshot = Partial<Record<(typeof CLOTH_KEYS)[number], number>> &
	Partial<Record<(typeof ACCESSORY_KEYS)[number], string>> &
	Partial<Record<ColorKey, Color3>> &
	Partial<Record<ScaleRawKey, number>>;

let DescCache: DescSnapshot | undefined;

function snapshotFromDesc(d: HumanoidDescription): DescSnapshot {
	const snap: DescSnapshot = {};
	// clothes
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
	return snap;
}

// trước: function applySnapshotToHumanoid(h: Humanoid, snap: DescSnapshot) {
function applySnapshotToHumanoid(h: Humanoid, snap: DescSnapshot, hard = false) {
	const d = h.GetAppliedDescription();
	// clothes
	for (let i = 0; i < CLOTH_KEYS.size(); i++) {
		const k = CLOTH_KEYS[i] as string;
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

	// ⚠️ đổi chỗ này:
	hard ? h.ApplyDescriptionReset(d) : h.ApplyDescription(d);
}

function persistFromDesc(d: HumanoidDescription) {
	DescCache = snapshotFromDesc(d);
}
export function clearDescriptionCache() {
	DescCache = undefined;
}

/* =========================
   6) BROADCAST CORE
   ========================= */

// trước: function applyClothesAndAccessories(toHum: Humanoid, srcDesc: HumanoidDescription) {
function applyClothesAndAccessories(toHum: Humanoid, srcDesc: HumanoidDescription, hard = false) {
	const d = toHum.GetAppliedDescription();
	for (let i = 0; i < CLOTH_KEYS.size(); i++) {
		const k = CLOTH_KEYS[i] as string;
		(d as unknown as Record<string, unknown>)[k] = (srcDesc as unknown as Record<string, unknown>)[k];
	}
	for (let i = 0; i < ACCESSORY_KEYS.size(); i++) {
		const k = ACCESSORY_KEYS[i] as string;
		(d as unknown as Record<string, unknown>)[k] = (srcDesc as unknown as Record<string, unknown>)[k];
	}
	// ⚠️ đổi chỗ này:
	hard ? toHum.ApplyDescriptionReset(d) : toHum.ApplyDescription(d);
}

/** đồng bộ prefab cache (nếu có) để lần mount sau clone ra đã đúng */
function refreshCachePrefab(userId: number) {
	if (!DescCache) return;
	const folder = getCacheFolder(userId);
	const prefab = folder.FindFirstChild("Character");
	if (prefab && prefab.IsA("Model")) {
		const hum = prefab.FindFirstChildOfClass("Humanoid");
		if (hum) applySnapshotToHumanoid(hum, DescCache);
	}
}

/** Broadcast một desc (đã chỉnh) tới tất cả humanoid & cập nhật cache hợp nhất */
// trước: function broadcastApplyFrom(srcDesc: HumanoidDescription) {
function broadcastApplyFrom(srcDesc: HumanoidDescription, hard = false) {
	persistFromDesc(srcDesc);
	for (let i = 0; i < Targets.size(); i++) {
		const hum = Targets[i];
		// quần áo & phụ kiện -> đi qua applyClothesAndAccessories (theo hard)
		applyClothesAndAccessories(hum, srcDesc, hard);
		// đảm bảo đồng bộ snapshot (theo hard)
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

/** Kiểm tra item đã áp vào outfit hiện thời chưa (đọc từ Primary) */
export function isAssetApplied(assetType: Enum.AvatarAssetType, assetId: number): boolean {
	const hum = getAnyTarget();
	if (!hum || assetId <= 0) return false;
	const key = getHDKeyForAssetType(assetType);
	if (!key) return false;

	const desc = hum.GetAppliedDescription();
	if (key === "Shirt" || key === "Pants" || key === "Face" || key === "GraphicTShirt") {
		return (desc as unknown as Record<string, number>)[key] === assetId;
	} else {
		const current = (desc as unknown as Record<string, string>)[key] as string | undefined;
		const list = fromCsv(current ?? "");
		return list.includes(assetId);
	}
}

/** Gỡ đúng món ra khỏi mọi viewport (broadcast) */
export function takeOffAsset(assetType: Enum.AvatarAssetType, assetId: number) {
	if (assetId <= 0) return;
	enqueueOrRun(() => {
		const base = getAnyTarget();
		if (!base) return;
		const desc = base.GetAppliedDescription();

		const key = getHDKeyForAssetType(assetType);
		if (!key) return;

		if (key === "Shirt" || key === "Pants" || key === "Face" || key === "GraphicTShirt") {
			const cur = (desc as unknown as Record<string, number>)[key];
			if (cur === assetId) (desc as unknown as Record<string, number>)[key] = 0;
		} else {
			const current = (desc as unknown as Record<string, string>)[key] as string | undefined;
			const list = fromCsv(current ?? "");
			const idx = list.indexOf(assetId);
			if (idx >= 0) list.remove(idx);
			(desc as unknown as Record<string, string>)[key] = toCsv(list);
		}
		broadcastApplyFrom(desc, true);
	});
}

/** Áp món vào outfit (broadcast) */
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

		if (key === "Shirt" || key === "Pants" || key === "Face" || key === "GraphicTShirt") {
			(desc as unknown as Record<string, number>)[key] = assetId;
		} else {
			const current = (desc as unknown as Record<string, string>)[key] as string | undefined;
			const list = fromCsv(current ?? "");
			if (opts?.replaceList) {
				(desc as unknown as Record<string, string>)[key] = toCsv([assetId]);
			} else {
				uniquePush(list, assetId);
				(desc as unknown as Record<string, string>)[key] = toCsv(list);
			}
		}
		broadcastApplyFrom(desc, true);
	});
}

/** Reset nhanh (tuỳ chọn clear quần áo) – broadcast */
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
		// cập nhật cache & broadcast
		persistFromDesc(d);
		broadcastApplyFrom(d);
	});
}

/* =========================
   8) CONTROLLER
   ========================= */
export type ViewportController = {
	setYawPitch(yawDeg: number, pitchDeg: number): void;
	orbitBy(deltaYawDeg: number, deltaPitchDeg: number): void;
	setZoom(zoom: number): void;
	nudgeZoom(delta: number): void;
	getView(): { yawDeg: number; pitchDeg: number; zoom: number };
};

/* =========================
   9) PUBLIC API – SETUP VIEWPORT
   ========================= */

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
		applyCachedDescriptionIfAny(false); // 👈 quan trọng để không “hồi sinh” phụ kiện cũ
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
   10) BODY COLOR + SELECTION (UI helpers)
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

/** Áp màu (persist & broadcast – ghi DescCache) */
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

		broadcastApplyFrom(desc);
	});

	return true;
}

/** Tiện: từ sliders */
export function applyBodyColorFromSliders(huePct: number, valPct: number, region?: BodyRegion, snapToBrick = false) {
	return applyBodyColor(colorFromSliders(huePct, valPct), region, snapToBrick);
}

/* =========================
   11) BODY SCALES (UI helpers)
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

/** Set theo % 0..1, cập nhật DescCache & broadcast */
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

		broadcastApplyFrom(desc);
	});
}

/* =========================
   12) APPLY CACHE VÀO TẤT CẢ TARGETS
   ========================= */
export function applyCachedDescriptionIfAny(hard = false) {
	if (!DescCache) return;
	for (let i = 0; i < Targets.size(); i++) applySnapshotToHumanoid(Targets[i], DescCache, hard);
}
/* =========================
   13) ASSET INSPECTION (IDs & Names)
   ========================= */

export type SimpleAssetInfo = { id: number; name: string };

/** Lấy tên asset (thử MarketplaceService; fallback là "#<id>") */
function getAssetName(assetId: number): string {
	const [ok, info] = pcall(() => MarketplaceService.GetProductInfo(assetId));
	if (ok && typeOf(info) === "table") {
		const t = info as unknown as Record<string, unknown>;
		const nm = t.Name;
		if (typeOf(nm) === "string") return nm as string;
	}
	return `#${tostring(assetId)}`;
}

/** Gom ID asset từ HumanoidDescription (shirt/pants/face/tshirt + accessories CSV) */
function collectAssetIdsFromDesc(d: HumanoidDescription): number[] {
	const ids = new Array<number>();

	// clothes
	for (let i = 0; i < CLOTH_KEYS.size(); i++) {
		const k = CLOTH_KEYS[i] as string;
		const v = (d as unknown as Record<string, number>)[k];
		if (typeOf(v) === "number" && (v as number) > 0) ids.push(v as number);
	}

	// accessories CSV
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

	// Deduplicate
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

/** Gom ID asset từ DescCache (snapshot) */
function collectAssetIdsFromSnapshot(snap: DescSnapshot): number[] {
	const ids = new Array<number>();

	// Clothes
	for (let i = 0; i < CLOTH_KEYS.size(); i++) {
		const k = CLOTH_KEYS[i] as string;
		const v = (snap as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "number" && (v as number) > 0) ids.push(v as number);
	}

	// Accessories CSV
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

	// Deduplicate
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

/** Public: trả về danh sách asset hiện tại (id + name) */
export function getCurrentHumanoidAssets(): SimpleAssetInfo[] {
	const base = getPrimaryHumanoid();
	if (!base) {
		//print("[getCurrentHumanoidAssets] Không tìm thấy PrimaryHumanoid");
		return [];
	}

	const ids = DescCache
		? collectAssetIdsFromSnapshot(DescCache)
		: collectAssetIdsFromDesc(base.GetAppliedDescription());
	const result = new Array<SimpleAssetInfo>();
	for (let i = 0; i < ids.size(); i++) {
		const id = ids[i];
		const name = getAssetName(id);
		//print(` -> Asset ${i}: id=${id}, name=${name}`);
		result.push({ id, name });
	}
	return result;
}

// Map ngược: field -> AvatarAssetType
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
};

/** Suy ra loại asset đang mặc của một id (đọc từ DescCache nếu có, else từ humanoid hiện tại). */
export function getWornAssetTypeForId(assetId: number): Enum.AvatarAssetType | undefined {
	const hum = getPrimaryHumanoid();
	if (!hum || assetId <= 0) return undefined;

	const d = DescCache ? DescCache : snapshotFromDesc(hum.GetAppliedDescription());

	// quần áo 1-1
	for (let i = 0; i < CLOTH_KEYS.size(); i++) {
		const k = CLOTH_KEYS[i] as string;
		const v = (d as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "number" && (v as number) === assetId) {
			return FIELD_TO_ASSETTYPE[k];
		}
	}
	// accessories (CSV)
	for (let i = 0; i < ACCESSORY_KEYS.size(); i++) {
		const k = ACCESSORY_KEYS[i] as string;
		const v = (d as unknown as Record<string, unknown>)[k];
		if (typeOf(v) === "string" && (v as string) !== "") {
			for (const raw of (v as string).split(",")) {
				const n = tonumber(raw);
				if (n && n === assetId) {
					return FIELD_TO_ASSETTYPE[k];
				}
			}
		}
	}
	return undefined;
}
