import { ATTEMPT_FINISHED, type JumpMedal } from "@cdj/jump-sim";
import { medaille } from "@cdj/ui";
import { MEDAL_TYPE, medalWord } from "./dailyInfo";
import { fChrono, fEcart, fTicks, lier, onLangue, t, traducteurDuSocle } from "./i18n";
import type { JumpSession } from "./session";

// Les surimpressions en partie (lot 2, **refaites au lot I5** : charte rév. 7, § 9 « Surimpressions en partie : compactes » ; maquette `jump-hud.html`).
// DOM et affichage seulement : on lit la session, rien ne touche à la simulation.
//   - **Une seule bande de 30 px** au centre en haut (`#chrono`) : le chrono (Lilita One, `.time`), le point de passage avec un petit drapeau (`.pc`,
//     « 2/4 ») et l'écart signé au record (`.ecart`, `+` / `−`, couleur **et** signe), collés en une plaque ; rien d'empilé dessous en permanence.
//   - En haut à droite : l'objectif de médaille compact (`#objectif` : pastille + seuil) puis l'autocollant des morts (`#morts` : crâne + nombre, penché).
//   - **Le centre reste libre** : le titre du niveau (`#dayline`) ne s'affiche qu'au départ, les messages courts (`#toast`) passent sous la bande.
//   - Fluidité : **le DOM n'est écrit que si le texte change** (une clé par plaque) ; chaque plaque est `contain: layout paint style` (hud.css).
// Le bandeau d'arrivée (`#finish`) sert aux morceaux, scénarios, lectures et essais (le niveau du jour a son écran d'arrivée, `arrival.ts`) ; le
// carnage (`#carnage`) a son titre en autocollant, son compteur, sa vague et sa barre de lecture.

export interface FinishOptions {
  /** « Arrivée ! » par défaut (« Rediffusion » en lecture). */
  title?: string;
  /** Lot 4 : le temps de référence (« Solution : 2,600 s »), affiché sous le temps. */
  reference?: string | null;
  /** Lot 4 : lien « Morceau suivant ». */
  next?: string | null;
  /** Une lecture (rediffusion, solution) : sans meilleur temps, on n'accuse pas les réglages. */
  watching?: boolean;
}

/** L'objectif de la bande de droite : la prochaine médaille et son seuil (pas), ou `auteur battu`, ou rien (pas de médailles : morceau, scénario). */
export type Objective = { medal: JumpMedal; ticks: number } | "battu" | null;

/** Lot I5 : l'état de la barre de lecture du carnage (vague, en pause), et ce qu'on peut y faire. */
export interface CarnageBar {
  label: string;
  wave: { current: number; total: number };
  paused: boolean;
}
export interface CarnageControls {
  onPrev(): void;
  onToggle(): void;
  onNext(): void;
  onClose(): void;
}

export interface Hud {
  /** `time` : le chrono affiché (par défaut celui de l'essai ; pendant le carnage, celui du héros). */
  update(session: JumpSession, time?: number): void;
  /** Le point de passage (indice, −1 aucun) et leur nombre ; l'écart signé au record au dernier point franchi (pas), ou `null`. */
  setProgress(checkpoint: number, total: number, gap: number | null): void;
  setObjective(o: Objective): void;
  /** Bandeau d'arrivée. Le meilleur temps affiché est celui du jour, recalculé par le rejeu. */
  finish(session: JumpSession, opts?: FinishOptions): void;
  /** Le carnage (titre, compteur, vague, barre de lecture) ; null le cache. */
  carnage(bar: CarnageBar | null): void;
  readonly carnageShown: boolean;
  hideFinish(): void;
  /** Message bref sous la bande (point de passage atteint, lecture…). */
  toast(text: string): void;
  /**
   * Lot 27 : le décompte avant le départ — `3`, `2`, `1` (affichés tant que le décompte dure), `"go"` (« Partez ! », un instant) ou `null` (rien). Le DOM n'est écrit que si
   * l'état change. Texte lu à haute voix poliment (`aria-live`) ; jamais au centre du personnage (il est au premier tiers de l'écran).
   */
  decompte(etat: number | "go" | null): void;
  readonly finishShown: boolean;
}

