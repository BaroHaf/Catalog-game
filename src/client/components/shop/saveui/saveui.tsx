// src/client/components/shop/saveui/saveui.tsx
import React, { useEffect, useMemo, useState } from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem, useStore } from "client/hooks";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";
import { Button } from "client/components/ui/button";
import { CharField } from "./charfield";
import {
	remotes,
	type Outfit,
	type OutfitSave,
	type OutfitsSyncPayload,
	type PublicOutfit,
	type PublicOutfitsPayload,
} from "shared/remotes";
import { buildDescriptionFromAssets } from "client/components/shop/saveui/utils/build-desc-from-assets";
import { DisplaySaveOpt } from "./displaysaveopt";
import { Players } from "@rbxts/services";
import { Closebutsaveui } from "./closebut";
import { PublicIdBar } from "./publicidbar";
export function SaveUI() {
	const rem = useRem();
	const store = useStore();

	const [save, setSave] = useState<OutfitSave>({ outfits: {}, current: undefined });
	const [openKey, setOpenKey] = useState<string | undefined>(undefined);

	/* =======================
	 * A) OUTFITS (private)
	 * ======================= */
	useEffect(() => {
		const disconnect = remotes.client.outfitsSync.connect((payload: OutfitsSyncPayload) => {
			task.defer(() => {
				if ("full" in payload && payload.full) {
					setSave(() => payload.data ?? { outfits: {}, current: undefined });
					return;
				}
				setSave((prev) => {
					let localSave: OutfitSave = { ...prev, outfits: { ...prev.outfits } };

					if ("remove" in payload && payload.remove && payload.remove.size() > 0) {
						for (const k of payload.remove) (localSave.outfits as Record<string, unknown>)[k] = undefined;

						const compact: Record<string, Outfit> = {};
						for (const [k, v] of pairs(localSave.outfits as Record<string, Outfit | undefined>)) {
							if (v !== undefined) compact[k] = v as Outfit;
						}
						localSave = { ...localSave, outfits: compact };
						if (localSave.current && !compact[localSave.current]) localSave.current = undefined;
					}

					if ("patch" in payload && payload.patch) {
						const p = payload.patch;
						if (p.outfits) {
							const merged = { ...localSave.outfits };
							for (const [k, v] of pairs(p.outfits)) merged[k] = v as Outfit;
							localSave.outfits = merged;
						}
						if (p.current !== undefined) localSave.current = p.current;
					}

					return localSave;
				});
			});
		});

		task.defer(() => remotes.server.getOutfits.fire());
		return () => disconnect();
	}, []);

	const orderedKeys = useMemo(() => {
		const out = new Array<string>();
		for (const [k] of pairs(save.outfits)) out.push(k);
		// sort theo updatedAt giảm dần
		out.sort((a, b) => {
			const ta = save.outfits[a]?.updatedAt ?? 0;
			const tb = save.outfits[b]?.updatedAt ?? 0;
			return ta > tb; // Luau comparator (boolean)
		});
		return out;
	}, [save]);

	const [descsByKey, setDescsByKey] = useState(new Map<string, HumanoidDescription>());

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
		const newDescs = new Map<string, HumanoidDescription>();
		for (let i = 0; i < orderedKeys.size(); i++) {
			const k = orderedKeys[i];
			const of = save.outfits[k] as Outfit | undefined;
			if (!of) continue;

			const desc = buildDescriptionFromAssets(of.assets);
			newDescs.set(k, desc);
		}

		for (const [k, oldDesc] of descsByKey) if (!newDescs.has(k)) pcall(() => oldDesc.Destroy());
		setDescsByKey(newDescs);

		return () => {
			for (const [, d] of newDescs) pcall(() => d.Destroy());
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [buildSig]);

	/* =======================
	 * B) PUBLIC (global): map theo TÊN outfit
	 * ======================= */
	// pubByName: outfitName -> publicId (chỉ của chính LocalPlayer)
	const [pubByName, setPubByName] = useState<Record<string, string>>({});

	useEffect(() => {
		const lp = Players.LocalPlayer!;

		const applyPayload = (payload: PublicOutfitsPayload) => {
			setPubByName((prev) => {
				// clone
				let pubMap: Record<string, string> = {};
				for (const [nm, pid] of pairs(prev)) pubMap[nm as string] = pid as string;

				if ("full" in payload && payload.full) {
					pubMap = {};
					const data = payload.data ?? {};
					for (const [, v] of pairs(data)) {
						const po = v as PublicOutfit;
						if (po.ownerId === lp.UserId) {
							pubMap[po.name] = po.id;
						}
					}
					return pubMap;
				}

				if ("patch" in payload && payload.patch) {
					for (const [, v] of pairs(payload.patch)) {
						const po = v as PublicOutfit;
						if (po.ownerId === lp.UserId) {
							pubMap[po.name] = po.id;
						}
					}
				}

				if ("remove" in payload && payload.remove && payload.remove.size() > 0) {
					const rm: Record<string, true> = {};
					for (const id of payload.remove) rm[id] = true as true;

					const filtered: Record<string, string> = {};
					for (const [name, id] of pairs(pubMap)) {
						const pid = id as string;
						if (!rm[pid]) filtered[name as string] = pid;
					}
					pubMap = filtered;
				}

				return pubMap;
			});
		};

		const off = remotes.client.publicOutfitsSync.connect(applyPayload);
		task.defer(() => remotes.server.getPublicOutfits.fire());
		return () => off();
	}, []);

	const isOutfitPublished = (k: string) => {
		const of = save.outfits[k];
		if (!of) return false;
		return pubByName[of.name] !== undefined;
	};

	const getOutfitPublicId = (k: string): string | undefined => {
		const of = save.outfits[k];
		if (!of) return undefined;
		return pubByName[of.name];
	};

	/* =======================
	 * C) Handlers
	 * ======================= */
	function handleWear(k: string) {
		const of = save.outfits[k];
		if (!of) return;

		// Local preview mượt
		const lp = Players.LocalPlayer!;
		const hum = lp.Character?.FindFirstChildOfClass("Humanoid");
		if (hum) {
			const desc = buildDescriptionFromAssets(of.assets);
			pcall(() => hum.ApplyDescription(desc));
			pcall(() => desc.Destroy());
		} else {
			const conn = lp.CharacterAdded.Connect((char) => {
				const h = char?.FindFirstChildOfClass("Humanoid");
				if (!h) return;
				const desc = buildDescriptionFromAssets(of.assets);
				pcall(() => h.ApplyDescription(desc));
				pcall(() => desc.Destroy());
				conn.Disconnect();
			});
		}

		// Replicate toàn server
		remotes.server.wearOutfit.fire(of.name, of.assets, true);
		print(`[SaveUI] wear request → "${of.name}" | assets=${of.assets.size()} | hard=true`);
	}

	function handlePublishToggle(k: string) {
		const of = save.outfits[k];
		if (!of) return;

		const pid = getOutfitPublicId(k);

		if (pid) {
			// Unpublish
			remotes.server.unpublishOutfit.fire(pid);
			// Optimistic remove theo TÊN
			setPubByName((prev) => {
				const cloneMap: Record<string, string> = {};
				for (const [nm, id] of pairs(prev)) {
					if (nm !== of.name) cloneMap[nm as string] = id as string;
				}
				return cloneMap;
			});
			print(`[SaveUI] unpublish → ${pid} (${of.name})`);
		} else {
			// Publish
			remotes.server.publishOutfit.fire(of.name, of.assets, of.snapshotThumb);
			// Optimistic mark (pending id)
			setPubByName((prev) => {
				const cloneMap: Record<string, string> = {};
				for (const [nm, id] of pairs(prev)) cloneMap[nm as string] = id as string;
				if (!cloneMap[of.name]) cloneMap[of.name] = "_pending_";
				return cloneMap;
			});
			print(`[SaveUI] publish → "${of.name}" | assets=${of.assets.size()}`);
		}
	}

	function handleRemove(k: string) {
		const of = save.outfits[k];
		if (!of) return;
		remotes.server.deleteOutfit.fire(of.name);
	}

	/* =======================
	 * D) Render
	 * ======================= */
	const cols = 5;
	const cellSize = rem(15);
	const gap = rem(1);
	const sidePad = gap;
	const scrollBar = 8;
	const gridWidth = cols * cellSize + (cols - 1) * gap;

	return (
		<Frame
			size={UDim2.fromOffset(gridWidth + sidePad * 2 + scrollBar, rem(40))}
			position={new UDim2(0.5, 0, 0.5, 0)}
			anchorPoint={new Vector2(0.5, 0.5)}
			backgroundTransparency={1}
		>
			<scrollingframe
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundColor3={Color3.fromRGB(38, 38, 39)}
				ScrollBarThickness={scrollBar}
				AutomaticCanvasSize={Enum.AutomaticSize.Y}
				CanvasSize={UDim2.fromOffset(0, 0)}
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

				{(() => {
					const children: Record<string, React.Element> = {};

					for (let i = 0; i < orderedKeys.size(); i++) {
						const k = orderedKeys[i];
						const desc = descsByKey.get(k);
						if (!desc) continue;

						const isOpen = openKey === k;
						const published = isOutfitPublished(k);
						const pid = getOutfitPublicId(k);

						children[`of-${k}`] = (
							<Frame
								layoutOrder={i}
								size={UDim2.fromOffset(cellSize, cellSize)}
								backgroundTransparency={0.75}
								clipsDescendants
							>
								<uicorner CornerRadius={new UDim(0, rem(2))} />

								{/* Avatar preview */}
								<CharField size={new UDim2(1, 0, 1, 0)} desc={desc} />

								{/* Tap to open options */}
								<Button
									size={new UDim2(1, 0, 1, 0)}
									backgroundTransparency={1}
									active
									zIndex={3}
									onClick={() => setOpenKey(isOpen ? undefined : k)}
								/>

								{/* Options */}
								<DisplaySaveOpt
									open={isOpen}
									cellW={cellSize}
									onWear={() => handleWear(k)}
									onPublish={() => handlePublishToggle(k)}
									onRemove={() => handleRemove(k)}
									published={published}
								/>

								{/* Public ID (read-only textbox để có thể chọn & copy thủ công) */}
								<PublicIdBar id={pid} rem={rem} />
							</Frame>
						);
					}

					// Nút "+" để vào trang saveui tạo mới
					children["plus"] = (
						<Button
							layoutOrder={9999}
							size={UDim2.fromOffset(cellSize, cellSize)}
							backgroundTransparency={0.75}
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
					);

					return children;
				})()}
			</scrollingframe>

			{/* Hard close để không hiện Savebutton khi đóng */}
			<Closebutsaveui />
		</Frame>
	);
}
