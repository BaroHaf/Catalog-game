import { Players } from "@rbxts/services";
import { ViewportController } from "./camerarotation";

export function initCharacter(viewport: ViewportFrame, ctrl: ViewportController) {
  const model = Players.CreateHumanoidModelFromDescription(
    Players.GetHumanoidDescriptionFromUserId(Players.LocalPlayer!.UserId),
    Enum.HumanoidRigType.R15,
  );
  model.Parent = viewport;

  const world = new Instance("WorldModel");
  world.Parent = viewport;
  model.Parent = world;

  return {
    destroy() {
      ctrl.destroy();
      world.Destroy();
      model.Destroy();
    },
  };
}
