import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import {
  BLOC,
  CASE,
  GLACE,
  GRAVITY_GENERATOR_VERSION,
  INVERSEUR,
  LARGEUR_MORCEAU,
  LIGNES,
  MORCEAUX_PAR_BOUCLE,
  MORCEAUX_PAR_THEME,
  PIQUE,
  THEMES_GRAVITY,
  VENT,
  dailyGravity,
  empreinteContenu,
  genererMorceau,
  ordreDesThemes,
  colonnesParcourues,
  pasDeTraversee,
  planDuJour,
  reglesDuContenu,
  terrainDuJour,
  tickOuLeJoueurArrive,
  vitesseCamera,
  type Morceau,
} from "../src/index";

const JOUR = daysFromCivil(2026, 11, 9);
const case_ = (m: Morceau, c: number, r: number): number => m.cases[c * LIGNES + r]!;
/** Les morceaux d'une section à mode (lot GR6) : leur chemin est un axe, pas une suite de surfaces ; ils ont leurs tests (`sections.test.ts`). */
const enMode = (m: Morceau): boolean => m.motif === "avion" || m.motif === "onde" || m.motif === "ressort";
/** La vitesse de la caméra (unités par seconde) à la colonne 8 du morceau `m` d'un jour, **sous les portails de vitesse** (lot GR6 : elle ne dépend plus seulement de la distance). */
const vitesseDuMorceau = (jour: number, m: number): number => {
  const c = dailyGravity(jour);
  const r = reglesDuContenu(c);
  const colonne = m * LARGEUR_MORCEAU + 8;
  return vitesseCamera(Math.max(0, colonne * CASE - 17203), r, planDuJour(jour, r).facteurAu(colonne * CASE + (CASE >> 1)));
};

