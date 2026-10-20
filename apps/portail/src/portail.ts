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
import { parseDay } from "@cdj/core";
import { NAME_KEY, ecrireLangue, lireLangue, readIdentity, readPlayerId, type Langue } from "@cdj/profile";
import {
  CATALOGUE_COMMUN,
  afficheur,
  barrePortail,
  bouton,
  cartouche,
  el,
  etiquetteJump,
  etiquetteTrack,
  formatDate,
  formatNombre,
  formatNumeroJour,
  formatRang,
  formatTemps,
  icone,
  medaille,
  traducteur,
  tuile,
  type TypeMedaille,
} from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { avancement, formatCompte, lireJour, prochainMinuit, type Etat, type JeuDuJour, type Lecture } from "./jour";
import { cartes, type CarteJeu } from "./jours";
import { stockageDuPortail } from "./stockage";

// Le portail « Du Jour » (lot R4 ; lot I1 : passé au socle `@cdj/ui` ; lot I2 : l'accueil riche). Un joueur qui l'ouvre voit en trois secondes
// ce qu'il lui reste à jouer, combien de temps il lui reste et où en est sa série :
//   - le compte à rebours « Prochains jeux dans » calé sur l'**heure du serveur** (`maintenant`), pas sur l'horloge du téléphone ; à zéro, les
//     données du nouveau jour sont relues **sans recharger la page** ;
//   - une cartouche par jeu, affichée **tout de suite** (numéro du jour connu sans le serveur) ; le thème et le statut du joueur arrivent dans
//     une **place réservée** (rien ne saute) : pas encore joué · en cours · fini (temps, médaille, rang) ;
//   - la tuile Série (série tous jeux confondus, journées parfaites) ;
//   - **une seule requête** à l'API au chargement (`GET /api/portail/jour`, `jour.ts`) ; sans identité, aucune donnée personnelle : la réponse
//     publique et une phrase d'accueil ; serveur injoignable : rien de bloquant, un message discret du catalogue.
// Langue : celle de la plateforme (`cdj:langue`, `@cdj/profile`) ; la changer met à jour l'écran sans recharger, `<html lang>` et le titre.

const stockage = stockageDuPortail();
let langue: Langue = lireLangue(stockage, navigator.languages).langue;
/** Ce que le serveur a rendu (`null` : pas encore de réponse). */
let lecture: Lecture | null = null;
let chargement = false;

const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_COMMUN);
type T = ReturnType<typeof traduire>;
type Cle = Parameters<T["t"]>[0];
/** Une clé calculée (thème, réplique, code d'erreur du serveur) : connue des catalogues, ou `null`. */
const cleConnue = (cle: string): Cle | null => (cle in CATALOGUE_PORTAIL.fr || cle in CATALOGUE_COMMUN.fr ? (cle as Cle) : null);

/** L'heure du serveur (celle du téléphone corrigée du décalage mesuré au chargement). */
const maintenant = () => Date.now() + (lecture?.decalage ?? 0);

const MEDAILLE: Record<string, TypeMedaille> = { author: "auteur", gold: "or", silver: "argent", bronze: "bronze" };
const NOM_JEU = { track: "jeu.track.nom", jump: "jeu.jump.nom" } as const;

/** Le nom traduit d'un thème (`portail.theme.<jeu>.<code>`), ou `null` s'il est inconnu du catalogue. */
function nomTheme(t: T, jeu: string, theme: string | null): string | null {
  const cle = theme ? cleConnue(`portail.theme.${jeu}.${theme}`) : null;
  return cle ? t.t(cle) : null;
}

/** La ligne du statut du joueur (place réservée : deux rangées, vides tant que le serveur n'a pas répondu). */
function statut(t: T, c: CarteJeu, etat: Etat | undefined): HTMLElement {
  const ligne = (...enfants: (Node | string | null)[]) => el("span", { classe: "portail-statut__ligne" }, ...enfants);
  const contenu: HTMLElement[] = [];
  if (etat?.statut === "pas_joue") contenu.push(ligne(t.t("portail.statut.pasJoue")));
  else if (etat?.statut === "en_cours") contenu.push(ligne(etat.morts !== undefined ? t.t("portail.statut.enCoursMorts", { n: etat.morts }) : t.t("portail.statut.enCours")));
  else if (etat?.statut === "fini") {
    const type = etat.medaille ? MEDAILLE[etat.medaille] : undefined;
    contenu.push(
      ligne(el("span", { classe: "portail-pastille-fini", texte: t.t("portail.statut.fini") }), el("span", { classe: "portail-statut__temps", texte: formatTemps(etat.tempsMs, langue) })),
      ligne(
        type ? medaille(t, { type, obtenue: true, jeu: c.code }) : null,
        el("span", { classe: "portail-statut__rang", texte: t.t("portail.statut.rang", { rang: formatRang(etat.rang, langue), classes: formatNombre(etat.classes, langue) }) }),
      ),
    );
  }
  return el("div", { classe: "portail-statut", attrs: { "data-statut": etat?.statut ?? "inconnu" } }, ...contenu);
}

