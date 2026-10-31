import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "@cdj/ui/src/polices/lilita-one-400.css";
import "./portail.css";
import { parisDay } from "@cdj/clock";
import { formatDay, parseDay } from "@cdj/core";
import { ecrireLangue, lireLangue, readPlayerId, type Langue } from "@cdj/profile";
import { CATALOGUE_COMMUN, barreJeu, cheminMentions, bouton, choixLangue, el, formatDateCourte, formatNombre, formatTemps, medaille, traducteur, type TypeMedaille } from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { lireClassement, type Classement, type LectureClassement, type LigneClassement, type ResultatClassement } from "./classementDonnees";
import { VUE_CUMUL, aSeparation, adresseDeVue, ongletVoisin, onglets, vueDeLAdresse } from "./classementVues";
import { PREMIER_JOUR_DU_JOUR, numeroDeJournee } from "./jours";
import { stockageDuPortail } from "./stockage";
import { activerManette } from "@cdj/ui/src/manetteLien";

// Lot M1 : cette page se pilote à la manette (son action principale : une ligne de `manette.ts`, chargée avec le menu).
activerManette(() => import("./manette").then((m) => m.pour("classement")));

// Lot I3, refait au lot A1 : le classement du jour **au chrono** (`/classement/`), ouvert par la tuile « Classement du jour » du portail. Trois vues en onglets —
// Cumulé (par défaut), Track, Jump — gardées dans l'adresse (`?vue=`) ; le haut du classement (50), **ta ligne surlignée même hors du haut**, le temps de la vue
// (cumulé ou d'un jeu) et, en petit, le temps et la médaille de chaque jeu (pastilles de `@cdj/ui`, le nom toujours dit : la couleur seule ne porte rien) ;
// au cumul, la séparation « Un jeu sur deux » avant ceux qui n'ont fini qu'un jeu. Le choix d'un jour passé (« ‹ Veille », « Lendemain › », jamais au-delà
// d'aujourd'hui). Une requête par jour et par vue affichés (`GET /api/portail/classement?date=&vue=`) ; l'identifiant part en `X-Player-Id` s'il existe.
// Le jour et la vue affichés sont dans l'adresse (`?date=AAAA-MM-JJ`, `?vue=track`).

const stockage = stockageDuPortail();
let langue: Langue = lireLangue(stockage, navigator.languages).langue;
const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_COMMUN);
type T = ReturnType<typeof traduire>;
type Cle = Parameters<T["t"]>[0];
const cleConnue = (cle: string): Cle | null => (cle in CATALOGUE_PORTAIL.fr || cle in CATALOGUE_COMMUN.fr ? (cle as Cle) : null);

const MEDAILLE: Record<string, TypeMedaille> = { author: "diamant", gold: "or", silver: "argent", bronze: "bronze" };
/** Les jeux que la page sait habiller (leur code au registre du serveur) ; un autre jeu garde le nom que le serveur déclare. */
const JEUX = { cdj: { cle: "jeu.track.nom", cadre: "track" }, jump: { cle: "jeu.jump.nom", cadre: "jump" } } as const;

/** Le jour affiché (`AAAA-MM-JJ`, `null` : aujourd'hui, celui du serveur) et aujourd'hui tel que le serveur l'a dit (ou l'horloge locale). */
let jourAffiche: string | null = new URLSearchParams(location.search).get("date");
/** La vue affichée : `cumul` ou le dossier d'un jeu (`track`, `jump`). */
let vueAffichee: string = vueDeLAdresse(location.search);
let aujourdhui: string = formatDay(parisDay(Date.now()));
let lecture: LectureClassement | null = null;

const nomDuJeu = (t: T, jeu: { jeu: string; nom: string }): string => (jeu.jeu in JEUX ? t.t(JEUX[jeu.jeu as keyof typeof JEUX].cle) : jeu.nom);

/**
 * La case d'un jeu pour un joueur : son nom, son temps (au cumul seulement : dans la vue d'un jeu, c'est le temps de la ligne), puis la médaille (pastille et
 * nom), « Fini » sans médaille, ou « — » (pas fini : le texte masqué le dit aux lecteurs d'écran).
 */
