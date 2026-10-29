// Écran d'accueil (lot 29, refait au lot I4 selon la maquette track.html) : ce qu'on voit en ouvrant le jeu — le cadre posé sur la scène du départ (barre « ‹ DU JOUR »,
// date, numéro du circuit) et, dedans, l'étiquette Track agrandie : « TRACK », le circuit et son thème, le tracé, ton meilleur temps et ton rang, les
// quatre médailles en cases, le fantôme à battre, « Courir » ; puis le classement du jour (cinq lignes et la tienne), le Salon et les liens (archives,
// réglages, aide, profil). Le DOM seulement : les données viennent de `HomeHost` (main.ts), la logique de homeLogic.ts, profile.ts et boardView.ts.
import type { Medal } from "@cdj/sim";
import { astuceIphone, bouton, formatDecompte, iconeFantome, medaille } from "@cdj/ui";
import { avisDeNouveauDepart } from "./nouveauDepart";
import type { ApiResult, Leaderboard } from "./api";
import { boardTitle, dayLines, linesEls, MEDAL_TYPE } from "./boardView";
import { creerCadre } from "./cadre";
import { button, el } from "./dom";
import { fEcart, fNombre, fRang, fTemps, messageErreur, nomTheme, onLangue, t, traducteurDuSocle } from "./i18n";
import { remainingMs, type SalonLookup, type SalonProblem } from "./homeLogic";
import { rememberRank } from "./profile";
import { iconeTrack } from "./icones";
import { gameStorage } from "./storage";

export interface HomeDaily {
  number: number;
  date: string;
  /** Le thème du jour : son code (`rallye`, `col`…), traduit à l'affichage. */
  theme: string;
  medals: Record<Medal, number>;
}

export interface HomeHost {
  daily: HomeDaily;
  /** Ton meilleur temps d'aujourd'hui (ms) et sa médaille, s'il existe. */
  best(): { ms: number; medal: Medal | null } | null;
  /** Classement du jour (`limit` lignes) : `null` si ce jeu n'en a pas (aucun serveur configuré). */
  leaderboard: ((limit: number) => Promise<ApiResult<Leaderboard>>) | null;
  /** Pourquoi il n'y a pas de classement (le message vient du catalogue). */
  noBoardReason: "sans_serveur" | "hors_ligne";
  /** Temps jusqu'au prochain circuit du jour (minuit, heure de Paris), ou `null` s'il n'a pas de sens (démonstration, date simulée). */
  msUntilNextDay(): number | null;
  /** Minuit de Paris est passé : le jeu se recharge sur le nouveau circuit. */
  onNewDay(): void;
  /** Interroge le Salon (état, thème, temps restant, joueurs). */
  salon(): Promise<SalonLookup>;
  /** Le tracé du circuit du jour (la miniature du lot 13, une image) ; `null` si le jeu n'en fabrique pas ou n'y arrive pas. */
  preview(): Promise<string | null>;
  /** Adresse du profil commun du portail, avec le retour vers ce jeu (`profilHref()`, profilLien.ts). */
  profileHref(): string;
  touch: boolean;
  playDaily(): void;
  playSalon(): void;
  watchBest(): void;
  openArchive(): void;
  openSettings(): void;
  openHowto(): void;
  /** Ouvre le classement du jour en pleine page (`boardScreen.ts`). */
  openBoard(): void;
  /** Lot 41 : ouvre le Garage (chargé à la demande). */
  openGarage(): void;
  /** Lot 41 : une voiture débloquée attend d'être vue au Garage (la pastille « Nouveau »). */
  garageNouveau(): boolean;
  /** Lot G1 : le fantôme choisi (son nom, dans la langue courante) ; `null` : pas de choix à montrer. */
  ghost(): { nom: string } | null;
  /** Lot G1 : passe au fantôme suivant (le même cycle que la touche G, le bouton en course et la pause). */
  cycleGhost(): Promise<void>;
}

export interface HomeUi {
  /** Redessine ce qui vient des records (ton temps, médailles) sans recharger le Salon (après une synchronisation) ; `board` : relit aussi le classement du jour (ta place vient peut-être d'arriver). */
  refresh(options?: { board?: boolean }): void;
  open(): void;
  close(): void;
  isOpen(): boolean;
}

