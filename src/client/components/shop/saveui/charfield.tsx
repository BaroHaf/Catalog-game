import React, { useEffect, useRef } from "@rbxts/react";
import { Players } from "@rbxts/services";
import { makeCameraController } from "./utils/camerarotation";

export interface CharFieldProps {
	desc?: HumanoidDescription;
	size?: UDim2;                // mặc định full parent
}

export function CharField({ desc, size }: CharFieldProps) {
	const viewportRef = useRef<ViewportFrame>();

	useEffect(() => {
		const vf = viewportRef.current;
		if (!vf) return;

		const world = new Instance("WorldModel");
		world.Parent = vf;

		const cam = new Instance("Camera");
		cam.Parent = vf;
		vf.CurrentCamera = cam;

		const hd =
			desc ??
			Players.GetHumanoidDescriptionFromUserId(Players.LocalPlayer!.UserId);

		const model = Players.CreateHumanoidModelFromDescription(
			hd,
			Enum.HumanoidRigType.R15,
		) as Model;
		model.Name = "Character";
		model.Parent = world;

		const ctrl = makeCameraController(vf, cam, model, {
			yaw: 200,
			pitch: 10,
			zoom: 1.15,
		});

		return () => {
			ctrl.destroy();
			vf.CurrentCamera = undefined;
			model.Destroy();
			cam.Destroy();
			world.Destroy();
		};
	}, [desc]);

	return (
		<viewportframe
			ref={viewportRef}
			Size={size ?? new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
		/>
	);
}