function caseDeJeu(t: T, jeu: { jeu: string; nom: string }, r: ResultatClassement | null, avecTemps: boolean): HTMLElement {
  const cadre = jeu.jeu in JEUX ? JEUX[jeu.jeu as keyof typeof JEUX].cadre : undefined;
  let contenu: HTMLElement;
  if (r === null) contenu = el("span", { classe: "classement-jeu__vide" }, el("span", { attrs: { "aria-hidden": "true" }, texte: "—" }), el("span", { classe: "dj-cache", texte: t.t("classement.pasFini") }));
  else if (r.medaille) contenu = medaille(t, { type: MEDAILLE[r.medaille]!, obtenue: true, jeu: cadre });
  else contenu = el("span", { classe: "classement-jeu__fini", texte: t.t("portail.statut.fini") });
  return el(
    "span",
    { classe: "classement-jeu", attrs: { "data-jeu": jeu.jeu } },
    el("span", { classe: "classement-jeu__nom", texte: nomDuJeu(t, jeu) }),
    avecTemps && r !== null ? el("span", { classe: "classement-jeu__temps", texte: formatTemps(r.tempsMs, langue) }) : null,
    contenu,
  );
}

/** Une ligne : la place, le pseudo, le temps de la vue (« — » au cumul d'un joueur qui n'a pas tout fini) ; dessous le résultat de chaque jeu. */
function ligne(t: T, c: Classement, l: LigneClassement, moi: boolean): HTMLElement {
  const cumul = c.vue === VUE_CUMUL;
  const jeux = cumul ? c.jeux : c.jeux.filter((j) => j.site === c.vue);
  return el(
    "li",
    { classe: ["classement-ligne", moi && "classement-ligne--moi"], attrs: { "data-rang": String(l.rang), ...(moi ? { "data-moi": "oui", "aria-current": "true" } : {}) } },
    el(
      "div",
      { classe: "classement-ligne__tete" },
      el("span", { classe: "classement-rang", texte: formatNombre(l.rang, langue) }),
      el("span", { classe: "classement-pseudo" }, l.pseudo, moi ? el("span", { classe: "classement-toi", texte: t.t("classement.toi") }) : null),
      l.tempsMs === null
        ? el("span", { classe: "classement-temps" }, el("span", { attrs: { "aria-hidden": "true" }, texte: "—" }), el("span", { classe: "dj-cache", texte: t.t("classement.pasFini") }))
        : el("span", { classe: "classement-temps", texte: formatTemps(l.tempsMs, langue) }),
    ),
    el("div", { classe: "classement-ligne__jeux" }, ...jeux.map((j) => caseDeJeu(t, j, l.resultats[j.jeu] ?? null, cumul))),
  );
}

/** Le nom d'un jeu du jour dans l'onglet (le catalogue pour les jeux connus). */
const nomOnglet = (t: T, o: { jeu?: string; nom?: string }): string => (o.jeu ? nomDuJeu(t, { jeu: o.jeu, nom: o.nom ?? o.jeu }) : t.t("classement.vue.cumul"));

/**
 * Les onglets (rôle `tablist`, un seul dans l'ordre de tabulation, flèches pour passer de l'un à l'autre) : Cumulé, puis un jeu par jeu du jour. Avant la
 * réponse du serveur : Cumulé, Track, Jump (les jeux que la page sait habiller).
 */
function barreDesVues(t: T, c: Classement | null): HTMLElement {
  const liste = c ? onglets(c.jeux) : onglets(Object.entries(JEUX).map(([jeu, j]) => ({ jeu, site: j.cadre, nom: jeu })));
  const actif = liste.some((o) => o.vue === vueAffichee) ? vueAffichee : VUE_CUMUL;
  const barre = el("div", { classe: "classement-vues", attrs: { role: "tablist", "aria-label": t.t("classement.vues.aria") } });
  const boutons = liste.map((o) => {
    const b = bouton({ texte: nomOnglet(t, o), variante: o.vue === actif ? "marque" : "secondaire", onClick: () => changerVue(o.vue) });
    b.setAttribute("role", "tab");
    b.setAttribute("id", `vue-${o.vue}`);
    b.setAttribute("aria-selected", String(o.vue === actif));
    b.setAttribute("aria-controls", "classement-panneau");
    b.setAttribute("tabindex", o.vue === actif ? "0" : "-1");
    b.setAttribute("data-cle", `vue-${o.vue}`);
    b.addEventListener("keydown", (e) => {
      const suivant = ongletVoisin(boutons.indexOf(b), boutons.length, (e as KeyboardEvent).key);
      if (suivant === null) return;
      e.preventDefault();
      changerVue(liste[suivant]!.vue);
    });
    return b;
  });
  barre.append(...boutons);
  return barre;
}

