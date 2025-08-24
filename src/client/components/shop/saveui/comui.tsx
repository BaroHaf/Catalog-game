import React from "@rbxts/react";
import { useSelector } from "@rbxts/react-reflex";
import { Frame } from "client/components/ui/frame";
import { useRem } from "client/hooks";
import { selectIsShopOpen } from "client/store/shop";
import { CharField } from "./charfield";
// Tạo HumanoidDescription ngẫu nhiên đơn giản (đổi màu cơ thể)
function makeRandomDesc(seed: number): HumanoidDescription {
  const d = new Instance("HumanoidDescription");
  const h = (seed * 0.173) % 1;
  const col = Color3.fromHSV(h, 0.6, 0.95);
  d.HeadColor = col;
  d.TorsoColor = col;
  d.LeftArmColor = col;
  d.RightArmColor = col;
  d.LeftLegColor = col;
  d.RightLegColor = col;

  // clear quần áo/phụ kiện cho nhẹ
  d.Shirt = 0;
  d.Pants = 0;
  d.GraphicTShirt = 0;
  d.HatAccessory = "";
  d.HairAccessory = "";
  d.FaceAccessory = "";
  d.NeckAccessory = "";
  d.ShouldersAccessory = "";
  d.FrontAccessory = "";
  d.BackAccessory = "";
  d.WaistAccessory = "";
  return d;
}

export function Saveui() {
  const rem = useRem();

  // cấu hình grid 5 cột khít ngang
  const cols = 5;
  const cellSize = rem(15);
  const gap = rem(1);
  const frameWidth = cols * cellSize + (cols - 1) * gap;

  // thay vì $range(), dùng number[]
  const items = new Array<number>();
  for (let i = 1; i <= 6; i++) items.push(i);

  return (
    <Frame
      size={UDim2.fromOffset(frameWidth, rem(40))}
      anchorPoint={new Vector2(0.5, 0.5)}
      position={new UDim2(0.5, 0, 0.5, 0)}
      backgroundColor={Color3.fromRGB(240, 240, 240)}
    >
      <uicorner CornerRadius={new UDim(0, rem(2))} />

      <uigridlayout
        CellSize={UDim2.fromOffset(cellSize, cellSize)}     // ô vuông
        CellPadding={UDim2.fromOffset(gap, gap)}
        FillDirection={Enum.FillDirection.Horizontal}
        SortOrder={Enum.SortOrder.LayoutOrder}
      />

      {items.map((i: number) => (
        <frame
          key={`cell-${i}`}
          Size={UDim2.fromOffset(cellSize, cellSize)}
          BackgroundColor3={Color3.fromRGB(225, 225, 225)}
        >
          <uicorner CornerRadius={new UDim(0, rem(2))} />
          <CharField
            desc={makeRandomDesc(i)}
            size={UDim2.fromScale(1, 1)} // fill cell
          />
        </frame>
      ))}
    </Frame>
  );
}