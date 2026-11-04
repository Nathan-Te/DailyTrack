import { ErreurRediffusion, type Resultat, type Rapier, type Scenario, type VuePartie, rejouer } from "@cdj/tower-sim";
import { examinerJourPrepare } from "@cdj/tower-sim/bot";
import type { PieceSilhouette } from "./tower";
import { RefusJeu } from "./jeux/contrat";
import { type ExecuteurRejeu as ExecuteurGenerique, RefusDuFil } from "./jeux/fil";

// Lot T4 — le rejeu d'une partie de Tower sur le serveur : **un seul point d'entrée, `rejouerTower`**, derrière lequel le calcul tourne ou bien dans le fil principal (repli), ou bien dans
// **un fil de calcul** (`worker_threads`, `jeux/fil.ts` depuis le lot K2 : un seul par instance, avec une file bornée qui rend `503 busy` quand elle est pleine). Le script du fil est celui de Tower (`towerFilTravail.ts`).
//
// Pourquoi un fil : un rejeu de Tower coûte de 0,2 à 0,6 s de calcul pur (Rapier en WebAssembly, ≈ 80 à 150 µs par tick), contre ≈ 15 ms pour une course de Track. Dans le fil principal il bloque
// les lectures des autres joueurs pendant tout ce temps. Mais le fil a besoin d'un fichier JavaScript à part (`dist/tower-fil.mjs`) ; sans lui (développement, tests) **le repli est le fil principal, protégé
// par le plafond de rejeux de la plateforme** (`spendReplays(UNITES_REJEU_TOWER)`).

/**
 * **Le poids d'un rejeu de Tower dans le plafond global de la plateforme** (`REPLAYS_PER_MINUTE` = 600 unités par minute et par instance, `spendReplays`). Une unité vaut ≈ 15 ms de calcul (une
 * course de Track, lot R7) ; un rejeu de Tower mesuré (lot T4, Node 22, `apps/api/scripts/tower-mesure.ts`) coûte 0,1 à 0,65 s (médiane ≈ 0,25 s) selon le nombre de corps : on compte **30 unités
 * (≈ 0,45 s)**, soit au plus 20 rejeux par minute et par instance (≈ 9 s de calcul par minute, le même budget que les autres jeux). Poids fixe (le prompt du lot) : un rejeu court est surfacturé, jamais un long.
 * Depuis le lot K2 le module lit ce poids dans la fiche (`rejeu.unitesServeur`) ; un test garde les deux d'accord.
 */
export const UNITES_REJEU_TOWER = 30;

/** La file d'attente du fil de calcul : au-delà, `503 busy` (le rejeu qui attend dans la file n'est pas encore commencé). */
export const FILE_MAX_TOWER = 4;

/** Un rejeu demandé : le contenu du jour (données seules : il traverse un fil) et la rediffusion (texte `base64url`). */
export interface DemandeRejeu {
  contenu: Scenario;
  rediffusion: string;
}

/** La silhouette d'une vue finale : les pièces encore sur la tour. */
export function silhouetteDe(vue: Pick<VuePartie, "pieces">): PieceSilhouette[] {
  return vue.pieces.filter((p) => p.etat === "libre").map((p) => ({ kind: p.kind, rot: p.rot, taille: p.taille, x: p.x, y: p.y, angle: p.angle }));
}

/**
 * Lot D3 (C10) — **l'examen d'un jour préparé** (le fichier se relit, se régénère, et sa preuve rejouée donne le Diamant écrit : `examinerJourPrepare`) est un rejeu comme les autres : avec un fil de calcul il y passe,
 * pour que **le WebAssembly de Rapier ne soit chargé qu'une fois par processus** (dans le fil), jamais aussi dans le fil principal (deux moteurs côte à côte : mesuré, c'était la moitié de la mémoire de Tower).
 * La demande et la réponse sont des données (elles traversent le fil).
 */
