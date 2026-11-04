// Lot K4e (plateforme) — **les fiches brutes**, telles que les lisent `npm run fiches` et les tests : les fichiers `config/jeux/<id>.json` du dépôt, plus, **en essai seulement**, ceux d'un ou plusieurs
// dossiers supplémentaires (`CDJ_FICHES_SUPPLEMENTAIRES`, séparés par `:`). C'est ainsi que `scripts/jeu-fictif.mjs` pose la fiche d'un jeu fictif sans qu'un fichier à son nom entre dans le dépôt.
// **La variable est refusée hors essai** : elle n'est lue que si le processus est un test (`VITEST`, `NODE_ENV=test`) ou si le banc du jeu fictif l'a annoncé (`CDJ_MODE_ESSAI=1`) ; sur une machine de
// production, dans un workflow de mise en production, elle fait échouer la lecture au lieu d'ajouter un jeu. Aucune dépendance.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
export const VARIABLE_FICHES_SUPPLEMENTAIRES = "CDJ_FICHES_SUPPLEMENTAIRES";

/** Le processus est-il un essai (test Vitest, ou banc du jeu fictif) ? */
export const estUnEssai = (env = process.env) => Boolean(env.VITEST) || env.NODE_ENV === "test" || env.CDJ_MODE_ESSAI === "1";

/** Les dossiers de fiches supplémentaires demandés (vide hors essai demandé) ; lève si la variable est posée hors essai. */
export function dossiersSupplementaires(env = process.env) {
  const brut = env[VARIABLE_FICHES_SUPPLEMENTAIRES];
  if (!brut) return [];
  if (!estUnEssai(env)) throw new Error(`${VARIABLE_FICHES_SUPPLEMENTAIRES} est réservée aux essais (tests, scripts/jeu-fictif.mjs) : elle ajouterait un jeu aux fiches. Supprime la variable.`);
  return brut.split(delimiter).filter(Boolean);
}

/** Les fiches brutes `[{ id, brut, fichier }]`, triées par identifiant : celles du dépôt (`config/jeux`), puis celles des dossiers supplémentaires. Un identifiant en double est une erreur claire. */
export function lireFichesBrutes(racine = RACINE, env = process.env) {
  const dossiers = [join(racine, "config/jeux"), ...dossiersSupplementaires(env)];
  const fiches = [];
  for (const dossier of dossiers) {
    if (!existsSync(dossier)) throw new Error(`dossier de fiches introuvable : ${dossier}`);
    for (const f of readdirSync(dossier).filter((x) => x.endsWith(".json")).sort()) {
      const id = f.slice(0, -5);
      const fichier = join(dossier, f);
      if (fiches.some((x) => x.id === id)) throw new Error(`deux fiches pour le jeu « ${id} » : ${fiches.find((x) => x.id === id).fichier} et ${fichier}`);
      fiches.push({ id, brut: JSON.parse(readFileSync(fichier, "utf8")), fichier });
    }
  }
  return fiches.sort((a, b) => (a.id < b.id ? -1 : 1));
}
