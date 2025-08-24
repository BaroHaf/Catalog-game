import { UserInputService as UIS } from "@rbxts/services";

export type ViewportController = {
	setYawPitch(yaw: number, pitch: number): void;
	orbitBy(dYaw: number, dPitch: number): void;
	setZoom(z: number): void;
	nudgeZoom(delta: number): void;
	getView(): { yaw: number; pitch: number; zoom: number };
	destroy(): void;
};

export function makeCameraController(
	frame: ViewportFrame,
	cam: Camera,
	model: Model,
	opts?: { yaw?: number; pitch?: number; zoom?: number },
): ViewportController {
	let yaw = opts?.yaw ?? 200;
	let pitch = opts?.pitch ?? 10;
	let zoom = opts?.zoom ?? 1.2;

	const recompute = () => {
		const [cf, size] = model.GetBoundingBox();
		const target = cf.Position.add(new Vector3(0, -0.08 * size.Y, 0));
		const dist = size.Magnitude * 0.7 * zoom;
		const rot = CFrame.fromEulerAnglesYXZ(-math.rad(pitch), math.rad(yaw), 0);
		const pos = target.sub(rot.LookVector.mul(dist));
		cam.CFrame = CFrame.lookAt(pos, target);
	};
	recompute();

	/* --------- hit-test cho frame --------- */
	const isMouseInside = () => {
		const p = frame.AbsolutePosition;
		const s = frame.AbsoluteSize;
		const m = UIS.GetMouseLocation();
		return m.X >= p.X && m.X < p.X + s.X && m.Y >= p.Y && m.Y < p.Y + s.Y;
	};

	/* --------- Input scoping theo frame --------- */
	let dragging = false;
	let last = UIS.GetMouseLocation();

	// Chỉ bắt đầu kéo khi click TRÊN frame này
	const g1 = frame.InputBegan.Connect((i) => {
		if (i.UserInputType === Enum.UserInputType.MouseButton1 && isMouseInside()) {
			dragging = true;
			last = UIS.GetMouseLocation();
		}
	});

	// Lăn chuột chỉ khi con trỏ đang trên frame này
	const g2 = frame.InputChanged.Connect((i) => {
		if (i.UserInputType === Enum.UserInputType.MouseWheel && isMouseInside()) {
			zoom = math.max(0.2, zoom - 0.25 * i.Position.Z);
			recompute();
		}
	});

	// Trong lúc kéo: theo dõi bằng UIS để kéo mượt kể cả khi trượt ra ngoài
	const u1 = UIS.InputChanged.Connect((i) => {
		if (i.UserInputType === Enum.UserInputType.MouseMovement && dragging) {
			const cur = UIS.GetMouseLocation();
			const dx = cur.X - last.X;
			const dy = cur.Y - last.Y;
			last = cur;

			if (dx !== 0 || dy !== 0) {
				yaw -= dx * 0.35;
				pitch = math.clamp(pitch - dy * 0.28, -85, 85);
				recompute();
			}
		}
	});

	const u2 = UIS.InputEnded.Connect((i) => {
		if (i.UserInputType === Enum.UserInputType.MouseButton1) dragging = false;
	});

	return {
		setYawPitch(y: number, p: number) {
			yaw = y;
			pitch = math.clamp(p, -85, 85);
			recompute();
		},
		orbitBy(dy: number, dp: number) {
			yaw += dy;
			pitch = math.clamp(pitch + dp, -85, 85);
			recompute();
		},
		setZoom(z: number) {
			zoom = math.max(0.2, z);
			recompute();
		},
		nudgeZoom(d: number) {
			zoom = math.max(0.2, zoom + d);
			recompute();
		},
		getView() {
			return { yaw, pitch, zoom };
		},
		destroy() {
			g1.Disconnect();
			g2.Disconnect();
			u1.Disconnect();
			u2.Disconnect();
		},
	};
}
