import type { SqlValue } from "../db";
import type { CodeErreur } from "../codesErreur";
import type { JourPortail, ScorePortail } from "../games";

// Lot K2 — **le contrat d'un jeu** pour le module des jeux (`module.ts`). Un jeu qui se classe sur le serveur fournit ce contrat et un adaptateur de table (`adaptateur.ts`) ; le module fait tout le reste
// (routes, ordre de validation, classement, amis, groupes, copies, fantôme, aperçu, effacement, crochets du portail et de l'administration).
//
// **Le contrat ne connaît ni la base, ni HTTP** : il ne lit ni n'écrit aucune table (la persistance du niveau du jour passe par l'adaptateur, la ligne que le contrat rend est une suite de valeurs), il ne construit
// aucune réponse HTTP ni aucune `HttpError` (il lève `RefusJeu`, avec un code de la liste unique `codesErreur.ts`, que le module traduit). Il reçoit seulement le journal (`Logger`) quand il en a besoin.
// Écarts avec la conception du lot K0 (§ 4) : voir `docs/plateforme/lots/lot-K2-module-serveur-des-jeux.md`.

/** Un refus du jeu (rediffusion illisible, autre version, partie inachevée…) : un code de la liste unique ; le module en fait la réponse. */
export class RefusJeu extends Error {
  constructor(
    readonly code: CodeErreur,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Ce que le module garde du niveau du jour dans la table des niveaux de l'adaptateur (colonnes de `AdaptateurTable.niveaux.colonnes`, dans l'ordre). */
export type LigneNiveau = Record<string, SqlValue>;

/** Le niveau calculé d'un jour, et la ligne qui permet de le retrouver sans le recalculer. */
export interface NiveauCalcule<Niveau> {
  niveau: Niveau;
  ligne: LigneNiveau;
}

/** Ce que rend un rejeu : les colonnes du classement, par leur nom de colonne, et celles que la partie écrit en plus. */
export interface Rejouee {
  /** La valeur de chaque colonne de classement (`AdaptateurTable.colonnes`, sans les deux départages ultimes). */
  score: Record<string, number>;
  /** Les autres colonnes à écrire (`AdaptateurTable.colonnesEcrites` moins ce que le module pose lui-même). */
  autres: Record<string, SqlValue>;
}

/** Une ligne de la table des résultats telle qu'on la lit : les colonnes de classement, `medal`, éventuellement `submitted_at`, `name`, `ref`. */
export type LigneBrute = Record<string, SqlValue>;

/** Un jour que le joueur a classé (profil `GET <jeu>/me`) : sa ligne brute. */
export interface JourProfil {
  day: number;
  brute: LigneBrute;
}

export interface ContratJeu<Niveau, Rejeu, Mesure> {
  /** Le nom des lignes de journal (« DailyTower » : « DailyTower : partie du jour »). */
  nomJournal: string;
  /** Le nom du compte d'effacement rendu à l'administration (`partiesDailyTower`). */
  compteEffacement: string;
  /** Les versions du jeu telles que `info` et `me` les rendent (`{ simVersion, generatorVersion }`). */
  versions(): Record<string, number>;
  /** Les jours de l'image (AAAA-MM-JJ, triés) : `info` et « jours prêts » de l'administration. */
  joursFiges: readonly string[];

  // --- Le niveau du jour --------------------------------------------------------------------------------------------------------------
  /** La règle qui produit le niveau d'un jour (versions et empreinte du fichier figé) : une autre règle = recalcul. */
  regle(jour: number): Promise<string>;
  /** Le niveau d'un jour par la règle du jeu : le fichier figé s'il se vérifie, sinon le générateur. Pure ; la ligne rendue est gardée par le module. */
  calculer(jour: number): Promise<NiveauCalcule<Niveau>>;
  /** Le niveau retrouvé depuis sa ligne gardée ; lève si la ligne est abîmée (le module recalcule). */
  restaurer(jour: number, ligne: LigneNiveau): Niveau;
  /** Ce que le journal dit d'un jour calculé (aucune donnée de joueur). */
  champsJournalJour(niveau: Niveau): Record<string, unknown>;
  /** `GET <jeu>/day/<date>` : le contenu du jour tel que le serveur le rend (jamais la preuve de l'auteur). */
  infoJour(niveau: Niveau): unknown;
  /** Ce que le portail montre du jour (numéro, thème, seuils). */
  portailJour(niveau: Niveau, jour: number): JourPortail;
  /** L'empreinte (déjà hachée) des entrées de la preuve de l'auteur, ou `null` (jour généré) : refus des copies. */
  empreinteAuteur(niveau: Niveau): string | null;

  // --- Un envoi -------------------------------------------------------------------------------------------------------------------------
  /** Le texte envoyé, décodé et contrôlé (taille, format, versions connues, réglages permis) ; lève `RefusJeu`. */
  decoder(texte: unknown): Rejeu;
  /** Le jour que nomme la rediffusion, ou `null` pour un scénario d'essai (jamais classé). */
  jourDe(rejeu: Rejeu): number | null;
  /** La rediffusion nomme le contenu que le serveur sert ce jour-là ; lève `RefusJeu("version")` sinon. */
  memeContenu(rejeu: Rejeu, niveau: Niveau): void;
  /** Les entrées effectivement jouées, en texte canonique (le module en prend l'empreinte SHA-256 pour refuser les copies). */
  entrees(rejeu: Rejeu): string;
  /** Le rejeu, la seule source du résultat. Le module a déjà compté `unitesRejeu` dans le plafond global. Lève `RefusJeu` pour une partie refusée. */
  rejouer(niveau: Niveau, texte: string): Promise<Mesure>;
  /** Les valeurs à écrire pour cette partie. */
  rejouee(niveau: Niveau, rejeu: Rejeu, mesure: Mesure): Rejouee;
  /** La médaille obtenue (code commun `author|gold|silver|bronze`) par ce score sur ce niveau. */
  medaille(niveau: Niveau, score: Record<string, number>): string | null;
  /** Ce que le journal dit d'une partie acceptée (aucune donnée de joueur ; `executeur` : où le rejeu s'est calculé). */
  champsJournalPartie(mesure: Mesure, improved: boolean): Record<string, unknown>;
  /** La durée de la partie, pour la validation du registre (`validate`). */
  validation(mesure: Mesure): { ms: number; ticks?: number };

  // --- La présentation (formats des réponses) ---------------------------------------------------------------------------------------------
  /** Une ligne du classement : `brute` porte les colonnes de classement, `medal`, `name`, `ref`. */
  ligneClassement(rang: number, brute: LigneBrute): unknown;
  /** La réponse d'un envoi accepté. */
  reponseEnvoi(c: { date: string; mesure: Mesure; medaille: string | null; improved: boolean; meilleur: LigneBrute; rang: number; participants: number; board: unknown }): unknown;
  /** Un jour du profil `me`. */
  jourProfil(brute: LigneBrute, date: string): unknown;
  /** Le temps de la partie (ms), le score et les pas d'une ligne : ce que le portail et l'administration lisent. */
  versPortail(brute: LigneBrute): { tempsMs: number; score?: ScorePortail; ticks?: number };

  /** Le fantôme réservé aux classés (`GET <jeu>/day/<date>/<route>`) ; absent : le jeu n'en a pas. */
  fantome?: {
    route: string;
    /** La réponse pour ce jour ; lève `RefusJeu("no_ghost")` si le jour n'a pas de preuve. */
    lire(niveau: Niveau, jour: number): unknown;
  };
}
