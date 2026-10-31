import { Worker } from "node:worker_threads";
import { ErreurRediffusion, type CodeRefusTower, type Resultat } from "@cdj/tower-sim";
import { HttpError } from "./errors";
import { type DemandeRejeu, type ExecuteurRejeu, FILE_MAX_TOWER } from "./towerRejeu";

// Lot T4 — l'exécuteur à fil de calcul : **un seul fil par instance** (le calcul d'un rejeu ne se parallélise pas, et deux fils se disputeraient le processeur d'un vCPU), les rejeux passent
// l'un après l'autre ; la file est bornée (`FILE_MAX_TOWER` en attente) et un rejeu de plus rend `503 busy`. Si le fil tombe, ceux qui attendent reçoivent `503 busy` et le fil suivant repart
// de zéro. Rien n'est écrit sur le disque, rien n'est journalisé ici (le serveur journalise le refus).

/** Le délai au-delà duquel un rejeu est abandonné et son fil arrêté (un rejeu mesuré dure au plus 0,65 s : on laisse une large marge à un processeur partagé). */
export const DELAI_REJEU_MS = 15_000;

interface Travail {
  id: number;
  d: DemandeRejeu;
  fini(r: Resultat): void;
  echec(e: unknown): void;
}

const occupe = () => new HttpError(503, "busy", "Le serveur est très demandé : réessaie dans une minute", { "Retry-After": "5" });

/** @param fichier le script empaqueté du fil (`dist/tower-fil.mjs`, issu de `towerFilTravail.ts`). */
export function executeurFil(fichier: string | URL, options: { fileMax?: number; delaiMs?: number } = {}): ExecuteurRejeu {
  const fileMax = options.fileMax ?? FILE_MAX_TOWER;
  const delai = options.delaiMs ?? DELAI_REJEU_MS;
  let fil: Worker | null = null;
  let enCours: Travail | null = null;
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  const file: Travail[] = [];
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
    w.on("message", (m: { id: number; resultat?: Resultat; refus?: CodeRefusTower; panne?: boolean }) => {
      if (!enCours || m.id !== enCours.id) return;
      const t = enCours;
      enCours = null;
      if (minuteur) clearTimeout(minuteur);
      minuteur = null;
      if (m.resultat) t.fini(m.resultat);
      else if (m.refus) t.echec(new ErreurRediffusion(m.refus));
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
    fil.postMessage({ id: t.id, contenu: t.d.contenu, rediffusion: t.d.rediffusion });
  }

  return {
    rejouer(d) {
      // `enCours` ne compte pas dans la file : celle-ci ne garde que les rejeux qui attendent.
      if (file.length >= fileMax) return Promise.reject(occupe());
      return new Promise<Resultat>((fini, echec) => {
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
