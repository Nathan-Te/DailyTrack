import type { SqlValue } from "../db";
import type { LigneBrute } from "./contrat";

// Lot K2 — **l'adaptateur de table** : ce qui dit au module des jeux quelle table de résultats lire et écrire, quelles colonnes servent le classement de la fiche (`classement.colonnes`), dans quel sens, et par quel
// index. Les trois tables existantes restent (`results`, `jump_results`, `tower_results` : aucune migration) ; **une table commune `resultats_jeu` (lot K4) sera un adaptateur de plus** : une seule table pour
// tous les jeux (`filtreJeu`), des clés de tri normalisées en croissant (`cle1 = -hauteur` : `sens: "asc"`, `signe: -1`), un seul index `(jeu, day, hidden, cle1, cle2, cle3, submitted_at, player_id)`.
// Ce fichier est pur : il fabrique le texte des requêtes (jamais d'accès à la base) ; `module.ts` les exécute. Aucune donnée n'y entre autrement que par `?` (les noms viennent de l'adaptateur, jamais d'un joueur).

export type Sens = "asc" | "desc";

export interface ColonneClassement {
  /** Le nom de la colonne dans la fiche du jeu (`classement.colonnes[].nom`) : celui que le contrat lit et écrit. */
  nom: string;
  /** Le nom de la colonne dans la table (le même pour les tables d'aujourd'hui, `cle1`… pour la table commune). */
  colonne: string;
  /** Le sens de l'index de la **table**. */
  sens: Sens;
  /** `-1` quand la table range la valeur opposée pour que tout se range en croissant (table commune) ; `1` (défaut) sinon. */
  signe?: 1 | -1;
  /** Lot K4c : une clé de la table commune que la fiche du jeu n'utilise pas (toujours 0) : elle reste dans l'ordre de l'index, `verifierAdaptateur` ne la demande pas à la fiche. */
  remplissage?: boolean;
}

export interface AdaptateurTable {
  /** La table des meilleures parties (une ligne par joueur et par jour : clé `(day, player_id)`). */
  table: string;
  /** Une table partagée par plusieurs jeux : la colonne qui nomme le jeu et sa valeur (une constante de code, jamais une donnée de joueur). */
  filtreJeu?: { colonne: string; valeur: string };
  /**
   * Les colonnes du classement, dans l'ordre de la fiche, **sans** les deux départages ultimes que toute table a (`submitted_at` croissant, puis `player_id` croissant : le premier envoyé passe devant,
   * puis l'identifiant). La colonne `medal`, `replay`, `inputs_hash`, `first_at`, `submitted_at`, `hidden`, `apercu` sont celles de la plateforme.
   */
  colonnes: readonly ColonneClassement[];
  /** La table n'a pas de colonne `medal` : la médaille se calcule sur le niveau du jour (`ContratJeu.medailleDeLigne`). */
  sansMedaille?: boolean;
  /** Des colonnes de plus que lisent le haut du classement, la ligne du joueur et son meilleur précédent (Jump : `deaths`). */
  lecturesPlus?: readonly string[];
  /** Lot D2 (C5) : des colonnes de plus pour la seule requête du renvoi déjà accepté (Tower : la hauteur la plus haute atteinte, que sa réponse rend). */
  lecturesDeja?: readonly string[];
  /** Les colonnes écrites à l'insertion après `day` et `player_id`, dans l'ordre. */
  colonnesEcrites: readonly string[];
  /** Celles que le remplacement par une meilleure partie ne touche pas (le premier envoi, la marque de masquage, l'aperçu). */
  colonnesGardees: readonly string[];
  /**
   * La table du niveau du jour : une ligne par jour (`day`, `rule`, `created_at` + `colonnes`). Aucune donnée de joueur. **Absente (lot K4c, jeux sur `resultats_jeu`)** : le niveau du jour se recalcule à la
   * demande et ne se garde qu'en mémoire de l'instance — il est déterministe et bon marché, et le lot n'ajoute aucune table de niveaux.
   */
  niveaux?: { table: string; colonnes: readonly string[] };
}

/** Les départages ultimes de toute table de résultats (la fiche les nomme à la fin de `classement.colonnes`). */
export const DEPARTAGES = [
  { nom: "submitted_at", sens: "asc" },
  { nom: "player_id", sens: "asc" },
] as const;

const IDENT = /^[a-z][a-z0-9_]*$/;
const ident = (s: string): string => {
  if (!IDENT.test(s)) throw new Error(`nom de table ou de colonne refusé : ${s}`);
  return s;
};

