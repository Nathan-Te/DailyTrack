import { formatDay, parseDay } from "@cdj/core";
import { estScenario, estTheme, RAMPE_PAR_DEFAUT, type NomScenario, type Rampe, type ThemeBlocks } from "@cdj/blocks-sim";

// Les options d'ESSAI de Blocks, lues dans l'adresse. **Jamais sur la production** (`restreint`, règle R9) :
//   · `?scenario=presque-plein|blocage|plateau-vide|combo` : une grille de départ fixée (seed § 9 ; `combo` : quatre poses qui effacent chacune une ligne) ;
//   · `?theme=port|chantier|canyon|banquise|jungle|nuit` (lot B3) : force le thème (palette de la scène, fonds, nom et phrase de l'accueil) pour les essayer en un clic ; il ne change ni la suite ni le classement ;
//   · `&bot` (lot B3), avec `?seed=AAAA-MM-JJ` : le bot Diamant joue à la place du joueur (`&bot=<n>` : n poses par seconde, de 1 à 30 ; 3 par défaut). **La partie n'est jamais classée** (`classable` de la définition) ;
//   · `?scenario=partage` (lot B4) : l'écran de fin tout de suite, avec un résultat d'exemple (le début de la partie du bot, arrêté dans la bande d'une médaille : `&medaille=aucune|bronze|argent|or|diamant`, argent par défaut)
//     pour essayer la ligne à partager en français et en anglais ;
//   · `?debug&tune` : règle la rampe (`&rampe=<pente>,<rangMax>`, défaut `4,80`). (Le décalage de la pièce au-dessus du doigt n'existe plus depuis B2 : elle reste sous le doigt.)
// Une partie d'essai n'est JAMAIS envoyée : la page est mise en archive (`?seed=` d'un jour passé, que le kit ne classe pas) avant que le kit ne la lise ; la rediffusion d'un scénario nomme le scénario et le
// serveur la refuse. `?seed=AAAA-MM-JJ` (le jour d'une date) est celui du kit.
/** Le résultat d'exemple de `?scenario=partage` : la médaille voulue (« aucune » : un score sous le bronze). */
export type MedailleExemple = "aucune" | "bronze" | "argent" | "or" | "diamant";
export const MEDAILLES_EXEMPLE: readonly MedailleExemple[] = ["aucune", "bronze", "argent", "or", "diamant"];

export interface Essai {
  scenario: NomScenario | null;
  /** La rampe réglée, ou `null` (celle du jeu). */
  rampe: Rampe | null;
  /** `?theme=` : le thème forcé, ou `null` (celui du jour). */
  theme: ThemeBlocks | null;
  /** `&bot` : le bot Diamant joue ; sa vitesse en poses par seconde. `null` : le joueur joue. */
  bot: { vitesse: number } | null;
  /** Lot B4 — `?scenario=partage` (un essai de la partie du jour, jamais classé ; la page n'est pas mise en archive ; lot B5 : `?scenario=fantome` n'existe plus avec le fantôme) ; absent sinon. */
  mode?: "partage";
  /** Lot B4 — pour `partage` : la médaille du résultat d'exemple. */
  exemple?: MedailleExemple;
  /** L'adresse à poser avant que le kit ne la lise (`search`, avec `?`), ou `null` si elle ne change pas. */
  adresse: string | null;
}

/** La vitesse du bot par défaut : environ 3 poses par seconde, lisible. */
export const VITESSE_BOT = 3;
const nombre = (t: string | undefined): number | null => (t !== undefined && /^\d+(\.\d+)?$/.test(t) ? Number(t) : null);

export function lireEssai(search: string, restreint: boolean, aujourdhui: number): Essai {
  const vide: Essai = { scenario: null, rampe: null, theme: null, bot: null, adresse: null };
  if (restreint) return vide;
  const q = new URLSearchParams(search);
  const theme = estTheme(q.get("theme")) ? (q.get("theme") as ThemeBlocks) : null;
  const bot = q.has("bot") ? { vitesse: Math.min(30, Math.max(1, Math.round(nombre(q.get("bot") || undefined) ?? VITESSE_BOT))) } : null;
  const nom = q.get("scenario") ?? "";
  const scenario = estScenario(nom) ? nom : null;
  const mode: "partage" | null = nom === "partage" ? nom : null;
  const voulue = q.get("medaille") ?? "";
  const exemple: MedailleExemple = (MEDAILLES_EXEMPLE as readonly string[]).includes(voulue) ? (voulue as MedailleExemple) : "argent";
  const plus = mode === "partage" ? { mode, exemple } : mode ? { mode } : {};
  const tune = q.has("debug") && q.has("tune");
  let rampe: Rampe | null = null;
  if (tune) {
    const [pente, rangMax] = (q.get("rampe") ?? "").split(",");
    const p = nombre(pente);
    const r = nombre(rangMax);
    if (p !== null || r !== null) rampe = { pente: p ?? RAMPE_PAR_DEFAUT.pente, rangMax: r ?? RAMPE_PAR_DEFAUT.rangMax };
  }
  if (scenario === null && !tune) return { ...vide, theme, bot, ...plus };
  // Archive : un jour passé. Si l'adresse nomme déjà un jour passé, on le garde ; sinon la veille.
  const seed = q.get("seed");
  const jour = seed === null ? null : parseDay(seed);
  let adresse: string | null = null;
  if (jour === null || jour >= aujourdhui) {
    q.set("seed", formatDay(aujourdhui - 1));
    adresse = `?${q.toString()}`;
  }
  return { scenario, rampe, theme, bot, adresse, ...plus };
}
