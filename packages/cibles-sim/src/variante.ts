import { DELAI_BOT, DUREE_TICKS, NB_CIBLES, TICKS_PAR_SECONDE } from "./constantes";
import type { Contenu } from "./generateur";
import type { Resultat, Touche } from "./partie";

// **LA VARIANTE — le seul endroit où « Cibles » sait qu'un jeu se classe au score ou au temps** (lot K4g ; `npm run nouveau-jeu -- --classement score|temps` copie ce jeu et ne change que `VARIANTE_NOM`, la fiche
// et le texte visible). Tout ce qui diffère d'une variante à l'autre est ICI, jamais ailleurs dans le code du jeu :
//   · `score`  (« Cibles ») : 30 s, chaque cible reste visible un temps compté et disparaît ; on classe les cibles touchées (↓), puis le tick de la dernière touche (↑).
//   · `temps`  : les 20 cibles restent là jusqu'à être touchées, la suivante apparaît tout de suite ; on classe le temps pour toutes les toucher (↑). 30 s au plus : une partie inachevée vaut 30,00 s (le pire temps).
// Ce que la variante décide : la règle de la partie (`visible`, `finie`), le score rendu (`score`), les colonnes, l'unité et le barème de la fiche (`fiche`, vérifié contre `config/jeux/<id>.json` par
// `test/variante.test.ts`), le bot (`touchesDuBot`), les seuils et la médaille, le joueur scripté des tests et des essais (`joueur`), les textes du score (`formatScore`, `scorePartage`, `hud`).
// Ajouter une variante = un objet de plus ici, un test dans `test/variante.test.ts`. Le reste du code (rendu, définition, serveur, essais, e2e) ne lit que `VARIANTE`.

export type NomVariante = "score" | "temps";
export type Medaille = "author" | "gold" | "silver" | "bronze";
export interface Seuils {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}
/** Ce que la règle lit de la partie en cours. */
export interface Etat {
  readonly contenu: Contenu;
  readonly tick: number;
  /** Les cibles déjà touchées (dans l'ordre du contenu). */
  readonly prises: readonly boolean[];
  /** Le tick de la dernière touche réussie, −1 tant qu'il n'y en a pas. */
  readonly dernierTick: number;
}
export interface FicheVariante {
  colonnes: readonly { nom: string; sens: "asc" | "desc" }[];
  unite: "points" | "ticks";
  format: "entier" | "temps";
  bareme: readonly number[];
  plafondDiamant?: number;
}
export interface Variante {
  nom: NomVariante;
  /** Ce que la fiche dit du classement et des médailles. */
  fiche: FicheVariante;
  /** Le rang de la cible visible à ce tick, ou −1. */
  visible(e: Etat): number;
  finie(e: Etat): boolean;
  /** Le score : les colonnes de classement, dans l'ordre de la fiche. */
  score(r: Pick<Resultat, "touches" | "dernier">): number[];
  /** Les touches du bot de l'auteur (le Diamant). */
  touchesDuBot(c: Contenu): Touche[];
  /** Les seuils, d'après la partie du bot. */
  seuils(bot: Pick<Resultat, "touches" | "dernier">): Seuils;
  medaille(score: readonly number[], s: Seuils): Medaille | null;
  /** Un joueur scripté : il touche chaque cible `delai(rang)` ticks après son apparition ; `rate(rang)` : il la laisse filer (`score`) ou hésite et perd 10 ticks (`temps`). Les tests, le golden et les essais s'en servent. */
  joueur(c: Contenu, delai: (rang: number) => number, rate?: (rang: number) => boolean): Touche[];
  /** Le joueur lent du golden. */
  joueurLent(c: Contenu): Touche[];
  /** La part de temps qu'il reste à la cible visible (l'anneau qui se resserre), de 0 à 1. */
  fraction(e: Etat, rang: number): number;
  /** Ce que la bande du haut montre. */
  hud(touches: number, tick: number): { principal: string; secondaire: string };
  formatScore(score: readonly number[], langue: "fr" | "en"): string;
  scorePartage(score: readonly number[], langue: "fr" | "en"): string;
}

const idiv = (a: number, b: number): number => Math.trunc(a / b);
const nbPrises = (e: Etat): number => e.prises.filter(Boolean).length;
const minutes = (ticks: number): string => `0:${String(Math.max(0, Math.ceil(ticks / TICKS_PAR_SECONDE))).padStart(2, "0")}`;
const secondes = (ticks: number, langue: "fr" | "en"): string => {
  const s = (ticks / TICKS_PAR_SECONDE).toFixed(2);
  return `${langue === "fr" ? s.replace(".", ",") : s} s`;
};

