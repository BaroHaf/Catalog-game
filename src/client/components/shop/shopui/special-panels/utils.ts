const HUE_COLORS: Color3[] = [
	Color3.fromRGB(255, 0, 0),
	Color3.fromRGB(255, 128, 0),
	Color3.fromRGB(255, 255, 0),
	Color3.fromRGB(128, 255, 0),
	Color3.fromRGB(0, 255, 0),
	Color3.fromRGB(0, 255, 128),
	Color3.fromRGB(0, 255, 255),
	Color3.fromRGB(0, 128, 255),
	Color3.fromRGB(0, 0, 255),
	Color3.fromRGB(128, 0, 255),
	Color3.fromRGB(255, 0, 255),
	Color3.fromRGB(255, 0, 128),

	Color3.fromRGB(255, 224, 189),
	Color3.fromRGB(241, 194, 125),
	Color3.fromRGB(224, 172, 105),
	Color3.fromRGB(198, 134, 66),
	Color3.fromRGB(141, 85, 36),
];

function getHueColorFromPct(hPct: number): Color3 {
	const n = HUE_COLORS.size();
	if (n === 0) return Color3.fromRGB(255, 255, 255);

	const t = math.clamp(hPct, 0, 0.999999);
	const idx = math.floor(t * n);
	return HUE_COLORS[idx];
}

export function makeHueGradient(): ColorSequence {
	const keypoints: ColorSequenceKeypoint[] = [];

	for (let i = 0; i < HUE_COLORS.size(); i++) {
		const t = i / (HUE_COLORS.size() - 1);
		keypoints.push(new ColorSequenceKeypoint(t, HUE_COLORS[i]));
	}

	return new ColorSequence(keypoints);
}

export function makeValueGradientFromHue(hPct: number): ColorSequence {
	const hueColor = getHueColorFromPct(hPct);
	return new ColorSequence([
		new ColorSequenceKeypoint(0, new Color3(0, 0, 0)),
		new ColorSequenceKeypoint(1, hueColor),
	]);
}

export function hsvToColor3(h: number, s: number, v: number): Color3 {
	return Color3.fromHSV(h, s, v);
}

export function colorFromSliders(h: number, v: number): Color3 {
	const base = getHueColorFromPct(h);
	const [bh, bs, _bv] = base.ToHSV();
	return Color3.fromHSV(bh, bs, math.clamp(v, 0, 1));
}
