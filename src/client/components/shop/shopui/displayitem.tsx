import React, { useEffect, useRef, useState } from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem, useStore } from "client/hooks";
import { AvatarEditorService, Workspace } from "@rbxts/services";
import { Displaysearch } from "./displaysearchandcatagory";
import { useSelector } from "@rbxts/react-reflex";
import { SPECIAL_PANELS } from "./special-panels";
import { SquareLoader } from "client/components/ui/loading";
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
const MIN_LOADING = 1;

interface AssetItem {
	Id: number;
	Name: string;
	Price?: number;
	Creator: string;
	AssetType?: Enum.AvatarAssetType;
}

interface DisplayItemProps {
	visible?: boolean;
}

export function Displayitem({ visible = true }: DisplayItemProps) {
	const [items, setItems] = useState<AssetItem[]>([]);
	const [pages, setPages] = useState<CatalogPages>();
	const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
	const [isInitialLoading, setIsInitialLoading] = useState(false);

	const rem = useRem();
	const store = useStore();
	const scrollRef = useRef<ScrollingFrame>();
	const page = useSelector(selectPage);
	const subpage = useSelector(selectSubpage) as { filterType: string; value?: string };
	const keyword = useSelector(selectSearchKeyword);
	const catalogVisible = useSelector(selectCatalogVisible);
	const specialKey = useSelector(selectSpecialKey);

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

	useEffect(() => {
		if (!catalogVisible) return;

		setSelectedId(undefined);
		setPages(undefined);
		setItems([]);
		setIsInitialLoading(true);

		const startTime = time();
		const searchParams = new CatalogSearchParams();
		searchParams.SortType = Enum.CatalogSortType.Relevance;
		(searchParams as unknown as { Limit?: number }).Limit = 30;

		let assetType: Enum.AvatarAssetType | undefined;
		let isBundle = false; // cờ để map bundle vs asset

		// ==== Animations (bundle) ====
		if (page.lower() === "animations") {
			searchParams.BundleTypes = [Enum.BundleType.Animations];
			searchParams.SearchKeyword =
				keyword !== "" ? keyword : subpage.filterType === "keyword" ? (subpage.value ?? "") : "";
			isBundle = true;
		}
		// ==== Body (body parts or dynamic head bundle) ====
		else if (page === "Body") {
			if (subpage.value === "DynamicHead") {
				// ĐÚNG: dùng BundleType.DynamicHead, không return giữa chừng
				searchParams.IncludeOffSale = false; // muốn cả offsale thì để true
				(searchParams as unknown as { BundleTypes?: Enum.BundleType[] }).BundleTypes = [
					Enum.BundleType.DynamicHead,
				];
				// clear AssetTypes để tránh xung đột
				(searchParams as unknown as { AssetTypes?: Enum.AvatarAssetType[] }).AssetTypes = [];
				searchParams.SearchKeyword = keyword ?? "";
				isBundle = true;
			} else {
				searchParams.IncludeOffSale = true;
				const key = subpage.filterType === "assetType" ? (subpage.value ?? "") : "Torso";
				assetType = (Enum.AvatarAssetType as unknown as Record<string, Enum.AvatarAssetType>)[key];

				if (!assetType) {
					setIsInitialLoading(false);
					return;
				}
				searchParams.AssetTypes = [assetType];
				searchParams.SearchKeyword = keyword;
			}
		}
		// ==== Các page còn lại (assets) ====
		else {
			if (keyword !== "") {
				assetType = getAssetTypeByPage(page);
				if (!assetType) {
					setIsInitialLoading(false);
					return;
				}
				searchParams.AssetTypes = [assetType];
				searchParams.SearchKeyword = keyword;
			} else if (subpage.filterType === "assetType") {
				assetType = (Enum.AvatarAssetType as unknown as Record<string, Enum.AvatarAssetType>)[
					subpage.value ?? ""
				];
				if (!assetType) {
					setIsInitialLoading(false);
					return;
				}
				searchParams.AssetTypes = [assetType];
				searchParams.SearchKeyword = "";
			} else {
				assetType = getAssetTypeByPage(page);
				if (page === "Hair" && subpage.filterType === "keyword" && (subpage.value ?? "").lower() === "bangs") {
					assetType = Enum.AvatarAssetType.FaceAccessory;
				}
				if (!assetType) {
					setIsInitialLoading(false);
					return;
				}
				searchParams.AssetTypes = [assetType];
				searchParams.IncludeOffSale = true;
				searchParams.SearchKeyword = subpage.filterType === "keyword" ? (subpage.value ?? "") : "";
			}
		}

		let cancelled = false;

		task.spawn(() => {
			const [success, catalogPages] = pcall(() => AvatarEditorService.SearchCatalog(searchParams));

			const finish = () => {
				const elapsed = time() - startTime;
				const remain = math.max(0, MIN_LOADING - elapsed);
				task.delay(remain, () => {
					if (!cancelled) setIsInitialLoading(false);
				});
			};

			if (!success || !catalogPages || cancelled) {
				finish();
				return;
			}

			const first = catalogPages.GetCurrentPage() as SearchCatalogResult[];
			let assetItems: AssetItem[];

			if (isBundle) {
				// map bundle (DynamicHead hoặc Animations)
				assetItems = first.map((r) => {
					const anyR = r as unknown as {
						Id: number;
						Name: string;
						Price?: number;
						CreatorName?: string;
					};
					return {
						Id: anyR.Id,
						Name: anyR.Name,
						Price: anyR.Price,
						Creator: anyR.CreatorName ?? "Unknown",
					};
				});
			} else {
				assetItems = convertResults(first, assetType!);
				if (subpage.filterType === "keyword" && (subpage.value ?? "") !== "") {
					assetItems = filterKeywordItems(assetItems, subpage.value!) as AssetItem[];
				}
			}

			if (!cancelled) {
				setItems(assetItems);
				setPages(catalogPages);
				if (scrollRef.current) scrollRef.current.CanvasPosition = new Vector2(0, 0);
			}

			finish();
		});

		return () => {
			cancelled = true;
		};
	}, [page, subpage, keyword, catalogVisible]);

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
				let newItems: AssetItem[];
				if ((items.size() > 0 && items[0].AssetType === undefined) || page.lower() === "animations") {
					// đang ở chế độ bundle
					newItems = newPage.map((r) => {
						const anyR = r as unknown as {
							Id: number;
							Name: string;
							Price?: number;
							CreatorName?: string;
						};
						return {
							Id: anyR.Id,
							Name: anyR.Name,
							Price: anyR.Price,
							Creator: anyR.CreatorName ?? "Unknown",
						};
					});
				} else {
					const inferred = (items[0]?.AssetType as Enum.AvatarAssetType) ?? Enum.AvatarAssetType.TShirt;
					newItems = convertResults(newPage, inferred);
				}

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

	const PanelComponent = specialKey ? SPECIAL_PANELS[specialKey] : undefined;

	return (
		<Frame size={new UDim2(0.7, 0, 1, 0)} backgroundColor={Color3.fromRGB(38, 38, 39)} visible={visible}>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<Displaysearch />
			<uilistlayout />
			{!catalogVisible && PanelComponent && <PanelComponent />}

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

					{!isInitialLoading &&
						items.map((item, index) => {
							// bundle thumbnail khi là animations hoặc body/dynamichead
							const isBundleThumb =
								page.lower() === "animations" ||
								(page === "Body" && subpage.value === "DynamicHead");

							const thumbUrl = isBundleThumb
								? `rbxthumb://type=BundleThumbnail&id=${item.Id}&w=420&h=420`
								: `rbxthumb://type=Asset&id=${item.Id}&w=420&h=420`;

							return (
								<ItemField
									key={`item-${item.Id}-${index}`}
									id={item.Id}
									name={item.Name}
									price={item.Price ?? 0}
									imageUrl={thumbUrl}
									creator={item.Creator}
									assetType={item.AssetType as Enum.AvatarAssetType}
									bundleType={
										isBundleThumb ? Enum.BundleType.DynamicHead : undefined
									}
									LayoutOrder={index}
									cellW={cellW}
									index={index}
									open={selectedId === item.Id}
									onToggleOpen={() => setSelectedId((cur) => (cur === item.Id ? undefined : item.Id))}
								/>
							);
						})}
				</scrollingframe>
			</Frame>

			{catalogVisible && isInitialLoading && (
				<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 1, 0)}>
					<frame
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={new UDim2(0.5, 0, 0.5, -rem(5))}
						Size={new UDim2(0, rem(20), 0, rem(20))}
						BackgroundTransparency={1}
					>
						<SquareLoader />
					</frame>
				</frame>
			)}
		</Frame>
	);
}

// map asset thường
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