const $ = <E extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): E => root.querySelector<E>(sel)!;

/**
 * Lot I5 : des chiffres **à chasse fixe** en Lilita One, qui n'a pas de chiffres tabulaires (mesuré : « 1 » fait 0,41 em, « 0 » 0,64 em) — sans quoi le chrono
 * ferait bouger la bande à chaque image (charte § 4). Chaque caractère a sa case de largeur fixe (`.case` : chiffre, `.case--ponct` : virgule, point, deux-points,
 * signe), remplies depuis la droite ; une case vide garde sa place (« 9,999 » a la largeur de « 59,999 »). **Seules les cases dont le caractère change sont
 * écrites** (au plus trois ou quatre par image : les millièmes). Au-delà d'une minute (« 1:02,345 »), des cases s'ajoutent une fois, à gauche.
 */
export function chiffresFixes(conteneur: HTMLElement, cases: number): (texte: string) => void {
  const cellules: HTMLSpanElement[] = [];
  const vus: string[] = [];
  const ajouter = () => {
    const c = document.createElement("span");
    c.className = "case case--vide";
    c.setAttribute("aria-hidden", "true");
    cellules.unshift(c);
    vus.unshift("");
    conteneur.prepend(c);
  };
  conteneur.replaceChildren();
  conteneur.setAttribute("role", "timer"); // lot I6 (axe : aria-prohibited-attr) : un `aria-label` sur un `span` demande un rôle ; un chrono est un « timer »
  for (let i = 0; i < cases; i++) ajouter();
  const ponct = (ch: string) => ch !== "" && !/[0-9]/.test(ch);
  return (texte) => {
    if (conteneur.getAttribute("aria-label") !== texte) conteneur.setAttribute("aria-label", texte);
    const chars = [...texte];
    while (cellules.length < chars.length) ajouter();
    const debut = cellules.length - chars.length;
    for (let i = 0; i < cellules.length; i++) {
      const ch = i < debut ? "" : chars[i - debut]!;
      const avant = vus[i]!;
      if (avant === ch) continue;
      vus[i] = ch;
      const c = cellules[i]!;
      c.textContent = ch;
      if (ponct(ch) !== ponct(avant)) c.classList.toggle("case--ponct", ponct(ch));
      if ((ch === "") !== (avant === "")) c.classList.toggle("case--vide", ch === "");
    }
  };
}

