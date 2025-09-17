import { useEventListener } from "@rbxts/pretty-react-hooks";
import React, { useEffect, useState } from "@rbxts/react";
import { useSelector } from "@rbxts/react-reflex";
import { selectMusicEnabled } from "client/store/shop";
import { shuffle } from "shared/utils/object-utils";
import { createSound } from "shared/assets/sounds";
const MUSIC = [
	"rbxassetid://1840684208", // Poolside
];

export function Music() {
	const enabled = useSelector(selectMusicEnabled);

	const [queue, setQueue] = useState(() => shuffle(MUSIC));
	const [index, setIndex] = useState(0);
	const [sound, setSound] = useState<Sound>();

	// Advance the queue when the song ends
	useEventListener(sound?.Ended, () => {
		setIndex(index + 1);
	});

	// Create the next song when the index changes
	useEffect(() => {
		if (index >= queue.size()) {
			// Shuffle the queue if we've reached the end
			setQueue(shuffle(MUSIC));
			setIndex(0);
			return;
		}

		const newSound = createSound(queue[index], { volume: 0.5 });

		setSound(newSound);

		return () => {
			newSound.Destroy();
		};
	}, [index]);

	// Pause/resume the sound when the enabled state changes
	// or when the sound changes
	useEffect(() => {
		if (enabled) {
			sound?.Resume();
		} else {
			sound?.Pause();
		}
	}, [enabled, sound]);

	// Destroy sounds not in use
	useEffect(() => {
		return () => {
			sound?.Destroy();
		};
	}, [sound]);

	return <></>;
}
