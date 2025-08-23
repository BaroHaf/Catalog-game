import { AvatarEditorService } from "@rbxts/services";
import { CATEGORIES } from "../../../../shared/constants/constant";

export function getAssetTypeByPage(page: string): Enum.AvatarAssetType | undefined {
	const category = CATEGORIES.find((cat) => cat.name === page);
	return category?.assetType;
}

export function getAssetItems(page: SearchCatalogResult[]): AssetItem[] {
	return page.map((item) => ({
		Id: item.Id,
		Name: item.Name,
		Price: item.Price,
		Creator: item.CreatorName ?? "Unknown",
	}));
}

export interface AssetItem {
	Id: number;
	Name: string;
	Price?: number;
	Creator: string;
}
function matchExactWord(haystack: string, keyword: string): boolean {
	const words = haystack.split(" ");
	for (const word of words) {
		if (string.lower(word) === keyword) {
			return true;
		}
	}
	return false;
}



export function filterKeywordItems(items: AssetItem[], keyword: string): AssetItem[] {
	const keywordLower = string.lower(keyword);
	const filtered = items.filter((item) => {
		const nameLower = string.lower(item.Name);
		const matched = matchExactWord(nameLower, keywordLower);
		return matched;
	});
	return filtered;
}
