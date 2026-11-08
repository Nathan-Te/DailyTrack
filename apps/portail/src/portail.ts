import "./generationInit";
import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/avatar.css";
import "@cdj/ui/src/avatar-liste.css"; // lot U1 : les photos et les initiales des amis de la colonne de droite
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "@cdj/ui/src/polices/lilita-one-400.css";
import "@cdj/ui/src/polices/rubik-mono-one-400.css";
import "@cdj/ui/src/polices-profil/bungee-400.css"; // lot U1 : le nom de Rush sur sa cartouche d'arcade (sous-ensemble réduit, quelques Ko)
import "./portail.css";
import "./salle.css";
import { parisDay } from "@cdj/clock";
import { formatDay, parseDay } from "@cdj/core";
import { NAME_KEY, adresseAvatar, aReprendre, appliquerGeneration, basculer, ecrireFavorisLocaux, ecrireLangue, generationDeReponse, lireFavorisLocaux, lireLangue, lireNouveauDepart, listeAffichee, readIdentity, readPlayerId, surveillerAnnonce, texteDeAnnonce, type Langue } from "@cdj/profile";
import {
  CATALOGUE_COMMUN,
  astuceIphone,
  avisNouveauDepart,
  bandeauAnnonce,
  avatar,
  bouton,
  boutonFavori,
  cartouche,
  choixLangue,
  el,
  etiquetteDe,
  formatDate,
  formatNombre,
  formatNumeroJour,
  formatRang,
  formatScore,
  formatTemps,
  icone,
  logo,
  medaille,
  modeApplication,
  traducteur,
  tuile,
  type Jeu,
  type TypeMedaille,
  cheminMentions,
  visibiliteDeLaPage,
} from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { lienCommunaute } from "@cdj/ui/src/liensCommunaute";
import { avancement, baseApi, compteAujourdhui, formatCompte, lireJour, prochainMinuit, type AmiDuJour, type Etat, type JeuDuJour, type JourDeSemaine, type Lecture, type LigneEntreAmis } from "./jour";
import { choixPourDemain, epinglesEnTete } from "./mesJeux";
import { barreSalle, cloche, compteDuFronton, emblemeDeGroupe, fronton, navigation, panneau, progression, selecteurDeVue, semaineEnLampes, titreDeZone, type Lampe } from "./salle";
import { lignesDeCloche } from "./clocheLignes";
import { boutonRetours } from "./retoursLien";
import { categorieDuJeu, ficheDuJeu, titreDeCarte } from "./jeuxFiches";
import { cartes, numeroDeJournee, type CarteJeu } from "./jours";
import { construireOptions, nomDuJeu } from "./partageDuJour";
import { tuileDuClassement } from "./classementVues";
import { envoyer, lienDuPortail, textePartage } from "./partage";
import { stockageDuPortail } from "./stockage";
import { garderJour, jourGarde } from "./cacheJour";
import { activerManette } from "@cdj/ui/src/manetteLien";

// Lot M1 : cette page se pilote à la manette (son action principale : une ligne de `manette.ts`, chargée avec le menu).
activerManette(() => import("./manette").then((m) => m.pour("accueil")));

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
/** Ce qui est affiché vient de la copie gardée dans le navigateur (la réponse du serveur n'est pas encore là) : si elle n'arrive pas, la copie reste, avec le message d'erreur. */
let depuisLaCopie = false;
/** Lot I3 : le message du dernier partage (« Ligne copiée… »), sous le bouton. */
let messagePartage: string | null = null;
// Lot F1 : « Mes jeux ». Le serveur fait foi pour un joueur qu'il connaît ; le navigateur garde la liste d'un visiteur (`cdj:favoris`), reprise dans le profil à sa création.
let favorisLocaux = lireFavorisLocaux(stockage);
/** L'écriture au serveur est **à la demande** (premier toucher d'une étoile, ou reprise d'une liste de visiteur) : le premier chargement ne la paie pas. */
const reseauFavoris = () => import("@cdj/profile/src/favorisReseau");
/** Les écritures de la liste partent l'une après l'autre (un double toucher n'envoie jamais deux listes en désordre). */
let ecrituresFavoris: Promise<void> = Promise.resolve();
/** Le message discret quand le choix n'a pas pu être enregistré (un code du serveur traduit, sinon l'échec du réseau). */
let messageFavoris: string | null = null;

/** Lot U1 : le classement montré dans la colonne de droite (`null` : le défaut, « Amis » quand le joueur a des amis, sinon « Tous »). */
let vueClassement: "tous" | "amis" | "groupe" | null = null;
/** Lot U1 : la petite feuille de la cloche est-elle ouverte ? (L'écran est redessiné à chaque changement : l'état vit ici.) */
let clocheOuverte = false;

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
/** Le nom d'un jeu : `jeu.<id>.nom` du catalogue commun (lots K1 à K1c : chaque jeu a sa fiche). */
const nomCleDe = (code: Jeu) => `jeu.${code}.nom` as const;

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
    // Lot TP : un jeu à la hauteur (Tower) montre sa hauteur et ses vies à la place du temps (la durée de sa partie n'est pas son score).
    const score = etat.score;
    contenu.push(
      ligne(
        el("span", { classe: "portail-pastille-fini", texte: t.t("portail.statut.fini") }),
        el("span", { classe: "portail-statut__temps", texte: score ? formatScore(ficheDuJeu(c.code)?.format ?? "hauteur", score.valeur, langue) : formatTemps(etat.tempsMs, langue) }),
        score ? el("span", { classe: "portail-statut__vies", texte: t.t("portail.statut.vies", { n: score.vies }) }) : null,
      ),
      ligne(
        type ? medaille(t, { type, obtenue: true, jeu: c.code }) : null,
        el("span", { classe: "portail-statut__rang", texte: t.t("portail.statut.rang", { rang: formatRang(etat.rang, langue), classes: formatNombre(etat.classes, langue) }) }),
      ),
    );
  }
  return el("div", { classe: "portail-statut", attrs: { "data-statut": etat?.statut ?? "inconnu" } }, ...contenu);
}

