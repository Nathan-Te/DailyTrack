import type { Medal } from "@cdj/sim";
import { bouton, el, nomMedaille, type TypeMedaille } from "@cdj/ui";
import { creerCadre, type Cadre } from "./cadre";
import { fEcart, fTemps, t, traducteurDuSocle } from "./i18n";

// L'écran d'arrivée (lot I4, maquette track-arrivee.html) : le cadre crème de Du Jour avec, dedans, l'étiquette Track — « ARRIVÉE », le temps en grand,
// le badge de record et l'écart, l'autocollant de médaille, le rang au classement du jour, les actions — puis, sous l'étiquette, « Jeu suivant du jour ».
// Le DOM seulement : main.ts calcule (médaille, record, envoi au classement) et remplit les zones. Les classes d'avant (`big`, `medal`, `record`, `online`,
// `rank`, `share`, `actions`, `restart`, `#finish-next`) sont gardées : les tests et les outils les visent encore.

const MEDAILLE_TYPE: Record<Medal, TypeMedaille> = { author: "auteur", gold: "or", silver: "argent", bronze: "bronze" };
export const typeDeMedaille = (m: Medal): TypeMedaille => MEDAILLE_TYPE[m];

export interface ZonesArrivee {
  cadre: Cadre;
  /** Le temps et ce qui le qualifie (record, écart) : rempli par `resultat()`. */
  resultat: HTMLElement;
  /** L'autocollant de médaille : rempli par `medaille()`. */
  medaille: HTMLElement;
  /** Le rang au classement du jour, l'envoi et le pseudo (`startOnlineFlow`). */
  classement: HTMLElement;
  /** La ligne à partager. */
  partage: HTMLElement;
  /** Les actions : Recourir, Revoir, Partager, Accueil. */
  actions: HTMLElement;
  /** Sous l'étiquette : « Jeu suivant du jour » (lot I3), rempli quand le classement est connu. */
  suite: HTMLElement;
  /** Une indication de touche (« Entrée : rejouer »). */
  indice: HTMLElement;
}

export interface Arrivee {
  /** Efface les zones et montre l'écran. */
  ouvrir(o: { sousTitre: string }): ZonesArrivee;
  fermer(): void;
  estOuverte(): boolean;
  zones(): ZonesArrivee;
}

/** Sépare « 31,402 s » en nombre et unité : l'unité s'écrit plus petit, en gris (maquette). */
export function tempsEnGrand(ms: number, classe = "big"): HTMLElement {
  const texte = fTemps(ms);
  const m = /^(.*?)( s)$/.exec(texte);
  const e = el("div", { classe: [classe, "temps", "arrivee__temps"] });
  if (m) e.append(m[1]!, el("span", { classe: "arrivee__unite", texte: m[2]! }));
  else e.textContent = texte;
  return e;
}

/** Un badge (« NOUVEAU RECORD ») et, à côté, un écart signé. `ton` : vert (record) ou neutre. */
export function badgeEtEcart(o: { badge?: string; ton?: "ok" | "neutre" | "livree"; ecartMs?: number | null; texte?: string }): HTMLElement {
  const ligne = el("div", { classe: ["record", "arrivee__badges"] });
  if (o.badge) ligne.append(el("span", { classe: ["arrivee__badge", o.ton === "ok" && "arrivee__badge--ok"], texte: o.badge }));
  if (o.ecartMs !== undefined && o.ecartMs !== null) ligne.append(el("span", { classe: ["arrivee__ecart", o.ecartMs <= 0 ? "arrivee__ecart--devant" : "arrivee__ecart--derriere"], texte: fEcart(o.ecartMs) }));
  if (o.texte) ligne.append(el("span", { classe: "arrivee__note", texte: o.texte }));
  return ligne;
}

/**
 * L'autocollant de médaille (maquette) : un bandeau légèrement incliné, la médaille obtenue à gauche (pastille et nom), à droite l'écart à l'auteur ; sans
 * médaille, un encadré pointillé qui dit ce qu'il manque pour le bronze. Le nom de la médaille est toujours écrit.
 */
export function autocollantMedaille(o: { medal: Medal | null; bronzeMs: number; authorMs: number; ms: number }): HTMLElement {
  const sdc = traducteurDuSocle();
  if (!o.medal) {
    return el("div", { classe: ["medal", "arrivee__medaille", "arrivee__medaille--aucune"] }, el("span", { classe: "arrivee__medaille-texte", texte: t("arrivee.sansMedaille", { temps: fTemps(o.bronzeMs) }) }));
  }
  const type = MEDAILLE_TYPE[o.medal];
  const nom = o.medal === "author" ? t("arrivee.medaille.auteur") : t("arrivee.medaille", { medaille: nomMedaille(sdc, type) });
  const gauche = el("div", { classe: ["arrivee__medaille-nom", `arrivee__medaille-nom--${type}`] }, el("span", { classe: ["pastille", `pastille--${type}`], attrs: { "aria-hidden": "true" } }), el("span", { classe: "arrivee__medaille-texte", texte: nom }));
  const droite = o.medal === "author" ? null : el("div", { classe: "arrivee__auteur" }, el("span", { classe: "arrivee__auteur-legende", texte: t("arrivee.auteur") }), el("span", { classe: "chiffres arrivee__auteur-valeur", texte: t("arrivee.auteurA", { temps: fTemps(Math.max(0, o.ms - o.authorMs)).replace(/ s$/, "") }) }));
  return el("div", { classe: ["medal", "arrivee__medaille"] }, gauche, droite);
}

