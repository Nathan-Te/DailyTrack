import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDE, DEPART_EMBOITEMENT, Partie, PARAMS_STABILITE, type Rapier, REGLAGES_DEFAUT, type Scenario, SCENARIO_EMBOITEMENT } from "../src";
import { chargerRapier } from "../src/rapier";
import { CAS, type Cas, etendue, jouerCas } from "../tools/alignement";
import { corpus, jouerEtMesurer, type MesureJeu, VARIANTES } from "../tools/stabilite";

// Lot T8 — une tour qui tient (simulation 5) : la pose douce, la tolérance d'emboîtement et la correction en douceur, le garde-fou de la physique (elle reste le jeu), et l'échantillon du
// corpus du diagnostic (`tools/stabilite.ts`, rapport `docs/tower/lots/lot-T8-stabilite-taquet.md`). Node seulement (règle R13).
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

/** La vitesse verticale maximale (m/s, vers le bas) du carré posé, dans les 40 ticks qui suivent son lâcher. */
function vitesseDePose(version: number, descend: boolean): number {
  const p = new Partie(R, { nom: "pose", pieces: ["O", "O"], plateformeDemi8: 28 }, REGLAGES_DEFAUT, { version });
  let vmax = 0;
  let lache = -1;
  for (let k = 0; k < 4000 && p.etape !== "fini"; k++) {
    p.avancer(descend ? COMMANDE.DESCENDRE : 0);
    if (lache < 0 && p.vue().pieces[0]!.etat === "libre") lache = k;
    if (lache >= 0 && k - lache < 40) vmax = Math.max(vmax, -(p.vitesseDe(0)?.y ?? 0));
    if (lache >= 0 && k - lache >= 40) break;
  }
  p.dispose();
  return vmax;
}

describe("la pose douce : la pièce lâchée arrive au contact à une vitesse bornée, sans coup de marteau", () => {
  it("simulation 4 : ≈ 2,6 m/s au contact ; simulation 5 : elle descend à la vitesse de pose (0,25 m/s) jusqu'au contact, sans gravité pendant 20 ticks — moins du quart, qu'on descende vite ou non", () => {
    const v4 = vitesseDePose(4, false);
    expect(v4).toBeGreaterThan(2.4);
    for (const descend of [false, true]) {
      const v5 = vitesseDePose(5, descend);
      expect(v5, `descend ${descend}`).toBeLessThan(v4 / 4);
      expect(v5).toBeLessThan(0.7);
    }
  });

  it("elle garde son poids : la pièce posée reste un corps de masse (4 kg pour un tétromino) qui charge la tour, et la gravité est entière une fois la pose passée", () => {
    const p = new Partie(R, { nom: "poids", pieces: ["O", "O"], plateformeDemi8: 28 }, REGLAGES_DEFAUT);
    for (let k = 0; k < 400 && p.vue().posees < 1; k++) p.avancer(COMMANDE.DESCENDRE);
    for (let k = 0; k < 200; k++) p.avancer(0);
    const q = p.vue().pieces[0]!;
    expect(q.etat).toBe("libre");
    expect(q.y).toBeCloseTo(1, 2); // posée sur la plateforme
    p.dispose();
  });

  it("la vitesse de pose est réglable (le curseur de ?debug&tune) : la pièce arrive à la vitesse qu'on lui donne (0,25 m/s par défaut ; 1 m/s ; 2,5 m/s : le coup de marteau d'avant)", () => {
    const vitesse = (vitessePose8: number): number => {
      const p = new Partie(R, { nom: "pose", pieces: ["O", "O"], plateformeDemi8: 28 }, REGLAGES_DEFAUT, { stabilite: { vitessePose8 } });
      let vmax = 0;
      let lache = -1;
      for (let k = 0; k < 4000; k++) {
        p.avancer(COMMANDE.DESCENDRE);
        if (lache < 0 && p.vue().pieces[0]!.etat === "libre") lache = k;
        if (lache >= 0) vmax = Math.max(vmax, -(p.vitesseDe(0)?.y ?? 0));
        if (lache >= 0 && k - lache >= 40) break;
      }
      p.dispose();
      return vmax;
    };
    expect(vitesse(PARAMS_STABILITE.vitessePose8)).toBeLessThan(0.4);
    expect(vitesse(PARAMS_STABILITE.vitessePose8)).toBeLessThan(vitesse(8));
    expect(vitesse(8)).toBeLessThan(vitesse(20));
    expect(vitesse(20)).toBeGreaterThan(2.4); // la vitesse de la chute normale : le coup de marteau d'avant
  });
});

