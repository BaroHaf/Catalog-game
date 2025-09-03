// src/server/players/services/avatar.services.ts
import { remotes, BodyColorsData } from "shared/remotes";
import { buildDescriptionFromAssetsServer } from "shared/avatars/build-desc-from-assets";

function toC3(rgb: [number, number, number]) {
	const [r, g, b] = rgb;
	return new Color3((r || 0) / 255, (g || 0) / 255, (b || 0) / 255);
}

function applyColors(desc: HumanoidDescription, colors?: BodyColorsData) {
	if (!colors) return;
	desc.HeadColor     = toC3(colors.head);
	desc.TorsoColor    = toC3(colors.torso);
	desc.LeftArmColor  = toC3(colors.leftArm);
	desc.RightArmColor = toC3(colors.rightArm);
	desc.LeftLegColor  = toC3(colors.leftLeg);
	desc.RightLegColor = toC3(colors.rightLeg);
}

export function initAvatarWearService() {
	// NHẬN ĐỦ CHỮ KÝ MỚI: (player, name, assets, hard?, colors?)
	remotes.server.wearOutfit.connect((player, name, assets, hard?, colors?) => {
		const isHard = hard === true;
		print(
			`[Wear] ▶ request from ${player.Name} | outfit="${name}" | assets=${(assets ?? []).size()} | hard=${isHard} | colors=${colors !== undefined}`,
		);

		task.spawn(() => {
			const apply = (hum: Humanoid) => {
				// Build mô tả từ asset như cũ
				const d = buildDescriptionFromAssetsServer(assets ?? []);
				// Ghi đè màu nếu client gửi lên
				applyColors(d, colors);

				const [ok, err] = isHard
					? pcall(() => hum.ApplyDescriptionReset(d))
					: pcall(() => hum.ApplyDescription(d));
				pcall(() => d.Destroy());

				if (ok) {
					print(
						`[Wear] ✅ Applied for ${player.Name} | outfit="${name}" | assets=${(assets ?? []).size()} | hard=${isHard} | colors_in=${colors !== undefined}`,
					);
				} else {
					warn(
						`[Wear] ❌ Apply failed for ${player.Name} | outfit="${name}" | err=${tostring(err)}`,
					);
				}
			};

			const hum = player.Character?.FindFirstChildOfClass("Humanoid");
			if (hum) apply(hum);
			else {
				print(
					`[Wear] ⏳ Waiting CharacterAdded for ${player.Name} | outfit="${name}"`,
				);
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
