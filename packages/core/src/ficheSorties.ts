// Lot K1 (plateforme) — **ce que `npm run fiches` écrit** : une fonction pure (fiches → { chemin relatif à la racine du dépôt : contenu }). Le script (`scripts/fiches.ts`) ne fait que
// lire les fiches et écrire ces fichiers ; le test `packages/core/test/fiches.test.ts` les recalcule et vérifie qu'ils sont à jour (comme `jetons.css`).
//
// Trois familles de sorties (lot K2 : la vue du serveur) :
//   - **les projections JSON**, une par lecteur (`config/jeux/projections/<lecteur>.json`) : lues par les scripts (`.mjs`), le portail (import JSON de Vite) et les tests ;
//   - **les vues TypeScript** des paquets qui n'importent ni `@cdj/core` ni un fichier hors d'eux (`@cdj/profile`, `@cdj/ui`, `@cdj/musique` : tests de pureté et `rootDir`) et celle de `@cdj/core` :
//     des constantes **écrites en toutes lettres**, identiques à ce que le code contenait, pour qu'**aucun octet** ne soit ajouté à un jeu (les budgets sont serrés) et que les types restent
//     des unions de littéraux (`ZoneNouveaute`, `OuAnnonce`, `Jeu`).
import { jsonDeProjection, projectionCI, projectionJeu, projectionPortail, projectionServeur, type FicheJeu } from "./fiche";

export const DOSSIER_FICHES = "config/jeux";
export const DOSSIER_PROJECTIONS = "config/jeux/projections";

const ENTETE = (lecteur: string) =>
  `// GÉNÉRÉ par \`npm run fiches\` (lot K1 : config/jeux/<id>.json → ${lecteur}) — NE PAS MODIFIER À LA MAIN : changer la fiche du jeu, puis relancer la commande.\n// Un test vérifie que ce fichier est à jour.\n`;

const lit = (v: unknown): string => JSON.stringify(v);
const tuple = (l: readonly string[]): string => `[${l.map(lit).join(", ")}] as const`;

// ---------------------------------------------------------------------------------------------------------------------------------------
// Lot K4e — les feuilles de style d'un jeu à étiquette générique, tirées de sa fiche. Les jeux à dessin propre (Track, Jump, Tower) gardent leurs règles écrites à la main ; un jeu `generique` n'écrit
// AUCUNE règle de style partagée. Sans jeu générique ces fichiers ne contiennent qu'un commentaire : le premier chargement des applications ne pèse pas un octet de plus.

const ENTETE_CSS = (lecteur: string) =>
  `/* GÉNÉRÉ par \`npm run fiches\` (lot K4e : config/jeux/<id>.json → ${lecteur}) — NE PAS MODIFIER À LA MAIN : changer la fiche du jeu, puis relancer la commande. Un test vérifie que ce fichier est à jour. */\n`;
const generiques = (fiches: readonly FicheJeu[]) => fiches.filter((f) => f.etiquette.dessin === "generique");

/** `packages/ui/src/jeux.generated.css` : l'étiquette générique (structure, une fois) et, par jeu générique, ses couleurs et la coque de sa cartouche. */
function cssUi(fiches: readonly FicheJeu[]): string {
  const g = generiques(fiches);
  if (g.length === 0) return ENTETE_CSS("ui");
  const structure = `/* L'étiquette générique : un papier de la couleur du jeu, bordé d'encre, le nom dans la police du jeu. */
.jeu-etiquette {
  display: flex;
  flex-direction: column;
  gap: var(--dj-espace-1);
  background: var(--jeu-fond);
  color: var(--dj-encre);
  border: var(--dj-trait) solid var(--dj-encre);
  padding: var(--dj-espace-3) var(--dj-espace-5);
  min-height: 92px;
}
.jeu-etiquette__tete {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0 var(--dj-espace-4);
}
.jeu-etiquette__titre {
  font-family: var(--jeu-police);
  font-weight: 400;
  font-size: var(--dj-taille-22);
  line-height: 1;
}
.jeu-etiquette__numero {
  font-family: var(--dj-police-chiffres);
  font-weight: 700;
  font-size: var(--dj-taille-12);
}
.jeu-etiquette__texte {
  font-size: var(--dj-taille-13);
  font-weight: 600;
}
`;
  const parJeu = g
    .map((f) => `.jeu-etiquette--${f.id} {\n  --jeu-fond: ${f.etiquette.fond};\n  --jeu-police: ${f.etiquette.police};\n}\n.dj-cartouche--${f.id} {\n  background: ${f.etiquette.coque};\n}\n`)
    .join("");
  return ENTETE_CSS("ui") + structure + parJeu;
}

