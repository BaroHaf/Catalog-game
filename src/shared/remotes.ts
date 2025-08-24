// shared/remotes.ts
import { createRemotes, namespace, remote, Client, Server } from "@rbxts/remo";

/* ========= CART ========= */
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

/* ========= OUTFITS (Preset lưu) - V1 (GIỮ NGUYÊN) ========= */
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

/* ========= OUTFIT DELTA (gửi liên tục khi kéo/mặc/cởi) ========= */
/** Chỉ gửi phần vừa đổi; `hard=true` cho mặc/cởi/reset (server sẽ ApplyDescriptionReset ở nhịp đó) */
export type OutfitDelta = Partial<{
  // clothes (id) + face/tshirt
  Shirt: number; Pants: number; GraphicTShirt: number; Face: number;

  // accessories (CSV string)
  HatAccessory: string; HairAccessory: string; FaceAccessory: string; NeckAccessory: string;
  ShouldersAccessory: string; FrontAccessory: string; BackAccessory: string; WaistAccessory: string;

  // body colors
  HeadColor: Color3; TorsoColor: Color3; LeftArmColor: Color3; RightArmColor: Color3; LeftLegColor: Color3; RightLegColor: Color3;

  // scales
  HeightScale: number; WidthScale: number; DepthScale: number; HeadScale: number;
  BodyTypeScale: number; ProportionScale: number;

  hard?: boolean;
}>;

/* ========= OUTFITS V2 (THEO ID) – THÊM MỚI, KHÔNG ĐỤNG V1 ========= */
/**
 * V2 dùng primary key là `id` (base62, 1–10 ký tự).
 * Cho phép clear data tạm thời qua remote `clearMyOutfits`.
 * Có thể dùng song song với V1; khi bạn migrate xong thì chỉ dùng V2.
 */
export type OutfitV2 = {
  id: string;           // primary key (1–10 ký tự a-zA-Z0-9)
  name: string;         // tên hiển thị
  assets: number[];     // danh sách AvatarAssetId
  snapshotThumb?: string;
  updatedAt: number;    // os.time()
};

export type OutfitSaveV2 = {
  // key = id (unique)
  outfits: Record<string, OutfitV2>;
  current?: string;     // id đang chọn
};

export type OutfitsSyncPayloadV2 =
  | { full: true; data: OutfitSaveV2 }
  | {
      patch?: Partial<Pick<OutfitSaveV2, "current">> & { outfits?: Record<string, OutfitV2> };
      remove?: string[]; // danh sách id xoá
    };

export type GlobalOutfitsFullV2 = Record<number, OutfitSaveV2>; // ownerId -> OutfitSaveV2

/* ========= REMOTES ========= */
export const remotes = createRemotes({
  client: namespace({
    // CART
    inventorySync: remote<Client, [payload: InventorySyncPayload]>(),

    // OUTFITS (V1 – giữ nguyên)
    outfitsSync: remote<Client, [payload: OutfitsSyncPayload]>(),
    outfitsGlobalSync: remote<Client, [data: GlobalOutfitsFull]>(),

    // OUTFITS (V2 – thêm mới)
    outfitsSyncV2: remote<Client, [payload: OutfitsSyncPayloadV2]>(),
    outfitsGlobalSyncV2: remote<Client, [data: GlobalOutfitsFullV2]>(),
  }),

  server: namespace({
    // CART
    saveItemRequest: remote<Server, [assetId: number]>(),
    removeItemRequest: remote<Server, [assetId: number]>(),
    requestCart: remote<Server, []>(),
    checkoutRequest: remote<Server, []>(),

    // OUTFITS – REST-ish (V1 – giữ nguyên)
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

    // ========= NEW: gửi delta liên tục, server gộp theo nhịp =========
    outfitDelta: remote<Server, [delta: OutfitDelta]>(),

    // ========= OUTFITS V2 (THEO ID) – THÊM MỚI =========
    /** GET outfits V2 của chính user (theo id) */
    getOutfitsV2: remote<Server, []>(),
    /** GET outfits V2 của tất cả người đang online (server hiện tại) */
    getOutfitsGlobalV2: remote<Server, []>(),
    /** POST tạo 1 outfit V2 (server sẽ sinh id) */
    postOutfitV2: remote<Server, [name: string, assets: number[], snapshotThumb?: string]>(),
    /** DELETE 1 outfit V2 theo id */
    deleteOutfitV2: remote<Server, [id: string]>(),
    /** PATCH đổi tên outfit V2 theo id */
    patchOutfitNameV2: remote<Server, [id: string, newName: string]>(),
    /** PATCH đặt outfit hiện tại theo id (undefined để bỏ chọn) */
    patchOutfitCurrentV2: remote<Server, [id?: string]>(),
    /** CLEAR toàn bộ outfits của chính user (chỉ dùng tạm khi dev/test) */
    clearMyOutfits: remote<Server, []>(),
  }),
});
