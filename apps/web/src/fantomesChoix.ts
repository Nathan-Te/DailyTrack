// Lot 55 — choisir ses fantômes dans le classement du jour. Logique **pure** (et la mémoire du navigateur), chargée à la demande avec `fantomesJeu.ts` : rien ici dans le premier chargement.
// Une sélection = de 1 à 5 courses du classement du jour, désignées par la **référence publique** de leur joueur (`ref`, 12 hexadécimaux : jamais l'identifiant secret, `X-Player-Id`
// reste ton identité). Elle est gardée **pour le jour** dans le navigateur (`cdj:track:fantomes`) et oubliée au circuit suivant ; le **mode** du bouton, lui, est gardé d'une course à l'autre.

export const CLE_FANTOMES = "cdj:track:fantomes";
export const MAX_FANTOMES = 5;
/** Une référence de course : 12 hexadécimaux (`REF_LENGTH` du serveur). */
export const REF_COURSE = /^[0-9a-f]{12}$/;

/** Les modes du bouton : Rien → Le mien → Le premier → Ma sélection → Rien. */
export type ModeChoisi = "off" | "mine" | "first" | "selection";
export const ORDRE_MODES: readonly ModeChoisi[] = ["mine", "first", "selection", "off"];

/** Une course choisie : sa référence publique, le pseudo et la place de ce jour-là (pour la montrer sans la relire). */
export interface Choisi {
  ref: string;
  name: string;
  rank: number;
}

export interface Memoire {
  /** Le dernier mode choisi au bouton (`null` : jamais choisi, le mode par défaut d'aujourd'hui s'applique). */
  mode: ModeChoisi | null;
  /** Le joueur a-t-il touché une case aujourd'hui ? Sinon les fantômes proposés (le premier, celui devant toi) comptent comme cochés. */
  choisi: boolean;
  refs: Choisi[];
}

/** Une ligne du classement telle que la sélection la voit (lue dans le tableau affiché ou rendue par le serveur). */
export interface LigneClassement {
  ref?: string;
  name: string;
  rank: number;
  me: boolean;
}

const VIDE = (): Memoire => ({ mode: null, choisi: false, refs: [] });
const estMode = (m: unknown): m is ModeChoisi => m === "off" || m === "mine" || m === "first" || m === "selection";

function proprete(c: unknown): Choisi | null {
  if (typeof c !== "object" || c === null) return null;
  const { ref, name, rank } = c as Record<string, unknown>;
  if (typeof ref !== "string" || !REF_COURSE.test(ref) || typeof name !== "string" || typeof rank !== "number" || !Number.isInteger(rank) || rank < 1) return null;
  return { ref, name: name.slice(0, 40), rank };
}

/** Lit la mémoire de **ce jour** : la sélection d'un autre jour est oubliée (le mode, lui, reste). Illisible : rien de choisi. */
export function lireMemoire(jour: string, storage: Pick<Storage, "getItem">): Memoire {
  try {
    const brut = JSON.parse(storage.getItem(CLE_FANTOMES) ?? "null") as Record<string, unknown> | null;
    if (typeof brut !== "object" || brut === null) return VIDE();
    const m = VIDE();
    if (estMode(brut.mode)) m.mode = brut.mode;
    if (brut.jour === jour && Array.isArray(brut.refs)) {
      const vus = new Set<string>();
      for (const c of brut.refs) {
        const p = proprete(c);
        if (p && !vus.has(p.ref) && m.refs.length < MAX_FANTOMES) {
          vus.add(p.ref);
          m.refs.push(p);
        }
      }
      m.choisi = brut.choisi === true;
    }
    return m;
  } catch {
    return VIDE();
  }
}

export function ecrireMemoire(jour: string, m: Memoire, storage: Pick<Storage, "setItem">): void {
  try {
    storage.setItem(CLE_FANTOMES, JSON.stringify({ jour, mode: m.mode, choisi: m.choisi, refs: m.refs }));
  } catch {
    /* stockage plein ou refusé : le choix n'est que perdu */
  }
}

/**
 * Les fantômes **proposés** tant que le joueur n'a rien choisi : le premier du classement et le joueur juste devant toi (jamais toi), quand leurs lignes sont connues
 * (une ligne sans référence n'a pas de case).
 */
export function parDefaut(lignes: readonly LigneClassement[]): Choisi[] {
  const out: Choisi[] = [];
  const ajoute = (l: LigneClassement | undefined) => {
    if (l?.ref && !l.me && !out.some((c) => c.ref === l.ref)) out.push({ ref: l.ref, name: l.name, rank: l.rank });
  };
  ajoute(lignes.find((l) => l.rank === 1));
  const moi = lignes.find((l) => l.me);
  if (moi) ajoute(lignes.find((l) => l.rank === moi.rank - 1));
  return out;
}

/** La sélection qui compte : celle du joueur, ou les fantômes proposés tant qu'il n'a rien choisi. */
export function selectionDe(m: Memoire, lignes: readonly LigneClassement[]): Choisi[] {
  return m.choisi ? m.refs : parDefaut(lignes);
}

/** Coche ou décoche une course. Au maximum `MAX_FANTOMES` : une sixième est refusée (`ok: false`, la sélection ne change pas). */
export function basculer(refs: readonly Choisi[], c: Choisi): { refs: Choisi[]; ok: boolean } {
  if (refs.some((x) => x.ref === c.ref)) return { refs: refs.filter((x) => x.ref !== c.ref), ok: true };
  if (refs.length >= MAX_FANTOMES) return { refs: [...refs], ok: false };
  return { refs: [...refs, c], ok: true };
}

/**
 * Le mode suivant du bouton, en bouclant (Rien → Le mien → Le premier → Ma sélection → Rien), en **sautant** les modes qui n'existent pas (`dispo`) : pas encore de record, personne
 * au classement, aucune case cochée. Rend aussi les modes sautés, pour que le jeu le dise. « Rien » existe toujours. Un ancien mode (« le joueur devant », réglage) repart du premier.
 */
export function modeSuivant(courant: ModeChoisi | "ahead", dispo: Readonly<Record<ModeChoisi, boolean>>): { mode: ModeChoisi; sautes: ModeChoisi[] } {
  const depart = courant === "ahead" ? ORDRE_MODES.indexOf("first") : ORDRE_MODES.indexOf(courant);
  const sautes: ModeChoisi[] = [];
  for (let pas = 1; pas <= ORDRE_MODES.length; pas++) {
    const m = ORDRE_MODES[(depart + pas) % ORDRE_MODES.length]!;
    if (m === "off" || dispo[m]) return { mode: m, sautes };
    sautes.push(m);
  }
  return { mode: "off", sautes };
}

/**
 * Les teintes des cinq fantômes, celles du Salon (`GHOST_COLORS` de `salon.ts` : un test les compare). Copiées ici pour que le choix (les cases du classement, qui ne chargent pas le Salon)
 * n'importe pas le module du Salon : sans cela l'empaqueteur éclate les morceaux partagés du premier chargement.
 */
export const TEINTES_FANTOMES: readonly number[] = [0xff4fa3, 0x3ddc84, 0xffd22e, 0xb084ff, 0x2ee6d6];

/** Le numéro de teinte (0 à 4) d'une course dans la sélection : le même pour sa case du classement, sa voiture et son pseudo en course. */
export const teinteDe = (refs: readonly Choisi[], ref: string): number => refs.findIndex((c) => c.ref === ref);
