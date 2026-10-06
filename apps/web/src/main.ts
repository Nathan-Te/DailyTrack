import { TICK_RATE } from "@cdj/sim";
import { createDemoScene } from "./scene";

createDemoScene(document.body);

const hud = document.getElementById("hud");
if (hud) hud.textContent = `Circuit du Jour — lot 0 · sim ${TICK_RATE} Hz`;
