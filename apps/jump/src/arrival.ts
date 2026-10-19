import type { JumpMedal } from "@cdj/jump-sim";
import type { RankView } from "./rankView";

// L'écran d'arrivée du niveau du jour (lot 10, remplace le bandeau du lot 2 pour le niveau du jour ; les morceaux, les scénarios et les
// lectures gardent le bandeau) : le temps de l'essai, le meilleur du jour, la médaille (avec une courte animation, et sa phrase musicale du
// lot 8), les seuils des médailles et le temps de l'auteur, les morts du jour et les essais, la série ; **Rejouer**, **Partager**, **Revoir
// le carnage**, **Accueil** ; le compte à rebours jusqu'au prochain niveau. Il s'ouvre **après** le carnage. DOM seulement : les textes
// viennent de `homeLogic.ts`. Cibles d'au moins 44 px, en portrait comme en paysage.
// Lot P1 (plateforme) : le **classement du jour** (`.arank`) : ton rang (« 3ᵉ sur 128 »), le top 10 avec ta ligne mise en valeur, l'état de
// l'envoi (« Classement indisponible, ton temps sera envoyé », « Une nouvelle version du jeu est disponible » + Recharger), et le formulaire
// du premier pseudo (pseudos libres à toucher). Une archive montre son classement figé. Les textes viennent de `rankView.ts` (pur).

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
  /** Lot P1 : le pseudo choisi dans le formulaire du classement. */
  onName?(name: string): void;
  /** Lot P1 : « Recharger » (une nouvelle version du jeu). */
  onReload?(): void;
  /** Lot P2 : « Regarder le premier » (la lecture de son essai). */
  onFirst?(): void;
  /** Lot P3 : « Le carnage de tout le monde » (l'échantillon du serveur, ton essai en héros). */
  onEveryone?(): void;
}

export interface Arrival {
  readonly shown: boolean;
  show(view: ArrivalView): void;
  hide(): void;
  setCountdown(text: string): void;
  /** Résultat du partage : un message (« Copié dans le presse-papiers »), et le texte à sélectionner si rien n'a marché. */
  shareResult(message: string, fallbackText: string | null): void;
  readonly message: string;
  /** Lot P1 : le classement (rang, top 10, état, pseudo). */
  setRank(view: RankView): void;
  /** Lot P1 : ce qui est affiché du classement (tests). */
  readonly rank: { shown: boolean; status: string; rows: number };
  /** Lot P2 : le bouton « Regarder le premier » (son texte), ou `null` : caché (pas de premier, ou c'est toi). */
  setFirst(text: string | null): void;
  readonly first: string | null;
  /** Lot P3 : le bouton « Le carnage de tout le monde » (son texte, avec le compteur), ou `null` : caché (pas d'échantillon). */
  setEveryone(text: string | null): void;
  readonly everyone: string | null;
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
  // Lot P1 : le classement du jour.
  const rankBox = el("section", "arank");
  rankBox.hidden = true;
  rankBox.setAttribute("aria-label", "Classement");
  const rankTitle = el("div", "arktitle");
  const rankStatus = el("div", "arkstatus");
  rankStatus.id = "arrival-rank";
  rankStatus.setAttribute("role", "status");
  const reload = button("arrival-reload", "abtn", "Recharger");
  reload.hidden = true;
  const nameForm = el("form", "arkname");
  nameForm.hidden = true;
  const nameInput = el("input", "arkinput");
  nameInput.id = "arrival-name";
  nameInput.type = "text";
  nameInput.maxLength = 20;
  nameInput.autocomplete = "off";
  nameInput.placeholder = "Ton pseudo";
  nameInput.setAttribute("aria-label", "Ton pseudo");
  const nameOk = el("button", "abtn primary", "OK");
  nameOk.type = "submit";
  nameOk.id = "arrival-name-ok";
  const nameError = el("div", "arkerror");
  const suggestions = el("div", "arksugg");
  nameForm.append(nameInput, nameOk, nameError, suggestions);
  const rankList = el("ol", "arklist");
  rankBox.append(rankTitle, rankStatus, reload, nameForm, rankList);
  // Taper son pseudo ne commande pas le personnage (R recommence, Espace saute…) : les touches restent dans le champ.
  for (const type of ["keydown", "keyup"] as const) nameInput.addEventListener(type, (e) => e.stopPropagation());
  nameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    opts.onName?.(nameInput.value);
  });
  main.append(title, time, medalRow, best, thresholds, rankBox);
  const side = el("div", "aside");
  const stats = el("div", "astats");
  const run = el("div", "arun");
  const streak = el("div", "astreak");
  const buttons = el("div", "abtns");
  const replay = button("arrival-replay", "abtn primary", "Rejouer");
  const share = button("arrival-share", "abtn", "Partager");
  const carnage = button("arrival-carnage", "abtn", "Revoir le carnage");
  const home = button("arrival-home", "abtn", "Accueil");
  // Lot P2 : la lecture de l'essai du premier (quand il y en a un, et que ce n'est pas toi).
  const first = button("arrival-first", "abtn", "Regarder le premier");
  first.hidden = true;
  // Lot P3 : le carnage de tout le monde (après ton propre carnage : l'écran d'arrivée s'ouvre à sa fin).
  const everyone = button("arrival-everyone", "abtn", "Le carnage de tout le monde");
  everyone.hidden = true;
  buttons.append(replay, share, carnage, everyone, first, home);
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
  on(reload, () => opts.onReload?.());
  on(first, () => opts.onFirst?.());
  on(everyone, () => opts.onEveryone?.());

  let shown = false;
  let note = "";
  let rankShown = { shown: false, status: "", rows: 0 };
  let suggestionKey = "";
  let firstText: string | null = null;
  let everyoneText: string | null = null;
  return {
    get everyone() {
      return everyoneText;
    },
    setEveryone(text) {
      everyoneText = text;
      everyone.hidden = text === null;
      if (text !== null) everyone.textContent = text;
    },
    get rank() {
      return rankShown;
    },
    get first() {
      return firstText;
    },
    setFirst(text) {
      firstText = text;
      first.hidden = text === null;
      if (text !== null) first.textContent = text;
    },
    setRank(v) {
      rankShown = { shown: v.shown, status: v.status, rows: v.rows.length };
      rankBox.hidden = !v.shown;
      if (!v.shown) return;
      rankTitle.textContent = v.title;
      rankStatus.textContent = v.status;
      rankStatus.dataset.tone = v.tone;
      reload.hidden = !v.reload;
      const wasHidden = nameForm.hidden;
      nameForm.hidden = !v.askName;
      nameError.textContent = v.nameMessage;
      nameOk.disabled = false;
      // Les pseudos libres proposés : un bouton chacun (le toucher le choisit) ; reconstruits seulement s'ils changent.
      const key = v.suggestions.join("|");
      if (key !== suggestionKey) {
        suggestionKey = key;
        suggestions.replaceChildren(
          ...v.suggestions.map((name) => {
            const b = el("button", "abtn arksuggestion", name);
            b.type = "button";
            b.addEventListener("click", () => {
              nameInput.value = name;
              opts.onName?.(name);
            });
            return b;
          }),
        );
      }
      if (v.askName && wasHidden) nameInput.focus({ preventScroll: true });
      rankList.replaceChildren(
        ...v.rows.map((r, i) => {
          const li = el("li", r.mine ? "mine" : undefined);
          if (v.gap && i === v.rows.length - 1) li.classList.add("gap");
          li.append(el("span", "krank", r.rank), el("span", "kname", r.name), el("span", "kmedal", r.medal), el("span", "ktime", r.time));
          return li;
        }),
      );
    },
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
