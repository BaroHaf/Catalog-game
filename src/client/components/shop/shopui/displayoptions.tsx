// src/client/components/shop/shopui/displayoptions.tsx

import React, { useEffect, useState } from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { Button } from "client/components/ui/button";
import { Image } from "client/components/ui/image";
import { Text } from "client/components/ui/text";
import { images } from "shared/assets";
import { useRem } from "client/hooks";
import { fonts } from "client/constants/fonts";
import { palette } from "shared/constants/palette";
import { useMotion } from "@rbxts/pretty-react-hooks";
import { isAssetApplied, takeOffAsset, tryOnAsset } from "./util/camerarotation";
import { MarketplaceService, Players } from "@rbxts/services";
import { addToCart, getCartItems, subscribeCart } from "./util/savedata";
import { tryOnEmote, stopEmote } from "./util/camerarotation";
import { selectPage } from "client/store/shop";
import { useSelector } from "@rbxts/react-reflex";
import { remotes } from "shared/remotes";
import {
	isLayeredAvatarAssetType,
	isLayeredApplied,
	tryOnLayered,
	takeOffLayered,
	debugDumpLayered,
} from "./util/layered";

const MAX_CART = 20;

interface Props {
	open: boolean;
	assetType: Enum.AvatarAssetType;
	assetId: number;
	cellW: number;
}

