// Lot T2 — la rediffusion de Tower : une partie est entièrement décrite par le masque de commandes de chacun de ses ticks (`Partie.commandesJouees`). On l'enregistre, on
// l'encode en texte (`base64url`, par plages comme Track), on la décode en refusant tout ce qui est mal formé, et on la REJOUE avec le même code que le jeu : le `Resultat`
// recalculé fait foi, jamais un score annoncé. Fonction pure au sens des autres jeux : le seul « état » extérieur est le module Rapier déjà chargé, passé en paramètre.
//
// **Format** (octets, puis base64url sans remplissage) :
//   [format = 1] [version de la simulation] [version du générateur] [genre de contenu : 0 = jour, 1 = scénario nommé]
//   (lot T3b) genre 2 = jour avec TIRAGE : le numéro de jour puis le tirage (1 à TIRAGES_MAX − 1) ; le tirage 0 s'écrit toujours en genre 0 (les rediffusions d'avant ne changent pas)
//   jour : numéro de jour civil (entier de longueur variable) · scénario : [longueur 1 à 32] puis ses caractères ASCII `[a-z0-9:_-]`
//   [vitesseChute8] [facteurDescente] [hauteurApparition8] [vies]  (les `Reglages`, chacun un entier de longueur variable)
//   puis par plage de ticks consécutifs aux mêmes commandes : [masque, 1 octet] [nombre de ticks ≥ 1, entier de longueur variable].
// L'en-tête fixe donc : le format, la version de la simulation (lot T6 : 3 ou 4, `VERSIONS_SIM_JOUABLES` ; une partie nouvelle est en `TOWER_SIM_VERSION`), `TOWER_GENERATOR_VERSION` (0 pour un scénario nommé, qui n'a pas de générateur), le jour ou le nom du scénario, les réglages.
//
// **Seuls les ticks de la phase de jeu sont enregistrés** : après la dernière pièce (ou la dernière vie) la simulation n'a plus besoin de commandes, elle attend la stabilisation.
// Une rediffusion qui s'arrête avant la fin de la partie est refusée (`inachevee`), qui en porte après (`surplus`) aussi : une partie n'a qu'une rediffusion.
import { CodecError, fromBase64Url, pushVarint, readVarint, toBase64Url } from "@cdj/core";
import { COMMANDES_CONNUES, type Reglages, STABILISATION_MAX_TICKS, TOWER_SIM_VERSION, VERSIONS_SIM_JOUABLES } from "./constantes";
import { GENERATEUR_TIRAGE, VERSIONS_GENERATEUR } from "./generateur";
import { Partie, type Resultat, type Scenario, type VuePartie } from "./partie";
import type { Rapier } from "./rapier";
import { TIRAGES_MAX } from "./tirage";

/**
 * **La borne de ticks d'une rediffusion** (phase de jeu seulement, hors stabilisation) — elle plafonne le coût d'un rejeu sur le serveur. Déduite des règles : 40 pièces ;
 * la chute la plus lente est `REGLAGES_DEFAUT.vitesseChute8` (2,5 m/s) sans « descendre » ; une pièce tombe au plus de sa hauteur d'apparition (7 m) plus la hauteur de
 * la tour qu'elle manque (elle va alors jusqu'à la plateforme) ; une partie normale dure 40 × 7 m / 2,5 m/s = 112 s (6 720 ticks). Voir `docs/tower/consignes.md` pour le calcul
 * et la mesure du coût.
 */
export const MAX_TICKS_JEU = 20_000;
/** Avec l'attente de stabilisation : la borne de tout ce qu'un rejeu peut simuler. */
export const MAX_TICKS_REJEU = MAX_TICKS_JEU + STABILISATION_MAX_TICKS;

/** Les raisons de refus d'une rediffusion (propres à Tower : l'API aura les siennes au lot T4). */
export type CodeRefusTower =
  /** Une version de la simulation ou du générateur que ce code ne sait pas jouer. */
  | "version_inconnue"
  /** Texte qui n'est pas du base64url, tronqué, entier trop long, format inconnu, identifiant de contenu illisible. */
  | "format_illisible"
  /** Un masque de commandes qui porte un bit que le jeu n'a pas. */
  | "commandes_inconnues"
  /** Plus de `MAX_TICKS_JEU` ticks (ou un texte plus long que ce que cette borne permet). */
  | "trop_longue"
  /** La rediffusion s'arrête avant la fin de la partie. */
  | "inachevee"
  /** La rediffusion porte des commandes après la fin de la partie. */
  | "surplus"
  /** Elle nomme un autre jour, un autre scénario ou une autre version de générateur que le contenu sur lequel on la rejoue. */
  | "contenu_different"
  /** Des réglages hors des bornes de `BORNES_REGLAGES`. */
  | "reglages_invalides";