function cartoucheDe(c: CarteJeu, t: T, jeu: JeuDuJour | undefined): HTMLElement {
  const numero = (jeu?.numero ?? c.numero) > 0 ? formatNumeroJour(jeu?.numero ?? c.numero, langue) : undefined;
  const theme = nomTheme(t, c.jeu, jeu?.theme ?? null);
  const numeroTheme = numero && theme ? t.t("portail.numeroTheme", { numero, theme }) : numero;
  const etat = jeu?.etat;
  const suite = statut(t, c, etat);
  // Jump : la réplique du thème du jour (une seule par écran) ; tant que le thème n'est pas connu (ou sans serveur), l'accroche du jeu.
  const replique = c.code === "jump" && jeu?.theme ? cleConnue(`portail.jump.replique.${jeu.theme}`) : null;
  const texte = c.code === "track" ? t.t("portail.track.accroche") : t.t(replique ?? "portail.jump.accroche");
  const etiquette = c.code === "track" ? etiquetteTrack({ titre: t.t("jeu.track.titre"), numero: numeroTheme, texte, suite }) : etiquetteJump({ titre: t.t("jeu.jump.titre"), numero: numeroTheme, texte, suite });
  const nom = t.t(NOM_JEU[c.code]);
  const action =
    etat?.statut === "fini"
      ? bouton({ texte: t.t("portail.rejouer"), href: c.lien, variante: "secondaire", pleineLargeur: true, ariaLabel: t.t("portail.rejouer.aria", { jeu: nom }) })
      : etat?.statut === "en_cours"
        ? bouton({ texte: t.t("portail.continuer"), href: c.lien, variante: "marque", pleineLargeur: true, ariaLabel: t.t("portail.continuer.aria", { jeu: nom }) })
        : bouton({ texte: t.t("portail.jouer"), href: c.lien, variante: "marque", pleineLargeur: true, ariaLabel: t.t("portail.jouer.aria", { jeu: nom }) });
  action.setAttribute("data-cle", `jouer-${c.code}`);
  return cartouche({ jeu: c.code, etiquette, action, attrs: { "data-jeu": c.code } });
}

/** La tuile Série : flamme, « 5 jours », « 2 journées parfaites » ; à prolonger aujourd'hui ; journée parfaite du jour (sobre, sans animation). */
function tuileSerie(t: T): HTMLElement | null {
  const joueur = lecture?.jour?.joueur;
  // Pendant le chargement, sa place est réservée (rien ne saute) ; sans réponse du serveur, rien.
  if (!joueur) return lecture ? null : el("div", { classe: "portail-tuile-reservee", attrs: { "aria-hidden": "true" } });
  const t1 = tuile({
    legende: t.t("portail.serie.legende"),
    valeur: t.t("portail.serie.valeur", { n: joueur.serie }),
    sousTexte: t.t("portail.serie.parfaites", { n: joueur.journeesParfaites }),
    icone: icone("flamme", { taille: 22 }),
  });
  t1.id = "serie";
  if (joueur.aProlonger) t1.append(el("span", { classe: "portail-serie__prolonger", texte: t.t("portail.serie.aProlonger") }));
  if (joueur.aujourdhuiParfaite) {
    t1.classList.add("portail-serie--parfaite");
    t1.append(el("span", { classe: "portail-serie__parfaite" }, icone("drapeau", { taille: 16 }), t.t("portail.serie.parfaiteAujourdhui")));
  }
  return t1;
}

/** Le message discret quand le serveur n'a pas rendu le jour du joueur (un code du serveur traduit, sinon panne du réseau). */
function message(t: T): string | null {
  const e = lecture?.erreur;
  if (!e || e === "unknown_player") return null;
  if (e === "delai") return t.t("portail.delai");
  return t.t(cleConnue(`erreur.${e}`) ?? "portail.horsLigne");
}

