// Lot PA1 (plateforme) — **le moule d'un jeu Party** : `npm run nouveau-jeu -- --id <id> --categorie party` copie « Cibles » comme pour tout jeu, puis lui retire ce qu'un jeu Party n'a pas — **le générateur de niveaux
// (le « niveau » d'un jour est la graine du jour : `tirage.ts`), les thèmes, le robot (le bot et les seuils des médailles) et les jours figés** — et remplace les quelques fichiers qui les portaient par leur version Party
// (`scripts/modele-party/<chemin dans « Cibles »>.modele`). Rien d'autre ne change : l'application (`brancherJeu` fournit tout l'habillage), le serveur (`definirJeuParty`), les e2e et les tests restent ceux du modèle.
// **Le modèle fait foi** : tout ce qui n'est pas dans la liste ci-dessous est « Cibles » tel quel ; une amélioration du modèle passe par lui. Une ligne de ces listes qui ne trouve plus son texte lève une erreur claire
// (« le générateur doit suivre ») : le job « Kit de bout en bout » (jeu `essaiparty`) la voit tout de suite.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** L'identité de la catégorie (`POLICE_PARTY` et `MOTIF_PARTY` de `@cdj/core/fiche` : un test les compare). */
export const POLICE_PARTY = "Lilita One";
export const MOTIF_PARTY = "confettis";

const DOSSIER_MODELES = join(dirname(fileURLToPath(import.meta.url)), "modele-party");

/** Les fichiers de « Cibles » qu'un jeu Party ne copie pas : le générateur, le bot, les médailles, les thèmes, les jours figés et leurs outils. */
export const PARTY_SUPPRIMES = new Set([
  "packages/cibles-sim/src/generateur.ts",
  "packages/cibles-sim/src/bot.ts",
  "packages/cibles-sim/src/medailles.ts",
  "packages/cibles-sim/src/themes.ts",
  "packages/cibles-sim/src/jours.ts",
  "packages/cibles-sim/tools/figer.ts",
  "apps/cibles/public/jours/.gitkeep",
  "apps/api/scripts/cibles-empreintes.ts",
]);

/** Les fichiers qu'un jeu Party écrit à sa façon (remplacés ou ajoutés) : leur contenu est dans `scripts/modele-party/<chemin>.modele`. */
export const PARTY_MODELES = [
  "packages/cibles-sim/src/tirage.ts",
  "packages/cibles-sim/src/index.ts",
  "packages/cibles-sim/src/variante.ts",
  "packages/cibles-sim/test/cibles.test.ts",
  "packages/cibles-sim/test/variante.test.ts",
  "apps/cibles/src/definition.ts",
  "apps/cibles/src/fiche.ts",
  "apps/cibles/test/fiche.test.ts",
  "apps/api/src/cibles.ts",
  "apps/api/test/cibles.test.ts",
];