/** La vue réellement affichée : celle de l'adresse si le jour a ce jeu, sinon le cumul. */
const vueActive = (c: Classement | null): string => (c && !onglets(c.jeux).some((o) => o.vue === vueAffichee) ? VUE_CUMUL : vueAffichee);

/**
 * Le haut du classement. Au cumul, les joueurs qui n'ont pas tout fini viennent sous un titre « Un jeu sur deux » : deux listes numérotées qui se
 * suivent (une liste ne contient que des éléments de liste).
 */
function listeDuHaut(t: T, c: Classement): HTMLElement {
  const coupe = aSeparation(c);
  const lignes = c.top.map((l) => ligne(t, c, l, l.moi === true));
  if (coupe === null) return el("div", { attrs: { id: "classement-liste" } }, el("ol", { classe: "classement-liste" }, ...lignes));
  return el(
    "div",
    { attrs: { id: "classement-liste" } },
    coupe > 0 ? el("ol", { classe: "classement-liste" }, ...lignes.slice(0, coupe)) : null,
    el("h2", { classe: "classement-separation", attrs: { id: "classement-separation" }, texte: t.t("classement.separation") }),
    el("ol", { classe: "classement-liste", attrs: { start: String(c.top[coupe]!.rang) } }, ...lignes.slice(coupe)),
  );
}

/** Le jour d'avant / d'après ; `null` hors des bornes (avant la journée n° 1 — lot R8 : les archives commencent au lancement —, après aujourd'hui). */
export function voisin(date: string, sens: -1 | 1, today: string): string | null {
  const d = parseDay(date);
  const max = parseDay(today);
  if (d === null || max === null) return null;
  const v = d + sens;
  return v < PREMIER_JOUR_DU_JOUR || v > max ? null : formatDay(v);
}

