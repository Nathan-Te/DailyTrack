import "./generationInit";
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
import { NAME_KEY, appliquerGeneration, ecrireLangue, generationDeReponse, lireLangue, lireNouveauDepart, readIdentity, readPlayerId, surveillerAnnonce, texteDeAnnonce, type Langue } from "@cdj/profile";
import {
  CATALOGUE_COMMUN,
  afficheur,
  astuceIphone,
  avisNouveauDepart,
  bandeauAnnonce,
  barrePortail,
  bouton,
  cartouche,
  el,
  etiquetteJump,
  etiquetteTrack,
  formatDate,
  formatDateCourte,
  formatNombre,
  formatNumeroJour,
  formatRang,
  formatTemps,
  icone,
  medaille,
  modeApplication,
  traducteur,
  tuile,
  type TypeMedaille,
  cheminMentions,
  visibiliteDeLaPage,
} from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { LIEN_DISCORD, LIEN_KOFI } from "./liens";
import pictoDiscord from "./discord.svg?no-inline";
import tasseKofi from "./kofi-tasse.png";
import { avancement, baseApi, formatCompte, lireJour, prochainMinuit, type Etat, type JeuDuJour, type Lecture } from "./jour";
import { dans, nonLue } from "./nouveautesDonnees";
import { cartes, numeroDeJournee, type CarteJeu } from "./jours";
import { construireOptions, nomDuJeu } from "./partageDuJour";
import { tuileDuClassement } from "./classementVues";
import { envoyer, lienDuPortail, textePartage } from "./partage";
import { stockageDuPortail } from "./stockage";

// Le portail « Du Jour » (lot R4 ; lot I1 : passé au socle `@cdj/ui` ; lot I2 : l'accueil riche). Un joueur qui l'ouvre voit en trois secondes
// ce qu'il lui reste à jouer, combien de temps il lui reste et où en est sa série :
//   - le compte à rebours « Prochains niveaux dans » calé sur l'**heure du serveur** (`maintenant`), pas sur l'horloge du téléphone ; à zéro, les
//     données du nouveau jour sont relues **sans recharger la page** ;
//   - une cartouche par jeu, affichée **tout de suite** (numéro du jour connu sans le serveur) ; le thème et le statut du joueur arrivent dans
//     une **place réservée** (rien ne saute) : pas encore joué · en cours · fini (temps, médaille, rang) ;
//   - la tuile Série (série tous jeux confondus, journées parfaites) et (lot I3) la tuile Classement du jour (sa place et son temps cumulé, lot A1) qui mène à
//     `/classement/` ; le numéro de la journée commune (« Journée n° 12 ») à droite de la date ; le bouton « Partager ma journée » et sa ligne (`partage.ts`) ;
//   - **une seule requête** à l'API au chargement (`GET /api/portail/jour`, `jour.ts`) ; sans identité, aucune donnée personnelle : la réponse
//     publique et une phrase d'accueil ; serveur injoignable : rien de bloquant, un message discret du catalogue.
// Langue : celle de la plateforme (`cdj:langue`, `@cdj/profile`) ; la changer met à jour l'écran sans recharger, `<html lang>` et le titre.

const stockage = stockageDuPortail();
// Lot R8 : le message « Nouveau départ » (posé par l'effacement de la page d'avant le rechargement) n'est montré qu'une fois.
let nouveauDepart = stockage ? lireNouveauDepart(stockage) : false;
let langue: Langue = lireLangue(stockage, navigator.languages).langue;
/** Ce que le serveur a rendu (`null` : pas encore de réponse). */
let lecture: Lecture | null = null;
let chargement = false;
/** Lot I3 : le message du dernier partage (« Ligne copiée… »), sous le bouton. */
let messagePartage: string | null = null;

// Lot N2 : le message en direct. Il arrive **dans la réponse de `GET /api/portail/jour`** (la seule requête du chargement : règle du lot I3) et est semé dans la surveillance ;
// ensuite la page le relit toutes les 60 s, seulement visible (`GET /api/annonce`, partagée par le cache de Hosting). Fermé, il ne revient que si le message change.
const surveillance = surveillerAnnonce({ base: baseApi(), ou: "portail", stockage, ...visibiliteDeLaPage(), surChangement: () => rendre() });
let surveillanceActive = false;
/** Le bandeau de l'écran, gardé tant que le message et la langue ne changent pas (le délai de 10 s de « Important » ne redémarre pas à chaque rendu). */
let bandeauGarde: { id: number; langue: Langue; noeud: HTMLElement } | null = null;

