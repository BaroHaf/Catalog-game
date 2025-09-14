import React, { useEffect, useMemo, useRef, useState } from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem } from "client/hooks";
import { remotes, type PublicOutfit, type PublicOutfitsPayload } from "shared/remotes";
import { CharField } from "./charfield";
import { Closebutsaveui } from "./closebut";
import { Viewportui } from "../shopui/displayviewportui";
import { TextField } from "client/components/ui/text-field";
import { palette } from "shared/constants/palette";
import { fonts } from "client/constants/fonts";
import { images } from "shared/assets";
import { Image } from "client/components/ui/image";
import { Button } from "client/components/ui/button";
import { DisplayComopt } from "./displaycomopt";
import { Players } from "@rbxts/services";
import { buildDescriptionFromOutfit } from "./utils/build-desc-from-assets";
import { applyDescriptionToAllTargets } from "../shopui/util/camerarotation";
import { SquareLoader } from "client/components/ui/loading";

const MIN_LOADING = 1;

export function ComUI(): JSX.Element {
	const rem = useRem();

	const gap = rem(1);
	const sidePad = rem(1);
	const scrollBar = 8;
	const cellSize = rem(20);
	const cols = 5;
	const gridWidth = cols * cellSize + (cols - 1) * gap;

	const [outfits, setOutfits] = useState<Record<string, PublicOutfit>>({});
	const [query, setQuery] = useState("");
	const [filterId, setFilterId] = useState<string | undefined>(undefined);
	const [openKey, setOpenKey] = useState<string | undefined>(undefined);

	const [isInitialLoading, setIsInitialLoading] = useState(false);
	const loadStartRef = useRef<number>(0);
	const firstPayloadSeenRef = useRef(false);

	const finishLoadingAfterMinDelay = () => {
		const elapsed = time() - loadStartRef.current;
		const remain = math.max(0, MIN_LOADING - elapsed);
		task.delay(remain, () => setIsInitialLoading(false));
	};

	useEffect(() => {
		setIsInitialLoading(true);
		loadStartRef.current = time();

		const disconnect = remotes.client.publicOutfitsSync.connect((payload: PublicOutfitsPayload) => {
			const anyPayload = payload as unknown as {
				full?: true;
				data?: Record<string, PublicOutfit>;
				patch?: Record<string, PublicOutfit>;
				remove?: string[];
			};

			setOutfits((prev) => {
				if (anyPayload.full && anyPayload.data) {
					firstPayloadSeenRef.current = true;
					return anyPayload.data;
				}
				const updatedMap: Record<string, PublicOutfit> = { ...prev };
				if (anyPayload.patch) {
					for (const [id, ofit] of pairs(anyPayload.patch)) {
						updatedMap[id as string] = ofit as PublicOutfit;
					}
					firstPayloadSeenRef.current = true;
				}
				if (anyPayload.remove) {
					for (const rid of anyPayload.remove) delete updatedMap[rid as string];
					firstPayloadSeenRef.current = true;
				}
				return updatedMap;
			});
		});

		task.defer(() => remotes.server.getPublicOutfits.fire());
		return () => disconnect();
	}, []);

	const orderedKeys = useMemo(() => {
		const arr = new Array<string>();
		for (const [k] of pairs(outfits)) arr.push(k as string);
		arr.sort((a, b) => {
			const ta = outfits[a]?.updatedAt ?? 0;
			const tb = outfits[b]?.updatedAt ?? 0;
			return ta > tb;
		});
		return arr;
	}, [outfits]);

	const descMap = useMemo(() => {
		const m = new Map<string, HumanoidDescription>();
		for (const id of orderedKeys) {
			const of = outfits[id];
			if (of) m.set(id, buildDescriptionFromOutfit(of as PublicOutfit));
		}
		return m;
	}, [orderedKeys, outfits]);

	useEffect(() => {
		if (firstPayloadSeenRef.current) finishLoadingAfterMinDelay();
		return () => {
			for (const [, d] of descMap) pcall(() => d.Destroy());
		};
	}, [descMap]);

	const { displayKeys, invalid } = useMemo(() => {
		if (!filterId || filterId === "") return { displayKeys: orderedKeys, invalid: false };
		if (outfits[filterId]) return { displayKeys: [filterId], invalid: false };
		return { displayKeys: new Array<string>(), invalid: true };
	}, [filterId, orderedKeys, outfits]);

	function onSubmitFilter(enterPressed: boolean, box: TextBox) {
		if (!enterPressed) return;
		const text = box.Text ?? "";
		setQuery(text);
		setFilterId(text !== "" ? text : undefined);
	}

	function handleWear(id: string) {
		const of = outfits[id];
		if (!of) return;

		const lp = Players.LocalPlayer!;
		const applyTo = (h: Humanoid) => {
			const desc = buildDescriptionFromOutfit(of as PublicOutfit);
			pcall(() => h.ApplyDescription(desc));
			applyDescriptionToAllTargets(desc, true);
			pcall(() => desc.Destroy());
		};

		const hum = lp.Character?.FindFirstChildOfClass("Humanoid");
		if (hum) {
			applyTo(hum as Humanoid);
		} else {
			const conn = lp.CharacterAdded.Connect((char) => {
				const h = char?.FindFirstChildOfClass("Humanoid");
				if (h) applyTo(h as Humanoid);
				conn.Disconnect();
			});
		}

		// NEW: gửi scales (nếu có) cùng colors lên server (để log/persist theo nhu cầu)
		remotes.server.wearOutfit.fire(of.name, of.assets, true, of.colors, of.scales);
	}

	return (
		<Frame
			size={new UDim2(0.9, 0, 0.9, 0)}
			anchorPoint={new Vector2(0.5, 0.5)}
			position={new UDim2(0.5, 0, 0.5, 0)}
			cornerRadius={new UDim(0, rem(1))}
			backgroundTransparency={1}
		>
			<uicorner />
			<Frame size={new UDim2(0.3, 0, 1, 0)} backgroundTransparency={1}>
				<Viewportui size={new UDim2(1, 0, 1, 0)} />
				<Closebutsaveui />
			</Frame>

			<uilistlayout Padding={new UDim(0.02, 0)} FillDirection="Horizontal" />

			<Frame size={new UDim2(1, 0, 1, 0)} backgroundColor={Color3.fromRGB(38, 38, 39)}>
				<uicorner />
				<uiflexitem FlexMode={"Fill"} />
				<uilistlayout SortOrder={"LayoutOrder"} />

				{/* Search bar → chỉ render khi hết loading */}
				{!isInitialLoading && (
					<Frame
						size={new UDim2(1, 0, 0, rem(6))}
						backgroundTransparency={1}
						clipsDescendants
						layoutOrder={1}
					>
						<Image
							image={images.ui.search_icon}
							imageColor={Color3.fromRGB(163, 162, 165)}
							imageTransparency={0.5}
							size={new UDim2(0, rem(5), 0, rem(5))}
							position={new UDim2(0, 0, 0, rem(0.5))}
							layoutOrder={0}
						/>
						<uilistlayout FillDirection={"Horizontal"} VerticalAlignment={"Center"} />
						<Frame size={new UDim2(0, rem(50), 1, -rem(1))} backgroundColor={Color3.fromRGB(68, 66, 66)}>
							<uicorner CornerRadius={new UDim(0, 15)} />
							<TextField
								text={query}
								change={{ Text: (rbx) => setQuery((rbx as TextBox).Text) }}
								event={{
									FocusLost: (rbx, enterPressed) => onSubmitFilter(enterPressed, rbx as TextBox),
								}}
								clearTextOnFocus={false}
								placeholderText="Enter ID..."
								placeholderColor={palette.black.Lerp(palette.white, 0.6)}
								textColor={palette.white}
								textSize={rem(3)}
								font={fonts.JosefinSans.regular}
								backgroundTransparency={1}
								size={new UDim2(1, 0, 1, 0)}
								textXAlignment="Center"
								layoutOrder={1}
							/>
						</Frame>
					</Frame>
				)}

				<scrollingframe
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={Color3.fromRGB(38, 38, 39)}
					ScrollBarThickness={scrollBar}
					AutomaticCanvasSize={Enum.AutomaticSize.Y}
					BackgroundTransparency={1}
					LayoutOrder={0}
				>
					<uiflexitem FlexMode={"Fill"} />
					<uicorner CornerRadius={new UDim(0, rem(2))} />
					<uipadding
						PaddingTop={new UDim(0, gap)}
						PaddingLeft={new UDim(0, sidePad)}
						PaddingRight={new UDim(0, sidePad)}
						PaddingBottom={new UDim(0, gap)}
					/>
					<uigridlayout
						CellSize={UDim2.fromOffset(cellSize, cellSize)}
						CellPadding={UDim2.fromOffset(gap, gap)}
						FillDirection={Enum.FillDirection.Horizontal}
						SortOrder={Enum.SortOrder.LayoutOrder}
						HorizontalAlignment={"Center"}
						StartCorner={Enum.StartCorner.TopLeft}
					/>

					{/* Items + empty state → chỉ render khi hết loading */}
					{!isInitialLoading &&
						(() => {
							const children: Record<string, React.Element> = {};
							if (displayKeys.size() === 0) {
								children["_empty"] = (
									<textlabel
										Size={UDim2.fromOffset(gridWidth, rem(6))}
										BackgroundTransparency={1}
										Text={invalid ? "No outfits found with this ID" : "No public outfits yet"}
										TextSize={rem(2)}
										TextColor3={Color3.fromRGB(200, 200, 200)}
									/>
								);
								return children;
							}
							for (let i = 0; i < displayKeys.size(); i++) {
								const id = displayKeys[i];
								const desc = descMap.get(id);
								if (!desc) continue;
								const isOpen = openKey === id;
								children[`pub_${id}`] = (
									<Frame
										layoutOrder={i}
										size={UDim2.fromOffset(cellSize, cellSize)}
										backgroundTransparency={0.75}
										clipsDescendants
									>
										<uicorner CornerRadius={new UDim(0, rem(2))} />
										<CharField size={new UDim2(1, 0, 1, 0)} desc={desc} />
										<Button
											size={new UDim2(1, 0, 1, 0)}
											backgroundTransparency={1}
											active
											zIndex={3}
											onClick={() => setOpenKey(isOpen ? undefined : id)}
										/>
										<DisplayComopt open={isOpen} cellW={cellSize} onWear={() => handleWear(id)} />
									</Frame>
								);
							}
							return children;
						})()}
				</scrollingframe>

				{/* Loader overlay */}
				{isInitialLoading && (
					<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 1, 0)}>
						<frame
							AnchorPoint={new Vector2(0.5, 0.5)}
							Position={new UDim2(0.5, 0, 0.5, 0)}
							Size={new UDim2(0, rem(20), 0, rem(20))}
							BackgroundTransparency={1}
						>
							<SquareLoader />
						</frame>
					</frame>
				)}
			</Frame>
		</Frame>
	);
}
