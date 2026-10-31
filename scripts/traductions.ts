// Lot I6 (plateforme) : la relecture des traductions. `npm run traductions` écrit docs/plateforme/traductions.md : toutes les chaînes anglaises du
// portail, de Track, de Jump et du catalogue commun, rangées par application puis par écran (le premier mot de la clé), avec la clé et le
// français en face — pour que Nathan relise tout d'un coup. `npm run traductions -- --verifier` échoue si le fichier du dépôt n'est pas à jour ;
// le test packages/ui/test/traductions.test.ts fait la même vérification (après tout changement de catalogue : `npm run traductions`).
// Les catalogues sont ceux de packages/ui/test/applications.ts (le test vérifie que la liste est la même).
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CATALOGUE_COMMUN } from "../packages/ui/src/catalogue";
import type { Catalogue } from "../packages/ui/src/i18n";
import { CATALOGUE_PORTAIL } from "../apps/portail/src/catalogue";
import { CATALOGUE_VITRINE } from "../apps/portail/src/catalogueVitrine";
import { CATALOGUE_DEMO } from "../apps/portail/src/catalogueDemo";
import { CATALOGUE_IPHONE } from "../packages/ui/src/catalogue.iphone";
import { CATALOGUE_INTERRUPTEUR } from "../packages/ui/src/catalogue.interrupteur";
import { CATALOGUE_MUSIQUE } from "../packages/ui/src/catalogue.musique";
import { CATALOGUE_APERCU as APERCU_PORTAIL } from "../apps/portail/src/catalogueApercu";
import { CATALOGUE_BASE as TRACK_BASE } from "../apps/web/src/catalogue.base";
import { CATALOGUE_ACCUEIL as TRACK_ACCUEIL } from "../apps/web/src/catalogue.accueil";
import { CATALOGUE_COURSE as TRACK_COURSE } from "../apps/web/src/catalogue.course";
import { CATALOGUE_REGLAGES as TRACK_REGLAGES } from "../apps/web/src/catalogue.reglages";
import { CATALOGUE_SALON as TRACK_SALON } from "../apps/web/src/catalogue.salon";
import { CATALOGUE_APERCU as APERCU_TRACK } from "../apps/web/src/catalogue.apercu";
import { CATALOGUE_BASE as JUMP_BASE } from "../apps/jump/src/catalogue.base";
import { CATALOGUE_PARTIE as JUMP_PARTIE } from "../apps/jump/src/catalogue.partie";
import { CATALOGUE_ACCUEIL as JUMP_ACCUEIL } from "../apps/jump/src/catalogue.accueil";
import { CATALOGUE_ARRIVEE as JUMP_ARRIVEE } from "../apps/jump/src/catalogue.arrivee";
import { CATALOGUE_REGLAGES as JUMP_REGLAGES } from "../apps/jump/src/catalogue.reglages";
import { CATALOGUE_APERCU as APERCU_JUMP } from "../apps/jump/src/catalogue.apercu";
import { CATALOGUE_TOWER } from "../apps/tower/src/catalogue";

type Bilingue = { fr: Catalogue; en: Catalogue };

