import { DEMI, M } from "./constantes";
import { Partie } from "./course";
import { jauges, type Jauges } from "./jauges";
import { niveauDuModule, commandesDuModule, type Mecanique, type Module } from "./modules";
import type { BlocNiveau, Boite, Niveau } from "./niveaux";
import { poche, type Portail } from "./portails";
import { REGLAGES_DEFAUT, type Reglages } from "./sensations";

// Les vérifications des modules (lot V2) : le robot rejoue la solution, on mesure chaque PHASE EN L'AIR (du pied qui quitte le sol au pied qui se repose) et on la compare aux jauges ; on vérifie aussi les contraintes de
// niveau (surfaces marquées qui ne se touchent pas, poches vides, une seule paire de portails visible à la fois). Les tests (`modules.test.ts`) et l'outil de la galerie s'en servent. Tout se mesure avec la simulation ;
// rien n'est déclaré à la main.
export interface Phase {
  /** Le pas où les pieds quittent le sol et celui où ils se reposent (la capture d'un palier repose aussi). */
  debut: number;
  fin: number;
  mecaniques: Mecanique[];
  /** Le blocs (rangs dans `niveau.blocs`) de départ et d'arrivée, −1 s'il n'y en a pas. */
  blocDepart: number;
  blocArrivee: number;
  /** La distance libre entre les deux bords de plateforme (µm) et le dénivelé (µm, positif : on monte), `null` si le repère change pendant la phase ou s'il manque un bloc. */
  ecart: number | null;
  denivele: number | null;
  /** La distance horizontale parcourue par le centre (µm), la plus longue course sur le mur (µm), et les distances des sauts de mur (de la poussée au contact suivant ou à l'atterrissage). */
  distance: number;
  longueurMur: number;
  sautsDeMur: number[];
  /** La gravité ou le repère a changé pendant la phase (une bascule ou une traversée). */
  changeDeRepere: boolean;
}
export interface Analyse {
  ticks: number;
  arrive: boolean;
  chutes: number;
  phases: Phase[];
}

/** La norme d'un vecteur (µm) : une racine carrée arrondie (jamais `Math.hypot`, que la pureté de la simulation interdit : ces mesures n'entrent dans aucun état, mais la règle vaut pour tout le paquet). */
const hyp = (...v: number[]): number => Math.round(Math.sqrt(v.reduce((s, x) => s + x * x, 0)));
const distanceBoites = (a: Boite, b: Boite): number => {
  const dx = Math.max(0, b.x0 - a.x1, a.x0 - b.x1);
  const dz = Math.max(0, b.z0 - a.z1, a.z0 - b.z1);
  return dx > 0 && dz > 0 ? hyp(dx, dz) : Math.max(dx, dz);
};

