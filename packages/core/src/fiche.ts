// Lot K1 (plateforme) — **la fiche d'un jeu** : le fichier `config/jeux/<id>.json` dit à la plateforme ce qu'elle doit savoir d'un jeu pour le PRÉSENTER et le BRANCHER (nom,
// accroche, étiquette, thèmes, critère de classement, zones de la CI, tables, préfixe de stockage, scènes de musique, budgets…). Ce module est pur (aucun accès au disque, au DOM ni
// au réseau) : le type, la validation et les **projections** — une par lecteur (`portail`, `serveur`, `ci`, `jeu`), que `npm run fiches` écrit dans `config/jeux/projections/`
// et dont un test vérifie qu'elles sont à jour. Conception : docs/plateforme/kit-de-jeu.md (lot K0), § 3 ; rapport : docs/plateforme/lots/lot-K1-fiche-de-jeu.md.
//
// **Ce que la fiche ne porte pas** : le générateur, la simulation, le rendu, les sensations, les fonctions de rejeu — tout ce qui est du jeu. Les textes restent dans les catalogues
// `fr` + `en` ; la fiche porte les CLÉS (`accroche`, `titre`). **Qui l'écrit** : le lot du jeu (seule exception à la règle des zones : `config/jeux/<id>.json`) ;
// `validerFiche` refuse donc une fiche qui sortirait de ce que le jeu peut réclamer (zones de CI ailleurs que dans les siennes, tables d'un autre jeu…).
//
// **Les trois jeux ont une fiche** (lots K1, K1b et K1c) : il n'y a plus de jeu sans fiche, ni de chemin de transition. Les jeux dont les noms ne suivent pas la règle `apps/<id>/`, `packages/<id>-sim/`,
// `<id>_…`, `<id>:` (Track : `apps/web`, `packages/sim`, les tables `results`…, le préfixe `cdj:`) les déclarent par `dossiers` et par des listes de noms hérités, nommés un par un ci-dessous.

export type SensClassement = "asc" | "desc";
export type UniteScore = "ms" | "ticks" | "mm" | "points";
export type FormatScore = "temps" | "hauteur" | "entier";
export type MethodeMedailles = "facteurs-auteur" | "figees-niveau" | "pourcentage-diamant";
export type ModeJours = "registre" | "fichier-par-jour";
export type SortTable = "videe" | "gardee";

/** Un fichier de zones de la CI : des motifs de chemins (`*` = un segment, `**` = tout) moins `sauf`. Même forme que `e2e/zones.json`. */
export interface ZoneCI {
  _?: string;
  globs: string[];
  sauf?: string[];
}

/**
 * Lot K4b — **comment un jeu fige, prépare et compare ses jours** : la chaîne de « Mettre en production » (`scripts/mise-en-production.mjs`, `production.yml`) lit ce bloc et ne nomme plus aucun jeu.
 *  - `empreinte` (toujours) : le module du jeu qui calcule l'empreinte de ce que le jeu SERT pour un jour (`empreinteJour(jour, dossier)` : `apps/api/scripts/<id>-empreintes.ts`). Il est copié dans le code
 *    en production (plus ancien que lui) et compilé là : il ne dépend que des paquets `@cdj/*`.
 *  - `registre` (mode `registre`) : le module qui dit, pour chaque jour, la version que ce code sert (`apps/api/scripts/<id>-registre.ts`).
 *  - `figer` (mode `fichier-par-jour`) : le script npm qui écrit les fichiers des jours avec le code en production. Forme `jusqu-a-la-veille` : `npm run <script> -w <paquet> -- <veille>` écrit tout
 *    jusqu'à la veille de la bascule, puis la chaîne retire les jours sans résultat ; forme `jours-proteges` : `npm run <script> -w <paquet> -- --du D --au A --dossier=<dossier>` pour les
 *    jours protégés qui n'ont pas de fichier.
 *  - `apresPose` (facultatif) : ce que le dépôt doit refaire quand des fichiers de ses jours changent (la démonstration de Jump, qui rejoue ses niveaux : `jump:seed`) : le script npm (du serveur, `@cdj/api`, ou du jeu) et les
 *    chemins qu'il écrit, que le versement des jours figés ajoute au commit.
 *  - `preparer` (facultatif) : un jeu dont les jours demandent un calcul AVANT d'être servis (le bot de Tower) : le script npm (mêmes arguments que `figer: jours-proteges`), la fenêtre (de la veille de la
 *    bascule à bascule + `joursApresBascule`) et le test qui garde chaque fichier (`garde`).
 */
export interface FabricationJours {
  empreinte: string;
  registre?: string;
  figer?: { paquet: string; script: string; forme: "jusqu-a-la-veille" | "jours-proteges" };
  preparer?: { paquet: string; script: string; joursApresBascule: number; garde: string };
  apresPose?: { paquet: string; script: string; sorties: string[] };
}

