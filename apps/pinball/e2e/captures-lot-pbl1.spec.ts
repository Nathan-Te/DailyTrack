import { test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images du lot PBL1 (la lisibilité des tables), **avant** et **après**, en 390 × 844.
//   CAPTURES=1 DOSSIER=/chemin PREFIXE=avant npx playwright test captures-lot-pbl1 -g retour   (dans `apps/pinball`, après `npm run build`) → les deux tables du retour de Nathan
//   … -g plans    → les quatre plans × les quatre thèmes, en partie (haute qualité)
//   … -g essais   → `?essai=verrou`, `?essai=multibille`, `?essai=porte` et `?essai=poteau`
//   … -g basse    → des exemples en rendu de secours
//   CAPTURES=1 MESURE=1 PLAN=doublette npx playwright test captures-lot-pbl1 -g mesure → la fluidité, comme au PBG3 (fil principal, processeur ralenti ×4, 390 × 844, bloom compris, multibille sur le plan donné)
const dossier = process.env.DOSSIER ?? "captures";
const prefixe = process.env.PREFIXE ?? "apres";
const THEMES = ["foire", "ocean", "espace", "volcan"] as const;
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
  await prendre(browser, "plan=doublette&theme=volcan&qualite=haute", "retour-volcan-doublette");
  await prendre(browser, "plan=tremplin&theme=ocean&qualite=haute", "retour-ocean-tremplin");
});

for (const plan of PLANS) {
  test(`plans ${plan} 390 × 844`, async ({ browser }) => {
    for (const theme of THEMES) await prendre(browser, `plan=${plan}&theme=${theme}&qualite=haute`, `plan-${plan}-${theme}`);
  });
}

test("essais 390 × 844", async ({ browser }) => {
  for (const [plan, theme] of [["doublette", "volcan"], ["tremplin", "ocean"]] as const) {
    for (const essai of ["verrou", "multibille", "porte"] as const) await prendre(browser, `plan=${plan}&theme=${theme}&qualite=haute&essai=${essai}`, `essai-${essai}-${plan}-${theme}`, 30);
  }
  await prendre(browser, "theme=foire&qualite=haute&essai=poteau", "essai-poteau-foire", 60);
});

test("basse 390 × 844", async ({ browser }) => {
  await prendre(browser, "plan=doublette&theme=volcan&qualite=basse", "basse-doublette-volcan");
  await prendre(browser, "plan=tremplin&theme=ocean&qualite=basse", "basse-tremplin-ocean");
  await prendre(browser, "plan=doublette&theme=volcan&qualite=basse&essai=verrou", "basse-verrou-doublette-volcan", 30);
  await prendre(browser, "plan=doublette&theme=volcan&qualite=basse&essai=multibille", "basse-multibille-doublette-volcan", 30);
});

// La fluidité, comme au PBG3 : la porte ouverte, le poteau armé, trois billes (multibille) sur le plan donné, processeur ralenti ×4, médiane de douze mesures.
for (const theme of process.env.MESURE ? THEMES : []) {
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
