import type { JumpMedal } from "@cdj/jump-sim";
import type { Suite } from "@cdj/profile";
import { bouton, el, medaille } from "@cdj/ui";
import { MEDAL_TYPE } from "./dailyInfo";
import { fEcart, lier, onLangue, t, traducteurDuSocle } from "./i18n";

// Lot 27 — **le résultat pendant la rediffusion et le carnage**. Avant, l'écran d'arrivée s'ouvrait *après* le carnage ; maintenant, dès l'arrivée, un autocollant compact de la charte « Cartouches »
// (l'étiquette jaune cernée d'encre, ombre portée nette) est posé sur la scène **à gauche, sous le titre du carnage** : le temps en grand, la médaille (pastille du socle et son nom écrit), les morts de
// l'essai, la place au classement, l'écart au record d'avant ; puis les boutons de suite — REJOUER, le classement, le jeu suivant du jour — qui restent accessibles. Il ne cache ni l'arrivée (elle est
// devant le héros, à droite) ni l'essentiel du carnage (le milieu et la droite de l'écran). DOM seulement : les chiffres et les phrases viennent de `main.ts`. L'écran d'arrivée complet (cadre crème,
// partage, carnage de tout le monde…) s'ouvre toujours à la fin du carnage, ou au bouton « Fermer » de la barre de lecture.

export interface ResultView {
  /** « 28,413 s ». */
  time: string;
  medal: JumpMedal | null;
  /** « sans faute » ou « 3 morts » (les morts de **cet** essai). */
  deaths: string;
  /** L'écart au record d'avant (« +0,418 », « −0,418 »), `null` : pas de record avant ; `best` : cet essai l'a battu (« Nouveau record ! »). */
  gap: { kind: "record" } | { kind: "ecart"; text: string; better: boolean } | { kind: "premier" } | null;
  /** Le classement est-il offert (niveau du jour ou archive) ? Sinon pas de bouton « Classement ». */
  canBoard: boolean;
}

export interface ResultOptions {
  onReplay(): void;
  onBoard(): void;
}

export interface ResultSticker {
  readonly shown: boolean;
  show(view: ResultView): void;
  hide(): void;
  /** La place au classement (« 3ᵉ sur 128 », « Envoi au classement… »), ou `null` : rien. */
  setRank(text: string | null): void;
  /** La suite de la journée (« Jeu suivant du jour : Track › », « Journée parfaite ! »), ou `null` : rien. */
  setSuite(suite: Suite | null): void;
  /** Ce qui est affiché (tests). */
  readonly state: { shown: boolean; time: string; medal: JumpMedal | null; deaths: string; rank: string; gap: string; suite: string; buttons: string[] };
  readonly element: HTMLElement;
}

