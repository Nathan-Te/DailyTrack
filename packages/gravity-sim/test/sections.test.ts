import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import {
  BLOC,
  CASE,
  COLONNE_PORTAIL,
  FACTEUR_DU_PORTAIL,
  LARGEUR_MORCEAU,
  LIGNES,
  MODE_AVION,
  MODE_ONDE,
  MODE_RESSORT,
  MORCEAUX_PAR_THEME,
  PIQUE,
  SECTION_MAX,
  SECTION_MIN,
  dailyGravity,
  difficulte,
  empreinteContenu,
  motifBrut,
  planDuJour,
  reglesDuContenu,
  terrainDuJour,
  vague,
  type Morceau,
} from "../src/index";

// Lot GR6 — **les sections à mode et les portails de vitesse du générateur** : où elles sont, comment elles se composent (portail, couloir libre, motif, retour), l'introduction des modes selon le rang du thème, la facilité
// de la première section de chaque mode, les portails de vitesse (rapides là où l'on respire, lents avant un passage technique). Chaque section a son chemin sûr : le robot la franchit (`franchissabilite*.test.ts`).
const JOUR = daysFromCivil(2026, 11, 17);
const jours = Array.from({ length: 12 }, (_, i) => JOUR + i);
const MOTIFS_DE_MODE = ["avion", "onde", "ressort"];
const modeDuMotif = (m: string): number => MOTIFS_DE_MODE.indexOf(m) + 1;
const contexte = (jour: number): { t: ReturnType<typeof terrainDuJour>; plan: ReturnType<typeof planDuJour> } => {
  const c = dailyGravity(jour);
  return { t: terrainDuJour(c), plan: planDuJour(jour, reglesDuContenu(c)) };
};
const nbMorceaux = 2 * 5 * MORCEAUX_PAR_THEME;
const case_ = (m: Morceau, c: number, r: number): number => m.cases[c * LIGNES + r]!;

describe("l'introduction : le rang du thème décide du premier mode, pas le thème", () => {
  it("la première section du jour est un avion (1er thème), puis une onde (2e), puis un ressort (3e) — facile, sur deux morceaux", () => {
    for (const j of jours) {
      const { plan } = contexte(j);
      const sections = plan.sectionsJusqua(2);
      for (const rang of [0, 1, 2]) {
        const dansLeTheme = sections.filter((s) => Math.trunc(s.premier / MORCEAUX_PAR_THEME) === rang);
        expect(dansLeTheme.length, `jour ${j}, thème ${rang}`).toBeGreaterThan(0);
        expect(dansLeTheme[0]!.mode, `jour ${j}, thème ${rang}`).toBe(rang + 1);
        expect(dansLeTheme[0]!.facile).toBe(true);
        expect(dansLeTheme[0]!.longueur).toBe(SECTION_MIN);
      }
    }
  });
  it("la première section de chaque mode est facile ; ensuite les sections ne le sont plus", () => {
    for (const j of jours) {
      const { plan } = contexte(j);
      const vus = new Set<number>();
      for (const s of plan.sectionsJusqua(9)) {
        expect(s.facile, `jour ${j}, section du morceau ${s.premier}`).toBe(!vus.has(s.mode));
        vus.add(s.mode);
      }
    }
  });
  it("le nombre de morceaux d'une section est de 2 à 4 (plus un morceau de retour)", () => {
    for (const j of jours) for (const s of contexte(j).plan.sectionsJusqua(9)) {
      expect(s.longueur).toBeGreaterThanOrEqual(SECTION_MIN);
      expect(s.longueur).toBeLessThanOrEqual(SECTION_MAX);
    }
  });
  it("les modes se mélangent ensuite : tous les modes reviennent dans la boucle suivante, plus de sections qu'à la première", () => {
    let premiere = 0;
    let seconde = 0;
    const modes = new Set<number>();
    for (const j of jours) {
      for (const s of contexte(j).plan.sectionsJusqua(9)) {
        if (s.premier < 95) premiere++;
        else {
          seconde++;
          modes.add(s.mode);
        }
      }
    }
    expect(seconde).toBeGreaterThan(premiere);
    expect(modes).toEqual(new Set([1, 2, 3]));
  });
  it("jamais deux sections du même mode de suite (quand il y a le choix)", () => {
    for (const j of jours) {
      const sections = contexte(j).plan.sectionsJusqua(9);
      for (let i = 1; i < sections.length; i++) expect(sections[i]!.mode).not.toBe(sections[i - 1]!.mode);
    }
  });
  it("premierMorceauDuMode donne le premier morceau de la première section d'un mode (pour ?mode=)", () => {
    const { plan, t } = contexte(JOUR);
    for (const mode of [MODE_AVION, MODE_ONDE, MODE_RESSORT]) {
      const m = plan.premierMorceauDuMode(mode);
      expect(m).toBeGreaterThan(3);
      expect(modeDuMotif(t.morceau(m).motif)).toBe(mode);
      expect(t.morceau(m).portails.map((p) => p.type)).toContain(MOTIFS_DE_MODE[mode - 1]);
      expect(modeDuMotif(t.morceau(m - 1).motif)).toBe(0);
    }
  });
});

