import { throttle } from "@rbxts/set-timeout";

import { playSound } from "./play-sound";
import { sounds } from "./sounds";

const BUTTON_DELAY = 0.1;

let lastPressed: number | undefined;

export const playButtonDown = throttle(() => {
	if ((lastPressed !== undefined && os.clock() - lastPressed < 2 * BUTTON_DELAY)) {
		return;
	}

	lastPressed = os.clock();

	return playSound(sounds.clicksound, {
		volume: 0.25,
	});
}, 2 * BUTTON_DELAY);
