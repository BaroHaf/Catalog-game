import { BodyColorsPanel } from "./displaycolorpicker";
import { BodyScalesPanel } from "./displayscalebody";

export const SPECIAL_PANELS: Record<string, (props?: unknown) => JSX.Element> = {
  "body:color": BodyColorsPanel,
  "body:scale": BodyScalesPanel,
  // thêm panel khác ở đây...
};