interface OptionsCarte {
  /** Lot F1 : le jeu est-il épinglé ? (Lot U1 : il passe alors en tête de sa zone.) */
  epingle: boolean;
}

/** Le numéro du jour et le thème sous le nom du jeu (« n° 8 · Nuit »), ou rien tant que le jeu n'a pas de numéro. */
function numeroEtTheme(c: CarteJeu, t: T, jeu: JeuDuJour | undefined): string | undefined {
  const numero = (jeu?.numero ?? c.numero) > 0 ? formatNumeroJour(jeu?.numero ?? c.numero, langue) : undefined;
  const theme = nomTheme(t, c.jeu, jeu?.theme ?? null);
  return numero && theme ? t.t("portail.numeroTheme", { numero, theme }) : numero;
}

/** Le bouton de la cartouche (« Jouer », « Continuer », « Rejouer ») : toute la largeur, la même hauteur quel que soit le statut. */
function boutonDeCarte(c: CarteJeu, t: T, etat: Etat | undefined): HTMLElement {
  const nom = t.t(nomCleDe(c.code));
  const action =
    etat?.statut === "fini"
      ? bouton({ texte: t.t("portail.rejouer"), href: c.lien, variante: "secondaire", pleineLargeur: true, ariaLabel: t.t("portail.rejouer.aria", { jeu: nom }) })
      : etat?.statut === "en_cours"
        ? bouton({ texte: t.t("portail.continuer"), href: c.lien, variante: "marque", pleineLargeur: true, ariaLabel: t.t("portail.continuer.aria", { jeu: nom }) })
        : bouton({ texte: t.t("portail.jouer"), href: c.lien, variante: "marque", pleineLargeur: true, ariaLabel: t.t("portail.jouer.aria", { jeu: nom }) });
  action.setAttribute("data-cle", `jouer-${c.code}`);
  return action;
}

/** Lot F1 : l'étoile (44 px) épingle ou retire le jeu ; son nom lu dit l'action. Après l'action dans l'ordre du clavier : « Jouer » reste l'action principale. */
function etoileDe(c: CarteJeu, t: T, epingle: boolean): HTMLElement {
  const favori = boutonFavori({ epingle, nom: t.t(epingle ? "portail.favoris.retirer" : "portail.favoris.ajouter", { jeu: t.t(nomCleDe(c.code)) }), place: "coin", onClick: () => basculerFavori(c.code) });
  favori.setAttribute("data-cle", `favori-${c.code}`);
  return favori;
}

/** Les pastilles « Brouillon » (aperçu de PR) et « Nouveau » (jeu ouvert depuis moins de 7 jours, tant que le joueur ne l'a pas épinglé), posées sur la coque. */
function pastillesDe(carte: HTMLElement, t: T, jeu: JeuDuJour | undefined, epingle: boolean): HTMLElement {
  // Lot P : sur un aperçu de PR, un jeu pas encore `on` se montre avec le badge « Brouillon ».
  if (jeu?.brouillon) carte.prepend(el("span", { classe: "dj-badge-brouillon", attrs: { "data-brouillon": "" }, texte: t.t("portail.brouillon") }));
  // Lot F1 : un jeu ouvert depuis moins de 7 jours porte « Nouveau » tant que le joueur ne l'a pas épinglé (le serveur compte les 7 jours).
  if (jeu?.nouveau && !epingle) carte.prepend(el("span", { classe: "dj-badge-nouveau", attrs: { "data-nouveau": "" }, texte: t.t("portail.nouveau") }));
  return carte;
}

/** Une cartouche des jeux du jour : l'étiquette du jeu (son dessin, sa police), l'accroche, le statut du joueur, puis le bouton sous l'étiquette. */
function cartoucheDe(c: CarteJeu, t: T, jeu: JeuDuJour | undefined, opts: OptionsCarte = { epingle: false }): HTMLElement {
  const etat = jeu?.etat;
  // Lots K1, K1b et K1c : la fiche d'un jeu donne son accroche (celle du thème du jour quand elle en a une : Jump, une réplique par thème, la même que dans le jeu, catalogue commun de @cdj/ui),
  // son titre et son étiquette.
  const fiche = ficheDuJeu(c.code)!;
  const parTheme = fiche.accrocheTheme && jeu?.theme ? cleConnue(fiche.accrocheTheme + jeu.theme) : null;
  const texte = t.t(parTheme ?? (cleConnue(fiche.accroche) as Cle));
  const titre = titreDeCarte(fiche, t, t.t(nomCleDe(c.code)));
  const etiquette = etiquetteDe(c.code, { titre, numero: numeroEtTheme(c, t, jeu), texte, suite: statut(t, c, etat) });
  const carte = cartouche({ jeu: c.code, etiquette, action: boutonDeCarte(c, t, etat), favori: etoileDe(c, t, opts.epingle), attrs: { "data-jeu": c.code, "data-epingle": opts.epingle ? "oui" : "non" } });
  return pastillesDe(carte, t, jeu, opts.epingle);
}

