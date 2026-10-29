import { createHash } from "node:crypto";
import { GENERATOR_VERSION, SIM_VERSION } from "@cdj/sim";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION } from "@cdj/jump-sim";
import type { SqlDb } from "./db";
import { lireGeneration } from "./remiseAZero";

/**
 * Lot R14 — `recette:seed` **n'écrit que ce qui manque**.
 *
 * Avant ce lot, chaque passage du script (à chaque déploiement de chaque PR, puis chaque jour) rejouait toutes les courses fictives, effaçait puis recréait les vingt joueurs du classement
 * et le joueur « Démo » : des milliers d'instructions, des centaines de lignes écrites, pour un résultat identique. Sur l'offre gratuite de Turso, dont le quota est commun à toutes les
 * bases, la recette en a mangé 99 %.
 *
 * Chaque **segment** (les courses de Track d'un jour, l'essai de Jump du jour, le classement d'un jour, « Démo » du jour) laisse un marqueur dans `meta` :
 * `recette_seed:<segment>:<date>` = `<génération de données>|<empreinte du contenu>`. Un segment dont le marqueur est présent, de la génération courante et de la même empreinte est
 * **sauté** (zéro requête de plus). Une **remise à zéro du lancement** change la génération : tous les marqueurs deviennent périmés sans qu'on y touche. Une empreinte différente (versions de
 * la simulation ou du générateur, ou `FORMAT`) refait le segment.
 */

/** À incrémenter quand le contenu fictif change (la façon de tirer les joueurs, les pseudos…) : tous les segments sont refaits une fois. */
export const SEED_FORMAT = 1;

const PREFIXE = "recette_seed:";

/** L'empreinte du contenu d'un segment : les versions des deux jeux et le format, plus ce que le segment lit de particulier (`extra` : le niveau figé d'un jour de Jump…). */
export function empreinteDuSeed(extra = ""): string {
  const base = `f${SEED_FORMAT}.s${SIM_VERSION}.g${GENERATOR_VERSION}.js${JUMP_SIM_VERSION}.jg${JUMP_GENERATOR_VERSION}`;
  return extra ? `${base}.${createHash("sha1").update(extra).digest("hex").slice(0, 10)}` : base;
}

export type EtatSegment = "fait" | "absent" | "perime";

export interface Marqueurs {
  /** La génération de données de la base au moment de la lecture. */
  generation: number;
  etat(segment: string, empreinte: string): EtatSegment;
  /** Note qu'un segment est fait (une ligne écrite). */
  poser(segment: string, empreinte: string): Promise<void>;
}

/** Lit tous les marqueurs en **une requête** (intervalle sur la clé primaire de `meta`) et la génération (une ligne). */
export async function lireMarqueurs(db: SqlDb): Promise<Marqueurs> {
  const generation = await lireGeneration(db);
  const lignes = await db.all<{ key: string; value: string }>("SELECT key, value FROM meta WHERE key >= ? AND key < ?", [PREFIXE, "recette_seed;"]);
  const connus = new Map(lignes.map((l) => [l.key, l.value]));
  return {
    generation,
    etat(segment, empreinte) {
      const v = connus.get(PREFIXE + segment);
      if (v === undefined) return "absent";
      return v === `${generation}|${empreinte}` ? "fait" : "perime";
    },
    async poser(segment, empreinte) {
      const valeur = `${generation}|${empreinte}`;
      await db.run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [PREFIXE + segment, valeur]);
      connus.set(PREFIXE + segment, valeur);
    },
  };
}
