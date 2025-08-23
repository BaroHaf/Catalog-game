import React from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { Checkincart } from "./checkincartbut";
import { useRem } from "client/hooks";
import { Savebutton } from "./savebut";
export function Otherfeature() {
    const rem = useRem();
    return (
      <Frame size={new UDim2(0,rem(5),0.5,0)} position={new UDim2(0,0,0.5,0)} anchorPoint={new Vector2(0,0.5)} backgroundTransparency={1}>
        <uilistlayout Padding={new UDim(0,3)}/>
        <Checkincart/>
        <Savebutton/>
      </Frame>
    );
}
