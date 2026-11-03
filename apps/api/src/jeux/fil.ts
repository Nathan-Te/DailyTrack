import { Worker } from "node:worker_threads";
import { HttpError } from "../errors";

// Lot K2 — **le fil de calcul des rejeux** (fiche : `rejeu.fil`), écrit une fois pour les jeux dont le rejeu est trop long pour le fil principal (Tower : 0,2 à 0,6 s de Rapier). Repris tel quel de `towerFil.ts`
// (lot T4), rendu indépendant du jeu : la demande et le résultat sont des données (ils traversent un fil), le script du fil est celui du jeu (`towerFilTravail.ts` → `dist/tower-fil.mjs`).
//
// **Un seul fil par instance** (le calcul d'un rejeu ne se parallélise pas, deux fils se disputeraient le processeur d'un vCPU), les rejeux passent l'un après l'autre ; la file est bornée (`FILE_MAX_DEFAUT`
// en attente) et un rejeu de plus rend `503 busy`. Si le fil tombe, ceux qui attendent reçoivent `503 busy` et le fil suivant repart de zéro. Rien n'est écrit sur le disque, rien n'est journalisé ici.
// Protocole du fil : il reçoit `{ id, ...demande }` et répond `{ id, resultat }`, ou `{ id, refus: <code> }` (le rejeu a refusé la rediffusion), ou `{ id, panne: true }`.

/** La file d'attente du fil : au-delà, `503 busy` (le rejeu qui attend dans la file n'est pas encore commencé). */
export const FILE_MAX_DEFAUT = 4;
/** Le délai au-delà duquel un rejeu est abandonné et son fil arrêté (un rejeu de Tower mesuré dure au plus 0,65 s : une large marge à un processeur partagé). */
export const DELAI_REJEU_MS = 15_000;

/** Ce qui exécute un rejeu : le fil principal, ou le fil de calcul. */
export interface ExecuteurRejeu<Demande, Resultat> {
  /** Où le rejeu se calcule (`fil` : le fil de calcul ; `principal` : le repli) — écrit au journal avec chaque partie, pour vérifier l'image construite. */
  nom?: "fil" | "principal";
  rejouer(d: Demande): Promise<Resultat>;
  /** Arrête le fil de calcul, s'il y en a un (tests, arrêt propre). */
  fermer?(): Promise<void>;
}

/** Le fil a répondu que la rediffusion est refusée : `code` est celui du jeu (le contrat du jeu en fait son refus). */
export class RefusDuFil extends Error {
  constructor(readonly code: string) {
    super(`rediffusion refusée par le rejeu (${code})`);
  }
}

interface Travail<D, R> {
  id: number;
  d: D;
  fini(r: R): void;
  echec(e: unknown): void;
}

const occupe = () => new HttpError(503, "busy", "Le serveur est très demandé : réessaie dans une minute", { "Retry-After": "5" });

/** @param fichier le script empaqueté du fil du jeu (`dist/<jeu>-fil.mjs`). */
export function executeurFil<D extends object, R>(fichier: string | URL, options: { fileMax?: number; delaiMs?: number } = {}): ExecuteurRejeu<D, R> {
  const fileMax = options.fileMax ?? FILE_MAX_DEFAUT;
  const delai = options.delaiMs ?? DELAI_REJEU_MS;
  let fil: Worker | null = null;
  let enCours: Travail<D, R> | null = null;
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  const file: Travail<D, R>[] = [];
  let numero = 0;

  function abandonner(e: unknown): void {
    if (minuteur) clearTimeout(minuteur);
    minuteur = null;
    const t = enCours;
    enCours = null;
    t?.echec(e);
    const f = fil;
    fil = null;
    void f?.terminate();
    suivant();
  }

  function demarrer(): Worker {
    const w = new Worker(fichier);
    w.on("message", (m: { id: number; resultat?: R; refus?: string; panne?: boolean }) => {
      if (!enCours || m.id !== enCours.id) return;
      const t = enCours;
      enCours = null;
      if (minuteur) clearTimeout(minuteur);
      minuteur = null;
      if (m.resultat) t.fini(m.resultat);
      else if (m.refus) t.echec(new RefusDuFil(m.refus));
      else t.echec(occupe());
      suivant();
    });
    w.on("error", () => abandonner(occupe()));
    w.on("exit", () => {
      if (fil === w) {
        fil = null;
        if (enCours) abandonner(occupe());
      }
    });
    return w;
  }

  function suivant(): void {
    if (enCours) return;
    const t = file.shift();
    if (!t) return;
    enCours = t;
    fil ??= demarrer();
    minuteur = setTimeout(() => abandonner(occupe()), delai);
    fil.postMessage({ id: t.id, ...t.d });
  }

  return {
    nom: "fil" as const,
    rejouer(d) {
      // `enCours` ne compte pas dans la file : celle-ci ne garde que les rejeux qui attendent.
      if (file.length >= fileMax) return Promise.reject(occupe());
      return new Promise<R>((fini, echec) => {
        file.push({ id: ++numero, d, fini, echec });
        suivant();
      });
    },
    async fermer() {
      for (const t of file.splice(0)) t.echec(occupe());
      enCours?.echec(occupe());
      enCours = null;
      const f = fil;
      fil = null;
      if (minuteur) clearTimeout(minuteur);
      await f?.terminate();
    },
  };
}
