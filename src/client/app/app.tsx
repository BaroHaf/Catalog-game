import React from "@rbxts/react";
import { Layer } from "../components/ui/layer";
import { Shop } from "client/components/shop";
import { Alerts } from "client/components/alerts";
export function App() {
	return (
		<>
			<Layer>
				<Shop />
			</Layer>
			<Layer>
				<Alerts />
			</Layer>
		</>
	);
}
