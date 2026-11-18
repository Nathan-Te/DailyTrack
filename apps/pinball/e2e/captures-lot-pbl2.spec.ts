import { test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images du lot PBL2 (des tables jouables par un humain), **avant** et **après**, en 390 × 844.
//   CAPTURES=1 DOSSIER=/chemin PREFIXE=avant npx playwright test captures-lot-pbl2 -g retour   (dans `apps/pinball`, après `npm run build`) → la table du retour de Nathan (Volcan × tremplin) : normale, `?essai=verrou`, `?essai=porte`
//   … -g plans    → les quatre plans (Volcan et Fête foraine), avec l'éventail des tirs de `?debug&tirs` : la zone de tir et les fenêtres de chaque objectif, en couleur
//   … -g verrou   → la plaque du verrou éteinte (« après la mission »), puis allumée (`?essai=verrou`), et la plaque de la mission (« → verrou »)
//   CAPTURES=1 MESURE=1 PLAN=tremplin npx playwright test captures-lot-pbl2 -g mesure → la fluidité, comme au PBG3 (fil principal, processeur ralenti ×4, 390 × 844, bloom compris, multibille sur le plan donné)
const dossier = process.env.DOSSIER ?? "captures";
const prefixe = process.env.PREFIXE ?? "apres";
const PLANS = ["doublette", "tremplin", "bretelle", "boucle"] as const;

async function prendre(browser: Parameters<typeof appareil>[0], adresse: string, fichier: string, pas = 40): Promise<void> {
  const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&${adresse}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await lancer(page);
  await page.evaluate(() => window.__pinball!.contours(false));
  await page.evaluate((n) => window.__jeu.avancer(n), pas);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dossier}/${prefixe}-${fichier}.png` });
  await context.close();
}

test("retour de Nathan 390 × 844", async ({ browser }) => {
  await prendre(browser, "plan=tremplin&theme=volcan&qualite=haute", "retour-volcan-tremplin");
  await prendre(browser, "plan=tremplin&theme=volcan&qualite=haute&essai=verrou", "essai-verrou-volcan-tremplin", 30);
  await prendre(browser, "plan=tremplin&theme=volcan&qualite=haute&essai=porte", "essai-porte-volcan-tremplin", 30);
});

for (const plan of PLANS) {
  test(`plans ${plan} avec l'éventail des tirs 390 × 844`, async ({ browser }) => {
    for (const theme of ["volcan", "foire"] as const) {
      const { context, page } = await appareil(browser, `/?debug&tirs&manuel&tactile=1&plan=${plan}&theme=${theme}&qualite=haute`);
      await page.setViewportSize({ width: 390, height: 844 });
      await lancer(page);
      await page.evaluate(() => window.__pinball!.contours(false));
      await page.waitForTimeout(2500); // l'éventail est calculé à la demande puis le rendu remonté
      await page.evaluate(() => window.__jeu.avancer(5));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${dossier}/${prefixe}-plan-${plan}-${theme}.png` });
      await context.close();
    }
  });
}

test("verrou 390 × 844", async ({ browser }) => {
  await prendre(browser, "plan=tremplin&theme=volcan&qualite=haute", "verrou-eteint-volcan-tremplin", 20);
  await prendre(browser, "plan=tremplin&theme=volcan&qualite=haute&essai=verrou", "verrou-allume-volcan-tremplin", 20);
  await prendre(browser, "plan=bretelle&theme=ocean&qualite=haute", "verrou-eteint-ocean-bretelle", 20);
});

// La fluidité, comme au PBG3 : la porte ouverte, le poteau armé, trois billes (multibille) sur le plan donné, processeur ralenti ×4, médiane de douze mesures.
for (const theme of process.env.MESURE ? (["foire", "ocean", "espace", "volcan"] as const) : []) {
  test(`mesure ${theme}`, async ({ browser }) => {
    const plan = process.env.PLAN ?? "doublette";
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&plan=${plan}&theme=${theme}&qualite=haute&essai=multibille`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    await page.evaluate(() => {
      const p = window.__pinball!.partie();
      p.ouvrirLaPorte();
      p.armerLeSauveur();
      window.__jeu.avancer(1200); // les deux billes sont lâchées
      window.__pinball!.regler(2, true);
      window.__jeu.avancer(300);
      window.__pinball!.regler(2, false);
      window.__jeu.avancer(200);
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const mesures: number[] = [];
    for (let k = 0; k < 12; k++) {
      await page.evaluate(() => {
        const p = window.__pinball!.partie();
        p.sauveeMulti = 100000;
        p.ouvrirLaPorte();
        window.__jeu.avancer(20);
      });
      await page.waitForTimeout(500);
      mesures.push(await page.evaluate(() => window.__pinball!.trois()!.ms));
    }
    const info = await page.evaluate(() => window.__pinball!.trois()!);
    mesures.sort((a, b) => a - b);
    console.log(`MESURE ${prefixe} ${plan} ${theme} : fil principal ${mesures[Math.floor(mesures.length / 2)]!.toFixed(1)} ms (médiane), ${info.appels} appels, ${info.triangles} triangles`);
    await context.close();
  });
}
