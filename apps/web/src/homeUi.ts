// Écran d'accueil (lot 29) : ce qu'on voit en ouvrant le jeu. Le titre, le circuit du jour (numéro, date, thème, médailles, ton temps et ton rang),
// le classement du jour, deux grands choix (le circuit du jour, le Salon live), la carte du profil et les liens (archives, réglages, aide).
// Le DOM seulement : les données viennent de `HomeHost` (main.ts), la logique de homeLogic.ts, profile.ts et boardView.ts.
import type { Medal } from "@cdj/sim";
import type { ApiResult, Leaderboard } from "./api";
import { dayLines, linesEls } from "./boardView";
import { button, el } from "./dom";
import { formatTime } from "./format";
import { MEDAL_WORD, TAGLINE, mmss, remainingMs, type SalonLookup } from "./homeLogic";
import { dayLong, dayShort, rememberRank } from "./profile";
import { mountProfileCard, type ProfileCard, type ProfileHost } from "./profileUi";
import { MEDAL_ICON, ordinal } from "./share";

export interface HomeDaily {
  number: number;
  date: string;
  themeLabel: string;
  medals: Record<Medal, number>;
}

export interface HomeHost {
  daily: HomeDaily;
  /** Ton meilleur temps d'aujourd'hui (ms) et sa médaille, s'il existe. */
  best(): { ms: number; medal: Medal | null } | null;
  /** Classement du jour : `null` si ce jeu n'en a pas (aucun serveur configuré). */
  leaderboard: (() => Promise<ApiResult<Leaderboard>>) | null;
  /** Texte à montrer à la place du classement quand il n'y en a pas (« hors ligne », « pas de serveur »). */
  noBoardReason: string;
  /** Interroge le Salon (état, thème, temps restant, joueurs). */
  salon(): Promise<SalonLookup>;
  profile: ProfileHost;
  touch: boolean;
  playDaily(): void;
  playSalon(): void;
  watchBest(): void;
  openArchive(): void;
  openSettings(): void;
  openHowto(): void;
}

