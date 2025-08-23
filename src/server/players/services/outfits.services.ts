import { createCollection } from "@rbxts/lapis";
import { Players } from "@rbxts/services";
import { remotes, Outfit, OutfitSave } from "shared/remotes";

/* ===== Defaults ===== */
const DEFAULT_OUTFITS: OutfitSave = { outfits: {}, current: undefined };

/* ===== Lapis + RAM cache ===== */
const collection = createCollection("players_outfits", { defaultData: DEFAULT_OUTFITS });
type Doc = Awaited<ReturnType<typeof collection.load>>;

const docs = new Map<number, Doc>();
const saves = new Map<number, OutfitSave>();
const loading = new Set<number>();

/* ===================== Public API ===================== */
export function initOutfitsService() {
  // load/unload vòng đời player
  Players.GetPlayers().forEach((p) => void loadPlayer(p));
  Players.PlayerAdded.Connect((p) => void loadPlayer(p));
  Players.PlayerRemoving.Connect((p) => unloadPlayer(p));

  /* ---------- GET ---------- */
  // GET outfits của chính user
  remotes.server.getOutfits.connect((player) => {
    const cur = saves.get(player.UserId) ?? DEFAULT_OUTFITS;
    remotes.client.outfitsSync.fire(player, { full: true, data: cur });
  });

  // GET outfits của tất cả người đang online (server hiện tại)
  remotes.server.getOutfitsGlobal.connect((player) => {
    const bundle: Record<number, OutfitSave> = {};
    for (const [uid, save] of saves) bundle[uid] = save;
    remotes.client.outfitsGlobalSync.fire(player, bundle);
  });

  /* ---------- POST ---------- */
  remotes.server.postOutfit.connect((player, name, assets, snapshotThumb) => {
    void upsertOutfit(player, name, assets, snapshotThumb);
  });

  /* ---------- DELETE ---------- */
  remotes.server.deleteOutfit.connect((player, name) => {
    removeOutfit(player, name);
  });

  /* ---------- PATCH ---------- */
  remotes.server.patchOutfitName.connect((player, oldName, newName) => {
    renameOutfit(player, oldName, newName);
  });

  remotes.server.patchOutfitCurrent.connect((player, name) => {
    setCurrentOutfit(player, name);
  });
}

/* ===================== Operations ===================== */
export async function upsertOutfit(player: Player, name: string, assets: number[], snapshotThumb?: string) {
  const uid = player.UserId;
  const doc = docs.get(uid);
  const cur = saves.get(uid);
  if (!doc || !cur) return;

  const key = normalizeName(name);
  const outfit: Outfit = {
    name, // tên hiển thị
    assets: assets.filter((n) => typeIs(n, "number")),
    snapshotThumb,
    updatedAt: os.time(),
  };

  const nextSave: OutfitSave = {
    ...cur,
    outfits: { ...cur.outfits, [key]: outfit },
  };
  saves.set(uid, nextSave);
  doc.write(nextSave);

  // patch về client (chính chủ)
  remotes.client.outfitsSync.fire(player, { patch: { outfits: { [key]: outfit } } });
}

export function removeOutfit(player: Player, name: string) {
  const uid = player.UserId;
  const doc = docs.get(uid);
  const cur = saves.get(uid);
  if (!doc || !cur) return;

  const key = normalizeName(name);
  if (!cur.outfits[key]) return;

  const nextOutfits = { ...cur.outfits };
  (nextOutfits as Record<string, unknown>)[key] = undefined;

  const nextSave: OutfitSave = {
    ...cur,
    outfits: nextOutfits,
    current: cur.current === key ? undefined : cur.current,
  };
  saves.set(uid, nextSave);
  doc.write(nextSave);

  remotes.client.outfitsSync.fire(player, { remove: [key] });
}

export function renameOutfit(player: Player, oldName: string, newName: string) {
  const uid = player.UserId;
  const doc = docs.get(uid);
  const cur = saves.get(uid);
  if (!doc || !cur) return;

  const oldKey = normalizeName(oldName);
  const newKey = normalizeName(newName);
  const exist = cur.outfits[oldKey];
  if (!exist) return;

  const updated: Outfit = { ...exist, name: newName, updatedAt: os.time() };

  const nextOutfits = { ...cur.outfits };
  (nextOutfits as Record<string, unknown>)[oldKey] = undefined;
  nextOutfits[newKey] = updated;

  const nextSave: OutfitSave = {
    outfits: nextOutfits,
    current: cur.current === oldKey ? newKey : cur.current,
  };
  saves.set(uid, nextSave);
  doc.write(nextSave);

  remotes.client.outfitsSync.fire(player, {
    remove: [oldKey],
    patch: { outfits: { [newKey]: updated }, current: nextSave.current },
  });
}

export function setCurrentOutfit(player: Player, name?: string) {
  const uid = player.UserId;
  const doc = docs.get(uid);
  const cur = saves.get(uid);
  if (!doc || !cur) return;

  const key = name ? normalizeName(name) : undefined;
  if (key && !cur.outfits[key]) return;

  const nextSave: OutfitSave = { ...cur, current: key };
  saves.set(uid, nextSave);
  doc.write(nextSave);

  remotes.client.outfitsSync.fire(player, { patch: { current: key } });
}

/* ===================== Helpers ===================== */
function normalizeName(s: string) {
  // lower, gộp whitespace, trim 2 đầu
  const lower = s.lower();
  const single = lower.gsub("%s+", " ")[0];
  return single.gsub("^%s*(.-)%s*$", "%1")[0];
}

async function loadPlayer(p: Player) {
  if (docs.has(p.UserId) || loading.has(p.UserId)) return;
  loading.add(p.UserId);
  try {
    const doc = await collection.load(`${p.UserId}`);
    if (!p.Parent) {
      doc.close();
      return;
    }
    docs.set(p.UserId, doc);

    const data = (doc.read() as OutfitSave) ?? DEFAULT_OUTFITS;
    saves.set(p.UserId, data);

    // gửi full outfits của CHÍNH người chơi
    remotes.client.outfitsSync.fire(p, { full: true, data });
  } catch (e) {
    warn(`[Outfits] Load failed for ${p.Name}: ${e}`);
    saves.set(p.UserId, DEFAULT_OUTFITS);
    remotes.client.outfitsSync.fire(p, { full: true, data: DEFAULT_OUTFITS });
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
