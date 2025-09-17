// src/shared/constants/constant.ts
import { palette } from "./palette";
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
// ====== SHOP ALERT PRESETS ======
/** Sử dụng Catppuccin palette cho alert */
export const SHOP_ALERT_STYLE = {
	wear: { emoji: "✨", color: palette.green, colorSecondary: palette.teal },
	takeOff: { emoji: "🧺", color: palette.red, colorSecondary: palette.maroon },
	addCart: { emoji: "🛒", color: palette.yellow, colorSecondary: palette.peach },
	inCart: { emoji: "⚠️", color: palette.flamingo, colorSecondary: palette.rosewater },
	cartFull: { emoji: "🚫", color: palette.red, colorSecondary: palette.pink },
	wearoutfit: { emoji: "✨", color: palette.green, colorSecondary: palette.rosewater },
	resetoutfit: { emoji: "✨", color: palette.green },
	remove: { emoji: "🚫", color: palette.red },
	saveoutfit: { emoji: "✅", color: palette.green },
};

/** Messages (dùng trực tiếp cho sendAlert) */
export const SHOP_ALERT_MSG = {
	wear: (itemName: string) => `Complete wear <font color="#ffffff">${itemName}</font>.`,
	takeOff: (itemName: string) => `Removed <font color="#ffffff">${itemName}</font> from your outfit.`,
	addCart: (itemName: string) => `Added <font color="#ffffff">${itemName}</font> to cart.`,
	inCart: (itemName: string) =>
		`<font color="#F59E0B">Already in cart</font> — <font color="#ffffff">${itemName}</font>.`,
	cartFull: (max: number) =>
		`<font color="#EF4444">Cart is full</font> (max <font color="#ffffff">${tostring(max)}</font> items).`,
	wearoutfit: `Complete wear <font color="#ffffff">outfits</font>.`,
	resetoutfit: `Complete reset <font color="#ffffff">outfits</font>.`,
	remove: `Complete remove <font color="#ffffff">outfits</font>.`,
	saveoutfit: `Complete save <font color="#ffffff">outfits</font>.`,
};

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
			{ name: "Hat", filterType: "assetType", filterValue: "Hat" },
			{ name: "Face", filterType: "assetType", filterValue: "FaceAccessory" },
			{ name: "Neck", filterType: "assetType", filterValue: "NeckAccessory" },
			{ name: "Shoulder", filterType: "assetType", filterValue: "ShoulderAccessory" },
			{ name: "Front", filterType: "assetType", filterValue: "FrontAccessory" },
			{ name: "Back", filterType: "assetType", filterValue: "BackAccessory" },
			{ name: "Waist", filterType: "assetType", filterValue: "WaistAccessory" },
			{ name: "Handheld", filterType: "keyword", filterValue: "handheld" },
			{ name: "Effects", filterType: "keyword", filterValue: "effect" },
		],
	},

	{ name: "Faces", assetType: Enum.AvatarAssetType.Face },

	/* ===== Body ===== */
	{
		name: "Body",
		assetType: Enum.AvatarAssetType.Torso, // mặc định tab
		children: [
			{ name: "Colors", filterType: "special", filterValue: "color" },
			{ name: "Scales", filterType: "special", filterValue: "scale" },

			{ name: "Head", filterType: "assetType", filterValue: "DynamicHead" },
			{ name: "Torso", filterType: "assetType", filterValue: "Torso" },
			{ name: "Left Arm", filterType: "assetType", filterValue: "LeftArm" },
			{ name: "Right Arm", filterType: "assetType", filterValue: "RightArm" },
			{ name: "Left Leg", filterType: "assetType", filterValue: "LeftLeg" },
			{ name: "Right Leg", filterType: "assetType", filterValue: "RightLeg" },
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
	{ name: "Featured", assetType: Enum.AvatarAssetType.ShoulderAccessory },
	/* ===== Animations ===== */
	{ name: "Animations", assetType: Enum.AvatarAssetType.Face },
];