const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_COMMUN);
type T = ReturnType<typeof traduire>;
type Cle = Parameters<T["t"]>[0];
/** Une clé calculée (thème, réplique, code d'erreur du serveur) : connue des catalogues, ou `null`. */
const cleConnue = (cle: string): Cle | null => (cle in CATALOGUE_PORTAIL.fr || cle in CATALOGUE_COMMUN.fr ? (cle as Cle) : null);

/** L'heure du serveur (celle du téléphone corrigée du décalage mesuré au chargement). */
const maintenant = () => Date.now() + (lecture?.decalage ?? 0);

const MEDAILLE: Record<string, TypeMedaille> = { author: "diamant", gold: "or", silver: "argent", bronze: "bronze" };
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
  // Jump : la réplique du thème du jour (une seule par écran ; lot I5 : catalogue commun de @cdj/ui, la même que dans le jeu) ; tant que le thème n'est pas connu
  // (ou sans serveur), l'accroche du jeu.
  const replique = c.code === "jump" && jeu?.theme ? cleConnue(`jump.replique.${jeu.theme}`) : null;
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
  const carte = cartouche({ jeu: c.code, etiquette, action, attrs: { "data-jeu": c.code } });
  // Lot P : sur un aperçu de PR, un jeu pas encore `on` se montre avec le badge « Brouillon ».
  if (jeu?.brouillon) carte.prepend(el("span", { classe: "dj-badge-brouillon", attrs: { "data-brouillon": "" }, texte: t.t("portail.brouillon") }));
  return carte;
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

/**
 * Lot I3, refait au lot A1 — la tuile Classement du jour : « 9e », « 1:42,315 cumulés » ; elle mène à `/classement/`. Avec un seul jeu fini : sa place et
 * « Finis Jump pour le cumul » (le jeu manquant). Un joueur neuf, ou qui n'a encore fini aucun jeu aujourd'hui, est invité à jouer (« Finis un jeu pour
 * entrer au classement »), sans chiffre inventé. `null` : le serveur n'a pas répondu (la page du classement
 * ne s'ouvrirait pas non plus).
 */
function tuileClassement(t: T, neuf: boolean): HTMLElement | null {
  const joueur = lecture?.jour?.joueur;
  const contenuTuile = tuileDuClassement(joueur, lecture?.jour?.jeux ?? []);
  // Le serveur n'a pas répondu (injoignable, délai) : pas de tuile, la page du classement ne s'ouvrirait pas non plus.
  if (lecture && !lecture.jour) return null;
  // Pendant le chargement, sa place est réservée (sauf pour un joueur neuf, qui n'attend rien du serveur).
  if (contenuTuile.type === "inviter" && !neuf && !joueur) return lecture ? null : el("div", { classe: "portail-tuile-reservee", attrs: { "aria-hidden": "true" } });
  const legende = t.t("portail.classement.legende");
  const contenu =
    contenuTuile.type === "cumul"
      ? tuile({ legende, valeur: formatRang(contenuTuile.rang, langue), sousTexte: t.t("portail.classement.cumul", { temps: formatTemps(contenuTuile.cumulMs, langue) }) })
      : contenuTuile.type === "manque"
        ? tuile({ legende, valeur: formatRang(contenuTuile.rang, langue), sousTexte: t.t("portail.classement.manque", { jeu: nomDuJeu(t, contenuTuile.jeu) }) })
        : tuile({ legende, valeur: "—", sousTexte: t.t("portail.classement.inviter") });
  return el("a", { classe: "portail-tuile-lien", attrs: { id: "classement", href: "classement/", "data-cle": "classement" } }, contenu);
}

/** Lot I3 — « Partager ma journée » dès qu'au moins un jeu est fini aujourd'hui : le bouton, la ligne qu'il enverra (le joueur voit ce qu'il envoie), le message. */
function partage(t: T): HTMLElement | null {
  const jour = lecture?.jour;
  const options = jour ? construireOptions(t, jour, lienDuPortail(location)) : null;
  if (!options) return null;
  const texte = textePartage(options);
  const bouton_ = bouton({ texte: t.t("portail.partager"), variante: "marque", pleineLargeur: true, onClick: () => void partager(texte) });
  bouton_.id = "partager";
  bouton_.setAttribute("data-cle", "partager");
  return el(
    "section",
    { classe: "portail-partage", attrs: { "aria-label": t.t("portail.partager") } },
    bouton_,
    el("p", { classe: "portail-partage__apercu", attrs: { id: "partage-apercu", "aria-label": t.t("portail.partage.apercu") }, texte }),
    messagePartage ? el("p", { classe: "portail-message", attrs: { id: "partage-message", role: "status" }, texte: messagePartage }) : null,
  );
}