/** « Classement du jour | 14e sur 212 +9 places » : le rang connu, dans la zone du classement (`.rank` porte « 14e sur 212 » : les tests et les lecteurs d'écran le lisent d'un bloc). */
export function ligneRang(o: { rang: string; total: string; gain?: number }): HTMLElement {
  const ligne = el("div", { classe: "arrivee__rang" });
  ligne.append(
    el("span", { classe: "arrivee__rang-legende", texte: t("arrivee.classement") }),
    el(
      "span",
      { classe: "arrivee__rang-valeur" },
      el("span", { classe: "rank" }, el("span", { classe: "arrivee__rang-ordre", texte: o.rang }), " ", el("span", { classe: "arrivee__rang-total", texte: t("arrivee.sur", { total: o.total }) })),
      o.gain && o.gain > 0 ? el("span", { classe: "arrivee__rang-gain chiffres", texte: t("arrivee.places", { n: o.gain }) }) : null,
    ),
  );
  return ligne;
}

export function creerArrivee(racine: HTMLElement): Arrivee {
  const cadre = creerCadre({ racine, titreAria: "arrivee.titre", retour: "portail" });
  let zones: ZonesArrivee | null = null;
  let ouverte = false;
  return {
    ouvrir({ sousTitre: texte }) {
      // Tout est refait à chaque arrivée : l'arrivée du Salon et celle de la rediffusion partagent le même cadre (`#finish`) et le vident à leur façon.
      racine.querySelector(".arrivee__pied")?.remove();
      cadre.corps.className = "etiquette__corps arrivee";
      const titre = el("h1", { classe: "etiquette__titre", texte: t("arrivee.titre") });
      const sousTitre = el("span", { classe: "etiquette__sous-titre arrivee__circuit", texte });
      const resultat = el("div", { classe: "arrivee__resultat" });
      const medaille = el("div", { classe: "arrivee__bloc" });
      const classement = el("div", { classe: ["online", "arrivee__bloc", "arrivee__classement"] });
      const partage = el("div", { classe: ["share", "arrivee__partage"] });
      const actions = el("div", { classe: ["actions", "arrivee__actions"] });
      const indice = el("div", { classe: ["hint", "note", "arrivee__indice"] });
      const suite = el("div", { classe: "next arrivee__suite", attrs: { id: "finish-next" } });
      suite.hidden = true;
      cadre.corps.replaceChildren(
        el("div", { classe: "etiquette__tete" }, titre, sousTitre),
        el("div", { classe: "arrivee__grille" }, el("div", { classe: "arrivee__colonne" }, resultat, medaille, classement, partage), el("div", { classe: "arrivee__colonne" }, actions, indice)),
      );
      racine.append(el("div", { classe: "arrivee__pied" }, suite));
      cadre.corps.scrollTop = 0;
      racine.hidden = false;
      ouverte = true;
      zones = { cadre, resultat, medaille, classement, partage, actions, suite, indice };
      return zones;
    },
    fermer() {
      racine.hidden = true;
      ouverte = false;
    },
    estOuverte: () => ouverte,
    zones: () => zones!,
  };
}

/** Un bouton d'action de l'arrivée (ids et classes d'avant gardés). `principal` : « Recourir » (livrée) ; sinon secondaire sur asphalte. */
export function actionArrivee(zones: ZonesArrivee, o: { texte: string; ariaLabel?: string; principal?: boolean; id?: string; classe?: string; onClick: (b: HTMLButtonElement) => void | Promise<void> }): HTMLButtonElement {
  const b = bouton({ texte: o.texte, variante: o.principal ? "track" : "secondaire", ariaLabel: o.ariaLabel, pleineLargeur: true }) as HTMLButtonElement;
  if (o.id) b.id = o.id;
  if (o.classe) b.classList.add(...o.classe.split(" "));
  b.addEventListener("click", async () => {
    b.blur(); // sinon la touche Entrée (rejouer) déclencherait aussi ce bouton
    await o.onClick(b);
  });
  if (!o.principal) b.classList.add("arrivee__secondaire");
  zones.actions.append(b);
  return b;
}