describe("la composition d'une section : portail, couloir libre, motif, retour propre", () => {
  it("le portail d'entrée est dans le premier morceau, celui de retour dans le morceau de retour, jamais ailleurs", () => {
    for (const j of jours) {
      const { t } = contexte(j);
      for (let m = 0; m < nbMorceaux; m++) {
        const mor = t.morceau(m);
        const entrees = mor.portails.filter((p) => MOTIFS_DE_MODE.includes(p.type));
        const retours = mor.portails.filter((p) => p.type === "gravite");
        if (modeDuMotif(mor.motif) > 0 && modeDuMotif(t.morceau(m - 1).motif) !== modeDuMotif(mor.motif)) expect(entrees, `jour ${j}, morceau ${m}`).toEqual([{ c: COLONNE_PORTAIL, type: mor.motif }]);
        else expect(entrees.length, `jour ${j}, morceau ${m}`).toBe(0);
        if (retours.length > 0) {
          expect(modeDuMotif(t.morceau(m - 1).motif), `jour ${j}, morceau ${m} : le retour suit une section`).toBeGreaterThan(0);
          expect(retours).toEqual([{ c: COLONNE_PORTAIL, type: "gravite" }]);
        }
      }
    }
  });
  it("chaque section est suivie d'un morceau de retour : calme, sur le sol, sa gravité à la sortie vers le sol, sans rien de dangereux", () => {
    for (const j of jours) {
      const { t } = contexte(j);
      for (let m = 1; m < nbMorceaux; m++) {
        if (modeDuMotif(t.morceau(m - 1).motif) === 0 || modeDuMotif(t.morceau(m).motif) !== 0) continue;
        const ret = t.morceau(m);
        expect(ret.motif, `jour ${j}, morceau ${m}`).toBe("calme");
        expect(ret.sortie).toBe(1);
        expect(ret.portails.map((p) => p.type)).toContain("gravite");
        for (let c = 0; c < LARGEUR_MORCEAU; c++) for (let r = 2; r < LIGNES - 2; r++) expect(case_(ret, c, r)).toBe(0);
      }
    }
  });
  it("le morceau d'avant une section est calme et finit sur le sol : on entre dans un mode avec la gravité vers le bas", () => {
    for (const j of jours) {
      const { t } = contexte(j);
      for (let m = 1; m < nbMorceaux; m++) {
        const mor = t.morceau(m);
        const premier = modeDuMotif(mor.motif) > 0 && modeDuMotif(t.morceau(m - 1).motif) === 0;
        if (!premier) continue;
        expect(t.morceau(m - 1).sortie, `jour ${j}, avant le morceau ${m}`).toBe(1);
        expect(mor.entree).toBe(1);
      }
    }
  });
  it("le couloir libre : environ 1 s (120 pas) après le portail d'entrée, toute la hauteur est libre", () => {
    for (const j of jours.slice(0, 6)) {
      const { t, plan } = contexte(j);
      for (const mode of [MODE_AVION, MODE_ONDE, MODE_RESSORT]) {
        const m = plan.premierMorceauDuMode(mode);
        const colonnePortail = m * LARGEUR_MORCEAU + COLONNE_PORTAIL;
        const fin = plan.trajectoire.tickOuLeJoueurArrive(colonnePortail * CASE) + 100; // un peu moins d'une seconde
        // Toute colonne que le joueur atteint avant `fin` est libre de la rangée 2 à la rangée 9.
        for (let a = colonnePortail + 1; plan.trajectoire.tickOuLeJoueurArrive(a * CASE) < fin; a++) {
          const mor = t.morceau(Math.trunc(a / LARGEUR_MORCEAU));
          for (let r = 2; r < LIGNES - 2; r++) expect(case_(mor, a % LARGEUR_MORCEAU, r), `jour ${j}, mode ${mode}, colonne ${a}, rangée ${r}`).toBe(0);
        }
      }
    }
  });
  it("aucun bloc spécial de thème dans une section (ni tapis, ni glace, ni cases qui battent, ni inverseur, ni vent) : seulement des blocs, et des piques dans l'onde", () => {
    for (const j of jours) {
      const { t } = contexte(j);
      for (let m = 0; m < nbMorceaux; m++) {
        const mor = t.morceau(m);
        if (modeDuMotif(mor.motif) === 0) continue;
        const types = new Set(mor.cases);
        for (const v of types) expect([0, BLOC, PIQUE], `jour ${j}, morceau ${m} (${mor.motif})`).toContain(v);
        if (mor.motif !== "onde") expect(types.has(PIQUE)).toBe(false);
        expect(mor.decalage).toBe(0);
      }
    }
  });
  it("l'avion : un couloir qui ondule (la hauteur change), des pièces en vague sur l'axe ; l'onde : des piques de chaque côté du couloir ; le ressort : des trous et des colonnes", () => {
    const vus = { avion: new Set<number>(), onde: new Set<number>(), ressort: new Set<string>() };
    for (const j of jours) {
      const { t } = contexte(j);
      for (let m = 0; m < nbMorceaux; m++) {
        const mor = t.morceau(m);
        if (mor.motif === "avion") for (let c = 0; c < LARGEUR_MORCEAU; c++) vus.avion.add(mor.axe[c]!);
        if (mor.motif === "onde") {
          let piques = 0;
          for (const v of mor.cases) if (v === PIQUE) piques++;
          if (piques > 0) vus.onde.add(piques);
        }
        if (mor.motif === "ressort") for (let c = 0; c < LARGEUR_MORCEAU; c++) vus.ressort.add(case_(mor, c, 10) === 0 ? "trou" : case_(mor, c, 9) === BLOC ? "colonne" : "sol");
      }
    }
    expect(vus.avion.size).toBeGreaterThan(2); // l'axe change de hauteur : le couloir ondule
    expect(vus.onde.size).toBeGreaterThan(0);
    expect(vus.ressort).toEqual(new Set(["trou", "colonne", "sol"]));
  });
  it("les pièces d'une section d'avion et d'onde sont posées sur l'axe : le pilote du robot les suit", () => {
    for (const j of jours.slice(0, 4)) {
      const { t } = contexte(j);
      for (let m = 0; m < nbMorceaux; m++) {
        const mor = t.morceau(m);
        if (mor.motif !== "avion" && mor.motif !== "onde") continue;
        for (const p of mor.pieces) {
          const c = Math.trunc(p.x / CASE) - m * LARGEUR_MORCEAU;
          expect(p.y, `jour ${j}, morceau ${m}, colonne ${c}`).toBe(mor.axe[c]);
        }
      }
    }
  });
  it("l'axe d'une section est toujours dans l'écran et libre (le centre du couloir n'est jamais dans un bloc)", () => {
    for (const j of jours) {
      const { t } = contexte(j);
      for (let m = 0; m < nbMorceaux; m++) {
        const mor = t.morceau(m);
        if (modeDuMotif(mor.motif) === 0 || mor.motif === "ressort") continue;
        expect(mor.axe).toHaveLength(LARGEUR_MORCEAU);
        for (let c = 0; c < LARGEUR_MORCEAU; c++) {
          const r = Math.trunc(mor.axe[c]! / CASE);
          expect(r).toBeGreaterThanOrEqual(2);
          expect(r).toBeLessThanOrEqual(9);
          expect(case_(mor, c, r), `jour ${j}, morceau ${m}, colonne ${c}`).toBe(0);
        }
      }
    }
  });
});