export class ErreurRediffusion extends Error {
  constructor(
    readonly code: CodeRefusTower,
    detail = "",
  ) {
    super(detail ? `${code} : ${detail}` : code);
    this.name = "ErreurRediffusion";
  }
}

/** Les bornes admises pour chaque réglage (celles des curseurs de `?debug&tune`, et 1 à 9 vies). */
export const BORNES_REGLAGES = {
  vitesseChute8: [4, 64],
  facteurDescente: [1, 12],
  hauteurApparition8: [16, 112],
  vies: [1, 9],
} as const satisfies Record<keyof Reglages, readonly [number, number]>;

export function reglagesValides(r: Reglages): boolean {
  return (Object.keys(BORNES_REGLAGES) as (keyof Reglages)[]).every((k) => Number.isInteger(r[k]) && r[k] >= BORNES_REGLAGES[k][0] && r[k] <= BORNES_REGLAGES[k][1]);
}

/** Le contenu que nomme une rediffusion : un jour (numéro de jour civil) ou un scénario nommé. */
export type IdContenu = { jour: number; tirage?: number } | { scenario: string };

/** Une plage de ticks consécutifs aux mêmes commandes. */
export interface Plage {
  masque: number;
  ticks: number;
}

export interface Rediffusion {
  sim: number;
  g: number;
  contenu: IdContenu;
  reglages: Reglages;
  plages: Plage[];
}

export const FORMAT_REDIFFUSION = 1;
const NOM_SCENARIO = /^[a-z0-9:_-]{1,32}$/;
/** Chaque plage prend au moins 2 octets mais en faire plus que ceci par tick n'a aucun sens : le texte le plus long possible (en-tête compris). */
export const MAX_CARACTERES = Math.ceil(((MAX_TICKS_JEU * 2 + 128) * 4) / 3);

export function ticksRediffusion(r: Pick<Rediffusion, "plages">): number {
  let n = 0;
  for (const p of r.plages) n += p.ticks;
  return n;
}

/** L'identifiant de contenu d'une partie : le jour d'un contenu du jour, sinon le nom du scénario. */
export function idDuContenu(c: Pick<Scenario, "nom" | "jour" | "tirage">): IdContenu {
  return c.jour !== undefined ? (c.tirage ? { jour: c.jour, tirage: c.tirage } : { jour: c.jour }) : { scenario: c.nom };
}

/** Construit la rediffusion d'une partie jouée (finie ou non : une partie inachevée donne une rediffusion qui sera refusée `inachevee`). */
export function enregistrer(partie: Pick<Partie, "commandesJouees" | "scenario" | "reglages"> & { version?: number }): Rediffusion {
  const plages: Plage[] = [];
  for (const masque of partie.commandesJouees()) {
    const derniere = plages[plages.length - 1];
    if (derniere && derniere.masque === masque) derniere.ticks++;
    else plages.push({ masque, ticks: 1 });
  }
  return { sim: partie.version ?? TOWER_SIM_VERSION, g: partie.scenario.g ?? 0, contenu: idDuContenu(partie.scenario), reglages: { ...partie.reglages }, plages };
}

// ---- encodage ----

