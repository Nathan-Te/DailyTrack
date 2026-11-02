import { COMMANDE, empreinteVue, encoderRediffusion, enregistrer, Partie, type Rapier, REGLAGES_DEFAUT, SCENARIO_EMBOITEMENT, type Scenario } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { type EvenementJeu, Observateur } from "../src/evenements";
import { AnalyseurPanique } from "../src/panique";
import { EffetsTaquet } from "../src/taquetFx";

// Lot T9 — le taquet en quatre temps, lus dans les événements de la partie (la vue et les commandes du tick), jamais dans la simulation : le coup part, il percute un bloc (le choc), la pièce reste calée ; sans choc,
// seulement le coup et un petit souffle. On joue la VRAIE partie (Rapier) et on regarde ce que l'observateur en tire.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

/** Le carré posé de `?scenario` du test du lot T8 : x de 3 à 5, y de 0 à 2, sur une grande plateforme ; la pièce en main part à x = 1,5 (son bord droit à 0,5 m du carré). */
const CHOC: Scenario = { nom: "choc", pieces: ["O", "O"], plateformeDemi8: 128, depart: [{ kind: "O", rot: 0, x8: 32, y8: 8 }] };
const VIDE: Scenario = { nom: "vide", pieces: ["O", "O"], plateformeDemi8: 128 };

interface Jeu {
  evenements: EvenementJeu[];
  taquets: number[];
}
/** Joue : la pièce en main descend, va à droite de `pas` demi-cases, et reçoit un taquet à droite quand son bas passe sous `hauteur`. */
function jouer(contenu: Scenario, o: { pas: number; hauteur: number; taquet?: number; ticks?: number }): { jeu: Jeu; partie: Partie } {
  const p = new Partie(R, contenu);
  const obs = new Observateur();
  const jeu: Jeu = { evenements: [], taquets: [] };
  obs.observer(p.vue());
  let donne = false;
  const premiere = p.vue().active;
  for (let k = 0; k < (o.ticks ?? 700); k++) {
    const v = p.vue();
    const q = v.pieces.find((x) => x.id === premiere)!;
    let m: number = q.etat === "active" ? COMMANDE.DESCENDRE : 0;
    if (q.etat === "active" && q.y - 1 > o.hauteur + 2) m = 0;
    if (k < o.pas) m |= COMMANDE.DROITE;
    if (q.etat === "active" && !donne && o.taquet !== undefined && q.y - 1 <= o.hauteur) {
      m |= o.taquet;
      donne = true;
      jeu.taquets.push(p.tick);
    }
    p.avancer(m);
    jeu.evenements.push(...obs.observer(p.vue(), [], m));
  }
  return { jeu, partie: p };
}
const genres = (e: readonly EvenementJeu[]): string[] => e.map((x) => x.genre).filter((g) => ["taquet", "choc", "cale", "souffle"].includes(g));

describe("le taquet en quatre temps, lu dans les événements de la partie", () => {
  it("un coup qui percute un bloc : le coup part, la pièce est lâchée contre le bloc (le choc), puis elle reste calée — dans cet ordre", () => {
    const { jeu, partie } = jouer(CHOC, { pas: 3, hauteur: 1.4, taquet: COMMANDE.TAQUET_DROITE });
    expect(genres(jeu.evenements)).toEqual(["taquet", "choc", "cale"]);
    const ev = jeu.evenements.filter((e) => e.genre === "taquet" || e.genre === "choc");
    expect(ev[0]).toMatchObject({ genre: "taquet", sens: 1 });
    expect(ev[1]).toMatchObject({ genre: "choc", sens: 1, id: (ev[0] as { id: number }).id });
    partie.dispose();
  });

  it("un coup dans le vide (rien sur son chemin) : le coup part, puis un petit souffle ; ni choc, ni pièce calée", () => {
    const { jeu, partie } = jouer(VIDE, { pas: 0, hauteur: 3, taquet: COMMANDE.TAQUET_GAUCHE });
    expect(genres(jeu.evenements)).toEqual(["taquet", "souffle"]);
    expect(jeu.evenements.find((e) => e.genre === "taquet")).toMatchObject({ sens: -1 });
    partie.dispose();
  });

  it("sans taquet, aucun des quatre temps ; un pas ordinaire (une demi-case) n'est pas un coup", () => {
    const { jeu, partie } = jouer(CHOC, { pas: 3, hauteur: 1.4 });
    expect(genres(jeu.evenements)).toEqual([]);
    partie.dispose();
  });

  it("la pièce lâchée par le choc donne aussi son contact ordinaire (le son du lâcher) avec sa position", () => {
    const { jeu, partie } = jouer(CHOC, { pas: 3, hauteur: 1.4, taquet: COMMANDE.TAQUET_DROITE });
    const contact = jeu.evenements.find((e) => e.genre === "contact");
    expect(contact).toMatchObject({ genre: "contact", id: expect.any(Number), x: expect.any(Number), y: expect.any(Number) });
    partie.dispose();
  });
});

