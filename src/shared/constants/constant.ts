// src/shared/constants/constant.ts

export interface Category {
	name: string;
	assetType?: Enum.AvatarAssetType;
	children?: SubCategory[];
}

export interface SubCategory {
	name: string;
	/** "keyword": lọc theo từ khóa; "assetType": chọn đúng 1 AvatarAssetType; "special": panel đặc biệt */
	filterType?: "keyword" | "assetType" | "special";
	/** với assetType: có thể là key string ("Jacket") hoặc enum value (Enum.AvatarAssetType.Jacket) */
	filterValue?: string | Enum.AvatarAssetType;
}

export const PARTS = [
	{ key: "All", label: "All" },
	{ key: "Head", label: "Head" },
	{ key: "LeftArm", label: "Left Arm" },
	{ key: "LeftLeg", label: "Left Leg" },
	{ key: "RightArm", label: "Right Arm" },
	{ key: "RightLeg", label: "Right Leg" },
	{ key: "Torso", label: "Torso" },
];

export const CATEGORIES: Category[] = [
	{ name: "Inventory" },
	{ name: "Recent" },

	/* ===== Hair ===== */
	{
		name: "Hair",
		assetType: Enum.AvatarAssetType.HairAccessory,
		children: [
			{ name: "All" },
			{ name: "Bangs", filterType: "keyword", filterValue: "bangs" },
			{ name: "Extension", filterType: "keyword", filterValue: "extension" },
		],
	},

	/* ===== Clothing: classic + layered (assetType) ===== */
	{
		name: "Clothing",
		assetType: Enum.AvatarAssetType.Shirt, // mặc định khi vào tab Clothing
		children: [
			{ name: "All" },

			// Classic
			{ name: "Classic T-Shirt", filterType: "assetType", filterValue: "TShirt" },
			{ name: "Classic Shirt", filterType: "assetType", filterValue: "Shirt" },
			{ name: "Classic Pants", filterType: "assetType", filterValue: "Pants" },

			{ name: "Jackets", filterType: "assetType", filterValue: "JacketAccessory" },
			{ name: "Sweaters", filterType: "assetType", filterValue: "SweaterAccessory" },
			{ name: "Shorts", filterType: "assetType", filterValue: "ShortsAccessory" },
			{ name: "Dress/Skirt", filterType: "assetType", filterValue: "DressSkirtAccessory" },
			{ name: "Left Shoe", filterType: "assetType", filterValue: "LeftShoeAccessory" },
			{ name: "Right Shoe", filterType: "assetType", filterValue: "RightShoeAccessory" },
		],
	},

	/* ===== Accessories ===== */
	{
		name: "Accessories",
		assetType: Enum.AvatarAssetType.BackAccessory,
		children: [
			{ name: "All" },
			{ name: "Hat", filterType: "assetType", filterValue: Enum.AvatarAssetType.Hat },
			{ name: "Face", filterType: "assetType", filterValue: Enum.AvatarAssetType.FaceAccessory },
			{ name: "Neck", filterType: "assetType", filterValue: Enum.AvatarAssetType.NeckAccessory },
			{ name: "Shoulder", filterType: "assetType", filterValue: Enum.AvatarAssetType.ShoulderAccessory },
			{ name: "Front", filterType: "assetType", filterValue: Enum.AvatarAssetType.FrontAccessory },
			{ name: "Back", filterType: "assetType", filterValue: Enum.AvatarAssetType.BackAccessory },
			{ name: "Waist", filterType: "assetType", filterValue: Enum.AvatarAssetType.WaistAccessory },
			{ name: "Handheld", filterType: "keyword", filterValue: "handheld" },
			{ name: "Effects", filterType: "keyword", filterValue: "effect" },
		],
	},

	{ name: "Faces", assetType: Enum.AvatarAssetType.Face },

	/* ===== Body ===== */
	{
		name: "Body",
		assetType: Enum.AvatarAssetType.Torso,
		children: [
			{ name: "Colors", filterType: "special", filterValue: "color" },
			{ name: "Scales", filterType: "special", filterValue: "scale" },
			{ name: "Head", filterType: "keyword", filterValue: "head" },
			{ name: "Torso", filterType: "keyword", filterValue: "torso" },
			{ name: "Arms", filterType: "keyword", filterValue: "arm" },
			{ name: "Legs", filterType: "keyword", filterValue: "leg" },
		],
	},

	{ name: "Heads", assetType: Enum.AvatarAssetType.Head },

	{
		name: "Collectibles",
		assetType: Enum.AvatarAssetType.Hat,
		children: [
			{ name: "All" },
			{ name: "Accessories", filterType: "keyword", filterValue: "accessory" },
			{ name: "Faces", filterType: "keyword", filterValue: "face" },
		],
	},

	/* ===== Emotes only (giữ lại) ===== */
	{ name: "Emotes", assetType: Enum.AvatarAssetType.EmoteAnimation },

	{ name: "Gear", assetType: Enum.AvatarAssetType.Gear },
	{ name: "Featured", assetType: Enum.AvatarAssetType.ShoulderAccessory },
	{ name: "Combos" },
];