async function partager(texte: string): Promise<void> {
  const t = traduire(langue);
  const r = await envoyer(texte);
  messagePartage = r === "partage" ? t.t("portail.partage.partage") : r === "copie" ? t.t("portail.partage.copie") : r === "echec" ? t.t("portail.partage.pasDeCopie") : null;
  rendre();
}

/** Le message discret quand le serveur n'a pas rendu le jour du joueur (un code du serveur traduit, sinon panne du réseau). */
function message(t: T): string | null {
  const e = lecture?.erreur;
  if (!e || e === "unknown_player") return null;
  if (e === "delai") return t.t("portail.delai");
  return t.t(cleConnue(`erreur.${e}`) ?? "portail.horsLigne");
}

/** Le bandeau du message en direct, ou `null` (aucun message pour le portail, fini, ou fermé sur cet appareil). */
function bandeau(t: T): HTMLElement | null {
  const a = surveillance.courant();
  if (!a) {
    bandeauGarde = null;
    return null;
  }
  if (!bandeauGarde || bandeauGarde.id !== a.id || bandeauGarde.langue !== langue) {
    bandeauGarde = { id: a.id, langue, noeud: bandeauAnnonce(t, { texte: texteDeAnnonce(a, langue), ton: a.ton, onFermer: () => surveillance.fermer() }) };
  }
  return bandeauGarde.noeud;
}

/** La ligne « Nouveautés · 27 oct. » sous les tuiles : le titre de la dernière publiée, un point terre tant qu'elle n'est pas lue sur cet appareil. Aucune nouveauté : rien. */
function ligneNouveautes(t: T): HTMLElement | null {
  const n = lecture?.jour?.nouveaute;
  if (!n) return null;
  const jour = parseDay(n.date);
  const date = jour === null ? n.date : formatDateCourte(jour, langue);
  const point = nonLue(n, stockage);
  return el(
    "a",
    { classe: "portail-nouveautes", attrs: { id: "nouveautes", href: "nouveautes/", "data-cle": "nouveautes", "data-non-lue": point ? "oui" : "non" } },
    el("span", { classe: "portail-nouveautes__texte" }, el("span", { classe: "portail-nouveautes__legende", texte: t.t("portail.nouveautes.legende", { date }) }), el("span", { classe: "portail-nouveautes__titre", texte: dans(n.titre, langue) })),
    point ? el("span", { classe: "portail-nouveautes__point", attrs: { id: "nouveautes-point" } }, el("span", { classe: "dj-cache", texte: t.t("portail.nouveautes.nonLue") })) : null,
  );
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
  const journee = jour ? (jour.journee ?? null) : numeroDeJournee(day);
  const texteMessage = message(t);
  racine.replaceChildren(
    ...[bandeau(t)].filter((e): e is HTMLElement => e !== null),
    el("h1", { classe: "dj-cache", texte: t.t("portail.titre") }),
    barrePortail(t, { langue, onLangue: changerLangue, pseudo: identite.exists ? identite.name : null, profil: "profil/" }),
    ...(nouveauDepart ? [avisNouveauDepart(t, { onFermer: () => (nouveauDepart = false) })] : []),
    // Lot 53 : sur iPhone, hors du mode application, la ligne « Partager › Sur l'écran d'accueil » (une seule fois : fermée, elle ne revient pas).
    ...[stockage ? astuceIphone({ textes: () => ({ astuce: t.t("pleinEcran.iphone"), fermer: t.t("pleinEcran.iphone.fermer") }), stockage }) : null].filter((e): e is HTMLElement => e !== null),
    el(
      "div",
      { classe: "portail-date" },
      el("p", { classe: "portail-date__jour", attrs: { id: "date" }, texte: formatDate(day, langue, { capitale: true }) }),
      // Lot I3 : le numéro de la journée commune, à droite de la date (le serveur fait foi ; sinon la constante recopiée) ; rien avant le 23/10/2026.
      journee ? el("span", { classe: "portail-date__journee", attrs: { id: "journee" }, texte: t.t("portail.journee", { numero: formatNumeroJour(journee, langue) }) }) : null,
    ),
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
    ...(neuf ? [el("p", { classe: "portail-accueil", attrs: { id: "accueil" }, texte: t.t("portail.accueil") })] : []),
    ...[el("div", { classe: "portail-tuiles" }, ...[neuf ? null : tuileSerie(t), tuileClassement(t, neuf)].filter((e): e is HTMLElement => e !== null))].filter((g) => g.childElementCount > 0),
    ...[ligneNouveautes(t)].filter((e): e is HTMLElement => e !== null),
    ...[partage(t)].filter((e): e is HTMLElement => e !== null),
    ...(texteMessage ? [el("p", { classe: "portail-message", attrs: { id: "message", role: "status" }, texte: texteMessage })] : []),
    el(
      "footer",
      { classe: "portail-pied" },
      el("p", { texte: t.t("portail.pied") }),
      el(
        "div",
        { classe: "portail-pied__liens" },
        lienDiscord(t.t("portail.discord")),
        lienKofi(t.t("portail.kofi")),
      ),
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: cheminMentions(langue), hreflang: langue }, texte: t.t("portail.mentions") }),
    ),
  );
  if (focus) racine.querySelector<HTMLElement>(`[data-cle="${focus}"]`)?.focus();
}

