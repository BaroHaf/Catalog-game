import React, { useEffect, useRef } from "@rbxts/react";
import { useInterval, lerpBinding } from "@rbxts/pretty-react-hooks";
import { setTimeout } from "@rbxts/set-timeout";
import { useMotion, useRem } from "client/hooks";
import { springs } from "client/constants/springs";

interface SquareBounceLoaderProps {
  sizeRem?: number;        // kích thước vuông, mặc định 20
  color?: Color3;          // màu viền/fill
  strokeThickness?: number;// độ dày viền, mặc định 2
  corner?: number;         // bo góc px, mặc định 8
  period?: number;         // chu kỳ xoay (giây), mặc định 1.8
  fillSpeed?: number;      // tốc độ fill bounce (tỉ lệ chu kỳ), mặc định 0.50
}

export function SquareLoader({
  sizeRem = 5,
  color = new Color3(1, 1, 1),
  strokeThickness = 2,
  corner = 8,
  period = 1.8,
  fillSpeed = 0.50,
}: SquareBounceLoaderProps) {
  const rem = useRem();

  // góc xoay tổng (độ)
  const [rot, rotMotion] = useMotion(0);
  const angleRef = useRef(0);

  // nhịp đập viền (0..1)
  const [pulse, pulseMotion] = useMotion(0);

  // progress fill (0..1), dùng để SIZE theo trục Y
  const [fill, fillMotion] = useMotion(0);
  let goingUp = useRef(true);

  // helper tăng góc với spring mong muốn
  const stepAngle = (delta: number, cfg: typeof springs[keyof typeof springs]) => {
    angleRef.current += delta;
    rotMotion.spring(angleRef.current, cfg);
  };

  // 1 chu kỳ xoay: nhanh 0→180, chậm 180→360
  const spinCycle = () => {
    pulseMotion.impulse(0.7);
    // nhanh nửa đầu
    stepAngle(180, springs.wobbly);

    // chuyển sang chậm dần
    setTimeout(() => {
      stepAngle(180, springs.gentle);
    }, period * 0.45);

    // nhá nhẹ cuối vòng
    setTimeout(() => pulseMotion.impulse(0.5), period * 0.85);
  };

  // bounce fill: 0→1 rồi 1→0 liên tục, độc lập với xoay
  const scheduleFillBounce = () => {
    const upTime = period * fillSpeed;            // phần thời gian đi lên
    const downTime = period * (1 - fillSpeed);    // phần thời gian đi xuống

    if (goingUp.current) {
      // 0 -> 1
      fillMotion.spring(1, springs.molasses);
      goingUp.current = false;
      setTimeout(() => scheduleFillBounce(), upTime);
    } else {
      // 1 -> 0
      fillMotion.spring(0, springs.molasses);
      goingUp.current = true;
      setTimeout(() => scheduleFillBounce(), downTime);
    }
  };

  // lặp chu kỳ xoay
  useInterval(() => {
    spinCycle();
  }, period);

  useEffect(() => {
    // init
    rotMotion.spring(0, springs.gentle);
    fillMotion.set(0);
    pulseMotion.set(0);

    // chạy ngay
    spinCycle();
    scheduleFillBounce();
  }, []);

  const size = new UDim2(0, rem(sizeRem), 0, rem(sizeRem));

  return (
    <frame
      BackgroundTransparency={1}
      AnchorPoint={new Vector2(0.5, 0.5)}
      Size={size}
      Position={new UDim2(0.5, 0, 0.5, 0)}
      Rotation={rot}
    >
      {/* viền ngoài */}
      <uistroke
        ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
        Color={color}
        Thickness={lerpBinding(pulse, strokeThickness, strokeThickness + 1)}
        Transparency={0.15}
      />
      <uicorner CornerRadius={new UDim(0, corner)} />

      {/* container để clip phần fill bên trong */}
      <frame
        Size={new UDim2(1, 0, 1, 0)}
        BackgroundTransparency={1}
        BorderSizePixel={0}
        ClipsDescendants={true}
      >
        <uicorner CornerRadius={new UDim(0, corner)} />

        {/* thanh fill bám đáy, tăng/giảm theo fill (0..1) */}
        <frame
          AnchorPoint={new Vector2(0.5, 1)}
          Position={new UDim2(0.5, 0, 1, 0)}             // bám đáy
          Size={lerpBinding(
            fill,
            new UDim2(1, 0, 0, 0),                        // rỗng
            new UDim2(1, 0, 1, 0)                         // đầy
          )}
          BackgroundColor3={color}
          BackgroundTransparency={0.25}
          BorderSizePixel={0}
        />
      </frame>
    </frame>
  );
}
