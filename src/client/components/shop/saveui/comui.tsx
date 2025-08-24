import React from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem, useStore } from "client/hooks";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";
import { ReactiveButtonDiff } from "client/components/ui/reactive-button-animationdiff";
import { Button } from "client/components/ui/button";


export function ComUI() {
  const rem= useRem();
  return <Frame size={new UDim2(0,rem(50),0,rem(40))} anchorPoint={new Vector2(0.5,0.5)} position={new UDim2(0.5,0,0.5,0)}>
    <uicorner/>
    
  </Frame>;
}