/** `packages/ui/src/amis.generated.css` : le sélecteur « Tous / Amis » de chaque jeu générique (importé par `amis.css`, à la demande avec lui). */
function cssAmis(fiches: readonly FicheJeu[]): string {
  return (
    ENTETE_CSS("ui, amis") +
    generiques(fiches)
      .map((f) => `.dj-amis-selecteur.dj-amis-selecteur--${f.id} {\n  --sel-fond: ${f.etiquette.fond};\n  --sel-actif-fond: var(--dj-encre);\n  --sel-actif-texte: ${f.etiquette.fond};\n}\n`)
      .join("")
  );
}

/** `apps/portail/src/jeux.generated.css` : les étiquettes de zone (panneau d'administration, nouveautés) et la mise en page de l'étiquette générique sur l'étagère du portail. */
function cssPortail(fiches: readonly FicheJeu[]): string {
  const g = generiques(fiches);
  if (g.length === 0) return ENTETE_CSS("portail");
  const zones = g
    .map(
      (f) =>
        `.admin-zone.admin-zone--${f.zoneNouveautes} {\n  background: ${f.etiquette.fond};\n  color: var(--dj-encre);\n}\n.nouveautes-zone.nouveautes-zone--${f.zoneNouveautes} {\n  background: ${f.etiquette.fond};\n  color: var(--dj-encre);\n}\n`,
    )
    .join("");
  return (
    ENTETE_CSS("portail") +
    zones +
    `/* L'étiquette générique sur l'étagère : le numéro et le thème sous le nom, l'accroche sur deux lignes réservées ; en cartouche compacte, le nom et le numéro côte à côte. */
.portail-etagere .jeu-etiquette__tete {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.portail-etagere .jeu-etiquette__texte {
  min-height: calc(2 * 1.3em);
  line-height: 1.3;
}
.portail-etagere--compacte .jeu-etiquette__tete {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--dj-espace-3);
}
.portail-etagere--compacte .jeu-etiquette__numero {
  white-space: nowrap;
}
`
  );
}

/** `apps/api/src/registre.generated.ts` : les jeux du registre du serveur, un par fiche, dans l'ordre. Le module d'un jeu est `apps/api/src/<code>.ts` et exporte `<CODE>_GAME` (convention des trois jeux). */
function registreServeur(fiches: readonly FicheJeu[]): string {
  const nom = (f: FicheJeu) => `${f.code.toUpperCase().replace(/-/g, "_")}_GAME`;
  return (
    ENTETE("serveur") +
    `import type { GameDefinition } from "./games";\n` +
    fiches.map((f) => `import { ${nom(f)} } from "./${f.code}";\n`).join("") +
    `\n// Lot K4e : le registre vient des fiches. \`temoin\` : un jeu témoin n'est jamais dans le registre d'un serveur de production (\`jeuxPourEnvironnement\`, \`registry.ts\`).\n` +
    `export const JEUX_DU_REGISTRE: readonly { code: string; temoin: boolean; jeu: GameDefinition<never> }[] = [\n` +
    fiches.map((f) => `  { code: ${lit(f.code)}, temoin: ${f.temoin ? "true" : "false"}, jeu: ${nom(f)} as unknown as GameDefinition<never> },\n`).join("") +
    `];\n`
  );
}


/**
 * Lot K4f — `apps/api/scripts/essais.generated.ts` : les **modules d'essais** des jeux neufs (ceux qui se classent sur la table commune), un par jeu qui a écrit `apps/api/scripts/<code>-essais.ts` (il exporte
 * `ESSAIS_<CODE>`, voir `essais.ts`). `smoke`, `recette:seed` et `routesChaudes` jouent à leur place en bouclant dessus : **aucun script ne porte le nom d'un jeu neuf**. Un import ne se calcule pas : le fichier
 * est écrit ici, comme le registre ; un jeu sans module d'essais n'y est pas (ses essais se limitent aux lectures).
 */
function essaisDesJeuxNeufs(fiches: readonly FicheJeu[], existe: (chemin: string) => boolean): string {
  const nom = (f: FicheJeu) => `ESSAIS_${f.code.toUpperCase().replace(/-/g, "_")}`;
  const jeux = fiches.filter((f) => f.donnees.tableCommune && existe(`apps/api/scripts/${f.code}-essais.ts`));
  return (
    ENTETE("serveur") +
    `import type { ModuleEssais } from "./essais";\n` +
    jeux.map((f) => `import { ${nom(f)} } from "./${f.code}-essais";\n`).join("") +
    `\n// Le code (\`id\` de la fiche) → son module d'essais.\n` +
    `export const ESSAIS_DES_JEUX_NEUFS: Readonly<Record<string, ModuleEssais>> = {\n` +
    jeux.map((f) => `  ${lit(f.id)}: ${nom(f)},\n`).join("") +
    `};\n`
  );
}