describe("la tolérance d'emboîtement et la correction en douceur", () => {
  /** Le bâton debout (une pièce de 1 m de large) descend dans le trou d'un mètre moins `retrecissementMm` entre deux carrés posés. */
  function dansLeTrou(retrecissementMm: number, version = 5): { x: number; y: number; etat: string; gauche: number; droit: number } {
    const sc: Scenario = {
      nom: "trou",
      pieces: ["I"],
      plateformeDemi8: 64,
      depart: [{ kind: "O", rot: 0, x8: 32, y8: 8, dxMm: Math.floor(retrecissementMm / 2) }, { kind: "O", rot: 0, x8: 56, y8: 8, dxMm: -Math.ceil(retrecissementMm / 2) }],
    };
    const p = new Partie(R, sc, REGLAGES_DEFAUT, { version });
    const avant = p.vue().pieces.map((q) => q.x);
    let k = 0;
    let pas = 0;
    while (p.etape !== "fini" && k++ < 3000) {
      const v = p.vue();
      let m = COMMANDE.DESCENDRE;
      if (v.active >= 0) {
        if (k < 4) m |= COMMANDE.TOURNER;
        else if (pas < 11) {
          m |= COMMANDE.DROITE; // 11 pas d'une demi-case : de la naissance (x = −0,5) au trou (x = 5)
          pas++;
        }
      }
      p.avancer(m);
    }
    const f = p.vue().pieces;
    const r = { x: f[2]!.x, y: f[2]!.y, etat: f[2]!.etat, gauche: (f[0]!.x - avant[0]!) * 1000, droit: (f[1]!.x - avant[1]!) * 1000 };
    p.dispose();
    return r;
  }

  it("un trou d'une case rétréci de 1,5 cm : le bâton y entre et s'y pose (il repose au fond, debout), et les voisines bougent de moins de 1 cm", () => {
    const r = dansLeTrou(15);
    expect(r.etat).toBe("libre");
    expect(r.y).toBeCloseTo(2, 2); // le bâton de 4 m de haut posé sur la plateforme : centre à 2 m
    expect(Math.abs(r.x - 5.5)).toBeLessThan(0.02);
    expect(Math.abs(r.gauche)).toBeLessThan(10);
    expect(Math.abs(r.droit)).toBeLessThan(10);
  });

  it("de 1 mm à 2 cm : le bâton entre toujours ; au-delà de la tolérance (2 cm de chaque côté), le déplacement est refusé et il reste sur les carrés", () => {
    // (un rétrécissement de quelques millimètres coince parfois le bâton à un ou deux centimètres du fond : serré entre deux voisines, il tient par frottement — il est « posé » dans le trou)
    for (const mm of [1, 10, 19]) expect(Math.abs(dansLeTrou(mm).y - 2), `${mm} mm`).toBeLessThan(0.04);
    const trop = dansLeTrou(50); // 2,5 cm de chaque côté
    expect(trop.y).toBeGreaterThan(3); // posé sur les carrés, pas dans le trou
  });

  it("avant la simulation 5, le même trou rétréci de 1,5 cm refuse le bâton (tolérance de 1 mm en main, 5 mm au lâcher) : il reste sur les carrés ou de travers", () => {
    expect(dansLeTrou(15, 4).y).toBeGreaterThan(2.1); // il ne s'est pas posé au fond (centre à 2 m)
  });

  it("une pièce qui entre dans un trou d'une case ne fait éjecter aucune pièce : à chaque tick de la pose, aucune voisine ne dépasse 1,5 cm de déplacement et aucune vie n'est perdue", () => {
    const sc: Scenario = { nom: "trou", pieces: ["I", "O"], plateformeDemi8: 64, depart: [{ kind: "O", rot: 0, x8: 32, y8: 8, dxMm: 7 }, { kind: "O", rot: 0, x8: 56, y8: 8, dxMm: -8 }] };
    const p = new Partie(R, sc);
    const avant = p.vue().pieces.map((q) => q.x);
    let maxi = 0;
    let k = 0;
    let pas = 0;
    while (p.etape !== "fini" && k++ < 3000) {
      const v = p.vue();
      let m = COMMANDE.DESCENDRE;
      if (v.active === 2) m |= k < 4 ? COMMANDE.TOURNER : pas++ < 11 ? COMMANDE.DROITE : 0;
      p.avancer(m);
      const f = p.vue().pieces;
      maxi = Math.max(maxi, Math.abs(f[0]!.x - avant[0]!), Math.abs(f[1]!.x - avant[1]!));
    }
    expect(maxi).toBeLessThan(0.015);
    expect(p.vue().tombees).toBe(0);
    p.dispose();
  });
});