export interface DemandeExamen {
  examen: { json: unknown; jour: number };
}
export type ExamenJour = Exclude<ReturnType<typeof examinerJourPrepare>, string>;
export type ReponseExamen = { refus: string } | { lu: ExamenJour["lu"]; silhouette: PieceSilhouette[] };

/** Ce que le fil de calcul reçoit : un rejeu, ou l'examen d'un jour préparé. */
export type DemandeTower = DemandeRejeu | DemandeExamen;

/** Ce que le fil de calcul rend : le résultat d'un rejeu, ou la réponse d'un examen. */
export type ReponseTower = Resultat | ReponseExamen;

/** Ce qui exécute un rejeu de Tower : le fil principal, ou le fil de calcul (`executeurFil` de `jeux/fil.ts`). */
export type ExecuteurRejeu = ExecuteurGenerique<DemandeTower, ReponseTower>;

/** L'examen en place, avec le Rapier donné (le fil de calcul, ou le repli dans le fil principal). */
export function examinerSurPlace(R: Rapier, json: unknown, jour: number): ReponseExamen {
  const ex = examinerJourPrepare(R, json, jour);
  return typeof ex === "string" ? { refus: ex } : { lu: ex.lu, silhouette: silhouetteDe(ex.rejeu.vue) };
}

/** Le repli : le rejeu dans le fil principal. Rapier est chargé une fois, à la demande (`@cdj/tower-sim/rapier`). */
export function executeurPrincipal(): ExecuteurRejeu {
  let pret: Promise<Rapier> | null = null;
  return {
    nom: "principal" as const,
    async rejouer(d) {
      pret ??= import("@cdj/tower-sim/rapier").then((m) => m.chargerRapier());
      const R = await pret;
      if ("examen" in d) return examinerSurPlace(R, d.examen.json, d.examen.jour);
      return rejouer(R, d.contenu, d.rediffusion);
    },
  };
}

/**
 * Les refus du rejeu (ceux que le décodage n'a pas déjà vus) en refus du jeu : `inachevee` → `not_finished` ; `contenu_different` et `version_inconnue` → `version` ;
 * le reste (`surplus`, `trop_longue`, `commandes_inconnues`, `reglages_invalides`, `format_illisible`) → `invalid_replay`. Le module en fait la réponse (statut de la liste des codes).
 */
export function refusDeRediffusion(code: string): RefusJeu {
  switch (code) {
    case "inachevee":
      return new RefusJeu("not_finished", "Cette partie n'arrive pas au bout");
    case "version_inconnue":
    case "contenu_different":
      return new RefusJeu("version", `Une nouvelle version du jeu est disponible : recharge la page (${code})`);
    default:
      return new RefusJeu("invalid_replay", `Rediffusion refusée (${code})`);
  }
}

/**
 * **Le point d'entrée du rejeu serveur** : exécute le rejeu (fil principal ou fil de calcul selon `executeur`) et traduit ses refus en refus du jeu. Le `Resultat` rendu est celui que le serveur
 * recalcule : jamais un résultat annoncé par le client.
 */
export async function rejouerTower(executeur: ExecuteurRejeu, d: DemandeRejeu): Promise<Resultat> {
  try {
    return (await executeur.rejouer(d)) as Resultat;
  } catch (e) {
    if (e instanceof ErreurRediffusion) throw refusDeRediffusion(e.code);
    if (e instanceof RefusDuFil) throw refusDeRediffusion(e.code);
    throw e;
  }
}

/**
 * Lot D3 : examine un jour préparé **par le fil de calcul** quand il y en a un (`executeur.nom === "fil"`), sinon rend `null` : l'appelant l'examine en place (repli, tests, exécuteurs de test qui comptent les rejeux
 * de joueurs). Un fil occupé ou en panne lève `503 busy` comme pour un rejeu.
 */
export async function examinerParLeFil(executeur: ExecuteurRejeu, json: unknown, jour: number): Promise<ReponseExamen | null> {
  if (executeur.nom !== "fil") return null;
  return (await executeur.rejouer({ examen: { json, jour } })) as ReponseExamen;
}
