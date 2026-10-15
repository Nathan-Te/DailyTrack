import type { JumpMedal } from "@cdj/jump-sim";

// L'écran d'arrivée du niveau du jour (lot 10, remplace le bandeau du lot 2 pour le niveau du jour ; les morceaux, les scénarios et les
// lectures gardent le bandeau) : le temps de l'essai, le meilleur du jour, la médaille (avec une courte animation, et sa phrase musicale du
// lot 8), les seuils des médailles et le temps de l'auteur, les morts du jour et les essais, la série ; **Rejouer**, **Partager**, **Revoir
// le carnage**, **Accueil** ; le compte à rebours jusqu'au prochain niveau. Il s'ouvre **après** le carnage. DOM seulement : les textes
// viennent de `homeLogic.ts`. Cibles d'au moins 44 px, en portrait comme en paysage.

export interface ArrivalView {
  title: string;
  time: string;
  medal: JumpMedal | null;
  medalIcon: string;
  medalText: string;
  /** « Nouveau meilleur temps ! » ou « Meilleur du jour : … ». */
  best: string;
  newBest: boolean;
  thresholds: readonly { medal: JumpMedal; icon: string; label: string; time: string; reached: boolean }[];
  /** « 12 morts aujourd'hui · 5 essais », et les morts de cet essai. */
  stats: string;
  run: string;
  streak: string;
  countdown: string;
  canCarnage: boolean;
  canShare: boolean;
}

export interface ArrivalOptions {
  onReplay(): void;
  onShare(): void;
  onCarnage(): void;
  onHome(): void;
}

export interface Arrival {
  readonly shown: boolean;
  show(view: ArrivalView): void;
  hide(): void;
  setCountdown(text: string): void;
  /** Résultat du partage : un message (« Copié dans le presse-papiers »), et le texte à sélectionner si rien n'a marché. */
  shareResult(message: string, fallbackText: string | null): void;
  readonly message: string;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const button = (id: string, cls: string, text: string): HTMLButtonElement => {
  const b = el("button", cls, text);
  b.type = "button";
  b.id = id;
  return b;
};

export function mountArrival(opts: ArrivalOptions): Arrival {
  const root = el("div");
  root.id = "arrival";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Arrivée");
  root.hidden = true;
  const card = el("div", "acard");
  const main = el("div", "amain");
  const title = el("div", "atitle");
  const time = el("div", "atime");
  const medalRow = el("div", "amedalrow");
  const medal = el("span", "amedal");
  const medalText = el("span", "amedaltext");
  medalRow.append(medal, medalText);
  const best = el("div", "abest");
  const thresholds = el("ul", "athresholds");
  main.append(title, time, medalRow, best, thresholds);
  const side = el("div", "aside");
  const stats = el("div", "astats");
  const run = el("div", "arun");
  const streak = el("div", "astreak");
  const buttons = el("div", "abtns");
  const replay = button("arrival-replay", "abtn primary", "Rejouer");
  const share = button("arrival-share", "abtn", "Partager");
  const carnage = button("arrival-carnage", "abtn", "Revoir le carnage");
  const home = button("arrival-home", "abtn", "Accueil");
  buttons.append(replay, share, carnage, home);
  const message = el("div", "amessage");
  message.setAttribute("role", "status");
  const fallback = el("textarea", "afallback");
  fallback.readOnly = true;
  fallback.rows = 3;
  fallback.hidden = true;
  const countdown = el("div", "acount");
  const hint = el("div", "ahint", "R : rejouer");
  side.append(stats, run, streak, buttons, message, fallback, countdown, hint);
  card.append(main, side);
  root.append(card);
  document.body.append(root);

  // Le doigt qui passe le carnage peut se lever sur l'écran qui vient de s'ouvrir : son « clic » ne doit pas toucher un bouton. Un bouton ne
  // répond qu'à un appui commencé sur l'écran d'arrivée (ou au clavier, `detail` 0).
  let armed = false;
  for (const type of ["pointerdown", "touchstart", "mousedown"] as const) root.addEventListener(type, () => (armed = true), { capture: true, passive: true });
  const on = (b: HTMLButtonElement, f: () => void, blur = true) =>
    b.addEventListener("click", (e) => {
      if (!armed && e.detail !== 0) return;
      if (blur) b.blur();
      f();
    });
  on(replay, () => opts.onReplay());
  on(share, () => opts.onShare(), false);
  on(carnage, () => opts.onCarnage());
  on(home, () => opts.onHome());

  let shown = false;
  let note = "";
  return {
    get shown() {
      return shown;
    },
    get message() {
      return note;
    },
    show(v) {
      title.textContent = v.title;
      time.textContent = v.time;
      medal.textContent = v.medalIcon;
      medal.hidden = v.medal === null;
      medalText.textContent = v.medalText;
      best.textContent = v.best;
      best.classList.toggle("record", v.newBest);
      thresholds.replaceChildren(
        ...v.thresholds.map((t) => {
          const li = el("li", t.reached ? "reached" : undefined);
          li.dataset.medal = t.medal;
          li.append(el("span", "ticon", t.icon), el("span", "tlabel", t.label), el("span", "ttime", t.time));
          return li;
        }),
      );
      stats.textContent = v.stats;
      run.textContent = v.run;
      streak.textContent = v.streak;
      countdown.textContent = v.countdown;
      carnage.hidden = !v.canCarnage;
      share.hidden = !v.canShare;
      note = "";
      message.textContent = "";
      fallback.hidden = true;
      root.hidden = false;
      armed = false;
      // Relance l'animation de la médaille à chaque ouverture.
      medalRow.classList.remove("pop");
      void medalRow.offsetWidth;
      medalRow.classList.add("pop");
      card.scrollTop = 0;
      shown = true;
    },
    hide() {
      root.hidden = true;
      shown = false;
    },
    setCountdown(text) {
      if (countdown.textContent !== text) countdown.textContent = text;
    },
    shareResult(text, fallbackText) {
      note = text;
      message.textContent = text;
      fallback.hidden = fallbackText === null;
      if (fallbackText !== null) {
        fallback.value = fallbackText;
        fallback.focus({ preventScroll: true });
        fallback.select();
      }
    },
  };
}
