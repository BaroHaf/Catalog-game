
import React from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
import { useRem, useStore } from "client/hooks";
import { Image } from "client/components/ui/image";
import { images } from "shared/assets";
import { ReactiveButtonDiff } from "client/components/ui/reactive-button-animationdiff";
import { Button } from "client/components/ui/button";


export function SaveUI() {
  const rem = useRem();
  const store = useStore();
  // cấu hình grid 5 cột khít ngang
  const cols = 5;
  const cellSize = rem(15);
  const gap = rem(1);

  // bề rộng phần lưới (không tính padding ngoài)
  const gridWidth = cols * cellSize + (cols - 1) * gap;

  // muốn padding top/left/right = gap; bottom = 0
  const sidePad = gap;
  const scrollBar = 8;

  // build danh sách item theo cách an toàn cho roblox-ts
  const items: number[] = [];
  for (let i = 0; i < 6; i++) items.push(i);

  return (
	<scrollingframe
	  Size={UDim2.fromOffset(gridWidth + sidePad * 2 + scrollBar, rem(40))}
	  AnchorPoint={new Vector2(0.5, 0.5)}
	  Position={new UDim2(0.5, 0, 0.5, 0)}
	  BackgroundColor3={Color3.fromRGB(38, 38, 39)}
	  ScrollBarThickness={scrollBar}
	>
	  <uicorner CornerRadius={new UDim(0, rem(2))} />

	  {/* padding: top = left = right = gap; bottom = 0 */}
	  <uipadding
		PaddingTop={new UDim(0, gap)}
		PaddingLeft={new UDim(0, sidePad)}
		PaddingRight={new UDim(0, sidePad)}
		PaddingBottom={new UDim(0, 0)}
	  />

	  <uigridlayout
		CellSize={UDim2.fromOffset(cellSize, cellSize)} // ô vuông
		CellPadding={UDim2.fromOffset(gap, gap)}
		FillDirection={Enum.FillDirection.Horizontal}
		SortOrder={Enum.SortOrder.LayoutOrder}
		HorizontalAlignment={"Center"}
		StartCorner={Enum.StartCorner.TopLeft}
	  />

	  {/* ô dấu + — để sau items cho nằm cuối */}
	  {items.map((i) => (
		<Frame
		  key={`cell-${i}`}
		  size={UDim2.fromOffset(cellSize, cellSize)}
		  backgroundTransparency={0.75}
		>
		  <uicorner CornerRadius={new UDim(0, rem(2))} />
		</Frame>
	  ))}

	  <Button
		size={UDim2.fromOffset(cellSize, cellSize)}
		backgroundTransparency={0.75}
		layoutOrder={9999}
		onClick={()=>store.setShopOpen(false)}
	  >
		<Image
		  image={images.ui.plus_icon}
		  size={new UDim2(0.6, 0, 0.6, 0)}
		  anchorPoint={new Vector2(0.5, 0.5)}
		  position={new UDim2(0.5, 0, 0.5, 0)}
		/>
		<uicorner />
	  </Button>
	</scrollingframe>
  );
}