function rendre(): void {
  const racine = document.getElementById("classement");
  if (!racine) return;
  const t = traduire(langue);
  const focus = (document.activeElement as HTMLElement | null)?.getAttribute("data-cle");
  document.documentElement.lang = langue;
  document.title = t.t("classement.titre");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t.t("classement.description"));
  const c = lecture?.classement ?? null;
  const date = c?.date ?? jourAffiche ?? aujourdhui;
  const day = parseDay(date) ?? parisDay(Date.now());
  const veille = voisin(date, -1, aujourdhui);
  const lendemain = voisin(date, 1, aujourdhui);

  let etat: string | null = null;
  if (!lecture) etat = t.t("classement.chargement");
  else if (lecture.erreur && !c) etat = lecture.erreur === "delai" ? t.t("portail.delai") : t.t(cleConnue(`erreur.${lecture.erreur}`) ?? "portail.horsLigne");

  const navigation = el(
    "nav",
    { classe: "classement-jours", attrs: { "aria-label": t.t("classement.titre") } },
    bouton({ texte: t.t("classement.veille"), variante: "secondaire", desactive: !veille, ariaLabel: t.t("classement.veille.aria"), onClick: () => veille && aller(veille) }),
    el("span", { classe: "classement-jours__date", attrs: { id: "classement-date" }, texte: formatDateCourte(day, langue, { capitale: true }) }),
    bouton({ texte: t.t("classement.lendemain"), variante: "secondaire", desactive: !lendemain, ariaLabel: t.t("classement.lendemain.aria"), onClick: () => lendemain && aller(lendemain) }),
  );
  navigation.querySelectorAll("button").forEach((b, i) => {
    b.setAttribute("data-cle", i === 0 ? "veille" : "lendemain");
    b.id = i === 0 ? "veille" : "lendemain";
  });

  const topMoi = c?.top.some((l) => l.moi) ?? false;
  const pasDeLigne = !!c && c.moi === null && c.ouvert; // identifié, mais aucun jeu fini aujourd'hui
  const enfants: (HTMLElement | null)[] = [
    barreJeu(t, { href: "../", jour: day, numero: numeroDeJournee(day) ?? undefined }),
    el("h1", { classe: "classement-titre", texte: t.t("classement.titre") }),
    navigation,
    barreDesVues(t, c),
    etat ? el("p", { classe: "classement-etat", attrs: { id: "classement-etat", role: "status" }, texte: etat }) : null,
    c ? el("p", { classe: "classement-egalite", texte: t.t("classement.egalite") }) : null,
    c
      ? el(
          "p",
          { classe: "classement-compte", attrs: { id: "classement-compte" } },
          t.t("classement.classes", { n: c.classes }),
          c.ouvert ? null : el("span", { classe: "classement-ferme", texte: ` · ${t.t("classement.ferme")}` }),
        )
      : null,
    c && c.top.length === 0 ? el("p", { classe: "classement-vide", attrs: { id: "classement-vide" }, texte: t.t("classement.vide") }) : null,
    // Le panneau de la vue : le haut (au cumul, scindé par « Un jeu sur deux »), puis ta ligne, même hors du haut (séparée par « … », à sa vraie place).
    el(
      "div",
      { classe: "classement-panneau", attrs: { id: "classement-panneau", role: "tabpanel", "aria-labelledby": `vue-${vueActive(c)}` } },
      c && c.top.length > 0 ? listeDuHaut(t, c) : null,
      c?.moi && !topMoi
        ? el(
            "div",
            { classe: "classement-hors-haut", attrs: { id: "classement-moi" } },
            el("p", { classe: "classement-coupure", attrs: { "aria-hidden": "true" }, texte: "…" }),
            el("ol", { classe: "classement-liste", attrs: { start: String(c.moi.rang) } }, ligne(t, c, c.moi, true)),
          )
        : null,
      pasDeLigne ? el("p", { classe: "classement-invite", attrs: { id: "classement-invite" }, texte: t.t("classement.invite") }) : null,
    ),
    el("section", { classe: "profil-section", attrs: { "aria-labelledby": "titre-langue" } }, el("h2", { classe: "profil-section__titre", attrs: { id: "titre-langue" }, texte: t.t("profil.langue.titre") }), choixLangue(t, { langue, onChange: changerLangue })),
    el(
      "footer",
      { classe: "portail-pied" },
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: cheminMentions(langue, "../"), hreflang: langue }, texte: t.t("portail.mentions") }),
    ),
  ];
  racine.replaceChildren(...enfants.filter((e): e is HTMLElement => e !== null));
  if (focus) racine.querySelector<HTMLElement>(`[data-cle="${focus}"]`)?.focus();
}

/** Lit un jour dans une vue (une requête) et l'affiche ; l'adresse garde le jour et la vue affichés. */
async function charger(date: string | null): Promise<void> {
  jourAffiche = date;
  const vue = vueAffichee;
  const id = stockage ? readPlayerId(stockage) : null;
  let l = await lireClassement(fetch.bind(globalThis), id, date, vue);
  // Une vue qui n'existe pas ce jour-là (un lien `?vue=jump` vers un jour d'avant Jump) : le cumul.
  if (l.erreur === "invalid_view" && vue !== VUE_CUMUL) {
    vueAffichee = VUE_CUMUL;
    l = await lireClassement(fetch.bind(globalThis), id, date, VUE_CUMUL);
  }
  if (jourAffiche !== date || (vueAffichee !== vue && vueAffichee !== VUE_CUMUL)) return; // un autre jour ou une autre vue a été demandé entre-temps
  lecture = l;
  // Aujourd'hui, tel que le serveur l'a dit (une lecture sans date).
  if (date === null && l.classement) aujourdhui = l.classement.date;
  try {
    const adresse = adresseDeVue(location.href, { date: date === null || date === aujourdhui ? null : date, vue: vueAffichee });
    history.replaceState(null, "", adresse);
  } catch {
    /* l'adresse reste telle quelle */
  }
  rendre();
}

function aller(date: string): void {
  lecture = null;
  rendre();
  void charger(date === aujourdhui ? null : date);
}

/** Change de vue (onglet) : le focus reste sur l'onglet choisi, le classement de la vue est relu. */
function changerVue(vue: string): void {
  if (vue === vueAffichee) return;
  vueAffichee = vue;
  lecture = null;
  rendre();
  document.getElementById(`vue-${vue}`)?.focus();
  void charger(jourAffiche);
}

function changerLangue(l: Langue): void {
  langue = l;
  ecrireLangue(stockage, l);
  rendre();
  document.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus();
}

rendre();
void charger(jourAffiche);
