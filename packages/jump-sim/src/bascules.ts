import { parseDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION } from "./constants";
import calendrierBrut from "./bascules.json" with { type: "json" };

// Lot 33 (incident du 06/11/2026) — **le calendrier des bascules du générateur** : quel générateur est en vigueur à chaque date. Un jour se génère toujours avec le générateur
// actif À SA DATE ; un nouveau générateur ne s'applique qu'à partir de DEMAIN au plus tôt (une bascule fixée à aujourd'hui ou avant est refusée par « Mettre en production »,
// `scripts/mise-en-production.mjs bascules`) ; et un jour passé ou le jour même, sans fichier figé, n'est JAMAIS généré avec un générateur plus récent que celui de sa date :
// `dailyLevel` s'arrête (`GenerateurDuJourError`) au lieu de servir en silence un autre niveau que celui que les joueurs ont vu.
//
// Le fichier `bascules.json` (lu aussi par les scripts de la mise en production) est une liste croissante `{ depuis: "AAAA-MM-JJ", generateur: N }` : l'entrée vaut de sa date
// (comprise) à la suivante (exclue). La première entrée couvre tout ce qui précède (les jours d'avant le 03/11/2026 sont tous des fichiers figés ; le générateur courant les rend
// encore pour les archives de développement et les tests). **Changer `JUMP_GENERATOR_VERSION` ajoute une entrée** (`depuis` : demain au plus tôt, voir « Jours servis immuables
// (lot 33) » dans `packages/jump-sim/CLAUDE.md`) ; la dernière entrée porte toujours `JUMP_GENERATOR_VERSION` (`problemesDuCalendrier`, testé).

/** Une bascule : à partir de `depuis` (AAAA-MM-JJ, comprise), le générateur `generateur` est en vigueur. */
export interface Bascule {
  depuis: string;
  generateur: number;
}

/** Le calendrier du code (`bascules.json`). */
export const BASCULES_GENERATEUR: readonly Bascule[] = calendrierBrut.bascules;

let calendrier: readonly Bascule[] = BASCULES_GENERATEUR;

/** Pour les tests seulement : remplace le calendrier (`null` : celui du code). */
export function calendrierPourLesTests(bascules: readonly Bascule[] | null): void {
  calendrier = bascules ?? BASCULES_GENERATEUR;
}

/** Le générateur en vigueur le jour `jour` (numéro de jour de `@cdj/core`) : celui de la dernière entrée qui a commencé ; avant la première entrée, celui de la première. */
export function generateurDuJour(jour: number, bascules: readonly Bascule[] = calendrier): number {
  let g = bascules[0]?.generateur ?? JUMP_GENERATOR_VERSION;
  for (const b of bascules) {
    const depuis = parseDay(b.depuis);
    if (depuis !== null && depuis <= jour) g = b.generateur;
  }
  return g;
}

/** Le code ne peut pas rendre le niveau de ce jour : le générateur en vigueur à sa date n'est pas celui du code. Le jour doit être servi par son fichier figé. */
export class GenerateurDuJourError extends Error {
  readonly code = "generateur";
  constructor(
    readonly jour: number,
    readonly attendu: number,
    readonly courant: number,
  ) {
    super(`Le générateur en vigueur ce jour-là est g${attendu}, ce code est g${courant} : ce niveau ne se génère pas, il doit venir de son fichier figé`);
    this.name = "GenerateurDuJourError";
  }
}

/** Refuse (lève `GenerateurDuJourError`) de générer `jour` avec un générateur autre que celui en vigueur à sa date. */
export function verifierGenerateurDuJour(jour: number, courant = JUMP_GENERATOR_VERSION): void {
  const attendu = generateurDuJour(jour);
  if (attendu !== courant) throw new GenerateurDuJourError(jour, attendu, courant);
}

/**
 * Ce qui ne va pas dans un calendrier (liste vide : rien) : dates lisibles et strictement croissantes, générateurs strictement croissants, dernière entrée = le générateur du code.
 * `courant` : `JUMP_GENERATOR_VERSION` (paramétré pour les tests).
 */
export function problemesDuCalendrier(bascules: readonly Bascule[], courant = JUMP_GENERATOR_VERSION): string[] {
  const p: string[] = [];
  if (bascules.length === 0) return ["le calendrier est vide"];
  let avantJour: number | null = null;
  let avantG = 0;
  for (const b of bascules) {
    const jour = parseDay(b.depuis);
    if (jour === null) p.push(`date illisible : « ${b.depuis} »`);
    else if (avantJour !== null && jour <= avantJour) p.push(`${b.depuis} ne vient pas après l'entrée précédente`);
    if (!Number.isInteger(b.generateur) || b.generateur <= avantG) p.push(`g${b.generateur} (${b.depuis}) ne dépasse pas le générateur précédent (g${avantG})`);
    if (jour !== null) avantJour = jour;
    avantG = b.generateur;
  }
  if (avantG !== courant) p.push(`la dernière entrée est g${avantG}, le code est g${courant} : ajouter l'entrée de g${courant} (demain au plus tôt)`);
  return p;
}
