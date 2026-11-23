import { PINBALL_GENERATOR_VERSION } from "./constantes";
import { TABLES_REFUSEES } from "./refusees";
import { dispositionDuJour, emplacementsDe, IDS_PLANS, planDe, PLANS, type Plan } from "./plans";
import { themeDuJour, THEMES_PINBALL, type ThemePinball } from "./themes";

// La table du jour (lot PB1). **Le bas de la table ne change jamais** (deux batteurs, deux lance-pierres, deux couloirs de retour, le couloir du lanceur, les trois couloirs du haut : `table.ts`) ; le haut est une des trois
// tables dessinées (lot PBT1 : `plans.ts`). **Le jour tire le thème, puis la table (A, B ou C), puis le miroir** : 6 dispositions × 4 thèmes = 24 tables, plus aucun hasard dans les emplacements. Le contenu est minuscule
// (un thème, une table, un miroir) : le jeu, le serveur et le fichier du jour le portent sans coût. **Pure** : la graine vient du numéro de jour civil, jamais d'une horloge. On monte `PINBALL_GENERATOR_VERSION`, jamais une date.

/** Les modules communs (seed « Les modules communs »). */
export const MODULES_COMMUNS = ["bumpers", "mini", "cibles", "spinner", "trou"] as const;
/** Lot PB3 : les éléments propres à un thème. Le manège (foire), le tourbillon (océan), le trou noir, les deux portails et l'astéroïde (espace), le geyser et la coulée (volcan). */
export const MODULES_DE_THEME = ["manege", "tourbillon", "trouNoir", "portailA", "portailB", "asteroide", "geyser", "coulee"] as const;
export const MODULES = [...MODULES_COMMUNS, ...MODULES_DE_THEME] as const;
export type Module = (typeof MODULES)[number];

/** Lot PBG1 : les emplacements d'un jour sont ceux de son plan (`plans.ts`), et les modules permis à chacun dépendent du thème (`permisDe`). */
/** La mission du thème (seed « Les thèmes ») : ce qu'il faut faire, et les modules qui comptent pour elle (leur flèche clignote). */
export type Mission = "manege" | "tourbillon" | "portail" | "geyser";
export const MISSION_DU_THEME: Readonly<Record<ThemePinball, Mission>> = { foire: "manege", ocean: "tourbillon", espace: "portail", volcan: "geyser" };
export const MODULES_DE_MISSION: Readonly<Record<Mission, readonly Module[]>> = { manege: ["manege"], tourbillon: ["tourbillon"], portail: ["portailA", "portailB"], geyser: ["geyser"] };

export interface Contenu {
  jour: number;
  /** La version du générateur. */
  g: number;
  theme: ThemePinball;
  /** Lot PBT1 : l'identifiant de la table du jour (`PLANS` : A, B ou C). */
  plan: string;
  /** Lot PBT1 : la table est jouée en miroir (gauche-droite). */
  miroir: boolean;
  /** Le module de chaque emplacement de la table dans ce thème (`emplacementsDe`), dans son ordre. */
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

/** La clé d'une table : son thème, sa table (`A` ou `A'` en miroir) et les modules de ses emplacements. **Le verdict de la validation et les seuils ne dépendent que d'elle** (`validation.ts`, `seuils.ts`), jamais du jour. */
export const cleDeTable = (c: Pick<Contenu, "theme" | "plan" | "modules"> & { miroir?: boolean }): string => `${c.theme}:${c.plan}${c.miroir ? "'" : ""}:${c.modules.join(",")}`;

/** Les modules d'une table dans un thème : l'élément du thème, s'il en pose un à l'emplacement, sinon le module de l'emplacement. **Aucun tirage** : une table est dessinée. */
export function modulesDe(plan: Plan, theme: ThemePinball): Module[] {
  return emplacementsDe(plan, theme).map((e) => e.fixe?.[theme] ?? e.permis[0]!);
}

/** Le contenu d'un jour. Les anciennes versions du générateur restent appelables tant qu'un jour figé les nomme (ici : la courante seulement). */
export function dailyPinball(jour: number, version: number = PINBALL_GENERATOR_VERSION, themeImpose?: ThemePinball, planImpose?: string, miroirImpose?: boolean): Contenu {
  return dailyPinballAvec(jour, REFUSEES, version, themeImpose, planImpose, miroirImpose);
}

/** `dailyPinball` avec la liste des tables refusées qu'on donne (les tests y posent la leur ; l'outil de validation, aucune). */
export function dailyPinballAvec(jour: number, refusees: ReadonlySet<string>, version: number = PINBALL_GENERATOR_VERSION, themeImpose?: ThemePinball, planImpose?: string, miroirImpose?: boolean): Contenu {
  if (version !== PINBALL_GENERATOR_VERSION) throw new ErreurGenerateur(`version de générateur inconnue : ${version}`);
  // `themeImpose`, `planImpose`, `miroirImpose` : un essai (`?theme=`, `?plan=`, `?miroir` hors production, jamais classé) joue une autre table ce jour-là ; le serveur ne l'appelle jamais ainsi.
  const theme = themeImpose ?? themeDuJour(jour);
  const d = dispositionDuJour(jour);
  const id = planImpose ?? d.plan;
  const miroir = miroirImpose ?? (planImpose === undefined ? d.miroir : false);
  const plan = planDe(id, miroir);
  const modules = modulesDe(plan, theme);
  // **Plus de graine suivante** : les 24 tables sont dessinées et toutes valides (la liste des refusées est vide, `refusees.ts`) ; une table refusée serait un défaut de dessin, pas un tirage à refaire.
  if (refusees.has(cleDeTable({ theme, plan: id, miroir, modules }))) throw new ErreurGenerateur(`table refusée : ${cleDeTable({ theme, plan: id, miroir, modules })}`);
  return { jour, g: version, theme, plan: id, miroir, modules };
}
const REFUSEES: ReadonlySet<string> = new Set(TABLES_REFUSEES);

/** **Toutes les tables que le générateur peut tirer** : chaque table, de face et en miroir, dans chaque thème (24). `jour` vaut 0 : une table de référence. */
export function toutesLesTables(): Contenu[] {
  const sorties: Contenu[] = [];
  for (const plan of PLANS) {
    for (const miroir of [false, true]) {
      for (const theme of THEMES_PINBALL) sorties.push({ jour: 0, g: PINBALL_GENERATOR_VERSION, theme, plan: plan.id, miroir, modules: modulesDe(planDe(plan.id, miroir), theme) });
    }
  }
  return sorties;
}

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers) : un texte de huit hexadécimaux. */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  for (const n of [contenu.jour, contenu.g, THEMES_INDEX(contenu.theme), IDS_PLANS.indexOf(contenu.plan), contenu.miroir ? 1 : 0, ...contenu.modules.map((m) => MODULES.indexOf(m))]) {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
  }
  return h.toString(16).padStart(8, "0");
}
const THEMES_INDEX = (t: ThemePinball): number => THEMES_PINBALL.indexOf(t);
