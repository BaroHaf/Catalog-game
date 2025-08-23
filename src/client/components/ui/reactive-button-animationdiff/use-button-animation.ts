import { useUpdateEffect } from "@rbxts/pretty-react-hooks";
import React, { useMemo } from "@rbxts/react";
import { springs } from "client/constants/springs";
import { useMotion } from "client/hooks";

export interface ButtonAnimation {
	readonly press: React.Binding<number>;
	readonly hover: React.Binding<number>;
	readonly hoverOnly: React.Binding<number>;
	readonly size: React.Binding<UDim2>;
}

// Hover phóng +30%, click thu nhỏ -25%
const HOVER_DELTA = 0.3;
const PRESS_DELTA = 0.25;

export function useButtonAnimation(pressedState: boolean, hoveredState: boolean): ButtonAnimation {
	const [press, pressMotion] = useMotion(0);
	const [hover, hoverMotion] = useMotion(0);
	const [hoverExclusive, hoverExclusiveMotion] = useMotion(0);
	const [position, positionMotion] = useMotion(0);

	useUpdateEffect(() => {
		pressMotion.spring(pressedState ? 1 : 0, springs.responsive);
		hoverExclusiveMotion.spring(hoveredState && !pressedState ? 1 : 0, springs.responsive);
	}, [pressedState, hoveredState]);

	useUpdateEffect(() => {
		hoverMotion.spring(hoveredState ? 1 : 0, springs.responsive);
	}, [hoveredState]);

	useUpdateEffect(() => {
		if (pressedState) {
			positionMotion.spring(1, springs.responsive);
		} else if (hoveredState) {
			positionMotion.spring(-1, { ...springs.bubbly, impulse: -0.1 });
		} else {
			positionMotion.spring(0, { ...springs.bubbly, impulse: -0.07 });
		}
	}, [pressedState]);

	useUpdateEffect(() => {
		if (hoveredState) {
			positionMotion.spring(-1, springs.responsive);
		} else {
			positionMotion.spring(0, springs.responsive);
		}
	}, [hoveredState]);

	const size = useMemo(() => {
		return position.map((p) => {
			const scale =
				p <= 0
					? 1 + (-p) * HOVER_DELTA // Hover → +30%
					: 1 - p * PRESS_DELTA;   // Click → -25%
			return new UDim2(scale, 0, scale, 0);
		});
	}, []);

	return useMemo(() => ({
		press,
		hover: hover.map((t) => math.clamp(t, 0, 1)),
		hoverOnly: hoverExclusive.map((t) => math.clamp(t, 0, 1)),
		size,
	}), []);
}
