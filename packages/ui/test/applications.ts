import { join } from "node:path";
import type { Catalogue } from "../src/i18n";

// Les applications passées au socle (lot I1 : le portail et sa vitrine ; lots I4, I5 : ajouter Track et Jump ici, rien d'autre à changer).
// Les modules sont chargés par chemin calculé : ils n'entrent pas dans le projet TypeScript de packages/ui.
const ROOT = join(__dirname, "../../..");

/** Catalogues des applications (fichier, export) : leur parité est vérifiée par catalogues.test.ts. */
export const CATALOGUES: [nom: string, fichier: string, exporte: string][] = [
  ["apps/portail", "apps/portail/src/catalogue.ts", "CATALOGUE_PORTAIL"],
  ["apps/portail (vitrine)", "apps/portail/src/catalogueVitrine.ts", "CATALOGUE_VITRINE"],
  ["apps/portail (démonstration)", "apps/portail/src/catalogueDemo.ts", "CATALOGUE_DEMO"],
  // Lot I6 : les textes des aperçus de partage (Open Graph), lus seulement à la construction (vite.config.ts de chaque application).
  ["apps/portail (aperçu)", "apps/portail/src/catalogueApercu.ts", "CATALOGUE_APERCU"],
  ["apps/web (aperçu)", "apps/web/src/catalogue.apercu.ts", "CATALOGUE_APERCU"],
  ["apps/jump (aperçu)", "apps/jump/src/catalogue.apercu.ts", "CATALOGUE_APERCU"],
  // Lot 53 : l'aide du plein écran sur iPhone et « Retrouver mon profil » (chargés à la demande avec leurs deux écrans : hors du catalogue commun).
  ["packages/ui (iPhone)", "packages/ui/src/catalogue.iphone.ts", "CATALOGUE_IPHONE"],
  // Lot I4 : DailyTrack, un catalogue par zone (réunis par apps/web/src/catalogue.ts, qui n'est pas listé : ses clés seraient en double).
  ["apps/web (base)", "apps/web/src/catalogue.base.ts", "CATALOGUE_BASE"],
  ["apps/web (accueil)", "apps/web/src/catalogue.accueil.ts", "CATALOGUE_ACCUEIL"],
  ["apps/web (course)", "apps/web/src/catalogue.course.ts", "CATALOGUE_COURSE"],
  ["apps/web (réglages)", "apps/web/src/catalogue.reglages.ts", "CATALOGUE_REGLAGES"],
  ["apps/web (Salon)", "apps/web/src/catalogue.salon.ts", "CATALOGUE_SALON"],
  // Lot I5 : Jump, un catalogue par zone (réunis par apps/jump/src/catalogue.ts, qui n'est pas listé : ses clés seraient en double).
  ["apps/jump (base)", "apps/jump/src/catalogue.base.ts", "CATALOGUE_BASE"],
  ["apps/jump (partie)", "apps/jump/src/catalogue.partie.ts", "CATALOGUE_PARTIE"],
  ["apps/jump (accueil)", "apps/jump/src/catalogue.accueil.ts", "CATALOGUE_ACCUEIL"],
  ["apps/jump (arrivée)", "apps/jump/src/catalogue.arrivee.ts", "CATALOGUE_ARRIVEE"],
  ["apps/jump (réglages)", "apps/jump/src/catalogue.reglages.ts", "CATALOGUE_REGLAGES"],
];

export async function cataloguesApplications(): Promise<[string, { fr: Catalogue; en: Catalogue }][]> {
  return Promise.all(CATALOGUES.map(async ([nom, fichier, exporte]) => [nom, ((await import(/* @vite-ignore */ join(ROOT, fichier))) as Record<string, { fr: Catalogue; en: Catalogue }>)[exporte]!] as [string, { fr: Catalogue; en: Catalogue }]));
}