/**
 * Lot U1 (charte rév. 19) — une cartouche de la salle d'arcade : l'illustration du jeu (son fichier `<jeu>/illustration.svg`, lot K5) sur le motif de son étiquette, son nom dans sa police, le numéro et
 * le thème, le statut, puis le bouton **dans l'étiquette**. Sur téléphone elle passe à l'horizontale (illustration à gauche) : la feuille `salle.css`, le même contenu.
 */
function cartoucheArcade(c: CarteJeu, t: T, jeu: JeuDuJour | undefined, opts: OptionsCarte): HTMLElement {
  const etat = jeu?.etat;
  const fiche = ficheDuJeu(c.code)!;
  const numeroTheme = numeroEtTheme(c, t, jeu);
  const etiquette = el(
    "div",
    { classe: ["dj-etiquette", "salle-etiquette", `jeu-etiquette--${c.code}`] },
    el("div", { classe: "salle-etiquette__art", attrs: { "aria-hidden": "true" } }, fiche.illustration ? el("img", { classe: "salle-etiquette__dessin", attrs: { src: `${c.code}/illustration.svg`, alt: "", decoding: "async" } }) : null),
    el(
      "div",
      { classe: "salle-etiquette__info" },
      el("h3", { classe: "salle-etiquette__nom", texte: titreDeCarte(fiche, t, t.t(nomCleDe(c.code))) }),
      numeroTheme ? el("span", { classe: "salle-etiquette__numero", texte: numeroTheme }) : null,
      statut(t, c, etat),
      boutonDeCarte(c, t, etat),
    ),
  );
  const carte = cartouche({ jeu: c.code, etiquette, favori: etoileDe(c, t, opts.epingle), attrs: { "data-jeu": c.code, "data-epingle": opts.epingle ? "oui" : "non" } });
  return pastillesDe(carte, t, jeu, opts.epingle);
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
  // Lot F2 : « 3e entre amis » sous le rang (une ligne du serveur : `rangEntreAmis`, `null` sans ami).
  if (joueur?.rangEntreAmis) contenu.append(el("div", { classe: "portail-tuile-amis", attrs: { id: "classement-amis" }, texte: t.t("portail.classement.entreAmis", { rang: formatRang(joueur.rangEntreAmis.rang, langue) }) }));
  return el("a", { classe: "portail-tuile-lien", attrs: { id: "classement", href: "classement/", "data-cle": "classement" } }, contenu);
}

/** Lot I3 — « Partager ma journée » dès qu'au moins un jeu est fini aujourd'hui : un seul bouton qui partage ou copie la ligne (elle n'est plus montrée), puis le message. */
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

/**
 * Lot U1 — la petite feuille de la cloche : la dernière nouveauté publiée (un point tant qu'elle n'est pas lue sur cet appareil) et, pour un joueur connu, les réponses non lues de « Mes messages ».
 * Elle remplace la ligne « Nouveautés » de l'accueil et la pastille de l'avatar. `point` : quelque chose n'est pas lu.
 */
function clocheDuPortail(t: T): HTMLElement {
  const { lignes, point } = lignesDeCloche(t, langue, stockage, lecture?.jour ?? null, ""); // lot U4 : les lignes sont partagées avec les autres pages (`clocheLignes.ts`)
  return cloche({
    nom: t.t(point ? "portail.cloche.nonLu" : "portail.cloche.nom"),
    point,
    ouverte: clocheOuverte,
    titre: t.t("portail.cloche.titre"),
    fermer: t.t("portail.cloche.fermer"),
    lignes,
    vide: t.t("portail.cloche.vide"),
    onBasculer: () => basculerCloche(),
  });
}

/** Ouvre ou ferme la feuille de la cloche ; le focus entre dans la feuille à l'ouverture et revient à la cloche à la fermeture. */
function basculerCloche(ouvrir = !clocheOuverte): void {
  if (ouvrir === clocheOuverte) return;
  clocheOuverte = ouvrir;
  rendre();
  const cible = ouvrir ? document.querySelector<HTMLElement>(".salle-feuille__ligne, .salle-feuille__fermer") : document.getElementById("cloche");
  cible?.focus();
}

/** La semaine en lampes (7 jours, du lundi au dimanche) : celle du serveur (`joueur.semaine`) ; pour un visiteur, une semaine éteinte (c'est exact : il n'a rien joué) ; `null` tant que le serveur n'a pas répondu. */
function lampesDeLaSemaine(t: T, day: number, semaine: readonly JourDeSemaine[] | undefined, neuf: boolean): Lampe[] | null {
  const lundi = day - (((day + 4) % 7) + 6) % 7;
  const jours: JourDeSemaine[] | null = semaine ? [...semaine] : neuf ? Array.from({ length: 7 }, (_, i) => ({ date: formatDay(lundi + i), etat: "rien" as const })) : null;
  if (!jours) return null;
  const locale = langue === "fr" ? "fr-FR" : "en-GB";
  const lettre = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  const nomDuJour = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  return jours.map((j): Lampe => {
    const d = parseDay(j.date) ?? day;
    const instant = new Date(`${j.date}T12:00:00Z`);
    const aujourdhui = d === day;
    const etat = aujourdhui && j.etat === "jouee" ? "moitie" : j.etat === "parfaite" ? "parfaite" : j.etat === "jouee" ? "jouee" : "rien";
    const cle = etat === "parfaite" ? "portail.semaine.parfaite" : etat === "moitie" ? "portail.semaine.encours" : etat === "jouee" ? "portail.semaine.jouee" : d > day ? "portail.semaine.avenir" : "portail.semaine.rien";
    return { lettre: lettre.format(instant), nom: t.t("portail.semaine.nom", { jour: nomDuJour.format(instant), etat: t.t(cle) }), etat, aujourdhui };
  });
}

