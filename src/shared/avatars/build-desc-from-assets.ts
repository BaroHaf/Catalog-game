// shared/avatars/build-desc-from-assets.ts (SERVER)
import { MarketplaceService } from "@rbxts/services";

type ProductInfo = { AssetTypeId?: number };

const L = Enum.AvatarAssetType;

/* ----------------------- LAYERED CHECK ----------------------- */
const isLayered = (typeId: number) =>
	typeId === L.JacketAccessory.Value ||
	typeId === L.ShirtAccessory.Value ||
	typeId === L.SweaterAccessory.Value ||
	typeId === L.TShirtAccessory.Value ||
	typeId === L.PantsAccessory.Value ||
	typeId === L.ShortsAccessory.Value ||
	typeId === L.DressSkirtAccessory.Value ||
	((L as unknown as Record<string, EnumItem>).LeftShoeAccessory &&
		typeId === (L as unknown as Record<string, EnumItem>).LeftShoeAccessory.Value) ||
	((L as unknown as Record<string, EnumItem>).RightShoeAccessory &&
		typeId === (L as unknown as Record<string, EnumItem>).RightShoeAccessory.Value);

function toAccessoryType(typeId: number): Enum.AccessoryType | undefined {
	const T = Enum.AccessoryType;
	if (typeId === L.JacketAccessory.Value) return T.Jacket;
	if (typeId === L.ShirtAccessory.Value) return T.Shirt;
	if (typeId === L.SweaterAccessory.Value) return T.Sweater;
	if (typeId === L.TShirtAccessory.Value) return T.TShirt;
	if (typeId === L.PantsAccessory.Value) return T.Pants;
	if (typeId === L.ShortsAccessory.Value) return T.Shorts;
	if (typeId === L.DressSkirtAccessory.Value) return T.DressSkirt;

	// Shoes (nếu build có)
	const AAny = L as unknown as Record<string, EnumItem>;
	const TAny = T as unknown as Record<string, EnumItem>;

	if (AAny.LeftShoeAccessory && TAny.LeftShoe && typeId === AAny.LeftShoeAccessory.Value)
		return TAny.LeftShoe as Enum.AccessoryType;

	if (AAny.RightShoeAccessory && TAny.RightShoe && typeId === AAny.RightShoeAccessory.Value)
		return TAny.RightShoe as Enum.AccessoryType;

	return undefined;
}

/* ============================================================
   BUILD SERVER DESCRIPTION
   ============================================================ */
export function buildDescriptionFromAssetsServer(assetIds: number[]): HumanoidDescription {
	const desc = new Instance("HumanoidDescription");

	/* ---------- RIGID CSV BUCKETS ---------- */
	const rigid = {
		HatAccessory: [] as number[],
		HairAccessory: [] as number[],
		FaceAccessory: [] as number[],
		NeckAccessory: [] as number[],
		ShouldersAccessory: [] as number[],
		FrontAccessory: [] as number[],
		BackAccessory: [] as number[],
		WaistAccessory: [] as number[],
	};

	const layered: AccessoryInfo[] = [];
	let order = 50;

	/* ------------------- SCAN ALL ASSETS ------------------- */
	for (const id of assetIds ?? []) {
		if (typeOf(id) !== "number" || id <= 0) continue;

		let typeId = -1;
		const [ok] = pcall(() => {
			const raw = MarketplaceService.GetProductInfo(id as number) as unknown as ProductInfo;
			typeId = raw.AssetTypeId ?? -1;
		});
		if (!ok || typeId < 0) continue;

		/* ---------- 1) CLASSIC CLOTHING ---------- */
		if (typeId === Enum.AssetType.Shirt.Value) { desc.Shirt = id; continue; }
		if (typeId === Enum.AssetType.Pants.Value) { desc.Pants = id; continue; }
		if (typeId === Enum.AssetType.TShirt.Value) { desc.GraphicTShirt = id; continue; }
		if (typeId === Enum.AssetType.Face.Value) { desc.Face = id; continue; }

		/* ---------- 2) BODY PARTS (WITH DYNAMIC HEAD) ---------- */
		if (
			typeId === Enum.AssetType.DynamicHead.Value ||
			typeId === Enum.AssetType.Head.Value
		) {
			desc.Head = id;
			continue;
		}

		if (typeId === Enum.AssetType.Torso.Value) { desc.Torso = id; continue; }
		if (typeId === Enum.AssetType.LeftArm.Value) { desc.LeftArm = id; continue; }
		if (typeId === Enum.AssetType.RightArm.Value) { desc.RightArm = id; continue; }
		if (typeId === Enum.AssetType.LeftLeg.Value) { desc.LeftLeg = id; continue; }
		if (typeId === Enum.AssetType.RightLeg.Value) { desc.RightLeg = id; continue; }

		/* ---------- 3) RIGID ACCESSORIES (CSV) ---------- */
		if (typeId === Enum.AssetType.Hat.Value) { rigid.HatAccessory.push(id); continue; }
		if (typeId === Enum.AssetType.HairAccessory.Value) { rigid.HairAccessory.push(id); continue; }
		if (typeId === Enum.AssetType.FaceAccessory.Value) { rigid.FaceAccessory.push(id); continue; }
		if (typeId === Enum.AssetType.NeckAccessory.Value) { rigid.NeckAccessory.push(id); continue; }
		if (typeId === Enum.AssetType.ShoulderAccessory.Value) { rigid.ShouldersAccessory.push(id); continue; }
		if (typeId === Enum.AssetType.FrontAccessory.Value) { rigid.FrontAccessory.push(id); continue; }
		if (typeId === Enum.AssetType.BackAccessory.Value) { rigid.BackAccessory.push(id); continue; }
		if (typeId === Enum.AssetType.WaistAccessory.Value) { rigid.WaistAccessory.push(id); continue; }

		/* ---------- 4) LAYERED ---------- */
		if (isLayered(typeId)) {
			const at = toAccessoryType(typeId);
			if (at) layered.push({ AssetId: id, AccessoryType: at, Order: order++, IsLayered: true });
		}
	}

	const join = (arr: number[]) => (arr.size() > 0 ? arr.join(",") : "");

	desc.HatAccessory = join(rigid.HatAccessory);
	desc.HairAccessory = join(rigid.HairAccessory);
	desc.FaceAccessory = join(rigid.FaceAccessory);
	desc.NeckAccessory = join(rigid.NeckAccessory);
	desc.ShouldersAccessory = join(rigid.ShouldersAccessory);
	desc.FrontAccessory = join(rigid.FrontAccessory);
	desc.BackAccessory = join(rigid.BackAccessory);
	desc.WaistAccessory = join(rigid.WaistAccessory);

	/* ---------------- APPLY LAYERED ---------------- */
	if (layered.size() > 0) {
		desc.SetAccessories(layered, false);
	}

	return desc;
}