// @variante score
const SCORE: Variante = {
  nom: "score",
  fiche: { colonnes: [{ nom: "touches", sens: "desc" }, { nom: "dernier", sens: "asc" }], unite: "points", format: "entier", bareme: [50, 30, 15], plafondDiamant: NB_CIBLES },
  visible: (e) => e.contenu.cibles.findIndex((x, i) => !e.prises[i] && e.tick >= x.d && e.tick < x.f),
  finie: (e) => e.tick >= DUREE_TICKS,
  score: (r) => [r.touches, r.dernier],
  touchesDuBot: (c) => c.cibles.map((x) => ({ tick: x.d + DELAI_BOT, c: x.c })),
  seuils(bot) {
    const author = Math.min(bot.touches, NB_CIBLES);
    return { author, gold: idiv(author * 50, 100), silver: idiv(author * 30, 100), bronze: idiv(author * 15, 100) };
  },
  medaille(score, s) {
    for (const m of ["author", "gold", "silver", "bronze"] as const) if ((score[0] ?? 0) >= s[m]) return m;
    return null;
  },
  joueur: (c, delai, rate = () => false) =>
    c.cibles.flatMap((x, i) => {
      const filee = rate(i); // l'ordre des appels est fixe (le hasard des essais en dépend) : la cible filée, puis son délai
      const d = delai(i);
      return filee ? [] : [{ tick: x.d + d, c: x.c }];
    }),
  joueurLent(c) {
    // Un joueur qui réagit en 14 à 24 ticks, rate une cible sur quatre et tape à côté une fois sur trois.
    const t: Touche[] = [];
    c.cibles.forEach((x, i) => {
      if (i % 4 === 3) return;
      if (i % 3 === 0) t.push({ tick: x.d + 5, c: (x.c + 1) % 48 });
      t.push({ tick: x.d + 14 + (i % 11), c: x.c });
    });
    return t.sort((a, b) => a.tick - b.tick);
  },
  fraction: (e, rang) => (e.contenu.cibles[rang]!.f - e.tick) / (e.contenu.cibles[rang]!.f - e.contenu.cibles[rang]!.d),
  hud: (touches, tick) => ({ principal: `${touches} / ${NB_CIBLES}`, secondaire: minutes(DUREE_TICKS - tick) }),
  formatScore: (score) => `${score[0] ?? 0} / ${NB_CIBLES}`,
  scorePartage: (score) => `${score[0] ?? 0}/${NB_CIBLES}`,
};
// @fin score

// @variante temps
const TEMPS: Variante = {
  nom: "temps",
  fiche: { colonnes: [{ nom: "temps", sens: "asc" }], unite: "ticks", format: "temps", bareme: [130, 160, 200] },
  // La cible suivante apparaît le tick après la touche de la précédente (jamais deux touches dans le même tick).
  visible: (e) => (e.dernierTick < e.tick && nbPrises(e) < NB_CIBLES ? nbPrises(e) : -1),
  finie: (e) => e.tick >= DUREE_TICKS || nbPrises(e) >= NB_CIBLES,
  // Toutes les cibles touchées : le temps de la dernière touche (le tick compte) ; sinon le pire temps, 30 s.
  score: (r) => [r.touches >= NB_CIBLES ? r.dernier + 1 : DUREE_TICKS],
  touchesDuBot(c) {
    let tick = DELAI_BOT;
    return c.cibles.map((x) => {
      const t = { tick, c: x.c };
      tick += DELAI_BOT + 1;
      return t;
    });
  },
  seuils(bot) {
    const author = TEMPS.score(bot)[0]!;
    return { author, gold: idiv(author * 130, 100), silver: idiv(author * 160, 100), bronze: idiv(author * 200, 100) };
  },
  medaille(score, s) {
    for (const m of ["author", "gold", "silver", "bronze"] as const) if ((score[0] ?? DUREE_TICKS) <= s[m]) return m;
    return null;
  },
  joueur(c, delai, rate = () => false) {
    const t: Touche[] = [];
    let libre = 0; // le premier tick où la cible suivante est visible
    c.cibles.forEach((x, i) => {
      const hesite = rate(i);
      let tick = libre + delai(i);
      if (hesite) {
        t.push({ tick, c: (x.c + 1) % 48 }); // une touche à côté : ignorée
        tick += 10;
      }
      t.push({ tick, c: x.c });
      libre = tick + 1;
    });
    return t;
  },
  joueurLent: (c) => TEMPS.joueur(c, (i) => 14 + (i % 11), (i) => i % 4 === 3),
  fraction: () => 1,
  hud: (touches, tick) => ({ principal: `${touches} / ${NB_CIBLES}`, secondaire: `0:${String(Math.floor(tick / TICKS_PAR_SECONDE)).padStart(2, "0")}` }),
  formatScore: (score, langue) => secondes(score[0] ?? DUREE_TICKS, langue),
  scorePartage: (score, langue) => secondes(score[0] ?? DUREE_TICKS, langue),
};
// @fin temps

export const VARIANTES: Readonly<Record<NomVariante, Variante>> = { score: SCORE, temps: TEMPS };
/** **La variante de ce jeu.** `npm run nouveau-jeu -- --classement temps` change cette seule ligne (et la fiche). */
export const VARIANTE_NOM: NomVariante = "score";
export const VARIANTE: Variante = VARIANTES[VARIANTE_NOM];

/** Le score d'un résultat rejoué, par nom de colonne de la fiche : ce que le serveur classe. */
export function scoreParColonnes(r: Pick<Resultat, "touches" | "dernier">, v: Variante = VARIANTE): Record<string, number> {
  const s = v.score(r);
  return Object.fromEntries(v.fiche.colonnes.map((c, i) => [c.nom, s[i]!]));
}
