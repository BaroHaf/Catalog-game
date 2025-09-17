// src/server/players/services/avatar.services.ts
import { remotes, BodyColorsData, AnimationSlots } from "shared/remotes";
import { buildDescriptionFromAssetsServer } from "shared/avatars/build-desc-from-assets";

/** Optional scales payload từ client */
type ScalesData = Partial<{
	HeightScale: number;
	WidthScale: number;
	DepthScale: number;
	HeadScale: number;
	BodyTypeScale: number;
	ProportionScale: number;
}>;

function toC3(rgb: [number, number, number]) {
	const [r, g, b] = rgb;
	return new Color3((r || 0) / 255, (g || 0) / 255, (b || 0) / 255);
}

function applyColors(desc: HumanoidDescription, colors?: BodyColorsData) {
	if (!colors) return;
	desc.HeadColor = toC3(colors.head);
	desc.TorsoColor = toC3(colors.torso);
	desc.LeftArmColor = toC3(colors.leftArm);
	desc.RightArmColor = toC3(colors.rightArm);
	desc.LeftLegColor = toC3(colors.leftLeg);
	desc.RightLegColor = toC3(colors.rightLeg);
}

function clampScales(desc: HumanoidDescription) {
	desc.HeightScale = math.clamp(desc.HeightScale, 0.9, 1.05);
	desc.WidthScale = math.clamp(desc.WidthScale, 0.7, 1.05);
	desc.DepthScale = math.clamp(desc.DepthScale, 0.9, 1.05);
	desc.HeadScale = math.clamp(desc.HeadScale, 0.95, 1.05);
	desc.BodyTypeScale = math.clamp(desc.BodyTypeScale, 0, 1);
	desc.ProportionScale = math.clamp(desc.ProportionScale, 0, 1);
}

function applyScales(desc: HumanoidDescription, scales?: ScalesData) {
	if (!scales) return;
	if (scales.HeightScale !== undefined) desc.HeightScale = scales.HeightScale;
	if (scales.WidthScale !== undefined) desc.WidthScale = scales.WidthScale;
	if (scales.DepthScale !== undefined) desc.DepthScale = scales.DepthScale;
	if (scales.HeadScale !== undefined) desc.HeadScale = scales.HeadScale;
	if (scales.BodyTypeScale !== undefined) desc.BodyTypeScale = scales.BodyTypeScale;
	if (scales.ProportionScale !== undefined) desc.ProportionScale = scales.ProportionScale;
	clampScales(desc);
}

function applyAnimationPack(desc: HumanoidDescription, slots?: AnimationSlots) {
	if (!slots) return;
	desc.WalkAnimation = slots.Walk ?? desc.WalkAnimation;
	desc.RunAnimation = slots.Run ?? desc.RunAnimation;
	desc.IdleAnimation = slots.Idle ?? desc.IdleAnimation;
	desc.JumpAnimation = slots.Jump ?? desc.JumpAnimation;
	desc.FallAnimation = slots.Fall ?? desc.FallAnimation;
	desc.SwimAnimation = slots.Swim ?? desc.SwimAnimation;
	desc.ClimbAnimation = slots.Climb ?? desc.ClimbAnimation;
}

export function initAvatarWearService() {
	remotes.server.wearOutfit.connect((player, name, assets, hard?, colors?, scales?: ScalesData, animSlots?: AnimationSlots) => {
		const isHard = hard === true;
		print(
			`[Wear] ▶ request from ${player.Name} | outfit="${name}" | assets=${(assets ?? []).size()} | ` +
				`hard=${isHard} | colors=${colors !== undefined} | scales=${scales !== undefined} | animSlots=${animSlots !== undefined}`,
		);

		task.spawn(() => {
			const apply = (hum: Humanoid) => {
				// 🔑 nếu assets rỗng → clone desc hiện tại
				const d =
					assets && assets.size() > 0
						? buildDescriptionFromAssetsServer(assets)
						: hum.GetAppliedDescription();

				applyColors(d, colors);
				applyScales(d, scales);
				applyAnimationPack(d, animSlots);

				const [ok, err] = isHard
					? pcall(() => hum.ApplyDescriptionReset(d))
					: pcall(() => hum.ApplyDescription(d));
				pcall(() => d.Destroy());

				if (ok) {
					print(
						`[Wear] ✅ Applied for ${player.Name} | outfit="${name}" | ` +
							`assets=${(assets ?? []).size()} | hard=${isHard} | colors_in=${colors !== undefined} | scales_in=${scales !== undefined} | anim_in=${animSlots !== undefined}`,
					);
				} else {
					warn(`[Wear] ❌ Apply failed for ${player.Name} | outfit="${name}" | err=${tostring(err)}`);
				}
			};

			const hum = player.Character?.FindFirstChildOfClass("Humanoid");
			if (hum) apply(hum);
			else {
				print(`[Wear] ⏳ Waiting CharacterAdded for ${player.Name} | outfit="${name}"`);
				const con = player.CharacterAdded.Connect((char) => {
					const h = char?.FindFirstChildOfClass("Humanoid");
					if (h) apply(h);
					else warn(`[Wear] ❌ No Humanoid after CharacterAdded for ${player.Name}`);
					con.Disconnect();
				});
			}
		});
	});
}
