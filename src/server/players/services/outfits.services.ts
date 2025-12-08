import { createCollection } from "@rbxts/lapis";
import { Players } from "@rbxts/services";
import { remotes, Outfit, OutfitSave, BodyColorsData, ScalesData } from "shared/remotes";

/* ===== Defaults ===== */
// Lưu nội bộ có id, tương thích khi gửi payload V1 (cast khi fire remote)
type OutfitWithId = Outfit & { id: string };
type OutfitSaveWithId = { outfits: Record<string, OutfitWithId>; current?: string };

const DEFAULT_OUTFITS: OutfitSaveWithId = { outfits: {}, current: undefined };

/* ===== Lapis + RAM cache ===== */
const collection = createCollection("players_outfits", { defaultData: DEFAULT_OUTFITS });
type Doc = Awaited<ReturnType<typeof collection.load>>;

const docs = new Map<number, Doc>();
const saves = new Map<number, OutfitSaveWithId>();
const loading = new Set<number>();

/* ===== Config test clear ===== */
const FORCE_CLEAR_ON_LOAD = false;

/* ===================== Helpers ===================== */

const BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomId(len = 8): string {
	const arr = new Array<string>();
	for (let i = 0; i < len; i++) {
		const idx = math.random(1, BASE62.size()) - 1;
		arr.push(BASE62.sub(idx + 1, idx + 1));
	}
	return arr.join("");
}
function createUniqueId(existing: Record<string, unknown>, preferLen = 8): string {
	let id = randomId(preferLen);
	let guard = 0;
	while (existing[id] !== undefined && guard < 1000) {
		id = randomId(math.clamp(preferLen + math.floor(guard / 50), 1, 10));
		guard++;
	}
	return id;
}
function normalizeName(s: string) {
	const lower = s.lower();
	const single = lower.gsub("%s+", " ")[0];
	return single.gsub("^%s*(.-)%s*$", "%1")[0];
}
function compactOutfits(src: Record<string, OutfitWithId | undefined>): Record<string, OutfitWithId> {
	const out: Record<string, OutfitWithId> = {};
	for (const [k, v] of pairs(src)) if (v !== undefined) out[k] = v as OutfitWithId;
	return out;
}
function writeWithRetry(doc: Doc, data: OutfitSaveWithId, attempts = 6, baseWait = 0.25) {
	let i = 0;
	while (i < attempts) {
		const [ok, err] = pcall(() => doc.write(data));
		if (ok) return true;
		warn(`[Outfits] write retry ${i + 1}/${attempts} -> ${err}`);
		task.wait(baseWait * (1 + i * 0.5));
		i++;
	}
	warn("[Outfits] write failed after retries");
	return false;
}

/* ===================== Public API ===================== */
export function initOutfitsService() {
	Players.GetPlayers().forEach((p) => void loadPlayer(p));
	Players.PlayerAdded.Connect((p) => void loadPlayer(p));
	Players.PlayerRemoving.Connect((p) => unloadPlayer(p));

	/* ---------- GET ---------- */
	remotes.server.getOutfits.connect((player) => {
		const cur = saves.get(player.UserId) ?? DEFAULT_OUTFITS;
		remotes.client.outfitsSync.fire(player, { full: true, data: cur as unknown as OutfitSave });
	});

	/* ---------- POST ---------- */
	// nhận thêm colors?, scales?, accessoryBlob?
	remotes.server.postOutfit.connect((player, name, assets, snapshotThumb?, colors?, scales?, accessoryBlob?) => {
		void upsertOutfit(player, name, assets, snapshotThumb, colors, scales, accessoryBlob);
	});

	/* ---------- DELETE ---------- */
	remotes.server.deleteOutfit.connect((player, name) => {
		removeOutfitByName(player, name);
	});

	/* ---------- PATCH ---------- */
	remotes.server.patchOutfitName.connect((player, oldName, newName) => {
		renameOutfitByName(player, oldName, newName);
	});
	remotes.server.patchOutfitCurrent.connect((player, name) => {
		setCurrentOutfitByName(player, name);
	});
}

/* ===================== Operations (theo id nội bộ) ===================== */
export async function upsertOutfit(
	player: Player,
	name: string,
	assets: number[],
	snapshotThumb?: string,
	colors?: BodyColorsData,
	scales?: ScalesData,
	accessoryBlob?: string,
) {
	const uid = player.UserId;
	const doc = docs.get(uid);
	const cur = saves.get(uid);
	
	print(
		"[Outfits] upsert request",
		player.Name, name,
		"assets:", assets.size(),
		"colors:", colors !== undefined,
		"scales:", scales !== undefined,
		"blob:", accessoryBlob !== undefined
	);

	if (!doc || !cur) {
		warn("[Outfits] skip upsert: doc/cur missing for", player.Name);
		return;
	}

	const id = createUniqueId(cur.outfits, 8);
	const now = os.time();
	const outfit: OutfitWithId = {
		id,
		name,
		assets: (assets ?? []).filter((n) => typeIs(n, "number")),
		snapshotThumb,
		updatedAt: now,
		colors,
		scales,
	};

	const nextOutfits = { ...cur.outfits, [id]: outfit };
	const nextSave: OutfitSaveWithId = { ...cur, outfits: nextOutfits };

	saves.set(uid, nextSave);
	writeWithRetry(doc, nextSave);

	remotes.client.outfitsSync.fire(
		player,
		{ patch: { outfits: { [id]: outfit } } } as unknown as { patch: OutfitSave },
	);
}

