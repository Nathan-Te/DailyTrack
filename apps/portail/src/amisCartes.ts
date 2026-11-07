import type { Ami } from "@cdj/profile";
import type { AmiAbsent, Classement, LigneClassement } from "./classementDonnees";
import { jeuxDuCumul } from "./classementPodium";
import type { AmiDuJour } from "./jour";

// Lot U3 (charte rév. 19, § 9) — la logique pure de la page « Amis et groupes » : ce que chaque carte d'ami dit de sa journée (les pastilles des jeux faits, la journée parfaite, le dernier jeu joué) et ce que
// chaque membre de ton groupe en dit. Sans DOM ni réseau, testée dans `test/amisCartes.test.ts`. **Rien n'est inventé** : les jeux faits viennent du classement du jour « Amis » (ou « Mon groupe ») — toi et
// tous les tiens, sans limite —, le dernier jeu joué de leur ligne du classement (lot U4 : tous les amis ; `GET /api/portail/jour`, 6 amis au plus, ne sert plus que de repli).

/** Un jeu du jour dans une rangée de pastilles : sa lettre, son nom (lu), fait ou pas. */
export interface PastilleJeu {
  jeu: string;
  initiale: string;
  nom: string;
  fait: boolean;
}

/** Ce que le jour d'un joueur a donné : `parfaite` (tous les jeux du jour finis), `joue` (au moins un), `rien`, `inconnu` (le classement n'a pas répondu). */
export type EtatDuJour = "parfaite" | "joue" | "rien" | "inconnu";

export interface BilanDuJour {
  etat: EtatDuJour;
  faits: number;
  total: number;
  /** Les jeux du jour dans l'ordre de la plateforme ; `null` si le classement n'a pas répondu (aucune pastille n'est inventée). */
  pastilles: PastilleJeu[] | null;
}

/** Le jeu qu'une ligne du classement a fini ? Un résultat non `null` pour ce code de jeu. */
const aFini = (l: LigneClassement | undefined, jeu: string): boolean => !!l && !!l.resultats[jeu];

/** La première lettre du nom d'un jeu (en capitale) : « T » pour Track, « J » pour Jump. */
export const initialeDe = (nom: string): string => [...nom.trim()][0]?.toLocaleUpperCase() ?? "";

/**
 * Le bilan d'un joueur sur les jeux du jour du cumul (`jeuxDuCumul` : ni la hauteur ni l'arcade). `ligne` : sa ligne du classement ; `undefined` : il n'y est pas (rien fini, ou un ami « absent »).
 * Sans classement (`jeux` `null`) : `inconnu`, sans pastille.
 */
export function bilanDuJour(jeux: Classement["jeux"] | null, ligne: LigneClassement | undefined, nom: (jeu: { jeu: string; nom: string }) => string): BilanDuJour {
  if (jeux === null) return { etat: "inconnu", faits: 0, total: 0, pastilles: null };
  const duCumul = jeuxDuCumul(jeux);
  const pastilles = duCumul.map((j) => ({ jeu: j.jeu, initiale: initialeDe(nom(j)), nom: nom(j), fait: aFini(ligne, j.jeu) }));
  const faits = pastilles.filter((p) => p.fait).length;
  const etat: EtatDuJour = duCumul.length > 0 && faits === duCumul.length ? "parfaite" : faits > 0 ? "joue" : "rien";
  return { etat, faits, total: duCumul.length, pastilles };
}

/** Une carte d'ami, prête à dessiner. */
export interface CarteAmi {
  ref: string;
  pseudo: string;
  /** L'adresse de son image (déjà passée par `adresseAvatar`, `Ami.image`), absente : ses initiales. */
  avatar?: string;
  /** Il t'a aussi parmi ses amis (« vous deux »), sinon « ajouté par toi ». */
  reciproque: boolean;
  bilan: BilanDuJour;
  /** Son rang entre amis au cumul du jour (toi compris) et son temps cumulé, quand il a tout fini. */
  rang: number | null;
  tempsMs: number | null;
  /** Le dernier jeu qu'il a fini (son dossier sur le site) et l'instant (ms) : sa ligne du classement « Amis » (lot U4, tous les amis) ; à défaut, `GET /api/portail/jour` (6 amis au plus). */
  dernier: { site: string; at: number } | null;
}

