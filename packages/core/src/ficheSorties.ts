// Lot K1 (plateforme) — **ce que `npm run fiches` écrit** : une fonction pure (fiches → { chemin relatif à la racine du dépôt : contenu }). Le script (`scripts/fiches.ts`) ne fait que
// lire les fiches et écrire ces fichiers ; le test `packages/core/test/fiches.test.ts` les recalcule et vérifie qu'ils sont à jour (comme `jetons.css`).
//
// Deux familles de sorties :
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

/** Les fichiers produits, relatifs à la racine du dépôt. */
export function sorties(fiches: readonly FicheJeu[]): Record<string, string> {
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
    `// Les jeux publics au départ (Track et Jump, hérités ; puis les fiches \`on\`).\n` +
    `export const JEUX_PUBLICS_GENERES: readonly string[] = ${lit(jeu.publics)};\n` +
    `export const ZONES_NOUVEAUTES_GENEREES = ${tuple(jeu.zones)};\n` +
    `export const OU_MESSAGE_GENERES = ${tuple(jeu.ou)};\n` +
    `export const NOMS_DE_ZONES_GENERES = ${lit(jeu.nomsDeZones)} as const;\n`;

  s["packages/profile/src/fiches.generated.ts"] =
    ENTETE("jeu") +
    `export const PREFIXES_DE_JEU_GENERES = ${tuple(jeu.prefixes)};\n` +
    `export const OU_ANNONCE_GENERES = ${tuple(jeu.ou)};\n` +
    `export const JEUX_PUBLICS_GENERES: readonly string[] = ${lit(jeu.publics)};\n`;

  const ids = ["track", "jump", ...fiches.map((f) => f.id)];
  // Des constantes une à une (pas un objet) : un `r.tower.fond` écrit dans un jeton serait gardé par les constructions des jeux (un accès de propriété n'est pas « pur »), un identifiant se remplace par sa valeur.
  const constantes = fiches.flatMap((f) =>
    (["fond", "coque", "police"] as const).map((k) => `export const ETIQUETTE_${f.id.toUpperCase().replace(/-/g, "_")}_${k.toUpperCase()} = ${lit(f.etiquette[k])};\n`),
  );
  s["packages/ui/src/fiches.generated.ts"] =
    ENTETE("jeu") +
    `// Les jeux de la plateforme : Track et Jump (sans fiche jusqu'aux lots K1b et K1c), puis ceux qui en ont une.\n` +
    `export type JeuGenere = ${ids.map(lit).join(" | ")};\n` +
    `// L'étiquette des jeux qui ont une fiche : les valeurs des jetons du socle (\`jetons.ts\` garde leurs noms).\n` +
    constantes.join("") +
    `export const ETIQUETTES_FICHES = {${fiches.map((f) => ` ${lit(f.id)}: { fond: ETIQUETTE_${f.id.toUpperCase().replace(/-/g, "_")}_FOND, coque: ETIQUETTE_${f.id.toUpperCase().replace(/-/g, "_")}_COQUE, police: ETIQUETTE_${f.id.toUpperCase().replace(/-/g, "_")}_POLICE, dessin: ${lit(f.etiquette.dessin)} }`).join(",")} } as const;\n`;

  s["packages/musique/src/fiches.generated.ts"] =
    ENTETE("jeu") +
    `// Les scènes des jeux qui ont une fiche (celles de Track et de Jump restent dans \`scenes.ts\`).\n` +
    `export const SCENES_FICHES = ${JSON.stringify(Object.fromEntries(fiches.map((f) => [f.id, f.musique.scenes])))} as const;\n` +
    `// Les applications qui peuvent jouer de la musique : Track, Jump, les jeux à fiche, puis le portail (qui doit être nommé : \`tous\` ne le désigne pas).\n` +
    `export const JEUX_MUSIQUE_GENERES = ${tuple(["track", "jump", ...ids.slice(2), "portail"])};\n` +
    `// Ce que \`tous\` désigne : les jeux, pas le portail.\n` +
    `export const JEUX_DE_TOUS_GENERES = ${tuple(ids)};\n`;

  return s;
}
