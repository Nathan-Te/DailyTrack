import { isValidName, normalizeName, type RenameResult } from "@cdj/profile";
import { creerCadre, type Cadre } from "./cadre";
import { button, el } from "./dom";
import { fEcart, fRang, fTemps, messageErreur, t } from "./i18n";
import type { ApiResult } from "./api";
import type { SalonSubmitResult } from "./salonApi";

// L'arrivée d'une course du Salon, la fin de session qui coupe une course, et l'arrivée de « Revoir le meilleur tour » (lots 26, 27b ; charte au lot I4) :
// le cadre posé sur la scène (lot I4b) et l'étiquette Track (`cadre.ts`), dans `#finish`. Le DOM et les textes sont ici ; les décisions (record de session, envoi, pseudo, partage)
// restent à `main.ts`, qui passe ses fonctions. Les identifiants et classes que visent les tests restent : `.big` (le temps), `.rank`, `.share`, `.actions`,
// `.restart` (désactivé pendant la finale), `#finish-watch`, `#watch-replay`, `#watch-race`.

const cadres = new WeakMap<HTMLElement, Cadre>();

/**
 * Le cadre de `#finish` (créé une fois, vidé à chaque arrivée) : la barre des jeux (« ‹ DU JOUR ») et l'étiquette asphalte dont `corps` reçoit le contenu.
 * Le Salon et le circuit du jour partagent ce cadre : `main.ts` peut s'en servir pour l'arrivée du jour.
 */
export function arrivalFrame(racine: HTMLElement): Cadre {
  let c = cadres.get(racine);
  if (!c) {
    c = creerCadre({ racine, titreAria: "salon.arrivee.titre", retour: "portail" });
    cadres.set(racine, c);
  }
  c.corps.className = "etiquette__corps";
  c.corps.replaceChildren();
  c.pied.replaceChildren();
  c.corps.scrollTop = 0;
  return c;
}

function entete(titre: string, sousTitre: string): HTMLElement {
  const tete = el("div", "etiquette__tete");
  tete.append(el("h1", "etiquette__titre", titre), el("p", "etiquette__sous-titre", sousTitre));
  return tete;
}

/** L'arrivée d'un tour regardé, ou d'une course : le temps en grand. */
function grandTemps(ms: number): HTMLElement {
  return el("div", "big temps", fTemps(ms));
}

export interface SalonArrivalParams {
  /** `#finish`. */
  racine: HTMLElement;
  /** « 14:20 · Col alpin » : le sous-titre (heure de la session et thème, déjà traduits). */
  sousTitre: string;
  ms: number;
  respawns: number;
  /** Réglages modifiés ou démonstration du pilote : jamais classé. */
  counted: boolean;
  /** Meilleur tour de la session. */
  improved: boolean;
  /** Ton meilleur tour d'avant, si celui-ci ne l'améliore pas. */
  prior: number | null;
  /** La ligne à partager (null tant que la place n'est pas connue ou qu'il n'y a pas de tour). */
  shareLine: () => string | null;
  myRank: () => { rank: number; participants: number } | null;
  canSubmit: () => boolean;
  /** Envoie la course ; le serveur répond avec SON temps et ta place. */
  submit: (name: string) => Promise<ApiResult<SalonSubmitResult>>;
  getName: () => string | null;
  /** Le pseudo choisi : le serveur dit s'il est libre (réservé à son premier propriétaire). */
  rename: (name: string) => Promise<RenameResult>;
  /** Pas de profil dans le jeu : « Charger un code » mène au profil commun du portail. */
  openLoadCode: () => void;
  onReplay: () => void;
  onWatch: () => void;
  onShare: (b: HTMLButtonElement) => void | Promise<void>;
  onHome: () => void;
}