// --- Lot U1, partie 2 : la colonne de droite ----------------------------------------------------------------------------------------------------------
/** Une photo (ou les initiales) : l'avatar d'un joueur de la colonne de droite (décoratif : son pseudo est écrit à côté). */
const avatarDe = (t: T, o: { pseudo: string; ref?: string; avatar?: string }): HTMLElement => avatar(t, { pseudo: o.pseudo, ref: o.ref, image: adresseAvatar(baseApi(), o.avatar), decoratif: true });

/** Il y a combien de temps (« à l'instant », « il y a 12 min », « il y a 3 h »), sur l'heure du serveur. */
function ilYa(t: T, at: number): string {
  const minutes = Math.max(0, Math.floor((maintenant() - at) / 60_000));
  if (minutes < 1) return t.t("portail.amis.alInstant");
  return minutes < 60 ? t.t("portail.amis.minutes", { n: minutes }) : t.t("portail.amis.heures", { n: Math.floor(minutes / 60) });
}

/** « Ta journée » : la progression, la série et le classement du jour, « Partager ma journée ». Un visiteur : le mot de bienvenue. */
function panneauJournee(t: T, o: { neuf: boolean; finis: number; total: number; avecStatuts: boolean }): HTMLElement {
  const tuiles = el("div", { classe: "portail-tuiles" }, ...[o.neuf ? null : tuileSerie(t), tuileClassement(t, o.neuf)].filter((e): e is HTMLElement => e !== null));
  return panneau(
    { id: "panneau-journee", titre: t.t("portail.journee.titre") },
    o.neuf ? el("p", { classe: "portail-accueil", attrs: { id: "accueil" }, texte: t.t("portail.accueil") }) : null,
    o.avecStatuts && o.total > 0 ? progression({ total: o.total, finis: o.finis, aria: t.t("portail.avancement", { n: o.finis, total: o.total }) }) : null,
    tuiles.childElementCount > 0 ? tuiles : null,
    partage(t),
  );
}

/** Une ligne du classement entre amis : le rang, la photo, le pseudo, le temps (ou « 1 sur 2 » tant que la journée n'est pas finie). */
function ligneAmis(t: T, l: LigneEntreAmis, total: number): HTMLElement {
  const temps = l.tempsMs !== null ? formatTemps(l.tempsMs, langue) : t.t("portail.vue.faits", { n: l.faits, total });
  return el(
    "li",
    { classe: ["salle-rang", l.moi && "salle-rang--moi"], attrs: l.moi ? { "data-moi": "" } : {} },
    el("span", { classe: "salle-rang__place", texte: l.rang !== null ? formatRang(l.rang, langue) : "–" }), // i18n-ok: le tiret des sans-rang
    avatarDe(t, l),
    el("span", { classe: "salle-rang__nom", texte: l.moi ? t.t("portail.vue.moi") : l.pseudo }),
    el("span", { classe: "salle-rang__temps", texte: temps }),
  );
}

/** « Classement du jour » : Tous · Amis · Mon groupe (Amis par défaut quand tu as des amis). Les 3 premiers entre amis et ta ligne ; « Tous » et « Mon groupe » donnent ta place et mènent au classement entier. */
function panneauClassement(t: T, total: number): HTMLElement | null {
  const joueur = lecture?.jour?.joueur;
  if (!joueur) return null;
  const amis = joueur.classementAmis ?? null;
  const groupe = joueur.groupe ?? null;
  const vue = vueClassement === "groupe" && !groupe ? null : vueClassement === "amis" && !amis ? null : vueClassement;
  const actif = vue ?? (amis ? "amis" : "tous");
  const choix = [{ id: "tous", texte: t.t("portail.vue.tous") }, ...(joueur.nbAmis ? [{ id: "amis", texte: t.t("portail.vue.amis") }] : []), ...(groupe ? [{ id: "groupe", texte: t.t("portail.vue.groupe") }] : [])];
  let contenu: HTMLElement;
  if (actif === "amis" && amis) {
    const lignes = [...amis.top, ...(amis.top.some((l) => l.moi) ? [] : [amis.moi])];
    contenu = el("ol", { classe: "salle-rangs", attrs: { id: "classement-amis-liste" } }, ...lignes.map((l) => ligneAmis(t, l, total)));
  } else if (actif === "groupe" && groupe) {
    contenu = el("p", { classe: "salle-vue-texte", attrs: { id: "classement-groupe-texte" }, texte: groupe.rang !== null ? t.t("portail.vue.groupeRang", { rang: formatRang(groupe.rang, langue), n: groupe.sur }) : t.t("portail.vue.groupeMoins") });
  } else {
    const rang = joueur.rangDuJour;
    const texte = el("p", { classe: "salle-vue-texte", attrs: { id: "classement-tous-texte" }, texte: rang ? t.t("portail.statut.rang", { rang: formatRang(rang, langue), classes: formatNombre(joueur.classesDuJour ?? rang, langue) }) : t.t("portail.classement.inviter") });
    // L'aperçu : les 3 premiers de tous et ta ligne (la copie gardée ne l'a pas : le texte seul, puis la réponse fraîche apporte la liste).
    const tous = joueur.classementTous ?? null;
    const lignes = tous && tous.top.length > 0 ? [...tous.top, ...(tous.moi && !tous.top.some((l) => l.moi) ? [tous.moi] : [])] : [];
    contenu = lignes.length > 0 ? el("div", { classe: "salle-vue" }, el("ol", { classe: "salle-rangs", attrs: { id: "classement-tous-liste" } }, ...lignes.map((l) => ligneAmis(t, l, total))), texte) : texte;
  }
  return panneau(
    { id: "panneau-classement", titre: t.t("portail.classement.legende") },
    choix.length > 1 ? selecteurDeVue({ aria: t.t("portail.vue.aria"), choix, actif, onChoix: (id) => { vueClassement = id as typeof vueClassement; rendre(); } }) : null,
    contenu,
    el("a", { classe: "salle-lien", attrs: { href: actif === "groupe" ? "classement/?mode=groupes" : "classement/", id: "classement-tout" }, texte: t.t(actif === "groupe" ? "portail.vue.groupeVoir" : "portail.vue.toutVoir") }),
  );
}