export function encoderRediffusion(r: Rediffusion): string {
  const bytes: number[] = [FORMAT_REDIFFUSION, r.sim, r.g];
  if ("jour" in r.contenu) {
    if (!Number.isInteger(r.contenu.jour) || r.contenu.jour < 0) throw new ErreurRediffusion("format_illisible", "jour invalide");
    // Lot T3b : le tirage 0 s'écrit comme avant (genre 0) ; un tirage n ≥ 1 est le genre 2 (jour, puis tirage) — une seule forme canonique, les rediffusions d'avant ne changent pas.
    const tirage = r.contenu.tirage ?? 0;
    if (!Number.isInteger(tirage) || tirage < 0 || tirage >= TIRAGES_MAX) throw new ErreurRediffusion("format_illisible", "tirage invalide");
    bytes.push(tirage === 0 ? 0 : 2);
    pushVarint(bytes, r.contenu.jour);
    if (tirage > 0) pushVarint(bytes, tirage);
  } else {
    if (!NOM_SCENARIO.test(r.contenu.scenario)) throw new ErreurRediffusion("format_illisible", "nom de scénario invalide");
    bytes.push(1, r.contenu.scenario.length);
    for (let i = 0; i < r.contenu.scenario.length; i++) bytes.push(r.contenu.scenario.charCodeAt(i));
  }
  pushVarint(bytes, r.reglages.vitesseChute8);
  pushVarint(bytes, r.reglages.facteurDescente);
  pushVarint(bytes, r.reglages.hauteurApparition8);
  pushVarint(bytes, r.reglages.vies);
  for (const p of r.plages) {
    bytes.push(p.masque & 0xff);
    pushVarint(bytes, p.ticks);
  }
  return toBase64Url(bytes);
}

/** Texte → rediffusion. Refuse tout ce qui est mal formé ou hors limites : le texte vient du réseau. Lève `ErreurRediffusion`. */
export function decoderRediffusion(code: string): Rediffusion {
  if (typeof code !== "string" || code.length > MAX_CARACTERES) throw new ErreurRediffusion("trop_longue", "texte démesuré");
  let bytes: number[];
  try {
    bytes = fromBase64Url(code);
  } catch (e) {
    if (e instanceof CodecError) throw new ErreurRediffusion("format_illisible", e.message);
    throw e;
  }
  let pos = 0;
  const octet = (): number => {
    const b = bytes[pos++];
    if (b === undefined) throw new ErreurRediffusion("format_illisible", "rediffusion tronquée");
    return b;
  };
  const entier = (): number => {
    try {
      return readVarint(octet, 28);
    } catch (e) {
      if (e instanceof CodecError) throw new ErreurRediffusion("format_illisible", e.message);
      throw e;
    }
  };
  if (octet() !== FORMAT_REDIFFUSION) throw new ErreurRediffusion("format_illisible", "format inconnu");
  const sim = octet();
  const g = octet();
  const genre = octet();
  let contenu: IdContenu;
  if (genre === 0) contenu = { jour: entier() };
  else if (genre === 2) {
    const jour = entier();
    const tirage = entier();
    if (tirage < 1 || tirage >= TIRAGES_MAX) throw new ErreurRediffusion("format_illisible", "tirage invalide");
    contenu = { jour, tirage };
  } else if (genre === 1) {
    const n = octet();
    let nom = "";
    for (let i = 0; i < n; i++) nom += String.fromCharCode(octet());
    if (!NOM_SCENARIO.test(nom)) throw new ErreurRediffusion("format_illisible", "nom de scénario invalide");
    contenu = { scenario: nom };
  } else throw new ErreurRediffusion("format_illisible", "genre de contenu inconnu");
  const reglages: Reglages = { vitesseChute8: entier(), facteurDescente: entier(), hauteurApparition8: entier(), vies: entier() };
  // Les versions d'abord : une rediffusion d'une autre version se refuse sans autre analyse (ses plages n'auraient pas le même sens).
  if (!VERSIONS_SIM_JOUABLES.includes(sim)) throw new ErreurRediffusion("version_inconnue", `simulation ${sim}`);
  if (genre === 1 ? g !== 0 : !VERSIONS_GENERATEUR.includes(g) || (genre === 2 && g < GENERATEUR_TIRAGE)) throw new ErreurRediffusion("version_inconnue", `générateur ${g}`);
  if (!reglagesValides(reglages)) throw new ErreurRediffusion("reglages_invalides");
  const plages: Plage[] = [];
  let total = 0;
  while (pos < bytes.length) {
    const masque = octet();
    if (masque & ~COMMANDES_CONNUES) throw new ErreurRediffusion("commandes_inconnues", `masque ${masque}`);
    const ticks = entier();
    if (ticks < 1) throw new ErreurRediffusion("format_illisible", "plage vide");
    total += ticks;
    if (total > MAX_TICKS_JEU) throw new ErreurRediffusion("trop_longue", `plus de ${MAX_TICKS_JEU} ticks`);
    const derniere = plages[plages.length - 1];
    if (derniere && derniere.masque === masque) derniere.ticks += ticks; // forme canonique : jamais deux plages voisines identiques
    else plages.push({ masque, ticks });
  }
  return { sim, g, contenu, reglages, plages };
}

