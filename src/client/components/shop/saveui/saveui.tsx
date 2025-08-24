import React from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem } from "client/hooks";
import { CharField } from "./charfield";


export function Saveui() {
	const rem= useRem();
	return <Frame size={new UDim2(0,rem(50),0,rem(40))} anchorPoint={new Vector2(0.5,0.5)} position={new UDim2(0.5,0,0.5,0)}>
		<uicorner/>
		
	</Frame>;
}
