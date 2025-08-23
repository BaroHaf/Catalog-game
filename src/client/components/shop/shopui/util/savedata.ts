import { remotes, ItemData } from "shared/remotes";

/* ============ throttle chống spam ============ */
const lastCall = new Map<string, number>();
function throttle(key: string, ms: number) {
  const now = os.clock();
  const prev = lastCall.get(key) ?? 0;
  if (now - prev < ms / 1000) return false;
  lastCall.set(key, now);
  return true;
}

/* ============ API CLIENT → SERVER ============ */
export function addToCart(assetId: number) {
  if (!throttle(`add:${assetId}`, 120)) return;
  remotes.server.saveItemRequest.fire(assetId);
}

export function removeFromCart(assetId: number) {
  if (!throttle(`rm:${assetId}`, 120)) return;
  remotes.server.removeItemRequest.fire(assetId);
}

export function requestCart() {
  remotes.server.requestCart.fire();
}

/* ============ CART STORE (local) ============ */

type CartItem = ItemData;
const cart = new Map<number, CartItem>();

type Listener = () => void;
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((fn) => fn());
}

/** UI subscribe để nhận notify khi cart đổi */
export function subscribeCart(listener: Listener) {
  listeners.add(listener);
  // cleanup trả về void
  return () => {
    listeners.delete(listener);
  };
}

/** Tổng tiền (bỏ qua item không có price) */
export function getCartTotal(): number {
  let sum = 0;
  cart.forEach((v) => {
    if (typeIs(v.price, "number")) sum += v.price as number;
  });
  return sum;
}

/** Lấy tất cả item hiện có (thứ tự theo lần add) */
export function getCartItems(): CartItem[] {
  const out: CartItem[] = [];
  cart.forEach((v) => out.push(v));
  return out;
}

/* ============ SERVER → CLIENT SYNC ============ */

remotes.client.inventorySync.connect((payload) => {
  // Full sync
  if (payload.full) {
    cart.clear();
    const data = payload.data ?? {};
    for (const [_, v] of pairs(data)) if (v) cart.set(v.id, v);
    emit();
    return;
  }

  // Remove list
  if (payload.remove) {
    const ids = payload.remove as unknown as number[];
    for (const id of ids) cart.delete(id);
    emit();
  }

  // Patch add/replace
  if (payload.patch) {
    const patch = payload.patch;
    for (const [_, v] of pairs(patch)) {
      if (v) cart.set(v.id, v);
    }
    emit();
  }
});
