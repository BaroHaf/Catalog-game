import React from "@rbxts/react";
import { useSelector } from "@rbxts/react-reflex";
import { Frame } from "client/components/ui/frame";
import { selectIsShopOpen } from "client/store/shop";

export function Saveui() {
	return <Frame size={new UDim2(1, 0, 1, 0)} />;
}
