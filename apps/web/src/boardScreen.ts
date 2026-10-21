// Le classement du jour en pleine page (lot I4, maquette track-palmares.html) : un sous-écran posé sur la scène (lot I4b ; retour « ‹ TRACK »), puis l'étiquette Track avec
// « CLASSEMENT », le thème et le nombre de classés, et les lignes (le haut du classement, ta ligne en moutarde même hors du haut après « … »). Ouvert depuis
// l'accueil (« Tout le classement ») ; la section de l'accueil, elle, n'en montre que cinq lignes. Le DOM seulement : les données viennent de `BoardScreenHost`.
import type { ApiResult, Leaderboard } from "./api";
import { boardTitle, dayLines, linesEls } from "./boardView";
import { creerCadre } from "./cadre";
import { button, el } from "./dom";
import { messageErreur, nomTheme, onLangue, t } from "./i18n";

export interface BoardScreenHost {
  /** Le thème (code) et la date du circuit du jour. */
  daily: { theme: string; date: string };
  /** Le classement du jour (`limit` lignes) ; `null` sans serveur. */
  leaderboard: ((limit: number) => Promise<ApiResult<Leaderboard>>) | null;
  noBoardReason: "sans_serveur" | "hors_ligne";
  watchBest(): void;
}

export interface BoardScreen {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

/** Lignes demandées au serveur pour la page (le maximum qu'il donne). */
export const BOARD_SCREEN_ROWS = 50;

export function mountBoardScreen(host: BoardScreenHost): BoardScreen {
  let open = false;
  let generation = 0;
  let state: { kind: "charge" } | { kind: "sans_serveur" } | { kind: "hors_ligne" } | { kind: "erreur"; code: string } | { kind: "vide" } | { kind: "ok"; lb: Leaderboard } = { kind: "charge" };
  const cadre = creerCadre({ id: "board-screen", titreAria: "palmares.ecran.aria", retour: "jeu", onRetour: () => api.close(), haut: true });
  cadre.racine.hidden = true;
  cadre.racine.classList.add("classement-page");
  document.body.append(cadre.racine);

  const titre = el("h1", "etiquette__titre");
  const sousTitre = el("p", "etiquette__sous-titre");
  const tete = el("div", "etiquette__tete");
  tete.append(titre, sousTitre);
  const corps = el("div", "classement-page__corps");
  const revoir = button("", "", () => host.watchBest());
  revoir.id = "board-screen-watch";
  revoir.hidden = true;
  cadre.corps.append(tete, corps, revoir);

  function render() {
    titre.textContent = t("palmares.titre");
    revoir.textContent = t("palmares.revoir");
    revoir.hidden = true;
    sousTitre.textContent = "";
    const s = state;
    if (s.kind === "charge") return corps.replaceChildren(el("p", "empty note", t("palmares.charge")));
    if (s.kind === "sans_serveur" || s.kind === "hors_ligne") return corps.replaceChildren(el("p", "empty note", t(s.kind === "sans_serveur" ? "palmares.sansServeur" : "palmares.horsLigne")));
    if (s.kind === "erreur") {
      const retry = button(t("commun.reessayer"), "link", () => void load(generation));
      return corps.replaceChildren(el("p", "empty note note--erreur error", t("palmares.erreur", { erreur: messageErreur(s.code) })), retry);
    }
    if (s.kind === "vide") return corps.replaceChildren(el("p", "empty note", t("palmares.vide")));
    const lb = s.lb;
    const live = lb.date === host.daily.date;
    sousTitre.textContent = live ? t("palmares.sousTitre", { theme: nomTheme(host.daily.theme), n: lb.participants }) : boardTitle(lb, false);
    const list = el("div", "rows lignes");
    list.append(...linesEls(dayLines(lb)));
    corps.replaceChildren(list);
    revoir.hidden = !live;
  }

  async function load(gen: number) {
    if (!host.leaderboard) {
      state = { kind: host.noBoardReason };
      return render();
    }
    state = { kind: "charge" };
    render();
    const r = await host.leaderboard(BOARD_SCREEN_ROWS);
    if (gen !== generation) return;
    state = !r.ok ? { kind: "erreur", code: r.code } : r.data.participants === 0 ? { kind: "vide" } : { kind: "ok", lb: r.data };
    render();
  }

  onLangue(() => open && render());
  render();

  const api: BoardScreen = {
    open() {
      open = true;
      generation++;
      cadre.racine.hidden = false;
      cadre.corps.scrollTop = 0;
      void load(generation);
    },
    close() {
      open = false;
      generation++;
      cadre.racine.hidden = true;
    },
    isOpen: () => open,
  };
  return api;
}
