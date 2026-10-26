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
import { CATALOGUE_COMMUN, barreJeu, cheminMentions, bouton, choixLangue, el, formatDateCourte, formatNombre, medaille, nomMedaille, traducteur, type TypeMedaille } from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { lireClassement, type Classement, type LectureClassement, type LigneClassement, type ResultatClassement } from "./classementDonnees";
import { PREMIER_JOUR_DU_JOUR, numeroDeJournee } from "./jours";
import { stockageDuPortail } from "./stockage";

// Lot I3 : le classement du jour tous jeux confondus (`/classement/`), ouvert par la tuile « Classement du jour » du portail. Le haut du classement (50), **ta ligne
// surlignée même hors du haut**, la médaille de chaque jeu par joueur (pastilles de `@cdj/ui`, le nom toujours dit : la couleur seule ne porte rien), le barème en une
// ligne (celui du serveur), et le choix d'un jour passé (« ‹ Veille », « Lendemain › », jamais au-delà d'aujourd'hui). Une requête par jour affiché
// (`GET /api/portail/classement?date=`) ; l'identifiant part en `X-Player-Id` s'il existe. Le jour affiché est dans l'adresse (`?date=AAAA-MM-JJ`).

const stockage = stockageDuPortail();
let langue: Langue = lireLangue(stockage, navigator.languages).langue;
const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_COMMUN);
type T = ReturnType<typeof traduire>;
type Cle = Parameters<T["t"]>[0];
const cleConnue = (cle: string): Cle | null => (cle in CATALOGUE_PORTAIL.fr || cle in CATALOGUE_COMMUN.fr ? (cle as Cle) : null);

const MEDAILLE: Record<string, TypeMedaille> = { author: "auteur", gold: "or", silver: "argent", bronze: "bronze" };
/** Les jeux que la page sait habiller (leur code au registre du serveur) ; un autre jeu garde le nom que le serveur déclare. */
const JEUX = { cdj: { cle: "jeu.track.nom", cadre: "track" }, jump: { cle: "jeu.jump.nom", cadre: "jump" } } as const;

/** Le jour affiché (`AAAA-MM-JJ`, `null` : aujourd'hui, celui du serveur) et aujourd'hui tel que le serveur l'a dit (ou l'horloge locale). */
let jourAffiche: string | null = new URLSearchParams(location.search).get("date");
let aujourdhui: string = formatDay(parisDay(Date.now()));
let lecture: LectureClassement | null = null;

const nomDuJeu = (t: T, jeu: { jeu: string; nom: string }): string => (jeu.jeu in JEUX ? t.t(JEUX[jeu.jeu as keyof typeof JEUX].cle) : jeu.nom);

/** La case d'un jeu pour un joueur : son nom, puis la médaille (pastille et nom), « Fini » sans médaille, ou « — » (pas fini). */
function caseDeJeu(t: T, jeu: { jeu: string; nom: string }, r: ResultatClassement | null): HTMLElement {
  const cadre = jeu.jeu in JEUX ? JEUX[jeu.jeu as keyof typeof JEUX].cadre : undefined;
  let contenu: HTMLElement;
  if (r === null) contenu = el("span", { classe: "classement-jeu__vide" }, el("span", { attrs: { "aria-hidden": "true" }, texte: "—" }), el("span", { classe: "dj-cache", texte: t.t("classement.pasFini") }));
  else if (r.medaille) contenu = medaille(t, { type: MEDAILLE[r.medaille]!, obtenue: true, jeu: cadre });
  else contenu = el("span", { classe: "classement-jeu__fini", texte: t.t("portail.statut.fini") });
  return el("span", { classe: "classement-jeu", attrs: { "data-jeu": jeu.jeu } }, el("span", { classe: "classement-jeu__nom", texte: nomDuJeu(t, jeu) }), contenu);
}

function ligne(t: T, c: Classement, l: LigneClassement, moi: boolean): HTMLElement {
  return el(
    "li",
    { classe: ["classement-ligne", moi && "classement-ligne--moi"], attrs: { "data-rang": String(l.rang), ...(moi ? { "data-moi": "oui", "aria-current": "true" } : {}) } },
    el(
      "div",
      { classe: "classement-ligne__tete" },
      el("span", { classe: "classement-rang", texte: formatNombre(l.rang, langue) }),
      el("span", { classe: "classement-pseudo" }, l.pseudo, moi ? el("span", { classe: "classement-toi", texte: t.t("classement.toi") }) : null),
      el("span", { classe: "classement-points", texte: t.t("classement.pts", { n: l.points }) }),
    ),
    el("div", { classe: "classement-ligne__jeux" }, ...c.jeux.map((j) => caseDeJeu(t, j, l.resultats[j.jeu] ?? null))),
  );
}

function bareme(t: T, c: Classement): string {
  const nom = (type: TypeMedaille) => nomMedaille(t, type).toLocaleLowerCase(langue);
  return t.t("classement.bareme", {
    auteur: nom("auteur"),
    pa: c.bareme.author,
    or: nom("or"),
    po: c.bareme.gold,
    argent: nom("argent"),
    pg: c.bareme.silver,
    bronze: nom("bronze"),
    pb: c.bareme.bronze,
    zero: 0,
  });
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
    etat ? el("p", { classe: "classement-etat", attrs: { id: "classement-etat", role: "status" }, texte: etat }) : null,
    c ? el("p", { classe: "classement-bareme", attrs: { id: "bareme" }, texte: bareme(t, c) }) : null,
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
    c && c.top.length > 0 ? el("ol", { classe: "classement-liste", attrs: { id: "classement-liste" } }, ...c.top.map((l) => ligne(t, c, l, l.moi === true))) : null,
    // Ta ligne, même hors du haut : séparée par « … », à sa vraie place.
    c?.moi && !topMoi
      ? el(
          "div",
          { classe: "classement-hors-haut", attrs: { id: "classement-moi" } },
          el("p", { classe: "classement-coupure", attrs: { "aria-hidden": "true" }, texte: "…" }),
          el("ol", { classe: "classement-liste", attrs: { start: String(c.moi.rang) } }, ligne(t, c, c.moi, true)),
        )
      : null,
    pasDeLigne ? el("p", { classe: "classement-invite", attrs: { id: "classement-invite" }, texte: t.t("classement.invite") }) : null,
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

/** Lit un jour (une requête) et l'affiche ; l'adresse garde le jour affiché. */
async function charger(date: string | null): Promise<void> {
  jourAffiche = date;
  const id = stockage ? readPlayerId(stockage) : null;
  const l = await lireClassement(fetch.bind(globalThis), id, date);
  if (jourAffiche !== date) return; // un autre jour a été demandé entre-temps
  lecture = l;
  // Aujourd'hui, tel que le serveur l'a dit (une lecture sans date).
  if (date === null && l.classement) aujourdhui = l.classement.date;
  try {
    const adresse = new URL(location.href);
    if (date === null || date === aujourdhui) adresse.searchParams.delete("date");
    else adresse.searchParams.set("date", date);
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

function changerLangue(l: Langue): void {
  langue = l;
  ecrireLangue(stockage, l);
  rendre();
  document.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus();
}

rendre();
void charger(jourAffiche);
