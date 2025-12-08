import { CATEGORIES } from "../../../../shared/constants/constant";

export function getAssetTypeByPage(page: string): Enum.AvatarAssetType | undefined {
	const category = CATEGORIES.find((cat) => cat.name === page);
	return category?.assetType;
}

export interface AssetItem {
	Id: number;
	Name: string;
	Price?: number;
	Creator: string;
}

export function getAssetItems(page: SearchCatalogResult[]): AssetItem[] {
	return page.map((item) => ({
		Id: item.Id,
		Name: item.Name,
		Price: item.Price,
		Creator: item.CreatorName ?? "Unknown",
	}));
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

export interface SubpageFilter {
	filterType?: "keyword" | "assetType" | "special";
	value?: string;
}

export function getAssetTypeFromSubpage(subpage: { filterType?: string; value?: string }): Enum.AvatarAssetType | undefined {
	if (subpage.filterType !== "assetType") return undefined;
	if (!subpage.value) return undefined;

	return (Enum.AvatarAssetType as unknown as Record<string, Enum.AvatarAssetType>)[subpage.value];
}