/** « Tes amis aujourd'hui » : jusqu'à 6 amis (photo de 48 px, ce qu'ils ont fait, un carré par jeu du jour). Sans ami : l'action qui manque, en une ligne. */
function panneauAmis(t: T, jeuxDuJour: readonly CarteJeu[]): HTMLElement | null {
  const joueur = lecture?.jour?.joueur;
  if (!joueur) return null;
  const amis = joueur.amisDuJour ?? [];
  if (!joueur.nbAmis) return panneau({ id: "panneau-amis", titre: t.t("portail.amis.titre") }, el("a", { classe: "salle-lien salle-lien--seul", attrs: { href: "amis/", id: "amis-ajouter" }, texte: t.t("portail.amis.ajouter") }));
  if (!joueur.amisDuJour) return null; // la copie gardée n'a pas la liste : la réponse fraîche l'apporte
  const nomDuJeu_ = (site: string) => t.t(nomCleDe(site as Jeu));
  const quand = (a: AmiDuJour): string =>
    a.parfaite ? t.t("portail.amis.parfaite") : a.dernier ? t.t("portail.amis.dernier", { jeu: nomDuJeu_(a.dernier.site), quand: ilYa(t, a.dernier.at) }) : t.t("portail.statut.pasJoue");
  return panneau(
    { id: "panneau-amis", titre: t.t("portail.amis.titre") },
    el(
      "ul",
      { classe: "salle-amis", attrs: { id: "amis-du-jour" } },
      ...amis.map((a) =>
        el(
          "li",
          { classe: "salle-ami" },
          avatarDe(t, a),
          el("span", { classe: "salle-ami__texte" }, el("span", { classe: "salle-ami__nom", texte: a.pseudo }), el("small", { texte: quand(a) })),
          el(
            "span",
            { classe: "salle-ami__jeux" },
            ...jeuxDuJour.map((c) => {
              const fait = a.faits.includes(c.code);
              return el("i", { classe: fait ? "on" : undefined, attrs: { role: "img", "aria-label": t.t(fait ? "portail.amis.fait" : "portail.amis.pasFait", { jeu: nomDuJeu_(c.code) }) } }, nomDuJeu_(c.code).charAt(0).toLocaleUpperCase());
            }),
          ),
        ),
      ),
    ),
    el("a", { classe: "salle-lien", attrs: { href: "amis/", id: "amis-liste" }, texte: t.t("portail.amis.liste") }),
  );
}

/** « Ton groupe » : l'emblème, le nom, les membres et la place du jour. Sans groupe : l'action qui manque, en une ligne. */
function panneauGroupe(t: T): HTMLElement | null {
  const joueur = lecture?.jour?.joueur;
  if (!joueur || joueur.groupe === undefined) return null;
  const g = joueur.groupe;
  if (!g) return panneau({ id: "panneau-groupe", titre: t.t("portail.groupe.titre") }, el("a", { classe: "salle-lien salle-lien--seul", attrs: { href: "profil/", id: "groupe-creer" }, texte: t.t("portail.groupe.aucun") }));
  const rang = g.rang !== null ? t.t("portail.vue.groupeRang", { rang: formatRang(g.rang, langue), n: g.sur }) : t.t("portail.vue.groupeMoins");
  return panneau(
    { id: "panneau-groupe", titre: t.t("portail.groupe.titre") },
    el(
      "div",
      { classe: "salle-groupe" },
      emblemeDeGroupe({ initiales: [...g.nom.replace(/[^\p{L}\p{N}]/gu, "")].slice(0, 2).join("").toLocaleUpperCase(langue === "fr" ? "fr-FR" : "en-US"), image: adresseAvatar(baseApi(), g.avatar) }),
      el("span", { classe: "salle-groupe__texte" }, el("span", { classe: "salle-groupe__nom", texte: g.nom }), el("small", { texte: t.t("portail.groupe.ligne", { membres: t.t("portail.groupe.membres", { n: g.membres }), rang }) })),
    ),
    el("a", { classe: "salle-lien", attrs: { href: `groupe/${encodeURIComponent(g.nom)}`, id: "groupe-voir" }, texte: t.t("portail.groupe.voir") }),
  );
}

