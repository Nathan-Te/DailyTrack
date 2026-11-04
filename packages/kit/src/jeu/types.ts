import type { Catalogue } from "@cdj/ui";
import type { ActionCommande } from "@cdj/ui/src/commandes";
import type { Sens } from "../records";

// Lot K4f — **ce qu'un jeu neuf donne à `brancherJeu`** : sa fiche (le sous-ensemble que le client lit ; `test/fiche.test.ts` vérifie qu'il dit la même chose que `config/jeux/<id>.json`), et sa définition — sa
// simulation, son rendu, ses écrans propres. Tout le reste (l'interrupteur, les écrans de la plateforme, le serveur, les records, la file d'envoi, les amis, la manette…) est le kit.

export interface FicheClient {
  /** Le dossier du jeu sur le site, le code de ses routes (`/api/<id>/`) et la clé de sa fiche. */
  id: string;
  /** Le nom du jeu (celui de la fiche) : l'interrupteur et la ligne à partager. */
  nom: string;
  /** Les colonnes de classement de la fiche, sans les deux départages ultimes (`submitted_at`, `player_id`) : leur nom et leur sens. */
  colonnes: readonly { nom: string; sens: Sens }[];
  /** Les codes des thèmes. */
  themes: readonly string[];
  /** Le préfixe de stockage de la fiche (`cibles:`). */
  prefixe: string;
  /** Le premier jour du jeu (`AAAA-MM-JJ`). */
  premierJour: string;
}

export type CodeMedaille = "author" | "gold" | "silver" | "bronze";
export interface Seuils {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

export interface OptionsPartie {
  theme: string;
  /** `prefers-reduced-motion` ou le réglage du joueur. */
  reduit: boolean;
  tactile: boolean;
  /** Le nom de la scène pour les lecteurs d'écran (clé `scene.aria` du catalogue du jeu, déjà traduite). */
  libelle: string;
  /** Le fantôme choisi : la rediffusion à montrer (la meilleure partie du joueur, ou celle du Diamant), ou `null`. */
  fantome: string | null;
}

/** Une partie en cours, côté jeu : son état, son rendu et ses entrées de scène. Le kit en tient la boucle, le HUD, la pause et la fin. */
export interface PartieDuJeu {
  /** Un pas de la simulation (appelé `ticksParSeconde` fois par seconde, jamais pendant la pause). */
  avancer(): void;
  /** Dessine l'état courant (à chaque image). */
  dessiner(): void;
  finie(): boolean;
  /** Une action discrète : une des actions du jeu (clavier, manette) — l'identifiant est celui de `DefinitionJeu.actions`. */
  action(id: string): void;
  /** Ce que le HUD compact montre : le score et le temps restant, déjà formatés. */
  hud(): { principal: string; secondaire: string };
  /** Le résultat : les colonnes de classement (dans l'ordre de la fiche) et la rediffusion à envoyer. */
  resultat(): { score: number[]; rediffusion: string };
  /** Le fantôme change (la rediffusion à montrer, ou `null`). */
  fantome(rediffusion: string | null): void;
  detruire(): void;
}

export interface DefinitionJeu<C> {
  /** Pas de simulation par seconde. */
  ticksParSeconde: number;
  /** Les versions annoncées au serveur (le jeu périmé est reconnu) : celles de ses constantes. */
  versions: { simVersion: number; generatorVersion: number };
  /** Les actions propres du jeu ; `pause`, `recommencer` et `fantome` sont ajoutées par le kit. */
  actions: readonly ActionCommande[];
  themeDuJour(jour: number): string;
  /** Le numéro de la partie d'un jour (≤ 0 avant le premier jour). */
  numero(jour: number): number;
  /** Le contenu d'un jour : son fichier figé s'il existe, sinon le générateur. */
  contenuDuJour(jour: number, base: string): Promise<C>;
  seuils(contenu: C): Seuils;
  medaille(score: readonly number[], seuils: Seuils): CodeMedaille | null;
  /** Une partie neuve, dessinée dans `hote`. */
  nouvellePartie(contenu: C, hote: HTMLElement, o: OptionsPartie): PartieDuJeu;
  /** La rediffusion du Diamant (la partie de l'auteur), montrée par le fantôme « Diamant ». */
  rediffusionDiamant(contenu: C): string;
  /** Un score écrit pour un joueur (`17 / 20`). */
  formatScore(score: readonly number[], langue: "fr" | "en"): string;
  /** Un score écrit pour la ligne à partager (court). */
  scorePartage(score: readonly number[], langue: "fr" | "en"): string;
  /** Les « points » de l'aide « Comment jouer » (clés du catalogue du jeu), dans l'ordre. */
  aide: readonly string[];
}

export interface CataloguesJeu {
  /** Le français : celui du kit et du jeu, réunis. */
  fr: Catalogue;
  /** L'anglais, à la demande : le catalogue du jeu et le catalogue commun de `@cdj/ui`. */
  chargerEn(): Promise<{ jeu: Catalogue; commun: Catalogue }>;
}

export interface OptionsBrancher {
  catalogues: CataloguesJeu;
  /** La musique commune (`brancherMusique(id, gameStorage)`), une seule instance. */
  musique: import("@cdj/musique/branche").Musique;
  /** L'élément racine de la page (`<div id="app">`). */
  racine: HTMLElement;
}

import type { Donnees } from "./donnees";
import type { I18n } from "./i18n";
import type { OptionsUrl } from "./session";

/** Ce que les écrans à la demande reçoivent de l'accueil. */
export interface ContexteJeu<C> {
  fiche: FicheClient;
  def: DefinitionJeu<C>;
  o: OptionsBrancher;
  options: OptionsUrl;
  i18n: I18n;
  donnees: Donnees;
  /** Le jour joué (numéro de jour civil) et sa date. */
  jour: number;
  date: string;
  theme: string;
  /** Un jour passé (`?seed=`) : jamais classé. */
  archive: boolean;
  musique: import("@cdj/musique/branche").Musique;
}
export interface ContextePartie<C> extends ContexteJeu<C> {
  contenu: C;
  /** Le joueur est déjà classé aujourd'hui (le serveur l'a dit à l'accueil). */
  classementConnu: boolean;
  /** Retour à l'accueil du jeu (la page se recharge). */
  retour(): void;
}
