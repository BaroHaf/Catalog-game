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
import { isAssetApplied, takeOffAsset, tryOnAsset, tryOnEmote, stopEmote } from "./util/camerarotation";
import { MarketplaceService, Players } from "@rbxts/services";
import { addToCart, getCartItems, subscribeCart } from "./util/savedata";
import { useSelector } from "@rbxts/react-reflex";
import { selectPage, selectSubpage } from "client/store/shop";
import { remotes } from "shared/remotes";
import { sendAlert } from "client/alerts";
import { SHOP_ALERT_MSG, SHOP_ALERT_STYLE } from "shared/constants/constant";
import {
	isLayeredAvatarAssetType,
	isLayeredApplied,
	tryOnLayered,
	takeOffLayered,
	debugDumpLayered,
} from "./util/layered";

// Animations util (giữ nguyên mấy cái bạn đang dùng)
import {
	safeTryOnBundle,
	safeTakeOffBundle,
	isAnimationBundleApplied,
	isSingleAnimationApplied,
	takeOffSingleAnimation,
	isAnimationBundleType,
} from "./util/animations";

// ✅ DynamicHead: chỉ import 2 hàm bạn đang có trong camera
import { tryOnBundleHead, takeOffBundleHead } from "./util/camerarotation";

const MAX_CART = 20;

interface Props {
	open: boolean;
	assetType: Enum.AvatarAssetType;
	assetId: number;   // bundleId nếu là bundle
	cellW: number;
	assetName: string;
	bundleType?: Enum.BundleType;
}

type UIMode = "singleAnim" | "animPack" | "normal";