/** Une étagère de cartouches (celle des jeux du jour, ou celle de la salle d'arcade) : les jeux épinglés d'abord, tous de la même taille. */
function etagereDe(t: T, cartesMontrees: readonly CarteJeu[], parJeu: Map<string, JeuDuJour>, jour: Lecture["jour"] | undefined, neuf: boolean, o: { id: string; favoris: readonly string[]; arcade?: boolean }): HTMLElement {
  return el(
    "div",
    { classe: ["portail-etagere", "salle-etagere", o.arcade && "salle-etagere--arcade"], attrs: { id: o.id } },
    ...cartesMontrees.map((c) => {
      const j = parJeu.get(c.jeu);
      // Un joueur inconnu du serveur n'a rien joué : « Pas encore joué » ; sans identité, pareil (rien à attendre).
      const etat = j?.etat ?? (jour && neuf && lecture?.erreur !== "code_revoked" ? ({ statut: "pas_joue" } as const) : undefined);
      const jeu = j ? { ...j, etat } : etat ? { jeu: c.jeu, numero: c.numero, theme: null, seuils: null, premierJour: "", etat } : undefined;
      const opts = { epingle: o.favoris.includes(c.code) };
      return o.arcade ? cartoucheArcade(c, t, jeu, opts) : cartoucheDe(c, t, jeu, opts);
    }),
  );
}

// --- Lot F1 : Mes jeux ------------------------------------------------------------------------------------------------------------------
/**
 * Le toucher d'une étoile. Un joueur que le serveur connaît : la liste change tout de suite à l'écran, puis part au serveur (la liste entière, une écriture à la fois) ; un refus ou une panne
 * remet la liste d'avant avec un message discret. Un visiteur (sans profil connu du serveur) : la liste reste dans son navigateur, reprise dans son profil à sa création.
 */
function basculerFavori(site: string): void {
  const jour = lecture?.jour;
  const avant = listeAffichee(jour?.joueur?.favoris, !!jour?.joueur, favorisLocaux);
  const apres = basculer(avant, site);
  messageFavoris = null;
  const id = stockage ? readPlayerId(stockage) : null;
  if (!jour?.joueur || !id) {
    favorisLocaux = { jeux: apres, attente: true };
    ecrireFavorisLocaux(stockage, favorisLocaux);
    rendre();
    return;
  }
  const precedent = jour.joueur.favoris;
  jour.joueur = { ...jour.joueur, favoris: apres };
  rendre();
  ecrituresFavoris = ecrituresFavoris.then(async () => {
    const r = await reseauFavoris().then((m) => m.enregistrerFavoris(baseApi(), id, apres), () => ({ ok: false as const, code: "network" })); // le module introuvable (hors ligne) est un échec comme un autre
    const actuel = lecture?.jour;
    if (r.ok && actuel?.joueur) {
      actuel.joueur = { ...actuel.joueur, ...r.data };
      favorisLocaux = { jeux: r.data.favoris ?? [], attente: false };
      ecrireFavorisLocaux(stockage, favorisLocaux);
      garderJour(stockage, actuel, true);
    } else if (!r.ok) {
      if (actuel?.joueur) actuel.joueur = { ...actuel.joueur, favoris: precedent };
      const t = traduire(langue);
      messageFavoris = t.t(cleConnue(`erreur.${r.code}`) ?? "portail.favoris.echec");
    }
    rendre();
  });
}

/**
 * Après la lecture du jour : la liste du serveur fait foi pour un joueur qu'il connaît (le navigateur la recopie) ; si le serveur n'a rien et que le visiteur avait fait une liste
 * avant d'avoir un profil, elle est reprise dans son profil (une écriture, une fois).
 */
async function reprendreFavoris(): Promise<void> {
  const joueur = lecture?.jour?.joueur;
  const id = stockage ? readPlayerId(stockage) : null;
  if (!joueur || !id) return;
  if (!aReprendre(joueur.favoris, favorisLocaux)) return;
  const r = await reseauFavoris().then((m) => m.enregistrerFavoris(baseApi(), id, favorisLocaux.jeux), () => null);
  if (!r) return;
  if (r.ok && lecture?.jour?.joueur) {
    lecture.jour.joueur = { ...lecture.jour.joueur, ...r.data };
    favorisLocaux = { jeux: r.data.favoris ?? [], attente: false };
    ecrireFavorisLocaux(stockage, favorisLocaux);
    rendre();
  }
}

