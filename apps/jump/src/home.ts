import { HELP, type ArchiveRow } from "./homeLogic";

// L'accueil (lot 10), DOM seulement : « DailyJump #N », la date et le thème, l'état du joueur, la série, un grand bouton **Jouer** (qui est
// aussi le geste qui réveille le son), Archives, Comment jouer, Réglages (le menu ⏸ du lot 8), le compte à rebours. Une surimpression posée
// sur le jeu déjà chargé : ouverte, la partie est en pause (aucun pas de simulation). La fenêtre « Comment jouer » et la liste des archives
// sont ici aussi. Toute la logique (textes, liste, quand l'ouvrir) est dans `homeLogic.ts`, pure et testée. Cibles d'au moins 44 px.

export interface HomeView {
  title: string;
  subtitle: string;
  status: string;
  /** L'état est un résultat (meilleur temps) : mis en avant. */
  finished: boolean;
  streak: string;
  countdown: string;
}

export interface HomeOptions {
  onPlay(): void;
  onSettings(): void;
  /** Les lignes des archives, calculées à l'ouverture de la liste (l'historique a pu changer). */
  archiveRows(): readonly ArchiveRow[];
  /** Le lien d'une archive (`?seed=…`, outils d'affichage gardés). */
  archiveHref(date: string): string;
  /** La liste a été ouverte ou fermée, la fenêtre d'aide aussi (le jeu met à jour `__jump.home`). */
  onChange?(): void;
}

