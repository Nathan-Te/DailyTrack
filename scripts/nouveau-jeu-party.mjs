// Lot PA1 (plateforme) — **le moule d'un jeu Party** : `npm run nouveau-jeu -- --id <id> --categorie party` copie « Cibles » comme pour tout jeu, puis lui retire ce qu'un jeu Party n'a pas — **le générateur de niveaux
// (le « niveau » d'un jour est la graine du jour : `tirage.ts`), les thèmes, le robot (le bot et les seuils des médailles) et les jours figés** — et remplace les quelques fichiers qui les portaient par leur version Party
// (`scripts/modele-party/<chemin dans « Cibles »>.modele`). Rien d'autre ne change : l'application (`brancherJeu` fournit tout l'habillage), le serveur (`definirJeuParty`), les e2e et les tests restent ceux du modèle.
// **Le modèle fait foi** : tout ce qui n'est pas dans la liste ci-dessous est « Cibles » tel quel ; une amélioration du modèle passe par lui. Une ligne de ces listes qui ne trouve plus son texte lève une erreur claire
// (« le générateur doit suivre ») : le job « Kit de bout en bout » (jeu `essaiparty`) la voit tout de suite.
// Lot PA1c : le moule Party ne copie plus ce que « Cibles » ne fait que pour ses propres essais — **les essais du témoin** (`?debug&chargement|hud|bilan|dessins` de `definition.ts`, la surimpression de la scène, les clés `bilan.*`
// du catalogue), **les trois specs du kit** (chargement, surimpression, fin et aide : ils tournent déjà sur « Cibles ») et **`variante.ts`** (un jeu Party se classe au score : ses règles, ses colonnes et le texte du score sont dans
// `partie.ts`). `--categorie party --classement temps` est refusé.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** L'identité de la catégorie (`POLICE_PARTY` et `MOTIF_PARTY` de `@cdj/core/fiche` : un test les compare). */
export const POLICE_PARTY = "Lilita One";
export const MOTIF_PARTY = "confettis";

const DOSSIER_MODELES = join(dirname(fileURLToPath(import.meta.url)), "modele-party");

/** Les fichiers de « Cibles » qu'un jeu Party ne copie pas : le générateur, le bot, les médailles, les thèmes, les jours figés et leurs outils. */
/** Lot PA1c : les trois specs du kit (ils tournent sur « Cibles ») qu'un jeu Party ne copie pas : leurs entrées de `durees.json` et de la fiche (`e2e.specs`, `e2e.regression`) partent avec eux. */
export const SPECS_DU_KIT = ["chargement-partie.spec.ts", "surimpression.spec.ts", "fin-et-aide.spec.ts"];
export const PARTY_SUPPRIMES = new Set([
  "packages/cibles-sim/src/generateur.ts",
  "packages/cibles-sim/src/bot.ts",
  "packages/cibles-sim/src/medailles.ts",
  "packages/cibles-sim/src/themes.ts",
  "packages/cibles-sim/src/jours.ts",
  "packages/cibles-sim/tools/figer.ts",
  "packages/cibles-sim/src/variante.ts", // lot PA1c : un jeu Party se classe au score, sans variante
  "packages/cibles-sim/test/variante.test.ts",
  "apps/cibles/e2e/chargement-partie.spec.ts", // lot PA1c : les essais du kit tournent sur « Cibles »
  "apps/cibles/e2e/surimpression.spec.ts",
  "apps/cibles/e2e/fin-et-aide.spec.ts",
  "apps/cibles/public/jours/.gitkeep",
  "apps/api/scripts/cibles-empreintes.ts",
]);