/** Le texte et les paramètres des requêtes d'un jeu, fabriqués une fois à partir de l'adaptateur. */
export interface SqlDuJeu {
  /** La condition de portée : `jeu = 'tower' AND ` pour une table partagée, vide sinon. */
  portee: string;
  /** Les colonnes de classement lues, avec leur nom de fiche : `hauteur_mm, vies, ticks`. */
  lecture: string;
  /** Le nombre de parties qui passent devant (+ 1 = le rang) : paramètres `parametresRang`. */
  rang: string;
  parametresRang(jour: number, score: Record<string, number>, at: number, id: string): SqlValue[];
  participants: string;
  /** Les parties d'un jour, masquées comprises (le tableau de bord de l'administration). */
  compteJour: string;
  top: string;
  moi: string;
  precedent: string;
  /** Lot D2 (C5) : la partie déjà écrite de ce joueur ce jour-là **si c'est exactement cette rediffusion** (même texte) : le renvoi répond avant le rejeu. Paramètres : jour, joueur, aperçu, texte. */
  deja: string;
  /** `INSERT … ON CONFLICT DO UPDATE` du meilleur résultat : paramètres dans l'ordre de `colonnesInsert`. */
  insertion: string;
  colonnesInsert: readonly string[];
  parClasse: string;
  /** Les classés d'un jour dans l'ordre du classement (portail, groupes, amis). */
  classes: string;
  etat: string;
  joursFinis: string;
  profil: string;
  administration: { compte: string; liste: string; retrait: string };
  moiProfil: string;
  classe: string;
  copie: string;
  masquer: string;
  supprimerJour: string;
  rotation: string;
  compteJoueur: string;
  effacer: string;
  viderApercu: string;
}

const dans = (colonne: string, nom: string) => (colonne === nom ? colonne : `${colonne} AS ${nom}`);

/** Compare la fiche et l'adaptateur : mêmes colonnes, dans le même ordre et le même sens **effectif** (le sens de la table retourné par le signe). Lève sinon. */
export function verifierAdaptateur(fiche: readonly { nom: string; sens: Sens }[], a: AdaptateurTable): void {
  const voulu = [...a.colonnes.filter((c) => !c.remplissage).map((c) => ({ nom: c.nom, sens: (c.signe === -1 ? (c.sens === "asc" ? "desc" : "asc") : c.sens) as Sens })), ...DEPARTAGES];
  const lu = JSON.stringify(fiche.map((c) => [c.nom, c.sens]));
  if (JSON.stringify(voulu.map((c) => [c.nom, c.sens])) !== lu) throw new Error(`l'adaptateur de ${a.table} ne dit pas le classement de la fiche : ${lu}`);
}