const MEDALS: readonly Medal[] = ["author", "gold", "silver", "bronze"];
/** Lignes du classement montrées à l'accueil : les premiers et la tienne ; « Tout le classement » ouvre la page. */
export const HOME_BOARD_ROWS = 5;

/** Un temps en grand : le nombre en gros, l'unité (« s ») plus petite et en gris (maquette). */
export function bigTime(ms: number): HTMLElement {
  const text = fTemps(ms);
  const unit = text.endsWith(" s") ? " s" : "";
  return el("span", "temps home-temps", text.slice(0, text.length - unit.length)).appendChild(el("span", "home-temps__unite", unit)).parentElement!;
}

export function mountHome(root: HTMLElement, host: HomeHost): HomeUi {
  let open = false;
  let timer = 0;
  let salonStatus: Extract<SalonLookup, { ok: true }>["status"] | null = null;
  let salonProblem: SalonProblem | "recherche" | null = null;
  let boardState: { kind: "charge" } | { kind: "sans_serveur" } | { kind: "hors_ligne" } | { kind: "erreur"; code: string } | { kind: "vide" } | { kind: "ok"; lb: Leaderboard } = { kind: "charge" };
  let previewUrl: string | null | undefined; // undefined : pas encore demandé
  let generation = 0; // une réponse tardive d'une ouverture précédente ne doit rien écrire

  const cadre = creerCadre({ racine: root, titreAria: "accueil.aria", retour: "portail", pleinEcran: true });
  root.classList.add("accueil");
  // Le retour au portail garde son identifiant (tests, outils) : la barre est redessinée à chaque langue.
  const marquerRetour = () => cadre.racine.querySelector(".dj-barre-jeu__retour")?.setAttribute("id", "home-portail");
  marquerRetour();

  // --- Titre ---
  const titre = el("h1", "etiquette__titre home-nom", t("jeu.track.titre"));
  const sousTitre = el("p", "etiquette__sous-titre home-circuit");
  // Lot 41 : le Garage, dans la tête de l'étiquette (visible sans défiler, sur téléphone comme sur ordinateur), avec la pastille « Nouveau ».
  const garageTexte = el("span", "");
  const garageNouveau = el("span", "garage-pastille garage-pastille--nouveau");
  const garage = el("button", "dj-bouton dj-bouton--secondaire home-garage");
  garage.type = "button";
  garage.id = "home-garage";
  garage.addEventListener("click", () => host.openGarage()); // sans `blur` : le focus revient ici à la fermeture du Garage
  garage.append(iconeTrack("voiture"), garageTexte, garageNouveau);
  const tete = el("div", "etiquette__tete");
  tete.append(titre, sousTitre, garage);

  // --- Tracé ---
  const apercu = el("div", "home-apercu");
  apercu.hidden = true;

  // --- Meilleur temps et rang ---
  const mine = el("div", "mine home-resume");

  // --- Médailles ---
  const medailles = el("div", "home-medailles");
  medailles.setAttribute("role", "group");

  // --- Fantôme à battre ---
  const fantome = el("div", "home-fantome");
  fantome.hidden = true;

  // --- Lot G1 : le fantôme choisi, qui se change d'un toucher ---
  const choix = el("button", "home-choix");
  choix.type = "button";
  choix.id = "home-ghost";
  choix.hidden = true;
  choix.addEventListener("click", () => void host.cycleGhost().then(() => renderGhostChoice()));

  // --- Classement du jour (section de l'accueil) ---
  const boardCard = el("section", "card board-card home-classement");
  const boardHead = el("div", "home-classement__tete");
  const boardTitleEl = el("h2", "home-section");
  const boardBody = el("div", "board-body");
  const boardMore = button("", "link home-classement__tout", () => host.openBoard());
  boardMore.id = "home-board-all";
  boardMore.hidden = true;
  const watch = button("", "link watch-best", () => host.watchBest());
  watch.hidden = true;
  boardHead.append(boardTitleEl);
  boardCard.append(boardHead, boardBody, boardMore, watch);

  // --- Salon ---
  const salonCard = el("section", "card salon home-salon");
  const salonTitle = el("h2", "home-section");
  const salonLead = el("p", "note");
  const salonText = el("div", "salon-state");
  salonText.setAttribute("aria-live", "polite");
  const playSalon = button("", "play-salon", () => host.playSalon());
  playSalon.id = "home-salon";
  salonCard.append(salonTitle, salonLead, salonText, playSalon);

  // --- Liens ---
  const links = el("nav", "links home-liens");
  const archive = button("", "", () => host.openArchive());
  archive.id = "home-archive";
  const settings = button("", "", () => host.openSettings());
  settings.id = "home-settings";
  const howto = button("", "", () => host.openHowto());
  howto.id = "home-howto";
  const profileLink = bouton({ texte: "", variante: "secondaire", href: "#" }) as HTMLAnchorElement;
  profileLink.id = "home-profile";
  links.append(archive, settings, howto, profileLink);

  // --- Actions (collées en bas : « Courir » se voit toujours sans défiler) ---
  const playDaily = bouton({ texte: "", variante: "track", pleineLargeur: true, onClick: () => host.playDaily() }) as HTMLButtonElement;
  playDaily.id = "home-daily";
  playDaily.classList.add("play-daily");
  const touchNote = el("p", "note home-tactile");
  touchNote.hidden = !host.touch;
  const nextDay = el("p", "note next-day");
  nextDay.id = "home-nextday";
  nextDay.hidden = true;
  const actions = el("div", "home-actions");
  actions.append(playDaily);

  // Trois colonnes sur grand écran (le circuit et tes temps · le classement · le Salon et les liens), une seule sur téléphone : même ordre de lecture.
  const colA = el("div", "home-col home-col--a");
  colA.append(apercu, mine, medailles, fantome, choix);
  const colB = el("div", "home-col home-col--b");
  colB.append(boardCard);
  const colC = el("div", "home-col home-col--c");
  colC.append(salonCard, links);
  const grille = el("div", "home-grille");
  grille.append(colA, colB, colC);
  // Lot I7 : sur iPhone (pas de plein écran de page), une ligne sous le titre qui dit comment jouer en plein écran ; fermée, elle ne revient pas.
  const astuce = astuceIphone({ textes: () => ({ astuce: t("pleinEcran.iphone"), fermer: t("pleinEcran.iphone.fermer") }), stockage: { getItem: (k) => gameStorage().getItem(k), setItem: (k, v) => gameStorage().setItem(k, v) } });
  // Lot R8 : « Nouveau départ… », une fois, après la remise à zéro du lancement.
  const depart = avisDeNouveauDepart();
  cadre.corps.append(tete, ...(depart ? [depart] : []), ...(astuce ? [astuce] : []), grille, touchNote, nextDay, actions);

  // --- Rendu ---
  function renderTexts() {
    const d = host.daily;
    sousTitre.textContent = t("accueil.sousTitre", { theme: nomTheme(d.theme) });
    boardTitleEl.textContent = t("palmares.titreJour");
    boardMore.textContent = t("palmares.tout");
    watch.textContent = t("palmares.revoir");
    salonTitle.textContent = t("accueil.salon.titre");
    salonCard.setAttribute("aria-label", t("accueil.salon.aria"));
    salonLead.textContent = t("accueil.salon.lead");
    playSalon.textContent = t("accueil.salon.rejoindre");
    archive.textContent = t("accueil.archives");
    settings.textContent = t("accueil.reglages");
    howto.textContent = t("accueil.aide");
    garageTexte.textContent = t("garage.ouvrir");
    garageNouveau.textContent = t("garage.nouveau");
    garageNouveau.hidden = !host.garageNouveau();
    profileLink.textContent = t("accueil.profil");
    links.setAttribute("aria-label", t("accueil.liens"));
    touchNote.textContent = t("accueil.tactile");
    apercu.setAttribute("role", "img");
    apercu.setAttribute("aria-label", t("accueil.apercu.aria", { theme: nomTheme(d.theme) }));
  }

  function renderPreview() {
    if (previewUrl === undefined) return;
    if (!previewUrl) {
      apercu.hidden = true;
      return;
    }
    const img = new Image();
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;
    img.src = previewUrl;
    apercu.replaceChildren(img);
    apercu.hidden = false;
  }

  function renderToday() {
    const d = host.daily;
    renderTexts();
    const best = host.best();
    medailles.setAttribute("aria-label", t("accueil.medailles"));
    medailles.replaceChildren(...MEDALS.map((m) => medaille(traducteurDuSocle(), { type: MEDAL_TYPE[m], obtenue: best !== null && best.ms <= d.medals[m], forme: "case", jeu: "track", valeur: fTemps(d.medals[m]) })));
    if (best) {
      const left = el("div", "home-resume__temps");
      left.append(el("span", "legende label", t("accueil.meilleur")), bigTime(best.ms));
      const right = el("div", "home-resume__rang");
      const rank = el("span", "rank");
      right.append(rank);
      mine.replaceChildren(left, right);
    } else {
      mine.replaceChildren(el("span", "label note", t("accueil.pasCourse")));
    }
    if (best && lastRank) renderRankText(lastRank.rank, lastRank.participants);
    playDaily.textContent = t(best ? "accueil.recourir" : "accueil.courir");
    renderGhost();
    renderGhostChoice();
    renderPreview();
  }

  /** Ta place (« 14e sur 212 ») : gardée, pour qu'un redessin ne la fasse pas disparaître le temps de relire le palmares. */
  let lastRank: { rank: number; participants: number } | null = null;
  function renderRankText(rank: number, participants: number) {
    lastRank = { rank, participants };
    const slot = mine.querySelector(".rank");
    if (!slot) return;
    slot.replaceChildren(el("span", "rang-grand", fRang(rank)), " ", el("span", "rang-sur", t("accueil.rang.sur", { total: fNombre(participants) })));
  }

  function renderGhostChoice() {
    const g = host.ghost();
    choix.hidden = !g;
    if (!g) return;
    choix.replaceChildren(iconeFantome(), el("span", "", t("fantome.bouton", { nom: g.nom })));
  }

  /** Le fantôme à battre : le premier du classement (pseudo, temps, écart avec ton meilleur temps) — rien d'inventé sans palmares. */
  function renderGhost() {
    const best = host.best();
    const first = boardState.kind === "ok" ? boardState.lb.top[0] : undefined;
    const lb = boardState.kind === "ok" ? boardState.lb : null;
    if (!first || !lb || lb.date !== host.daily.date || (lb.me && lb.me.rank === 1)) {
      fantome.hidden = true;
      return;
    }
    const label = el("span", "home-fantome__legende", t("accueil.fantome"));
    const who = el("span", "home-fantome__valeur");
    who.append(el("b", "", first.name), " · ", el("span", "chiffres", fTemps(first.ms)));
    if (best) who.append(" ", el("span", "chiffres home-fantome__ecart", fEcart(best.ms - first.ms)));
    fantome.replaceChildren(label, who);
    fantome.setAttribute("aria-label", t("accueil.fantome.aria", { nom: first.name, temps: fTemps(first.ms) }));
    fantome.hidden = false;
  }

  function renderBoard() {
    boardTitleEl.textContent = t("palmares.titreJour");
    watch.hidden = true;
    boardMore.hidden = true;
    const s = boardState;
    if (s.kind === "charge") return boardBody.replaceChildren(el("p", "empty note", t("palmares.charge")));
    if (s.kind === "sans_serveur" || s.kind === "hors_ligne") return boardBody.replaceChildren(el("p", "empty note", t(s.kind === "sans_serveur" ? "palmares.sansServeur" : "palmares.horsLigne")));
    if (s.kind === "erreur") {
      const retry = button(t("commun.reessayer"), "link", () => void loadBoard(generation));
      return boardBody.replaceChildren(el("p", "empty note note--erreur error", t("palmares.erreur", { erreur: messageErreur(s.code) })), retry);
    }
    if (s.kind === "vide") return boardBody.replaceChildren(el("p", "empty note", t("palmares.vide")));
    const lb = s.lb;
    // En démonstration, « aujourd'hui » est vide : on montre la veille, et on le dit.
    boardTitleEl.textContent = boardTitle(lb, lb.date === host.daily.date);
    const list = el("div", "rows lignes");
    list.append(...linesEls(dayLines(lb)));
    boardBody.replaceChildren(list);
    boardMore.hidden = false;
    watch.hidden = lb.date !== host.daily.date; // le meilleur tour à revoir est celui d'aujourd'hui
  }

  function showRank(rank: number, participants: number) {
    renderRankText(rank, participants);
    rememberRank(host.daily.date, { rank, participants });
  }

  async function loadBoard(gen: number) {
    if (!host.leaderboard) {
      boardState = { kind: host.noBoardReason };
      renderBoard();
      renderGhost();
      return;
    }
    boardState = { kind: "charge" };
    renderBoard();
    const r = await host.leaderboard(HOME_BOARD_ROWS);
    if (gen !== generation) return;
    if (!r.ok) {
      boardState = { kind: "erreur", code: r.code };
      renderBoard();
      renderGhost();
      return;
    }
    const lb = r.data;
    boardState = lb.participants === 0 ? { kind: "vide" } : { kind: "ok", lb };
    renderBoard();
    renderGhost();
    if (lb.me && lb.date === host.daily.date) showRank(lb.me.rank, lb.participants);
  }

  function renderSalon() {
    playSalon.disabled = salonProblem === "sans_serveur"; // pas de serveur : inutile d'essayer
    if (salonStatus) {
      const left = remainingMs(salonStatus, Date.now());
      const line = el("p", "status");
      line.append(t("accueil.salon.etat", { theme: nomTheme(salonStatus.theme), temps: formatDecompte(left, { heures: false }), n: salonStatus.players }));
      return salonText.replaceChildren(line);
    }
    if (salonProblem === "recherche" || salonProblem === null) return salonText.replaceChildren(el("p", "status", t("accueil.salon.recherche")));
    const retry = button(t("commun.reessayer"), "link", () => void loadSalon(generation));
    salonText.replaceChildren(el("p", "status note--erreur error", t(salonProblem === "sans_serveur" ? "accueil.salon.sansServeur" : "accueil.salon.muet")), retry);
  }

  /** « Prochain circuit dans HH:MM:SS » ; à zéro l'accueil se recharge sur le nouveau circuit (une course en cours n'est pas interrompue : l'accueil est fermé). */
  function renderNextDay() {
    const left = host.msUntilNextDay();
    nextDay.hidden = left === null;
    if (left === null) return;
    if (left <= 0) {
      host.onNewDay();
      return;
    }
    const text = t("accueil.prochain", { temps: formatDecompte(left) });
    if (nextDay.textContent !== text) nextDay.textContent = text;
  }

  async function loadSalon(gen: number) {
    salonProblem = "recherche";
    salonStatus = null;
    renderSalon();
    const r = await host.salon();
    if (gen !== generation) return;
    if (!r.ok) {
      salonStatus = null;
      salonProblem = r.reason;
    } else {
      salonStatus = r.status;
      salonProblem = null;
    }
    renderSalon();
  }

  function renderAll() {
    renderToday();
    renderBoard();
    renderSalon();
    renderNextDay();
    profileLink.setAttribute("href", host.profileHref());
    marquerRetour();
  }

  onLangue(() => {
    if (open) renderAll();
    else renderTexts();
  });
  renderTexts();

  return {
    refresh(options = {}) {
      if (!open) return;
      renderToday();
      if (options.board) void loadBoard(generation);
    },
    open() {
      open = true;
      generation++;
      lastRank = null;
      root.hidden = false;
      document.body.classList.add("home");
      cadre.corps.scrollTop = 0;
      renderToday();
      profileLink.setAttribute("href", host.profileHref());
      marquerRetour();
      const gen = generation;
      void loadBoard(gen);
      void loadSalon(gen);
      if (previewUrl === undefined) {
        void host.preview().then((url) => {
          previewUrl = url;
          if (open) renderPreview();
        });
      }
      clearInterval(timer);
      renderNextDay();
      timer = window.setInterval(() => {
        renderNextDay();
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