// ---- rejeu ----

/** Ce que rend un rejeu complet : le `Resultat` et l'état final (la silhouette du fantôme en dérive). */
export interface Rejeu {
  resultat: Resultat;
  vue: VuePartie;
}

/** Les ticks qu'un rejeu simule à chaque « tranche » rendue par `rejouerParTranches` (un client qui ne veut pas figer l'écran rend la main entre deux). */
export const TRANCHE_TICKS = 240;

/**
 * Le rejeu pas à pas : rend la main (`yield`, avec le nombre de ticks simulés) toutes les `tranche` ticks, et rend le `Rejeu` à la fin. `rejouer` le mène d'une traite. Vérifie
 * que la rediffusion nomme bien ce contenu (`contenu_different`), puis joue ses plages ; `inachevee` si elles finissent avant la partie, `surplus` si la partie finit avant elles.
 */
export function* rejouerParTranches(R: Rapier, contenu: Scenario, rediffusion: Rediffusion | string, tranche = TRANCHE_TICKS): Generator<number, Rejeu> {
  const r = typeof rediffusion === "string" ? decoderRediffusion(rediffusion) : rediffusion;
  if (!VERSIONS_SIM_JOUABLES.includes(r.sim)) throw new ErreurRediffusion("version_inconnue", `simulation ${r.sim}`);
  const id = idDuContenu(contenu);
  const memeContenu = "jour" in r.contenu ? "jour" in id && id.jour === r.contenu.jour && (id.tirage ?? 0) === (r.contenu.tirage ?? 0) : "scenario" in id && id.scenario === r.contenu.scenario;
  if (!memeContenu || r.g !== (contenu.g ?? 0)) throw new ErreurRediffusion("contenu_different");
  if (!reglagesValides(r.reglages)) throw new ErreurRediffusion("reglages_invalides");
  if (ticksRediffusion(r) > MAX_TICKS_JEU) throw new ErreurRediffusion("trop_longue", `plus de ${MAX_TICKS_JEU} ticks`);
  for (const p of r.plages) if (p.masque & ~COMMANDES_CONNUES) throw new ErreurRediffusion("commandes_inconnues", `masque ${p.masque}`);
  const partie = new Partie(R, contenu, r.reglages, { version: r.sim }); // lot T6 : la rediffusion est rejouée par la version de simulation qu'elle nomme (3 ou 4)
  try {
    let faits = 0;
    for (const p of r.plages) {
      for (let i = 0; i < p.ticks; i++) {
        if (partie.etape !== "jeu") throw new ErreurRediffusion("surplus", `la partie finit au tick ${faits}`);
        partie.avancer(p.masque);
        if (++faits % tranche === 0) yield faits;
      }
    }
    if (partie.etape === "jeu") throw new ErreurRediffusion("inachevee", `${faits} ticks, la partie continue`);
    // La phase de jeu est finie : la stabilisation ne lit aucune commande.
    while (partie.etape !== "fini") partie.avancer(0);
    return { resultat: partie.resultat()!, vue: partie.vue() };
  } finally {
    partie.dispose();
  }
}

/** Rejoue une rediffusion sur un contenu et rend l'état final et le `Resultat`. */
export function rejouerComplet(R: Rapier, contenu: Scenario, rediffusion: Rediffusion | string): Rejeu {
  const g = rejouerParTranches(R, contenu, rediffusion, Infinity);
  for (;;) {
    const n = g.next();
    if (n.done) return n.value;
  }
}

/**
 * Rejoue une rediffusion sur un contenu : le `Resultat` que la simulation recalcule, identique au bit près à celui de la partie jouée. Lève `ErreurRediffusion` (voir
 * `CodeRefusTower`). `R` est le module Rapier chargé (`chargerRapier` de `@cdj/tower-sim/rapier`).
 */
export function rejouer(R: Rapier, contenu: Scenario, rediffusion: Rediffusion | string): Resultat {
  return rejouerComplet(R, contenu, rediffusion).resultat;
}
