import { blend, useUpdateEffect } from "@rbxts/pretty-react-hooks";
import { composeBindings } from "@rbxts/pretty-react-hooks";
import React from "@rbxts/react";
import { useMotion, useRem } from "client/hooks";

import { Button } from "../button";
import { Frame } from "../frame";
import { useButtonAnimation } from "./use-button-animation";
import { useButtonState } from "./use-button-state";

interface ReactiveButtonProps extends React.PropsWithChildren {
	onClick?: () => void;
	onMouseDown?: () => void;
	onMouseUp?: () => void;
	onMouseEnter?: () => void;
	onMouseLeave?: () => void;
	onHover?: (hovered: boolean) => void;
	onPress?: (pressed: boolean) => void;
	enabled?: boolean;
	size?: UDim2 | React.Binding<UDim2>;
	position?: UDim2 | React.Binding<UDim2>;
	anchorPoint?: Vector2 | React.Binding<Vector2>;
	backgroundColor?: Color3 | React.Binding<Color3>;
	backgroundTransparency?: number | React.Binding<number>;
	cornerRadius?: UDim | React.Binding<UDim>;
	layoutOrder?: number | React.Binding<number>;
	animateSize?: boolean;
	animateSizeStrength?: number;
	zIndex?: number | React.Binding<number>;
	event?: React.InstanceEvent<TextButton>;
	change?: React.InstanceChangeEvent<TextButton>;
}

export function ReactiveButtonDiff({
	onClick,
	onMouseDown,
	onMouseUp,
	onMouseEnter,
	onMouseLeave,
	onHover,
	onPress,
	enabled = true,
	size,
	position,
	anchorPoint,
	backgroundColor = Color3.fromRGB(255, 255, 255),
	backgroundTransparency = 0,
	cornerRadius,
	layoutOrder,
	zIndex,
	animateSize = true,
	animateSizeStrength = 1,
	event,
	change,
	children,
}: ReactiveButtonProps) {
	const rem = useRem();
	const [sizeAnimation, sizeMotion] = useMotion(0);
	const [press, hover, buttonEvents] = useButtonState();
	const animation = useButtonAnimation(press, hover);

	useUpdateEffect(() => {
		if (press) {
			sizeMotion.spring(-0.1, { tension: 300 });
		} else {
			sizeMotion.spring(0, { impulse: 0.01, tension: 300 });
		}
	}, [press]);

	useUpdateEffect(() => {
		onHover?.(hover);
	}, [hover]);

	useUpdateEffect(() => {
		onPress?.(press);
	}, [press]);

	return (
		<Button
			onClick={enabled ? onClick : undefined}
			active={enabled}
			onMouseDown={() => {
				if (!enabled) return;
				buttonEvents.onMouseDown();
				onMouseDown?.();
			}}
			onMouseUp={() => {
				if (!enabled) return;
				buttonEvents.onMouseUp();
				onMouseUp?.();
			}}
			onMouseEnter={() => {
				buttonEvents.onMouseEnter();
				onMouseEnter?.();
			}}
			onMouseLeave={() => {
				buttonEvents.onMouseLeave();
				onMouseLeave?.();
			}}
			backgroundTransparency={1}
			size={size}
			position={position}
			anchorPoint={anchorPoint}
			layoutOrder={layoutOrder}
			zIndex={zIndex}
			event={event}
			change={change}
		>
			<Frame
				backgroundColor={composeBindings(
					animation.hoverOnly,
					animation.press,
					backgroundColor,
					(hover, press, color) => {
						return color.Lerp(new Color3(1, 1, 1), hover * 0.15).Lerp(new Color3(), press * 0.1);
					},
				)}
				backgroundTransparency={composeBindings(
					animation.press,
					backgroundTransparency,
					(press, transparency) => {
						return blend(-press * 0.2, transparency);
					},
				)}
				cornerRadius={cornerRadius}
				anchorPoint={new Vector2(0.5, 0.5)}
				size={animation.size} // Áp dụng size từ animation
				position={new UDim2(0.5, 0, 0.5, 0)} // Cố định center
			>
				{children}
			</Frame>
		</Button>
	);
}
