import { readFileSync } from "node:fs";
import { COMMANDE, type Contenu, encoderRediffusion, enregistrer, Partie, type Rapier, REGLAGES_DEFAUT, type Reglages } from "@cdj/tower-sim";
import type { GameDefinition, Platform } from "../src/games";
import { GAMES } from "../src/registry";
import type { SqlDb } from "../src/db";
import { TOWER_GAME, TOWER_SCHEMA, type TowerOptions } from "../src/tower";

// Lot T4 — l'aide des tests et des outils de Tower : monter le jeu sur un serveur dont le registre ne le contient pas encore, créer ses tables, et jouer de vraies parties scriptées
// (rapides à construire, pas des parties « intelligentes » : on veut des rediffusions valides et différentes, pas des tours hautes).

/**
 * Le registre avec Tower enveloppé de ses options (`games` de `createApi`) : depuis le lot TP Tower est au registre, et `createApi` lui passe `towerFrozen` / `towerExecuteur` ; cette aide remplace
 * seulement sa définition par une enveloppe qui impose les options d'un test (elles l'emportent).
 */
export function towerGame(options: TowerOptions = {}): GameDefinition<never> {
  return { ...TOWER_GAME, create: (platform: Platform) => TOWER_GAME.create(platform, options) } as unknown as GameDefinition<never>;
}

/** Le registre complet dont la définition de Tower est celle de `towerGame(options)`. */
export function gamesAvecTower(options: TowerOptions = {}): readonly GameDefinition<never>[] {
  return GAMES.map((g) => (g.code === "tower" ? towerGame(options) : g));
}

/** Les tables de Tower, créées sur la base (`IF NOT EXISTS`) : `ensureSchema` ne crée que celles du registre. */
export async function creerTablesTower(db: SqlDb): Promise<void> {
  for (const sql of TOWER_SCHEMA) await db.run(sql);
}

/** Un fichier du jour de `packages/tower-sim/test/fixtures/jours/` (JSON). */
export function fixtureJour(date: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(`../../../packages/tower-sim/test/fixtures/jours/${date}.json`, import.meta.url), "utf8")) as Record<string, unknown>;
}

/** Un placement : `rot` quarts de tour, puis `dx` demi-cases (négatif : à gauche). */
export interface Placement {
  rot: number;
  dx: number;
}

/**
 * Joue une partie scriptée sur `contenu` : pour chaque pièce, `choix[i]` (sinon le centre, sans tourner), puis « descendre ». S'arrête à la fin de la partie. Rend la partie (à `dispose`)
 * et son texte de rediffusion. Les parties perdent vite leurs vies : ce sont des rediffusions valides et distinctes, pas des tours hautes.
 */
export function jouerScripte(R: Rapier, contenu: Contenu, choix: readonly Placement[] = [], reglages: Reglages = { ...REGLAGES_DEFAUT }): { partie: Partie; code: string } {
  const p = new Partie(R, contenu, reglages);
  let id = -1;
  let k = 0;
  while (p.etape !== "fini") {
    const v = p.vue();
    if (v.active !== id) {
      id = v.active;
      k = 0;
    }
    let c = 0;
    if (p.etape === "jeu" && v.active >= 0) {
      const ch = choix[v.active] ?? { rot: 0, dx: 0 };
      if (k < ch.rot) c |= COMMANDE.TOURNER;
      else if (k >= 4 && k < 4 + 2 * Math.abs(ch.dx) && k % 2 === 0) c |= ch.dx < 0 ? COMMANDE.GAUCHE : COMMANDE.DROITE;
      if (k > 12 + 2 * Math.abs(ch.dx)) c |= COMMANDE.DESCENDRE;
      k++;
    }
    p.avancer(c);
  }
  return { partie: p, code: encoderRediffusion(enregistrer(p)) };
}