/**
 * Le bouton Discord, à l'allure de Discord (le bleu-violet de leur charte, leur pictogramme) : un lien, **pas le widget intégré** (une fenêtre de discord.com : cookies et traceurs
 * tiers à chaque visite). Texte blanc : il passe le contraste exigé sur ce bleu.
 */
function lienDiscord(texte: string): HTMLElement {
  const picto = el("img", { classe: "portail-discord__picto", attrs: { src: pictoDiscord, alt: "", width: 24, height: 24 } });
  return el("a", { classe: "portail-discord", attrs: { id: "discord", href: LIEN_DISCORD, target: "_blank", rel: "noopener noreferrer" } }, picto, el("span", { texte }));
}

/**
 * Le bouton Ko-fi, à l'allure de celui que Ko-fi propose (bleu, la tasse au cœur), **sans rien charger de chez eux** : un lien, et la tasse est une copie hébergée sur le site (aucun script ni
 * image de `ko-fi.com`). Le texte est encre sur le bleu (le blanc du bouton d'origine ne passe pas le contraste exigé par l'audit d'accessibilité).
 */
function lienKofi(texte: string): HTMLElement {
  const a = el(
    "a",
    { classe: "portail-kofi", attrs: { id: "kofi", href: LIEN_KOFI, target: "_blank", rel: "noopener noreferrer" } },
    el("img", { classe: "portail-kofi__tasse", attrs: { src: tasseKofi, alt: "", width: 30, height: 24 } }),
    el("span", { texte }),
  );
  return a;
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
  // Lot R8 : une génération de données plus récente que celle de ce navigateur (remise à zéro du lancement) : ses données de jeu sont effacées,
  // la page recharge et il est un joueur neuf (le message le dit une fois).
  if (stockage && appliquerGeneration(stockage, generationDeReponse(l.jour)) === "efface") {
    location.reload();
    return;
  }
  // Le pseudo du serveur fait foi (même règle que les jeux) : l'avatar suit.
  const pseudo = l.jour?.joueur?.pseudo;
  try {
    if (stockage && pseudo && stockage.getItem(NAME_KEY) !== pseudo) stockage.setItem(NAME_KEY, pseudo);
  } catch {
    /* stockage refusé : l'avatar garde l'ancien pseudo */
  }
  // Lot N2 : le message de la réponse est semé (aucune requête de plus au chargement) ; la surveillance démarre une fois.
  if (l.jour) surveillance.semer(l.jour.annonce ?? null, l.decalage);
  if (!surveillanceActive) {
    surveillanceActive = true;
    surveillance.activer();
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

/**
 * Lot 53 : l'application ajoutée à l'écran d'accueil (iPhone) a son propre stockage : au premier lancement, sans profil, « Retrouver mon profil » (code de transfert collé).
 * Le même écran, par `@cdj/ui` et `@cdj/profile`, dans Track et Jump ; **à la demande** (`retrouverPortail.ts` : rien dans le premier chargement du portail).
 */
function proposerRetrouver(): void {
  if (!stockage || !modeApplication()) return;
  const t = traduire(langue);
  void import("./retrouverPortail").then((m) =>
    m.proposerRetrouver(baseApi(), stockage, (code) => {
      const cle = `erreur.${code}` as Parameters<typeof t.t>[0];
      const texte = t.t(cle);
      return texte !== cle ? texte : null;
    }),
  );
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
  proposerRetrouver();
  await charger(null);
}

void demarrer();
