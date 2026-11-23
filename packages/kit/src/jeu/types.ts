import type { Catalogue, OrientationPleinEcran } from "@cdj/ui";
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
  /** Lot K5 — la catégorie de la fiche : un jeu `arcade` ou `party` (lot PA1) ne compte pas dans la journée, son accueil et son arrivée n'annoncent donc jamais « Journée parfaite ». Absente : `jour`. */
  categorie?: "jour" | "arcade" | "party";
}

export type CodeMedaille = "author" | "gold" | "silver" | "bronze";
export interface Seuils {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

/** Un traducteur : une clé du catalogue du jeu (celui du kit y est réuni) et ses paramètres. */
export type Traduire = (cle: string, params?: Readonly<Record<string, string | number>>) => string;

/**
 * Lot PG1 — **les zones du HUD en surimpression** (`DefinitionJeu.hud: "surimpression"`), posées sur le plateau par le kit : trois colonnes en haut (`hautGauche`, `centre`, `hautDroite`) et l'annonce, au milieu
 * (un nom de thème qui apparaît, un « Prêt ? »). Vides à chaque partie ; le jeu les remplit à chaque image, en `textContent` et en éléments du socle (jamais `innerHTML`), avec les classes du kit
 * (`jeu-surimpression__valeur` : un grand nombre ; `jeu-surimpression__etiquette` : une pastille ; `jeu-surimpression__cartouche` : un cartouche de papier) ou les siennes, aux jetons `--dj-*`. Elles ne reçoivent aucun toucher.
 */
export interface ZonesSurimpression {
  hautGauche: HTMLElement;
  centre: HTMLElement;
  hautDroite: HTMLElement;
  annonce: HTMLElement;
}

export interface OptionsPartie {
  theme: string;
  /** Lot PG1 — les zones du HUD en surimpression, **seulement** pour une définition qui dit `hud: "surimpression"` (sinon absent). */
  zones?: ZonesSurimpression;
  /** `prefers-reduced-motion` ou le réglage du joueur. */
  reduit: boolean;
  tactile: boolean;
  /** Le nom de la scène pour les lecteurs d'écran (clé `scene.aria` du catalogue du jeu, déjà traduite). */
  libelle: string;
  /** Le fantôme choisi : la rediffusion à montrer (la meilleure partie du joueur, ou celle du Diamant), ou `null`. */
  fantome: string | null;
  /** Lot B1 (retours de Blocks) — la langue du joueur et le traducteur de la partie : un jeu qui écrit un texte en scène (« +120 », « Plus de place ! ») le prend ici, dans son catalogue (celui du jeu et celui du kit, réunis). */
  langue: "fr" | "en";
  t: Traduire;
  /**
   * Lot B1 — une vibration (téléphone), **respectant le réglage « Vibration » du joueur** (lu à chaque appel : un réglage changé en pause vaut tout de suite). Ne fait rien sans réglage « oui », sans `navigator.vibrate` (iPhone) ni sur un appareil sans écran tactile.
   * Le jeu qui s'en sert déclare `vibration: true` dans sa définition (le réglage n'apparaît dans les Réglages que pour lui). Un motif est une durée en ms, ou une suite durée / pause.
   */
  vibrer(motif: number | readonly number[]): void;
  /**
   * Lot « manques de Blocks » — le volume des **effets sonores** du joueur, de 0 à 1, **séparé de la musique** (réglage « Volume des effets », `<id>:reglages`, 100 par défaut) ; lu à chaque appel : un réglage changé en pause vaut tout de suite.
   * Le jeu qui a des effets sonores le multiplie à son propre gain et déclare `effets: true` dans sa définition (le réglage n'apparaît dans les Réglages que pour lui).
   */
  volumeEffets(): number;
}

/**
 * Lot PG2 — **le bilan d'une partie** (facultatif), montré par le kit **dans l'écran de fin**, sous le score et la médaille : la cause de la fin et des lignes « libellé / valeur » (la distance, les pièces, le thème…).
 * Le jeu donne des **clés de son catalogue** (fr + en : le kit les traduit, jamais un texte en dur) et des valeurs **déjà écrites** (un nombre mis en forme avec la langue de la partie, `OptionsPartie.langue` et `.t`).
 * **Il n'y a plus d'écran de fin propre à un jeu** : le jeu ne montre en scène que son animation de fin (la mort, « Plus de place ! ») ; le bilan est écrit **une fois**, dans le vrai écran de fin.
 */
export interface BilanPartie {
  /** La cause de la fin (« Tombé dans un pic »), montrée en tête du bilan ; `params` sont ceux de la clé. */
  cause?: { cle: string; params?: Readonly<Record<string, string | number>> };
  /** Les lignes, dans l'ordre : `cle` est le libellé (catalogue du jeu), `valeur` le texte déjà écrit. Au plus `LIGNES_BILAN_MAX` sont montrées ; une valeur vide est ignorée. */
  lignes: readonly { cle: string; valeur: string }[];
}

/** Une partie en cours, côté jeu : son état, son rendu et ses entrées de scène. Le kit en tient la boucle, le HUD, la pause et la fin. */
export interface PartieDuJeu {
  /** Un pas de la simulation (appelé `ticksParSeconde` fois par seconde, jamais pendant la pause). */
  avancer(): void;
  /**
   * Dessine l'état courant (à chaque image). Lot PA1c : `avancement` est **la part du pas suivant déjà écoulée** (de 0 à 1) — de quoi interpoler ce qui se déplace entre deux pas sans horloge à soi ; il reste figé en pause,
   * en fin de partie et en mode manuel (`?debug&manuel`). Un jeu qui ne l'utilise pas écrit `dessiner(): void` comme avant.
   */
  dessiner(avancement: number): void;
  finie(): boolean;
  /**
   * Facultatif (lot B6) : la partie est jouée (plus de coup possible) mais `finie()` ne l'est pas encore parce que le jeu montre sa fin (« Plus de place ! » chez Blocks). Le kit fait **retomber la musique**
   * dès que c'est vrai, puis la remonte à l'écran de fin. Sans lui, la musique retombe et remonte à l'ouverture de l'écran de fin.
   */
  finEnCours?(): boolean;
  /** Une action discrète : une des actions du jeu (clavier, manette) — l'identifiant est celui de `DefinitionJeu.actions`. */
  action(id: string): void;
  /**
   * Facultatif (lot K8) : une action **tenue** est relâchée — la touche, le bouton de manette (ou, un jour, la commande à l'écran) choisis pour `id` sont levés, **avec les touches remappées du joueur** — ou la
   * partie s'arrête d'entendre le joueur (pause, fin, fenêtre qui perd le focus : tout ce qui était tenu est alors relâché). Appelée une fois par appui ; si deux sources tiennent la même action, après la dernière
   * seulement. **Un jeu qui ne la définit pas ne change pas** (les actions discrètes restent des `action` seules). La date du relâchement est celle du pas en cours : c'est au jeu de la dater pour sa rediffusion.
   */
  actionRelachee?(id: string): void;
  /** Ce que le HUD compact montre : le score et le temps restant, déjà formatés. */
  hud(): { principal: string; secondaire: string };
  /** Le résultat : les colonnes de classement (dans l'ordre de la fiche) et la rediffusion à envoyer. */
  resultat(): { score: number[]; rediffusion: string };
  /**
   * Facultatif (lot PG2) — **le bilan de la partie finie** (`BilanPartie`), appelé **une fois**, quand `finie()` devient vrai, juste avant l'écran de fin : le kit le montre dans l'écran de fin, avec le score et la médaille.
   * `null` ou absente : rien de plus à l'écran (**un jeu sans bilan ne change pas**). Le passage va de l'animation de fin du jeu à l'écran de fin **sans écran intermédiaire** : le jeu laisse `finie()` faux pendant son
   * animation (ou dit `finEnCours()`), puis le vrai quand elle est jouée ; il ne dessine pas son propre bilan.
   */
  bilan?(): BilanPartie | null;
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
  contenuDuJour(jour: number, base: string, theme: string): Promise<C>;
  seuils(contenu: C): Seuils;
  medaille(score: readonly number[], seuils: Seuils): CodeMedaille | null;
  /**
   * Lot PG1 — **le chargement asynchrone d'une partie** (facultatif). Une scène lourde (Three.js, un moteur de physique, des modèles) se charge ici, par un `import()`, et non plus par `contenuDuJour` : le kit
   * **l'appelle et l'attend**, une fois, **avant le premier `nouvellePartie`** — au toucher de « Jouer », l'accueil encore à l'écran avec son message « Chargement du jeu… » (après 250 ms) ; une promesse refusée
   * donne « Le jeu n'a pas pu se charger. Réessaie. » et le bouton se réarme. **Il n'est rappelé ni à « Recommencer » ni au passage à une autre partie** (la page garde ce qu'elle a chargé : `nouvellePartie` reste
   * synchrone et rapide) ; rappelé de lui-même (deux « Jouer » de suite), il doit rendre la même promesse : un `import()` répété est déjà gardé par le navigateur. Reçoit le contenu du jour. Absent : rien ne change.
   */
  chargerPartie?(contenu: C): Promise<void>;
  /** Une partie neuve, dessinée dans `hote` (synchrone : ce qui est lourd est chargé avant, par `chargerPartie`). */
  nouvellePartie(contenu: C, hote: HTMLElement, o: OptionsPartie): PartieDuJeu;
  /** La rediffusion du Diamant (la partie de l'auteur), montrée par le fantôme « Diamant ». Jamais appelée par un jeu `sansFantome`. */
  rediffusionDiamant(contenu: C): string;
  /** Un score écrit pour un joueur (`17 / 20`). `t` (lot « manques de Blocks ») : le traducteur de la langue en cours, pour un jeu dont le score s'écrit par son catalogue. */
  formatScore(score: readonly number[], langue: "fr" | "en", t: Traduire): string;
  /** Un score écrit pour la ligne à partager (court). */
  scorePartage(score: readonly number[], langue: "fr" | "en", t: Traduire): string;
  /**
   * Lot « manques de Blocks » — ce que la ligne à partager ajoute **après la médaille** (`combo ×7`), dans l'ordre : `Du Jour · Blocks #5 — 4 582 pts — 🥈 — combo ×7 — 3e/128`. Passé aux `extras` de `ligneParDefaut` ; une chaîne vide est ignorée.
   * Absent : rien. Le gabarit, les séparateurs et les émojis restent ceux du kit.
   */
  extrasPartage?(score: readonly number[], langue: "fr" | "en", t: Traduire): string[];
  /** Les « points » de l'aide « Comment jouer » (clés du catalogue du jeu), dans l'ordre. « Comment jouer » s'ouvre toujours en haut (lot PG2). */
  aide: readonly string[];
  /**
   * Lot PG2 — **un petit dessin à côté d'un pas de « Comment jouer »** (facultatif) : une table `clé d'un pas de `aide` → fonction qui construit le dessin` (un `<svg>` décoratif aux traits de la charte, construit par le jeu :
   * jamais d'image externe ni de `innerHTML` ; le kit le pose à gauche du texte, 56 × 56 px, caché aux lecteurs d'écran). Un pas sans entrée reste une ligne de texte ; absente : « Comment jouer » est celui d'avant.
   */
  dessinsAide?: Readonly<Record<string, () => SVGElement>>;
  /**
   * Lot B1 — **cette partie est-elle classable ?** Reçoit l'adresse de la page (`location.search`). `false` : une partie d'essai (scénario, réglage `?debug&tune`…) — le kit ne la classe pas, ne l'envoie pas,
   * ne la garde pas dans les records et le dit au joueur (« Partie d'essai : non classée »), **sans passer la page en archive**. Absente : toute partie du jour est classable. Un jeu ne répond `false` que hors production
   * (les outils d'essai y sont fermés, règle R9) ; le serveur refuse de toute façon la rediffusion d'un essai.
   */
  classable?(adresse: string): boolean;
  /** Lot B1 — **un jeu sans médaille** : l'écran de fin n'affiche ni la liste des médailles ni « encore … », `seuils` et `medaille` ne sont pas appelées et le record garde `medaille: null`. Absente : `false`. */
  sansMedaille?: boolean;
  /**
   * Lot « manques de Blocks » — **un jeu sans fantôme** : ni bouton fantôme au HUD, ni ligne « Fantôme au départ » des Réglages, ni commande « Fantôme » (touche G, manette) ; `rediffusionDiamant` n'est pas appelée et
   * `PartieDuJeu.fantome` non plus. Absente : `false`.
   */
  sansFantome?: boolean;
  /** Lot « manques de Blocks » — le jeu joue des effets sonores (`OptionsPartie.volumeEffets`) : le réglage « Volume des effets » apparaît dans ses Réglages. Absente : `false`. */
  effets?: boolean;
  /** Lot B1 — le jeu fait vibrer l'appareil (`OptionsPartie.vibrer`) : le réglage « Vibration » (oui / non) apparaît dans ses Réglages. Absente : `false`. */
  vibration?: boolean;
  /**
   * Lot PG1 — **où est le HUD** : `"barre"` (défaut) : le score et la ligne dans la barre du haut, comme aujourd'hui ; `"surimpression"` : le jeu écrit son HUD **sur le plateau**, dans les zones que le kit pose
   * (`OptionsPartie.zones`), et le texte de la barre (`PartieDuJeu.hud()`) n'est plus visible — il reste dans la page, lu par la pause et les lecteurs d'écran. La barre garde ses boutons (fantôme, pause).
   * Lot PA1c : `"surimpression-claire"` — la même, **pour une scène claire** : l'encre sur le papier (`jeu-surimpression--clair`) au lieu du papier sur l'encre, lisible au contraste AA.
   */
  hud?: "barre" | "surimpression" | "surimpression-claire";
  /**
   * Lot K9 — **l'orientation que le plein écran verrouille** (accueil, HUD de la partie, pause) : `"actuelle"` (défaut : celle du moment, un jeu qui se joue en portrait y reste), `"portrait"` ou `"paysage"`
   * (un jeu qui ne se joue qu'à l'horizontale). Choix du jeu, dans sa définition et non dans sa fiche : c'est une affaire de rendu, qui ne change ni le classement ni les projections de la fiche.
   */
  orientation?: OrientationPleinEcran;
  /** Lot « écrans du kit » — la peau du jeu (illustration du titre, décor du thème, accent des boutons) : voir `PeauJeu`. Absente : la peau tirée de la fiche. */
  peau?: PeauJeu;
}

/**
 * Lot « écrans du kit » — **la peau du jeu** : ce que le jeu ajoute, s'il le veut, à l'habillage que le kit tire de sa fiche. **Tout est facultatif** : sans rien, les écrans ont déjà la teinte et la coque de l'étiquette de
 * la fiche, sa police, le décor du thème en aplats de ces deux couleurs et des boutons à l'accent de l'étiquette. Les couleurs sont des `#RRGGBB` (tout le reste est refusé : une couleur de la définition ne vient jamais
 * d'une donnée) ; **le kit les pose en variables CSS, le jeu ne touche à aucune feuille des écrans**.
 */
export interface PeauJeu {
  /** L'illustration du jeu, posée à droite du titre de l'accueil (un dessin décoratif, de l'ordre de 90 × 70 : `<svg>` aux traits de la charte, jamais d'image externe). Rien : pas d'illustration. */
  dessin?(): SVGElement;
  /** Le décor de scène du thème du jour, derrière les écrans de l'accueil (deux aplats : le ciel et le sol). Rien : la couleur et la coque de l'étiquette de la fiche. */
  fond?(theme: string): { ciel: string; sol: string };
  /** La couleur des boutons principaux, des pastilles actives et des tuiles inversées. Rien : la couleur de l'étiquette de la fiche. */
  accent?: string;
}

/**
 * Lot PA1 — **la définition d'un jeu Party** (`fiche.categorie === "party"`) : celle des autres jeux **moins** ce que la catégorie n'a pas — ni thème (le kit lui en donne un seul, `THEME_UNIQUE` : le catalogue du jeu a `theme.unique`
 * et `accueil.phrase.unique`, la fiche n'a aucun thème), ni seuils, ni médailles, ni fantôme du Diamant (pas de robot). `brancherJeu` la complète (`definitionDeParty`) : le jeu n'écrit que sa simulation, son rendu et ses textes.
 */
export type DefinitionJeuParty<C> = Omit<DefinitionJeu<C>, "themeDuJour" | "seuils" | "medaille" | "rediffusionDiamant" | "sansMedaille" | "sansFantome">;
/**
 * Lot PA1 — le thème d'un jeu Party (le seul) et sa définition complète (un thème, aucune médaille, aucun fantôme : `seuils`, `medaille` et `rediffusionDiamant` ne sont jamais appelées). **Lot PA1b : elles vivent dans `party.ts`**
 * (morceau à la demande : le premier chargement d'un jeu du jour ne les porte plus) ; ce fichier les réexporte pour les tests et le moule.
 */
export { definitionDeParty, THEME_UNIQUE } from "./party";

export interface CataloguesJeu {
  /** Le français : celui du kit et du jeu, réunis. */
  fr: Catalogue;
  /** L'anglais, à la demande : le catalogue du jeu et le catalogue commun de `@cdj/ui`. */
  chargerEn(): Promise<{ jeu: Catalogue; commun: Catalogue }>;
}

/** Lot K5 — ce que le kit donne à `aujourdhui` : le traducteur et la langue du jeu, le thème, le jour (numéro civil) et sa date. */
export interface ContexteAujourdhui {
  t: Traduire;
  langue: "fr" | "en";
  theme: string;
  jour: number;
  date: string;
}

export interface OptionsBrancher<C = unknown> {
  catalogues: CataloguesJeu;
  /**
   * Lot K5 — **le panneau « Aujourd'hui »** de l'accueil (à droite, au-dessus du classement) : ce qui est propre au jour du jeu (les pièces de Blocks, le boss, les paliers…). Le kit pose le cadre, la légende
   * « Aujourd'hui · {thème} » et l'espace réservé ; le jeu **remplit `hote`** (`textContent` et SVG du socle, jamais `innerHTML`) à partir du contenu du jour, quand il est lu. Sans cette fonction le panneau montre
   * seulement le thème et la réplique : le kit ne dessine rien de propre au jeu. La fiche dit `identite.aujourdhui: true` quand le jeu la fournit.
   */
  aujourdhui?(contenu: C, hote: HTMLElement, ctx: ContexteAujourdhui): void;
  /**
   * Lot K5 — **le bouton « Archives »** de l'accueil : le jeu dit ce qu'il ouvre (sa page d'archives). Sans lui le bouton est là mais désactivé, avec « Bientôt » (charte § 5) : le kit n'a pas encore de page d'archives.
   */
  archives?(): void;
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
  /** Lot B1 — une partie d'essai (`DefinitionJeu.classable` a dit `false`) : jamais classée non plus, mais le jour joué reste celui d'aujourd'hui. */
  essai: boolean;
  musique: import("@cdj/musique/branche").Musique;
}
export interface ContextePartie<C> extends ContexteJeu<C> {
  contenu: C;
  /** Le joueur est déjà classé aujourd'hui (le serveur l'a dit à l'accueil). */
  classementConnu: boolean;
  /** Retour à l'accueil du jeu (la page se recharge). */
  retour(): void;
}