export function sqlDe(a: AdaptateurTable): SqlDuJeu {
  const T = ident(a.table);
  const jeu = a.filtreJeu ? { colonne: ident(a.filtreJeu.colonne), valeur: ident(a.filtreJeu.valeur) } : null;
  const portee = jeu ? `${jeu.colonne} = '${jeu.valeur}' AND ` : "";
  const porteeR = jeu ? `r.${jeu.colonne} = '${jeu.valeur}' AND ` : "";
  const cs = a.colonnes.map((c) => ({ ...c, colonne: ident(c.colonne), nom: ident(c.nom) }));
  const lecture = cs.map((c) => dans(c.colonne, c.nom)).join(", ");
  const lectureR = cs.map((c) => `r.${c.colonne} AS ${c.nom}`).join(", ");
  const ordreR = [...cs.map((c) => `r.${c.colonne} ${c.sens.toUpperCase()}`), "r.submitted_at ASC", "r.player_id ASC"].join(", ");
  const ordre = [...cs.map((c) => `${c.colonne} ${c.sens.toUpperCase()}`), "submitted_at ASC", "player_id ASC"].join(", ");

  // Le rang : une recherche d'index par colonne (« plus loin que moi, les colonnes d'avant à égalité »), plus une pour les départages ultimes.
  const devant = (c: { colonne: string; sens: Sens }) => (c.sens === "desc" ? ">" : "<");
  const sous: string[] = cs.map((c, i) => `(SELECT COUNT(*) FROM ${T} WHERE ${portee}day = ? AND hidden = 0${cs.slice(0, i).map((p) => ` AND ${p.colonne} = ?`).join("")} AND ${c.colonne} ${devant(c)} ?)`);
  sous.push(`(SELECT COUNT(*) FROM ${T} WHERE ${portee}day = ? AND hidden = 0${cs.map((p) => ` AND ${p.colonne} = ?`).join("")} AND (submitted_at < ? OR (submitted_at = ? AND player_id < ?)))`);
  const rang = `SELECT ${sous.join(" + ")} AS n`;
  const valeurs = (score: Record<string, number>) => cs.map((c) => (score[c.nom] ?? 0) * (c.signe ?? 1));
  const parametresRang = (jour: number, score: Record<string, number>, at: number, id: string): SqlValue[] => {
    const v = valeurs(score);
    const p: SqlValue[] = [];
    for (let i = 0; i < cs.length; i++) p.push(jour, ...v.slice(0, i), v[i]!);
    p.push(jour, ...v, at, at, id);
    return p;
  };

  const ecrites = a.colonnesEcrites.map(ident);
  const gardees = new Set(a.colonnesGardees);
  const meilleur = ((): string => {
    // « Strictement meilleur » dans l'ordre du classement : la première colonne qui diffère décide.
    const expr = (i: number): string => {
      const c = cs[i]!;
      const mieux = `excluded.${c.colonne} ${devant(c)} ${T}.${c.colonne}`;
      return i === cs.length - 1 ? mieux : `${mieux} OR (excluded.${c.colonne} = ${T}.${c.colonne} AND (${expr(i + 1)}))`;
    };
    return expr(0);
  })();
  const insertion =
    `INSERT INTO ${T} (${jeu ? `${jeu.colonne}, ` : ""}day, player_id, ${ecrites.join(", ")})
         VALUES (${jeu ? `'${jeu.valeur}', ` : ""}?, ?, ${ecrites.map(() => "?").join(", ")})
         ON CONFLICT (${jeu ? `${jeu.colonne}, ` : ""}day, player_id) DO UPDATE SET ${ecrites.filter((c) => !gardees.has(c)).map((c) => `${c} = excluded.${c}`).join(", ")}
         WHERE ${T}.apercu = excluded.apercu AND (${meilleur})`;

  const plus = (a.lecturesPlus ?? []).map(ident);
  const medal = a.sansMedaille ? [] : ["medal"];
  const brut = [...cs.map((c) => dans(c.colonne, c.nom)), ...medal].join(", ");
  const brutPlus = [...cs.map((c) => dans(c.colonne, c.nom)), ...plus, ...medal].join(", ");
  const brutR = [...cs.map((c) => `r.${c.colonne} AS ${c.nom}`), ...plus.map((c) => `r.${c} AS ${c}`), ...medal.map(() => "r.medal AS medal")].join(", ");
  const P = portee;
  return {
    portee,
    lecture,
    rang,
    parametresRang,
    participants: `SELECT COUNT(*) AS n FROM ${T} WHERE ${P}day = ? AND hidden = 0`,
    compteJour: `SELECT COUNT(*) AS n FROM ${T} WHERE ${P}day = ?`,
    top: `SELECT ${brutR}, p.name AS name, p.ref AS ref FROM ${T} r JOIN players p ON p.id = r.player_id WHERE ${porteeR}r.day = ? AND r.hidden = 0 ORDER BY ${ordreR} LIMIT ?`,
    moi: `SELECT ${brutR}, r.submitted_at AS submitted_at, p.name AS name, p.ref AS ref FROM ${T} r JOIN players p ON p.id = r.player_id WHERE ${porteeR}r.day = ? AND r.player_id = ?`,
    precedent: `SELECT ${brutPlus}, submitted_at FROM ${T} WHERE ${P}day = ? AND player_id = ? AND apercu = ?`,
    deja: `SELECT ${[brutPlus, ...(a.lecturesDeja ?? []).map(ident)].join(", ")}, submitted_at FROM ${T} WHERE ${P}day = ? AND player_id = ? AND apercu = ? AND replay = ?`,
    insertion,
    colonnesInsert: ecrites,
    parClasse: ordre,
    classes: `SELECT player_id, ${brut}, submitted_at FROM ${T} WHERE ${P}day = ? AND hidden = 0 ORDER BY ${ordre}`,
    etat: `SELECT ${brut}, submitted_at FROM ${T} WHERE ${P}day = ? AND player_id = ?`,
    joursFinis: `SELECT day FROM ${T} WHERE ${P}player_id = ?`,
    profil: `SELECT day, ${brut}, submitted_at FROM ${T} WHERE ${P}player_id = ?`,
    administration: {
      compte: `SELECT COUNT(*) AS n FROM ${T} WHERE ${P}player_id = ?`,
      liste: `SELECT day, ${brut}, submitted_at, hidden FROM ${T} WHERE ${P}player_id = ? ORDER BY day DESC LIMIT ?`,
      retrait: `SELECT ${brut}, replay, inputs_hash FROM ${T} WHERE ${P}day = ? AND player_id = ?`,
    },
    moiProfil: `SELECT day, ${brut} FROM ${T} WHERE ${P}player_id = ? ORDER BY day ASC`,
    classe: `SELECT 1 AS n FROM ${T} WHERE ${P}day = ? AND player_id = ?`,
    copie: `SELECT 1 AS n FROM ${T} WHERE ${P}day = ? AND inputs_hash = ? AND player_id <> ? LIMIT 1`,
    masquer: `UPDATE ${T} SET hidden = ? WHERE ${P}player_id = ?`,
    supprimerJour: `DELETE FROM ${T} WHERE ${P}day = ? AND player_id = ?`,
    rotation: `UPDATE ${T} SET player_id = ? WHERE ${P}player_id = ?`,
    compteJoueur: `SELECT COUNT(*) AS n FROM ${T} WHERE ${P}player_id = ?`,
    effacer: `DELETE FROM ${T} WHERE ${P}player_id = ?`,
    viderApercu: `DELETE FROM ${T} WHERE ${P}apercu = 1`,
  };
}

