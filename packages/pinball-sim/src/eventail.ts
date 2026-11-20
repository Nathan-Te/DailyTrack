import type { DefRail, Emplacement, Plan } from "./plans";
import { orbite, porteDeLOrbite, theme, trou } from "./plans-outils";

// L'ÉVENTAIL (lot PBT0b) — la référence est un vrai flipper (Spider-Man Vault Edition, `docs/pinball/maquettes/references/reference-spider-man-vault.jpg`). Retour de Nathan sur le lot PBT0 : « des murs devant les rampes, c'est devenu
// vide et toujours brouillon ». Ce qui rend la table de référence lisible, et ce qu'on en prend : **les tirs sont posés sur un arc, de gauche à droite, et chaque bouche regarde les batteurs** (orbite gauche, rampe, tir central, rampe ou
// cibles, orbite droite) ; entre les batteurs et une bouche il n'y a rien ; les rampes partent de l'arc et reviennent par des fils le long des bords ; le jouet du thème est le tir central ; les bumpers sont en poche en haut ; une banque
// de cibles sur un flanc. Une table n'est plus un plan libre : **c'est ce que chaque place de l'arc porte** (`PLACES`), le côté de la rampe et de la banque, le mini-batteur, le miroir. Les règles (bouche libre, bouche tournée vers les
// batteurs, le haut réservé) sont dans `conception.ts` et gardées par `test/conception.test.ts`.

/** Le point entre les batteurs, que toutes les bouches regardent (px). */
export const POINT_DES_BATTEURS = { x: 184, y: 650 } as const;
/** Une bouche s'écarte de la direction des batteurs de 25° au plus. */
export const ECART_BOUCHE_MAX = 25;

/** Les places de l'arc : le centre de la bouche (ou du tir) en pixels, et la direction d'entrée en degrés depuis la verticale (positif vers la droite). Les places gauche et droite sont symétriques par le miroir. */
export const PLACES = {
  /** L'orbite : bouche gauche libre, bouche droite fermée par la porte (le lot PBL2 les a éprouvées : 50 à 86 ms). */
  orbiteGauche: { x: 88, y: 295, angle: 0 },
  orbiteDroite: { x: 304, y: 285, angle: 35 },
  /** La rampe : sa bouche est devant le batteur opposé, au pied de l'arc, et regarde vers lui. */
  rampeGauche: { x: 124, y: 392, angle: -28 },
  /** Le jouet du thème au centre, le verrou devant les batteurs (la seule place où le trou, qui ne garde que les billes lentes, a 30 ms), la poche des bumpers sous les couloirs du haut. */
  mission: { x: 182, y: 315 },
  verrou: { x: 180, y: 398 },
  poche: { x: 212, y: 176 },
  /** Une paire de mini-bumpers à l'entrée de la poche (portail A de l'Espace). */
  pocheMini: { x: 152, y: 233 },
  /** Les banques de cibles : en haut à droite (tournée vers le batteur gauche), ou sur un flanc bas. */
  banqueHaut: { x: 250, y: 252 },
  banqueFlancGauche: { x: 82, y: 415 },
  banqueFlancDroit: { x: 262, y: 415 },
  /** La seconde paire de mini-bumpers de la poche (portail B de l'Espace). */
  pocheDroite: { x: 258, y: 244 },
} as const;

/** La rampe qui part d'une place de l'arc (`PLACES.rampeGauche`) et revient par un fil le long du bord gauche jusqu'au couloir de retour (x ≈ 32, y 448). */
const RAMPE_COURTE: DefRail = { genre: "rampe", points: [[124, 392], [106, 358], [60, 326], [38, 360], [32, 400], [32, 448]], hauteur: 24, demiPorte: 17 };
/** La grande rampe : elle part de la même place, longe tout le bord gauche et le haut, et revient par le bord droit (la table n'a alors ni orbite ni porte). */
const RAMPE_BOUCLE: DefRail = { genre: "rampe", points: [[124, 392], [106, 358], [60, 326], [38, 250], [46, 165], [56, 100], [150, 34], [250, 34], [326, 100], [335, 170], [338, 260], [337, 448]], hauteur: 30, demiPorte: 17 };