export interface FicheJeu {
  /** Le dossier du jeu sur le site (`/tower/`), son préfixe de route (`/api/tower/`) et son nom de dossier (`apps/tower`). `a-z`, `0-9`, `-`. */
  id: string;
  /** Son code au registre du serveur (`GET /api/portail/jour`, tables) : `cdj` pour Track, sinon l'identifiant. */
  code: string;
  /** Lot K1c : les dossiers du jeu quand ils ne suivent pas la règle (`apps/<id>/`, `packages/<id>-sim/`) : Track est dans `apps/web` et `packages/sim`. Absent : la règle. */
  dossiers?: { app: string; sim: string };
  /** Sa place dans les listes (cartouches, onglets, zones) ; unique. */
  ordre: number;
  nom: { fr: string; en: string };
  /** Clé de catalogue du portail : l'accroche de la cartouche. */
  accroche: string;
  /** Lot K1b : un jeu dont l'accroche suit le thème du jour (Jump : une réplique par thème) donne le préfixe de ses clés (`jump.replique.` + le code du thème) ; absent : l'accroche seule. */
  accrocheTheme?: string;
  /** Clé de catalogue du titre de la cartouche ; absente : le nom en capitales. */
  titre?: string;
  etiquette: {
    /** Couleurs et police de l'étiquette (valeurs des jetons du socle). */
    fond: string;
    coque: string;
    police: string;
    /** `propre` : un dessin écrit dans `@cdj/ui` (Tower) ; `generique` : l'étiquette sans dessin (jeu neuf, lot K3). */
    dessin: "propre" | "generique";
  };
  /** Un nouveau jeu naît `off` ; Track et Jump sont `on` (hérité de l'arrivée de l'interrupteur). */
  etatDepart: "off" | "on";
  /** Le premier jour du jeu (AAAA-MM-JJ) ; sa numérotation. */
  premierJour: string;
  classement: {
    /** Le tri, départages compris. */
    colonnes: { nom: string; sens: SensClassement }[];
    /** Compte-t-il dans le classement cumulé (au temps) ? Un jeu à la hauteur : non. */
    cumul: boolean;
    unite: UniteScore;
    format: FormatScore;
  };
  medailles: { methode: MethodeMedailles; bareme: number[]; plafondDiamant?: number };
  partage: { extras: ("morts" | "vies" | "rang")[] };
  /** Les codes des thèmes ; les textes sont `portail.theme.<id>.<code>` dans le catalogue du portail. */
  themes: string[];
  /** `fichier:constante` des versions que la plateforme lit (lot K2) : un test vérifie que chacune existe. */
  versions: { sim: string; generateur: string; medailles?: string };
  jours: {
    /** `registre` (un fichier de plages de jours protégés, Track) ou `fichier-par-jour` (Jump, Tower). */
    mode: ModeJours;
    /** Mode `fichier-par-jour` : le dossier des jours figés. */
    dossier?: string;
    /** Lot K1c, mode `registre` : le fichier du registre (`packages/sim/src/jours-track.json`). */
    registre?: string;
    /** La preuve de l'auteur ne quitte jamais le serveur (règle R9) : vrai pour un jeu dont les jours figés portent une `preuve`. */
    preuveInterditeEnProd: boolean;
    /** Lot K4b : comment la chaîne de « Mettre en production » fige, prépare et compare les jours de ce jeu (voir `FabricationJours`). */
    fabrication: FabricationJours;
  };
  /** `ticksParUnite` (lot K1b) : le coût d'un rejeu est proportionnel à sa durée (une unité du plafond global par `ticksParUnite` pas rejoués, `unitesServeur` en est le minimum) ; absent : coût fixe. */
  rejeu: { unitesServeur: number; fil?: boolean; maxTicks: number; ticksParUnite?: number };
  donnees: {
    /** Les tables liées à un joueur ou une partie (vidées par la remise à zéro) ou gardées (contenu du jour). */
    tables: { nom: string; sort: SortTable }[];
    /**
     * Lot K4c : le jeu range ses résultats dans la **table commune** `resultats_jeu` de la plateforme (`apps/api/src/jeux/adaptateur.ts`, `adaptateurResultatsJeu`) : il n'a alors besoin d'aucune table à lui
     * (`tables` peut être vide) ; la table commune est décrite une fois dans les mentions légales, vidée par la remise à zéro et effacée par le module.
     */
    tableCommune?: "resultats_jeu";
    stockage: { prefixe: string; reglagesGardes: string[] };
  };
  message: { ou: string };
  zoneNouveautes: string;
  musique: { scenes: string[] };
  /** Le jeu a-t-il une page d'outils `/<id>/admin/` ? */
  admin: { outils: boolean };
  /**
   * Les zones qu'une PR de ce jeu peut toucher (`zones-jeu.mjs`) ; `serveur` en est la part qui compte aussi pour la plateforme (`ci-scope.mjs`). Lot K1c : `documents` = des documents que la CI
   * range avec le jeu (ses e2e seuls tournent quand ils changent) sans que le lot du jeu les écrive (les visions de Nathan : `docs/seed.md`).
   */
  zones: { jeu: string[]; serveur: string[]; documents?: string[] };
  e2e: {
    /** Le dossier des specs ; la suite de la CI (`tower` : `tower/<spec>`, projet Playwright `tower-<navigateur>`). */
    dossier: string;
    suite: string;
    /**
     * Lot K4 : le préfixe du projet Playwright de la CI (`tower-` : le projet `tower-chromium`) ; absent : `<suite>-`. Track, qui héberge aussi les specs du portail et de la plateforme,
     * a le préfixe vide (son projet s'appelle `chromium`).
     */
    projet?: string;
    /** Lot K4 : le document où se note la dette d'un test en quarantaine ; absent : `docs/<id>/consignes.md`. */
    dette?: string;
    fumee: string[];
    /** Zones nommées de `e2e/zones.json` pour ce jeu, et ses specs (nom de fichier → zones). */
    zones: Record<string, ZoneCI>;
    specs: Record<string, string[]>;
    /** Lot K1b : les specs tout entiers de la famille « Régression » (CI complète et nuit seulement, `docs/tests.md`), parmi `specs`. */
    regression?: string[];
    /** Nombre de parts Chromium de la CI complète, par mode. */
    parts: { main: number; complet: number; nuit: number };
  };
  /** Les lignes de `docs/plateforme/budgets.md` du jeu (les plafonds y restent : un seul endroit). */
  budget: { lignes: string[] };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Validation

const ID = /^[a-z][a-z0-9-]{1,23}$/;
const DOSSIER = /^[a-z][a-z0-9-]*$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const COULEUR = /^#[0-9A-Fa-f]{6}$/;
const NOM_TABLE = /^[a-z][a-z0-9_]*$/;
const NOM_COLONNE = /^[a-z][a-z0-9_]*$/;
const CHEMIN = /^[A-Za-z0-9_./*@-]+$/;
const LIGNE_BUDGET = /^[a-z0-9-]+\.[A-Za-z0-9]+$/;
const SCENE = /^[a-z0-9]+(:[a-z0-9-]+)?$/;
const FICHIER_VERSION = /^[A-Za-z0-9_./-]+\.ts:[A-Z][A-Z0-9_]*$/;

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const estTexte = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const estEntier = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const listeDeTextes = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/**
 * Les préfixes de chemins qu'un jeu `id` peut réclamer pour ses zones : les siens, rien d'autre (la fiche est écrite par le lot du jeu). `dossiers` (lot K1c) remplace `apps/<id>/` et
 * `packages/<id>-sim/` par ceux que le jeu déclare (Track : `apps/web/`, `packages/sim/`) ; deux fiches ne peuvent pas déclarer le même dossier (`validerEnsemble`).
 */
export function prefixesDeZones(id: string, dossiers?: { app: string; sim: string }): string[] {
  return [`apps/${dossiers?.app ?? id}/`, `packages/${dossiers?.sim ?? `${id}-sim`}/`, `docs/${id}/`, `apps/api/src/${id}`, `apps/api/test/${id}`, `apps/api/scripts/${id}-`];
}
/**
 * Lots K1b et K1c : les chemins d'un jeu qui ne suivent pas la règle `<dossier>/<id>…`, **nommés un par un** (des noms d'avant la règle, que le jeu garde) : un outil de mesure, un fichier du
 * serveur, ses documents. Une entrée qui finit par `/` est un dossier (toute glob qui le commence est permise), les autres sont des noms exacts. Une fiche ne peut réclamer que cela en plus de
 * la règle : la validation reste « un jeu ne réclame que ses propres chemins ».
 */
export const CHEMINS_HERITES: Readonly<Record<string, readonly string[]>> = {
  jump: ["apps/api/scripts/measure-jump.ts"],
  track: [
    "apps/api/src/cdj.ts",
    "apps/api/src/salon.ts",
    "apps/api/src/garage*.ts",
    "apps/api/test/garage*.test.ts",
    "apps/api/test/salon.test.ts",
    "apps/api/test/planning.test.ts",
    "apps/api/scripts/measure-salon.ts",
    "apps/api/scripts/measure-generator.ts",
    "apps/api/scripts/measure-budget.ts",
    "apps/api/scripts/history-seed.ts",
    "docs/lots/",
    "docs/orchestration.md",
    "docs/seed.md",
    "docs/guide-technique.md",
  ],
};
/** Les tables d'un jeu qui ne commencent pas par `<id>_` : celles de Track, avant la règle (le serveur de DailyTrack est le plus ancien). */
export const TABLES_HERITEES: Readonly<Record<string, readonly string[]>> = {
  track: ["results", "circuits", "planning", "garage_choices", "salon_runs", "salon_sessions", "salon_circuits", "salon_presence", "salon_throttle"],
};
/** Le préfixe de stockage d'un jeu quand ce n'est pas `<id>:` : `cdj:` est celui de Track et de la plateforme (l'identité commune y vit). */
export const PREFIXES_HERITES: Readonly<Record<string, string>> = { track: "cdj:" };
/** Le préfixe de stockage d'un jeu. */
export const prefixeDeStockage = (id: string): string => PREFIXES_HERITES[id] ?? `${id}:`;
const globDuJeu = (glob: string, id: string, dossiers?: { app: string; sim: string }): boolean =>
  !glob.split("/").includes("..") && (prefixesDeZones(id, dossiers).some((p) => glob.startsWith(p)) || (CHEMINS_HERITES[id] ?? []).some((h) => (h.endsWith("/") ? glob.startsWith(h) : glob === h)));

/**
 * Les problèmes d'une fiche lue (JSON brut) : une liste vide veut dire « valide ». Chaque message nomme le champ (`etiquette.fond : …`). `idDuFichier` : le nom du fichier sans `.json`,
 * qui doit être l'identifiant (un fichier ne peut pas se faire passer pour un autre jeu).
 */
export function validerFiche(brut: unknown, idDuFichier?: string): string[] {
  const p: string[] = [];
  if (!estObjet(brut)) return ["la fiche n'est pas un objet JSON"];
  const f = brut;
  const ko = (champ: string, attendu: string) => p.push(`${champ} : ${attendu}`);

  if (!estTexte(f.id) || !ID.test(f.id)) ko("id", "minuscules, chiffres et tirets (2 à 24 caractères)");
  const id = typeof f.id === "string" ? f.id : "";
  if (idDuFichier !== undefined && id !== idDuFichier) ko("id", `doit être « ${idDuFichier} » (le nom du fichier)`);
  if (!estTexte(f.code) || !ID.test(f.code)) ko("code", "le code du registre du serveur");
  if (!estEntier(f.ordre) || f.ordre < 1) ko("ordre", "entier ≥ 1");

  if (f.dossiers !== undefined && (!estObjet(f.dossiers) || !DOSSIER.test(String(f.dossiers.app)) || !DOSSIER.test(String(f.dossiers.sim)))) ko("dossiers", "{ app, sim } : des noms de dossiers (a-z, chiffres, tirets), ou absent");
  const dossiers = estObjet(f.dossiers) && DOSSIER.test(String(f.dossiers.app)) && DOSSIER.test(String(f.dossiers.sim)) ? (f.dossiers as { app: string; sim: string }) : undefined;

  if (!estObjet(f.nom) || !estTexte(f.nom.fr) || !estTexte(f.nom.en)) ko("nom", "{ fr, en } non vides");
  if (!estTexte(f.accroche)) ko("accroche", "une clé de catalogue");
  if (f.titre !== undefined && !estTexte(f.titre)) ko("titre", "une clé de catalogue, ou absent");
  if (f.accrocheTheme !== undefined && (typeof f.accrocheTheme !== "string" || !/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*\.$/.test(f.accrocheTheme))) ko("accrocheTheme", "un préfixe de clés de catalogue qui finit par un point, ou absent");

  const e = f.etiquette;
  if (!estObjet(e)) ko("etiquette", "objet attendu");
  else {
    for (const c of ["fond", "coque"] as const) if (typeof e[c] !== "string" || !COULEUR.test(e[c] as string)) ko(`etiquette.${c}`, "couleur #RRGGBB");
    if (!estTexte(e.police) || /[;{}<>]/.test(e.police as string)) ko("etiquette.police", "une liste de polices (sans ; { } < >)");
    if (e.dessin !== "propre" && e.dessin !== "generique") ko("etiquette.dessin", "`propre` ou `generique`");
  }

  if (f.etatDepart !== "off" && f.etatDepart !== "on") ko("etatDepart", "`off` ou `on`");
  if (typeof f.premierJour !== "string" || !JOUR.test(f.premierJour)) ko("premierJour", "AAAA-MM-JJ");

  const c = f.classement;
  if (!estObjet(c)) ko("classement", "objet attendu");
  else {
    if (!Array.isArray(c.colonnes) || c.colonnes.length === 0 || !c.colonnes.every((x) => estObjet(x) && typeof x.nom === "string" && NOM_COLONNE.test(x.nom) && (x.sens === "asc" || x.sens === "desc"))) ko("classement.colonnes", "au moins une colonne { nom, sens: asc | desc }");
    if (typeof c.cumul !== "boolean") ko("classement.cumul", "booléen");
    if (!["ms", "ticks", "mm", "points"].includes(c.unite as string)) ko("classement.unite", "ms, ticks, mm ou points");
    if (!["temps", "hauteur", "entier"].includes(c.format as string)) ko("classement.format", "temps, hauteur ou entier");
    if (c.cumul === true && c.unite !== "ms" && c.unite !== "ticks") ko("classement.cumul", "seul un jeu au temps entre dans le cumul");
  }

  const m = f.medailles;
  if (!estObjet(m)) ko("medailles", "objet attendu");
  else {
    if (!["facteurs-auteur", "figees-niveau", "pourcentage-diamant"].includes(m.methode as string)) ko("medailles.methode", "facteurs-auteur, figees-niveau ou pourcentage-diamant");
    if (!Array.isArray(m.bareme) || !m.bareme.every((x) => typeof x === "number" && Number.isFinite(x) && x > 0)) ko("medailles.bareme", "une liste de nombres > 0");
    if (m.plafondDiamant !== undefined && (!estEntier(m.plafondDiamant) || m.plafondDiamant <= 0)) ko("medailles.plafondDiamant", "entier > 0, ou absent");
  }

  if (!estObjet(f.partage) || !Array.isArray(f.partage.extras) || !f.partage.extras.every((x) => x === "morts" || x === "vies" || x === "rang")) ko("partage.extras", "une liste parmi morts, vies, rang");

  if (!Array.isArray(f.themes) || f.themes.length === 0 || !f.themes.every((x) => typeof x === "string" && /^[a-z][a-z0-9-]*$/.test(x)) || new Set(f.themes).size !== f.themes.length) ko("themes", "des codes uniques (a-z, chiffres, tirets), au moins un");

  const v = f.versions;
  if (!estObjet(v) || typeof v.sim !== "string" || !FICHIER_VERSION.test(v.sim) || typeof v.generateur !== "string" || !FICHIER_VERSION.test(v.generateur) || (v.medailles !== undefined && (typeof v.medailles !== "string" || !FICHIER_VERSION.test(v.medailles)))) ko("versions", "{ sim, generateur, medailles? } au format fichier.ts:CONSTANTE");

  const j = f.jours;
  if (!estObjet(j)) ko("jours", "objet attendu");
  else {
    if (j.mode !== "registre" && j.mode !== "fichier-par-jour") ko("jours.mode", "`registre` ou `fichier-par-jour`");
    if (j.dossier !== undefined && (typeof j.dossier !== "string" || !CHEMIN.test(j.dossier) || !globDuJeu(j.dossier, id, dossiers))) ko("jours.dossier", `un dossier du jeu (${prefixesDeZones(id, dossiers).slice(0, 2).join(" ou ")}…)`);
    if (j.registre !== undefined && (typeof j.registre !== "string" || !CHEMIN.test(j.registre) || !globDuJeu(j.registre, id, dossiers))) ko("jours.registre", `un fichier du jeu (${prefixesDeZones(id, dossiers).slice(0, 2).join(" ou ")}…)`);
    if (j.mode === "fichier-par-jour" && (typeof j.dossier !== "string" || j.registre !== undefined)) ko("jours.dossier", "obligatoire pour `fichier-par-jour` (et sans `registre`)");
    if (j.mode === "registre" && (typeof j.registre !== "string" || j.dossier !== undefined)) ko("jours.registre", "obligatoire pour `registre` (et sans `dossier`)");
    if (typeof j.preuveInterditeEnProd !== "boolean") ko("jours.preuveInterditeEnProd", "booléen");
    const fab = j.fabrication;
    if (!estObjet(fab)) ko("jours.fabrication", "objet attendu { empreinte, registre?, figer?, preparer? }");
    else {
      const chemin = (nom: string, v: unknown) => {
        if (typeof v !== "string" || !CHEMIN.test(v) || !globDuJeu(v, id, dossiers)) ko(`jours.fabrication.${nom}`, `un fichier du jeu (${prefixesDeZones(id, dossiers).slice(0, 2).join(" ou ")}…)`);
      };
      const paquets = [`@cdj/${dossiers?.app ?? id}`, `@cdj/${dossiers?.sim ?? `${id}-sim`}`];
      const script = (nom: string, o: Record<string, unknown>) => {
        if (typeof o.paquet !== "string" || !paquets.includes(o.paquet)) ko(`jours.fabrication.${nom}.paquet`, `un paquet du jeu (${paquets.join(" ou ")})`);
        if (typeof o.script !== "string" || !/^[a-z][a-z0-9:-]*$/.test(o.script)) ko(`jours.fabrication.${nom}.script`, "un nom de script npm");
      };
      chemin("empreinte", fab.empreinte);
      if (fab.registre !== undefined) chemin("registre", fab.registre);
      if (j.mode === "registre" && fab.registre === undefined) ko("jours.fabrication.registre", "obligatoire pour `registre`");
      if (j.mode === "fichier-par-jour" && fab.registre !== undefined) ko("jours.fabrication.registre", "réservé au mode `registre`");
      if (fab.figer !== undefined) {
        if (!estObjet(fab.figer)) ko("jours.fabrication.figer", "objet attendu { paquet, script, forme }");
        else {
          script("figer", fab.figer);
          if (fab.figer.forme !== "jusqu-a-la-veille" && fab.figer.forme !== "jours-proteges") ko("jours.fabrication.figer.forme", "`jusqu-a-la-veille` ou `jours-proteges`");
        }
      }
      if (j.mode === "fichier-par-jour" && fab.figer === undefined) ko("jours.fabrication.figer", "obligatoire pour `fichier-par-jour`");
      if (j.mode === "registre" && fab.figer !== undefined) ko("jours.fabrication.figer", "réservé au mode `fichier-par-jour`");
      if (fab.apresPose !== undefined) {
        const ap = fab.apresPose;
        if (!estObjet(ap)) ko("jours.fabrication.apresPose", "objet attendu { paquet, script, sorties }");
        else {
          if (typeof ap.paquet !== "string" || ![...paquets, "@cdj/api"].includes(ap.paquet)) ko("jours.fabrication.apresPose.paquet", `un paquet du jeu (${paquets.join(" ou ")}) ou @cdj/api`);
          if (typeof ap.script !== "string" || !/^[a-z][a-z0-9:-]*$/.test(ap.script)) ko("jours.fabrication.apresPose.script", "un nom de script npm");
          if (!Array.isArray(ap.sorties) || ap.sorties.length === 0 || !ap.sorties.every((x) => typeof x === "string" && CHEMIN.test(x) && globDuJeu(x, id, dossiers))) ko("jours.fabrication.apresPose.sorties", "des chemins du jeu");
          if (j.mode !== "fichier-par-jour") ko("jours.fabrication.apresPose", "réservé au mode `fichier-par-jour`");
        }
      }
      if (fab.preparer !== undefined) {
        const pr = fab.preparer;
        if (!estObjet(pr)) ko("jours.fabrication.preparer", "objet attendu { paquet, script, joursApresBascule, garde }");
        else {
          script("preparer", pr);
          if (!estEntier(pr.joursApresBascule) || pr.joursApresBascule < 0) ko("jours.fabrication.preparer.joursApresBascule", "entier ≥ 0");
          chemin("preparer.garde", pr.garde);
          if (j.mode !== "fichier-par-jour") ko("jours.fabrication.preparer", "réservé au mode `fichier-par-jour`");
        }
      }
    }
  }

  const r = f.rejeu;
  if (!estObjet(r) || !estEntier(r.unitesServeur) || r.unitesServeur < 1 || !estEntier(r.maxTicks) || r.maxTicks < 1 || (r.fil !== undefined && typeof r.fil !== "boolean") || (r.ticksParUnite !== undefined && (!estEntier(r.ticksParUnite) || r.ticksParUnite < 1))) ko("rejeu", "{ unitesServeur ≥ 1, maxTicks ≥ 1, fil?, ticksParUnite? ≥ 1 }");

  const d = f.donnees;
  if (!estObjet(d)) ko("donnees", "objet attendu");
  else {
    if (d.tableCommune !== undefined && d.tableCommune !== "resultats_jeu") ko("donnees.tableCommune", "« resultats_jeu » ou absent");
    if (!Array.isArray(d.tables) || (d.tables.length === 0 && d.tableCommune === undefined) || !d.tables.every((x) => estObjet(x) && typeof x.nom === "string" && NOM_TABLE.test(x.nom) && (x.sort === "videe" || x.sort === "gardee"))) ko("donnees.tables", "des { nom, sort: videe | gardee }");
    else {
      for (const t of d.tables as { nom: string }[]) if (!t.nom.startsWith(`${id}_`) && !(TABLES_HERITEES[id] ?? []).includes(t.nom)) ko("donnees.tables", `« ${t.nom} » doit commencer par « ${id}_ » (un jeu ne déclare que ses tables)`);
      if (new Set((d.tables as { nom: string }[]).map((t) => t.nom)).size !== d.tables.length) ko("donnees.tables", "noms uniques");
    }
    const s = d.stockage;
    if (!estObjet(s) || typeof s.prefixe !== "string" || s.prefixe !== prefixeDeStockage(id) || !listeDeTextes(s.reglagesGardes) || !s.reglagesGardes.every((k) => k.startsWith(prefixeDeStockage(id)))) ko("donnees.stockage", `{ prefixe: « ${prefixeDeStockage(id)} », reglagesGardes: des clés qui commencent par ce préfixe }`);
  }

  if (!estObjet(f.message) || f.message.ou !== id) ko("message.ou", `doit être « ${id} » (la destination du message en direct d'un jeu est son identifiant)`);
  if (f.zoneNouveautes !== id) ko("zoneNouveautes", `doit être « ${id} » (une zone par jeu du registre)`);

  if (!estObjet(f.musique) || !listeDeTextes(f.musique.scenes) || !f.musique.scenes.every((s) => SCENE.test(s))) ko("musique.scenes", "des scènes (`menu`, `theme:<code>`)");
  else if (Array.isArray(f.themes) && listeDeTextes(f.themes)) {
    const attendues = ["menu", ...f.themes.map((t) => `theme:${t}`)];
    if (JSON.stringify(f.musique.scenes) !== JSON.stringify(attendues)) ko("musique.scenes", `doit être menu puis un theme:<code> par thème (${attendues.join(", ")})`);
  }

  if (!estObjet(f.admin) || typeof f.admin.outils !== "boolean") ko("admin.outils", "booléen");

  const z = f.zones;
  if (!estObjet(z) || !listeDeTextes(z.jeu) || !listeDeTextes(z.serveur) || (z.documents !== undefined && !listeDeTextes(z.documents))) ko("zones", "{ jeu: [motifs], serveur: [motifs], documents?: [motifs] }");
  else {
    for (const g of [...z.jeu, ...z.serveur, ...(z.documents ?? [])]) if (!CHEMIN.test(g) || !globDuJeu(g, id, dossiers)) ko("zones", `« ${g} » n'est pas dans les zones du jeu (${prefixesDeZones(id, dossiers).join(", ")})`);
    for (const g of z.serveur) if (!z.jeu.includes(g)) ko("zones.serveur", `« ${g} » doit aussi être dans zones.jeu`);
  }

  const t = f.e2e;
  if (!estObjet(t)) ko("e2e", "objet attendu");
  else {
    if (typeof t.dossier !== "string" || !globDuJeu(t.dossier, id, dossiers)) ko("e2e.dossier", "un dossier du jeu");
    if (typeof t.suite !== "string" || !ID.test(t.suite)) ko("e2e.suite", "le nom de la suite de la CI");
    const specs = estObjet(t.specs) ? t.specs : {};
    if (!estObjet(t.specs) || !Object.entries(specs).every(([k, zs]) => /^[a-z0-9-]+\.spec\.ts$/.test(k) && listeDeTextes(zs) && zs.length > 0)) ko("e2e.specs", "{ \"x.spec.ts\": [zones] } avec au moins une zone par spec");
    if (t.projet !== undefined && (typeof t.projet !== "string" || !/^([a-z0-9]+-)?$/.test(t.projet))) ko("e2e.projet", "le préfixe du projet Playwright (« tower- »), vide ou absent");
    if (t.dette !== undefined && (typeof t.dette !== "string" || !/^docs\/[A-Za-z0-9_./-]+\.md$/.test(t.dette))) ko("e2e.dette", "un document de docs/, ou absent");
    if (!listeDeTextes(t.fumee) || !t.fumee.every((s) => s in specs)) ko("e2e.fumee", "des specs déclarés dans e2e.specs");
    if (t.regression !== undefined && (!listeDeTextes(t.regression) || !t.regression.every((s) => s in specs))) ko("e2e.regression", "des specs déclarés dans e2e.specs, ou absent");
    if (!estObjet(t.zones)) ko("e2e.zones", "objet attendu");
    else {
      for (const [nom, zc] of Object.entries(t.zones)) {
        if (!new RegExp(`^${id}-[a-z0-9-]+$|^api-${id}$`).test(nom)) ko("e2e.zones", `« ${nom} » doit s'appeler ${id}-… (ou api-${id}) : une fiche ne définit que ses zones`);
        if (!estObjet(zc) || !listeDeTextes(zc.globs) || zc.globs.length === 0 || (zc.sauf !== undefined && !listeDeTextes(zc.sauf))) ko(`e2e.zones.${nom}`, "{ globs: [motifs], sauf?: [motifs] }");
        else for (const g of [...zc.globs, ...(zc.sauf ?? [])]) if (!CHEMIN.test(g) || !globDuJeu(g, id, dossiers)) ko(`e2e.zones.${nom}`, `« ${g} » n'est pas dans les zones du jeu`);
      }
    }
    if (estObjet(t.zones) && estObjet(t.specs)) {
      // Une zone de spec est une des siennes ou une zone partagée de `e2e/zones.json` (`ui`, `core-clock`…) : le contrôle de ces noms est celui de `apps/web/test/ciZones.test.ts`.
      const propres = Object.keys(t.zones);
      for (const [spec, zs] of Object.entries(specs)) if (!propres.some((n) => (zs as string[]).includes(n))) ko(`e2e.specs.${spec}`, "doit citer au moins une zone du jeu");
    }
    const parts = t.parts;
    if (!estObjet(parts) || !(["main", "complet", "nuit"] as const).every((k) => estEntier(parts[k]) && (parts[k] as number) >= 1)) ko("e2e.parts", "{ main, complet, nuit } : des entiers ≥ 1");
  }

  const b = f.budget;
  if (!estObjet(b) || !listeDeTextes(b.lignes) || b.lignes.length === 0 || !b.lignes.every((l) => LIGNE_BUDGET.test(l) && l.startsWith(`${id}.`))) ko("budget.lignes", `des lignes de budgets.md qui commencent par « ${id}. »`);

  return p;
}

/** Lit une fiche : la valide et la rend typée, ou lève une erreur qui liste tous les problèmes. */
export function lireFiche(brut: unknown, idDuFichier?: string): FicheJeu {
  const problemes = validerFiche(brut, idDuFichier);
  if (problemes.length > 0) throw new Error(`fiche${idDuFichier ? ` « ${idDuFichier} »` : ""} invalide :\n  - ${problemes.join("\n  - ")}`);
  return brut as FicheJeu;
}

/** Les problèmes de l'ensemble des fiches : identifiants, codes et ordres uniques, tables et zones qui ne se recouvrent pas. */
export function validerEnsemble(fiches: readonly FicheJeu[]): string[] {
  const p: string[] = [];
  for (const cle of ["id", "code", "ordre", "zoneNouveautes"] as const) {
    const vus = new Map<unknown, string>();
    for (const f of fiches) {
      const v = f[cle];
      if (vus.has(v)) p.push(`${cle} « ${String(v)} » : ${vus.get(v)} et ${f.id}`);
      else vus.set(v, f.id);
    }
  }
  // Lot K1c : deux jeux ne déclarent pas le même dossier (`dossiers`, ou la règle `apps/<id>`, `packages/<id>-sim`).
  const dossiersVus = new Map<string, string>();
  for (const f of fiches) for (const d of [`apps/${f.dossiers?.app ?? f.id}`, `packages/${f.dossiers?.sim ?? `${f.id}-sim`}`]) {
    if (dossiersVus.has(d)) p.push(`dossier « ${d} » : ${dossiersVus.get(d)} et ${f.id}`);
    else dossiersVus.set(d, f.id);
  }
  const tables = new Map<string, string>();
  for (const f of fiches) for (const t of f.donnees.tables) {
    if (tables.has(t.nom)) p.push(`table « ${t.nom} » : ${tables.get(t.nom)} et ${f.id}`);
    else tables.set(t.nom, f.id);
  }
  return p;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Les projections : ce que chaque lecteur reçoit, et rien de plus.

const parOrdre = <T extends { ordre: number }>(l: readonly T[]): T[] => [...l].sort((a, b) => a.ordre - b.ordre);

/** Le portail (accueil, profil, classement du jour, partage) : **ce qu'il dessine, rien de plus** (il l'embarque : chaque octet pèse sur son budget). Le nom est `jeu.<id>.nom` du catalogue commun. */
export interface ProjectionPortail {
  jeux: {
    id: string;
    /** Le code au registre du serveur (`GET /api/portail/jour`) ; absent : l'identifiant (cas de Jump et de Tower). */
    code?: string;
    accroche: string;
    /** Absent : le nom en capitales. */
    titre?: string;
    /** Lot K1b : le préfixe des clés d'accroche par thème (Jump), absent sinon. */
    accrocheTheme?: string;
    /** Lot K1b : le premier jour (`AAAA-MM-JJ`) d'un jeu public d'emblée (`etatDepart: on`), dont la cartouche affiche un numéro sans attendre le serveur ; absent : le serveur seul donne le numéro (un jeu `off` à l'arrivée). */
    premierJour?: string;
    /** Absent : vrai (un jeu au temps entre dans le cumul) ; `false` pour un jeu hors du cumul. */
    cumul?: false;
    /** Absent : `temps`. */
    format?: FormatScore;
  }[];
}
export function projectionPortail(fiches: readonly FicheJeu[]): ProjectionPortail {
  return {
    jeux: parOrdre(fiches).map((f) => ({
      id: f.id,
      // Lot K1b : ce qui va de soi n'est pas écrit (le portail le rétablit à la lecture : `jeuxFiches.ts`) — un octet de JSON pèse sur son budget.
      ...(f.code !== f.id ? { code: f.code } : {}),
      accroche: f.accroche,
      ...(f.titre !== undefined ? { titre: f.titre } : {}),
      ...(f.accrocheTheme !== undefined ? { accrocheTheme: f.accrocheTheme } : {}),
      ...(f.etatDepart === "on" ? { premierJour: f.premierJour } : {}),
      ...(f.classement.cumul ? {} : { cumul: false }),
      ...(f.classement.format !== "temps" ? { format: f.classement.format } : {}),
    })),
  };
}

/** Le serveur (registre, remise à zéro, mentions, jours figés) : lu par les tests de cohérence au lot K1, par le module du lot K2. */
export interface ProjectionServeur {
  jeux: {
    id: string;
    code: string;
    etatDepart: "off" | "on";
    premierJour: string;
    classement: FicheJeu["classement"];
    medailles: FicheJeu["medailles"];
    versions: FicheJeu["versions"];
    jours: FicheJeu["jours"];
    rejeu: FicheJeu["rejeu"];
    tables: FicheJeu["donnees"]["tables"];
    /** Lot K4d : le jeu se classe sur la table commune `resultats_jeu` (jeu neuf). */
    tableCommune?: "resultats_jeu";
    prefixe: string;
    reglagesGardes: string[];
    messageOu: string;
    zoneNouveautes: string;
  }[];
}
export function projectionServeur(fiches: readonly FicheJeu[]): ProjectionServeur {
  return {
    jeux: parOrdre(fiches).map((f) => ({
      id: f.id,
      code: f.code,
      etatDepart: f.etatDepart,
      premierJour: f.premierJour,
      classement: f.classement,
      medailles: f.medailles,
      versions: f.versions,
      jours: f.jours,
      rejeu: f.rejeu,
      tables: f.donnees.tables,
      ...(f.donnees.tableCommune ? { tableCommune: f.donnees.tableCommune } : {}),
      prefixe: f.donnees.stockage.prefixe,
      reglagesGardes: f.donnees.stockage.reglagesGardes,
      messageOu: f.message.ou,
      zoneNouveautes: f.zoneNouveautes,
    })),
  };
}

/** La CI (zones d'une PR de jeu, étendue du diff, specs, parts, site, budgets). */
export interface ProjectionCI {
  jeux: {
    id: string;
    zones: FicheJeu["zones"];
    e2e: FicheJeu["e2e"];
    /** Lot K1c : le dossier de l'application (`web` pour Track : `apps/web/dist`), celui des jours figés (`fichier-par-jour`) ou le fichier du registre (`registre`). */
    app: string;
    jours: { dossier: string | null; registre: string | null; preuveInterditeEnProd: boolean; fabrication: FabricationJours };
    /** Lot K4b : le dossier de la simulation (`packages/<sim>`), où la chaîne de production voit si un code contient le jeu. */
    sim: string;
    budget: string[];
    outilsAdmin: boolean;
  }[];
}
export function projectionCI(fiches: readonly FicheJeu[]): ProjectionCI {
  return {
    jeux: parOrdre(fiches).map((f) => ({ id: f.id, zones: f.zones, e2e: f.e2e, app: f.dossiers?.app ?? f.id, jours: { dossier: f.jours.dossier ?? null, registre: f.jours.registre ?? null, preuveInterditeEnProd: f.jours.preuveInterditeEnProd, fabrication: f.jours.fabrication }, sim: f.dossiers?.sim ?? `${f.id}-sim`, budget: f.budget.lignes, outilsAdmin: f.admin.outils })),
  };
}

/**
 * Les jeux côté jeu et socle (`@cdj/core`, `@cdj/profile`, `@cdj/ui`, `@cdj/musique`) : le nom, l'étiquette, le stockage, le message, les scènes. Les listes (`publics`, `prefixes`, `ou`, `zones`,
 * `jeuxMusique`) sont **complètes et dans l'ordre des fiches** : elles sont écrites en toutes lettres, telles qu'elles étaient dans le code, pour que les paquets n'embarquent pas un octet de plus.
 */
export interface ProjectionJeu {
  jeux: {
    id: string;
    code: string;
    ordre: number;
    nom: { fr: string; en: string };
    etiquette: FicheJeu["etiquette"];
    etatDepart: "off" | "on";
    format: FormatScore;
    unite: UniteScore;
    prefixe: string;
    messageOu: string;
    zoneNouveautes: string;
    themes: string[];
    scenes: string[];
  }[];
  /** Les jeux publics au départ (`etatDepart: on`), dans l'ordre des fiches. */
  publics: string[];
  /** Les préfixes de stockage des données de jeu, dans l'ordre des fiches (`cdj:`, `jump:`, `tower:`). */
  prefixes: string[];
  /** Les destinations du message en direct : le portail, puis chaque jeu. */
  ou: string[];
  /** Les zones des nouveautés : `dujour`, puis chaque jeu. */
  zones: string[];
  /** Les noms affichés des zones, par code. */
  nomsDeZones: Record<string, string>;
}
export function projectionJeu(fiches: readonly FicheJeu[]): ProjectionJeu {
  const l = parOrdre(fiches);
  return {
    jeux: l.map((f) => ({
      id: f.id,
      code: f.code,
      ordre: f.ordre,
      nom: f.nom,
      etiquette: f.etiquette,
      etatDepart: f.etatDepart,
      format: f.classement.format,
      unite: f.classement.unite,
      prefixe: f.donnees.stockage.prefixe,
      messageOu: f.message.ou,
      zoneNouveautes: f.zoneNouveautes,
      themes: f.themes,
      scenes: f.musique.scenes,
    })),
    publics: l.filter((f) => f.etatDepart === "on").map((f) => f.id),
    prefixes: l.map((f) => f.donnees.stockage.prefixe),
    ou: ["portail", ...l.map((f) => f.message.ou)],
    zones: ["dujour", ...l.map((f) => f.zoneNouveautes)],
    nomsDeZones: { dujour: "Du Jour", ...Object.fromEntries(l.map((f) => [f.zoneNouveautes, f.nom.fr])) },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Le texte écrit sur le disque

/** Le JSON d'une projection, tel que `npm run fiches` l'écrit (et tel que le test de fraîcheur le relit). */
export const jsonDeProjection = (p: unknown): string => JSON.stringify(p, null, 2) + "\n";