/** Les fichiers qu'un jeu Party écrit à sa façon (remplacés ou ajoutés) : leur contenu est dans `scripts/modele-party/<chemin>.modele`. */
export const PARTY_MODELES = [
  "packages/cibles-sim/src/tirage.ts",
  "packages/cibles-sim/src/partie.ts", // lot PA1c : la partie ET le classement (colonnes, score, texte du score, joueurs scriptés) : plus de `variante.ts`
  "packages/cibles-sim/src/index.ts",
  "packages/cibles-sim/test/cibles.test.ts",
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
  "packages/cibles-sim/src/rediffusion.ts": [['from "./generateur"', 'from "./tirage"']],
  "packages/cibles-sim/tools/references.ts": [
    ["enregistrer, jouer, touchesDuBot, VARIANTE,", "enregistrer, jouer, joueurLent, joueurVif,"],
    ['{ nom: "bot", touches: touchesDuBot(contenu) },', '{ nom: "joueur-vif", touches: joueurVif(contenu, () => 12) }, // le joueur scripté de `partie.ts` (un jeu Party n\'a pas de bot)'],
    ['{ nom: "joueur-lent", touches: VARIANTE.joueurLent(contenu) }, // le joueur lent de la variante (variante.ts)', '{ nom: "joueur-lent", touches: joueurLent(contenu) },'],
    ["le bot, un joueur qui rate et tarde", "un joueur vif, un joueur qui rate et tarde"],
  ],
  // Lot PA1c : le rendu de la scène sans les essais du témoin (HUD en surimpression) et sans `VARIANTE` (les règles du score sont dans `partie.ts`).
  "apps/cibles/src/scene.ts": [
    ["Partie, TICKS_PAR_SECONDE, VARIANTE, caseAuPoint, decoderRediffusion, enregistrer, type Contenu", "Partie, caseAuPoint, decoderRediffusion, enregistrer, fractionDe, hudDe, scoreDe, type Contenu"],
    [/  \/\/ Lot PG1 — l'essai du HUD en surimpression[\s\S]*?\n  \};\n/, ""],
    ["      majZones();\n", ""],
    ["hud: () => VARIANTE.hud(partie.touches, partie.tick),", "hud: () => hudDe(partie.touches, partie.tick),"],
    ["score: VARIANTE.score(partie.resultat())", "score: scoreDe(partie.resultat())"],
    ["VARIANTE.fraction(partie.etat, v)", "fractionDe(partie, v)"],
  ],
  "apps/cibles/e2e/appareil.ts": [
    ["jouer, VARIANTE, type Resultat", "jouer, joueurVif, type Resultat"],
    ["VARIANTE.joueur(contenu, () => delai, (i) => sauf.includes(i))", "joueurVif(contenu, () => delai, (i) => sauf.includes(i))"],
    ["qu'on laisse filer (variante « score ») ou sur lesquelles on hésite (variante « temps »). Rend", "qu'on laisse filer. Rend"],
  ],
  "apps/cibles/e2e/classement.spec.ts": [
    ["CIBLES_SIM_VERSION, VARIANTE }", "CIBLES_SIM_VERSION, formatScore, scoreDe }"],
    ['toHaveText(VARIANTE.formatScore(VARIANTE.score(attendu), "fr"))', "toHaveText(formatScore(scoreDe(attendu)))"],
  ],
  "apps/api/scripts/cibles-essais.ts": [
    ["jouer, scoreParColonnes, VARIANTE }", "jouer, joueurVif, scoreParColonnes }"],
    ["// Le joueur scripté de la variante : il laisse filer (`score`) ou hésite (`temps`) une cible de temps en temps ;", "// Le joueur scripté (`partie.ts`) : il laisse filer une cible de temps en temps ;"],
    ["const touches = VARIANTE.joueur(", "const touches = joueurVif("],
  ],
  // Un jeu Party n'a pas de médaille : l'écran de fin n'en montre aucune.
  "apps/cibles/e2e/partie.spec.ts": [
    ['import { VARIANTE, VARIANTE_NOM } from "@cdj/cibles-sim";', 'import { formatScore, scoreDe } from "@cdj/cibles-sim";'],
    ['expect(attendu.touches).toBe(VARIANTE_NOM === "score" ? 18 : 20); // `score` : deux cibles filées ; `temps` : deux hésitations, mais toutes touchées', "expect(attendu.touches).toBe(18); // deux cibles filées"],
    ['toHaveText(VARIANTE.formatScore(VARIANTE.score(attendu), "fr"))', "toHaveText(formatScore(scoreDe(attendu)))"],
    ["toEqual(VARIANTE.score(attendu))", "toEqual(scoreDe(attendu))"],
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
    [/(?:  "bilan\.[^\n]*\n){7}/, ""], // lot PA1c : les clés du bilan servaient l'essai `?debug&bilan=1` du témoin
  ],
  "apps/cibles/src/catalogue.en.ts": [
    ['  "theme.sable": "Sand",\n  "theme.ardoise": "Slate",\n', '  "theme.unique": "Daily",\n'],
    [/  "accueil\.phrase\.sable": "[^\n]*\n  "accueil\.phrase\.ardoise": "[^\n]*\n/, '  "accueil.phrase.unique": "Twenty targets, thirty seconds: the same challenge for everyone, every day.",\n'],
    [/(?:  "bilan\.[^\n]*\n){7}/, ""],
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
  if (chemin === "apps/cibles/e2e/durees.json") {
    const j = JSON.parse(t);
    for (const rubrique of ["secondes", "essentiel"]) for (const s of SPECS_DU_KIT) delete j[rubrique]?.[s];
    t = JSON.stringify(j, null, 2) + "\n";
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
