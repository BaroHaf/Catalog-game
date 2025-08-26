// src/shared/avatars/build-desc-from-assets.ts
import { MarketplaceService } from "@rbxts/services";

type AccBuckets = {
  HatAccessory: number[];
  HairAccessory: number[];
  FaceAccessory: number[];
  NeckAccessory: number[];
  ShouldersAccessory: number[];
  FrontAccessory: number[];
  BackAccessory: number[];
  WaistAccessory: number[];
};

function emptyBuckets(): AccBuckets {
  return {
    HatAccessory: [],
    HairAccessory: [],
    FaceAccessory: [],
    NeckAccessory: [],
    ShouldersAccessory: [],
    FrontAccessory: [],
    BackAccessory: [],
    WaistAccessory: [],
  };
}

// Kiểu tối thiểu đủ dùng để lấy AssetTypeId
type ProductInfo = {
  AssetTypeId?: number;
};

export function buildDescriptionFromAssetsServer(assetIds: number[]): HumanoidDescription {
  const desc = new Instance("HumanoidDescription");
  const acc = emptyBuckets();

  for (const id of assetIds ?? []) {
    if (typeOf(id) !== "number" || id <= 0) continue;

    // Lấy typeId trong pcall, tránh giữ "info" ở ngoài (roblox-ts dễ suy luận never)
    let typeId = -1;
    const ok = pcall(() => {
      const raw = MarketplaceService.GetProductInfo(id as number) as unknown as ProductInfo;
      typeId = raw.AssetTypeId ?? -1;
    });
    if (!ok) continue;

    // Clothing & face
    if (typeId === Enum.AssetType.Shirt.Value) {
      desc.Shirt = id;
    } else if (typeId === Enum.AssetType.Pants.Value) {
      desc.Pants = id;
    } else if (typeId === Enum.AssetType.TShirt.Value) {
      desc.GraphicTShirt = id;
    } else if (typeId === Enum.AssetType.Face.Value) {
      desc.Face = id;
    }
    // Accessories
    else if (typeId === Enum.AssetType.Hat.Value) {
      acc.HatAccessory.push(id);
    } else if (typeId === Enum.AssetType.HairAccessory.Value) {
      acc.HairAccessory.push(id);
    } else if (typeId === Enum.AssetType.FaceAccessory.Value) {
      acc.FaceAccessory.push(id);
    } else if (typeId === Enum.AssetType.NeckAccessory.Value) {
      acc.NeckAccessory.push(id);
    } else if (typeId === Enum.AssetType.ShoulderAccessory.Value) {
      acc.ShouldersAccessory.push(id);
    } else if (typeId === Enum.AssetType.FrontAccessory.Value) {
      acc.FrontAccessory.push(id);
    } else if (typeId === Enum.AssetType.BackAccessory.Value) {
      acc.BackAccessory.push(id);
    } else if (typeId === Enum.AssetType.WaistAccessory.Value) {
      acc.WaistAccessory.push(id);
    }
    // TODO: thêm Layered Clothing khác nếu cần (Jacket, Sweater, v.v.)
  }

  const join = (arr: number[]) => (arr.size() > 0 ? arr.join(",") : "");
  desc.HatAccessory = join(acc.HatAccessory);
  desc.HairAccessory = join(acc.HairAccessory);
  desc.FaceAccessory = join(acc.FaceAccessory);
  desc.NeckAccessory = join(acc.NeckAccessory);
  desc.ShouldersAccessory = join(acc.ShouldersAccessory);
  desc.FrontAccessory = join(acc.FrontAccessory);
  desc.BackAccessory = join(acc.BackAccessory);
  desc.WaistAccessory = join(acc.WaistAccessory);

  return desc;
}
