// src/server/players/services/avatar.services.ts
import { remotes, BodyColorsData } from "shared/remotes";
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
  desc.HeadColor     = toC3(colors.head);
  desc.TorsoColor    = toC3(colors.torso);
  desc.LeftArmColor  = toC3(colors.leftArm);
  desc.RightArmColor = toC3(colors.rightArm);
  desc.LeftLegColor  = toC3(colors.leftLeg);
  desc.RightLegColor = toC3(colors.rightLeg);
}

function clampScales(desc: HumanoidDescription) {
  // cùng giới hạn với outfit-delta.service.ts
  desc.HeightScale     = math.clamp(desc.HeightScale,     0.9,  1.05);
  desc.WidthScale      = math.clamp(desc.WidthScale,      0.7,  1.05);
  desc.DepthScale      = math.clamp(desc.DepthScale,      0.9,  1.05);
  desc.HeadScale       = math.clamp(desc.HeadScale,       0.95, 1.05);
  desc.BodyTypeScale   = math.clamp(desc.BodyTypeScale,   0,    1);
  desc.ProportionScale = math.clamp(desc.ProportionScale, 0,    1);
}

function applyScales(desc: HumanoidDescription, scales?: ScalesData) {
  if (!scales) return;
  if (scales.HeightScale     !== undefined) desc.HeightScale     = scales.HeightScale;
  if (scales.WidthScale      !== undefined) desc.WidthScale      = scales.WidthScale;
  if (scales.DepthScale      !== undefined) desc.DepthScale      = scales.DepthScale;
  if (scales.HeadScale       !== undefined) desc.HeadScale       = scales.HeadScale;
  if (scales.BodyTypeScale   !== undefined) desc.BodyTypeScale   = scales.BodyTypeScale;
  if (scales.ProportionScale !== undefined) desc.ProportionScale = scales.ProportionScale;

  clampScales(desc);
}

export function initAvatarWearService() {
  // NHẬN THÊM scales? (optional) sau colors?
  remotes.server.wearOutfit.connect((player, name, assets, hard?, colors?, scales?: ScalesData) => {
    const isHard = hard === true;
    print(
      `[Wear] ▶ request from ${player.Name} | outfit="${name}" | assets=${(assets ?? []).size()} | ` +
      `hard=${isHard} | colors=${colors !== undefined} | scales=${scales !== undefined}`,
    );

    task.spawn(() => {
      const apply = (hum: Humanoid) => {
        const d = buildDescriptionFromAssetsServer(assets ?? []);
        applyColors(d, colors);      // optional
        applyScales(d, scales);      // optional

        const [ok, err] = isHard
          ? pcall(() => hum.ApplyDescriptionReset(d))
          : pcall(() => hum.ApplyDescription(d));
        pcall(() => d.Destroy());

        if (ok) {
          print(
            `[Wear] ✅ Applied for ${player.Name} | outfit="${name}" | ` +
            `assets=${(assets ?? []).size()} | hard=${isHard} | colors_in=${colors !== undefined} | scales_in=${scales !== undefined}`,
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