export function DisplayOptions({ open, assetType, assetId, cellW }: Props) {
	const rem = useRem();
	const page = useSelector(selectPage);

	// ===== Responsive tokens theo cellW =====
	const clamp = (v: number, lo: number, hi: number) => math.clamp(v, lo, hi);
	const labelSize = math.clamp(math.floor(cellW * 0.085), 5, 12);
	const iconPx = clamp(math.floor(cellW * 0.22), rem(4), rem(7));
	const cornerPx = clamp(math.floor(cellW * 0.08), 6, 12);
	const gapPx = clamp(math.floor(cellW * 0.06), rem(0.6), rem(1.2));
	const mainBtnWidthScale = clamp(0.58 + (cellW / 400) * 0.08, 0.58, 0.7);

	// mount/unmount mượt
	const [shouldRender, setShouldRender] = useState(open);
	const [y, yMotion] = useMotion(1);
	const [a, aMotion] = useMotion(1);

	// trạng thái đã mang chưa
	const [equipped, setEquipped] = useState(false);

	// giỏ hàng
	const [cartCount, setCartCount] = useState(0);
	const [inCart, setInCart] = useState(false);

	// --- đồng bộ trạng thái equipped từ viewport humanoid ---
	useEffect(() => {
		const eq = isLayeredAvatarAssetType(assetType)
			? isLayeredApplied(assetType, assetId)
			: isAssetApplied(assetType, assetId);
		setEquipped(eq);
		print(
			`[UI][DisplayOptions] sync equipped assetId=${assetId} type=${assetType.Name} layered=${
				isLayeredAvatarAssetType(assetType)
			}`,
		);
	}, [assetType, assetId, open]);

	// --- đồng bộ giỏ (realtime) ---
	useEffect(() => {
		const refresh = () => {
			const list = getCartItems();
			setCartCount(list.size());
			let exists = false;
			for (const it of list) {
				if (it.id === assetId) {
					exists = true;
					break;
				}
			}
			setInCart(exists);
		};
		refresh();
		const unsub = subscribeCart(refresh);
		return () => unsub();
	}, [assetId]);

	const SPRING_IN = { tension: 220, friction: 20, mass: 1 };
	const SPRING_OUT = { tension: 230, friction: 18, mass: 1 };
	const FADE_IN = { tension: 180, friction: 22, mass: 1 };
	const FADE_OUT = { tension: 180, friction: 20, mass: 1 };

	// --- MUA (Bundle cho Body) ---
	const promptPurchase = () => {
		if (page !== "Body") {
			const [ok, err] = pcall(() => MarketplaceService.PromptPurchase(Players.LocalPlayer!, assetId));
			if (!ok) warn("PromptPurchase failed:", err);
			return;
		}

		let handled = false;
		const disconnect = remotes.client.bundleResolved.connect((aid, bundleId) => {
			if (aid !== assetId || handled) return;
			handled = true;
			disconnect();

			if (!bundleId) {
				warn(`[BUY] Không tìm thấy bundle cho asset ${assetId} (bỏ qua).`);
				return;
			}

			const [infoOk, info] = pcall(
				() =>
					MarketplaceService.GetProductInfo(bundleId, Enum.InfoType.Bundle) as
						| { IsForSale?: boolean; PriceInRobux?: number }
						| undefined,
			);
			if (infoOk && info && info.IsForSale === false) {
				warn(`[BUY] Bundle ${bundleId} offsale → không mở prompt.`);
				return;
			}

			const [ok, err] = pcall(() => MarketplaceService.PromptBundlePurchase(Players.LocalPlayer!, bundleId));
			if (!ok) warn("PromptBundlePurchase failed:", err);
		});

		remotes.server.resolveBundleFromAssetId.fire(assetId);
	};

	// --- Mount/Unmount transition ---
	useEffect(() => {
		if (open) {
			if (!shouldRender) setShouldRender(true);
			task.defer(() => {
				yMotion.spring(0, SPRING_IN);
				aMotion.spring(0, FADE_IN);
			});
		} else {
			yMotion.spring(1, SPRING_OUT);
			aMotion.spring(1, FADE_OUT);
			task.delay(0.28, () => setShouldRender(false));
		}
	}, [open]);

	if (!shouldRender) return undefined as unknown as JSX.Element;

	const pos = y.map((v: number) => new UDim2(0, 0, v, 0));
	const fade = a.map((x: number) => math.clamp(x, 0, 1));

	// --- TRY ON / TAKE OFF ---
	const onTryOn = () => {
		// Emote
		if (assetType === Enum.AvatarAssetType.EmoteAnimation) {
			if (equipped) {
				print(`[UI][TRY] Stop emote id=${assetId}`);
				stopEmote(0.12);
				setEquipped(false);
			} else {
				print(`[UI][TRY] Play emote id=${assetId}`);
				tryOnEmote(assetId, { looped: true, stopOthers: true });
				setEquipped(true);
			}
			return;
		}

		// Layered clothing
		if (isLayeredAvatarAssetType(assetType)) {
			if (equipped) {
				print(`[UI][TRY] TakeOff layered id=${assetId} type=${assetType.Name}`);
				takeOffLayered(assetType, assetId);
				debugDumpLayered();
				setEquipped(false);
			} else {
				print(`[UI][TRY] TryOn layered id=${assetId} type=${assetType.Name}`);
				// replaceSameType=false để cho phép stack nhiều layer cùng loại (nếu bạn muốn thay thế thì đặt true)
				tryOnLayered(assetType, assetId, { replaceSameType: false });
				debugDumpLayered();
				setEquipped(true);
			}
			return;
		}

		// Classic + Accessories CSV cũ
		if (equipped) {
			print(`[UI][TRY] TakeOff classic id=${assetId} type=${assetType.Name}`);
			takeOffAsset(assetType, assetId);
			setEquipped(false);
		} else {
			print(`[UI][TRY] TryOn classic id=${assetId} type=${assetType.Name}`);
			tryOnAsset(assetType, assetId, { replaceList: false });
			setEquipped(true);
		}
	};

	// --- Add to cart ---
	const canAdd = cartCount < MAX_CART && !inCart;
	const onAddToCart = () => {
		if (!canAdd) {
			if (inCart) print(`[Cart] Asset ${assetId} đã có trong giỏ.`);
			else warn(`[Cart] Đã đủ ${MAX_CART} item, không thể thêm nữa.`);
			return;
		}
		addToCart(assetId);
	};

	return (
		<Frame size={new UDim2(1, 0, 1, 0)} backgroundTransparency={1} position={pos} zIndex={4}>
			<Frame
				size={new UDim2(1, 0, 0.5, 0)}
				anchorPoint={new Vector2(0.5, 0.5)}
				backgroundTransparency={1}
				position={new UDim2(0.5, 0, 0.6, 0)}
				zIndex={4}
			>
				<uilistlayout Padding={new UDim(0, gapPx)} />

				{/* TRY ON */}
				<Frame size={new UDim2(1, 0, 0.5, 0)} backgroundTransparency={1}>
					<Button
						size={new UDim2(mainBtnWidthScale, 0, 1, 0)}
						backgroundColor={equipped ? Color3.fromRGB(255, 78, 78) : Color3.fromRGB(14, 250, 10)}
						onClick={onTryOn}
					>
						<uicorner CornerRadius={new UDim(0, cornerPx)} />
						<Text
							text={equipped ? "TAKE OFF" : "TRY ON"}
							font={fonts.JosefinSans.bold}
							size={new UDim2(1, 0, 1, 0)}
							textColor={palette.black}
							textSize={labelSize}
							textTransparency={fade}
						/>
					</Button>

					<Button
						backgroundTransparency={1}
						anchorPoint={new Vector2(1, 0.5)}
						position={new UDim2(1, 0, 0.5, 0)}
						size={new UDim2(0, iconPx, 0, iconPx)}
						onClick={onTryOn}
					>
						<Image image={images.ui.rectangle_rounded} backgroundTransparency={1} size={new UDim2(1, 0, 1, 0)} imageTransparency={fade} />
						<Image
							image={images.ui.view_eye}
							backgroundTransparency={1}
							size={new UDim2(0.6, 0, 0.6, 0)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							imageTransparency={fade}
						/>
					</Button>
				</Frame>

				{/* BUY / ADD TO CART */}
				<Frame size={new UDim2(1, 0, 0.5, 0)} backgroundTransparency={1}>
					<Button
						size={new UDim2(mainBtnWidthScale, 0, 1, 0)}
						backgroundColor={Color3.fromRGB(14, 250, 10)}
						onClick={promptPurchase}
					>
						<uicorner CornerRadius={new UDim(0, cornerPx)} />
						<Text
							text={"BUY"}
							font={fonts.JosefinSans.bold}
							size={new UDim2(1, 0, 1, 0)}
							textColor={palette.black}
							textSize={labelSize}
							textTransparency={fade}
						/>
					</Button>

					<Button
						backgroundTransparency={1}
						anchorPoint={new Vector2(1, 0.5)}
						position={new UDim2(1, 0, 0.5, 0)}
						size={new UDim2(0, iconPx, 0, iconPx)}
						onClick={onAddToCart}
					>
						<Image
							image={images.ui.rectangle_rounded}
							backgroundTransparency={1}
							imageTransparency={inCart || cartCount >= MAX_CART ? 0.6 : fade}
							size={new UDim2(1, 0, 1, 0)}
						/>
						<Image
							image={images.ui.add_cart}
							backgroundTransparency={1}
							size={new UDim2(0.6, 0, 0.6, 0)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							imageTransparency={inCart || cartCount >= MAX_CART ? 0.6 : fade}
						/>
					</Button>
				</Frame>
			</Frame>
		</Frame>
	);
}