describe("le déplacement intelligent : le pas reste d'une demi-case, le jeu recale la pièce pour qu'elle tombe dans le creux visé", () => {
  /** Le bâton debout est mené au trou de 99 cm (les deux murs décalés ensemble de `decalMm` hors de la grille) ; rend sa hauteur finale, son abscisse et le déplacement des murs (mm). */
  function versLeTrou(decalMm: number, alignement?: number): { y: number; x: number; murs: number } {
    const sc: Scenario = {
      nom: "trou décalé",
      pieces: ["I"],
      plateformeDemi8: 64,
      depart: [{ kind: "O", rot: 0, x8: 32, y8: 8, dxMm: decalMm + 5 }, { kind: "O", rot: 0, x8: 56, y8: 8, dxMm: decalMm - 5 }],
    };
    const p = new Partie(R, sc, REGLAGES_DEFAUT, alignement === undefined ? {} : { stabilite: { alignement } });
    const avant = p.vue().pieces.map((q) => q.x);
    let k = 0;
    let tournes = 0;
    let pas = 0;
    while (p.etape !== "fini" && k++ < 3000) {
      const v = p.vue();
      let m = COMMANDE.DESCENDRE;
      if (v.active >= 0) {
        if (tournes < 3 && k % 3 === 0) {
          m |= COMMANDE.TOURNER;
          tournes++;
        } else if (tournes >= 3 && pas < 11) {
          m |= COMMANDE.DROITE; // 11 pas d'une demi-case : de la naissance (x = −0,5) au trou (x = 5)
          pas++;
        }
      }
      p.avancer(m);
    }
    const f = p.vue().pieces;
    const r = { y: f[2]!.y, x: f[2]!.x, murs: Math.max(Math.abs(f[0]!.x - avant[0]!), Math.abs(f[1]!.x - avant[1]!)) * 1000 };
    p.dispose();
    return r;
  }

  it("un trou décalé de la grille de 2, 4 ou 6 cm par une dérive : le bâton y tombe (il repose au fond) ; sans recalage il se pose en travers des murs", () => {
    for (const mm of [20, 40, 60, -40]) {
      const intelligent = versLeTrou(mm);
      expect(intelligent.y, `${mm} mm`).toBeCloseTo(2, 1);
      expect(intelligent.murs, `${mm} mm : les murs ne bougent pas`).toBeLessThan(10);
    }
    for (const mm of [40, 60]) expect(versLeTrou(mm, 0).y, `${mm} mm sans recalage`).toBeGreaterThan(2.4);
  });

  it("le recalage a une portée (6 cm) : un trou décalé de 9 cm n'est pas rattrapé, et il ne bouge pas une pièce qui n'en a pas besoin (trou à la grille : aucune correction)", () => {
    expect(versLeTrou(90).y).toBeGreaterThan(2.4);
    const p = new Partie(R, { nom: "libre", pieces: ["O"], plateformeDemi8: 64 });
    for (let i = 0; i < 6; i++) p.avancer(i % 2 === 0 ? COMMANDE.DROITE : 0);
    expect(p.vue().pieces[0]!.x * 8).toBeCloseTo(Math.round(p.vue().pieces[0]!.x * 8), 6); // sur la grille des huitièmes : rien n'a été recalé
    p.dispose();
  });

  it("le recalage est le même à chaque fois (déterministe) et la rediffusion le refait : même résultat deux fois", () => {
    const a = versLeTrou(40);
    const b = versLeTrou(40);
    expect(a).toEqual(b);
  });
});