/** Les dossiers et fichiers soumis au refus des chaînes écrites en dur (chainesEnDur.test.ts). Lots I4, I5 : ajouter `apps/web/src`, `apps/jump/src`… */
export const DOSSIERS_SANS_CHAINES_EN_DUR: string[] = ["packages/ui/src", "packages/ui/outils", "apps/portail/src", "apps/portail/index.html", "apps/portail/ui", "apps/portail/profil", "apps/portail/classement", "apps/portail/nouveautes", "apps/web/src", "apps/web/index.html", "apps/jump/src", "apps/jump/index.html"];

/** Ce qui n'est pas vérifié, chacun avec sa raison. */
export const EXCLUSIONS: Record<string, string> = {
  "apps/portail/mentions-legales": "page statique sans script, en français (elle fait foi) : son texte ne passe pas par un catalogue",
  "apps/portail/legal": "lot I6 : la même page en anglais, statique sans script (mentions.test.ts vérifie qu'elle suit la française)",
  "apps/portail/404.html": "lot I6 : la page 404, statique sans script, les deux langues sur la page (la langue du joueur n'y est pas lue)",
  // Lot N1 : le panneau d'administration de la plateforme (`/admin/`) est une page pour l'éditeur seul, en français, hors des catalogues des joueurs.
  "apps/portail/admin": "lot N1 : page du panneau d'administration (`/admin/`), outil interne de l'éditeur, en français seulement (hors des catalogues des joueurs)",
  "apps/portail/src/admin.ts": "lot N1 : le panneau d'administration, outil interne de l'éditeur, en français seulement",
  "apps/portail/src/adminDiffusion.ts": "lot N2 : les rubriques Nouveautés et Message en direct du panneau d'administration, outil interne de l'éditeur, en français seulement",
  "apps/portail/src/adminGithub.ts": "lot N2 : la lecture des PR par le panneau d'administration (messages d'erreur pour l'éditeur), en français seulement",
  "apps/portail/src/adminDonnees.ts": "lot N1 : les textes et formats du panneau d'administration, outil interne de l'éditeur, en français seulement",
  "apps/portail/partage": "lot I6 : la source des images de partage (outil de construction, jamais servie) : seulement les noms de la marque",
  // Lot I4 : les outils internes de Nathan restent en français (hors du périmètre de l'anglais, charte et lot I4 § 1).
  "apps/web/src/tune.ts": "outil de réglage de la conduite (`?debug&tune`) : outil interne, en français",
  "apps/web/src/admin.ts": "page d'administration (`/admin/`) : outil interne, en français",
  "apps/web/src/adminAcces.ts": "porte de la page d'administration de Track (`/track/admin/`, connexion du panneau) : outil interne de l'éditeur, en français",
  "apps/web/src/adminBackend.ts": "page d'administration (`/admin/`) : outil interne, en français",
  "apps/web/src/adminLogic.ts": "page d'administration (`/admin/`) : outil interne, en français",
  "apps/web/src/adminPlan.ts": "planning de l'administration (lot 14) : outil interne, en français",
  "apps/web/src/adminPlanning.ts": "planning de l'administration (lot 14) : outil interne, en français",
  "apps/web/src/adminMedailles.ts": "calibrage des médailles de l'administration (lot 35) : outil interne, en français",
  "apps/web/src/circuitStats.ts": "statistiques de circuit de l'administration (lot 14) : outil interne, en français",
  "apps/web/src/verify.ts": "page de vérification des rediffusions (`verify.html`, tests de navigateur) : aucun texte d'interface",
  // Lot 38 : la vitrine de la scène (`/track/vitrine/`, recette et aperçus seulement, jamais construite en production) est un outil interne de Nathan.
  "apps/web/src/vitrine": "vitrine de la scène (`/track/vitrine/`, lot 38) : outil interne de Nathan pour choisir une direction, en français, jamais en production",
  // Lot 43 (Track) : le compteur d'images de `?debug` et les sponsors fictifs peints dans la scène.
  "apps/web/src/banc/banc.ts": "banc d'essai du rendu (`?banc`, lot 50) : outil interne de Nathan, en français, jamais en production ni montré à un joueur",
  "apps/web/src/banc/bancLogique.ts": "banc d'essai du rendu (`?banc`, lot 50) : libellés des mesures de l'outil interne, en français",
  "apps/web/src/compteurImages.ts": "compteur d'images par seconde de `?debug` (lot 43) : outil interne de Nathan, des nombres et leurs unités, jamais montré à un joueur",
  "apps/web/src/scene/sponsors.ts": "sponsors fictifs de la scène (lot 43) : des noms propres inventés peints dans le décor 3D (une texture), pas du texte d'interface ; ils ne se traduisent pas",
  // Lot I5 : les outils internes de Jump restent en français (lot I5 § 2 : `?debug&tune` tel quel ; seul son habillage suit les jetons, outils.css).
  "apps/jump/src/tune.ts": "outil de réglage du personnage (`?debug&tune`) : outil interne de Nathan, en français",
  "apps/jump/src/gallery.ts": "galerie des morceaux (`?modules`, lot 4) : outil interne de conception des niveaux, en français",
  "apps/jump/src/verify.ts": "page de vérification des rediffusions (`verify.html`, tests de navigateur) : aucun texte d'interface",
  "apps/jump/src/themes.ts": "noms internes des thèmes et des décors (`label` : outils `?debug`, galerie, tests) ; l'interface lit `theme.<code>` du catalogue",
  "apps/jump/src/audioLogic.ts": "noms internes des ambiances sonores (`__jump.theme.ambience` de `?debug`) : jamais affichés au joueur",
  // La page d'outils de Jump (`/jump/admin/`) : sœur de celle de Track, outil interne de l'éditeur, en français.
  "apps/jump/admin": "page d'outils de Jump (`/jump/admin/`) : outil interne de l'éditeur, en français seulement (hors des catalogues des joueurs)",
  "apps/jump/src/admin.ts": "page d'outils de Jump (`/jump/admin/`) : outil interne de l'éditeur, en français",
  "apps/jump/src/adminAcces.ts": "porte de la page d'outils de Jump (`/jump/admin/`, connexion du panneau) : outil interne de l'éditeur, en français",
  "apps/jump/src/adminLogic.ts": "page d'outils de Jump (`/jump/admin/`) : outil interne, en français",
  // Lot 19 (Jump) : l'outil de la variété, en français comme la galerie.
  "apps/jump/src/semaine.ts": "outil de la variété (`?semaine=`, lot 19) : 7 niveaux du jour côte à côte et leurs morceaux de base, outil interne de Nathan, en français",
};

/**
 * Lot I6 : où chaque application lit ses clés (pour le refus d'une clé jamais lue, clesUtilisees.test.ts) : ses sources et ses pages HTML, hors
 * catalogues et hors tests. Le catalogue commun est lu par toutes les applications et par le socle (`packages/ui/src`, `packages/profile/src`).
 */
export const SOURCES_DES_CLES: Record<string, string[]> = {
  "packages/ui": ["packages/ui/src"],
  "apps/portail": ["apps/portail/src", "apps/portail/index.html", "apps/portail/profil", "apps/portail/classement", "apps/portail/nouveautes", "apps/portail/ui"],
  "apps/web": ["apps/web/src", "apps/web/index.html"],
  "apps/jump": ["apps/jump/src", "apps/jump/index.html"],
  commun: ["packages/ui/src", "packages/ui/outils", "packages/profile/src", "apps/portail/src", "apps/portail/index.html", "apps/portail/profil", "apps/portail/classement", "apps/portail/nouveautes", "apps/portail/ui", "apps/web/src", "apps/web/index.html", "apps/jump/src", "apps/jump/index.html"],
};
