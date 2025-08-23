import React, { useEffect, useRef, useState } from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem, useStore } from "client/hooks";
import { AvatarEditorService, Workspace } from "@rbxts/services";
import { Displaysearch } from "./displaysearchandcatagory";
import { useSelector } from "@rbxts/react-reflex";
import { SPECIAL_PANELS } from "./special-panels";

import {
	selectPage,
	selectSubpage,
	selectSearchKeyword,
	selectCatalogVisible,
	selectSpecialKey,
} from "client/store/shop";
import { getAssetTypeByPage, filterKeywordItems } from "./utils";
import { ItemField } from "./item-field";

const SCROLL_LOAD_FACTOR = 0.8;
const COLS = 6;
const IMAGE_RATIO = 1.0;
const EXTRA_TEXT_RATIO = 0.26;
const TEXT_PAD_REM_BASE = 6;

interface AssetItem {
	Id: number;
	Name: string;
	Price?: number;
	Creator: string;
	AssetType: Enum.AvatarAssetType;
}
interface DisplayItemProps {
  visible?: boolean;
}
export function Displayitem({ visible = true }: DisplayItemProps) {
	const [items, setItems] = useState<AssetItem[]>([]);
	const [pages, setPages] = useState<CatalogPages>();
	const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
	const rem = useRem();
  	const store = useStore()
	const scrollRef = useRef<ScrollingFrame>();
	const page = useSelector(selectPage);
	const subpage = useSelector(selectSubpage);
	const keyword = useSelector(selectSearchKeyword);
	const catalogVisible = useSelector(selectCatalogVisible);
	const specialKey = useSelector(selectSpecialKey);

	// ===== responsive grid =====
	const [cellW, setCellW] = useState(120);
	const [cellH, setCellH] = useState(160);
	const [gapPx, setGapPx] = useState(8);

	const recalcGrid = () => {
		const sc = scrollRef.current;
		if (!sc) return;

		const gap = rem(1);
		setGapPx(gap);

		const padLR = rem(1) * 2;
		const innerW = math.max(0, sc.AbsoluteSize.X - padLR - sc.ScrollBarThickness);
		const w = math.floor((innerW - gap * (COLS - 1)) / COLS);
		const imageH = math.floor(w * IMAGE_RATIO);
		const textPadPx = math.max(rem(TEXT_PAD_REM_BASE), math.floor(w * EXTRA_TEXT_RATIO));

		setCellW(w);
		setCellH(imageH + textPadPx);
	};

	useEffect(() => {
		recalcGrid();
		const cam = Workspace.CurrentCamera!;
		const c1 = cam.GetPropertyChangedSignal("ViewportSize").Connect(recalcGrid);
		const c2 = scrollRef.current?.GetPropertyChangedSignal("AbsoluteSize").Connect(recalcGrid);
		return () => {
			c1.Disconnect();
			c2 && c2.Disconnect();
		};
	}, [rem]);

	// ===== fetch: chỉ chạy khi catalogVisible =====
	useEffect(() => {
		if (!catalogVisible) return;

		setItems([]);
		setPages(undefined);
		setSelectedId(undefined);

		const searchParams = new CatalogSearchParams();
		searchParams.SortType = Enum.CatalogSortType.Relevance;
		(searchParams as unknown as { Limit?: number }).Limit = 30;

		let assetType: Enum.AvatarAssetType | undefined;

		if (keyword !== "") {
			assetType = getAssetTypeByPage(page);
			if (!assetType) return;
			searchParams.AssetTypes = [assetType];
			searchParams.SearchKeyword = keyword;
		} else if (subpage.filterType === "assetType") {
			assetType = (Enum.AvatarAssetType as unknown as Record<string, Enum.AvatarAssetType>)[subpage.value];
			if (!assetType) return;
			searchParams.AssetTypes = [assetType];
			searchParams.SearchKeyword = "";
		} else {
			assetType = getAssetTypeByPage(page);
			if (subpage.filterType === "keyword" && subpage.value.lower() === "bangs") {
				assetType = Enum.AvatarAssetType.FaceAccessory;
			}
			if (!assetType) return;
			searchParams.AssetTypes = [assetType];
			searchParams.SearchKeyword = subpage.filterType === "keyword" ? subpage.value : "";
		}

		const [success, catalogPages] = pcall(() => AvatarEditorService.SearchCatalog(searchParams));
		if (!success || !catalogPages) {
			warn(`Failed to fetch items for page="${page}", sub="${subpage.value}"`);
			return;
		}

		const first = catalogPages.GetCurrentPage() as SearchCatalogResult[];
		let assetItems = convertResults(first, assetType!);
		if (subpage.filterType === "keyword" && subpage.value !== "") {
			assetItems = filterKeywordItems(assetItems, subpage.value) as AssetItem[];
		}
		setItems(assetItems);
		setPages(catalogPages);

		const sc = scrollRef.current;
		if (sc) sc.CanvasPosition = new Vector2(0, 0);
	}, [page, subpage, keyword, catalogVisible]);

	// ===== infinite scroll: cũng chỉ chạy khi catalogVisible =====
	useEffect(() => {
		const sc = scrollRef.current;
		if (!sc || !pages || !catalogVisible) return;

		let isLoadingNextPage = false;
		let consecutiveFailures = 0;

		const conn = sc.GetPropertyChangedSignal("CanvasPosition").Connect(() => {
			if (isLoadingNextPage) return;
			if (pages.IsFinished || !shouldLoadNext(sc)) return;
			if (consecutiveFailures >= 3) return;

			isLoadingNextPage = true;
			task.spawn(() => {
				const [success] = pcall(() => pages.AdvanceToNextPageAsync());
				if (!success) {
					consecutiveFailures++;
					task.delay(1, () => (isLoadingNextPage = false));
					return;
				}
				consecutiveFailures = 0;

				const newPage = pages.GetCurrentPage() as SearchCatalogResult[];
				const inferredType = (items[0]?.AssetType as Enum.AvatarAssetType) ?? Enum.AvatarAssetType.TShirt;
				const newItems = convertResults(newPage, inferredType);

				setItems((prev) => {
					const ids = new Set(prev.map((i) => i.Id));
					const filtered = newItems.filter((i) => !ids.has(i.Id));
					return [...prev, ...filtered];
				});

				task.delay(0.5, () => (isLoadingNextPage = false));
			});
		});

		return () => conn.Disconnect();
	}, [pages, items, catalogVisible]);
	useEffect(() => {
		if (page.lower() === "body" && subpage.filterType === "") {
			store.setSubpage({ filterType: "special", value: "color" });
		}
	}, [page, subpage.filterType]);
	// ===== special panel (nếu có)
	const PanelComponent = specialKey ? SPECIAL_PANELS[specialKey] : undefined;

	return (
		<Frame size={new UDim2(0.7, 0, 1, 0)} backgroundColor={Color3.fromRGB(38, 38, 39)} visible={visible}>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<Displaysearch />
			<uilistlayout />

			{/* Panel đặc biệt (không props) */}
			{!catalogVisible && PanelComponent && <PanelComponent />}

			{/* Catalog grid: chỉ cần ẩn frame này khi special */}
			<Frame size={new UDim2(1, 0, 1, 0)} backgroundTransparency={1} visible={catalogVisible}>
				<uiflexitem FlexMode="Fill" />
				<scrollingframe
					Size={new UDim2(1, 0, 1, 0)}
					ScrollBarThickness={8}
					AutomaticCanvasSize={"XY"}
					ref={scrollRef}
					BackgroundTransparency={1}
				>
					<uigridlayout
						CellSize={new UDim2(0, cellW, 0, cellH)}
						CellPadding={new UDim2(0, gapPx, 0, gapPx)}
						FillDirection={"Horizontal"}
						FillDirectionMaxCells={COLS}
						SortOrder={"LayoutOrder"}
					/>
					<uipadding
						PaddingTop={new UDim(0, rem(1))}
						PaddingBottom={new UDim(0, rem(1))}
						PaddingLeft={new UDim(0, rem(1))}
						PaddingRight={new UDim(0, rem(1))}
					/>

					{items.map((item, index) => (
						<ItemField
							key={`item-${item.Id}-${index}`}
							id={item.Id}
							name={item.Name}
							price={item.Price ?? 0}
							imageUrl={`rbxthumb://type=Asset&id=${item.Id}&w=420&h=420`}
							creator={item.Creator}
							assetType={item.AssetType}
							LayoutOrder={index}
							cellW={cellW}
							index={index}
							open={selectedId === item.Id}
							onToggleOpen={() => setSelectedId((cur) => (cur === item.Id ? undefined : item.Id))}
						/>
					))}
				</scrollingframe>
			</Frame>
		</Frame>
	);
}

function convertResults(results: SearchCatalogResult[], assetType: Enum.AvatarAssetType): AssetItem[] {
	return results.map((r) => ({
		Id: r.Id,
		Name: r.Name,
		Price: r.Price,
		Creator: r.CreatorName ?? "Unknown",
		AssetType: assetType,
	}));
}

function shouldLoadNext(sc: ScrollingFrame) {
	const bottom = sc.AbsoluteWindowSize.Y * (2 - SCROLL_LOAD_FACTOR) + sc.CanvasPosition.Y;
	return bottom >= sc.AbsoluteCanvasSize.Y;
}