export function mountHud(opts: { onRestart(): void; carnage: CarnageControls }): Hud {
  const chrono = $("#chrono");
  const time = $(".time", chrono);
  // « 59,999 » : six cases (au-delà d'une minute, elles s'ajoutent d'elles-mêmes).
  const ecrireTemps = chiffresFixes(time, 6);
  const pc = $(".pc", chrono);
  const pcText = $(".pc__texte", chrono);
  const ecart = $(".ecart", chrono);
  const objectif = $("#objectif");
  const morts = $("#morts");
  const mortsCount = $(".count", morts);
  const banner = $("#finish");
  const bTime = $(".time", banner);
  const bBest = $(".best", banner);
  const bDeaths = $(".deaths", banner);
  const button = $<HTMLButtonElement>("#finish-restart");
  const bTitle = $(".title", banner);
  const bRef = $(".ref", banner);
  const next = $<HTMLAnchorElement>("#finish-next");
  const carnageEl = $("#carnage");
  const carnageCount = $(".count", carnageEl);
  const vague = $(".carnage__vague-valeur", carnageEl);
  const vagueBox = $(".carnage__vague", carnageEl);
  const progress = $(".carnage__avancement", carnageEl);
  const progressFill = $(".carnage__avancement-plein", carnageEl);
  const toggle = $<HTMLButtonElement>("#carnage-pause");
  let carnageText: string | null = null;
  button.addEventListener("click", () => {
    button.blur();
    opts.onRestart();
  });
  // Toucher le bandeau (pas seulement le bouton) recommence aussi ; il est au-dessus de la couche tactile.
  banner.addEventListener("pointerup", (e) => {
    if (e.target !== button && e.target !== next) opts.onRestart();
  });
  // La barre de lecture du carnage : ses boutons ne passent pas le carnage (ils sont au-dessus de la couche tactile, et leur appui est arrêté).
  const on = (id: string, f: () => void) => {
    const b = $<HTMLButtonElement>(`#${id}`);
    b.addEventListener("click", () => {
      b.blur();
      f();
    });
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
  };
  on("carnage-prev", () => opts.carnage.onPrev());
  on("carnage-pause", () => opts.carnage.onToggle());
  on("carnage-next", () => opts.carnage.onNext());
  on("carnage-close", () => opts.carnage.onClose());

  const toastEl = $("#toast");
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  const decompteEl = $("#decompte");
  let decompteEtat: number | "go" | null = null;
  let decompteTimer: ReturnType<typeof setTimeout> | null = null;
  // Une clé par plaque : le DOM n'est écrit que si son texte change (fluidité, retouche du lot I4).
  let lastTime = "";
  let lastDeaths = -1;
  let lastDone: boolean | null = null;
  let lastProgress = "";
  let lastObjective = "";
  let objectiveNow: Objective = null;
  let progressNow: [number, number, number | null] = [-1, 0, null];
  let finishShown = false;
  let lastSession: JumpSession | null = null;
  let lastAt = 0;

  const writeProgress = () => {
    const [cp, total, gap] = progressNow;
    const key = `${cp}|${total}|${gap}`;
    if (key === lastProgress) return;
    lastProgress = key;
    pc.hidden = total === 0;
    const reached = Math.max(0, cp + 1);
    pcText.textContent = `${reached}/${total}`;
    pc.setAttribute("aria-label", t("hud.pc.aria", { pc: reached, total }));
    ecart.hidden = gap === null;
    if (gap !== null) {
      const texte = fEcart(gap);
      ecart.textContent = texte;
      ecart.dataset.signe = gap < 0 ? "moins" : "plus";
      ecart.setAttribute("aria-label", t("hud.ecart.aria", { ecart: texte }));
    }
  };
  const writeObjective = () => {
    const o = objectiveNow;
    const key = o === null ? "" : o === "battu" ? "battu" : `${o.medal}|${o.ticks}`;
    if (key === lastObjective) return;
    lastObjective = key;
    objectif.hidden = o === null;
    if (o === null) return;
    if (o === "battu") {
      objectif.replaceChildren(medaille(traducteurDuSocle(), { type: "auteur", obtenue: true, jeu: "jump" }));
      objectif.setAttribute("aria-label", t("hud.objectif.auteurBattu"));
      return;
    }
    const pastille = medaille(traducteurDuSocle(), { type: MEDAL_TYPE[o.medal], obtenue: false, jeu: "jump" });
    const seuil = document.createElement("span");
    seuil.className = "objectif__seuil";
    seuil.textContent = fChrono(o.ticks);
    objectif.replaceChildren(pastille, seuil);
    objectif.setAttribute("aria-label", t("hud.objectif.aria", { medaille: medalWord(o.medal), temps: fTicks(o.ticks) }));
  };
  // La langue change : les plaques se réécrivent (virgule ou point, mots).
  onLangue(() => {
    lastTime = "";
    lastProgress = "";
    lastObjective = "";
    lastDeaths = -1;
    writeProgress();
    writeObjective();
    if (lastSession) self.update(lastSession, lastAt);
  });

  const self: Hud = {
    update(session, at = session.state.time) {
      lastSession = session;
      lastAt = at;
      // Lot 15 : pendant le « Prêt… », le chrono de l'état montré est négatif : le chrono affiché reste à zéro.
      const tx = fChrono(at < 0 ? 0 : at);
      if (tx !== lastTime) {
        lastTime = tx;
        ecrireTemps(tx);
      }
      if (session.deaths !== lastDeaths) {
        lastDeaths = session.deaths;
        mortsCount.textContent = String(session.deaths);
        morts.setAttribute("aria-label", t("commun.morts", { n: session.deaths }));
      }
      const done = session.state.status === ATTEMPT_FINISHED;
      if (done !== lastDone) {
        lastDone = done;
        chrono.classList.toggle("done", done);
      }
    },
    setProgress(checkpoint, total, gap) {
      progressNow = [checkpoint, total, gap];
      writeProgress();
    },
    setObjective(o) {
      objectiveNow = o;
      writeObjective();
    },
    finish(session, o = {}) {
      bTitle.textContent = o.title ?? t("bandeau.arrivee");
      bRef.textContent = o.reference ?? "";
      next.hidden = !o.next;
      if (o.next) next.href = o.next;
      bTime.textContent = fTicks(session.state.time);
      bBest.textContent = session.best === null ? t(o.watching ? "bandeau.meilleurAucun" : "bandeau.meilleurModifie") : t("bandeau.meilleur", { temps: fTicks(session.best) });
      // Avec les points de passage, un temps peut contenir des morts (le chrono a continué) : on le dit.
      const run = session.attemptDeaths === 0 ? t("bandeau.sansFaute") : t("bandeau.mortsEssai", { n: session.attemptDeaths });
      bDeaths.textContent = t("bandeau.morts", { n: session.deaths, essai: run });
      banner.hidden = false;
      finishShown = true;
    },
    toast(text) {
      toastEl.textContent = text;
      toastEl.classList.remove("show");
      void toastEl.offsetWidth; // relance l'animation
      toastEl.classList.add("show");
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1600);
    },
    decompte(etat) {
      if (etat === decompteEtat) return;
      decompteEtat = etat;
      if (decompteTimer) clearTimeout(decompteTimer);
      decompteTimer = null;
      if (etat === null || etat === 0) {
        decompteEl.hidden = true;
        decompteEl.textContent = "";
        decompteEtat = null;
        return;
      }
      decompteEl.textContent = etat === "go" ? t("decompte.partez") : String(etat);
      decompteEl.classList.toggle("decompte--go", etat === "go");
      decompteEl.hidden = false;
      // « Partez ! » ne reste qu'un instant (le chrono est parti) ; un chiffre reste tant que le décompte dure.
      if (etat === "go")
        decompteTimer = setTimeout(() => {
          decompteEl.hidden = true;
          decompteEtat = null;
        }, 700);
    },
    hideFinish() {
      banner.hidden = true;
      finishShown = false;
    },
    get finishShown() {
      return finishShown;
    },
    carnage(bar) {
      const shown = bar !== null;
      if (carnageEl.hidden === shown) {
        carnageEl.hidden = !shown;
        document.body.classList.toggle("carnage", shown);
      }
      if (!bar) {
        carnageText = null;
        return;
      }
      if (bar.label !== carnageText) {
        carnageText = bar.label;
        carnageCount.textContent = bar.label;
      }
      const v = t("carnage.vagueValeur", { n: bar.wave.current, total: bar.wave.total });
      if (vague.textContent !== v) {
        vague.textContent = v;
        vagueBox.setAttribute("aria-label", t("carnage.vagueAria", { n: bar.wave.current, total: bar.wave.total }));
        progress.setAttribute("aria-label", t("carnage.avancement", { n: bar.wave.current, total: bar.wave.total }));
        progressFill.style.width = `${Math.round((100 * bar.wave.current) / Math.max(1, bar.wave.total))}%`;
      }
      const etat = bar.paused ? "lecture" : "pause";
      if (toggle.dataset.etat !== etat) {
        toggle.dataset.etat = etat;
        toggle.setAttribute("aria-pressed", bar.paused ? "true" : "false");
        lier(toggle, bar.paused ? "carnage.lecture" : "carnage.pause", undefined, "aria-label");
      }
    },
    get carnageShown() {
      return carnageText !== null;
    },
  };
  return self;
}