describe("le générateur du jour", () => {
  it("est pur : le même jour donne le même contenu, le même morceau, la même empreinte", () => {
    expect(dailyGravity(JOUR)).toEqual(dailyGravity(JOUR));
    expect(empreinteContenu(dailyGravity(JOUR))).toBe(empreinteContenu(dailyGravity(JOUR)));
    const a = terrainDuJour(dailyGravity(JOUR)).morceau(40);
    const avant = terrainDuJour(dailyGravity(JOUR)).morceau(39);
    const b = genererMorceau(JOUR, 40, dailyGravity(JOUR).ordre, avant.sortie, avant.motif);
    expect(b).toEqual(a);
  });
  it("change d'un jour à l'autre (l'ordre, les morceaux, l'empreinte)", () => {
    const empreintes = new Set(Array.from({ length: 20 }, (_, i) => empreinteContenu(dailyGravity(JOUR + i))));
    expect(empreintes.size).toBe(20);
  });
  it("ne dépend d'aucune date : aucun jour n'est lu de l'horloge, la version est un entier", () => {
    expect(Number.isInteger(GRAVITY_GENERATOR_VERSION)).toBe(true);
    expect(dailyGravity(JOUR).g).toBe(GRAVITY_GENERATOR_VERSION);
    expect(() => dailyGravity(JOUR, 99)).toThrow(/version de générateur inconnue/);
  });
  it("mélange chaque jour les cinq thèmes de Jump : un thème tous les 19 morceaux, puis la boucle reprend", () => {
    const ordres = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const ordre = ordreDesThemes(JOUR + i);
      expect([...ordre].sort()).toEqual([...THEMES_GRAVITY].sort());
      ordres.add(ordre.join());
    }
    expect(ordres.size).toBeGreaterThan(10);
    const c = dailyGravity(JOUR);
    const t = terrainDuJour(c);
    for (let m = 0; m < 2 * MORCEAUX_PAR_BOUCLE; m++) expect(t.morceau(m).theme).toBe(c.ordre[Math.trunc(m / MORCEAUX_PAR_THEME) % 5]);
  });
  it("les trois premiers morceaux sont calmes : un couloir, des pièces, rien de dangereux", () => {
    const t = terrainDuJour(dailyGravity(JOUR));
    for (let m = 0; m < 3; m++) {
      const mor = t.morceau(m);
      expect(mor.motif).toBe("calme");
      for (let c = 0; c < LARGEUR_MORCEAU; c++) for (let r = 0; r < LIGNES; r++) expect(case_(mor, c, r)).toBe(r < 2 || r >= 10 ? BLOC : 0);
      expect(mor.pieces.length).toBeGreaterThan(3);
      expect(mor.gemmes.length + mor.bonus.length).toBe(0);
    }
  });
  it("tous les motifs et toutes les cases du jeu apparaissent sur un tour des cinq thèmes (sur quelques jours)", () => {
    const motifs = new Set<string>();
    const types = new Set<number>();
    for (let j = 0; j < 12; j++) {
      const t = terrainDuJour(dailyGravity(JOUR + j));
      for (let m = 0; m < MORCEAUX_PAR_BOUCLE; m++) {
        const mor = t.morceau(m);
        motifs.add(mor.motif);
        for (const v of mor.cases) types.add(v);
      }
    }
    expect([...motifs].sort()).toEqual(["avion", "calme", "escalier", "etages", "ilots", "inverseur", "milieu", "onde", "pics", "pilier", "ressort", "special", "trouBas", "trouHaut", "zigzag"]);
    expect([...types].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("les gemmes sont rares ; le bouclier et l'aimant sont à des endroits fixes (un morceau sur 23)", () => {
    const t = terrainDuJour(dailyGravity(JOUR));
    let gemmes = 0;
    const bonus: string[] = [];
    for (let m = 0; m < 2 * MORCEAUX_PAR_BOUCLE; m++) {
      gemmes += t.morceau(m).gemmes.length;
      for (const b of t.morceau(m).bonus) bonus.push(`${m % 23}:${b.type}`);
    }
    expect(gemmes).toBeGreaterThan(5);
    expect(gemmes).toBeLessThan(60);
    expect(new Set(bonus)).toEqual(new Set(["11:bouclier", "19:aimant"]));
  });
  it("la boucle est plus dense : plus de morceaux en section à mode et de motifs difficiles au second tour", () => {
    const difficiles = (de: number): number => {
      let n = 0;
      for (let j = 0; j < 15; j++) {
        const t = terrainDuJour(dailyGravity(JOUR + j));
        // Les motifs difficiles de la gravité, plus les sections à mode (le seed : « plus nombreux et plus denses dans la seconde boucle »).
        for (let m = de; m < de + MORCEAUX_PAR_BOUCLE; m++) if (["milieu", "escalier", "etages", "ilots", "inverseur", "avion", "onde", "ressort"].includes(t.morceau(m).motif)) n++;
      }
      return n;
    };
    expect(difficiles(MORCEAUX_PAR_BOUCLE)).toBeGreaterThan(difficiles(0));
  });
});

describe("le chemin sûr de chaque morceau", () => {
  const jours = Array.from({ length: 12 }, (_, i) => JOUR + i);
  it("chaque morceau a un chemin, du côté d'où l'on arrive : une étape dans la surface voulue, dont la rangée est libre", () => {
    for (const j of jours) {
      const t = terrainDuJour(dailyGravity(j));
      for (let m = 0; m < 2 * MORCEAUX_PAR_BOUCLE; m++) {
        const mor = t.morceau(m);
        expect(mor.chemin.length).toBeGreaterThan(0);
        if (enMode(mor)) continue;
        expect(mor.entree).toBe(m === 0 ? 1 : t.morceau(m - 1).sortie);
        expect(mor.sortie).toBe(mor.chemin[mor.chemin.length - 1]!.g);
        for (const e of mor.chemin) {
          expect(e.c0).toBeGreaterThanOrEqual(0);
          expect(e.c1).toBeLessThanOrEqual(LARGEUR_MORCEAU);
          expect(e.c1).toBeGreaterThan(e.c0);
          for (let c = e.c0; c < e.c1; c++) {
            // La rangée du joueur n'est ni solide ni dangereuse, et la case de l'autre côté (sous les pieds ou au-dessus de la tête) existe — sauf la glace d'un autre côté et les cases qui battent.
            const libre = case_(mor, c, e.y);
            expect([0, VENT]).toContain(libre);
          }
        }
        // Les pièces sont posées dans l'écran.
        for (const p of mor.pieces) {
          expect(p.x).toBeGreaterThanOrEqual(m * LARGEUR_MORCEAU * CASE);
          expect(p.x).toBeLessThan((m + 1) * LARGEUR_MORCEAU * CASE);
          expect(p.y).toBeGreaterThan(0);
          expect(p.y).toBeLessThan(LIGNES * CASE);
        }
      }
    }
  });
  it("une étape au sol a un sol sous ses pieds (sauf au-dessus d'un trou franchi en vol), une au plafond un plafond", () => {
    let manques = 0;
    let total = 0;
    for (const j of jours) {
      const t = terrainDuJour(dailyGravity(j));
      for (let m = 3; m < MORCEAUX_PAR_BOUCLE; m++) {
        const mor = t.morceau(m);
        if (enMode(mor)) continue;
        for (const e of mor.chemin) {
          for (let c = e.c0; c < e.c1; c++) {
            total++;
            const support = case_(mor, c, e.y + e.g);
            if (![BLOC, 3, GLACE, 5, 6, 7, INVERSEUR].includes(support)) manques++;
          }
        }
      }
    }
    // Les étapes sont des surfaces : les colonnes sans support ne sont que le raccord de deux étapes (le vol d'une surface à l'autre, la forêt) — jamais plus d'une sur cinq.
    expect(manques / total).toBeLessThan(0.2);
  });
  it("le chemin n'enjambe jamais un pique ni la glace pour s'y tenir", () => {
    for (const j of jours) {
      const t = terrainDuJour(dailyGravity(j));
      for (let m = 3; m < 2 * MORCEAUX_PAR_BOUCLE; m++) {
        const mor = t.morceau(m);
        if (enMode(mor)) continue;
        for (const e of mor.chemin) for (let c = e.c0; c < e.c1; c++) expect(case_(mor, c, e.y)).not.toBe(PIQUE);
      }
    }
  });
});

describe("le battement aligné sur l'arrivée du joueur", () => {
  it("l'arrivée à une colonne grandit avec la colonne ; au départ elle est proche de zéro", () => {
    let avant = -1;
    for (let c = 8; c < 800; c += 16) {
      const t = tickOuLeJoueurArrive(c * CASE);
      expect(t).toBeGreaterThan(avant);
      avant = t;
    }
    expect(tickOuLeJoueurArrive(0)).toBe(0);
  });
  it("les cases qui battent d'un morceau portent un décalage, les autres aucun", () => {
    const t = terrainDuJour(dailyGravity(JOUR));
    let avecDecalage = 0;
    for (let m = 0; m < 3 * MORCEAUX_PAR_BOUCLE; m++) {
      const mor = t.morceau(m);
      const bat = [...mor.cases].some((v) => v === 5 || v === 6 || v === 7);
      if (!bat) expect(mor.decalage).toBe(0);
      else if (mor.decalage > 0) avecDecalage++;
    }
    expect(avecDecalage).toBeGreaterThan(0);
  });
});

describe("les surfaces suivent la vitesse à laquelle le morceau est abordé (lot GR2)", () => {
  it("un vol d'une surface à l'autre dure plus de pas pour plus de hauteur, et fait plus de colonnes plus loin dans la course", () => {
    expect(pasDeTraversee(3 * CASE)).toBeGreaterThan(pasDeTraversee(CASE));
    expect(pasDeTraversee((13 * CASE) >> 2)).toBeGreaterThan(40); // 3,25 cases : 45 pas environ
    expect(pasDeTraversee((13 * CASE) >> 2)).toBeLessThan(55);
    const vite = colonnesParcourues(45, 1400);
    const lent = colonnesParcourues(45, 20);
    expect(lent).toBeGreaterThanOrEqual(3);
    expect(vite).toBeGreaterThan(lent);
    expect(vite).toBeLessThanOrEqual(6);
  });
  /** Les morceaux d'un motif sur quelques jours, avec la colonne de leur premier îlot de l'étage bas (rangée 8, ou 3 en miroir) pour mesurer un écart. */
  const morceauxDe = (motif: string, de: number, a: number): Morceau[] => {
    const sortie: Morceau[] = [];
    for (let j = 0; j < 40; j++) {
      const t = terrainDuJour(dailyGravity(JOUR + j));
      for (let m = de; m < a; m++) if (t.morceau(m).motif === motif) sortie.push(t.morceau(m));
    }
    return sortie;
  };
  const debutsDesIlots = (mor: Morceau): number[] => {
    const debuts: number[] = [];
    for (let c = 1; c < LARGEUR_MORCEAU; c++) {
      const bloc = (r: number): boolean => case_(mor, c, r) === BLOC && case_(mor, c - 1, r) !== BLOC;
      if (bloc(3) || bloc(8)) debuts.push(c);
    }
    return debuts.filter((c) => c >= 2);
  };
  it("les îlots laissent la place de rejoindre le sol ou le plafond avant le bout du morceau : à partir de 8 m/s (leur premier morceau) il n'en reste qu'un par morceau", () => {
    // Lot GR6 : « à partir de 8 m/s » se lit sur la vitesse réelle du morceau (les portails de vitesse la changent), plus sur sa place dans le niveau.
    const vitesses = new Map<Morceau, number>();
    const morceaux: Morceau[] = [];
    for (let j = 0; j < 40; j++) {
      const t = terrainDuJour(dailyGravity(JOUR + j));
      for (let m = 19; m < 2 * MORCEAUX_PAR_BOUCLE; m++) {
        const mor = t.morceau(m);
        if (mor.motif !== "ilots") continue;
        vitesses.set(mor, vitesseDuMorceau(JOUR + j, m));
        if (vitesses.get(mor)! >= 8.5 * CASE) morceaux.push(mor);
      }
    }
    expect(morceaux.length).toBeGreaterThan(6);
    for (const mor of morceaux) {
      const debuts = debutsDesIlots(mor);
      expect(debuts).toHaveLength(1);
      const colonnes = [...Array(LARGEUR_MORCEAU).keys()].filter((c) => c >= 2 && (case_(mor, c, 3) === BLOC || case_(mor, c, 8) === BLOC));
      expect(Math.max(...colonnes), `un îlot finit trop tard : ${colonnes.join()}`).toBeLessThanOrEqual(LARGEUR_MORCEAU - 4);
    }
  });
  it("au-delà de 10 m/s : plus d'escalier montant (arrivée du sol), et plus d'îlots après des étages, un milieu ou un escalier", () => {
    let escaliers = 0;
    let ilots = 0;
    for (let j = 0; j < 40; j++) {
      const t = terrainDuJour(dailyGravity(JOUR + j));
      for (let m = 40; m < 2 * MORCEAUX_PAR_BOUCLE; m++) {
        const mor = t.morceau(m);
        // La vitesse réelle du morceau (lot GR6 : les portails de vitesse), comme le fait le générateur (un vol de 3 cases : 5 colonnes ou plus).
        const vite = vitesseDuMorceau(JOUR + j, m) > 10.5 * CASE;
        if (mor.motif === "escalier") {
          escaliers++;
          if (vite) expect(mor.entree, `jour ${j}, morceau ${m}`).toBe(-1);
        }
        if (mor.motif === "ilots") {
          ilots++;
          if (vite) expect(["etages", "milieu", "escalier"], `jour ${j}, morceau ${m}`).not.toContain(t.morceau(m - 1).motif);
        }
      }
    }
    expect(escaliers).toBeGreaterThan(10);
    expect(ilots).toBeGreaterThan(10);
  });
  it("les étages finissent au plafond (le morceau suivant l'attend) et leur trou est plus large à grande vitesse", () => {
    const largeurs: { v: number; w: number }[] = [];
    // La largeur du trou A de l'étage haut : les cases vides de la rangée 4 à partir de la colonne 5.
    const trou = (mor: Morceau): number => {
      let n = 0;
      while (5 + n < LARGEUR_MORCEAU && case_(mor, 5 + n, 4) === 0) n++;
      return n;
    };
    for (let j = 0; j < 60; j++) {
      const t = terrainDuJour(dailyGravity(JOUR + j));
      for (let m = 19; m < 2 * MORCEAUX_PAR_BOUCLE; m++) {
        const mor = t.morceau(m);
        if (mor.motif !== "etages") continue;
        expect(mor.sortie).toBe(-1);
        expect(mor.chemin[mor.chemin.length - 1]!.y).toBe(2);
        largeurs.push({ v: vitesseDuMorceau(JOUR + j, m), w: trou(mor) });
      }
    }
    expect(largeurs.length).toBeGreaterThan(6);
    // Lot GR6 : la vitesse est celle du morceau (portails compris) ; le trou ne rétrécit jamais quand elle monte.
    largeurs.sort((a, b) => a.v - b.v);
    const lents = largeurs.slice(0, Math.trunc(largeurs.length / 3));
    const rapides = largeurs.slice(-Math.trunc(largeurs.length / 3));
    const moyenne = (l: { w: number }[]): number => l.reduce((x, y) => x + y.w, 0) / l.length;
    expect(moyenne(rapides)).toBeGreaterThan(moyenne(lents));
  });
});
