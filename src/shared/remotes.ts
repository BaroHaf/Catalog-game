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

/* ========= BODY COLORS (RGB an toàn Datastore) ========= */
export type RGB = [number, number, number]; // 0..255
export type BodyColorsData = {
	head: RGB;
	torso: RGB;
	leftArm: RGB;
	rightArm: RGB;
	leftLeg: RGB;
	rightLeg: RGB;
};

/* ========= SCALES ========= */
export type ScalesData = {
	HeightScale?: number;
	WidthScale?: number;
	DepthScale?: number;
	HeadScale?: number;
	BodyTypeScale?: number;
	ProportionScale?: number;
};

/* ========= OUTFITS (Preset lưu) - V1 (GIỮ NGUYÊN API, MỞ RỘNG TYPE) ========= */
export type Outfit = {
	name: string;
	assets: number[];
	snapshotThumb?: string;
	updatedAt: number;
	colors?: BodyColorsData;
	// NEW
	scales?: ScalesData;
};

export type OutfitSave = {
	// key = tên outfit đã normalize (lower + trim + gộp space)
	outfits: Record<string, Outfit>;
	current?: string; // key normalize của outfit đang chọn
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
export type OutfitDelta = Partial<{
	// clothes (id) + face/tshirt
	Shirt: number;
	Pants: number;
	GraphicTShirt: number;
	Face: number;

	// accessories (CSV string)
	HatAccessory: string;
	HairAccessory: string;
	FaceAccessory: string;
	NeckAccessory: string;
	ShouldersAccessory: string;
	FrontAccessory: string;
	BackAccessory: string;
	WaistAccessory: string;

	// layered clothing (CSV) – có thể thêm tuỳ Roblox update
	JacketAccessory: string;
	SweaterAccessory: string;
	ShortsAccessory: string;
	PantsAccessory: string;
	DressSkirtAccessory: string;
	TShirtAccessory: string;
	LeftShoeAccessory: string;
	RightShoeAccessory: string;
	EyebrowAccessory: string;
	EyelashAccessory: string;
	EarAccessory: string;

	// body colors (runtime only)
	HeadColor: Color3;
	TorsoColor: Color3;
	LeftArmColor: Color3;
	RightArmColor: Color3;
	LeftLegColor: Color3;
	RightLegColor: Color3;

	// scales
	HeightScale: number;
	WidthScale: number;
	DepthScale: number;
	HeadScale: number;
	BodyTypeScale: number;
	ProportionScale: number;

	hard?: boolean;
}>;

/* ========= OUTFITS V2 (THEO ID) ========= */
export type OutfitV2 = {
	id: string; // primary key (1–10 ký tự a-zA-Z0-9)
	name: string; // tên hiển thị
	assets: number[]; // danh sách AvatarAssetId
	snapshotThumb?: string;
	updatedAt: number; // os.time()
	colors?: BodyColorsData; // NEW
	/** NEW */
	scales?: ScalesData;
};

export type OutfitSaveV2 = {
	// key = id (unique)
	outfits: Record<string, OutfitV2>;
	current?: string; // id đang chọn
};

export type OutfitsSyncPayloadV2 =
	| { full: true; data: OutfitSaveV2 }
	| {
			patch?: Partial<Pick<OutfitSaveV2, "current">> & { outfits?: Record<string, OutfitV2> };
			remove?: string[]; // danh sách id xoá
	  };

export type GlobalOutfitsFullV2 = Record<number, OutfitSaveV2>; // ownerId -> OutfitSaveV2

/* ========= PUBLIC OUTFITS (tối thiểu) ========= */
export type PublicOutfit = {
	id: string;
	ownerId: number;
	ownerName?: string;
	name: string;
	assets: number[];
	snapshotThumb?: string;
	updatedAt: number;
	colors?: BodyColorsData;
	// NEW
	scales?: ScalesData;
};
export type PublicOutfitsPayload =
	| { full: true; data: Record<string, PublicOutfit> } // server push toàn bộ
	| { patch?: Record<string, PublicOutfit>; remove?: string[] }; // server push delta

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

		// PUBLIC
		publicOutfitsSync: remote<Client, [payload: PublicOutfitsPayload]>(),

		emoteAnimResponse: remote<Client, [reqId: number, emoteId: number, animId?: string, error?: string]>(),
		bundleResolved: remote<Client, [assetId: number, bundleId?: number]>(),
	}),

	server: namespace({
		// CART
		saveItemRequest: remote<Server, [assetId: number]>(),
		removeItemRequest: remote<Server, [assetId: number]>(),
		requestCart: remote<Server, []>(),
		checkoutRequest: remote<Server, []>(),

		// OUTFITS – REST-ish (V1 – giữ nguyên TÊN HÀM, mở rộng tham số tuỳ chọn)
		/** GET outfits của chính user */
		getOutfits: remote<Server, []>(),
		/** POST tạo/cập nhật 1 outfit */
		postOutfit: remote<
			Server,
			[
				name: string,
				assets: number[],
				snapshotThumb?: string,
				colors?: BodyColorsData,
				scales?: ScalesData, // NEW
				accessoryBlob?: string, // NEW
			]
		>(),
		/** DELETE 1 outfit */
		deleteOutfit: remote<Server, [name: string]>(),
		/** PATCH đổi tên outfit */
		patchOutfitName: remote<Server, [oldName: string, newName: string]>(),
		/** PATCH đặt outfit hiện tại (undefined để bỏ chọn) */
		patchOutfitCurrent: remote<Server, [name?: string]>(),

		// ========= NEW: gửi delta liên tục, server gộp theo nhịp =========
		outfitDelta: remote<Server, [delta: OutfitDelta]>(),

		// ========= PUBLIC =========
		getPublicOutfits: remote<Server, []>(),
		publishOutfit: remote<
			Server,
			[
				name: string,
				assets: number[],
				snapshotThumb?: string,
				colors?: BodyColorsData,
				scales?: ScalesData, // NEW
				accessoryBlob?: string, // NEW
			]
		>(),
		unpublishOutfit: remote<Server, [publicId: string]>(),

		// Mặc outfit
		wearOutfit: remote<
			Server,
			[name: string, assets: number[], hard?: boolean, colors?: BodyColorsData, scales?: ScalesData]
		>(),

		requestEmoteAnim: remote<Server, [reqId: number, emoteId: number]>(),
		resolveBundleFromAssetId: remote<Server, [assetId: number]>(),
	}),
});