export interface HomeUi {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

const MEDALS: readonly Medal[] = ["author", "gold", "silver", "bronze"];

export function mountHome(root: HTMLElement, host: HomeHost): HomeUi {
  let open = false;
  let timer = 0;
  let salonStatus: Extract<SalonLookup, { ok: true }>["status"] | null = null;
  let generation = 0; // une réponse tardive d'une ouverture précédente ne doit rien écrire

  root.setAttribute("role", "main");
  root.setAttribute("aria-label", "Accueil");

  // --- Entête ---
  const head = el("header", "home-head");
  head.append(el("h1", "", "Circuit du Jour"), el("p", "tagline", TAGLINE));

  // --- Circuit du jour ---
  const today = el("section", "card today");
  today.setAttribute("aria-label", "Circuit du jour");
  const todayHead = el("div", "card-head");
  const medalList = el("ul", "medals");
  const mine = el("div", "mine");
  const playDaily = button("", "big primary play-daily");
  playDaily.id = "home-daily";
  playDaily.append(el("span", "big-label", "Circuit du jour"), el("small", "", "Jouer maintenant"));
  playDaily.addEventListener("click", () => host.playDaily());
  const touchNote = el("p", "note", "📱 Pour conduire, mets ton téléphone en paysage.");
  touchNote.hidden = !host.touch;
  today.append(todayHead, medalList, mine, playDaily, touchNote);

  // --- Salon ---
  const salonCard = el("section", "card salon");
  salonCard.setAttribute("aria-label", "Salon live");
  const salonText = el("div", "salon-state");
  salonText.setAttribute("aria-live", "polite");
  const playSalon = button("", "big play-salon");
  playSalon.id = "home-salon";
  playSalon.append(el("span", "big-label", "Salon live"), el("small", "", "Rejoindre les autres joueurs"));
  playSalon.addEventListener("click", () => host.playSalon());
  salonCard.append(el("h2", "", "Salon live"), el("p", "lead", "Un nouveau circuit toutes les 10 minutes, avec les fantômes des autres joueurs et un classement de session."), salonText, playSalon);

  // --- Classement ---
  const boardCard = el("section", "card board-card");
  boardCard.setAttribute("aria-label", "Classement du jour");
  const boardTitle = el("h2", "", "Classement du jour");
  const boardBody = el("div", "board-body");
  const watch = button("▶ Revoir le meilleur tour", "link watch-best");
  watch.hidden = true;
  watch.addEventListener("click", () => host.watchBest());
  boardCard.append(boardTitle, boardBody, watch);

  // --- Profil ---
  const profileCard: ProfileCard = mountProfileCard({ ...host.profile, onChange: () => { host.profile.onChange?.(); renderToday(); } });
  const profileBox = el("div", "card profile-card");
  profileBox.append(profileCard.root);

  // --- Liens ---
  const links = el("nav", "links");
  links.setAttribute("aria-label", "Autres pages");
  const archive = button("📅 Archives", "link", () => host.openArchive());
  archive.id = "home-archive";
  const settings = button("⚙ Réglages", "link", () => host.openSettings());
  settings.id = "home-settings";
  const howto = button("❓ Comment jouer", "link", () => host.openHowto());
  howto.id = "home-howto";
  links.append(archive, settings, howto);

  const col1 = el("div", "col");
  col1.append(today, salonCard);
  const col2 = el("div", "col");
  col2.append(boardCard, profileBox);
  const grid = el("div", "home-grid");
  grid.append(col1, col2);
  const wrap = el("div", "home-wrap");
  wrap.append(head, grid, links);
  root.replaceChildren(wrap);

  // --- Rendu ---
  function renderToday() {
    const d = host.daily;
    const title = el("h2", "", d.number >= 1 ? `Circuit du Jour n° ${d.number}` : "Circuit du Jour");
    todayHead.replaceChildren(title, el("div", "when", `${dayLong(d.date)} · thème ${d.themeLabel}`));
    const best = host.best();
    medalList.replaceChildren(
      ...MEDALS.map((m) => {
        const won = best !== null && best.ms <= d.medals[m];
        const li = el("li", won ? "won" : "");
        li.append(el("span", "icon", MEDAL_ICON[m]), el("span", "name", MEDAL_WORD[m]), el("span", "time", formatTime(d.medals[m])), el("span", "mark", won ? "✓" : ""));
        if (won) li.setAttribute("aria-label", `${MEDAL_WORD[m]} ${formatTime(d.medals[m])} : obtenue`);
        return li;
      }),
    );
    mine.replaceChildren(...(best ? [el("span", "label", "Ton meilleur temps"), el("strong", "", formatTime(best.ms)), ...(best.medal ? [el("span", "", `${MEDAL_ICON[best.medal]} ${MEDAL_WORD[best.medal]}`)] : []), el("span", "rank", "")] : [el("span", "label", "Tu n'as pas encore couru aujourd'hui.")]));
    playDaily.querySelector("small")!.textContent = best ? "Rejouer pour faire mieux" : "Jouer maintenant";
    watch.hidden = true;
  }

  function showRank(rank: number, participants: number) {
    const slot = mine.querySelector(".rank");
    if (slot) slot.textContent = `${ordinal(rank)} sur ${participants}`;
    rememberRank(host.daily.date, { rank, participants });
    profileCard.refresh();
  }

  async function loadBoard(gen: number) {
    if (!host.leaderboard) {
      boardBody.replaceChildren(el("p", "empty", host.noBoardReason));
      return;
    }
    boardBody.replaceChildren(el("p", "empty", "Chargement du classement…"));
    const r = await host.leaderboard();
    if (gen !== generation) return;
    if (!r.ok) {
      const retry = button("Réessayer", "link", () => void loadBoard(generation));
      boardBody.replaceChildren(el("p", "empty error", `${r.message}. Tu peux jouer quand même : la course ne sera classée que si le serveur répond.`), retry);
      return;
    }
    const lb = r.data;
    // En démonstration, « aujourd'hui » est vide : on montre la veille, et on le dit.
    const label = lb.date === host.daily.date ? "Classement du jour" : `Classement du ${dayShort(lb.date)} (figé)`;
    boardTitle.textContent = lb.participants > 0 ? `${label} · ${lb.participants} pilote${lb.participants > 1 ? "s" : ""}` : label;
    if (lb.participants === 0) {
      boardBody.replaceChildren(el("p", "empty", "Personne n'a encore de temps aujourd'hui : sois le premier !"));
      watch.hidden = true;
      return;
    }
    const list = el("div", "rows");
    list.append(...linesEls(dayLines(lb)));
    boardBody.replaceChildren(list);
    watch.hidden = lb.date !== host.daily.date; // le meilleur tour à revoir est celui d'aujourd'hui
    if (lb.me && lb.date === host.daily.date) showRank(lb.me.rank, lb.participants);
  }

  function renderSalon() {
    const s = salonStatus;
    if (!s) return;
    const left = remainingMs(s, Date.now());
    const line = el("p", "status");
    line.append(el("strong", "", `En cours : ${s.themeLabel}`), ` · prochain circuit dans `, el("strong", "time", mmss(left)), ` · ${s.players} joueur${s.players > 1 ? "s" : ""} présent${s.players > 1 ? "s" : ""}`);
    salonText.replaceChildren(line);
  }

  async function loadSalon(gen: number) {
    salonText.replaceChildren(el("p", "status", "Recherche du Salon…"));
    playSalon.disabled = false;
    const r = await host.salon();
    if (gen !== generation) return;
    if (!r.ok) {
      salonStatus = null;
      const retry = button("Réessayer", "link", () => void loadSalon(generation));
      salonText.replaceChildren(el("p", "status error", r.message), retry);
      playSalon.disabled = r.message.startsWith("Le Salon a besoin"); // pas de serveur : inutile d'essayer
      return;
    }
    salonStatus = r.status;
    renderSalon();
  }

  return {
    open() {
      open = true;
      generation++;
      root.hidden = false;
      document.body.classList.add("home");
      root.scrollTop = 0;
      renderToday();
      profileCard.refresh();
      const gen = generation;
      void loadBoard(gen);
      void loadSalon(gen);
      clearInterval(timer);
      timer = window.setInterval(() => {
        if (!salonStatus) return;
        // La session finie, on redemande (circuit suivant) ; sinon on ne fait que redessiner le temps restant.
        if (remainingMs(salonStatus, Date.now()) <= 0) void loadSalon(generation);
        else renderSalon();
      }, 1000);
      playDaily.focus({ preventScroll: true });
    },
    close() {
      open = false;
      generation++;
      clearInterval(timer);
      root.hidden = true;
      document.body.classList.remove("home");
    },
    isOpen: () => open,
  };
}
