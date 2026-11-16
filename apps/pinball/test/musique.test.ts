import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEMES_PINBALL } from "@cdj/pinball-sim";
import { SCENES, lireListe, pistesDeLaScene, pistesDuJeu } from "@cdj/musique";
import { describe, expect, it } from "vitest";

// Lot PBS1 — la musique de Pinball : **le branchement est complet, il manque les morceaux** (c'est à Nathan de les fournir : `docs/pinball/lots/lot-PBS1-sons.md`, « La musique »). Ce test garde ce qui est en place et ce qui doit rester
// vrai quand les morceaux arriveront : une scène par menu et par thème, le kit qui annonce ces scènes, le jeu branché au lecteur commun, et aucun morceau qui passe dans le thème d'un autre.
const racine = (chemin: string): string => join(__dirname, "../../..", chemin);
const liste = lireListe(JSON.parse(readFileSync(racine("musique/servi/liste.json"), "utf8")))!;
const pinball = pistesDuJeu(liste, "pinball");
const fiche = JSON.parse(readFileSync(racine("config/jeux/pinball.json"), "utf8")) as { musique: { scenes: string[] } };

describe("la musique de Pinball : les scènes et le branchement", () => {
  it("les scènes de Pinball sont `menu` et un `theme:<id>` par thème du jeu, celles de sa fiche", () => {
    const attendu = ["menu", ...THEMES_PINBALL.map((t) => `theme:${t}`)];
    expect([...SCENES.pinball]).toEqual(attendu);
    expect(fiche.musique.scenes).toEqual(attendu);
  });

  it("le jeu est branché au lecteur commun (`brancherMusique(\"pinball\", gameStorage)`) et le kit annonce le menu puis le thème de la partie", () => {
    expect(readFileSync(new URL("../src/main.ts", import.meta.url), "utf8")).toContain('brancherMusique("pinball", gameStorage)');
    const kit = readFileSync(racine("packages/kit/src/jeu/partie.ts"), "utf8");
    expect(kit).toContain("c.musique.scene(`theme:${c.theme}`)");
    expect(readFileSync(racine("packages/kit/src/jeu/index.ts"), "utf8")).toContain('musique.scene("menu")');
  });

  it("chaque morceau de Pinball nomme des scènes du jeu (ou aucune : il passe alors partout) : un thème inconnu ne joue rien, sans repli sur un autre thème", () => {
    for (const p of pinball) for (const s of p.scenes ?? []) expect(SCENES.pinball, `${p.id} : ${s}`).toContain(s);
    expect(pistesDeLaScene(pinball, "theme:lave").filter((p) => p.scenes !== undefined)).toEqual([]);
  });

  it("dans chaque scène, seuls passent les morceaux réservés à cette scène (ou, sinon, ceux sans scène) : jamais celui d'un autre thème", () => {
    for (const scene of SCENES.pinball) {
      for (const p of pistesDeLaScene(pinball, scene)) expect(p.scenes === undefined || p.scenes.includes(scene), `${p.id} dans ${scene}`).toBe(true);
    }
  });
});
