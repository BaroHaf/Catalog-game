import { createRemotes, namespace, remote, Client, Server } from "@rbxts/remo";

/* ========= CART (giữ nguyên nếu bạn đang dùng) ========= */
export type ItemData = {
  id: number;
  name: string;
  price?: number;
  description?: string;
  imageUrl?: string;
  acquiredAt: number;
};

export type InventorySyncPayload = {
  full?: boolean;
  data?: Record<string, ItemData>;
  patch?: Record<string, ItemData>;
  remove?: number[];
};

/* ========= OUTFITS ========= */
export type Outfit = {
  name: string;         // tên hiển thị
  assets: number[];     // danh sách AvatarAssetId
  snapshotThumb?: string;
  updatedAt: number;    // os.time()
};

export type OutfitSave = {
  // key = tên outfit đã normalize (lower + trim + gộp space)
  outfits: Record<string, Outfit>;
  current?: string;     // key normalize của outfit đang chọn
};

export type OutfitsSyncPayload =
  | { full: true; data: OutfitSave }
  | {
      patch?: Partial<OutfitSave> & { outfits?: Record<string, Outfit> };
      remove?: string[];
    };

/** Full outfits của tất cả người đang ONLINE trong server hiện tại */
export type GlobalOutfitsFull = Record<number, OutfitSave>; // ownerId -> OutfitSave

export const remotes = createRemotes({
  client: namespace({
    // CART
    inventorySync: remote<Client, [payload: InventorySyncPayload]>(),

    // OUTFITS (của chính user)
    outfitsSync: remote<Client, [payload: OutfitsSyncPayload]>(),

    // OUTFITS (toàn bộ người đang online)
    outfitsGlobalSync: remote<Client, [data: GlobalOutfitsFull]>(),
  }),

  server: namespace({
    // CART
    saveItemRequest: remote<Server, [assetId: number]>(),
    removeItemRequest: remote<Server, [assetId: number]>(),
    requestCart: remote<Server, []>(),
    checkoutRequest: remote<Server, []>(),

    // OUTFITS – REST-ish
    /** GET outfits của chính user */
    getOutfits: remote<Server, []>(),
    /** GET outfits của tất cả người đang online (server hiện tại) */
    getOutfitsGlobal: remote<Server, []>(),
    /** POST tạo/cập nhật 1 outfit */
    postOutfit: remote<Server, [name: string, assets: number[], snapshotThumb?: string]>(),
    /** DELETE 1 outfit */
    deleteOutfit: remote<Server, [name: string]>(),
    /** PATCH đổi tên outfit */
    patchOutfitName: remote<Server, [oldName: string, newName: string]>(),
    /** PATCH đặt outfit hiện tại (undefined để bỏ chọn) */
    patchOutfitCurrent: remote<Server, [name?: string]>(),
  }),
});
