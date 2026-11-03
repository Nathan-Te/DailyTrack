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

/** Ce que le module met à la disposition de `valider`. */
export interface ContexteValidation<Niveau> {
  /** Le niveau d'un jour (celui du module : lu en base si la règle est la même, sinon calculé une seule fois). */
  niveau(jour: number): Promise<Niveau>;
  /** Le jour accepte-t-il encore des envois (aujourd'hui à Paris, hier pendant la grâce) ? */
  ouvert(jour: number): boolean;
  /** À appeler juste avant le plafond de rejeux : joueur actif et pseudo (le module garde `known` et `name`). */
  avantRejeu(): Promise<void>;
}

/** Ce que rend `valider` : l'envoi validé et rejoué. */
export interface Validation<Niveau, Rejeu, Mesure> {
  jour: number;
  niveau: Niveau;
  rejeu: Rejeu;
  mesure: Mesure;
  /** SHA-256 des entrées jouées (copies) et celui des entrées de l'auteur (`null` : pas calculé). */
  empreinte: string;
  empreinteAuteur: string | null;
}

/** Ce que reçoit `tableau` : tout ce que le module a lu pour le classement d'un jour, le niveau et la place restant à la demande. */
export interface ContexteTableau<Niveau> {
  date: string;
  ouvert: boolean;
  participants: number;
  /** Le haut du classement (lignes brutes avec `name`, `ref`). */
  top: LigneBrute[];
  /** La ligne du joueur qui regarde (brute, avec `name`, `ref`, `submitted_at`), ou `null`. */
  moi: LigneBrute | null;
  rangMoi(): Promise<number>;
  niveau(): Promise<Niveau>;
  /** Vrai pour le classement rendu avec un envoi : la ligne du joueur est celle qu'il vient d'écrire (même si les classements publics l'écartent). */
  apresEnvoi: boolean;
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
  // La validation standard (Tower) : décoder, jour, contenu, copies, rejeu. **Ou bien** `valider` (ci-dessous) : un jeu dont l'ordre des contrôles est le sien (Jump) la délègue tout entière.
  /** Le texte envoyé, décodé et contrôlé (taille, format, versions connues, réglages permis) ; lève `RefusJeu`. */
  decoder?(texte: unknown): Rejeu;
  /** Le jour que nomme la rediffusion, ou `null` pour un scénario d'essai (jamais classé). */
  jourDe?(rejeu: Rejeu): number | null;
  /** La rediffusion nomme le contenu que le serveur sert ce jour-là ; lève `RefusJeu("version")` sinon. */
  memeContenu?(rejeu: Rejeu, niveau: Niveau): void;
  /** Les entrées effectivement jouées, en texte canonique (le module en prend l'empreinte SHA-256 pour refuser les copies). */
  entrees?(rejeu: Rejeu): string;
  /** Le rejeu, la seule source du résultat. Le module a déjà compté `unitesRejeu` dans le plafond global. Lève `RefusJeu` pour une partie refusée. */
  rejouer?(niveau: Niveau, texte: string): Promise<Mesure>;
  /**
   * **Point d'extension : la validation entière d'un envoi, dans l'ordre du jeu** (lot K2b). Le module a déjà vérifié le débit et la taille du corps ; `valider` contrôle le jour, les versions, la
   * rediffusion et son contenu, appelle `ctx.avantRejeu()` (joueur actif et pseudo, bon marché) juste avant de dépenser le plafond de rejeux et de rejouer, et rend ce que le module écrit.
   * Le module fait ensuite les copies (après le rejeu), l'écriture, le classement et la réponse. Lève `RefusJeu`.
   */
  valider?(corps: Record<string, unknown>, ctx: ContexteValidation<Niveau>): Promise<Validation<Niveau, Rejeu, Mesure>>;
  /** Le corps qu'un envoi du registre (`validate`) fait passer par `valider` : le niveau du jour et la rediffusion déjà connus. */
  corpsDeRegistre?(niveau: Niveau, code: string): Record<string, unknown>;
  /** Le plafond de rejeux (unités) que coûte cette rediffusion ; défaut : `rejeu.unitesServeur` de la fiche (Tower : un poids fixe). */
  unites?(rejeu: Rejeu): number;
  /** Les valeurs à écrire pour cette partie. */
  rejouee(niveau: Niveau, rejeu: Rejeu, mesure: Mesure): Rejouee;
  /** La médaille obtenue (code commun `author|gold|silver|bronze`) par ce score sur ce niveau. */
  medaille(niveau: Niveau, score: Record<string, number>): string | null;
  /** Ce que le journal dit d'une partie acceptée (aucune donnée de joueur ; `executeur` : où le rejeu s'est calculé). */
  champsJournalPartie(mesure: Mesure, improved: boolean): Record<string, unknown>;
  /** La durée de la partie, pour la validation du registre (`validate`). */
  validation(mesure: Mesure): { ms: number; ticks?: number; deaths?: number };

  // --- La présentation (formats des réponses) ---------------------------------------------------------------------------------------------
  /** Une ligne du classement : `brute` porte les colonnes de classement, `medal`, `name`, `ref`. */
  ligneClassement?(rang: number, brute: LigneBrute): unknown;
  /** La réponse d'un envoi accepté. */
  reponseEnvoi(c: { date: string; jour: number; niveau: Niveau; mesure: Mesure; medaille: string | null; improved: boolean; meilleur: LigneBrute; rang: number; participants: number; board: unknown }): unknown;
  /** Un jour du profil `me`. */
  jourProfil?(brute: LigneBrute, date: string): unknown;
  /** **Point d'extension du classement** : met en forme le classement d'un jour (défaut : `{ date, open, participants, top, me, generation }`). Sert aussi la réponse d'un envoi (`apresEnvoi`). */
  tableau?(c: ContexteTableau<Niveau>): Promise<unknown>;
  /** La médaille d'une ligne quand la table n'a pas de colonne `medal` (`AdaptateurTable.sansMedaille`) : calculée sur le niveau du jour. */
  medailleDeLigne?(niveau: Niveau, brute: LigneBrute): string | null;
  /** L'état d'un joueur qui n'a aucun résultat classé ce jour-là (défaut : `pas_joue`) : Jump y lit ses vies (`en_cours`). */
  etatSansEssai?(playerId: string, day: number): Promise<import("../games").EtatPortail>;
  /** Les textes de journal du jeu (défaut : `<nomJournal> : jour calculé` et `<nomJournal> : partie du jour`). */
  messagesJournal?: { jour: string; partie: string };
  /** Le premier jour du jeu : avant lui `day/<date>` répond `404 unknown_day` (défaut : aucun contrôle). */
  jourMin?: number;
  /** Le temps de la partie (ms), le score et les pas d'une ligne : ce que le portail et l'administration lisent. */
  versPortail(brute: LigneBrute): { tempsMs: number; score?: ScorePortail; ticks?: number };

  /** Le fantôme réservé aux classés (`GET <jeu>/day/<date>/<route>`) ; absent : le jeu n'en a pas. */
  fantome?: {
    route: string;
    /** La réponse pour ce jour ; lève `RefusJeu("no_ghost")` si le jour n'a pas de preuve. */
    lire(niveau: Niveau, jour: number): unknown;
  };
}