export function mountResult(opts: ResultOptions): ResultSticker {
  const racine = el("aside", { classe: ["autocollant", "autocollant--resultat"], attrs: { id: "resultat", hidden: true } });
  const medalSlot = el("span", { classe: "resultat__medaille" });
  const temps = el("span", { classe: "resultat__temps" });
  const tete = el("div", { classe: "resultat__tete" }, temps);
  const morts = el("span", { classe: "resultat__morts" });
  const rang = el("span", { classe: "resultat__rang" });
  const ecart = el("div", { classe: "resultat__ecart" });
  // La pastille de la médaille du socle porte déjà son nom écrit (« Or », « Auteur ») : pas de second texte.
  const lignes = el("div", { classe: "resultat__lignes" }, medalSlot, morts, rang);
  const rejouer = bouton({ texte: t("arrivee.rejouer"), variante: "jump", pleineLargeur: true, onClick: () => opts.onReplay() }) as HTMLButtonElement;
  rejouer.id = "resultat-rejouer";
  lier(rejouer, "arrivee.rejouer");
  const classement = bouton({ texte: t("resultat.classement"), variante: "secondaire", pleineLargeur: true, onClick: () => opts.onBoard() }) as HTMLButtonElement;
  classement.id = "resultat-classement";
  lier(classement, "resultat.classement");
  const suiteSlot = el("div", { classe: "resultat__suite" });
  const rangee = el("div", { classe: "resultat__rangee" }, classement, suiteSlot);
  racine.append(tete, lignes, ecart, rejouer, rangee);
  document.body.append(racine);

  let view: ResultView | null = null;
  let rankNow: string | null = null;
  let suiteNow: Suite | null = null;

  const writeRank = () => {
    rang.textContent = rankNow ?? "";
    rang.hidden = !rankNow;
  };
  const writeSuite = () => {
    suiteSlot.replaceChildren();
    const s = suiteNow;
    suiteSlot.hidden = s === null;
    if (!s) return;
    if (s.kind === "suivant") {
      const lien = bouton({ texte: t("resultat.suite", { jeu: s.nom }), ariaLabel: t("arrivee.jeuSuivant.aria", { jeu: s.nom }), href: s.href, variante: "marque", pleineLargeur: true });
      lien.id = "resultat-suite";
      suiteSlot.append(lien);
    } else suiteSlot.append(el("span", { classe: "resultat__parfaite", attrs: { id: "resultat-parfaite" }, texte: t("arrivee.parfaite") }));
  };
  const write = () => {
    const v = view;
    if (!v) return;
    racine.setAttribute("aria-label", t("resultat.aria"));
    temps.textContent = v.time;
    medalSlot.replaceChildren(v.medal ? medaille(traducteurDuSocle(), { type: MEDAL_TYPE[v.medal], obtenue: true, jeu: "jump" }) : el("span", { classe: "resultat__sans", attrs: { "aria-hidden": "true" } }));
    medalSlot.hidden = !v.medal;
    morts.textContent = v.deaths;
    const g = v.gap;
    ecart.hidden = g === null;
    ecart.dataset.ton = g === null ? "" : g.kind === "record" ? "mieux" : g.kind === "ecart" ? (g.better ? "mieux" : "pire") : "neutre";
    ecart.textContent = g === null ? "" : g.kind === "record" ? t("resultat.record") : g.kind === "premier" ? t("resultat.premier") : t("resultat.ecart", { ecart: g.text });
    classement.hidden = !v.canBoard;
    rangee.classList.toggle("resultat__rangee--seule", !v.canBoard);
    writeRank();
    writeSuite();
  };
  onLangue(() => {
    if (view) write();
  });

  return {
    get shown() {
      return !racine.hidden;
    },
    element: racine,
    show(v) {
      view = v;
      write();
      racine.hidden = false;
    },
    hide() {
      racine.hidden = true;
      view = null;
      rankNow = null;
      suiteNow = null;
    },
    setRank(text) {
      rankNow = text;
      if (view) writeRank();
    },
    setSuite(suite) {
      suiteNow = suite;
      if (view) writeSuite();
    },
    get state() {
      return {
        shown: !racine.hidden,
        time: temps.textContent ?? "",
        medal: view?.medal ?? null,
        deaths: morts.textContent ?? "",
        rank: rang.textContent ?? "",
        gap: ecart.hidden ? "" : (ecart.textContent ?? ""),
        suite: suiteSlot.hidden ? "" : (suiteSlot.textContent ?? ""),
        buttons: [rejouer, classement, ...suiteSlot.querySelectorAll<HTMLElement>("a")].filter((b) => !b.hidden).map((b) => b.id),
      };
    },
  };
}

/** L'écart au record d'avant, pour l'autocollant : `fEcart` (« −0,418 ») et si c'est mieux ; `null` sans record d'avant (le premier temps du jour). */
export function resultGap(time: number, record: number | null): ResultView["gap"] {
  if (record === null) return { kind: "premier" };
  if (time < record) return { kind: "record" };
  return { kind: "ecart", text: fEcart(time - record), better: time <= record };
}