export interface Home {
  readonly isOpen: boolean;
  readonly helpOpen: boolean;
  readonly archivesOpen: boolean;
  /** Le niveau est prêt : Jouer et Réglages répondent (avant : « Préparation du niveau… »). */
  readonly ready: boolean;
  open(view: HomeView): void;
  close(): void;
  update(view: HomeView): void;
  setReady(ready: boolean): void;
  setCountdown(text: string): void;
  openHelp(): void;
  closeHelp(): void;
  openArchives(): void;
  closeArchives(): void;
  /** Lignes affichées dans la liste des archives (dernière ouverture). */
  readonly rows: readonly ArchiveRow[];
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

export function mountHome(opts: HomeOptions): Home {
  // ——— L'accueil ———
  const root = el("div");
  root.id = "home";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Accueil");
  root.hidden = true;
  const card = el("div", "hcard");
  const title = el("h1", "htitle");
  const subtitle = el("p", "hsub");
  const status = el("p", "hstatus");
  const streak = el("p", "hstreak");
  const play = button("home-play", "hplay", "Préparation du niveau…");
  play.disabled = true;
  const row = el("div", "hbtns");
  const archives = button("home-archives", "hbtn", "Archives");
  const help = button("home-help", "hbtn", "Comment jouer");
  const settings = button("home-settings", "hbtn", "Réglages");
  settings.disabled = true;
  row.append(archives, help, settings);
  const countdown = el("p", "hcount");
  countdown.setAttribute("aria-live", "off");
  card.append(title, subtitle, status, streak, play, row, countdown);
  root.append(card);

  // ——— Comment jouer ———
  const helpRoot = el("div");
  helpRoot.id = "help";
  helpRoot.setAttribute("role", "dialog");
  helpRoot.setAttribute("aria-modal", "true");
  helpRoot.setAttribute("aria-label", "Comment jouer");
  helpRoot.hidden = true;
  const helpCard = el("div", "sheet");
  const helpHead = el("div", "shead");
  helpHead.append(el("h2", undefined, "Comment jouer"));
  const helpClose = button("help-close", "sbtn primary", "J'ai compris");
  helpHead.append(helpClose);
  helpCard.append(helpHead);
  for (const section of HELP) {
    const s = el("section", "hsection");
    s.append(el("h3", undefined, section.title));
    const ul = el("ul");
    for (const line of section.lines) ul.append(el("li", undefined, line));
    s.append(ul);
    helpCard.append(s);
  }
  helpRoot.append(helpCard);

  // ——— Archives ———
  const arch = el("div");
  arch.id = "archives";
  arch.setAttribute("role", "dialog");
  arch.setAttribute("aria-modal", "true");
  arch.setAttribute("aria-label", "Archives");
  arch.hidden = true;
  const archCard = el("div", "sheet");
  const archHead = el("div", "shead");
  archHead.append(el("h2", undefined, "Archives"));
  const archClose = button("archives-close", "sbtn", "Fermer");
  archHead.append(archClose);
  const archLead = el("p", "slead", "Les niveaux des jours passés, sans classement. Ta série ne bouge pas.");
  const list = el("ul", "alist");
  const empty = el("p", "aempty", "Pas encore d'archives : elles commencent le lendemain du niveau n° 1.");
  archCard.append(archHead, archLead, list, empty);
  arch.append(archCard);

  document.body.append(root, helpRoot, arch);

  let open = false;
  let ready = false;
  let rows: readonly ArchiveRow[] = [];
  const changed = () => opts.onChange?.();

  const show = (v: HomeView) => {
    title.textContent = v.title;
    subtitle.textContent = v.subtitle;
    status.textContent = v.status;
    status.classList.toggle("done", v.finished);
    streak.textContent = v.streak;
    countdown.textContent = v.countdown;
  };

  play.addEventListener("click", () => {
    if (ready) opts.onPlay();
  });
  settings.addEventListener("click", () => {
    if (ready) opts.onSettings();
  });
  const self: Home = {
    get isOpen() {
      return open;
    },
    get helpOpen() {
      return !helpRoot.hidden;
    },
    get archivesOpen() {
      return !arch.hidden;
    },
    get ready() {
      return ready;
    },
    get rows() {
      return rows;
    },
    open(v) {
      show(v);
      open = true;
      root.hidden = false;
      document.body.classList.add("home-open");
      if (ready) play.focus({ preventScroll: true });
      changed();
    },
    close() {
      open = false;
      root.hidden = true;
      helpRoot.hidden = true;
      arch.hidden = true;
      document.body.classList.remove("home-open");
      (document.activeElement as HTMLElement | null)?.blur?.();
      changed();
    },
    update: show,
    setReady(on) {
      ready = on;
      play.disabled = !on;
      settings.disabled = !on;
      play.textContent = on ? "Jouer" : "Préparation du niveau…";
      if (on && open && helpRoot.hidden && arch.hidden) play.focus({ preventScroll: true });
    },
    setCountdown(text) {
      if (countdown.textContent !== text) countdown.textContent = text;
    },
    openHelp() {
      helpRoot.hidden = false;
      helpCard.scrollTop = 0;
      helpClose.focus({ preventScroll: true });
      changed();
    },
    closeHelp() {
      helpRoot.hidden = true;
      if (open && ready) play.focus({ preventScroll: true });
      changed();
    },
    openArchives() {
      rows = opts.archiveRows();
      list.replaceChildren(
        ...rows.map((r) => {
          const li = el("li");
          const a = el("a", "arow");
          a.href = opts.archiveHref(r.date);
          a.dataset.date = r.date;
          a.append(el("span", "anum", r.title), el("span", "adate", r.subtitle), el("span", `ares${r.medal ? " medal" : ""}`, r.result || "pas joué"));
          li.append(a);
          return li;
        }),
      );
      empty.hidden = rows.length > 0;
      arch.hidden = false;
      archCard.scrollTop = 0;
      archClose.focus({ preventScroll: true });
      changed();
    },
    closeArchives() {
      arch.hidden = true;
      if (open && ready) play.focus({ preventScroll: true });
      changed();
    },
  };
  archives.addEventListener("click", () => self.openArchives());
  help.addEventListener("click", () => self.openHelp());
  helpClose.addEventListener("click", () => self.closeHelp());
  archClose.addEventListener("click", () => self.closeArchives());
  // Échap ferme la fenêtre du dessus (l'aide, la liste) ; sur l'accueil seul, il ouvre le menu (main.ts, comme en jeu).
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code !== "Escape") return;
      if (!helpRoot.hidden) self.closeHelp();
      else if (!arch.hidden) self.closeArchives();
      else return;
      e.stopImmediatePropagation();
    },
    { capture: true },
  );
  return self;
}
