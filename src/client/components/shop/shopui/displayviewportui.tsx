import React, { useEffect, useRef } from "@rbxts/react";
import { Players, UserInputService as UIS } from "@rbxts/services";
import { setupViewportFromCachedCharacter, type ViewportController } from "./util/camerarotation";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";

const DRAG_BUTTON = Enum.UserInputType.MouseButton1;
const YAW_PER_PX = 0.35;
const PITCH_PER_PX = 0.28;

interface ViewportProps {
	visible?: boolean;
	size?: UDim2;
	position?: UDim2;
}

export function Viewportui({ visible = true, size, position }: ViewportProps) {
	const viewportRef = useRef<ViewportFrame>();
	const controllerRef = useRef<ViewportController>();
	const draggingRef = useRef(false);
	const prevMouseRef = useRef<Vector2>(UIS.GetMouseLocation());

	const frameSize = size ?? new UDim2(0.3, 0, 1, 0);
	const framePos = position ?? new UDim2(0, 0, 0, 0);

	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;

		const { start, cleanup, controller } = setupViewportFromCachedCharacter(
			viewport,
			Players.LocalPlayer!.UserId,
			{
				fov: 35,
				yawDeg: 200,
				pitchDeg: 10,
				rollDeg: 6,
				zoom: 1.28,
				focusYOffsetRatio: -0.08,
				paddingScale: 1.12,
				framing: "full",
				light: true,
				cache: true,
			},
		);

		controllerRef.current = controller;
		void start();

		return () => {
			controllerRef.current = undefined;
			cleanup();
		};
	}, []);

	const isInsideViewport = () => {
		const vf = viewportRef.current;
		if (!vf) return false;
		const p = vf.AbsolutePosition;
		const s = vf.AbsoluteSize;
		const m = UIS.GetMouseLocation();
		return m.X >= p.X && m.X < p.X + s.X && m.Y >= p.Y && m.Y < p.Y + s.Y;
	};

	useEffect(() => {
		const beganConn = UIS.InputBegan.Connect((input) => {
			if (input.UserInputType === DRAG_BUTTON && isInsideViewport()) {
				draggingRef.current = true;
				prevMouseRef.current = UIS.GetMouseLocation();
			}
		});

		const changedConn = UIS.InputChanged.Connect((input) => {
			const ctrl = controllerRef.current;
			if (!ctrl) return;

			if (input.UserInputType === Enum.UserInputType.MouseWheel) {
				if (!isInsideViewport()) return;
				ctrl.nudgeZoom(-0.25 * input.Position.Z);
				return;
			}

			if (input.UserInputType === Enum.UserInputType.MouseMovement && draggingRef.current) {
				const curr = UIS.GetMouseLocation();
				const prev = prevMouseRef.current;
				const dx = curr.X - prev.X;
				const dy = curr.Y - prev.Y;
				prevMouseRef.current = curr;

				if (dx !== 0 || dy !== 0) {
					const view = ctrl.getView();
					ctrl.setYawPitch(view.yawDeg - dx * YAW_PER_PX, view.pitchDeg - dy * PITCH_PER_PX);
				}
			}
		});

		const endedConn = UIS.InputEnded.Connect((input) => {
			if (input.UserInputType === DRAG_BUTTON && draggingRef.current) {
				draggingRef.current = false;
			}
		});

		return () => {
			beganConn.Disconnect();
			changedConn.Disconnect();
			endedConn.Disconnect();
		};
	}, []);

	return (
		<frame Size={frameSize} Position={framePos} BackgroundTransparency={1} Visible={visible}>
			<uiflexitem FlexMode={"Fill"}/>
			<viewportframe ref={viewportRef} Size={new UDim2(1, 0, 1, 0)} BackgroundTransparency={1} ZIndex={1} />
			<Image image={images.ui.background} size={new UDim2(1, 0, 1, 0)} zIndex={0}>
				<uicorner CornerRadius={new UDim(0, 20)} />
			</Image>
		</frame>
	);
}