/** Où se pose le troisième emplacement : une banque de cibles (en haut à droite : elle se cache derrière le jouet et la porte, 6 ms ; sur un flanc bas) ou, quand l'orbite et sa porte occupent déjà les flancs, une paire de mini-bumpers dans la poche. */
type Banque = "haut" | "flancGauche" | "flancDroit" | "pocheDroite";
export interface ConfigEventail {
  id: string;
  idee: string;
  /** L'orbite et sa porte (bouche droite fermée). */
  orbite: boolean;
  /** La rampe : courte (retour par le flanc gauche) ou grande boucle (sans orbite). */
  rampe: "courte" | "boucle" | null;
  /** Les banques de cibles, dans l'ordre des emplacements 3 et 4 ; les deux premiers emplacements d'un jouet du plan sont aussi les portails de l'Espace. */
  banques: readonly Banque[];
  /** Le mini-batteur : à gauche (repère du côté gauche) ou à droite. */
  mini: "gauche" | "droite" | null;
}

const PLACE_BANQUE: Record<Banque, { x: number; y: number }> = { haut: PLACES.banqueHaut, flancGauche: PLACES.banqueFlancGauche, flancDroit: PLACES.banqueFlancDroit, pocheDroite: PLACES.pocheDroite };

/** Une table en éventail : ce que chaque place porte. Les emplacements : le jouet (la mission), le verrou, la poche, puis les banques (et, quand il n'y en a qu'une, la paire de mini-bumpers de la poche) — l'Espace en fait ses deux portails. */
export function eventail(c: ConfigEventail): Plan {
  const emplacements: Emplacement[] = [theme(PLACES.mission.x, PLACES.mission.y, "geyser"), trou(PLACES.verrou.x, PLACES.verrou.y), { x: PLACES.poche.x, y: PLACES.poche.y, permis: ["bumpers"], fixe: { espace: "asteroide" } }];
  c.banques.forEach((b, i) => emplacements.push({ x: PLACE_BANQUE[b].x, y: PLACE_BANQUE[b].y, permis: [b === "pocheDroite" ? "mini" : "cibles"], ...(i === 0 ? { fixe: { espace: "portailB" as const } } : {}) }));
  emplacements.push({ x: PLACES.pocheMini.x, y: PLACES.pocheMini.y, permis: ["mini"], fixe: { espace: "portailA" } });
  const rampe = c.rampe === "courte" ? RAMPE_COURTE : c.rampe === "boucle" ? RAMPE_BOUCLE : null;
  return {
    id: c.id,
    idee: c.idee,
    emplacements,
    rampes: rampe ? [rampe] : [],
    orbite: c.orbite ? orbite(PLACES.orbiteGauche.x, PLACES.orbiteDroite.x, PLACES.orbiteGauche.y, 158, 20, PLACES.orbiteGauche.angle, PLACES.orbiteDroite.angle, PLACES.orbiteDroite.y) : null,
    ...(c.orbite ? { porte: porteDeLOrbite(PLACES.orbiteDroite.x, PLACES.orbiteDroite.y, PLACES.orbiteDroite.angle, 56, 24) } : {}),
    ...(c.mini ? { mini: { cote: c.mini === "gauche" ? (0 as const) : (1 as const), x: 46, y: 405, longueur: 38 } } : {}),
    ...(rampe ? { aiguillage: { rampe: 0, partie: c.rampe === "courte" ? 300 : 500 } } : {}),
  };
}

/**
 * Les trois variantes jouables du lot PBT0b (`?plan=e1` à `?plan=e3`, jamais tirées par le générateur). **Pourquoi trois :** l'orbite et sa porte occupent les deux lignes de visée des flancs (les bouches de l'orbite et de la porte, 304 et 88 de x) : une banque de flanc ou le
 * mini-batteur y bloquerait une bouche (`bouchesBloquees`), et en haut à droite elle se cache derrière le jouet et la porte (6 ms) ; une table d'orbite n'a donc que cinq tirs (le jouet, le verrou, la rampe, l'orbite, la porte) — c'est `e1`, et son miroir porte la porte à gauche.
 */
export const PLANS_EVENTAIL: readonly Plan[] = [
  eventail({ id: "e1", idee: "L'éventail complet : l'orbite et sa porte, la rampe, le jouet, le verrou, la poche des bumpers", orbite: true, rampe: "courte", banques: ["pocheDroite"], mini: null }),
  eventail({ id: "e2", idee: "La grande rampe le long des bords, le mini-batteur de gauche et deux banques", orbite: false, rampe: "boucle", banques: ["flancDroit", "haut"], mini: "gauche" }),
  eventail({ id: "e3", idee: "La rampe et deux banques, sans orbite : un flanc bas et le haut", orbite: false, rampe: "courte", banques: ["flancDroit", "haut"], mini: null }),
];