describe("les portails de vitesse", () => {
  it("ils arrivent dès le 2e thème (jamais dans le premier), dans des morceaux de gravité, jamais dans une section ni son retour", () => {
    let total = 0;
    for (const j of jours) {
      const { t } = contexte(j);
      for (let m = 0; m < nbMorceaux; m++) {
        const vit = t.morceau(m).portails.filter((p) => FACTEUR_DU_PORTAIL[p.type] !== undefined);
        if (vit.length === 0) continue;
        total++;
        expect(m, `jour ${j}`).toBeGreaterThanOrEqual(MORCEAUX_PAR_THEME);
        expect(vit).toHaveLength(1);
        expect(modeDuMotif(t.morceau(m).motif)).toBe(0);
        expect(t.morceau(m).portails.filter((p) => !FACTEUR_DU_PORTAIL[p.type])).toEqual([]);
      }
    }
    expect(total).toBeGreaterThan(20);
  });
  it("rapides là où l'on respire, lents avant un passage technique (ou avant une onde)", () => {
    const TECHNIQUES = ["zigzag", "milieu", "escalier", "etages", "inverseur", "ilots", "special"];
    let lents = 0;
    let rapides = 0;
    for (const j of jours) {
      const { t, plan } = contexte(j);
      for (let m = MORCEAUX_PAR_THEME; m < nbMorceaux; m++) {
        const vit = plan.info(m).vitesse;
        if (!vit) continue;
        const technique = TECHNIQUES.includes(motifBrut(j, m, difficulte(m, plan.regles)));
        const avantOnde = plan.info(m).avantSection && modeDuMotif(t.morceau(m + 1).motif) === MODE_ONDE;
        if (vit === "lent") {
          lents++;
          expect(technique || avantOnde, `jour ${j}, morceau ${m} : lent sans passage technique`).toBe(true);
        } else {
          rapides++;
          expect(technique || avantOnde, `jour ${j}, morceau ${m} : rapide devant un passage technique`).toBe(false);
        }
      }
    }
    expect(lents).toBeGreaterThan(5);
    expect(rapides).toBeGreaterThan(5);
  });
  it("jamais deux fois le même facteur de suite, et le facteur d'entrée d'un morceau est celui du dernier portail", () => {
    for (const j of jours.slice(0, 4)) {
      const { plan } = contexte(j);
      let courant = 100;
      for (let m = 0; m < nbMorceaux; m++) {
        const i = plan.info(m);
        expect(i.facteurEntree).toBe(courant);
        if (i.vitesse) {
          expect(FACTEUR_DU_PORTAIL[i.vitesse]).not.toBe(courant);
          courant = FACTEUR_DU_PORTAIL[i.vitesse]!;
        }
      }
    }
  });
  it("la trajectoire de la caméra du plan est plus rapide quand le facteur monte (le générateur pose ses surfaces à la vitesse réelle)", () => {
    const { plan } = contexte(JOUR);
    const t = plan.trajectoire;
    expect(t.tickOuLeJoueurArrive(0)).toBe(0);
    let avant = -1;
    for (let c = 8; c < 1500; c += 16) {
      const tick = t.tickOuLeJoueurArrive(c * CASE);
      expect(tick).toBeGreaterThan(avant);
      avant = tick;
    }
  });
});

describe("le générateur reste pur", () => {
  it("le même jour, le même contenu et la même empreinte, sections et portails compris", () => {
    expect(empreinteContenu(dailyGravity(JOUR))).toBe(empreinteContenu(dailyGravity(JOUR)));
    expect(vague(0)).toBe(0);
    expect(vague(256)).toBe(4096);
    expect(vague(768)).toBe(-4096);
    expect(vague(1024 + 100)).toBe(vague(100));
  });
  it("tous les jours ont leurs trois modes dans la première boucle", () => {
    for (let i = 0; i < 40; i++) {
      const { t } = contexte(JOUR + i);
      const modes = new Set<number>();
      for (let m = 0; m < 95; m++) modes.add(modeDuMotif(t.morceau(m).motif));
      expect(modes, `jour ${i}`).toEqual(new Set([0, 1, 2, 3]));
    }
  });
});
