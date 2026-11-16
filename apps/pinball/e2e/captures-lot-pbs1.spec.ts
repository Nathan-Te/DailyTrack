import { writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les mesures du lot PBS1 (les sons de Pinball) pour Nathan. **Il ne remplace pas l'écoute** : le navigateur de test n'a pas de haut-parleur.
//   npx vite --port 4190 &                                                                          (le serveur de dev de Vite, comme `captures-lot-pbv4 -g catalogue`)
//   CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pbs1 -g analyse    → chaque son rendu hors ligne par Web Audio (`OfflineAudioContext`, le vrai moteur de Chromium) : crête, niveau, début et fin
//                                                                                    sans saut (les « clics »), durée ; et un mélange chargé (rafale de bumpers + mission + fin) : la crête reste sous 0 dBFS. Écrit `sons-analyse.json`.
//   CAPTURES=1 npx playwright test captures-lot-pbs1 -g cout                       → (après `npm run build`) le coût sur le fil principal, dans un vrai `AudioContext` : durée d'un `jouer`, d'une mise à jour des sons continus, et
//                                                                                    des 60 000 pas de la partie du robot (10 minutes de jeu) avec les sons.
const dossier = process.env.DOSSIER ?? ".";
const DEV = "http://localhost:4190";

test.describe("PBS1 : les sons, mesurés", () => {
  test("analyse : chaque son rendu hors ligne", async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(`${DEV}/`);
    const rapport = await page.evaluate(async () => {
      // Le vrai code du jeu, servi par Vite : `Sons` joue sur un `OfflineAudioContext` (que le faux « running » fait accepter).
      const { Sons } = await import(/* @vite-ignore */ "/src/sons.ts");
      const { EXEMPLES } = await import(/* @vite-ignore */ "/src/tune-sons.ts");
      const TAUX = 44100;
      const rendre = async (evenements: { e: unknown; t: number }[], secondes: number) => {
        const ctx = new OfflineAudioContext(1, Math.ceil(TAUX * secondes), TAUX);
        const proxy = new Proxy(ctx, { get: (c, k) => (k === "state" ? "running" : typeof (c as never)[k] === "function" ? (c as never)[k].bind(c) : (c as never)[k]) });
        const sons = new Sons({ niveau: () => 1, creerContexte: () => proxy });
        sons.deverrouiller();
        // les sons demandés à des instants différents : on avance l'horloge du contexte en planifiant (`currentTime` d'un contexte hors ligne reste à 0 : on date par un contexte qui avance)
        let derniere = 0;
        for (const { e, t } of evenements) {
          Object.defineProperty(proxy, "currentTime", { get: () => t, configurable: true });
          sons.jouer(e);
          derniere = Math.max(derniere, t);
        }
        void derniere;
        return ctx.startRendering();
      };
      const analyser = (b: AudioBuffer) => {
        const d = b.getChannelData(0);
        let crete = 0;
        let somme = 0;
        let dernierNonNul = 0;
        let saut = 0;
        for (let i = 0; i < d.length; i++) {
          const a = Math.abs(d[i]!);
          if (a > crete) crete = a;
          somme += d[i]! * d[i]!;
          if (a > 0.0005) dernierNonNul = i;
          if (i > 0) saut = Math.max(saut, Math.abs(d[i]! - d[i - 1]!));
        }
        const debut = Math.abs(d[0]!);
        const fin = Math.abs(d[d.length - 1]!);
        return { crete, rms: Math.sqrt(somme / d.length), dureeS: dernierNonNul / TAUX, debut, fin, sautMax: saut };
      };
      const sortie: Record<string, unknown> = {};
      for (const [nom, liste] of Object.entries(EXEMPLES) as [string, { fr: string; e: unknown }[]][]) {
        for (const x of liste) {
          const b = await rendre([{ e: x.e, t: 0.05 }], 2.2);
          sortie[x.fr] = { nom, ...analyser(b) };
        }
      }
      // le mélange chargé : une rafale de 40 bumpers en une seconde, un trou, un geyser, une mission au milieu et la fin
      const charge: { e: unknown; t: number }[] = [];
      for (let i = 0; i < 40; i++) charge.push({ e: { son: "bumper", theme: ["foire", "ocean", "espace", "volcan"][i % 4], rang: i % 5 }, t: 0.1 + i * 0.025 });
      charge.push({ e: { son: "geyser" }, t: 0.3 }, { e: { son: "mission" }, t: 0.5 }, { e: { son: "mult", mult: 4, retard: 0 }, t: 0.55 }, { e: { son: "tourbillon", phase: "prise" }, t: 0.6 }, { e: { son: "fin" }, t: 1.4 });
      sortie["MÉLANGE CHARGÉ"] = { nom: "melange", ...analyser(await rendre(charge, 3.5)) };
      return sortie;
    });
    writeFileSync(`${dossier}/sons-analyse.json`, JSON.stringify(rapport, null, 1));
    const lignes = Object.entries(rapport as Record<string, { crete: number; rms: number; dureeS: number; debut: number; fin: number; sautMax: number }>);
    console.log("son".padEnd(46), "crête dBFS  rms dBFS  durée s  début  fin      saut max");
    for (const [n, r] of lignes) console.log(n.padEnd(46), (20 * Math.log10(r.crete || 1e-9)).toFixed(1).padStart(9), (20 * Math.log10(r.rms || 1e-9)).toFixed(1).padStart(10), r.dureeS.toFixed(2).padStart(8), r.debut.toExponential(0).padStart(6), r.fin.toExponential(0).padStart(7), r.sautMax.toFixed(3).padStart(10));
    for (const [n, r] of lignes) {
      expect(r.crete, `${n} : jamais au-dessus de 0 dBFS`).toBeLessThan(1);
      expect(r.debut, `${n} : commence à zéro`).toBeLessThan(0.002);
      expect(r.fin, `${n} : finit à zéro`).toBeLessThan(0.002);
    }
  });

  test("cout : le fil principal, dans un vrai AudioContext", async ({ browser }) => {
    test.setTimeout(300_000);
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot");
    await lancer(page);
    await page.keyboard.press("Shift");
    await page.waitForFunction(() => window.__pinball!.sons().pret);
    // 60 000 pas = 100 secondes de jeu du robot, par tranches de 10 pas (un pas de l'image à 60 images par seconde)
    const mesure = await page.evaluate(() => {
      const t0 = performance.now();
      for (let i = 0; i < 6000; i++) window.__jeu.avancer(10);
      return performance.now() - t0;
    });
    const s = await page.evaluate(() => window.__pinball!.sons());
    console.log(`60 000 pas avec les sons : ${mesure.toFixed(0)} ms (${(mesure / 60000).toFixed(4)} ms par pas) ; ${s.stats.appels} appels de Sons (${s.stats.refuses} refusés), ${s.stats.ms.toFixed(1)} ms au total, ${(s.stats.ms / Math.max(1, s.stats.appels)).toFixed(3)} ms par appel, le pire ${s.stats.pire.toFixed(2)} ms`);
    await context.close();
  });
});