export function DisplayOptions({ open, assetType, assetId, cellW, assetName, bundleType }: Props) {
	const rem = useRem();
	const page = useSelector(selectPage);
	const pageLower = page.lower();
	const subpage = useSelector(selectSubpage) as { filterType?: string; value?: string };

	// ===== Responsive tokens =====
	const clamp = (v: number, lo: number, hi: number) => math.clamp(v, lo, hi);
	const labelSize = math.clamp(math.floor(cellW * 0.085), 5, 12);
	const iconPx = clamp(math.floor(cellW * 0.22), rem(4), rem(7));
	const cornerPx = clamp(math.floor(cellW * 0.08), 6, 12);
	const gapPx = clamp(math.floor(cellW * 0.06), rem(0.6), rem(1.2));
	const mainBtnWidthScale = clamp(0.58 + (cellW / 400) * 0.08, 0.58, 0.7);

	// Body > DynamicHead?
	const isDynamicHead = pageLower === "body" && subpage?.value === "DynamicHead";

	// mount/unmount
	const [shouldRender, setShouldRender] = useState(open);
	const [y, yMotion] = useMotion(1);
	const [a, aMotion] = useMotion(1);

	// trạng thái
	const [equipped, setEquipped] = useState(false);
	const [mode, setMode] = useState<UIMode>("normal");

	// giỏ hàng
	const [cartCount, setCartCount] = useState(0);
	const [inCart, setInCart] = useState(false);

	// ===== Đồng bộ equipped + mode (theo ITEM) =====
	useEffect(() => {
		task.spawn(() => {
			// Nhánh DynamicHead: UI coi như "normal".
			// Equipped sẽ toggle theo click (đơn giản, không cần fetch headId)
			if (isDynamicHead) {
				setMode("normal");
				return;
			}

			// 1) Single animation đang gắn slot → singleAnim
			if (isSingleAnimationApplied(assetId)) {
				setMode("singleAnim");
				setEquipped(true);
				return;
			}
			// 2) Animation bundle → animPack
			if (isAnimationBundleType(bundleType)) {
				setMode("animPack");
				setEquipped(isAnimationBundleApplied(assetId));
				return;
			}
			// 3) Còn lại → normal
			setMode("normal");
			const eq = isLayeredAvatarAssetType(assetType)
				? isLayeredApplied(assetType, assetId)
				: isAssetApplied(assetType, assetId);
			setEquipped(eq);
		});
	}, [isDynamicHead, bundleType, assetType, assetId, open]);

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

	// --- MUA ---
	const promptPurchase = () => {
		// Animations bundle
		if (mode === "animPack") {
			const [ok, err] = pcall(() => MarketplaceService.PromptBundlePurchase(Players.LocalPlayer!, assetId));
			if (!ok) warn("PromptBundlePurchase (animations) failed:", err);
			return;
		}

		// Body > DynamicHead → mua bundle trực tiếp
		if (isDynamicHead) {
			const [ok, err] = pcall(() => MarketplaceService.PromptBundlePurchase(Players.LocalPlayer!, assetId));
			if (!ok) warn("PromptBundlePurchase (body/dynamicHead) failed:", err);
			return;
		}

		// Page khác (asset lẻ)
		if (pageLower !== "body") {
			const [ok, err] = pcall(() => MarketplaceService.PromptPurchase(Players.LocalPlayer!, assetId));
			if (!ok) warn("PromptPurchase failed:", err);
			return;
		}

		// Body subpage khác → resolve bundleId
		let handled = false;
		const disconnect = remotes.client.bundleResolved.connect((aid, bundleId) => {
			if (aid !== assetId || handled) return;
			handled = true;
			disconnect();
			if (!bundleId) {
				warn(`[BUY] Không tìm thấy bundle cho asset ${assetId} (bỏ qua).`);
				return;
			}
			const [ok2, err2] = pcall(() =>
				MarketplaceService.PromptBundlePurchase(Players.LocalPlayer!, bundleId as number),
			);
			if (!ok2) warn("PromptBundlePurchase failed:", err2);
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
		const itemName = assetName;

		// ✅ Body > DynamicHead: chỉ mặc/gỡ Head từ bundle
		if (isDynamicHead) {
			if (equipped) {
				takeOffBundleHead(assetId); // gỡ đúng head của bundle (hoặc pass undefined để gỡ head hiện tại)
				setEquipped(false);
				sendAlert({ ...SHOP_ALERT_STYLE.takeOff, message: SHOP_ALERT_MSG.takeOff(itemName) });
			} else {
				tryOnBundleHead(assetId); // chỉ áp Head từ bundle
				setEquipped(true);
				sendAlert({ ...SHOP_ALERT_STYLE.wear, message: SHOP_ALERT_MSG.wear(itemName) });
			}
			return;
		}

		// SINGLE ANIMATION → chỉ take off
		if (mode === "singleAnim") {
			if (equipped) {
				takeOffSingleAnimation(assetId);
				setEquipped(false);
				sendAlert({ ...SHOP_ALERT_STYLE.takeOff, message: SHOP_ALERT_MSG.takeOff(itemName) });
			}
			return;
		}

		// ANIMATION BUNDLE
		if (mode === "animPack") {
			if (equipped) {
				safeTakeOffBundle();
				setEquipped(false);
				sendAlert({ ...SHOP_ALERT_STYLE.takeOff, message: SHOP_ALERT_MSG.takeOff(itemName) });
			} else {
				safeTryOnBundle(assetId);
				setEquipped(true);
				sendAlert({ ...SHOP_ALERT_STYLE.wear, message: SHOP_ALERT_MSG.wear(itemName) });
			}
			return;
		}

		// EMOTE
		if (assetType === Enum.AvatarAssetType.EmoteAnimation) {
			if (equipped) {
				stopEmote(0.12);
				setEquipped(false);
				sendAlert({ ...SHOP_ALERT_STYLE.takeOff, message: SHOP_ALERT_MSG.takeOff(itemName) });
			} else {
				tryOnEmote(assetId, { looped: true, stopOthers: true });
				setEquipped(true);
				sendAlert({ ...SHOP_ALERT_STYLE.wear, message: SHOP_ALERT_MSG.wear(itemName) });
			}
			return;
		}

		// LAYERED
		if (isLayeredAvatarAssetType(assetType)) {
			if (equipped) {
				takeOffLayered(assetType, assetId);
				debugDumpLayered();
				setEquipped(false);
				sendAlert({ ...SHOP_ALERT_STYLE.takeOff, message: SHOP_ALERT_MSG.takeOff(itemName) });
			} else {
				tryOnLayered(assetType, assetId, { replaceSameType: false });
				debugDumpLayered();
				setEquipped(true);
				sendAlert({ ...SHOP_ALERT_STYLE.wear, message: SHOP_ALERT_MSG.wear(itemName) });
			}
			return;
		}

		// CLASSIC
		if (equipped) {
			takeOffAsset(assetType, assetId);
			setEquipped(false);
			sendAlert({ ...SHOP_ALERT_STYLE.takeOff, message: SHOP_ALERT_MSG.takeOff(itemName) });
		} else {
			tryOnAsset(assetType, assetId, { replaceList: false });
			setEquipped(true);
			sendAlert({ ...SHOP_ALERT_STYLE.wear, message: SHOP_ALERT_MSG.wear(itemName) });
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

				{/* TRY ON / TAKE OFF */}
				<Frame size={new UDim2(1, 0, 0.5, 0)} backgroundTransparency={1}>
					<Button
						size={new UDim2(mainBtnWidthScale, 0, 1, 0)}
						backgroundColor={equipped ? Color3.fromRGB(255, 78, 78) : Color3.fromRGB(14, 250, 10)}
						onClick={onTryOn}
					>
						<uicorner CornerRadius={new UDim(0, cornerPx)} />
						<Text
							text={
								isDynamicHead
									? equipped
										? "TAKE OFF HEAD"
										: "TRY ON HEAD"
									: equipped
									? "TAKE OFF"
									: mode === "animPack"
									? "TRY ON PACK"
									: "TRY ON"
							}
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
						<Image image={images.ui.view_eye} backgroundTransparency={1} size={new UDim2(0.6, 0, 0.6, 0)} anchorPoint={new Vector2(0.5, 0.5)} position={new UDim2(0.5, 0, 0.5, 0)} imageTransparency={fade} />
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
							text={mode === "animPack" || isDynamicHead ? "BUY PACK" : "BUY"}
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
						<Image image={images.ui.rectangle_rounded} backgroundTransparency={1} imageTransparency={inCart || cartCount >= MAX_CART ? 0.6 : fade} size={new UDim2(1, 0, 1, 0)} />
						<Image image={images.ui.add_cart} backgroundTransparency={1} size={new UDim2(0.6, 0, 0.6, 0)} anchorPoint={new Vector2(0.5, 0.5)} position={new UDim2(0.5, 0, 0.5, 0)} imageTransparency={inCart || cartCount >= MAX_CART ? 0.6 : fade} />
					</Button>
				</Frame>
			</Frame>
		</Frame>
	);
}