describe("le scénario d'emboîtement : le carré glissé sous le bâton, contre la tige du L", () => {
  it("le taquet pousse le carré dans la niche, il percute la tige (un bloc de plusieurs boîtes), est lâché : coup, choc, puis calé", () => {
    const p = new Partie(R, { ...SCENARIO_EMBOITEMENT, pieces: ["O", "O"] });
    const obs = new Observateur();
    const premiere = p.vue().active;
    obs.observer(p.vue());
    const evenements: EvenementJeu[] = [];
    let donne = false;
    for (let k = 0; k < 900 && p.etape !== "fini"; k++) {
      const q = p.vue().pieces.find((x) => x.id === premiere)!;
      let m: number = q.etat === "active" ? (k < 5 ? COMMANDE.GAUCHE : COMMANDE.DESCENDRE) : 0;
      if (q.etat === "active" && k >= 5 && !donne && q.y - 1 <= 1) {
        m |= COMMANDE.TAQUET_DROITE;
        donne = true;
      }
      p.avancer(m);
      evenements.push(...obs.observer(p.vue(), [], m));
    }
    expect(genres(evenements)).toEqual(["taquet", "choc", "cale"]);
    p.dispose();
  });
});

describe("le rendu ne touche jamais la simulation", () => {
  const scenario: Scenario = { ...SCENARIO_EMBOITEMENT, pieces: ["O", "I", "O", "T"] };
  /** Une partie scriptée avec des taquets ; `affichage` : l'observateur, la panique, la visée, les soudures sont lus à chaque tick. */
  function partieScriptee(affichage: boolean): { code: string; empreinte: string; resultat: string } {
    const p = new Partie(R, scenario, { ...REGLAGES_DEFAUT, vies: 9 });
    const obs = new Observateur();
    const analyseur = new AnalyseurPanique(scenario.plateformeDemi8);
    let graine = 4242;
    const alea = (): number => ((graine = (graine * 1664525 + 1013904223) >>> 0) / 4294967296);
    while (p.etape !== "fini" && p.tick < 9000) {
      const v = p.vue();
      let m = v.active >= 0 ? COMMANDE.DESCENDRE : 0;
      const r = alea();
      if (r < 0.05) m |= COMMANDE.TAQUET_DROITE;
      else if (r < 0.1) m |= COMMANDE.TAQUET_GAUCHE;
      else if (r < 0.2) m |= COMMANDE.GAUCHE;
      else if (r < 0.3) m |= COMMANDE.DROITE;
      if (affichage) {
        p.visee();
        p.soudures();
        analyseur.analyser(v);
      }
      p.avancer(m);
      if (affichage) obs.observer(p.vue(), analyseur.nouveauxAffoles, m);
    }
    const out = { code: encoderRediffusion(enregistrer(p)), empreinte: empreinteVue(p.vue()), resultat: JSON.stringify(p.resultat()) };
    p.dispose();
    return out;
  }

  it("même partie, même rediffusion, même empreinte et même résultat, avec ou sans tout l'affichage (événements, panique, visée, soudures)", () => {
    expect(partieScriptee(true)).toEqual(partieScriptee(false));
  });

  it("aucun module d'habillage, de décor ou d'effet n'importe la simulation (que des types et les formes des pièces)", () => {
    for (const f of ["habits.ts", "taquetFx.ts", "polygones.ts", "decorLogique.ts", "decorScene.ts", "decorPort.ts", "decorChantier.ts", "decorCanyon.ts", "decorBanquise.ts", "decorJungle.ts", "decorNuit.ts", "tampon.ts"]) {
      const src = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
      for (const m of src.matchAll(/^import (?!type )[^\n]*from "(@cdj\/tower-sim[^"]*)"/gm)) {
        expect(m[0], `${f} : ${m[0]}`).toMatch(/^import \{ (type \w+(, )?)+ \}|estBonus|boitesE/); // des types, `estBonus` (une table) et les boîtes d'une pièce : jamais la partie ni le rejeu
        expect(m[0], f).not.toMatch(/Partie|rejouer|enregistrer|COMMANDE/);
      }
      expect(src, f).not.toMatch(/Math\.random|Date\.now/);
    }
  });
});

