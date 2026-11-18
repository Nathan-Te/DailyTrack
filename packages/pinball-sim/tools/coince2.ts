// @ts-nocheck
import { Partie, UNITE, REGLAGES, toutesLesTables, cleDeTable, NB_BILLES } from "../src/index";
import { Rng, mixSeed } from "@cdj/core";
import { cosinus, sinus, div } from "../src/entiers";
import { pointOccupe, dansLaTable, DELAI_BILLE_MAX, PAS_GRILLE } from "../src/validation";
// outil du lot PBL2 : `coince2.mjs <thème> <plan> <modules>` : la première bille coincée de la table et l'endroit où elle reste
const [theme, plan, mods] = process.argv.slice(2);
const c = toutesLesTables().find((q) => cleDeTable(q) === `${theme}:${plan}:${mods}`);
const reglages = { ...REGLAGES, sauvee: 0 };
const rng = new Rng(mixSeed(0x424c4c, 1));
const modele = new Partie(c, reglages);
let trouve = false;
for (let y = 30; y <= 600 && !trouve; y += PAS_GRILLE) for (let gx = 40; gx <= 330 && !trouve; gx += PAS_GRILLE) {
  const x = gx + 1;
  if (!dansLaTable(x, y) || pointOccupe(modele.table, x, y)) continue;
  for (const lance of [false, true]) {
    const a = rng.int(360), v = 100 + rng.int(1400), tour = div(a * 16384, 360);
    const vx = lance ? div(cosinus(tour) * v * UNITE, 16384) : 0, vy = lance ? div(sinus(tour) * v * UNITE, 16384) : 0;
    const p = new Partie(c, reglages);
    p.dansLanceur = false; p.entree = p.tick; p.x = x * UNITE; p.y = y * UNITE; p.px = p.x; p.py = p.y; p.vx = vx; p.vy = vy;
    let pas = 0;
    while (p.billes === NB_BILLES && !p.dansLanceur && !p.finie && pas < DELAI_BILLE_MAX) { p.avancer(); pas++; }
    if (p.billes === NB_BILLES && !p.dansLanceur) { console.log(`coincée : départ (${x},${y}) lance=${lance} → (${(p.x / UNITE).toFixed(1)}, ${(p.y / UNITE).toFixed(1)})`); trouve = true; break; }
  }
}
if (!trouve) console.log("aucune bille coincée");