/**
 * Les cartes de tes amis, dans l'ordre du classement entre amis (rang), puis ceux qui n'ont rien fini, puis ceux que le classement ne nomme pas (dans l'ordre de ta liste). Toi, tu n'as pas de carte.
 * `classement` `null` (pas de réponse) : tous `inconnu`, dans l'ordre de ta liste.
 */
export function cartesDesAmis(o: {
  amis: readonly (Ami & { image?: string })[];
  classement: Pick<Classement, "top" | "jeux" | "absents"> | null;
  duJour: readonly AmiDuJour[] | null;
  nom: (jeu: { jeu: string; nom: string }) => string;
}): CarteAmi[] {
  const lignes = new Map<string, LigneClassement>();
  const ordre = new Map<string, number>();
  for (const l of o.classement?.top ?? []) if (l.ref && l.moi !== true && !lignes.has(l.ref)) (lignes.set(l.ref, l), ordre.set(l.ref, ordre.size));
  const absents = new Set((o.classement?.absents ?? []).map((a: AmiAbsent) => a.ref));
  const details = new Map((o.duJour ?? []).map((d) => [d.ref, d] as const));
  const rangDe = (ref: string): number => (ordre.has(ref) ? ordre.get(ref)! : absents.has(ref) ? 1e6 : 2e6);
  const tries = o.amis.map((a, i) => ({ a, i })).sort((x, y) => rangDe(x.a.ref) - rangDe(y.a.ref) || x.i - y.i);
  return tries.map(({ a }) => {
    const ligne = lignes.get(a.ref);
    const detail = details.get(a.ref);
    return {
      ref: a.ref,
      pseudo: a.pseudo,
      ...(a.image ? { avatar: a.image } : {}),
      reciproque: a.reciproque,
      bilan: bilanDuJour(o.classement ? o.classement.jeux : null, ligne, o.nom),
      rang: ligne && ligne.complet ? ligne.rang : null,
      tempsMs: ligne && ligne.complet ? ligne.tempsMs : null,
      dernier: ligne?.dernier ?? detail?.dernier ?? null,
    };
  });
}

/** Combien d'amis ont déjà joué aujourd'hui (au moins un jeu fini) ; `null` si le classement n'a pas répondu. */
export const ontJoue = (cartes: readonly CarteAmi[]): number | null => (cartes.some((c) => c.bilan.etat === "inconnu") ? null : cartes.filter((c) => c.bilan.etat === "parfaite" || c.bilan.etat === "joue").length);

/** Il y a combien de temps : `alInstant`, `minutes` (n) ou `heures` (n), sur l'heure du serveur (jamais négatif). */
export function ecoule(at: number, maintenant: number): { genre: "alInstant" | "minutes" | "heures"; n: number } {
  const minutes = Math.max(0, Math.floor((maintenant - at) / 60_000));
  if (minutes < 1) return { genre: "alInstant", n: 0 };
  return minutes < 60 ? { genre: "minutes", n: minutes } : { genre: "heures", n: Math.floor(minutes / 60) };
}

/** Un membre de ton groupe avec sa journée. */
export interface MembreAvecJournee {
  ref: string;
  pseudo: string;
  avatar?: string;
  chef: boolean;
  /** C'est toi. */
  moi: boolean;
  bilan: BilanDuJour;
}

/**
 * Les membres de ton groupe avec leur journée. `classement` : le classement « Mon groupe » du jour (toi et tes co-membres) ; `moi` : ta référence publique si on la connaît (sinon ton pseudo, unique sur la
 * plateforme, sert à te reconnaître). Les membres restent dans l'ordre du serveur (le chef d'abord, puis l'arrivée).
 */
export function membresDuGroupe(o: {
  membres: readonly { ref: string; pseudo: string; avatar?: string; chef: boolean }[];
  classement: Pick<Classement, "top" | "jeux"> | null;
  moi: { ref?: string; pseudo?: string | null };
  nom: (jeu: { jeu: string; nom: string }) => string;
}): MembreAvecJournee[] {
  const lignes = new Map<string, LigneClassement>();
  for (const l of o.classement?.top ?? []) if (l.ref) lignes.set(l.ref, l);
  const monPseudo = o.moi.pseudo?.trim().toLocaleLowerCase() ?? null;
  return o.membres.map((m) => ({
    ...m,
    moi: (!!o.moi.ref && m.ref === o.moi.ref) || (!o.moi.ref && monPseudo !== null && m.pseudo.toLocaleLowerCase() === monPseudo),
    bilan: bilanDuJour(o.classement ? o.classement.jeux : null, lignes.get(m.ref), o.nom),
  }));
}
