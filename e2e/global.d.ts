import { Map } from "@maptiler/sdk";
import { Layer3D } from "../src/Layer3D";

declare global {
  interface Window {
    __map: Map;
    __layer3D: Layer3D;
    __pageObjects: Record<string, any>;
    notifyScreenshotStateReady: (data: TTestTransferData) => Promise<void>;
  }

  type TTestTransferData = string | number | boolean | string[] | number[] | boolean[] | null | Record<string, unknown> | [number, number];
}