/** Les catalogues relus, dans l'ordre du document : (nom de packages/ui/test/applications.ts, fichier, catalogue). */
export const CATALOGUES_RELUS: [nom: string, fichier: string, catalogue: Bilingue][] = [
  ["packages/ui (commun)", "packages/ui/src/catalogue.ts", CATALOGUE_COMMUN as unknown as Bilingue],
  ["packages/ui (iPhone)", "packages/ui/src/catalogue.iphone.ts", CATALOGUE_IPHONE as unknown as Bilingue],
  ["packages/ui (interrupteur)", "packages/ui/src/catalogue.interrupteur.ts", CATALOGUE_INTERRUPTEUR as unknown as Bilingue],
  ["packages/ui (musique)", "packages/ui/src/catalogue.musique.ts", CATALOGUE_MUSIQUE as unknown as Bilingue],
  ["apps/portail", "apps/portail/src/catalogue.ts", CATALOGUE_PORTAIL as unknown as Bilingue],
  ["apps/portail (aperçu)", "apps/portail/src/catalogueApercu.ts", APERCU_PORTAIL as unknown as Bilingue],
  ["apps/portail (vitrine)", "apps/portail/src/catalogueVitrine.ts", CATALOGUE_VITRINE as unknown as Bilingue],
  ["apps/portail (démonstration)", "apps/portail/src/catalogueDemo.ts", CATALOGUE_DEMO as unknown as Bilingue],
  ["apps/web (base)", "apps/web/src/catalogue.base.*.ts", TRACK_BASE as unknown as Bilingue],
  ["apps/web (aperçu)", "apps/web/src/catalogue.apercu.ts", APERCU_TRACK as unknown as Bilingue],
  ["apps/web (accueil)", "apps/web/src/catalogue.accueil.*.ts", TRACK_ACCUEIL as unknown as Bilingue],
  ["apps/web (course)", "apps/web/src/catalogue.course.*.ts", TRACK_COURSE as unknown as Bilingue],
  ["apps/web (réglages)", "apps/web/src/catalogue.reglages.*.ts", TRACK_REGLAGES as unknown as Bilingue],
  ["apps/web (Salon)", "apps/web/src/catalogue.salon.*.ts", TRACK_SALON as unknown as Bilingue],
  ["apps/jump (base)", "apps/jump/src/catalogue.base.*.ts", JUMP_BASE as unknown as Bilingue],
  ["apps/jump (aperçu)", "apps/jump/src/catalogue.apercu.ts", APERCU_JUMP as unknown as Bilingue],
  ["apps/jump (partie)", "apps/jump/src/catalogue.partie.*.ts", JUMP_PARTIE as unknown as Bilingue],
  ["apps/jump (accueil)", "apps/jump/src/catalogue.accueil.*.ts", JUMP_ACCUEIL as unknown as Bilingue],
  ["apps/jump (arrivée)", "apps/jump/src/catalogue.arrivee.*.ts", JUMP_ARRIVEE as unknown as Bilingue],
  ["apps/jump (réglages)", "apps/jump/src/catalogue.reglages.*.ts", JUMP_REGLAGES as unknown as Bilingue],
  ["apps/tower", "apps/tower/src/catalogue.*.ts", CATALOGUE_TOWER as unknown as Bilingue],
];

/** Le titre de chaque application dans le document. */
const APPLICATIONS: Record<string, string> = {
  "packages/ui": "Catalogue commun (`@cdj/ui` : composants, noms des jeux, médailles, erreurs du serveur, répliques de Jump)",
  "apps/portail": "Portail Du Jour (accueil, profil commun, classement du jour, vitrine et démonstration de la recette)",
  "apps/web": "Track",
  "apps/jump": "Jump",
  "apps/tower": "Tower",
};

/** Le nom d'un écran (le premier mot de la clé) ; un mot inconnu s'écrit tel quel. */
const ECRANS: Record<string, string> = {
  accueil: "Accueil",
  aide: "Comment jouer",
  apercu: "Aperçu de partage (quand on colle le lien)",
  archives: "Archives",
  arrivee: "Arrivée",
  bandeau: "Bandeaux",
  barre: "Barre des jeux",
  cadre: "Cadre des écrans",
  chargement: "Chargement",
  commande: "Commandes tactiles",
  carnage: "Carnage",
  classement: "Classement",
  commandes: "Commandes",
  commun: "Mots communs",
  course: "Course (surimpressions)",
  demo: "Démonstration (recette seulement)",
  erreur: "Erreurs",
  fantome: "Fantômes",
  fin: "Fin de partie",
  hud: "Partie (surimpressions)",
  icone: "Icônes",
  jeu: "Noms des jeux",
  jour: "Jour",
  jump: "Répliques de Jump (portail et jeu)",
  langue: "Langue",
  lignePartage: "Ligne à partager",
  marque: "Marque",
  medaille: "Médailles",
  miniature: "Miniatures",
  musique: "Musique",
  outil: "Outils",
  page: "Page (titre, chargement)",
  palmares: "Palmarès",
  partage: "Partage de la journée",
  pause: "Pause",
  podium: "Podium du Salon",
  portail: "Portail",
  profil: "Profil",
  rang: "Rang",
  reglages: "Réglages",
  revoir: "Revoir le meilleur tour",
  salon: "Salon",
  tactile: "Commandes tactiles",
  theme: "Thèmes",
  toast: "Messages courts",
  vitrine: "Vitrine des composants (recette seulement)",
};