/** Le serveur connaît le joueur et a répondu : sa liste est celle de ce navigateur (sauf une liste de visiteur encore à reprendre). */
function recopierFavorisDuServeur(): void {
  const joueur = lecture?.jour?.joueur;
  if (!joueur || aReprendre(joueur.favoris, favorisLocaux)) return;
  const jeux = joueur.favoris ?? [];
  if (jeux.join() === favorisLocaux.jeux.join() && !favorisLocaux.attente) return;
  favorisLocaux = { jeux, attente: false };
  ecrireFavorisLocaux(stockage, favorisLocaux);
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
  const toutes = cartes(day).filter((c) => (jour ? parJeu.has(c.jeu) : c.numero > 0));
  // Lot A3 : les jeux d'arcade ont leur salle ; ils ne comptent ni dans « n fini sur m », ni dans la journée, ni dans la ligne de partage.
  const estArcade = (c: CarteJeu) => categorieDuJeu(c.code, day, parJeu.get(c.jeu)) === "arcade";
  const montrees = toutes.filter((c) => !estArcade(c));
  const statuts = jour?.joueur ? montrees.map((c) => parJeu.get(c.jeu)!) : [];
  const { finis, total } = avancement(statuts, jour?.joueur?.jeuxDuJour);
  // Lot U1 : plus de section « Mes jeux » — un jeu épinglé passe en tête de sa zone (jeux du jour, ou salle d'arcade).
  const favoris = listeAffichee(jour?.joueur?.favoris, !!jour?.joueur, favorisLocaux);
  const duJour = epinglesEnTete(montrees, favoris);
  const arcade = epinglesEnTete(toutes.filter(estArcade), favoris);
  const sansFavori = !duJour.some((c) => favoris.includes(c.code));
  const pourDemain = !!jour?.joueur && choixPourDemain(favoris, statuts.filter(compteAujourdhui).map((j) => j.site ?? ""), jour.joueur.jeuxDuJour);
  const neuf = !identite.exists || lecture?.erreur === "unknown_player";
  const journee = jour ? (jour.journee ?? null) : numeroDeJournee(day);
  const texteMessage = message(t);
  const items = [
    { id: "aujourdhui" as const, texte: t.t("portail.nav.aujourdhui"), court: t.t("portail.nav.aujourdhui") },
    { id: "classements" as const, texte: t.t("portail.nav.classements"), court: t.t("portail.nav.classements") },
    { id: "amis" as const, texte: t.t("portail.nav.amis"), court: t.t("portail.nav.amis.court") },
    { id: "profil" as const, texte: t.t("portail.nav.profil"), court: t.t("portail.nav.profil") },
  ];
  const joueur = jour?.joueur;
  const lampes = lampesDeLaSemaine(t, day, joueur?.semaine, neuf);
  const legendeSemaine = joueur ? t.t("portail.semaine.legende", { serie: t.t("portail.semaine.serie", { n: joueur.serie }), parfaites: t.t("portail.serie.parfaites", { n: joueur.journeesParfaites }) }) : "";
  const bandeauAnnonce_ = bandeau(t);
  const avis = [
    ...(nouveauDepart ? [avisNouveauDepart(t, { onFermer: () => (nouveauDepart = false) })] : []),
    // Lot 53 : sur iPhone, hors du mode application, la ligne « Partager › Sur l'écran d'accueil » (une seule fois : fermée, elle ne revient pas).
    ...[stockage ? astuceIphone({ textes: () => ({ astuce: t.t("pleinEcran.iphone"), fermer: t.t("pleinEcran.iphone.fermer") }), stockage }) : null].filter((e): e is HTMLElement => e !== null),
  ];
  racine.replaceChildren(
    ...(bandeauAnnonce_ ? [el("div", { classe: "salle-avis" }, bandeauAnnonce_)] : []),
    el("h1", { classe: "dj-cache", texte: t.t("portail.titre") }),
    barreSalle({
      logo: logo(t),
      navigation: navigation({ items, ici: "aujourdhui", aria: t.t("portail.nav.aria"), place: "haut" }),
      langue: choixLangue(t, { langue, onChange: changerLangue }),
      cloche: clocheDuPortail(t),
      avatar: avatar(t, {
        pseudo: identite.exists ? identite.name : null,
        href: "profil/",
        image: adresseAvatar(baseApi(), joueur?.avatar), // lot C1, partie B : son image (absente : ses initiales)
      }),
    }),
    ...(avis.length > 0 ? [el("div", { classe: "salle-avis" }, ...avis)] : []),
    fronton({
      date: formatDate(day, langue, { capitale: true }),
      // Lot I3 : le numéro de la journée commune (le serveur fait foi ; sinon la constante recopiée) ; rien avant le 23/10/2026.
      journee: journee ? t.t("portail.journee", { numero: formatNumeroJour(journee, langue) }) : null,
      semaine: semaineEnLampes({ lampes, legende: legendeSemaine, aria: t.t("portail.semaine.aria") }),
      compte: compteDuFronton({ legende: t.t("portail.compte.legende"), valeur: formatCompte(prochainMinuit(lecture?.jour ?? null, maintenant()) - maintenant()) }),
    }),
    el(
      "div",
      { classe: "salle-page" },
      el(
        "div",
        { classe: "salle-gauche" },
        el(
          "section",
          { classe: "salle-zone", attrs: { "aria-labelledby": "portail-jeux-titre" } },
          titreDeZone({
            id: "portail-jeux-titre",
            texte: t.t("portail.jeux.titre"),
            droite: el("span", { classe: "portail-jeux__avancement", attrs: { id: "avancement" }, texte: statuts.length ? t.t("portail.avancement", { n: finis, total }) : "" }),
          }),
          // Sans favori : la ligne courte qui invite à épingler (inutile avec un seul jeu). Avec des favoris : le choix qui vient d'être fait compte dès demain.
          sansFavori && montrees.length > 1 ? el("p", { classe: "portail-favoris__note", attrs: { id: "favoris-invite" }, texte: t.t("portail.favoris.invite") }) : null,
          pourDemain ? el("p", { classe: "portail-favoris__note", attrs: { id: "favoris-demain", role: "status" }, texte: t.t("portail.favoris.demain") }) : null,
          etagereDe(t, duJour, parJeu, jour, neuf, { id: "jeux", favoris }),
        ),
        // Lot A3 (refait au lot U1) : la salle d'arcade — un fond rayé de deux tons sombres, les cartouches claires dessus ; sur téléphone elles passent à l'horizontale.
        ...(arcade.length > 0
          ? [
              el(
                "section",
                { classe: "salle-arcade", attrs: { "aria-labelledby": "portail-arcade-titre" } },
                el("div", { classe: "salle-arcade__tete" }, el("h2", { classe: "salle-arcade__titre", attrs: { id: "portail-arcade-titre" }, texte: t.t("portail.arcade.titre") }), el("p", { classe: "salle-arcade__texte", texte: t.t("portail.arcade.sous") })),
                etagereDe(t, arcade, parJeu, jour, neuf, { id: "arcade", favoris, arcade: true }),
              ),
            ]
          : []),
        ...(texteMessage ? [el("p", { classe: "portail-message", attrs: { id: "message", role: "status" }, texte: texteMessage })] : []),
        ...(messageFavoris ? [el("p", { classe: "portail-message", attrs: { id: "message-favoris", role: "status" }, texte: messageFavoris })] : []),
      ),
      // La colonne de droite (360 px sur grand écran, sous les jeux sur téléphone) : Ta journée, Classement du jour, Tes amis aujourd'hui, Ton groupe (lot U1, partie 2).
      el(
        "aside",
        { classe: "salle-droite", attrs: { "aria-label": t.t("portail.journee.titre") } },
        panneauJournee(t, { neuf, finis, total, avecStatuts: statuts.length > 0 }),
        panneauClassement(t, total),
        panneauAmis(t, montrees),
        panneauGroupe(t),
        // Lot C1 : « Un bug ? Une idée ? » en bouton visible (plus seulement un lien du pied).
        boutonRetours(t.t("portail.retours.lien"), langue),
      ),
    ),
    el(
      "footer",
      { classe: "portail-pied salle-pied" },
      el("p", { texte: t.t("portail.pied") }),
      el(
        "div",
        { classe: "portail-pied__liens" },
        lienDiscord(t.t("portail.discord")),
        lienKofi(t.t("portail.kofi")),
      ),
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: cheminMentions(langue), hreflang: langue }, texte: t.t("portail.mentions") }),
    ),
    // La barre d'onglets du téléphone (fixe, en bas) : la même navigation, avec des icônes.
    navigation({ items, ici: "aujourdhui", aria: t.t("portail.nav.aria"), place: "bas" }),
  );
  if (focus) racine.querySelector<HTMLElement>(`[data-cle="${focus}"]`)?.focus();
}