/** Les trois jeux livrés, dont les catalogues sont listés à la main (par zone) : tout autre jeu des fiches est « neuf » et suit la convention `apps/<id>/src/catalogue.ts` → `CATALOGUE_<ID>`. */
const JEUX_LIVRES = ["track", "jump", "tower"];

/**
 * `scripts/catalogues-jeux.generated.ts` : les catalogues des jeux neufs que lit `scripts/traductions.ts` (le document des traductions). Un import ne se calcule pas : le fichier est écrit ici, une ligne par jeu neuf
 * dont l'application a déjà son catalogue (`existe(chemin)` : le disque, injecté pour que cette fonction reste pure). Vide tant qu'aucun jeu neuf n'a d'application.
 */
function cataloguesDesJeuxNeufs(fiches: readonly FicheJeu[], existe: (chemin: string) => boolean): string {
  const nom = (f: FicheJeu) => `CATALOGUE_${(f.dossiers?.app ?? f.id).toUpperCase().replace(/-/g, "_")}`;
  const neufs = fiches.filter((f) => !JEUX_LIVRES.includes(f.id) && existe(`apps/${f.dossiers?.app ?? f.id}/src/catalogue.ts`));
  return (
    ENTETE("traductions") +
    neufs.map((f) => `import { ${nom(f)} } from "../apps/${f.dossiers?.app ?? f.id}/src/catalogue";\n`).join("") +
    `\ntype Bilingue = { fr: Record<string, string>; en: Record<string, string> };\n` +
    `// [nom (de l'application), fichiers, catalogue, titre dans le document].\n` +
    `export const CATALOGUES_JEUX_NEUFS: [string, string, Bilingue, string][] = [\n` +
    neufs.map((f) => `  [${lit(`apps/${f.dossiers?.app ?? f.id}`)}, ${lit(`apps/${f.dossiers?.app ?? f.id}/src/catalogue.*.ts`)}, ${nom(f)} as unknown as Bilingue, ${lit(f.nom.fr)}],\n`).join("") +
    `];\n`
  );
}