describe("la physique reste le jeu, en simulation 5 : un porte-à-faux tombe, une tour mal bâtie s'effondre", () => {
  function jouer(c: Cas, version = 5): Partie {
    const p = new Partie(R, { nom: c.nom, pieces: c.placements.map((q) => q.kind), plateformeDemi8: c.demi8 }, REGLAGES_DEFAUT, { version });
    for (let t = 0; t < 20000 && p.etape !== "fini"; t++) {
      const v = p.vue();
      let cmd = COMMANDE.DESCENDRE;
      if (v.active >= 0) {
        const q = c.placements[v.active]!;
        const pc = v.pieces[v.active]!;
        const e = etendue(pc.kind, pc.rot, pc);
        const ecart = q.gauche8 - e.gauche * 8;
        if (ecart > 2) cmd |= COMMANDE.DROITE;
        else if (ecart < -2) cmd |= COMMANDE.GAUCHE;
      }
      p.avancer(cmd);
    }
    return p;
  }

  it("un O posé à moitié dans le vide tombe toujours ; aux trois quarts dans le vide, il bascule et tombe à la mer", () => {
    // La plateforme finit à 3,5 m : un carré de 2 m dont le bord gauche est à 3 m a les trois quarts de sa largeur dans le vide.
    const trois = jouer({ nom: "trois quarts", demi8: 28, placements: [{ kind: "O", rot: 0, gauche8: 24 }], contraintes: [] });
    expect(trois.vue().pieces[0]!.etat).toBe("perdue");
    expect(trois.resultat()!.vies).toBe(REGLAGES_DEFAUT.vies - 1);
    trois.dispose();
    // Le centre de masse au bord exact (1 m dans le vide sur 2) : il ne tient pas (au bord, rien ne le retient) — un cheveu plus loin, il tombe.
    const moitie = jouer({ nom: "moitié", demi8: 28, placements: [{ kind: "O", rot: 0, gauche8: 28 }], contraintes: [] });
    expect(moitie.vue().pieces[0]!.etat).toBe("perdue");
    moitie.dispose();
  });

  it("un O posé pile sur le bord (son centre de masse sur la plateforme) tient", () => {
    const tient = jouer({ nom: "bord", demi8: 28, placements: [{ kind: "O", rot: 0, gauche8: 12 }], contraintes: [] });
    expect(tient.vue().pieces[0]!.etat).toBe("libre");
    tient.dispose();
  });

  it("un O posé sur un autre, décalé de 1,5 m (son centre de masse hors de l'appui), glisse et tombe", () => {
    const p = jouer({ nom: "décalé", demi8: 28, placements: [{ kind: "O", rot: 0, gauche8: -8 }, { kind: "O", rot: 0, gauche8: 4 }], contraintes: [] });
    const haut = p.vue().pieces[1]!;
    expect(haut.etat === "perdue" || haut.y < 2.9 || Math.abs(haut.angle) > 0.2).toBe(true);
    p.dispose();
  });

  it("une tour bâtie en escalier, chaque carré décalé d'une demi-case dans le même sens, s'effondre avant le sixième", () => {
    const placements = Array.from({ length: 8 }, (_, i) => ({ kind: "O" as const, rot: 0, gauche8: -8 + 4 * i }));
    const p = jouer({ nom: "escalier", demi8: 28, placements, contraintes: [] });
    expect(p.vue().tombees).toBeGreaterThanOrEqual(1);
    p.dispose();
  });

  it("les cas du diagnostic de l'alignement restent justes (5 mm, 0,5°) en simulation 5", () => {
    for (const c of CAS) {
      const m = jouerCas(R, c, 5);
      expect(Math.abs(m.horizontalMm), `${c.nom} : bords`).toBeLessThanOrEqual(5);
      expect(m.inclinaisonDeg, `${c.nom} : inclinaison`).toBeLessThanOrEqual(0.5);
      expect(m.glissementMm, `${c.nom} : glissement`).toBeLessThanOrEqual(5);
      expect(m.perdues, `${c.nom} : pièces perdues`).toBe(0);
    }
  });
});

describe("le corpus du diagnostic : aucune pièce ne bouge sans cause (échantillon)", () => {
  // Un échantillon du corpus de `tools/stabilite.ts` (le joueur bruité et les scénarios nommés ; le bot imparfait est trop long pour un test) : 12 parties à graine fixe.
  const echantillon = corpus(200).filter((e) => e.famille !== "bot").filter((_, i) => i % 15 === 0).slice(0, 12);
  const base = VARIANTES.find((v) => v.nom === "v5")!;

  it("sur 12 parties du corpus, zéro mouvement de plus de 5 mm ou 0,5° d'une pièce calme depuis 1 s quand aucune pièce n'a rejoint ni quitté son îlot depuis 30 ticks", () => {
    const jeux: MesureJeu[] = echantillon.map((e) => jouerEtMesurer(R, e, base, null));
    expect(jeux.length).toBe(12);
    expect(jeux.reduce((a, j) => a + j.poses, 0)).toBeGreaterThan(100);
    for (const j of jeux) expect(j.sansCause.map((x) => `${j.id} tick ${x.tick} : ${x.mm} mm ${x.deg}°`), j.id).toEqual([]);
  }, 120_000);

  it("la tour de départ de ?scenario=emboitement (une niche latérale, un trou rétréci) est stable : au repos, rien ne bouge", () => {
    const p = new Partie(R, { ...SCENARIO_EMBOITEMENT, pieces: ["O"] });
    expect(DEPART_EMBOITEMENT.length).toBe(4);
    const avant = p.vue().pieces.map((q) => [q.x, q.y]);
    for (let k = 0; k < 300; k++) p.avancer(0);
    p.vue().pieces.slice(0, 4).forEach((q, i) => {
      expect(q.etat).toBe("libre");
      expect(Math.hypot(q.x - avant[i]![0]!, q.y - avant[i]![1]!), `pièce ${i}`).toBeLessThan(0.012); // elle se tasse de quelques millimètres, rien de plus
    });
    p.dispose();
  });
});
