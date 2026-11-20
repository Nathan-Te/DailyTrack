import { mixSeed, Rng } from "@cdj/core";
import { PINBALL_GENERATOR_VERSION } from "./constantes";
import { TABLES_REFUSEES } from "./refusees";
import { IDS_PLANS, permisDe, planDe, planDuJour, PLANS, PLANS_ESSAI, type Plan } from "./plans";
import { themeDuJour, THEMES_PINBALL, type ThemePinball } from "./themes";

// La table du jour (lot PB1). **Le bas de la table ne change jamais** (deux batteurs, deux lance-pierres, deux couloirs de retour, le couloir du lanceur, les trois couloirs du haut : `table.ts`) ; le haut est tiré
// de la graine du jour : **un thème, puis un plan (lot PBG1 : `plans.ts`), puis le module de chaque emplacement du plan**, dans la liste permise de l'emplacement. Le contenu est minuscule (un thème, un plan, quelques
// petits entiers) : le jeu, le serveur et le fichier du jour le portent sans coût. **Pure** : la graine vient du numéro de jour civil, jamais d'une horloge. On monte `PINBALL_GENERATOR_VERSION`, jamais une date.

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
  /** Lot PBG1 : l'identifiant du plan du jour (`PLANS`). */
  plan: string;
  /** Le module de chaque emplacement du plan, dans son ordre. */
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

/** La clé d'une table : son thème, son plan et les modules de ses emplacements. **Le verdict de la validation et les seuils ne dépendent que d'elle** (`validation.ts`, `seuils.ts`), jamais du jour. */
export const cleDeTable = (c: Pick<Contenu, "theme" | "plan" | "modules">): string => `${c.theme}:${c.plan}:${c.modules.join(",")}`;

/** Les tirages possibles d'une graine : le thème imposé ou du jour et le plan, puis les modules des emplacements du plan. */
function tirer(jour: number, essai: number, theme: ThemePinball, plan: Plan): Module[] {
  // la graine de l'essai 0 est celle de toujours ; les suivantes (une table refusée est retirée : lot PB4) en dérivent, fixées d'avance
  const rng = new Rng(mixSeed(jour, essai === 0 ? SEL : (SEL ^ Math.imul(essai, 2654435761)) >>> 0));
  // **Les tirages ne dépendent pas du thème** : chaque emplacement qui a le choix pioche dans sa liste (répéter un module le rend plus probable), puis l'élément du thème prend sa place (`fixe`) ; le thème qui a un
  // élément à poser à l'un de plusieurs emplacements (le geyser du volcan) le tire en plus.
  const modules: Module[] = plan.emplacements.map((e) => (new Set(e.permis).size > 1 ? rng.pick<Module>(e.permis) : e.permis[0]!));
  const candidats = plan.emplacements.flatMap((e, i) => (e.optionnel?.[theme] ? [i] : []));
  const choisi = candidats.length > 0 ? candidats[rng.int(candidats.length)]! : -1;
  plan.emplacements.forEach((e, i) => {
    const fixe = e.fixe?.[theme];
    if (fixe) modules[i] = fixe;
    else if (i === choisi) modules[i] = e.optionnel![theme]!;
  });
  return modules;
}

/** Combien de graines au plus on essaie pour un jour (aucun jour n'en demande plus de quelques-unes : voir le README du lot PB4). */
export const ESSAIS_MAX = 64;

/** Le contenu d'un jour. Les anciennes versions du générateur restent appelables tant qu'un jour figé les nomme (ici : la courante seulement). */
export function dailyPinball(jour: number, version: number = PINBALL_GENERATOR_VERSION, themeImpose?: ThemePinball, planImpose?: string): Contenu {
  return dailyPinballAvec(jour, REFUSEES, version, themeImpose, planImpose);
}

