// server/services/outfit-delta.service.ts
import { Players } from "@rbxts/services";
import { remotes, type OutfitDelta } from "shared/remotes";

/**
 * Coalesce 10Hz cho các thay đổi outfit gửi liên tục từ client.
 * - Mọi delta trong 0.1s được gộp lại rồi apply 1 lần.
 * - hard=true (mặc/cởi/reset) -> ApplyDescriptionReset đúng 1 lần ở nhịp đó.
 */
type Bucket = { pending?: OutfitDelta; scheduled?: boolean; lastHard?: boolean };
const buckets = new Map<Player, Bucket>();

function merge<T extends object>(to: T, from: Partial<T>) {
  for (const [k, v] of pairs(from as unknown as Record<string, unknown>)) {
    (to as unknown as Record<string, unknown>)[k] = v!;
  }
}

function clampScales(d: HumanoidDescription, patch: OutfitDelta) {
  const clamp = (x: number, a: number, b: number) => math.clamp(x, a, b);
  if (patch.HeightScale !== undefined) d.HeightScale = clamp(d.HeightScale, 0.9, 1.05);
  if (patch.WidthScale  !== undefined) d.WidthScale  = clamp(d.WidthScale , 0.7, 1.05);
  if (patch.DepthScale  !== undefined) d.DepthScale  = clamp(d.DepthScale , 0.9, 1.05);
  if (patch.HeadScale   !== undefined) d.HeadScale   = clamp(d.HeadScale  , 0.95, 1.05);
  if (patch.BodyTypeScale   !== undefined) d.BodyTypeScale   = clamp(d.BodyTypeScale, 0, 1);
  if (patch.ProportionScale !== undefined) d.ProportionScale = clamp(d.ProportionScale, 0, 1);
}

function scheduleApply(plr: Player) {
  const b = buckets.get(plr)!;
  if (b.scheduled) return;
  b.scheduled = true;

  // 10Hz (0.1s một lần)
  task.delay(0.1, () => {
    b.scheduled = false;

    const hum = plr.Character?.FindFirstChildOfClass("Humanoid");
    const patch = b.pending; b.pending = undefined;
    if (!hum || !patch) return;

    const desc = hum.GetAppliedDescription();

    // Chỉ gán các field có trong patch (rất nhẹ)
    for (const [k, v] of pairs(patch as unknown as Record<string, unknown>)) {
      if (k === "hard") continue;
      (desc as unknown as Record<string, unknown>)[k] = v!;
    }

    clampScales(desc, patch);

    (patch.hard ?? b.lastHard) ? hum.ApplyDescriptionReset(desc) : hum.ApplyDescription(desc);

    // Nếu vừa hard, tick sau default về soft
    b.lastHard = patch.hard === true;
  });
}

export function initOutfitDeltaService() {
  // nhận delta liên tục từ client
  remotes.server.outfitDelta.connect((plr, delta) => {
    if (typeOf(delta) !== "table") return;
    if (!plr.Character?.FindFirstChildOfClass("Humanoid")) return;

    const bucket = buckets.get(plr) ?? (buckets.set(plr, {}), buckets.get(plr)!);
    const current = bucket.pending ?? {};
    merge(current, delta);
    bucket.pending = current;

    if (delta.hard) bucket.lastHard = true;

    scheduleApply(plr);
  });

  Players.PlayerRemoving.Connect((plr) => buckets.delete(plr));
}