/** Rejoue la solution d'un module (depuis l'état canonique d'entrée) et mesure ses phases en l'air. */
export function analyser(m: Module, reglages: Readonly<Reglages> = REGLAGES_DEFAUT): Analyse {
  const niveau = niveauDuModule(m, { lance: true });
  const p = new Partie(niveau, reglages);
  const phases: Phase[] = [];
  const commandes = commandesDuModule(m);
  let courante: (Phase & { depart: number; repere0: number; ori0: number; x: number; z: number; mur: number; kick: { x: number; z: number; axe: "x" | "z" } | null }) | null = null;
  let soutien = p.sousLesPieds();
  for (let i = 0; i < commandes.length && !p.finie; i++) {
    const solAvant = p.sol;
    const murVerrouAvant = p.murVerrou;
    const ori0 = p.ori;
    const traversees0 = p.traversees;
    const x0 = p.x;
    const z0 = p.z;
    p.avancer(commandes[i]!);
    const repere = p.bascules + p.traversees;
    if (solAvant && !p.sol && !courante) {
      courante = { debut: p.tick, fin: p.tick, mecaniques: p.vy > 0 ? ["saut"] : [], blocDepart: soutien, blocArrivee: -1, ecart: null, denivele: null, distance: 0, longueurMur: 0, sautsDeMur: [], changeDeRepere: false, depart: soutien, repere0: repere - 0, ori0: p.ori, x: p.x, z: p.z, mur: 0, kick: null };
    }
    if (courante) {
      const c = courante;
      if (p.ori !== ori0 || p.traversees !== traversees0) c.changeDeRepere = true; // une traversée de portail téléporte : la phase n'a pas d'écart à mesurer
      else {
        const pas = hyp(p.x - x0, p.z - z0);
        c.distance += pas;
        if (p.surMur) c.mur += pas;
      }
      const ajouter = (k: Mecanique): void => void (!c.mecaniques.includes(k) && c.mecaniques.push(k));
      if (p.dash > 0) ajouter("dash");
      if (p.surMur) ajouter("mur");
      else if (c.mur > 0) {
        c.longueurMur = Math.max(c.longueurMur, c.mur);
        c.mur = 0;
      }
      if (p.murVerrou > 0 && murVerrouAvant === 0) {
        ajouter("saut-de-mur");
        c.kick = { x: p.x, z: p.z, axe: p.murNx !== 0 ? "x" : "z" }; // l'axe de la poussée : celui de la normale du mur quitté
      }
      if (c.kick && (p.surMur || p.sol) && !(p.murVerrou > 0 && murVerrouAvant === 0)) {
        c.sautsDeMur.push(Math.abs(c.kick.axe === "x" ? p.x - c.kick.x : p.z - c.kick.z));
        c.kick = null;
      }
      if (p.sol) {
        c.fin = p.tick;
        c.longueurMur = Math.max(c.longueurMur, c.mur);
        c.blocArrivee = p.sousLesPieds();
        if (!c.changeDeRepere && c.blocDepart >= 0 && c.blocArrivee >= 0 && p.ori === c.ori0) {
          const a = p.boiteLocale(c.blocDepart);
          const b = p.boiteLocale(c.blocArrivee);
          c.ecart = distanceBoites(a, b);
          c.denivele = b.y1 - a.y1;
        }
        const { depart: _d, repere0: _r, ori0: _o, x: _x, z: _z, mur: _m, kick: _k, ...phase } = c;
        void [_d, _r, _o, _x, _z, _m, _k];
        phases.push(phase);
        courante = null;
      }
    }
    if (p.sol) soutien = p.sousLesPieds();
  }
  return { ticks: p.fin >= 0 ? p.tick : 0, arrive: p.fin >= 0, chutes: p.chutes, phases };
}

/** Les écarts d'un module comparés aux jauges : un texte par phase qui les dépasse (vide : tout est dans les 85 %). */
export function ecartsHorsJauge(a: Analyse, j: Jauges = jauges()): string[] {
  const refus: string[] = [];
  const metres = (v: number): string => (v / M).toFixed(2);
  a.phases.forEach((ph, k) => {
    const nom = `phase ${k + 1} (pas ${ph.debut}–${ph.fin}, ${ph.mecaniques.join("+") || "chute"})`;
    if (ph.longueurMur > j.permis.longueurMur) refus.push(`${nom} : ${metres(ph.longueurMur)} m sur le mur, au plus ${metres(j.permis.longueurMur)} m`);
    for (const d of ph.sautsDeMur) if (d + 2 * DEMI + 2 * 80_000 > j.permis.ecartSautDeMur) refus.push(`${nom} : saut de mur de ${metres(d + 2 * DEMI + 2 * 80_000)} m entre deux murs, au plus ${metres(j.permis.ecartSautDeMur)} m`);
    if (ph.ecart === null || ph.denivele === null || ph.mecaniques.includes("mur") || ph.mecaniques.includes("saut-de-mur")) return;
    if (ph.denivele > j.permis.hauteurSaut) refus.push(`${nom} : une marche de ${metres(ph.denivele)} m, au plus ${metres(j.permis.hauteurSaut)} m`);
    const dash = ph.mecaniques.includes("dash");
    const saut = ph.mecaniques.includes("saut");
    const permis = dash ? (saut ? j.permis.ecartSautDash(ph.denivele) : j.permis.ecartDashSeul(ph.denivele)) : saut ? j.permis.ecartSaut(ph.denivele) : 0;
    if (ph.ecart > permis) refus.push(`${nom} : un écart de ${metres(ph.ecart)} m, au plus ${metres(permis)} m`);
  });
  return refus;
}

