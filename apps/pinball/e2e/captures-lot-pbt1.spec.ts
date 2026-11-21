import { test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images du lot PBT1 (les trois tables dessinées avec Nathan), en 390 × 844.
//   CAPTURES=1 npx playwright test captures-lot-pbt1 -g tables   (dans `apps/pinball`, après `npm run build`) → les trois tables en Volcan et en Fête foraine (`?plan=A|B|C`)
//   … -g miroir   → `?plan=B&theme=espace&miroir`, et la table A en miroir
//   … -g secours  → le rendu à plat de secours (`?qualite=basse`) des trois tables
//   … -g verrou   → `?plan=B&theme=volcan&essai=verrou` (le verrou allumé, l'aiguillage qui y mène) et `?essai=porte` sur la table A
//   … -g eventail → les tables avec l'éventail des tirs de `?debug&tirs`
//   CAPTURES=1 MESURE=1 PLAN=B npx playwright test captures-lot-pbt1 -g mesure → la fluidité, comme au PBL2 (fil principal, processeur ralenti ×4, 390 × 844, multibille, porte ouverte)
// Les images vont dans `docs/pinball/lots/captures-pbt1/` (`DOSSIER=…` pour un autre dossier). Les schémas vus de dessus sont générés par `npm run schemas -w @cdj/pinball`.
const dossier = process.env.DOSSIER ?? "../../docs/pinball/lots/captures-pbt1";
const TABLES = ["A", "B", "C"] as const;

async function prendre(browser: Parameters<typeof appareil>[0], adresse: string, fichier: string, pas = 40, attente = 500): Promise<void> {
  const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&${adresse}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await lancer(page);
  await page.evaluate(() => window.__pinball!.contours(false));
  await page.evaluate((n) => window.__jeu.avancer(n), pas);
  await page.waitForTimeout(attente);
  await page.screenshot({ path: `${dossier}/${fichier}.png` });
  await context.close();
}

for (const plan of TABLES) {
  test(`tables ${plan} 390 × 844`, async ({ browser }) => {
    for (const theme of ["volcan", "foire"] as const) await prendre(browser, `plan=${plan}&theme=${theme}&qualite=haute`, `table-${plan}-${theme}`);
  });
}

test("miroir 390 × 844", async ({ browser }) => {
  await prendre(browser, "plan=B&theme=espace&miroir&qualite=haute", "miroir-B-espace");
  await prendre(browser, "plan=A&theme=ocean&miroir&qualite=haute", "miroir-A-ocean");
  await prendre(browser, "plan=C&theme=foire&miroir&qualite=haute", "miroir-C-foire");
});

test("rendu de secours 390 × 844", async ({ browser }) => {
  for (const plan of TABLES) await prendre(browser, `plan=${plan}&theme=volcan&qualite=basse`, `secours-${plan}-volcan`);
});

test("verrou et porte 390 × 844", async ({ browser }) => {
  await prendre(browser, "plan=B&theme=volcan&qualite=haute&essai=verrou", "essai-verrou-B-volcan", 30);
  await prendre(browser, "plan=A&theme=foire&qualite=haute&essai=porte", "essai-porte-A-foire", 30);
});

for (const plan of TABLES) {
  test(`éventail des tirs ${plan} 390 × 844`, async ({ browser }) => {
    for (const theme of ["volcan", "foire"] as const) {
      const { context, page } = await appareil(browser, `/?debug&tirs&manuel&tactile=1&plan=${plan}&theme=${theme}&qualite=haute`);
      await page.setViewportSize({ width: 390, height: 844 });
      await lancer(page);
      await page.evaluate(() => window.__pinball!.contours(false));
      await page.waitForTimeout(2500); // l'éventail est calculé à la demande puis le rendu remonté
      await page.evaluate(() => window.__jeu.avancer(5));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${dossier}/eventail-${plan}-${theme}.png` });
      await context.close();
    }
  });
}

// La fluidité, comme au PBL2 : la porte ouverte, le poteau armé, trois billes (multibille) sur la table donnée, processeur ralenti ×4, médiane de douze mesures.
for (const theme of process.env.MESURE ? (["foire", "ocean", "espace", "volcan"] as const) : []) {
  test(`mesure ${theme}`, async ({ browser }) => {
    const plan = process.env.PLAN ?? "B";
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
    console.log(`MESURE ${plan} ${theme} : fil principal ${mesures[Math.floor(mesures.length / 2)]!.toFixed(1)} ms (médiane), ${info.appels} appels, ${info.triangles} triangles`);
    await context.close();
  });
}
