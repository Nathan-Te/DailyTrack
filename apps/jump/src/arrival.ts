import type { JumpMedal } from "@cdj/jump-sim";
import type { Suite } from "@cdj/profile";
import { bouton, el, icone, medaille } from "@cdj/ui";
import { creerCadre } from "./cadre";
import { MEDAL_TYPE } from "./dailyInfo";
import { ligneClassement } from "./home";
import { lier, onLangue, t, traducteurDuSocle } from "./i18n";
import { elementsDeSuite } from "./jeuSuivant";
import type { RankView } from "./rankView";

// L'écran d'arrivée du niveau du jour (lot 10 ; les morceaux, les scénarios et les lectures gardent le bandeau du lot 2). **Lot I5 : maquette
// `jump-arrivee.html`**, dans le cadre crème de Du Jour (barre « ‹ DU JOUR ») avec l'étiquette jaune : « ARRIVÉE ! », **le temps en grand**, l'autocollant
// des morts (du jour), le bandeau de la médaille (pastille et nom) avec la prochaine à viser, le rang du jour, **une phrase selon le nombre de morts**
// (paliers, `homeLogic.ts`), **REJOUER**, Voir le carnage, Partager ; puis le classement (état de l'envoi, pseudo, le haut et ta ligne en encre), Regarder
// le premier, le carnage de tout le monde, l'accueil de Jump, le compte à rebours ; **sous l'étiquette**, « Il te reste aujourd'hui » et « Jeu suivant du
// jour : Track › » (ou « Journée parfaite ! ») du lot I3, en `bouton({ href })` du socle. Il s'ouvre **après** le carnage. DOM seulement : les textes
// viennent de `homeLogic.ts` et `rankView.ts`. Ses boutons ne répondent qu'à un appui commencé sur lui (le doigt qui passe le carnage ne déclenche rien).

export interface ArrivalView {
  /** Une archive ou un jour à venir : la ligne qui le dit (« Archive du … : ne compte pas dans ta série »), sinon "". */
  mode: string;
  time: string;
  medal: JumpMedal | null;
  medalText: string;
  /** La prochaine médaille (« Or à » et son temps), ou `null` : l'auteur est battu. */
  next: { label: string; time: string } | null;
  /** « Nouveau record du jour ! » ou « Meilleur du jour : … ». */
  best: string;
  newBest: boolean;
  /** Morts du jour (l'autocollant) et la phrase de leur palier. */
  deaths: number;
  phrase: string;
  /** « 12 morts aujourd'hui · 5 essais », les morts de cet essai, la série. */
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
  /** Lot I5 : « Tout le classement › » (l'écran du classement du jour). */
  onBoard?(): void;
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
  /** Lot P2 : le nom du premier pour « Regarder le premier », ou `null` : caché (pas de premier, ou c'est toi). */
  setFirst(name: string | null): void;
  readonly first: string | null;
  /** Lot P3 : le compteur du carnage de tout le monde (« 142 vies de 37 joueurs »), ou `null` : caché (pas d'échantillon). */
  setEveryone(label: string | null): void;
  readonly everyone: string | null;
  /** Lot I3 (plateforme) : « Jeu suivant du jour : Track › » ou « Journée parfaite ! » + « ‹ DU JOUR » (`null` : rien, le serveur n'a pas répondu). */
  setSuite(suite: Suite | null): void;
  readonly suite: Suite | null;
}