/** Les boutons Discord et Ko-fi du pied : le composant du socle (`lienCommunaute`, lot S1), le même aspect que sur l'accueil des jeux. */
const lienDiscord = (texte: string): HTMLElement => lienCommunaute("discord", texte, "discord");
const lienKofi = (texte: string): HTMLElement => lienCommunaute("kofi", texte, "kofi");

// --- Le compte à rebours (heure du serveur) -----------------------------------------------------------------------------------
let minuterie: ReturnType<typeof setTimeout> | null = null;

/** Une seconde de plus : le chiffre change (sans animation) ; à zéro, le nouveau jour est relu. */
function battre(): void {
  if (minuterie) clearTimeout(minuterie);
  const fin = prochainMinuit(lecture?.jour ?? null, maintenant());
  const reste = fin - maintenant();
  const valeur = document.querySelector("#compte .salle-compte__valeur");
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
  // Le serveur n'a pas répondu alors que la copie est à l'écran : elle reste (la page n'est pas vidée), avec le message discret.
  lecture = !l.jour && depuisLaCopie && lecture?.jour ? { ...l, jour: lecture.jour, decalage: lecture.decalage } : l;
  depuisLaCopie = false;
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
  recopierFavorisDuServeur();
  if (l.jour) garderJour(stockage, l.jour, readIdentity(stockage).exists);
  // Lot N2 : le message de la réponse est semé (aucune requête de plus au chargement) ; la surveillance démarre une fois.
  if (l.jour) surveillance.semer(l.jour.annonce ?? null, l.decalage);
  if (!surveillanceActive) {
    surveillanceActive = true;
    surveillance.activer();
  }
  rendre();
  battre();
  void reprendreFavoris();
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

/** Échap ferme la feuille de la cloche, un toucher ailleurs aussi (une seule fois, au démarrage). */
function surveillerCloche(): void {
  document.addEventListener("keydown", (e) => {
    if (clocheOuverte && e.key === "Escape") basculerCloche(false);
  });
  document.addEventListener("click", (e) => {
    if (clocheOuverte && e.target instanceof Element && !e.target.closest(".salle-cloche")) basculerCloche(false);
  });
}

async function demarrer(): Promise<void> {
  surveillerCloche();
  // Recette et aperçus seulement : `/?demo=joueur` installe le joueur de démonstration (absent de la construction de production).
  if (__PORTAIL_DEMO__ && new URLSearchParams(location.search).get("demo") === "joueur") {
    const racine = document.getElementById("portail");
    const { lienDemo } = await import("./demo");
    if (racine) await lienDemo(stockage, langue, racine);
  }
  // La dernière réponse du serveur, s'il y en a une valable (même jour, même joueur) : la page est complète tout de suite, la réponse fraîche la corrige.
  const copie = stockage ? jourGarde(stockage, parisDay(Date.now()), Date.now(), readIdentity(stockage).exists) : null;
  if (copie) {
    lecture = { jour: copie, decalage: 0, erreur: null };
    depuisLaCopie = true;
  }
  rendre();
  battre();
  proposerRetrouver();
  await charger(null);
}

void demarrer();
