import React, { useState } from "@rbxts/react";
import { Players } from "@rbxts/services";
import { Frame } from "client/components/ui/frame";
import { Image } from "client/components/ui/image";
import { ReactiveButtonDiff } from "client/components/ui/reactive-button-animationdiff";
import { useRem } from "client/hooks";
import { Closebutsaveui } from "./closebut";

import { palette } from "shared/constants/palette";
import { images } from "shared/assets";
import { fonts } from "client/constants/fonts";
import { remotes } from "shared/remotes";

function safeGetDescription(): HumanoidDescription {
	const lp = Players.LocalPlayer!;
	const hum = lp.Character?.FindFirstChildOfClass("Humanoid");
	if (hum) {
		const d = hum.GetAppliedDescription();
		if (d) return d;
	}
	return Players.GetHumanoidDescriptionFromUserId(lp.UserId);
}

function collectAssetsFromDescription(desc: HumanoidDescription): number[] {
	const out: number[] = [];

	function add(id?: number) {
		if (!id) return;
		if (id <= 0) return;
		if (out.includes(id)) return;
		out.push(id);
	}

	const fields = [
		"Head",
		"Torso",
		"LeftArm",
		"RightArm",
		"LeftLeg",
		"RightLeg",
		"Face",
		"Shirt",
		"Pants",
		"GraphicTShirt",

		// accessory CSV
		"HatAccessory",
		"HairAccessory",
		"FaceAccessory",
		"NeckAccessory",
		"FrontAccessory",
		"BackAccessory",
		"WaistAccessory",

		// layered CSV
		"JacketAccessory",
		"SweaterAccessory",
		"ShortsAccessory",
		"PantsAccessory",
		"DressSkirtAccessory",
		"TShirtAccessory",
		"LeftShoeAccessory",
		"RightShoeAccessory",
		"EyebrowAccessory",
		"EyelashAccessory",
		"EarAccessory",
	];

	for (const key of fields) {
		const [ok, value] = pcall(
			() => (desc as unknown as Record<string, unknown>)[key]
		);
		if (!ok) continue;

		if (typeOf(value) === "number") {
			add(value as number);
		} 
		else if (typeOf(value) === "string") {
			const str = value as string;
			for (const raw of str.split(",")) {
				const id = tonumber(raw);
				if (id) add(id);
			}
		}
	}

	// 2) LAYERED ACCESSORIES (DynamicHead, Faces, everything)
	for (const acc of desc.GetAccessories(true)) {
		add(acc.AssetId);
	}

	// 3) OLD VALUES (nếu có)
	for (const child of desc.GetDescendants()) {
		if (child.IsA("NumberValue")) add(child.Value);
		if (child.IsA("StringValue")) {
			for (const raw of child.Value.split(",")) {
				const id = tonumber(raw);
				if (id) add(id);
			}
		}
	}

	return out;
}


type RGB = [number, number, number];

function colorToRGB(c: Color3): RGB {
	return [
		math.floor(c.R * 255 + 0.5),
		math.floor(c.G * 255 + 0.5),
		math.floor(c.B * 255 + 0.5),
	];
}

function extractBodyColors(desc: HumanoidDescription) {
	return {
		head: colorToRGB(desc.HeadColor),
		torso: colorToRGB(desc.TorsoColor),
		leftArm: colorToRGB(desc.LeftArmColor),
		rightArm: colorToRGB(desc.RightArmColor),
		leftLeg: colorToRGB(desc.LeftLegColor),
		rightLeg: colorToRGB(desc.RightLegColor),
	};
}

function extractScales(desc: HumanoidDescription) {
	return {
		HeightScale: desc.HeightScale,
		WidthScale: desc.WidthScale,
		DepthScale: desc.DepthScale,
		HeadScale: desc.HeadScale,
		BodyTypeScale: desc.BodyTypeScale,
		ProportionScale: desc.ProportionScale,
	};
}


function saveOutfitNow() {
	const desc = safeGetDescription();

	const assets = collectAssetsFromDescription(desc);
	const colors = extractBodyColors(desc);
	const scales = extractScales(desc);

	const name = `Outfit ${os.time()}`;

	print("[SaveOutfit] send", name, "assets", assets);
	remotes.server.postOutfit.fire(
		name,
		assets,
		undefined, // snapshotThumb
		colors,
		scales,
		undefined, // accessoryBlob
	);
}



export function Savebuttonui(): JSX.Element {
	const rem = useRem();
	const [hovered, setHovered] = useState<string | undefined>(undefined);

	return (
		<Frame
			size={new UDim2(0, rem(60), 0, rem(20))}
			anchorPoint={new Vector2(0.5, 0.5)}
			position={new UDim2(0.5, 0, 0.5, 0)}
			backgroundTransparency={0}
			backgroundColor={Color3.fromRGB(35, 35, 35)}
		>
			<uicorner />
			<textlabel
				Size={UDim2.fromScale(1, 1)}
				BackgroundTransparency={1}
				Text={"SAVE OUTFIT"}
				TextSize={rem(2.5)}
				TextColor3={palette.white}
				TextXAlignment={Enum.TextXAlignment.Center}
				TextYAlignment={Enum.TextYAlignment.Center}
				FontFace={fonts.JosefinSans.bold}
			/>
			<ReactiveButtonDiff
				size={new UDim2(0, rem(5), 0, rem(5))}
				position={new UDim2(1, 0, 1, 0)}
				anchorPoint={new Vector2(1, 1)}
				onHover={(h) => setHovered(h ? "save" : undefined)}
				onClick={saveOutfitNow} // nếu muốn debug thì đổi thành debugNow
				backgroundTransparency={1}
			>
				<Image
					image={images.ui.checked_icon}
					size={new UDim2(1, 0, 1, 0)}
					backgroundTransparency={1}
					imageColor={
						hovered === "save"
							? Color3.fromRGB(0, 255, 0)
							: palette.white
					}
				/>
			</ReactiveButtonDiff>

			<Closebutsaveui />
		</Frame>
	);
}
