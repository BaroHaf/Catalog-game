// src/server/players/services/avatar.services.ts
import { remotes } from "shared/remotes";
import { buildDescriptionFromAssetsServer } from "shared/avatars/build-desc-from-assets";

export function initAvatarWearService() {
  remotes.server.wearOutfit.connect((player, name, assets, hard) => {
    const isHard = hard === true;
    print(`[Wear] ▶ request from ${player.Name} | outfit="${name}" | assets=${(assets ?? []).size()} | hard=${isHard}`);

    task.spawn(() => {
      const apply = (hum: Humanoid) => {
        const d = buildDescriptionFromAssetsServer(assets ?? []);
        const [ok] = isHard
          ? pcall(() => hum.ApplyDescriptionReset(d))
          : pcall(() => hum.ApplyDescription(d));
        pcall(() => d.Destroy());

        if (ok) {
          print(`[Wear] ✅ Applied for ${player.Name} | outfit="${name}" | assets=${(assets ?? []).size()} | hard=${isHard}`);
        } else {
          warn(`[Wear] ❌ Apply failed for ${player.Name} | outfit="${name}"`);
        }
      };

      const hum = player.Character?.FindFirstChildOfClass("Humanoid");
      if (hum) apply(hum);
      else {
        print(`[Wear] ⏳ Waiting CharacterAdded for ${player.Name} | outfit="${name}"`);
        const con = player.CharacterAdded.Connect((char) => {
          const h = char?.FindFirstChildOfClass("Humanoid");
          if (h) apply(h); else warn(`[Wear] ❌ No Humanoid after CharacterAdded for ${player.Name}`);
          con.Disconnect();
        });
      }
    });
  });
}
