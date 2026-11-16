import { mixSeed, Rng } from "@cdj/core";
import { PINBALL_GENERATOR_VERSION } from "./constantes";
import { TABLES_REFUSEES } from "./refusees";
import { themeDuJour, THEMES_PINBALL, type ThemePinball } from "./themes";

// La table du jour (lot PB1). **Le bas de la table ne change jamais** (deux batteurs, deux lance-pierres, deux couloirs de retour, le couloir du lanceur, les trois couloirs du haut : `table.ts`) ; le haut est tiré
// de la graine du jour : un thème, puis le module de chacun des six emplacements, dans la liste permise de l'emplacement. Le contenu est minuscule (six petits entiers) : le jeu, le serveur et le fichier du jour
// le portent sans coût. **Pure** : la graine vient du numéro de jour civil, jamais d'une horloge. On monte `PINBALL_GENERATOR_VERSION`, jamais une date.

/** Les modules communs (seed « Les modules communs »). */
export const MODULES_COMMUNS = ["bumpers", "mini", "cibles", "spinner", "trou"] as const;
/** Lot PB3 : les éléments propres à un thème. Le manège (foire), le tourbillon (océan), le trou noir, les deux portails et l'astéroïde (espace), le geyser et la coulée (volcan). */
export const MODULES_DE_THEME = ["manege", "tourbillon", "trouNoir", "portailA", "portailB", "asteroide", "geyser", "coulee"] as const;
export const MODULES = [...MODULES_COMMUNS, ...MODULES_DE_THEME] as const;
export type Module = (typeof MODULES)[number];

/** Les six emplacements du haut, leur centre (pixels de la maquette) et la liste des modules COMMUNS permis. `S6` est celui de l'élément du thème. **La liste permise d'un jour dépend du thème : `permisDe`.** */
export const EMPLACEMENTS = [
  { nom: "S1", x: 100, y: 220, permis: ["cibles", "spinner", "mini", "bumpers"] },
  { nom: "S2", x: 184, y: 180, permis: ["bumpers", "mini"] },
  { nom: "S3", x: 270, y: 220, permis: ["cibles", "spinner", "mini"] },
  { nom: "S4", x: 92, y: 385, permis: ["cibles", "trou", "spinner"] },
  { nom: "S5", x: 276, y: 385, permis: ["cibles", "trou", "mini"] },
  { nom: "S6", x: 184, y: 320, permis: ["bumpers", "cibles", "trou", "spinner", "mini"] },
] as const;
export const NB_EMPLACEMENTS = EMPLACEMENTS.length;

/**
 * Les modules permis à un emplacement, selon le thème (lot PB3, la maquette) : S6 est toujours l'élément du thème (le manège ; le tourbillon ; le trou noir ; la coulée) ; l'océan fixe sa pieuvre (le trou) en S5 ;
 * l'espace fixe l'astéroïde en S2 et les deux portails en S4 (A) et S3 (B) ; le volcan peut poser son geyser en S4 ou en S5 (un seul des deux, tiré du jour : `dailyPinball`). Tous les autres piochent dans la liste commune.
 */
export function permisDe(theme: ThemePinball, emplacement: number): readonly Module[] {
  const base = EMPLACEMENTS[emplacement]!.permis as readonly Module[];
  switch (theme) {
    case "foire":
      return emplacement === 5 ? ["manege"] : base;
    case "ocean":
      return emplacement === 5 ? ["tourbillon"] : emplacement === 4 ? ["trou"] : base;
    case "espace":
      return emplacement === 5 ? ["trouNoir"] : emplacement === 1 ? ["asteroide"] : emplacement === 2 ? ["portailB"] : emplacement === 3 ? ["portailA"] : base;
    case "volcan":
      return emplacement === 5 ? ["coulee"] : emplacement === 3 || emplacement === 4 ? [...base, "geyser"] : base;
  }
}

/** La mission du thème (seed « Les thèmes ») : ce qu'il faut faire, et les modules qui comptent pour elle (leur flèche clignote). */
export type Mission = "manege" | "tourbillon" | "portail" | "geyser";
export const MISSION_DU_THEME: Readonly<Record<ThemePinball, Mission>> = { foire: "manege", ocean: "tourbillon", espace: "portail", volcan: "geyser" };
export const MODULES_DE_MISSION: Readonly<Record<Mission, readonly Module[]>> = { manege: ["manege"], tourbillon: ["tourbillon"], portail: ["portailA", "portailB"], geyser: ["geyser"] };

export interface Contenu {
  jour: number;
  /** La version du générateur. */
  g: number;
  theme: ThemePinball;
  /** Le module de chaque emplacement, dans l'ordre de `EMPLACEMENTS`. */
  modules: Module[];
  /** Les seuils des médailles figés avec le jour (rempli quand le contenu vient d'un fichier de jour). */
  seuilsFiges?: { bronze: number; silver: number; gold: number; author: number };
}

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/** Sel de la graine de Pinball (propre au jeu). */
const SEL = 0x50494e;

/** La clé d'une table : son thème et ses six modules. **Le verdict de la validation et les seuils ne dépendent que d'elle** (`validation.ts`, `seuils.ts`), jamais du jour. */
export const cleDeTable = (c: Pick<Contenu, "theme" | "modules">): string => `${c.theme}:${c.modules.join(",")}`;