export function mountArrival(opts: ArrivalOptions): Arrival {
  // Règle de Nathan (lot I5) : on reste dans le jeu tant qu'on ne choisit pas d'en sortir — l'arrivée est posée sur la scène, comme les autres écrans.
  const cadre = creerCadre({ id: "arrival", titreAria: "arrivee.aria", retour: "portail", scene: true });
  const root = cadre.racine;
  root.classList.add("cadre--arrivee");

  const titre = el("div", { classe: "arrivee__tete" }, lier(el("h1", { classe: "etiquette__titre" }), "arrivee.titre"), el("span", { classe: "arrivee__drapeau" }, icone("drapeau", { taille: 40 })));
  const mode = el("p", { classe: "arrivee__mode" });
  const time = el("span", { classe: "arrivee__temps", attrs: { id: "arrival-time" } });
  const deathsN = el("span", { classe: "autocollant__nombre" });
  const deathsW = el("span", { classe: "autocollant__mot" });
  const deaths = el("div", { classe: "autocollant autocollant--encre", attrs: { id: "arrival-deaths" } }, deathsN, deathsW);
  const tempsBloc = el("div", { classe: "arrivee__resultat" }, el("div", { classe: "arrivee__chrono" }, lier(el("span", { classe: "legende" }), "arrivee.tonTemps"), time), deaths);
  const medalSlot = el("span", { classe: "arrivee__pastille" });
  const medalText = el("span", { classe: "arrivee__medaille-texte" });
  const nextLabel = el("span");
  const nextTime = el("span", { classe: "chiffres" });
  const nextBox = el("span", { classe: "arrivee__prochaine" }, nextLabel, nextTime);
  const medalRow = el("div", { classe: "arrivee__medaille", attrs: { id: "arrival-medal" } }, medalSlot, medalText, nextBox);
  const best = el("p", { classe: "arrivee__meilleur" });
  const rankLine = el("div", { classe: "arrivee__rang" });
  const rankTitle = lier(el("span", { classe: "arrivee__rang-titre" }), "arrivee.classement");
  const rankStatus = el("span", { classe: "arrivee__rang-valeur", attrs: { id: "arrival-rank", role: "status" } });
  rankLine.append(rankTitle, rankStatus);
  const phrase = el("p", { classe: "arrivee__phrase", attrs: { id: "arrival-phrase" } });

  const replay = bouton({ texte: t("arrivee.rejouer"), variante: "jump", pleineLargeur: true }) as HTMLButtonElement;
  replay.id = "arrival-replay";
  lier(replay, "arrivee.rejouer");
  const second = (id: string, cle: string) => {
    const b = bouton({ texte: t(cle), variante: "secondaire" }) as HTMLButtonElement;
    b.id = id;
    lier(b, cle);
    return b;
  };
  const carnage = second("arrival-carnage", "arrivee.carnage");
  const share = second("arrival-share", "arrivee.partager");
  const duo = el("div", { classe: "actions--duo" }, carnage, share);
  const message = el("div", { classe: "arrivee__message", attrs: { role: "status" } });
  const fallback = el("textarea", { classe: "champ arrivee__secours", attrs: { readonly: true, rows: 3, hidden: true } });

  // Lot P1 : le classement du jour (titre, état de l'envoi, Recharger, formulaire du pseudo, le haut et ta ligne).
  const rankBox = el("section", { classe: "arrivee__classement", attrs: { hidden: true } });
  const rankHead = el("span", { classe: "legende" });
  const reload = second("arrival-reload", "commun.recharger");
  reload.hidden = true;
  const nameInput = el("input", { classe: "champ", attrs: { id: "arrival-name", type: "text", maxlength: 20, autocomplete: "off" } });
  lier(nameInput, "arrivee.pseudo", undefined, "placeholder");
  lier(nameInput, "arrivee.pseudo", undefined, "aria-label");
  const nameOk = bouton({ texte: t("arrivee.pseudo.ok"), variante: "jump" }) as HTMLButtonElement;
  nameOk.type = "submit";
  nameOk.id = "arrival-name-ok";
  lier(nameOk, "arrivee.pseudo.ok");
  const nameError = el("div", { classe: "arrivee__erreur" });
  const suggestions = el("div", { classe: "arrivee__suggestions" });
  const nameForm = el("form", { classe: "arrivee__pseudo", attrs: { hidden: true } }, nameInput, nameOk, nameError, suggestions);
  const rankList = el("ol", { classe: "lignes" });
  const boardAll = el("button", { classe: "lien", attrs: { type: "button", id: "arrival-board" } });
  lier(boardAll, "arrivee.classementTout");
  rankBox.append(rankHead, reload, nameForm, rankList, boardAll);
  // Taper son pseudo ne commande pas le personnage (R recommence, Espace saute…) : les touches restent dans le champ.
  for (const type of ["keydown", "keyup"] as const) nameInput.addEventListener(type, (e) => e.stopPropagation());
  nameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    opts.onName?.(nameInput.value);
  });

  const first = second("arrival-first", "arrivee.premier");
  first.hidden = true;
  const everyone = second("arrival-everyone", "arrivee.toutLeMonde");
  everyone.hidden = true;
  const home = second("arrival-home", "arrivee.accueil");
  const autres = el("div", { classe: "actions actions--colonne" }, everyone, first, home);
  const stats = el("p", { classe: "arrivee__stats" });
  const countdown = el("p", { classe: "arrivee__decompte" });
  const hint = lier(el("p", { classe: "arrivee__clavier" }), "arrivee.aideClavier");

  cadre.corps.append(titre, mode, tempsBloc, medalRow, best, rankLine, phrase, replay, duo, message, fallback, rankBox, autres, stats, countdown, hint);
  // Lot I3 : la suite de la journée, **sous l'étiquette** (rempli une fois l'envoi accepté : `setSuite`).
  const suiteBox = el("div", { classe: "arrivee__suite", attrs: { id: "arrival-next", hidden: true } });
  cadre.pied.append(suiteBox);

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
  on(boardAll, () => opts.onBoard?.());

  let shown = false;
  let note = "";
  let rankShown = { shown: false, status: "", rows: 0 };
  let suggestionKey = "";
  let firstName: string | null = null;
  let everyoneLabel: string | null = null;
  let suiteShown: Suite | null = null;
  let view: ArrivalView | null = null;

  const render = (v: ArrivalView) => {
    view = v;
    mode.textContent = v.mode;
    mode.hidden = v.mode === "";
    time.textContent = v.time;
    deathsN.textContent = String(v.deaths);
    deathsW.textContent = t("arrivee.morts", { n: v.deaths });
    medalSlot.replaceChildren(v.medal ? medaille(traducteurDuSocle(), { type: MEDAL_TYPE[v.medal], obtenue: true, jeu: "jump" }) : el("span", { classe: "arrivee__sans", attrs: { "aria-hidden": "true" } }));
    medalRow.dataset.medal = v.medal ?? "";
    medalText.textContent = v.medalText;
    nextBox.hidden = v.next === null;
    if (v.next) {
      nextLabel.textContent = v.next.label;
      nextTime.textContent = v.next.time;
    }
    best.textContent = v.best;
    best.classList.toggle("arrivee__meilleur--record", v.newBest);
    phrase.textContent = t("commun.citation", { texte: v.phrase });
    stats.textContent = [v.stats, v.run, v.streak].filter(Boolean).join(" · ");
    countdown.textContent = v.countdown;
    carnage.hidden = !v.canCarnage;
    share.hidden = !v.canShare;
    duo.classList.toggle("actions--seul", carnage.hidden !== share.hidden);
  };
  onLangue(() => {
    if (view && shown) render(view);
    if (firstName !== null) lier(first, "arrivee.premier", { nom: firstName });
    if (suiteShown) suiteBox.replaceChildren(...elementsDeSuite(suiteShown));
  });

  return {
    get suite() {
      return suiteShown;
    },
    setSuite(suite) {
      suiteShown = suite;
      suiteBox.hidden = suite === null;
      suiteBox.replaceChildren(...(suite ? elementsDeSuite(suite) : []));
    },
    get everyone() {
      return everyoneLabel;
    },
    setEveryone(label) {
      everyoneLabel = label;
      everyone.hidden = label === null;
      if (label !== null) everyone.setAttribute("aria-description", label);
    },
    get rank() {
      return rankShown;
    },
    get first() {
      return firstName;
    },
    setFirst(name) {
      firstName = name;
      first.hidden = name === null;
      if (name !== null) lier(first, "arrivee.premier", { nom: name });
    },
    setRank(v) {
      rankShown = { shown: v.shown, status: v.status, rows: v.rows.length };
      rankBox.hidden = !v.shown;
      rankLine.hidden = !v.shown;
      if (!v.shown) return;
      rankHead.textContent = v.title;
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
            const b = bouton({ texte: name, variante: "secondaire" }) as HTMLButtonElement;
            b.classList.add("arrivee__suggestion");
            b.addEventListener("click", () => {
              nameInput.value = name;
              opts.onName?.(name);
            });
            return b;
          }),
        );
      }
      if (v.askName && wasHidden) nameInput.focus({ preventScroll: true });
      const lignes = v.rows.map((r) => ligneClassement(r, false));
      if (v.gap && lignes.length > 1) lignes.splice(lignes.length - 1, 0, el("li", { classe: "ligne ligne--trou", attrs: { "aria-hidden": "true" }, texte: "…" }));
      rankList.replaceChildren(...lignes);
      boardAll.hidden = v.rows.length === 0 || !opts.onBoard;
    },
    get shown() {
      return shown;
    },
    get message() {
      return note;
    },
    show(v) {
      render(v);
      note = "";
      message.textContent = "";
      fallback.hidden = true;
      root.hidden = false;
      armed = false;
      cadre.corps.scrollTop = 0;
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