function removeOutfitByName(player: Player, name: string) {
	const uid = player.UserId;
	const doc = docs.get(uid);
	const cur = saves.get(uid);
	if (!doc || !cur) return;
	const key = normalizeName(name);

	let foundId: string | undefined = undefined;
	for (const [id, of] of pairs(cur.outfits)) {
		if (normalizeName(of.name) === key) {
			foundId = id; break;
		}
	}
	if (!foundId) return;

	const nextOutfits = { ...cur.outfits };
	(nextOutfits as Record<string, unknown>)[foundId] = undefined;

	const compact = compactOutfits(nextOutfits);
	const nextSave: OutfitSaveWithId = {
		...cur,
		outfits: compact,
		current: cur.current === foundId ? undefined : cur.current,
	};

	saves.set(uid, nextSave);
	writeWithRetry(doc, nextSave);

	remotes.client.outfitsSync.fire(
		player,
		{ remove: [foundId], patch: { current: nextSave.current } } as unknown as { remove: string[]; patch: OutfitSave },
	);
}

function renameOutfitByName(player: Player, oldName: string, newName: string) {
	const uid = player.UserId;
	const doc = docs.get(uid);
	const cur = saves.get(uid);
	if (!doc || !cur) return;

	const oldKey = normalizeName(oldName);
	let foundId: string | undefined = undefined;
	for (const [id, of] of pairs(cur.outfits)) {
		if (normalizeName(of.name) === oldKey) { foundId = id; break; }
	}
	if (!foundId) return;

	const exist = cur.outfits[foundId];
	if (!exist) return;

	const updated: OutfitWithId = { ...exist, name: newName, updatedAt: os.time() };

	const nextOutfits = { ...cur.outfits, [foundId]: updated };
	const nextSave: OutfitSaveWithId = { ...cur, outfits: nextOutfits };

	saves.set(uid, nextSave);
	writeWithRetry(doc, nextSave);

	remotes.client.outfitsSync.fire(
		player,
		{ patch: { outfits: { [foundId]: updated } } } as unknown as { patch: OutfitSave },
	);
}

function setCurrentOutfitByName(player: Player, name?: string) {
	const uid = player.UserId;
	const doc = docs.get(uid);
	const cur = saves.get(uid);
	if (!doc || !cur) return;

	let id: string | undefined = undefined;
	if (name) {
		const key = normalizeName(name);
		for (const [oid, of] of pairs(cur.outfits)) {
			if (normalizeName(of.name) === key) { id = oid; break; }
		}
		if (id && !cur.outfits[id]) return;
	}

	const nextSave: OutfitSaveWithId = { ...cur, current: id };
	saves.set(uid, nextSave);
	writeWithRetry(doc, nextSave);

	remotes.client.outfitsSync.fire(player, { patch: { current: id } } as unknown as { patch: OutfitSave });
}

/* ===================== Lifecycle ===================== */
async function loadPlayer(p: Player) {
	if (docs.has(p.UserId) || loading.has(p.UserId)) return;
	loading.add(p.UserId);
	try {
		const doc = await collection.load(`${p.UserId}`);
		if (!p.Parent) { doc.close(); return; }
		docs.set(p.UserId, doc);

		if (FORCE_CLEAR_ON_LOAD) {
			const empty: OutfitSaveWithId = { outfits: {}, current: undefined };
			saves.set(p.UserId, empty);
			writeWithRetry(doc, empty);
			remotes.client.outfitsSync.fire(p, { full: true, data: empty } as unknown as { full: true; data: OutfitSave });
			print(`[Outfits] (TEST) Cleared on load for ${p.Name}`);
		} else {
			let data = (doc.read() as OutfitSaveWithId) ?? DEFAULT_OUTFITS;
			// migrate nhẹ từ dữ liệu cũ chưa có id/scales/accessoryBlob
			if (data && data.outfits) {
				let touched = false;
				const outfitsObj = (data.outfits as unknown) as Record<string, OutfitWithId | Outfit>;
				const migrated: Record<string, OutfitWithId> = {};

				for (const [, v] of pairs(outfitsObj)) {
					if (!v) continue;
					const anyv = v as Partial<OutfitWithId> & Outfit;
					if (!anyv.id || typeOf(anyv.id) !== "string" || anyv.id.size() < 1 || anyv.id.size() > 10) {
						const newId = createUniqueId(migrated, 8);
						migrated[newId] = {
							id: newId,
							name: anyv.name,
							assets: anyv.assets,
							snapshotThumb: anyv.snapshotThumb,
							updatedAt: anyv.updatedAt ?? os.time(),
							colors: (anyv as OutfitWithId).colors,
							scales: (anyv as OutfitWithId).scales,               // giữ nếu có
						};
						touched = true;
					} else {
						migrated[anyv.id] = anyv as OutfitWithId;
					}
				}

				if (touched) {
					const fixed: OutfitSaveWithId = {
						outfits: migrated,
						current: data.current && migrated[data.current] ? data.current : undefined,
					};
					data = fixed;
					writeWithRetry(doc, fixed);
				}
			}

			saves.set(p.UserId, data);
			remotes.client.outfitsSync.fire(p, { full: true, data: data } as unknown as { full: true; data: OutfitSave });
		}
	} catch (e) {
		warn(`[Outfits] Load failed for ${p.Name}: ${e}`);
		const fallback = DEFAULT_OUTFITS;
		saves.set(p.UserId, fallback);
		remotes.client.outfitsSync.fire(p, { full: true, data: fallback } as unknown as { full: true; data: OutfitSave });
	} finally {
		loading.delete(p.UserId);
	}
}
function unloadPlayer(p: Player) {
	const doc = docs.get(p.UserId);
	if (doc) pcall(() => doc.close());
	docs.delete(p.UserId);
	saves.delete(p.UserId);
}