/** Les retouches des autres fichiers : `[avant, après]`, chaque `avant` existe exactement une fois (sinon : « le générateur doit suivre »). */
const PARTY_RETOUCHES = {
  "packages/cibles-sim/src/constantes.ts": [
    ["/** La version du générateur du contenu du jour. Elle monte à tout changement de ce que `dailyCibles` produit. */", "/** La version de la dérivation de la graine et du tirage du jour (un jeu Party n'a pas de générateur de niveaux). Elle monte à tout changement de ce que `dailyCibles` produit. */"],
    ["/** Le délai de réaction du bot de l'auteur (le Diamant) : il touche chaque cible 12 ticks (0,4 s) après son apparition. */\nexport const DELAI_BOT = 12;\n", ""],
  ],
  "packages/cibles-sim/src/partie.ts": [['from "./generateur"', 'from "./tirage"']],
  "packages/cibles-sim/src/rediffusion.ts": [['from "./generateur"', 'from "./tirage"']],
  "packages/cibles-sim/tools/references.ts": [
    ["enregistrer, jouer, touchesDuBot, VARIANTE,", "enregistrer, jouer, VARIANTE,"],
    ['{ nom: "bot", touches: touchesDuBot(contenu) },', '{ nom: "joueur-vif", touches: VARIANTE.joueur(contenu, () => 12) }, // le joueur scripté de la variante (un jeu Party n\'a pas de bot)'],
    ["le bot, un joueur qui rate et tarde", "un joueur vif, un joueur qui rate et tarde"],
  ],
  // Un jeu Party n'a pas de médaille : l'écran de fin n'en montre aucune.
  "apps/cibles/e2e/partie.spec.ts": [
    ['await expect(page.locator("#jeu-fin .dj-medaille--pastille.dj-medaille--obtenue")).toBeVisible();', '// Un jeu Party n\'a pas de médaille : l\'écran de fin n\'en montre aucune.\n    await expect(page.locator("#jeu-fin .dj-medaille")).toHaveCount(0);'],
  ],
  "apps/cibles/vite.config.ts": [
    ['import { existsSync, readdirSync } from "node:fs";\n', ""],
    ['const dossierJours = new URL("./public/jours/", import.meta.url).pathname;\nconst joursFiges = existsSync(dossierJours) ? readdirSync(dossierJours).filter((f) => /^\\d{4}-\\d{2}-\\d{2}\\.json$/.test(f)).map((f) => f.slice(0, 10)).sort() : [];\n', ""],
    ["  define: { __JOURS_FIGES__: JSON.stringify(joursFiges) },\n", ""],
  ],
  // Les catalogues : le seul thème d'un jeu Party est `unique` (`THEME_UNIQUE` du kit) — ses clés `theme.unique` et `accueil.phrase.unique`, rien d'autre.
  "apps/cibles/src/catalogue.fr.ts": [
    ['  "theme.sable": "Sable",\n  "theme.ardoise": "Ardoise",\n', '  "theme.unique": "Du jour",\n'],
    [/  "accueil\.phrase\.sable": "[^\n]*\n  "accueil\.phrase\.ardoise": "[^\n]*\n/, '  "accueil.phrase.unique": "Vingt cibles, trente secondes : le même défi pour tous, tous les jours.",\n'],
  ],
  "apps/cibles/src/catalogue.en.ts": [
    ['  "theme.sable": "Sand",\n  "theme.ardoise": "Slate",\n', '  "theme.unique": "Daily",\n'],
    [/  "accueil\.phrase\.sable": "[^\n]*\n  "accueil\.phrase\.ardoise": "[^\n]*\n/, '  "accueil.phrase.unique": "Twenty targets, thirty seconds: the same challenge for everyone, every day.",\n'],
  ],
};

const lireModele = (chemin) => readFileSync(join(DOSSIER_MODELES, `${chemin}.modele`), "utf8");

/** Vrai pour un fichier de « Cibles » qu'un jeu Party ne copie pas. */
export const partySupprime = (chemin) => PARTY_SUPPRIMES.has(chemin);

/** Le texte (avant renommage) d'un fichier de « Cibles » pour un jeu Party : sa version Party, ou lui-même retouché. */
export function partyTexte(chemin, texte) {
  if (PARTY_MODELES.includes(chemin)) return lireModele(chemin);
  let t = texte;
  for (const [avant, apres] of PARTY_RETOUCHES[chemin] ?? []) {
    const trouve = typeof avant === "string" ? t.split(avant).length - 1 : (t.match(avant) ?? []).length;
    if (trouve !== 1) throw new Error(`${chemin} : la retouche Party « ${String(avant).slice(0, 60)} » trouve ${trouve} occurrence(s) au lieu d'une — le modèle « Cibles » a changé, le générateur doit suivre (scripts/nouveau-jeu-party.mjs)`);
    t = typeof avant === "string" ? t.replace(avant, () => apres) : t.replace(avant, apres);
  }
  if (chemin === "packages/cibles-sim/package.json") {
    const j = JSON.parse(t);
    delete j.scripts["figer:cibles"];
    delete j.exports["./bot"];
    t = JSON.stringify(j, null, 2) + "\n";
  }
  return t;
}

/** Les fichiers que le jeu Party ajoute au modèle (leur chemin n'existe pas dans « Cibles »). */
export const partyAjouts = (racine) => PARTY_MODELES.filter((c) => !existsSync(join(racine, c)));
/** Les retouches connues (pour le test du générateur : chacune doit trouver son texte dans le modèle). */
export const PARTY_CHEMINS_RETOUCHES = Object.keys(PARTY_RETOUCHES);