// ---------------------------------------------------------------- les contraintes de niveau
const touche = (a: Boite, b: Boite, marge = 0): boolean => a.x0 - marge <= b.x1 && a.x1 + marge >= b.x0 && a.y0 - marge <= b.y1 && a.y1 + marge >= b.y0 && a.z0 - marge <= b.z1 && a.z1 + marge >= b.z0;
const recouvre = (a: Boite, b: Boite): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;

/** Les surfaces de gravité qui se touchent (ou sont à moins de `marge` µm l'une de l'autre) : la règle dit « jamais deux faces marquées qui se touchent ». */
export function surfacesMarqueesQuiSeTouchent(blocs: readonly BlocNiveau[], marge = 100_000): [number, number][] {
  const marquees = blocs.flatMap((b, i) => (b.gravite ? [i] : []));
  const out: [number, number][] = [];
  for (let a = 0; a < marquees.length; a++) for (let b = a + 1; b < marquees.length; b++) if (touche(blocs[marquees[a]!]!.boite, blocs[marquees[b]!]!.boite, marge)) out.push([marquees[a]!, marquees[b]!]);
  return out;
}

/** Les blocs qui entrent dans la poche d'un portail (la poche doit rester vide) : « portail n° i (a ou b), bloc n° j ». */
export function blocsDansUnePoche(niveau: Pick<Niveau, "blocs" | "portails">): string[] {
  const out: string[] = [];
  (niveau.portails ?? []).forEach((paire, i) => {
    for (const [nom, p] of [["a", paire.a], ["b", paire.b]] as [string, Portail][]) {
      const poc = poche(p);
      niveau.blocs.forEach((b, j) => {
        if (recouvre(poc, b.boite)) out.push(`paire ${i + 1}, portail ${nom} : le bloc ${j} est dans la poche`);
      });
    }
  });
  return out;
}

/** La distance minimale entre deux portails de paires différentes : la règle « au plus une paire de portails visible à la fois » (coût de rendu : une fenêtre redessine la scène) se garantit par la distance, une seule paire étant dans le champ à moins de 40 m. */
export const DISTANCE_PAIRES_MIN = 40 * M;

/** La distance la plus courte entre deux portails de paires différentes (µm), ou `Infinity` : une seule paire visible à la fois est garantie par une distance minimale (voir `consignes.md`). */
export function distanceMinimaleEntrePaires(portails: readonly { a: Portail; b: Portail }[]): number {
  let min = Infinity;
  for (let i = 0; i < portails.length; i++)
    for (let j = i + 1; j < portails.length; j++)
      for (const p of [portails[i]!.a, portails[i]!.b])
        for (const q of [portails[j]!.a, portails[j]!.b]) min = Math.min(min, hyp(p.x - q.x, p.y - q.y, p.z - q.z));
  return min;
}

/** Les paires de blocs de deux listes qui se recouvrent d'un volume positif (les modules d'un niveau ne se traversent pas). */
export function blocsQuiSeRecouvrent(a: readonly BlocNiveau[], b: readonly BlocNiveau[]): [number, number][] {
  const out: [number, number][] = [];
  a.forEach((x, i) => b.forEach((y, j) => recouvre(x.boite, y.boite) && out.push([i, j])));
  return out;
}
