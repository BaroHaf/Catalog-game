// src/client/components/shop/shopui/special-panels/displaycolorpicker.tsx
import React, { useRef, useState, useEffect } from "@rbxts/react";
import { Button } from "client/components/ui/button";
import { Frame } from "client/components/ui/frame";
import { palette } from "shared/constants/palette";
import { InputCapture } from "client/components/ui/input-capture";
import { makeHueGradient, makeValueGradientFromHue } from "./utils";
import { applyBodyColorFromSliders, isViewportReady, getCurrentBodyColor } from "../util/camerarotation";
import { toggleSelected, getSelectedMap, type BodyRegionExt } from "../util/camerarotation";

import { PARTS } from "shared/constants/constant";
import { useRem } from "client/hooks";
import { Text } from "client/components/ui/text";
import { fonts } from "client/constants/fonts";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";
import { ReactiveButtonDiff } from "client/components/ui/reactive-button-animationdiff";
type Dragging = "hue" | "value" | undefined;

export function BodyColorsPanel() {
	const hueBarRef = useRef<Frame>();
	const valBarRef = useRef<Frame>();
	const rem = useRem();
	const [huePct, setHuePct] = useState(0);
	const [valPct, setValPct] = useState(0);
	const [dragging, setDragging] = useState<Dragging>(undefined);
	const [hasInteracted, setHasInteracted] = useState(false); // chỉ apply sau khi user thao tác
	const [hoveredKey, setHoveredKey] = useState<string | undefined>(undefined);
	// Khi mở panel: đọc màu hiện tại để set vị trí slider (không apply)
	const [selected, setSelected] = useState<Record<string, boolean>>(
		() => getSelectedMap() as unknown as Record<string, boolean>,
	);

	// sync lần đầu (khi mở panel)
	useEffect(() => {
		setSelected(getSelectedMap() as unknown as Record<string, boolean>);
	}, []);
	useEffect(() => {
		const cur = getCurrentBodyColor();
		if (cur) {
			const [h, _s, v] = cur.ToHSV();
			setHuePct(h);
			setValPct(v);
		}
	}, []);

	// Chỉ apply khi đã có thao tác từ user
	useEffect(() => {
		if (!hasInteracted) return;
		if (!isViewportReady()) return;
		applyBodyColorFromSliders(huePct, valPct);
	}, [huePct, valPct, hasInteracted]);

	const SLIDE_HIT_RADIUS = 10;

	const pctFromX = (bar?: Frame, x?: number) => {
		if (!bar || x === undefined) return 0;
		const posX = bar.AbsolutePosition.X;
		const sizeX = math.max(1, bar.AbsoluteSize.X);
		return math.clamp((x - posX) / sizeX, 0, 1);
	};

	const yInBar = (bar?: Frame, y?: number) => {
		if (!bar || y === undefined) return false;
		const posY = bar.AbsolutePosition.Y;
		const sizeY = bar.AbsoluteSize.Y;
		return y >= posY && y <= posY + sizeY;
	};

	const slideCenterX = (bar?: Frame, pct?: number) => {
		if (!bar || pct === undefined) return undefined as never;
		return bar.AbsolutePosition.X + pct * bar.AbsoluteSize.X;
	};

	const markInteracted = () => {
		if (!hasInteracted) setHasInteracted(true);
	};

	const onBarMouseDown = (which: "hue" | "value", x: number, y: number) => {
		const bar = which === "hue" ? hueBarRef.current : valBarRef.current;

		// chỉ xử lý nếu click thật sự nằm trong thanh này
		if (!yInBar(bar, y)) return;

		const pct = pctFromX(bar, x);
		const centerX = slideCenterX(bar, which === "hue" ? huePct : valPct);

		// nếu nhấn gần nút => enter dragging
		if (centerX !== undefined && math.abs(x - centerX) <= SLIDE_HIT_RADIUS) {
			setDragging(which);
			markInteracted();
			return;
		}

		// snap tại vị trí click
		if (which === "hue") setHuePct(pct);
		else setValPct(pct);
		markInteracted();
	};

	const onGlobalMove = (x?: number, y?: number) => {
		if (!dragging || x === undefined) return;

		if (dragging === "hue") {
			if (!yInBar(hueBarRef.current, y)) return;
			setHuePct(pctFromX(hueBarRef.current, x));
		} else {
			if (!yInBar(valBarRef.current, y)) return;
			setValPct(pctFromX(valBarRef.current, x));
		}
		markInteracted();
	};

	const onGlobalUp = () => setDragging(undefined);

	const hueSlidePos = new UDim2(huePct, 0, 0.5, 0);
	const valSlidePos = new UDim2(valPct, 0, 0.5, 0);

	return (
		<Frame size={new UDim2(1, 0, 1, 0)} backgroundTransparency={1}>
			<uiflexitem FlexMode={"Fill"} />
			<uilistlayout FillDirection={"Horizontal"} SortOrder={"LayoutOrder"} />

			<Frame size={new UDim2(0.3, 0, 1, 0)} layoutOrder={0} backgroundTransparency={1}>
				<uilistlayout Padding={new UDim(0, 5)} />
				<uipadding PaddingLeft={new UDim(0, rem(2))} />
				{PARTS.map((part) => {
					const isHovered = hoveredKey === part.key;
					const isSelected = !!selected[part.key]; // <- lấy từ state local đã sync với getSelectedMap()

					const onClick = () => {
						toggleSelected(part.key as BodyRegionExt); // cập nhật lựa chọn trong camerarotation
						setSelected(getSelectedMap() as unknown as Record<string, boolean>); // refresh UI
						setHasInteracted(true);
					};

					return (
						<Frame key={part.key} size={new UDim2(1, 0, 0.1, 0)} backgroundTransparency={1}>
							<uilistlayout FillDirection={"Horizontal"} SortOrder={"LayoutOrder"} />
							<Text
								size={new UDim2(0.5, 0, 1, 0)}
								backgroundTransparency={1}
								text={part.label}
								textXAlignment={"Left"}
								textSize={rem(2)}
								font={fonts.JosefinSans.bold}
								textColor={palette.white}
								layoutOrder={0}
							/>

							<ReactiveButtonDiff
								size={new UDim2(0, rem(3.8), 0.8, 0)}
								backgroundTransparency={1}
								onHover={(hover) => setHoveredKey(hover ? part.key : undefined)}
								onClick={onClick}
							>
								<Image
									image={
										isSelected
											? images.ui.checked_icon
											: isHovered
												? images.ui.checked_icon
												: images.ui.square_fill
									}
									size={new UDim2(1, 0, 1, 0)}
									backgroundTransparency={1}
								/>
							</ReactiveButtonDiff>
						</Frame>
					);
				})}
			</Frame>

			<Frame size={new UDim2(0.7, 0, 1, 0)} layoutOrder={1} backgroundTransparency={1}>
				<uilistlayout />
				<Frame size={new UDim2(1, 0, 0.3, 0)}>
					<uilistlayout />

					{/* ===== HUE ===== */}
					<Frame ref={hueBarRef} size={new UDim2(1, 0, 0.5, 0)} backgroundColor={palette.white}>
						<uigradient Color={makeHueGradient()} />
						<ReactiveButtonDiff
							size={new UDim2(0.01, 0, 1, 0)}
							position={hueSlidePos}
							anchorPoint={new Vector2(0.5, 0.5)}
							backgroundColor={palette.white}
							event={{
								InputBegan: (_, input) => {
									if (
										input.UserInputType === Enum.UserInputType.MouseButton1 ||
										input.UserInputType === Enum.UserInputType.Touch
									) {
										setDragging("hue");
										markInteracted();
									}
								},
								InputEnded: (_, input) => {
									if (
										input.UserInputType === Enum.UserInputType.MouseButton1 ||
										input.UserInputType === Enum.UserInputType.Touch
									) {
										onGlobalUp();
									}
								},
							}}
						/>
						<InputCapture
							size={new UDim2(1, 0, 1, 0)}
							onInputBegan={(_, input) => {
								if (
									input.UserInputType === Enum.UserInputType.MouseButton1 ||
									input.UserInputType === Enum.UserInputType.Touch
								) {
									onBarMouseDown("hue", input.Position.X, input.Position.Y);
								}
							}}
							onInputChanged={(_, input) => {
								if (
									input.UserInputType === Enum.UserInputType.MouseMovement ||
									input.UserInputType === Enum.UserInputType.Touch
								) {
									onGlobalMove(input.Position.X, input.Position.Y);
								}
							}}
							onInputEnded={(_, input) => {
								if (
									input.UserInputType === Enum.UserInputType.MouseButton1 ||
									input.UserInputType === Enum.UserInputType.Touch
								) {
									onGlobalUp();
								}
							}}
						/>
					</Frame>

					{/* ===== VALUE ===== */}
					<Frame ref={valBarRef} size={new UDim2(1, 0, 0.5, 0)} backgroundColor={palette.white}>
						<uigradient Color={makeValueGradientFromHue(huePct)} />
						<Button
							size={new UDim2(0.01, 0, 1, 0)}
							position={valSlidePos}
							anchorPoint={new Vector2(0.5, 0.5)}
							backgroundColor={palette.white}
							event={{
								InputBegan: (_, input) => {
									if (
										input.UserInputType === Enum.UserInputType.MouseButton1 ||
										input.UserInputType === Enum.UserInputType.Touch
									) {
										setDragging("value");
										markInteracted();
									}
								},
								InputEnded: (_, input) => {
									if (
										input.UserInputType === Enum.UserInputType.MouseButton1 ||
										input.UserInputType === Enum.UserInputType.Touch
									) {
										onGlobalUp();
									}
								},
							}}
						/>
						<InputCapture
							size={new UDim2(1, 0, 1, 0)}
							onInputBegan={(_, input) => {
								if (
									input.UserInputType === Enum.UserInputType.MouseButton1 ||
									input.UserInputType === Enum.UserInputType.Touch
								) {
									onBarMouseDown("value", input.Position.X, input.Position.Y);
								}
							}}
							onInputChanged={(_, input) => {
								if (
									input.UserInputType === Enum.UserInputType.MouseMovement ||
									input.UserInputType === Enum.UserInputType.Touch
								) {
									onGlobalMove(input.Position.X, input.Position.Y);
								}
							}}
							onInputEnded={(_, input) => {
								if (
									input.UserInputType === Enum.UserInputType.MouseButton1 ||
									input.UserInputType === Enum.UserInputType.Touch
								) {
									onGlobalUp();
								}
							}}
						/>
					</Frame>
				</Frame>

				<scrollingframe Size={new UDim2(1, 0, 1, 0)} BackgroundTransparency={1}>
					<uiflexitem FlexMode={"Fill"} />
				</scrollingframe>
			</Frame>
		</Frame>
	);
}
