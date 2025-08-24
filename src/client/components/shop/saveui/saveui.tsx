// src/client/components/shop/saveui/saveui.tsx
import React, { useEffect, useMemo, useState } from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem, useStore } from "client/hooks";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";
import { Button } from "client/components/ui/button";
import { CharField } from "./charfield";
import { remotes, type Outfit, type OutfitSave, type OutfitsSyncPayload } from "shared/remotes";
import { buildDescriptionFromAssets } from "./utils/build-desc-from-assets";
import { DisplaySaveOpt } from "./displaysaveopt";

export function SaveUI() {
	const rem = useRem();
	const store = useStore();

	const [save, setSave] = useState<OutfitSave>({ outfits: {}, current: undefined });

	// ô đang mở panel
	const [openKey, setOpenKey] = useState<string | undefined>(undefined);

	// Kết nối remote và load outfits ban đầu
	useEffect(() => {
		const disconnect = remotes.client.outfitsSync.connect((payload: OutfitsSyncPayload) => {
			task.defer(() => {
				if ("full" in payload && payload.full) {
					setSave(() => payload.data ?? { outfits: {}, current: undefined });
					return;
				}
				setSave((prev) => {
					let nextSaveLocal: OutfitSave = { ...prev, outfits: { ...prev.outfits } };

					if ("remove" in payload && payload.remove && payload.remove.size() > 0) {
						for (const k of payload.remove)
							(nextSaveLocal.outfits as Record<string, unknown>)[k] = undefined;

						const compact: Record<string, Outfit> = {};
						for (const [k, v] of pairs(nextSaveLocal.outfits as Record<string, Outfit | undefined>)) {
							if (v !== undefined) compact[k] = v as Outfit;
						}
						nextSaveLocal = { ...nextSaveLocal, outfits: compact };
						if (nextSaveLocal.current && !compact[nextSaveLocal.current]) nextSaveLocal.current = undefined;
					}

					if ("patch" in payload && payload.patch) {
						const p = payload.patch;
						if (p.outfits) {
							const merged = { ...nextSaveLocal.outfits };
							for (const [k, v] of pairs(p.outfits)) merged[k] = v as Outfit;
							nextSaveLocal.outfits = merged;
						}
						if (p.current !== undefined) nextSaveLocal.current = p.current;
					}

					return nextSaveLocal;
				});
			});
		});

		task.defer(() => remotes.server.getOutfits.fire());
		return () => disconnect();
	}, []);

	// Keys được sort theo updatedAt
	const orderedKeys = useMemo(() => {
		const out = new Array<string>();
		for (const [k] of pairs(save.outfits)) out.push(k);
		out.sort((a, b) => {
			const ta = save.outfits[a]?.updatedAt ?? 0;
			const tb = save.outfits[b]?.updatedAt ?? 0;
			return ta > tb; // Luau comparator: boolean
		});
		return out;
	}, [save]);

	// State chứa các HumanoidDescription
	const [descsByKey, setDescsByKey] = useState(new Map<string, HumanoidDescription>());

	// Tạo chữ ký deps từ assets để trigger rebuild desc
	const buildSig = useMemo(() => {
		const parts = new Array<string>();
		for (let i = 0; i < orderedKeys.size(); i++) {
			const k = orderedKeys[i];
			const of = save.outfits[k] as Outfit | undefined;
			const assets = of?.assets ?? [];
			parts.push(`${k}:${assets.join(",")}`);
		}
		return parts.join("|");
	}, [orderedKeys, save]);

	useEffect(() => {
		// Build descs mới (chạy sau render → không warning)
		const newDescs = new Map<string, HumanoidDescription>();
		for (let i = 0; i < orderedKeys.size(); i++) {
			const k = orderedKeys[i];
			const of = save.outfits[k] as Outfit | undefined;
			if (!of) continue;

			const desc = buildDescriptionFromAssets(of.assets);
			newDescs.set(k, desc);
		}

		// Cleanup descs cũ không còn dùng
		for (const [k, oldDesc] of descsByKey) {
			if (!newDescs.has(k)) pcall(() => oldDesc.Destroy());
		}

		setDescsByKey(newDescs);

		// Cleanup khi unmount
		return () => {
			for (const [, d] of newDescs) pcall(() => d.Destroy());
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [buildSig]);

	// Layout
	const cols = 5;
	const cellSize = rem(15);
	const gap = rem(1);
	const sidePad = gap;
	const scrollBar = 8;
	const gridWidth = cols * cellSize + (cols - 1) * gap;

	// Handlers cho panel
	function handleWear(k: string) {
		const outfit = save.outfits[k] as Outfit | undefined;
		if (!outfit) return;
		// nếu server patch theo tên:
		remotes.server.patchOutfitCurrent.fire(outfit.name);
		setOpenKey(undefined);
	}

	function handlePublish(k: string) {
		// ví dụ: mở trang save/publish của bạn
		store.setMenuPage("saveui");
		store.setShopOpen(false);
		setOpenKey(undefined);
	}

	return (
		<scrollingframe
			Size={UDim2.fromOffset(gridWidth + sidePad * 2 + scrollBar, rem(40))}
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={new UDim2(0.5, 0, 0.5, 0)}
			BackgroundColor3={Color3.fromRGB(38, 38, 39)}
			ScrollBarThickness={scrollBar}
		>
			<uicorner CornerRadius={new UDim(0, rem(2))} />
			<uipadding
				PaddingTop={new UDim(0, gap)}
				PaddingLeft={new UDim(0, sidePad)}
				PaddingRight={new UDim(0, sidePad)}
				PaddingBottom={new UDim(0, 0)}
			/>
			<uigridlayout
				CellSize={UDim2.fromOffset(cellSize, cellSize)}
				CellPadding={UDim2.fromOffset(gap, gap)}
				FillDirection={Enum.FillDirection.Horizontal}
				SortOrder={Enum.SortOrder.LayoutOrder}
				HorizontalAlignment={"Center"}
				StartCorner={Enum.StartCorner.TopLeft}
			/>

			{orderedKeys.map((k) => {
				const desc = descsByKey.get(k);
				if (!desc) return undefined as unknown as React.Element;

				const isOpen = openKey === k;

				return (
					<Frame
						key={`of-${k}`}
						size={UDim2.fromOffset(cellSize, cellSize)}
						backgroundTransparency={0.75}
						clipsDescendants // <-- thêm dòng này
					>
						<uicorner CornerRadius={new UDim(0, rem(2))} />
						<CharField size={new UDim2(1, 0, 1, 0)} desc={desc} />

						<Button
							size={new UDim2(1, 0, 1, 0)}
							backgroundTransparency={1}
							active
							zIndex={3}
							onClick={() => setOpenKey(isOpen ? undefined : k)}
						/>

						<DisplaySaveOpt
							open={isOpen}
							cellW={cellSize}
							onWear={() => handleWear(k)}
							onPublish={() => handlePublish(k)}
						/>
					</Frame>
				);
			})}

			{/* Nút tạo outfit mới giữ nguyên */}
			<Button
				size={UDim2.fromOffset(cellSize, cellSize)}
				backgroundTransparency={0.75}
				layoutOrder={9999}
				onClick={() => {
					store.setMenuPage("saveui");
					store.setShopOpen(false);
				}}
			>
				<Image
					image={images.ui.plus_icon}
					size={new UDim2(0.6, 0, 0.6, 0)}
					anchorPoint={new Vector2(0.5, 0.5)}
					position={new UDim2(0.5, 0, 0.5, 0)}
				/>
				<uicorner CornerRadius={new UDim(0, rem(2))} />
			</Button>
		</scrollingframe>
	);
}
