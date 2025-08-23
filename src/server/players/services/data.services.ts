import { createCollection } from "@rbxts/lapis";
import { Players, MarketplaceService } from "@rbxts/services";
import { remotes, ItemData } from "shared/remotes";

/* ===== Types ===== */
type CartItem = ItemData;                         // không có quantity
type CartSave = { cart: Record<string, CartItem> };
const DEFAULT_SAVE: CartSave = { cart: {} };

/* ===== Lapis + RAM cache ===== */
const collection = createCollection("players_cart", { defaultData: DEFAULT_SAVE });
type Doc = Awaited<ReturnType<typeof collection.load>>;

const docs = new Map<number, Doc>();
const saves = new Map<number, CartSave>();
const loading = new Set<number>();

export function initDataService() {
  // load/unload
  Players.GetPlayers().forEach((p) => void loadPlayer(p));
  Players.PlayerAdded.Connect((p) => void loadPlayer(p));
  Players.PlayerRemoving.Connect((p) => unloadPlayer(p));

  // CLIENT → SERVER: add
  remotes.server.saveItemRequest.connect((player, assetId) => {
    print(`[SERVER] ${player.Name} gửi yêu cầu ADD cart: ${assetId}`);
    void addCart(player, assetId);
  });

  // CLIENT → SERVER: remove
  remotes.server.removeItemRequest.connect((player, assetId) => {
    print(`[SERVER] ${player.Name} gửi yêu cầu REMOVE cart: ${assetId}`);
    removeCart(player, assetId);
  });

  // CLIENT → SERVER: request full
  remotes.server.requestCart.connect((player) => {
    const cur = saves.get(player.UserId) ?? DEFAULT_SAVE;
    remotes.client.inventorySync.fire(player, { full: true, data: cur.cart });
  });

  // CLIENT → SERVER: checkout (bulk purchase)
  remotes.server.checkoutRequest.connect((player) => {
    const cur = saves.get(player.UserId);
    if (!cur) return;

    // dựng lineItems (tối đa 20)
    const lineItems = new Array<{ Id: string; Type: Enum.MarketplaceProductType }>();
    let count = 0;
    for (const [_, v] of pairs(cur.cart)) {
      if (!v) continue;
      lineItems.push({
        Id: tostring(v.id),
        Type: Enum.MarketplaceProductType.AvatarAsset, // asset/avatar
      });
      count += 1;
      if (count >= 20) break;
    }
    if (lineItems.size() === 0) return;

    const [ok, err] = pcall(() => {
      // options bắt buộc có tham số thứ 3
      MarketplaceService.PromptBulkPurchase(
        player,
        lineItems as unknown as Array<PromptBulkPurchaseItem>,
        {},
      );
    });
    if (!ok) warn("PromptBulkPurchase failed:", err);
  });
}

/** ADD CART: giữ 1 bản cho mỗi assetId, build data từ MarketplaceService */
export async function addCart(player: Player, assetId: number) {
  const uid = player.UserId;
  const doc = docs.get(uid);
  const cur = saves.get(uid);
  if (!doc || !cur) return;

  const key = tostring(assetId);
  if (cur.cart[key]) return; // đã có sẵn

  // lấy info chính thức từ Roblox
  let info: unknown;
  const ok = pcall(() => {
    info = MarketplaceService.GetProductInfo(assetId, Enum.InfoType.Asset) as unknown;
  })[0];
  if (!ok || typeIs(info, "nil")) return;

  const data = info as { Name?: string; PriceInRobux?: number; Description?: string };

  const item: CartItem = {
    id: assetId,
    name: data.Name ?? `Asset ${assetId}`,
    price: data.PriceInRobux,
    description: data.Description,
    imageUrl: `rbxthumb://type=Asset&id=${assetId}&w=420&h=420`,
    acquiredAt: os.time(),
  };

  const newSave: CartSave = { ...cur, cart: { ...cur.cart, [key]: item } };
  saves.set(uid, newSave);
  doc.write(newSave);

  // SERVER → CLIENT: patch thêm/cập nhật
  remotes.client.inventorySync.fire(player, { patch: { [key]: item } });
}

/** REMOVE CART: xoá hẳn item */
export function removeCart(player: Player, assetId: number) {
  const uid = player.UserId;
  const doc = docs.get(uid);
  const cur = saves.get(uid);
  if (!doc || !cur) return;

  const key = tostring(assetId);
  if (!cur.cart[key]) return;

  const newCart = { ...cur.cart };
  (newCart as Record<string, unknown>)[key] = undefined; // xoá local
  const newSave: CartSave = { ...cur, cart: newCart };
  saves.set(uid, newSave);
  doc.write(newSave);

  // SERVER → CLIENT: dùng remove list (tránh undefined rơi qua remote)
  remotes.client.inventorySync.fire(player, { remove: [assetId] });
}

/* ===== Helpers ===== */
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

    const data = (doc.read() as CartSave) ?? DEFAULT_SAVE;
    saves.set(p.UserId, data);
    debugPrintCart("LOAD", p, data);

    // gửi full giỏ khi join
    remotes.client.inventorySync.fire(p, { full: true, data: data.cart });
  } catch (e) {
    warn(`[Cart] Load failed for ${p.Name}: ${e}`);
    saves.set(p.UserId, DEFAULT_SAVE);
    remotes.client.inventorySync.fire(p, { full: true, data: {} });
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

function debugPrintCart(tag: string, player: Player, save: CartSave) {
  print(`[SERVER][${tag}] Cart của ${player.Name}:`);
  for (const [k, v] of pairs(save.cart)) {
    if (v) print(` - ${k}: ${v.name} (id=${v.id}) price=${tostring(v.price)}`);
  }
}