/** Salon (lot 26) : l'arrivée d'une course de session. Ni record local, ni classement du jour : seulement la session. */
export function showSalonArrival(p: SalonArrivalParams): void {
  const { corps } = arrivalFrame(p.racine);
  corps.classList.add("salon-arrivee");
  const rows: [string, string][] = [
    !p.counted ? ["record", t("salon.arrivee.nonClassee")] : p.improved ? ["record", t("salon.arrivee.meilleur")] : ["", p.prior !== null ? t("salon.arrivee.precedent", { temps: fTemps(p.prior), ecart: fEcart(p.ms - p.prior) }) : ""],
    ["", p.respawns > 0 ? t("salon.arrivee.reprises", { n: p.respawns }) : t("salon.arrivee.sansReprise")],
  ];
  const resultat = el("div", "salon-arrivee__resultat");
  resultat.append(grandTemps(p.ms));
  for (const [cls, texte] of rows) if (texte) resultat.append(el("div", `salon-arrivee__ligne ${cls}`.trim(), texte));

  const box = el("div", "online");
  const share = el("p", "share chiffres");
  const refreshShare = () => {
    const line = p.shareLine();
    share.textContent = line ?? "";
    share.hidden = !line;
  };
  const text = (msg: string, cls = "") => el("div", cls, msg);
  const rankValue = (r: { rank: number; participants: number }, extra = "") => {
    const line = el("div", "rank");
    line.append(el("span", "legende", t("salon.arrivee.rangLegende")), el("strong", "salon-arrivee__rang", t("salon.arrivee.rang", { rang: fRang(r.rank), total: r.participants })));
    if (extra) line.append(el("span", "note", extra));
    return line;
  };
  const rankLine = () => {
    const r = p.myRank();
    refreshShare();
    box.replaceChildren(...(r ? [rankValue(r)] : []));
  };
  const send = async (): Promise<void> => {
    const name = p.getName();
    if (!name) return nameForm();
    box.replaceChildren(text(t("salon.arrivee.envoi"), "status note"));
    const r = await p.submit(name);
    if (r.ok) {
      refreshShare();
      box.replaceChildren(rankValue({ rank: r.data.rank, participants: r.data.participants }, r.data.ms !== p.ms ? t("salon.arrivee.tempsServeur", { temps: fTemps(r.data.ms) }) : ""));
      return;
    }
    if (r.code === "name_taken") return nameForm({ code: r.code, suggestions: r.suggestions });
    if (r.code === "code_revoked") return box.replaceChildren(text(messageErreur(r.code), "error note--erreur"), button(t("salon.arrivee.chargerCode"), "link", () => p.openLoadCode()));
    box.replaceChildren(text(messageErreur(r.code), "error note--erreur"), ...(p.canSubmit() ? [button(t("commun.reessayer"), "link", () => void send())] : []));
  };
  const nameForm = (problem?: { code: string; suggestions?: string[] }): void => {
    const form = el("form", "salon-arrivee__pseudo");
    const input = el("input", "champ");
    input.type = "text";
    input.maxLength = 20;
    input.placeholder = t("salon.arrivee.pseudoChamp");
    input.setAttribute("aria-label", t("salon.arrivee.pseudoChamp"));
    input.autocomplete = "off";
    input.value = p.getName() ?? "";
    const ok = button(t("commun.valider"), "primary");
    ok.type = "submit";
    const error = text("", "error note--erreur");
    const extras = el("div", "suggestions");
    /** Pseudo refusé : l'explication, des pseudos libres à toucher, et « Charger un code » (le pseudo est peut-être le tien, sur un autre appareil). */
    const showProblem = (message: string, suggestions: readonly string[] = [], offerLoad = false) => {
      error.textContent = message;
      extras.replaceChildren(
        ...suggestions.map((s) =>
          button(s, "link", () => {
            input.value = s;
            form.requestSubmit();
          }),
        ),
        ...(offerLoad ? [button(t("salon.arrivee.chargerCode"), "link", () => p.openLoadCode())] : []),
      );
    };
    form.append(el("label", "legende", t("salon.arrivee.pseudo")), input, ok, error, extras);
    if (problem) showProblem(messageErreur(problem.code), problem.suggestions, true);
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const name = normalizeName(input.value);
      showProblem("");
      if (!isValidName(name)) {
        error.textContent = t("salon.arrivee.pseudoInvalide");
        return;
      }
      ok.disabled = true;
      const renamed = await p.rename(name);
      if (!renamed.ok) {
        ok.disabled = false;
        showProblem(messageErreur(renamed.code), renamed.suggestions, renamed.code === "name_taken");
        return;
      }
      void send();
    });
    box.replaceChildren(form);
    input.focus();
  };

  const actions = el("div", "actions actions--colonne");
  actions.append(button(t("salon.arrivee.rejouer"), "primary restart", () => p.onReplay()));
  const duo = el("div", "actions--duo");
  const watch = button(t("salon.arrivee.revoir"), "", () => p.onWatch());
  watch.id = "finish-watch";
  duo.append(watch, button(t("salon.arrivee.partager"), "", (b) => p.onShare(b)));
  actions.append(duo, button(t("salon.arrivee.accueil"), "", () => p.onHome()));
  // Deux colonnes en paysage (le résultat, puis les actions), une seule en portrait.
  const gauche = el("div", "salon-arrivee__gauche");
  gauche.append(resultat, ...(p.counted ? [box] : []), share);
  const droite = el("div", "salon-arrivee__droite");
  droite.append(actions, el("p", "hint note", t("salon.arrivee.aide")));
  corps.append(entete(t("salon.arrivee.titre"), p.sousTitre), gauche, droite);
  p.racine.hidden = false;
  refreshShare();
  // Envoi : seulement un meilleur tour de la session (le serveur garde le meilleur), et tant que la session accepte des envois.
  if (p.counted && p.improved) {
    if (!p.canSubmit()) box.replaceChildren(text(t("salon.arrivee.tropTard"), "error note--erreur"));
    else void send();
  } else if (p.counted) rankLine();
}

