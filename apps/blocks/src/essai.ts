import { formatDay, parseDay } from "@cdj/core";
import { estScenario, RAMPE_PAR_DEFAUT, type NomScenario, type Rampe } from "@cdj/blocks-sim";

// Les options d'ESSAI de Blocks, lues dans l'adresse. **Jamais sur la production** (`restreint`, règle R9) :
//   · `?scenario=presque-plein|blocage|plateau-vide|combo` : une grille de départ fixée (seed § 9 ; `combo` : quatre poses qui effacent chacune une ligne) ;
//   · `?debug&tune` : règle la rampe (`&rampe=<pente>,<rangMax>`, défaut `4,80`). (Le décalage de la pièce au-dessus du doigt n'existe plus depuis B2 : elle reste sous le doigt.)
// Une partie d'essai n'est JAMAIS envoyée : la page est mise en archive (`?seed=` d'un jour passé, que le kit ne classe pas) avant que le kit ne la lise ; la rediffusion d'un scénario nomme le scénario et le
// serveur la refuse. `?seed=AAAA-MM-JJ` (le jour d'une date) est celui du kit.
export interface Essai {
  scenario: NomScenario | null;
  /** La rampe réglée, ou `null` (celle du jeu). */
  rampe: Rampe | null;
  /** L'adresse à poser avant que le kit ne la lise (`search`, avec `?`), ou `null` si elle ne change pas. */
  adresse: string | null;
}

const nombre = (t: string | undefined): number | null => (t !== undefined && /^\d+(\.\d+)?$/.test(t) ? Number(t) : null);

export function lireEssai(search: string, restreint: boolean, aujourdhui: number): Essai {
  const vide: Essai = { scenario: null, rampe: null, adresse: null };
  if (restreint) return vide;
  const q = new URLSearchParams(search);
  const nom = q.get("scenario") ?? "";
  const scenario = estScenario(nom) ? nom : null;
  const tune = q.has("debug") && q.has("tune");
  let rampe: Rampe | null = null;
  if (tune) {
    const [pente, rangMax] = (q.get("rampe") ?? "").split(",");
    const p = nombre(pente);
    const r = nombre(rangMax);
    if (p !== null || r !== null) rampe = { pente: p ?? RAMPE_PAR_DEFAUT.pente, rangMax: r ?? RAMPE_PAR_DEFAUT.rangMax };
  }
  if (scenario === null && !tune) return vide;
  // Archive : un jour passé. Si l'adresse nomme déjà un jour passé, on le garde ; sinon la veille.
  const seed = q.get("seed");
  const jour = seed === null ? null : parseDay(seed);
  let adresse: string | null = null;
  if (jour === null || jour >= aujourdhui) {
    q.set("seed", formatDay(aujourdhui - 1));
    adresse = `?${q.toString()}`;
  }
  return { scenario, rampe, adresse };
}