/** Une valeur de catalogue en une cellule de tableau (pluriels : `one` · `other` ; `|` et retours échappés). */
function cellule(v: Catalogue[string] | undefined): string {
  const texte = v === undefined ? "—" : typeof v === "string" ? v : Object.entries(v).map(([forme, x]) => `${forme} : ${x}`).join(" · ");
  return texte.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Le document (pur : les mêmes catalogues donnent le même texte, octet pour octet). */
export function documentTraductions(catalogues = CATALOGUES_RELUS): string {
  const parApplication = new Map<string, { cle: string; fr: Catalogue[string]; en: Catalogue[string] | undefined; fichier: string }[]>();
  for (const [nom, fichier, cat] of catalogues) {
    const app = nom.split(" (")[0]!;
    const lignes = parApplication.get(app) ?? [];
    for (const cle of Object.keys(cat.fr)) lignes.push({ cle, fr: cat.fr[cle]!, en: cat.en[cle], fichier });
    parApplication.set(app, lignes);
  }
  const total = [...parApplication.values()].reduce((n, l) => n + l.length, 0);
  const out: string[] = [
    "# Relecture des traductions (anglais)",
    "",
    "Fichier **produit** par `npm run traductions` (lot I6 de la plateforme, `scripts/traductions.ts`) : ne pas le modifier à la main, modifier les catalogues puis relancer la commande (le test `packages/ui/test/traductions.test.ts` échoue si ce fichier n'est pas à jour). Pour Nathan : toutes les chaînes anglaises, la clé et le français en face, rangées par application puis par écran (le premier mot de la clé). Commencer par les **choix discutables** listés dans `docs/plateforme/lots/lot-I6-finitions.md`.",
    "",
    `${total} clés. Les paramètres (\`{n}\`, \`{temps}\`…) sont remplacés à l'affichage ; un pluriel s'écrit \`one : …\` · \`other : …\`. Les outils internes (\`?debug&tune\`, administration, galerie des morceaux) restent en français et ne sont pas ici ; les mentions légales anglaises sont une page statique (\`apps/portail/legal/\`), la page 404 porte les deux langues (\`apps/portail/404.html\`).`,
    "",
  ];
  for (const [app, lignes] of parApplication) {
    out.push(`## ${APPLICATIONS[app] ?? app}`, "");
    const ecrans = new Map<string, typeof lignes>();
    for (const l of lignes) {
      const ecran = l.cle.split(".")[0]!;
      ecrans.set(ecran, [...(ecrans.get(ecran) ?? []), l]);
    }
    for (const [ecran, ls] of [...ecrans].sort(([a], [b]) => (ECRANS[a] ?? a).localeCompare(ECRANS[b] ?? b, "fr"))) {
      const fichiers = [...new Set(ls.map((l) => l.fichier))].map((f) => `\`${f}\``).join(", ");
      out.push(`### ${ECRANS[ecran] ?? ecran} (\`${ecran}.*\`, ${fichiers})`, "", "| Clé | Français | Anglais |", "|---|---|---|");
      for (const l of ls) out.push(`| \`${l.cle}\` | ${cellule(l.fr)} | ${cellule(l.en)} |`);
      out.push("");
    }
  }
  return out.join("\n");
}

/** Le fichier produit. */
export const FICHIER_TRADUCTIONS = "docs/plateforme/traductions.md";

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // Lancé depuis le paquet construit par esbuild (node_modules/.cache/cdj/) par `npm run` : le dossier courant est la racine du dépôt.
  const chemin = join(process.cwd(), FICHIER_TRADUCTIONS);
  const attendu = documentTraductions();
  if (process.argv.includes("--verifier")) {
    let actuel = "";
    try {
      actuel = readFileSync(chemin, "utf8");
    } catch {
      /* absent : pas à jour */
    }
    if (actuel !== attendu) {
      console.error(`${FICHIER_TRADUCTIONS} n'est pas à jour : npm run traductions`);
      process.exit(1);
    }
    console.log(`${FICHIER_TRADUCTIONS} est à jour.`);
  } else {
    writeFileSync(chemin, attendu);
    console.log(`${FICHIER_TRADUCTIONS} écrit (${attendu.split("\n").filter((l) => l.startsWith("| `")).length} clés).`);
  }
}