/** Les tirages possibles d'une graine : le thème imposé ou du jour, puis les modules des six emplacements. */
function tirer(jour: number, essai: number, theme: ThemePinball): Module[] {
  // la graine de l'essai 0 est celle de toujours ; les suivantes (une table refusée est retirée : lot PB4) en dérivent, fixées d'avance
  const rng = new Rng(mixSeed(jour, essai === 0 ? SEL : (SEL ^ Math.imul(essai, 2654435761)) >>> 0));
  // La maquette : S2 est un trio de bumpers trois fois sur quatre, sinon une paire ; les autres piochent dans leur liste commune, dans l'ordre S1, S3, S4, S5. **Les tirages ne dépendent pas du thème** (ils sont faits
  // dans tous les cas, puis l'élément du thème prend sa place) : le volcan tire en plus l'emplacement de son geyser, S4 ou S5.
  const modules: Module[] = Array<Module>(NB_EMPLACEMENTS);
  modules[1] = rng.chance(75) ? "bumpers" : "mini";
  for (const i of [0, 2, 3, 4]) modules[i] = rng.pick<Module>(EMPLACEMENTS[i]!.permis);
  const geyserEn = rng.chance(50) ? 3 : 4;
  for (let i = 0; i < NB_EMPLACEMENTS; i++) {
    const permis = permisDe(theme, i);
    if (permis.length === 1) modules[i] = permis[0]!;
  }
  if (theme === "volcan") modules[geyserEn] = "geyser";
  return modules;
}

/** Combien de graines au plus on essaie pour un jour (aucun jour n'en demande plus de quelques-unes : voir le README du lot PB4). */
export const ESSAIS_MAX = 64;

/** Le contenu d'un jour. Les anciennes versions du générateur restent appelables tant qu'un jour figé les nomme (ici : la courante seulement). */
export function dailyPinball(jour: number, version: number = PINBALL_GENERATOR_VERSION, themeImpose?: ThemePinball): Contenu {
  return dailyPinballAvec(jour, REFUSEES, version, themeImpose);
}

/** `dailyPinball` avec la liste des tables refusées qu'on donne (les tests y posent la leur ; l'outil de validation, aucune). */
export function dailyPinballAvec(jour: number, refusees: ReadonlySet<string>, version: number = PINBALL_GENERATOR_VERSION, themeImpose?: ThemePinball): Contenu {
  if (version !== PINBALL_GENERATOR_VERSION) throw new ErreurGenerateur(`version de générateur inconnue : ${version}`);
  // `themeImpose` : un essai (`?theme=` hors production, jamais classé) joue la table d'un autre thème ce jour-là, avec ses éléments ; le serveur ne l'appelle jamais ainsi.
  const theme = themeImpose ?? themeDuJour(jour);
  // **Une table refusée par la validation est retirée** (lot PB4, `refusees.ts`, produit par `npm run valider:pinball`) : le générateur passe à la graine suivante, fixée.
  for (let essai = 0; essai < ESSAIS_MAX; essai++) {
    const modules = tirer(jour, essai, theme);
    if (!refusees.has(cleDeTable({ theme, modules }))) return { jour, g: version, theme, modules };
  }
  throw new ErreurGenerateur(`aucune table valide en ${ESSAIS_MAX} essais pour le jour ${jour}`);
}
const REFUSEES: ReadonlySet<string> = new Set(TABLES_REFUSEES);

/** **Toutes les tables que le générateur peut tirer** (avant refus) : chaque thème, chaque combinaison de modules permis aux emplacements, le geyser du volcan en S4 ou en S5. 444 tables (216 + 72 + 12 + 144). `jour` vaut 0 : une table de référence. */
export function toutesLesTables(): Contenu[] {
  const sorties: Contenu[] = [];
  for (const theme of THEMES_PINBALL) {
    const choix: (readonly Module[])[] = EMPLACEMENTS.map((e, i) => {
      const fixe = permisDe(theme, i);
      return fixe.length === 1 ? fixe : (e.permis as readonly Module[]);
    });
    const rec = (i: number, acc: Module[]): void => {
      if (i === NB_EMPLACEMENTS) {
        if (theme !== "volcan") sorties.push({ jour: 0, g: PINBALL_GENERATOR_VERSION, theme, modules: [...acc] });
        else {
          // le geyser en S4 (le S5 tiré dans sa liste commune) ou en S5 (le S4 tiré dans la sienne)
          sorties.push({ jour: 0, g: PINBALL_GENERATOR_VERSION, theme, modules: acc.map((m, k) => (k === 3 ? "geyser" : m)) });
          sorties.push({ jour: 0, g: PINBALL_GENERATOR_VERSION, theme, modules: acc.map((m, k) => (k === 4 ? "geyser" : m)) });
        }
        return;
      }
      for (const m of choix[i]!) rec(i + 1, [...acc, m]);
    };
    rec(0, []);
  }
  // le volcan compte deux fois chaque combinaison ; le geyser écrase un emplacement : on garde chaque table une fois
  const vues = new Set<string>();
  return sorties.filter((c) => !vues.has(cleDeTable(c)) && vues.add(cleDeTable(c)));
}

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers) : un texte de huit hexadécimaux. */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  for (const n of [contenu.jour, contenu.g, THEMES_INDEX(contenu.theme), ...contenu.modules.map((m) => MODULES.indexOf(m))]) {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
  }
  return h.toString(16).padStart(8, "0");
}
const THEMES_INDEX = (t: ThemePinball): number => THEMES_PINBALL.indexOf(t);
