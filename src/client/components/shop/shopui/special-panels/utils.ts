// src/client/components/shop/shopui/special-panels/utils.ts

/**
 * Tạo gradient Hue 0-360 độ (HSV) -> ColorSequence
 */
export function makeHueGradient(): ColorSequence {
	const steps = 7; // đủ để tạo rainbow mượt
	const keypoints: ColorSequenceKeypoint[] = [];

	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const color = Color3.fromHSV(t, 1, 1);
		keypoints.push(new ColorSequenceKeypoint(t, color));
	}

	return new ColorSequence(keypoints);
}

/**
 * Tạo gradient theo Value (đen -> màu theo Hue)
 */
export function makeValueGradientFromHue(hPct: number): ColorSequence {
	const h = math.clamp(hPct, 0, 1);
	const hueColor = Color3.fromHSV(h, 1, 1);
	return new ColorSequence([
		new ColorSequenceKeypoint(0, new Color3(0, 0, 0)), // đen
		new ColorSequenceKeypoint(1, hueColor),            // màu theo Hue
	]);
}

/** Tiện ích HSV -> Color3 (nếu cần dùng nơi khác) */
export function hsvToColor3(h: number, s: number, v: number): Color3 {
	return Color3.fromHSV(h, s, v);
}

/** Tiện ích lấy màu từ 2 slider (Hue% và Value%) */
export function colorFromSliders(h: number, v: number): Color3 {
	return Color3.fromHSV(math.clamp(h, 0, 1), 1, math.clamp(v, 0, 1));
}
