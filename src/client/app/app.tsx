import React from "@rbxts/react";
import { Layer } from "../components/ui/layer";
import { Shop } from "client/components/shop";
import { Alerts } from "client/components/alerts";
import { Music } from "client/components/music";
export function App() {
	return (
		<>
			<Music/>
			<Layer>
				<Shop />
			</Layer>
			<Layer>
				<Alerts />
			</Layer>
		</>
	);
}