/** `dailyPinball` avec la liste des tables refusées qu'on donne (les tests y posent la leur ; l'outil de validation, aucune). */
export function dailyPinballAvec(jour: number, refusees: ReadonlySet<string>, version: number = PINBALL_GENERATOR_VERSION, themeImpose?: ThemePinball, planImpose?: string): Contenu {
  if (version !== PINBALL_GENERATOR_VERSION) throw new ErreurGenerateur(`version de générateur inconnue : ${version}`);
  // `themeImpose` : un essai (`?theme=` hors production, jamais classé) joue la table d'un autre thème ce jour-là, avec ses éléments ; le serveur ne l'appelle jamais ainsi.
  const theme = themeImpose ?? themeDuJour(jour);
  // lot PBG1 : `planImpose` (essai `?plan=`, jamais classé) joue ce plan-là ce jour-là ; le serveur ne l'appelle jamais ainsi
  const plan = planImpose === undefined ? planDuJour(jour) : planDe(planImpose);
  // **Une table refusée par la validation est retirée** (lot PB4, `refusees.ts`, produit par `npm run valider:pinball`) : le générateur passe à la graine suivante, fixée.
  for (let essai = 0; essai < ESSAIS_MAX; essai++) {
    const modules = tirer(jour, essai, theme, plan);
    if (!refusees.has(cleDeTable({ theme, plan: plan.id, modules }))) return { jour, g: version, theme, plan: plan.id, modules };
  }
  throw new ErreurGenerateur(`aucune table valide en ${ESSAIS_MAX} essais pour le jour ${jour}`);
}
const REFUSEES: ReadonlySet<string> = new Set(TABLES_REFUSEES);

/** **Toutes les tables que le générateur peut tirer** (avant refus) : chaque plan, chaque thème, chaque combinaison de modules permis aux emplacements, le geyser du volcan à chacun de ses emplacements possibles. `jour` vaut 0 : une table de référence. */
export function toutesLesTables(): Contenu[] {
  const sorties: Contenu[] = [];
  for (const plan of PLANS) {
    for (const theme of THEMES_PINBALL) {
      const choix = plan.emplacements.map((_, i) => permisDe(theme, plan, i));
      const candidats = plan.emplacements.flatMap((e, i) => (e.optionnel?.[theme] ? [i] : []));
      const rec = (i: number, acc: Module[]): void => {
        if (i === plan.emplacements.length) {
          if (candidats.length === 0) sorties.push({ jour: 0, g: PINBALL_GENERATOR_VERSION, theme, plan: plan.id, modules: [...acc] });
          else for (const c of candidats) sorties.push({ jour: 0, g: PINBALL_GENERATOR_VERSION, theme, plan: plan.id, modules: acc.map((m, k) => (k === c ? plan.emplacements[k]!.optionnel![theme]! : m)) });
          return;
        }
        // l'emplacement du geyser peut porter le geyser ou, quand c'est un autre qui le porte, un module commun : on énumère les modules communs seulement
        const liste = choix[i]!.filter((m) => !(candidats.length > 0 && plan.emplacements[i]!.optionnel?.[theme] === m));
        for (const m of liste) rec(i + 1, [...acc, m]);
      };
      rec(0, []);
    }
  }
  // le geyser écrase un emplacement : on garde chaque table une fois
  const vues = new Set<string>();
  return sorties.filter((c) => !vues.has(cleDeTable(c)) && vues.add(cleDeTable(c)));
}

/** **Les tables d'un plan** : celles que le générateur peut tirer pour un plan du jour (`toutesLesTables`), ou — un plan d'essai du lot PBT0 (`t1`…`t6`, ou son miroir `t1m`…) — sa table dans chacun des quatre thèmes (les modules d'un plan d'essai sont fixes). */
export function tablesDuPlan(plan: string): Contenu[] {
  if (IDS_PLANS.includes(plan)) return toutesLesTables().filter((c) => c.plan === plan);
  return THEMES_PINBALL.map((theme) => dailyPinball(0, undefined, theme, plan));
}

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers) : un texte de huit hexadécimaux. */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  for (const n of [contenu.jour, contenu.g, THEMES_INDEX(contenu.theme), rangDuPlan(contenu.plan), ...contenu.modules.map((m) => MODULES.indexOf(m))]) {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
  }
  return h.toString(16).padStart(8, "0");
}
/** Le rang d'un plan dans l'empreinte : celui du jour dans `IDS_PLANS` (inchangé), 100 + son rang pour un plan d'essai du lot PBT0 (`t1` à `t6`), 150 + son rang pour son miroir ; −1 sinon. */
const rangDuPlan = (id: string): number => {
  const i = IDS_PLANS.indexOf(id);
  if (i >= 0) return i;
  const miroir = id.endsWith("m");
  const j = PLANS_ESSAI.findIndex((p) => p.id === (miroir ? id.slice(0, -1) : id));
  return j < 0 ? -1 : 100 + j + (miroir ? 50 : 0);
};
const THEMES_INDEX = (t: ThemePinball): number => THEMES_PINBALL.indexOf(t);
