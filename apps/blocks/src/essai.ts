import { estScenario, type NomScenario, type ReglageSaisi } from "@cdj/blocks-sim";

// Les options d'ESSAI de Blocks, lues dans l'adresse. **Jamais sur la production** (`restreint`, règle R9) :
//   · `?scenario=presque-plein|blocage|plateau-vide|combo|ordre|coup-de-pouce` : une grille de départ fixée (seed § 9 ; `combo` : quatre poses qui effacent chacune une ligne ; lot B8, `ordre` : une série où l'ordre des trois pièces décide de tout — `suivantes`, du lot B7, n'existe plus : plus de pièce suivante ; lot B8c, `coup-de-pouce` : deux lignes attendent chacune une barre de 3, et la série tirée pour cette grille en contient une) ;
//   · (`?theme=` n'est plus ici : le kit le lit pour tous les jeux — `OptionsUrl.theme`, local et jamais classé ; lot « manques de Blocks ».)
//   · `&bot` (lot B3), avec `?seed=AAAA-MM-JJ` : le bot Diamant joue à la place du joueur (`&bot=<n>` : n poses par seconde, de 1 à 30 ; 3 par défaut). **La partie n'est jamais classée** (`classable` de la définition) ;
//   · `?scenario=partage` (lot B4) : l'écran de fin tout de suite, avec un résultat d'exemple (le début de la partie du bot, arrêté dans la bande d'une médaille : `&medaille=aucune|bronze|argent|or|diamant`, argent par défaut)
//     pour essayer la ligne à partager en français et en anglais ;
//   · `?debug&tune` : règle le tirage — `&rampe=<pente>,<rangMax>,<apres>` (défaut `1,80,0.5` : la rampe s'applique au rang de la série), `&essais=<n>` (40), `&posable=<jusqua>,<rang>,<pct>` (l'exigence « série posable » : `25,75,0`), `&pouce=<pct>,<pctFin>,<rang>` (le coup de pouce : `60,30,80`) ; un nombre manquant garde sa valeur. (Le décalage de la pièce au-dessus du doigt n'existe plus depuis B2 : elle reste sous le doigt.)
// Une partie d'essai n'est JAMAIS classée ni envoyée : `classable` de la définition (`definition.ts`) répond `false` pour un scénario, un tirage réglé, `&bot` et `?scenario=partage`, et le kit le dit au joueur
// (« Partie d'essai : non classée ») sans passer la page en archive (lot « manques de Blocks » : l'ancien détour par `?seed=` de la veille n'existe plus) ; la rediffusion d'un scénario nomme le scénario et le serveur la refuse.
// `?seed=AAAA-MM-JJ` (le jour d'une date) est celui du kit.
/** Le résultat d'exemple de `?scenario=partage` : la médaille voulue (« aucune » : un score sous le bronze). */
export type MedailleExemple = "aucune" | "bronze" | "argent" | "or" | "diamant";
export const MEDAILLES_EXEMPLE: readonly MedailleExemple[] = ["aucune", "bronze", "argent", "or", "diamant"];

export interface Essai {
  scenario: NomScenario | null;
  /** Le tirage réglé (`?debug&tune`), ou `null` (celui du jeu). */
  reglage: ReglageSaisi | null;
  /** `&bot` : le bot Diamant joue ; sa vitesse en poses par seconde. `null` : le joueur joue. */
  bot: { vitesse: number } | null;
  /** Lot B4 — `?scenario=partage` (un essai de la partie du jour, jamais classé ; la page n'est pas mise en archive ; lot B5 : `?scenario=fantome` n'existe plus avec le fantôme) ; absent sinon. */
  mode?: "partage";
  /** Lot B4 — pour `partage` : la médaille du résultat d'exemple. */
  exemple?: MedailleExemple;
}

/** La vitesse du bot par défaut : environ 3 poses par seconde, lisible. */
export const VITESSE_BOT = 3;
const nombre = (t: string | undefined): number | null => (t !== undefined && /^\d+(\.\d+)?$/.test(t) ? Number(t) : null);

export function lireEssai(search: string, restreint: boolean): Essai {
  const vide: Essai = { scenario: null, reglage: null, bot: null };
  if (restreint) return vide;
  const q = new URLSearchParams(search);
  const bot = q.has("bot") ? { vitesse: Math.min(30, Math.max(1, Math.round(nombre(q.get("bot") || undefined) ?? VITESSE_BOT))) } : null;
  const nom = q.get("scenario") ?? "";
  const scenario = estScenario(nom) ? nom : null;
  const mode: "partage" | null = nom === "partage" ? nom : null;
  const voulue = q.get("medaille") ?? "";
  const exemple: MedailleExemple = (MEDAILLES_EXEMPLE as readonly string[]).includes(voulue) ? (voulue as MedailleExemple) : "argent";
  const plus = mode === "partage" ? { mode, exemple } : mode ? { mode } : {};
  const reglage = q.has("debug") && q.has("tune") ? lireReglage(q) : null;
  return { scenario, reglage, bot, ...plus };
}

/** Les nombres d'une liste d'adresse (`25,75,0`) : `null` pour un mot qui n'en est pas un ou un trou (`,,0`). */
const nombres = (t: string | null): (number | null)[] => (t ?? "").split(",").map((x) => nombre(x === "" ? undefined : x));
const retenir = <T extends Record<string, number | null>>(o: T): { [K in keyof T]?: number } | null => {
  const propre = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)) as { [K in keyof T]?: number };
  return Object.keys(propre).length > 0 ? propre : null;
};
/** Le réglage du tirage de `?debug&tune` : ce qui n'est pas dit (ou n'est pas un nombre) garde la valeur du jeu ; `null` si rien n'est réglé. */
export function lireReglage(q: URLSearchParams): ReglageSaisi | null {
  const [pente = null, rangMax = null, apres = null] = nombres(q.get("rampe"));
  const [jusqua = null, rang = null, pct = null] = nombres(q.get("posable"));
  const [poucePct = null, pouceFin = null, pouceRang = null] = nombres(q.get("pouce"));
  const essais = nombre(q.get("essais") ?? undefined);
  const rampe = retenir({ pente, rangMax, apres });
  const posable = retenir({ jusqua, rang, pct });
  const pouce = retenir({ pct: poucePct, pctFin: pouceFin, rang: pouceRang });
  const r: ReglageSaisi = { ...(rampe ? { rampe } : {}), ...(essais !== null && essais >= 1 ? { essais: Math.min(400, Math.round(essais)) } : {}), ...(posable ? { posable } : {}), ...(pouce ? { pouce } : {}) };
  return Object.keys(r).length > 0 ? r : null;
}