/** À l'heure pile, la course en cours est coupée pour tout le monde : un message à la place de l'arrivée (rien n'est envoyé). */
export function showSessionOver(racine: HTMLElement): void {
  const { corps } = arrivalFrame(racine);
  corps.append(entete(t("salon.arrivee.terminee"), t("salon.arrivee.nonCompte")));
  racine.hidden = false;
}

export interface WatchArrivalParams {
  racine: HTMLElement;
  /** « Rediffusion de Alice — 31,456 s » (`watchTitle`). */
  titre: string;
  /** Le temps recalculé par la simulation. */
  ms: number;
  onReplay: () => void;
  onRace: () => void;
}

/** Fin de la rediffusion (lot 27b) : le temps recalculé par la simulation, puis rejouer ou courir contre ce fantôme. */
export function showWatchArrival(p: WatchArrivalParams): void {
  const { corps } = arrivalFrame(p.racine);
  const actions = el("div", "actions actions--colonne");
  const replay = button(t("revoir.arrivee.rejouer"), "primary", () => p.onReplay());
  replay.id = "watch-replay";
  const race = button(t("revoir.arrivee.courir"), "", () => p.onRace());
  race.id = "watch-race";
  actions.append(replay, race);
  const resultat = el("div", "salon-arrivee__resultat");
  resultat.append(grandTemps(p.ms), el("div", "salon-arrivee__ligne", p.titre));
  corps.classList.add("salon-arrivee");
  const gauche = el("div", "salon-arrivee__gauche");
  gauche.append(resultat);
  const droite = el("div", "salon-arrivee__droite");
  droite.append(actions, el("p", "hint note", t("revoir.arrivee.aide")));
  corps.append(entete(t("revoir.arrivee.titre"), t("revoir.arrivee.temps")), gauche, droite);
  p.racine.hidden = false;
}
