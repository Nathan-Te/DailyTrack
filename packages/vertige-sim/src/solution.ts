import { T_ARRIERE, T_AVANT, T_DASH, T_DROITE, T_GAUCHE, T_SAUT, TOUR } from "./constantes";
import type { Commande } from "./course";
import { idiv } from "./trigo";

// Le petit langage de solution (lot V2) : on n'a pas de main pour jouer à la souris, alors les solutions des modules s'ÉCRIVENT, puis se vérifient en les rejouant. Un texte d'instructions séparées par `;` ou par
// des sauts de ligne (`#` commence un commentaire), qui se compile en commandes entières (touches tenues et regard de chaque pas de 1/120 s) — celles qu'une rediffusion porte. Le joueur part en COURSE : la touche
// « avant » est tenue au départ (l'état de jonction canonique : au sol, en course, le regard dans l'axe).
//   cours N [+touche…]   N pas, « avant » tenue (plus les touches de côté nommées) ; la tenue reste ensuite
//   attends N [+touche…] N pas sans « avant » (seulement les touches nommées) ; la tenue reste ensuite
//   saute                un pas avec la touche de saut, les touches tenues inchangées
//   dash                 un pas avec la touche de dash
//   tourne D [N]         tourne le regard de D degrés (positif : vers la gauche) en N pas (12 par défaut, soit 0,1 s) ; D est un entier, 90 est exactement un quart de tour
//   Les touches : `+gauche`, `+droite`, `+arriere`, `+avant`.
// Exemple : « cours 40 ; saute ; cours 70 ; tourne 90 ; cours 30 ».
export const PAS_PAR_VIRAGE = 12;

const TOUCHES: Record<string, number> = { avant: T_AVANT, arriere: T_ARRIERE, gauche: T_GAUCHE, droite: T_DROITE };

export class ErreurSolution extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurSolution";
  }
}

export interface Instruction {
  nom: "cours" | "attends" | "saute" | "dash" | "tourne";
  n: number;
  /** Les touches de côté ou d'arrière ajoutées (bits `T_*`). */
  touches: number;
  /** Les degrés d'un virage. */
  degres: number;
  texte: string;
}

/** Le texte → les instructions, ou une `ErreurSolution` qui dit laquelle ne se lit pas. */
export function lireSolution(texte: string): Instruction[] {
  const out: Instruction[] = [];
  for (const brut of texte.replace(/#[^\n]*/g, "").split(/[;\n]/)) {
    const mots = brut.trim().split(/\s+/).filter(Boolean);
    if (mots.length === 0) continue;
    const t = mots.join(" ");
    const nom = mots[0]!;
    let touches = 0;
    const nombres: number[] = [];
    for (const m of mots.slice(1)) {
      if (m.startsWith("+")) {
        const b = TOUCHES[m.slice(1)];
        if (b === undefined) throw new ErreurSolution(`touche inconnue dans « ${t} »`);
        touches |= b;
      } else if (/^-?\d+$/.test(m)) nombres.push(Number(m));
      else throw new ErreurSolution(`mot inconnu « ${m} » dans « ${t} »`);
    }
    if (nom === "cours" || nom === "attends") {
      if (nombres.length !== 1 || nombres[0]! < 1) throw new ErreurSolution(`« ${t} » : un nombre de pas (au moins 1) est attendu`);
      out.push({ nom, n: nombres[0]!, touches, degres: 0, texte: t });
    } else if (nom === "saute" || nom === "dash") {
      if (nombres.length > 0 || touches !== 0) throw new ErreurSolution(`« ${t} » : « ${nom} » ne prend rien`);
      out.push({ nom, n: 1, touches: 0, degres: 0, texte: t });
    } else if (nom === "tourne") {
      if (nombres.length < 1 || nombres.length > 2 || (nombres[1] !== undefined && nombres[1] < 1)) throw new ErreurSolution(`« ${t} » : « tourne D [N] » est attendu`);
      out.push({ nom, n: nombres[1] ?? PAS_PAR_VIRAGE, touches, degres: nombres[0]!, texte: t });
    } else throw new ErreurSolution(`instruction inconnue « ${nom} »`);
  }
  return out;
}

/** Les degrés en angle de la simulation (1/65 536 de tour) : exact pour les multiples de 90°, arrondi vers zéro sinon. */
export const angleDe = (degres: number): number => idiv(degres * TOUR, 360);

/** Les instructions → une commande par pas. */
export function compiler(instructions: readonly Instruction[]): Commande[] {
  const out: Commande[] = [];
  let tenues = T_AVANT;
  for (const i of instructions) {
    if (i.nom === "cours") {
      tenues = T_AVANT | i.touches;
      for (let k = 0; k < i.n; k++) out.push({ k: tenues, dl: 0, dt: 0 });
    } else if (i.nom === "attends") {
      tenues = i.touches;
      for (let k = 0; k < i.n; k++) out.push({ k: tenues, dl: 0, dt: 0 });
    } else if (i.nom === "saute") out.push({ k: tenues | T_SAUT, dl: 0, dt: 0 });
    else if (i.nom === "dash") out.push({ k: tenues | T_DASH, dl: 0, dt: 0 });
    else {
      // Le total est réparti sur N pas : le pas k porte ce qu'il faut pour que la somme soit exactement `total` (aucun reste perdu).
      const total = angleDe(i.degres);
      for (let k = 0; k < i.n; k++) out.push({ k: tenues | i.touches, dl: idiv(total * (k + 1), i.n) - idiv(total * k, i.n), dt: 0 });
    }
  }
  return out;
}

/** Un texte de solution → ses commandes. */
export const commandesDe = (texte: string): Commande[] => compiler(lireSolution(texte));

/** Le nombre de pas d'un texte de solution (sans le compiler). */
export const pasDe = (texte: string): number => lireSolution(texte).reduce((n, i) => n + i.n, 0);

