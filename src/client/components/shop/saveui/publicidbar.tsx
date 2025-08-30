import React from "@rbxts/react";
import { Frame } from "client/components/ui/frame";
export function PublicIdBar(props: { id?: string; rem: (n: number) => number }) {
    const { id, rem } = props;

    return (
        <Frame
            size={new UDim2(1, -rem(2), 0, rem(3))}
            position={new UDim2(0, rem(1), 1, -rem(3) - rem(1))}
            backgroundTransparency={0.2}
            /* Frame (component) dùng backgroundColor, không phải BackgroundColor3 */
            backgroundColor={Color3.fromRGB(28, 28, 29)}
            zIndex={4}
        >
            <uicorner CornerRadius={new UDim(0, rem(1))} />
            <uipadding
                PaddingLeft={new UDim(0, rem(1))}
                PaddingRight={new UDim(0, rem(1))}
                PaddingTop={new UDim(0, rem(0.5))}
                PaddingBottom={new UDim(0, rem(0.5))}
            />

            {/* TextBox không cho edit nhưng cho chọn/bôi đen để copy thủ công */}
            <textbox
                Size={UDim2.fromScale(1, 1)}
                ClearTextOnFocus={false}
                TextEditable={false}
                TextXAlignment={Enum.TextXAlignment.Left}
                TextTruncate={Enum.TextTruncate.AtEnd}
                Text={id ?? "Have to public"}
                TextSize={rem(1.2)}
                TextColor3={Color3.fromRGB(230, 230, 230)}
                BackgroundTransparency={1}
            />
        </Frame>
    );
}