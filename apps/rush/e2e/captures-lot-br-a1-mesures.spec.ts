import { chromium, test } from "@playwright/test";

// Les MESURES du lot BR-A1 (jamais en CI : un outil, comme les captures) : `?debug&fps` en TEMPS RÉEL (pas de `manuel`), haute et basse qualité, sur la horde et chaque boss, dans un Chromium qui prend la carte
// graphique (ANGLE / D3D11 sous Windows : sans ces options, le Chromium sans fenêtre dessine en logiciel et les images par seconde ne veulent rien dire).
//   CAPTURES=1 npx playwright test captures-lot-br-a1-mesures --project=chromium --trace off --reporter=line   (dans apps/rush, après `npm run build -w @cdj/rush`)
// Chaque ligne : le scénario, la qualité, le moteur de rendu, puis ce qu'affiche `?fps` après ~6 s (qualité · images par seconde · ms de dessin · appels · triangles · monstres).
const SCENARIOS = ["horde&competence=tourbillon", "boss&boss=golem", "boss&boss=reine", "boss&boss=grand-duc", "boss&boss=belier", "boss&boss=chene", "arene&monstres=60"];

test("les images par seconde, haute et basse qualité", async () => {
  test.setTimeout(600_000);
  const navigateur = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
  const lignes: string[] = [];
  for (const s of SCENARIOS) {
    for (const q of ["haute", "basse"]) {
      const context = await navigateur.newContext({ baseURL: "http://localhost:4181", locale: "fr-FR", viewport: { width: 1920, height: 1080 } });
      await context.addInitScript(() => localStorage.setItem("rush:aide:vu", "1"));
      const page = await context.newPage();
      await page.goto(`/?debug&fps&tactile=0&qualite=${q}&scenario=${s}`);
      await page.locator("#jeu-jouer").click();
      await page.waitForFunction(() => !!(window as unknown as { __rush?: unknown }).__rush);
      await page.waitForTimeout(6000);
      const r = await page.evaluate(() => {
        const gl = document.createElement("canvas").getContext("webgl2");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        const moteur = ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "?";
        const fps = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && / i\/s · /.test(e.textContent ?? ""))?.textContent ?? "(pas d'affichage)";
        return { moteur, fps };
      });
      lignes.push(`| ${s} | ${q} | ${r.fps} | ${r.moteur.slice(0, 60)} |`);
      await context.close();
    }
  }
  await navigateur.close();
  console.log(["| scénario | qualité | `?fps` | moteur |", "|---|---|---|---|", ...lignes].join("\n"));
});