function rendre(): void {
  const racine = document.getElementById("portail");
  if (!racine) return;
  const t = traduire(langue);
  const focus = (document.activeElement as HTMLElement | null)?.getAttribute("data-cle");
  document.documentElement.lang = langue;
  document.title = t.t("portail.titre");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t.t("portail.description"));
  const jour = lecture?.jour;
  const day = (jour && parseDay(jour.date)) ?? parisDay(maintenant());
  const identite = readIdentity(stockage);
  const parJeu = new Map((jour?.jeux ?? []).map((j) => [j.jeu, j]));
  // Les cartouches que le portail sait dessiner, dans l'ordre du serveur quand il a répondu.
  const montrees = cartes(day).filter((c) => (jour ? parJeu.has(c.jeu) : c.numero > 0));
  const statuts = jour?.joueur ? montrees.map((c) => parJeu.get(c.jeu)!) : [];
  const { finis, total } = avancement(statuts);
  const neuf = !identite.exists || lecture?.erreur === "unknown_player";
  const texteMessage = message(t);
  racine.replaceChildren(
    el("h1", { classe: "dj-cache", texte: t.t("portail.titre") }),
    barrePortail(t, { langue, onLangue: changerLangue, pseudo: identite.exists ? identite.name : null, profil: "profil/" }),
    el("p", { classe: "portail-date", attrs: { id: "date" }, texte: formatDate(day, langue, { capitale: true }) }),
    afficheurDuCompte(t),
    el(
      "section",
      { classe: "portail-jeux", attrs: { "aria-labelledby": "portail-jeux-titre" } },
      el(
        "div",
        { classe: "portail-jeux__tete" },
        el("h2", { classe: "portail-jeux__titre", attrs: { id: "portail-jeux-titre" }, texte: t.t("portail.jeux.titre") }),
        el("span", { classe: "portail-jeux__avancement", attrs: { id: "avancement" }, texte: statuts.length ? t.t("portail.avancement", { n: finis, total }) : "" }),
      ),
      el(
        "div",
        { classe: "portail-etagere", attrs: { id: "jeux" } },
        ...montrees.map((c) => {
          const j = parJeu.get(c.jeu);
          // Un joueur inconnu du serveur n'a rien joué : « Pas encore joué » ; sans identité, pareil (rien à attendre).
          const etat = j?.etat ?? (jour && neuf && lecture?.erreur !== "code_revoked" ? ({ statut: "pas_joue" } as const) : undefined);
          return cartoucheDe(c, t, j ? { ...j, etat } : etat ? { jeu: c.jeu, numero: c.numero, theme: null, seuils: null, premierJour: "", etat } : undefined);
        }),
      ),
    ),
    ...[neuf ? el("p", { classe: "portail-accueil", attrs: { id: "accueil" }, texte: t.t("portail.accueil") }) : tuileSerie(t)].filter((e): e is HTMLElement => e !== null),
    ...(texteMessage ? [el("p", { classe: "portail-message", attrs: { id: "message", role: "status" }, texte: texteMessage })] : []),
    el(
      "footer",
      { classe: "portail-pied" },
      el("p", { texte: t.t("portail.pied") }),
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: "mentions-legales/", hreflang: langue === "fr" ? null : "fr" }, texte: t.t("portail.mentions") }),
    ),
  );
  if (focus) racine.querySelector<HTMLElement>(`[data-cle="${focus}"]`)?.focus();
}

// --- Le compte à rebours (heure du serveur) -----------------------------------------------------------------------------------
let minuterie: ReturnType<typeof setTimeout> | null = null;

function afficheurDuCompte(t: T): HTMLElement {
  const a = afficheur({ legende: t.t("portail.compte.legende"), valeur: formatCompte(prochainMinuit(lecture?.jour ?? null, maintenant()) - maintenant()) });
  a.id = "compte";
  return a;
}

/** Une seconde de plus : le chiffre change (sans animation) ; à zéro, le nouveau jour est relu. */
function battre(): void {
  if (minuterie) clearTimeout(minuterie);
  const fin = prochainMinuit(lecture?.jour ?? null, maintenant());
  const reste = fin - maintenant();
  const valeur = document.querySelector("#compte .dj-afficheur__valeur");
  if (valeur) valeur.textContent = formatCompte(reste);
  if (reste <= 0 && !chargement) {
    void charger(lecture?.jour?.date ?? null);
    return;
  }
  // Au prochain changement de seconde de l'heure du serveur.
  minuterie = setTimeout(battre, Math.max(50, ((reste % 1000) + 1000) % 1000 || 1000));
}

/**
 * Lit le jour (une requête). `ancien` : la date d'avant minuit — si le serveur la rend encore (horloges décalées de quelques secondes), on
 * relit un peu plus tard, au plus quelques fois.
 */
async function charger(ancien: string | null, essai = 0): Promise<void> {
  chargement = true;
  const id = stockage ? readPlayerId(stockage) : null;
  const l = await lireJour(fetch.bind(globalThis), id);
  chargement = false;
  if (ancien && l.jour?.date === ancien && essai < 5) {
    lecture = { ...l, jour: lecture?.jour ?? l.jour };
    minuterie = setTimeout(() => void charger(ancien, essai + 1), 2000);
    return;
  }
  lecture = l;
  // Le pseudo du serveur fait foi (même règle que les jeux) : l'avatar suit.
  const pseudo = l.jour?.joueur?.pseudo;
  try {
    if (stockage && pseudo && stockage.getItem(NAME_KEY) !== pseudo) stockage.setItem(NAME_KEY, pseudo);
  } catch {
    /* stockage refusé : l'avatar garde l'ancien pseudo */
  }
  rendre();
  battre();
}

function changerLangue(l: Langue): void {
  langue = l;
  ecrireLangue(stockage, l);
  rendre();
  // Le focus reste sur le choix de langue (l'écran a été reconstruit).
  document.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus();
}

async function demarrer(): Promise<void> {
  // Recette et aperçus seulement : `/?demo=joueur` installe le joueur de démonstration (absent de la construction de production).
  if (__PORTAIL_DEMO__ && new URLSearchParams(location.search).get("demo") === "joueur") {
    const racine = document.getElementById("portail");
    const { lienDemo } = await import("./demo");
    if (racine) await lienDemo(stockage, langue, racine);
  }
  rendre();
  battre();
  await charger(null);
}

void demarrer();