/** Les fichiers produits pour ces fiches (toutes, ou sans les témoins pour les variantes de production). */
function sortiesDe(fiches: readonly FicheJeu[], existe: (chemin: string) => boolean): Record<string, string> {
  const jeu = projectionJeu(fiches);
  const s: Record<string, string> = {
    [`${DOSSIER_PROJECTIONS}/portail.json`]: jsonDeProjection(projectionPortail(fiches)),
    [`${DOSSIER_PROJECTIONS}/serveur.json`]: jsonDeProjection(projectionServeur(fiches)),
    [`${DOSSIER_PROJECTIONS}/ci.json`]: jsonDeProjection(projectionCI(fiches)),
    [`${DOSSIER_PROJECTIONS}/jeu.json`]: jsonDeProjection(jeu),
  };

  s["packages/core/src/fiches.generated.ts"] =
    ENTETE("jeu") +
    `export const IDS_FICHES = ${tuple(fiches.map((f) => f.id))};\n` +
    `// Les jeux publics au départ (les fiches \`on\`, dans l'ordre).\n` +
    `export const JEUX_PUBLICS_GENERES: readonly string[] = ${lit(jeu.publics)};\n` +
    `export const ZONES_NOUVEAUTES_GENEREES = ${tuple(jeu.zones)};\n` +
    `export const OU_MESSAGE_GENERES = ${tuple(jeu.ou)};\n` +
    `export const NOMS_DE_ZONES_GENERES = ${lit(jeu.nomsDeZones)} as const;\n`;

  s["packages/profile/src/fiches.generated.ts"] =
    ENTETE("jeu") +
    `export const PREFIXES_DE_JEU_GENERES = ${tuple(jeu.prefixes)};\n` +
    `export const OU_ANNONCE_GENERES = ${tuple(jeu.ou)};\n` +
    `export const JEUX_PUBLICS_GENERES: readonly string[] = ${lit(jeu.publics)};\n`;

  // Lot K2 : la fiche telle que le serveur la lit (le module des jeux, `apps/api/src/jeux/`) : la projection `serveur`, écrite en TypeScript pour que le paquet du serveur n'importe aucun fichier hors de lui.
  s["apps/api/src/fiches.generated.ts"] =
    ENTETE("serveur") + `export const FICHES_SERVEUR = ${JSON.stringify(projectionServeur(fiches).jeux, null, 2)} as const;\n`;

  s["packages/ui/src/jeux.generated.css"] = cssUi(fiches);
  s["packages/ui/src/amis.generated.css"] = cssAmis(fiches);
  s["apps/portail/src/jeux.generated.css"] = cssPortail(fiches);
  s["apps/api/src/registre.generated.ts"] = registreServeur(fiches);
  s["scripts/catalogues-jeux.generated.ts"] = cataloguesDesJeuxNeufs(fiches, existe);
  s["apps/api/scripts/essais.generated.ts"] = essaisDesJeuxNeufs(fiches, existe);

  const ids = fiches.map((f) => f.id);
  // Des constantes une à une (pas un objet) : un `r.tower.fond` écrit dans un jeton serait gardé par les constructions des jeux (un accès de propriété n'est pas « pur »), un identifiant se remplace par sa valeur.
  const constantes = fiches.flatMap((f) =>
    (["fond", "coque", "police"] as const).map((k) => `export const ETIQUETTE_${f.id.toUpperCase().replace(/-/g, "_")}_${k.toUpperCase()} = ${lit(f.etiquette[k])};\n`),
  );
  s["packages/ui/src/fiches.generated.ts"] =
    ENTETE("jeu") +
    `// Les jeux de la plateforme : un par fiche, dans l'ordre.\n` +
    `export type JeuGenere = ${ids.map(lit).join(" | ")};\n` +
    `// L'étiquette de chaque jeu : les valeurs des jetons du socle (\`jetons.ts\` garde leurs noms).\n` +
    constantes.join("") +
    `// Lot K4e : y a-t-il un jeu à étiquette générique ? Tant que non, le dessin générique de \`composants.ts\` est du code mort que l'empaqueteur retire (aucun octet de plus dans les applications).\n` +
    `export const A_DES_JEUX_GENERIQUES = ${fiches.some((f) => f.etiquette.dessin === "generique")};\n` +
    `export const ETIQUETTES_FICHES = {${fiches.map((f) => ` ${lit(f.id)}: { fond: ETIQUETTE_${f.id.toUpperCase().replace(/-/g, "_")}_FOND, coque: ETIQUETTE_${f.id.toUpperCase().replace(/-/g, "_")}_COQUE, police: ETIQUETTE_${f.id.toUpperCase().replace(/-/g, "_")}_POLICE, dessin: ${lit(f.etiquette.dessin)} }`).join(",")} } as const;\n`;

  s["packages/musique/src/fiches.generated.ts"] =
    ENTETE("jeu") +
    `// Les scènes de chaque jeu (\`musique.scenes\` de sa fiche).\n` +
    `export const SCENES_FICHES = ${JSON.stringify(Object.fromEntries(fiches.map((f) => [f.id, f.musique.scenes])))} as const;\n` +
    `// Les applications qui peuvent jouer de la musique : les jeux, puis le portail (qui doit être nommé : \`tous\` ne le désigne pas).\n` +
    `export const JEUX_MUSIQUE_GENERES = ${tuple([...ids, "portail"])};\n` +
    `// Ce que \`tous\` désigne : les jeux, pas le portail.\n` +
    `export const JEUX_DE_TOUS_GENERES = ${tuple(ids)};\n`;

  return s;
}

/**
 * Lot K4f — **la variante de production** d'un fichier généré : le même, écrit sans les jeux témoins (un témoin n'est jamais mis en production : il ne doit pas non plus peser sur le portail que les joueurs
 * téléchargent). Le portail de la production et la mesure de son budget (`PORTAIL_TEMOINS=0`, `apps/portail/vite.config.ts`) lisent ces variantes à la place des fichiers complets (alias de la construction) ;
 * la recette, les aperçus et le développement lisent les fichiers complets. `null` : ce fichier n'a pas de variante.
 */
export function varianteDeProduction(chemin: string): string | null {
  if (chemin === `${DOSSIER_PROJECTIONS}/portail.json`) return `${DOSSIER_PROJECTIONS}/portail.production.json`;
  if (/^(packages\/(core|profile|ui|musique)\/src\/fiches|packages\/ui\/src\/jeux|apps\/portail\/src\/jeux)\.generated\.(ts|css)$/.test(chemin)) return chemin.replace(".generated.", ".production.generated.");
  return null;
}

/** Les fichiers produits, relatifs à la racine du dépôt. `existe` : le disque (un chemin relatif à la racine existe-t-il ?), pour les fichiers qui n'existent que si le jeu a déjà son application. */
export function sorties(fiches: readonly FicheJeu[], existe: (chemin: string) => boolean = () => false): Record<string, string> {
  const s = sortiesDe(fiches, existe);
  for (const [chemin, contenu] of Object.entries(sortiesDe(fiches.filter((f) => !f.temoin), existe))) {
    const variante = varianteDeProduction(chemin);
    if (variante) s[variante] = contenu;
  }
  return s;
}