/** Passe d'une ligne de la table (colonnes lues sous leur nom de fiche) aux valeurs de la fiche : le signe de la table commune s'annule ici. */
export function versFiche(a: AdaptateurTable, ligne: LigneBrute): LigneBrute {
  const out: LigneBrute = { ...ligne };
  for (const c of a.colonnes) if (c.signe === -1 && typeof out[c.nom] === "number") out[c.nom] = -(out[c.nom] as number) || 0;
  return out;
}

/** Les valeurs à écrire, par nom de colonne de la table : le score de la fiche (signe appliqué) et les autres colonnes. */
export function versTable(a: AdaptateurTable, score: Record<string, number>, autres: Record<string, SqlValue>): Record<string, SqlValue> {
  const out: Record<string, SqlValue> = { ...autres };
  for (const c of a.colonnes) out[c.colonne] = (score[c.nom] ?? 0) * (c.signe ?? 1) || 0;
  return out;
}

/** Lot K4c — les colonnes de `resultats_jeu` : ce qu'un jeu neuf ne décrit pas, la plateforme l'écrit. */
export const COLONNES_ECRITES_RESULTATS_JEU = ["cle1", "cle2", "cle3", "medal", "replay", "sim_version", "generator_version", "mesures", "first_at", "submitted_at", "inputs_hash", "hidden", "apercu"] as const;
export const CLES_RESULTATS_JEU = 3;

/**
 * **L'adaptateur de la table commune `resultats_jeu`** (lot K4c) : une seule table pour tous les jeux neufs (`jeu = '<code>'`), trois clés de tri **normalisées en croissant** (`cle1 = -score` pour un score
 * qui se classe du plus grand au plus petit : `signe: -1`) et un seul index `(jeu, day, hidden, cle1, cle2, cle3, submitted_at, player_id)` qui sert tous les sens. Les colonnes de classement viennent de la
 * fiche du jeu (une à trois, sans les deux départages ultimes) ; les clés qu'elle n'utilise pas restent à 0 (`remplissage`). Les valeurs en plus qu'une partie veut garder vont en `mesures` (JSON).
 */
export function adaptateurResultatsJeu(code: string, colonnesFiche: readonly { nom: string; sens: Sens }[]): AdaptateurTable {
  const reelles = colonnesFiche.filter((c) => c.nom !== DEPARTAGES[0].nom && c.nom !== DEPARTAGES[1].nom);
  if (reelles.length < 1 || reelles.length > CLES_RESULTATS_JEU) throw new Error(`${code} : la table commune range une à ${CLES_RESULTATS_JEU} colonnes de classement (${reelles.length} dans la fiche)`);
  const colonnes: ColonneClassement[] = reelles.map((c, i) => ({ nom: c.nom, colonne: `cle${i + 1}`, sens: "asc", signe: c.sens === "desc" ? -1 : 1 }));
  for (let i = colonnes.length; i < CLES_RESULTATS_JEU; i++) colonnes.push({ nom: `cle${i + 1}`, colonne: `cle${i + 1}`, sens: "asc", remplissage: true });
  return { table: "resultats_jeu", filtreJeu: { colonne: "jeu", valeur: code }, colonnes, colonnesEcrites: COLONNES_ECRITES_RESULTATS_JEU, colonnesGardees: ["first_at", "hidden", "apercu"] };
}
