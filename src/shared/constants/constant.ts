export interface Category {
	name: string;
	assetType?: Enum.AvatarAssetType;
	children?: SubCategory[];
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
export interface SubCategory {
	name: string;
	// Tuỳ theo từng loại, bạn có thể lọc theo keyword hoặc assetType phụ
	filterType?: "keyword" | "assetType"|"special";
	filterValue?: string | Enum.AvatarAssetType;
}


export const CATEGORIES: Category[] = [
	{ name: "Inventory" },
	{ name: "Recent" },

	{
		name: "Hair",
		assetType: Enum.AvatarAssetType.HairAccessory,
		children: [
			{ name: "All" },
			{ name: "Bangs", filterType: "keyword", filterValue: "bangs" },
			{ name: "Extention", filterType: "keyword", filterValue: "extention" },
		],
	},

	{
		name: "Clothing",
		assetType: Enum.AvatarAssetType.Shirt,
		children: [
			{ name: "All" },
			{ name: "Classic T-Shirt", filterType: "assetType", filterValue: "TShirt" },
			{ name: "Classic Shirt", filterType: "assetType", filterValue: "Shirt" },
			{ name: "Classic Pant", filterType: "assetType", filterValue: "Pants" },
			{ name: "Classic", filterType: "keyword", filterValue: "classic" },
			{ name: "Layered", filterType: "keyword", filterValue: "layered" },
			{ name: "T-Shirt", filterType: "keyword", filterValue: "t-shirt" },
			{ name: "Pant", filterType: "keyword", filterValue: "pant" },
			{ name: "Jackets", filterType: "keyword", filterValue: "jacket" },
			{ name: "Shirts", filterType: "keyword", filterValue: "shirt" },
			{ name: "Sweaters", filterType: "keyword", filterValue: "sweater" },
			{ name: "Shorts", filterType: "keyword", filterValue: "shorts" },
			{ name: "Dress/Skirt", filterType: "keyword", filterValue: "dress skirt" },
			{ name: "Shoes", filterType: "keyword", filterValue: "shoes" },
		],
	},

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
			{ name: "Handeld", filterType: "keyword", filterValue: "handheld" },
			{ name: "Effects", filterType: "keyword", filterValue: "effect" },
		],
	},

	{
		name: "Faces",
		assetType: Enum.AvatarAssetType.Face,
	},

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

	{
		name: "Heads",
		assetType: Enum.AvatarAssetType.Head,
	},

	{
		name: "Collectibles",
		assetType: Enum.AvatarAssetType.Hat,
		children: [
			{ name: "All" },
			{ name: "Accessories", filterType: "keyword", filterValue: "accessory" },
			{ name: "Faces", filterType: "keyword", filterValue: "face" },
		],
	},

	{
		name: "Gear",
		assetType: Enum.AvatarAssetType.Gear,
	},

	{
		name: "Featured",
		assetType: Enum.AvatarAssetType.ShoulderAccessory,
	},

	{ name: "Combos" },
];