describe("les effets du taquet (affichage, aplats)", () => {
  const cadre = { x: 2, y: 3, demiX: 1, demiY: 1 };
  const nouveau = (reduit = false): EffetsTaquet => new EffetsTaquet(() => 0.5, () => reduit);

  it("chaque temps lève ses effets, qui finissent par disparaître", () => {
    for (const faire of [(e: EffetsTaquet) => e.coup(cadre, 1), (e: EffetsTaquet) => e.choc(cadre, 1, 1), (e: EffetsTaquet) => e.cale(cadre), (e: EffetsTaquet) => e.souffle(cadre, -1), (e: EffetsTaquet) => e.poseGeante(cadre)]) {
      const e = nouveau();
      faire(e);
      expect(e.enCours).toBe(1);
      for (let i = 0; i < 400; i++) e.maj(1 / 60);
      expect(e.enCours).toBe(0);
      expect(e.racine.children).toHaveLength(0);
    }
  });

  it("le choc a un éclat étoilé jaune bordé d'encre ; le curseur à zéro le supprime", () => {
    const e = nouveau();
    e.choc(cadre, 1, 1);
    const couleurs = new Set<string>();
    e.racine.traverse((o) => {
      const m = (o as { material?: { color?: { getHexString(): string } } }).material;
      if (m?.color) couleurs.add(`#${m.color.getHexString().toUpperCase()}`);
    });
    expect(couleurs).toContain("#F2B544");
    expect(couleurs).toContain("#2A1E16");
    const rien = nouveau();
    rien.choc(cadre, 1, 0);
    expect(rien.enCours).toBe(0);
  });

  it("l'éclat est posé à l'impact : au bord de la pièce, du côté du coup", () => {
    for (const sens of [-1, 1] as const) {
      const e = nouveau();
      e.choc(cadre, sens, 1);
      const eclat = e.racine.children[0]!.children[0]!;
      expect(eclat.position.x).toBeCloseTo(cadre.x + sens * cadre.demiX, 5);
      expect(eclat.position.y).toBeCloseTo(cadre.y, 5);
    }
  });

  it("avec le mouvement réduit : ni traînées, ni souffle, ni poussière, ni confettis ; l'éclat reste, immobile", () => {
    const e = nouveau(true);
    e.coup(cadre, 1);
    e.souffle(cadre, 1);
    expect(e.enCours).toBe(0);
    e.choc(cadre, 1, 1);
    expect(e.enCours).toBe(1);
    const avantEclat = e.racine.children[0]!.children[0]!.scale.x;
    e.maj(0.1);
    expect(e.racine.children[0]!.children[0]!.scale.x).toBe(avantEclat);
    const normal = nouveau();
    normal.choc(cadre, 1, 1);
    expect(normal.racine.children[0]!.children.length).toBeGreaterThan(e.racine.children[0]!.children.length); // les confettis
  });
});
