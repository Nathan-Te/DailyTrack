import { ATTEMPT_FINISHED } from "@cdj/jump-sim";
import { formatTicks, type JumpSession } from "./session";

// HUD du lot 2 (DOM, affichage seulement) : chrono de l'essai, meilleur temps et morts de la session ; bandeau d'arrivée avec
// « Recommencer » (R, ou toucher le bouton). Rien n'y modifie la simulation : on lit la session.
// Placement : en haut au centre sur ordinateur ; sur téléphone, sous la bande haute, empilé avec la surimpression de debug (`#hud`),
// jamais sur les boutons. Le bandeau est l'écran d'arrivée minimal (l'écran complet viendra au lot 6).

export interface FinishOptions {
  /** « Arrivée ! » par défaut (« Rediffusion » en lecture). */
  title?: string;
  /** Lot 4 : le temps de référence (« Solution : 2,600 s »), affiché sous le temps. */
  reference?: string | null;
  /** Lot 4 : lien « Morceau suivant ». */
  next?: string | null;
}

export interface Hud {
  /** `time` : le chrono affiché (par défaut celui de l'essai ; pendant le carnage, celui du héros). */
  update(session: JumpSession, time?: number): void;
  /** Bandeau d'arrivée. `title` : « Arrivée ! » par défaut (« Rediffusion » en lecture). Le meilleur temps affiché est celui du jour, recalculé par le rejeu. */
  finish(session: JumpSession, opts?: FinishOptions): void;
  /** Compteur du carnage (« 47 vies · 1 arrivée ») ; null le cache. */
  carnage(label: string | null): void;
  readonly carnageShown: boolean;
  hideFinish(): void;
  /** Message bref au milieu de l'écran (point de passage atteint). */
  toast(text: string): void;
  readonly finishShown: boolean;
}

export function mountHud(opts: { onRestart(): void }): Hud {
  const chrono = document.getElementById("chrono")!;
  const time = chrono.querySelector<HTMLElement>(".time")!;
  const best = chrono.querySelector<HTMLElement>(".best")!;
  const deaths = chrono.querySelector<HTMLElement>(".deaths")!;
  const banner = document.getElementById("finish")!;
  const bTime = banner.querySelector<HTMLElement>(".time")!;
  const bBest = banner.querySelector<HTMLElement>(".best")!;
  const bDeaths = banner.querySelector<HTMLElement>(".deaths")!;
  const button = banner.querySelector<HTMLButtonElement>("button")!;
  const bTitle = banner.querySelector<HTMLElement>(".title")!;
  const bRef = banner.querySelector<HTMLElement>(".ref")!;
  const next = banner.querySelector<HTMLAnchorElement>("#finish-next")!;
  const carnageEl = document.getElementById("carnage")!;
  const carnageCount = carnageEl.querySelector<HTMLElement>(".count")!;
  let carnageText: string | null = null;
  button.addEventListener("click", () => {
    button.blur();
    opts.onRestart();
  });
  // Toucher le bandeau (pas seulement le bouton) recommence aussi ; il est au-dessus de la couche tactile.
  banner.addEventListener("pointerup", (e) => {
    if (e.target !== button && e.target !== next) opts.onRestart();
  });

  const toastEl = document.getElementById("toast")!;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let last = "";
  let shown = false;
  return {
    update(session, at = session.state.time) {
      const t = formatTicks(at);
      const b = session.best === null ? "—" : formatTicks(session.best);
      const key = `${t}|${b}|${session.deaths}|${session.state.status}`;
      if (key === last) return;
      last = key;
      time.textContent = t;
      best.textContent = `Meilleur ${b}`;
      deaths.textContent = `Morts ${session.deaths}`;
      chrono.classList.toggle("done", session.state.status === ATTEMPT_FINISHED);
    },
    finish(session, opts = {}) {
      bTitle.textContent = opts.title ?? "Arrivée !";
      bRef.textContent = opts.reference ?? "";
      next.hidden = !opts.next;
      if (opts.next) next.href = opts.next;
      bTime.textContent = formatTicks(session.state.time);
      bBest.textContent = session.best === null ? "Meilleur : — (réglages modifiés)" : `Meilleur du jour : ${formatTicks(session.best)}`;
      // Avec les points de passage, un temps peut contenir des morts (le chrono a continué) : on le dit.
      const run = session.attemptDeaths === 0 ? "essai sans faute" : `${session.attemptDeaths} dans cet essai`;
      bDeaths.textContent = `Morts : ${session.deaths} · ${run}`;
      banner.hidden = false;
      shown = true;
    },
    toast(text) {
      toastEl.textContent = text;
      toastEl.classList.remove("show");
      void toastEl.offsetWidth; // relance l'animation
      toastEl.classList.add("show");
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1200);
    },
    hideFinish() {
      banner.hidden = true;
      shown = false;
    },
    get finishShown() {
      return shown;
    },
    carnage(label) {
      if (label === carnageText) return;
      carnageText = label;
      carnageEl.hidden = label === null;
      if (label !== null) carnageCount.textContent = label;
    },
    get carnageShown() {
      return carnageText !== null;
    },
  };
}
