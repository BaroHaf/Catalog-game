// src/client/components/shop/saveui/saveui.tsx
import React, { useEffect, useMemo, useState } from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem, useStore } from "client/hooks";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";
import { Button } from "client/components/ui/button";
import { CharField } from "./charfield";
import { applyDescriptionToAllTargets } from "../shopui/util/camerarotation";
import {
	remotes,
	type Outfit,
	type OutfitSave,
	type OutfitsSyncPayload,
	type PublicOutfit,
	type PublicOutfitsPayload,
} from "shared/remotes";
import { buildDescriptionFromOutfit } from "./utils/build-desc-from-assets";
import { DisplaySaveOpt } from "./displaysaveopt";
import { Players } from "@rbxts/services";
import { Closebutsaveui } from "./closebut";
import { PublicIdBar } from "./publicidbar";
import { SquareLoader } from "client/components/ui/loading";
import { sendAlert } from "client/alerts";
import { SHOP_ALERT_MSG, SHOP_ALERT_STYLE } from "shared/constants/constant";

function countProps<T>(map: Record<string, T>) {
	let n = 0;
	for (const [,] of pairs(map)) n++;
	return n;
}

export function SaveUI() {
	const rem = useRem();
	const store = useStore();

	const [saveData, setSaveData] = useState<OutfitSave>({ outfits: {}, current: undefined });
	const [openKey, setOpenKey] = useState<string | undefined>();
	const [loading, setLoading] = useState(true);

	// ORDER KEYS
	const orderedKeys = useMemo(() => {
		const arr = new Array<string>();
		for (const [k] of pairs(saveData.outfits)) arr.push(k);
		arr.sort((a, b) => {
			const ta = saveData.outfits[a]?.updatedAt ?? 0;
			const tb = saveData.outfits[b]?.updatedAt ?? 0;
			return ta > tb;
		});
		return arr;
	}, [saveData]);

	// HUMANOID DESCRIPTIONS
	const [descMap, setDescMap] = useState(new Map<string, HumanoidDescription>());

	// SIGNATURE FOR BUILDING
	const buildSignature = useMemo(() => {
		const parts = new Array<string>();
		for (let i = 0; i < orderedKeys.size(); i++) {
			const k = orderedKeys[i];
			const of = saveData.outfits[k];
			if (!of) continue;

			const assets = of.assets;
			const c = of.colors;
			const cSig = c
				? `c:${c.head.join("-")}/${c.torso.join("-")}/${c.leftArm.join("-")}/${c.rightArm.join("-")}/${c.leftLeg.join("-")}/${c.rightLeg.join("-")}`
				: "c:-";

			parts.push(`${k}:${assets.join(",")}|${cSig}`);
		}
		return parts.join("|");
	}, [orderedKeys, saveData]);

	// ======================== OUTFITS SYNC ========================
	useEffect(() => {
		const disconnect = remotes.client.outfitsSync.connect((payload: OutfitsSyncPayload) => {
			task.defer(() => {
				if ("full" in payload && payload.full) {
					const incoming = payload.data ?? { outfits: {}, current: undefined };
					setSaveData(incoming);
					if (countProps(incoming.outfits) === 0) setLoading(false);
					return;
				}

				setSaveData((prev) => {
					let newSave: OutfitSave = {
						...prev,
						outfits: { ...prev.outfits },
					};

					// REMOVE
					if ("remove" in payload && payload.remove && payload.remove.size() > 0) {
						for (const key of payload.remove) {
							(newSave.outfits as Record<string, unknown>)[key] = undefined;
						}

						const compact: Record<string, Outfit> = {};
						for (const [k, v] of pairs(newSave.outfits as Record<string, Outfit | undefined>)) {
							if (v) compact[k] = v;
						}

						newSave = { ...newSave, outfits: compact };
						if (newSave.current && !compact[newSave.current]) newSave.current = undefined;
					}

					// PATCH
					if ("patch" in payload && payload.patch) {
						const p = payload.patch;

						if (p.outfits) {
							const merged = { ...newSave.outfits };
							for (const [k, v] of pairs(p.outfits)) merged[k] = v as Outfit;
							newSave.outfits = merged;
						}

						if (p.current !== undefined) newSave.current = p.current;
					}

					if (countProps(newSave.outfits) === 0) setLoading(false);
					return newSave;
				});
			});
		});

		task.defer(() => remotes.server.getOutfits.fire());
		return () => disconnect();
	}, []);

	// ======================== BUILD DESCRIPTIONS ========================
	useEffect(() => {
		let cancelled = false;
		setLoading(true);

		task.spawn(() => {
			const built = new Map<string, HumanoidDescription>();
			const keys = orderedKeys;

			for (let i = 0; i < keys.size(); i++) {
				if (cancelled) return;

				const key = keys[i];
				const of = saveData.outfits[key];
				if (!of) continue;

				const desc = buildDescriptionFromOutfit(of);
				built.set(key, desc);

				if (i % 3 === 0) task.wait(0);
			}

			if (cancelled) {
				for (const [, d] of built) pcall(() => d.Destroy());
				return;
			}

			for (const [key, oldDesc] of descMap) {
				if (!built.has(key)) pcall(() => oldDesc.Destroy());
			}

			task.defer(() => {
				setDescMap(built);
				setLoading(false);
			});
		});

		return () => {
			cancelled = true;
		};

	}, [buildSignature]);

	// ======================== PUBLIC OUTFITS ========================
	const [publicMap, setPublicMap] = useState<Record<string, string>>({});

	useEffect(() => {
		const lp = Players.LocalPlayer!;

		const applyPayload = (payload: PublicOutfitsPayload) => {
			task.defer(() => {
				setPublicMap((prev) => {
					let map: Record<string, string> = {};
					for (const [nm, id] of pairs(prev)) map[nm as string] = id as string;

					if ("full" in payload && payload.full) {
						map = {};
						const data = payload.data ?? {};
						for (const [, v] of pairs(data)) {
							const po = v as PublicOutfit;
							if (po.ownerId === lp.UserId) map[po.name] = po.id;
						}
						return map;
					}

					if ("patch" in payload && payload.patch) {
						for (const [, v] of pairs(payload.patch)) {
							const po = v as PublicOutfit;
							if (po.ownerId === lp.UserId) map[po.name] = po.id;
						}
					}

					if ("remove" in payload && payload.remove) {
						const removed: Record<string, true> = {};
						for (const id of payload.remove) removed[id] = true;

						const filtered: Record<string, string> = {};
						for (const [nm, id] of pairs(map)) {
							if (!removed[id as string]) filtered[nm as string] = id as string;
						}
						map = filtered;
					}

					return map;
				});
			});
		};

		const off = remotes.client.publicOutfitsSync.connect(applyPayload);
		task.defer(() => remotes.server.getPublicOutfits.fire());
		return () => off();
	}, []);

	const isPublished = (key: string) => {
		const of = saveData.outfits[key];
		if (!of) return false;
		return publicMap[of.name] !== undefined;
	};

	const getPublicId = (key: string) => {
		const of = saveData.outfits[key];
		if (!of) return undefined;
		return publicMap[of.name];
	};

	// ======================== HANDLERS ========================
	function wearOutfit(key: string) {
		const of = saveData.outfits[key];
		if (!of) return;

		const lp = Players.LocalPlayer!;
		const hum = lp.Character?.FindFirstChildOfClass("Humanoid");

		if (hum) {
			const desc = buildDescriptionFromOutfit(of);
			pcall(() => hum.ApplyDescription(desc));
			applyDescriptionToAllTargets(desc, true);
			pcall(() => desc.Destroy());
		} else {
			const conn = lp.CharacterAdded.Connect((char) => {
				const h = char.FindFirstChildOfClass("Humanoid");
				if (!h) return;
				const desc = buildDescriptionFromOutfit(of);
				pcall(() => h.ApplyDescription(desc));
				applyDescriptionToAllTargets(desc, true);
				pcall(() => desc.Destroy());
				conn.Disconnect();
			});
		}

		remotes.server.wearOutfit.fire(of.name, of.assets, true, of.colors, of.scales);
		sendAlert({ ...SHOP_ALERT_STYLE.wearoutfit, message: SHOP_ALERT_MSG.wearoutfit });
	}

	function togglePublish(key: string) {
		const of = saveData.outfits[key];
		if (!of) return;

		const pid = getPublicId(key);

		if (pid) {
			remotes.server.unpublishOutfit.fire(pid);
			setPublicMap((prev) => {
				const map: Record<string, string> = {};
				for (const [nm, id] of pairs(prev)) {
					if (nm !== of.name) map[nm as string] = id as string;
				}
				return map;
			});
		} else {
			remotes.server.publishOutfit.fire(of.name, of.assets, of.snapshotThumb, of.colors, of.scales);
			setPublicMap((prev) => {
				const map: Record<string, string> = {};
				for (const [nm, id] of pairs(prev)) map[nm as string] = id as string;
				if (!map[of.name]) map[of.name] = "_pending_";
				return map;
			});
		}
	}

	function removeOutfit(key: string) {
		const of = saveData.outfits[key];
		if (!of) return;
		remotes.server.deleteOutfit.fire(of.name);
		sendAlert({ ...SHOP_ALERT_STYLE.remove, message: SHOP_ALERT_MSG.remove });
	}

	// ======================== RENDER ========================
	const cols = 5;
	const cell = rem(15);
	const gap = rem(1);
	const pad = gap;
	const bar = 8;
	const gridWidth = cols * cell + (cols - 1) * gap;

	return (
		<Frame
			size={UDim2.fromOffset(gridWidth + pad * 2 + bar, rem(40))}
			position={UDim2.fromScale(0.5, 0.5)}
			anchorPoint={new Vector2(0.5, 0.5)}
			backgroundTransparency={1}
		>
			<frame Size={UDim2.fromScale(1, 1)} BackgroundColor3={Color3.fromRGB(38, 38, 39)} ZIndex={10}>
				<uicorner CornerRadius={new UDim(0, rem(2))} />

				{loading ? (
					<frame
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={UDim2.fromScale(0.5, 0.5)}
						Size={UDim2.fromOffset(rem(20), rem(20))}
						BackgroundTransparency={1}
						Active={false}
						ZIndex={11}
					>
						<SquareLoader />
					</frame>
				) : (
					<scrollingframe
						Size={UDim2.fromScale(1, 1)}
						BackgroundTransparency={1}
						ScrollBarThickness={bar}
						AutomaticCanvasSize={Enum.AutomaticSize.Y}
						CanvasSize={UDim2.fromOffset(0, 0)}
						ZIndex={11}
					>
						<uipadding
							PaddingTop={new UDim(0, gap)}
							PaddingLeft={new UDim(0, pad)}
							PaddingRight={new UDim(0, pad)}
						/>

						<uigridlayout
							CellSize={UDim2.fromOffset(cell, cell)}
							CellPadding={UDim2.fromOffset(gap, gap)}
							HorizontalAlignment="Center"
							FillDirection={Enum.FillDirection.Horizontal}
						/>

						{(() => {
							const children: Record<string, React.Element> = {};

							for (let i = 0; i < orderedKeys.size(); i++) {
								const key = orderedKeys[i];
								const desc = descMap.get(key);
								if (!desc) continue;

								const open = openKey === key;
								const published = isPublished(key);
								const pid = getPublicId(key);

								children[`of-${key}`] = (
									<Frame
										layoutOrder={i}
										size={UDim2.fromOffset(cell, cell)}
										backgroundTransparency={0.75}
										clipsDescendants
									>
										<uicorner CornerRadius={new UDim(0, rem(2))} />
										<CharField size={UDim2.fromScale(1, 1)} desc={desc} />

										<Button
											size={UDim2.fromScale(1, 1)}
											backgroundTransparency={1}
											active
											zIndex={3}
											onClick={() => setOpenKey(open ? undefined : key)}
										/>

										<DisplaySaveOpt
											open={open}
											cellW={cell}
											onWear={() => wearOutfit(key)}
											onPublish={() => togglePublish(key)}
											onRemove={() => removeOutfit(key)}
											published={published}
										/>

										<PublicIdBar id={pid} rem={rem} />
									</Frame>
								);
							}

							children["plus"] = (
								<Button
									layoutOrder={9999}
									size={UDim2.fromOffset(cell, cell)}
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
										position={UDim2.fromScale(0.5, 0.5)}
									/>
									<uicorner CornerRadius={new UDim(0, rem(2))} />
								</Button>
							);

							return children;
						})()}
					</scrollingframe>
				)}
			</frame>

			<Closebutsaveui />
		</Frame>
	);
}
