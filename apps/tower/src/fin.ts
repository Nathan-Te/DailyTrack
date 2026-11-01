import type { Resultat, VuePartie } from "@cdj/tower-sim";
import { medailleObtenue, medailleVisee, NOMS_MEDAILLES, TICKS_PAR_SECONDE } from "@cdj/tower-sim";
import type { Suite } from "@cdj/profile";
import { barreJeu, el, formatNombre, formatRang, formatTemps, medaille, nomMedaille, suivreDialogue, type TraducteurCommun } from "@cdj/ui";
import { type EnvoiTower } from "./apiTower";
import { boutonJouer, coeurs, petiteTour } from "./composants";
import type { EtatEnvoi } from "./envoi";
import { formatHauteur, formatPalier } from "./formatHauteur";
import { langueCourante, t, traducteurDuSocle } from "./i18n";
import { hoteSuite, poserSuite } from "./jeuSuivant";
import { type EtatMedailles, SANS_MEDAILLES, TYPE_MEDAILLE } from "./medailles";

// L'écran d'arrivée de Tower (lots T1, T3 et T4) — maquette `tower-arrivee.html` : la barre « ‹ DU JOUR » avec la date et le numéro ; la hauteur stable, la plus haute atteinte (qui ne compte pas), la
// médaille obtenue et les vies, le CLASSEMENT (lot T4 : « 31e sur 96 · nouveau record », ce que le serveur a REJOUÉ ; « hors ligne, non classé » sans serveur ; le formulaire du pseudo au premier envoi), REJOUER,
// Partager (la ligne `Du Jour · Tower #12 — 42,7 m — <médaille> — <cœurs>` : `partage.ts`) et Classement (le classement du jour en dialogue) ; à droite le bloc « Médailles du jour » (« Or : encore 4,094 m »), « Ta
// partie » (pièces posées et tombées, paliers franchis, temps) et le message en direct. « Jeu suivant du jour » n'est **pas dans le DOM** (aucune place vide) : c'est le crochet `portail` de la plateforme
// (lot suivant) qui le branchera. Posé sur la scène, sous le voile à rayures, dans la coque vert sapin de l'étiquette de Tower.

/** Ce que l'arrivée montre d'une partie finie. */
export interface DonneesFin {
  vue: VuePartie;
  r: Resultat;
  /** Les vies au départ (3). */
  vies: number;
  medailles?: EtatMedailles;
  /** Une ligne sous les médailles (la meilleure de la session, le Diamant du bot), déjà écrite. */
  note?: string | null;
  /** Les hauteurs (m) des paliers franchis pendant la partie. */
  franchis?: number[];
  /** La partie peut être classée (le jour d'aujourd'hui, le jeu normal) : sinon le bloc « Classement » n'est pas dans le DOM. */
  classable?: boolean;
  /** Le jour joué et son numéro : la barre « ‹ DU JOUR », la date et le numéro. */
  jour?: number | null;
  numero?: number | null;
}

/** L'état de l'envoi tel que l'arrivée l'affiche. */
export interface VueEnvoi {
  etat: EtatEnvoi;
  /** Ce que le serveur a rejoué pour cette partie, s'il a répondu. */
  reponse: EnvoiTower | null;
  /** Cette partie bat le record du navigateur (même avant que le serveur ait répondu). */
  nouveauRecord: boolean;
  /** Cette partie ne bat pas le record du jour : rien n'est envoyé. */
  pasMieux: boolean;
}

export interface Fin {
  readonly ouverte: boolean;
  readonly hoteMessage: HTMLElement;
  /** Lot TP : « Jeu suivant du jour » (ou la journée parfaite) ; `null` : rien à proposer, l'emplacement reste caché. */
  majSuite(suite: Suite | null): void;
  montrer(d: DonneesFin): void;
  /** Le classement : l'état de l'envoi, la réponse du serveur, le formulaire du pseudo. */
  majEnvoi(v: VueEnvoi): void;
  /** Le résultat du partage (« Copié dans le presse-papiers »), et le texte à sélectionner si rien n'a marché. */
  majPartage(message: string, secours: string | null): void;
  /** Les médailles ont fini de se calculer (le bot, hors production) pendant que l'écran est ouvert. */
  majMedailles(medailles: EtatMedailles): void;
  cacher(): void;
  traduire(): void;
}

export interface OptionsFin {
  onRejouer(): void;
  /** Le haut de l'écran : le contenu joué (« Suite d'essai », la date du jour, « Paliers »). */
  eyebrow(): string;
  onPartager(): void;
  onClassement(): void;
  /** Lot T7 : « Accueil de Tower » (retour à l'accueil du jeu, comme le retour par B à la manette). */
  onAccueil(): void;
  /** Le pseudo choisi dans le formulaire du premier envoi. */
  onPseudo(nom: string): void;
  onRecharger(): void;
}

export function monterFin(racine: HTMLElement, o: OptionsFin): Fin {
  const voile = el("div", { classe: "voile voile--fin", attrs: { id: "fin-ecran", hidden: true } });
  const barre = el("div", { classe: "accueil__barre fin__barre" });
  const coque = el("div", { classe: "coque", attrs: { role: "dialog", "aria-modal": "true" } });
  const eyebrow = el("span", { classe: "fin__eyebrow" });
  const legendeHauteur = el("span", { classe: "legende" });
  const hauteur = el("span", { classe: "fin__hauteur" });
  const plusHaute = el("span", { classe: "fin__max" });
  const replique = el("p", { classe: "fin__replique" });
  const legendeVies = el("span", { classe: "legende legende--papier" });
  const viesHote = el("span", { classe: "fin__coeurs" });
  const tuileVies = el("div", { classe: "fin__tuile fin__tuile--vies" }, legendeVies, viesHote);
  // Lot T3 : la médaille obtenue (à côté des vies), le bloc « Médailles du jour » (colonne de droite) et, hors production, la ligne du Diamant du bot.
  const legendeMedaille = el("span", { classe: "legende" });
  const medailleNom = el("span", { classe: "fin__medaille-nom", attrs: { id: "fin-medaille" } });
  const tuileMedaille = el("div", { classe: "fin__tuile fin__tuile--medaille", attrs: { hidden: true } }, legendeMedaille, medailleNom);
  const legendeMedailles = el("span", { classe: "legende" });
  const grilleMedailles = el("div", { classe: "fin__medailles-grille" });
  const noteMedailles = el("p", { classe: "fin__medailles-note", attrs: { id: "fin-medailles-note" } });
  const noteSession = el("p", { classe: "fin__medailles-note", attrs: { id: "fin-medailles-session", hidden: true } });
  const tuileMedailles = el("div", { classe: "fin__tuile fin__tuile--medailles", attrs: { id: "fin-medailles", hidden: true } }, legendeMedailles, grilleMedailles, noteMedailles, noteSession);
  // Lot T4 : le classement du jour — ce que le serveur a rejoué (rang, « nouveau record »), l'attente, « hors ligne, non classé », le formulaire du pseudo.
  const legendeRang = el("span", { classe: "legende" });
  const rangValeur = el("span", { classe: "fin__rang-valeur", attrs: { id: "fin-rang" } });
  const rangSous = el("span", { classe: "fin__rang-sous", attrs: { id: "fin-rang-statut", role: "status" } });
  const recharger = el("button", { classe: "dj-bouton dj-bouton--secondaire fin__recharger", attrs: { type: "button", id: "fin-recharger", hidden: true } });
  const champ = el("input", { classe: "champ", attrs: { id: "fin-pseudo", type: "text", maxlength: 20, autocomplete: "off" } });
  const pseudoOk = el("button", { classe: "bouton-jouer bouton-jouer--petit", attrs: { type: "submit", id: "fin-pseudo-ok" } });
  const pseudoErreur = el("div", { classe: "fin__erreur", attrs: { role: "alert" } });
  const suggestions = el("div", { classe: "fin__suggestions" });
  const formulaire = el("form", { classe: "fin__pseudo", attrs: { hidden: true } }, champ, pseudoOk, pseudoErreur, suggestions);
  const tuileRang = el("div", { classe: "fin__tuile fin__tuile--rang", attrs: { id: "fin-classement", hidden: true } }, legendeRang, rangValeur, rangSous, recharger, formulaire);
  recharger.addEventListener("click", () => o.onRecharger());
  formulaire.addEventListener("submit", (e) => {
    e.preventDefault();
    o.onPseudo(champ.value);
  });
  const rejouer = boutonJouer("", () => o.onRejouer(), "fin-rejouer");
  const partager = el("button", { classe: "dj-bouton dj-bouton--secondaire", attrs: { type: "button", id: "fin-partager" } });
  const classement = el("button", { classe: "dj-bouton dj-bouton--secondaire", attrs: { type: "button", id: "fin-voir-classement", hidden: true } });
  const accueil = el("button", { classe: "dj-bouton dj-bouton--secondaire", attrs: { type: "button", id: "fin-accueil" } });
  accueil.addEventListener("click", () => o.onAccueil());
  partager.addEventListener("click", () => o.onPartager());
  classement.addEventListener("click", () => o.onClassement());
  const retourPartage = el("p", { classe: "fin__partage", attrs: { role: "status", id: "fin-partage-message" } });
  const secours = el("textarea", { classe: "champ fin__secours", attrs: { readonly: true, rows: 3, hidden: true, id: "fin-partage-texte" } });
  const legendePartie = el("span", { classe: "legende" });
  const ligne = (id: string) => {
    const nom = el("span");
    const valeur = el("b", { attrs: { id } });
    return { racine: el("div", { classe: "fin__ligne" }, nom, valeur), nom, valeur };
  };
  const posees = ligne("fin-posees");
  const tombees = ligne("fin-tombees");
  const franchis = ligne("fin-paliers");
  const temps = ligne("fin-temps");
  const hoteMessage = el("div", { classe: "message-direct message-direct--fin" });
  const suiteHote = hoteSuite();
  const gauche = el(
    "div",
    { classe: "fin__gauche" },
    eyebrow,
    el("div", { classe: "fin__score" }, el("div", { classe: "fin__score-texte" }, legendeHauteur, hauteur, plusHaute), petiteTour()),
    replique,
    el("div", { classe: "fin__rang" }, tuileMedaille, tuileVies, tuileRang),
    rejouer,
    el("div", { classe: "fin__actions" }, partager, classement, accueil),
    retourPartage,
    secours,
    suiteHote,
  );
  const droite = el("div", { classe: "fin__droite" }, tuileMedailles, el("div", { classe: "fin__tuile fin__tuile--partie" }, legendePartie, posees.racine, tombees.racine, franchis.racine, temps.racine), hoteMessage);
  coque.append(el("div", { classe: "coque__stries", attrs: { "aria-hidden": "true" } }), el("main", { classe: "etiquette-tower" }, gauche, droite));
  voile.append(el("div", { classe: "accueil__colonne" }, barre, coque));
  racine.append(voile);
  suivreDialogue(voile, { focusInitial: () => rejouer });

  let ouverte = false;
  let donnees: DonneesFin | null = null;
  let envoi: VueEnvoi | null = null;
  const communs = (): TraducteurCommun => traducteurDuSocle() as unknown as TraducteurCommun;
  /** Le texte d'un code d'erreur : le catalogue commun, sinon une phrase générale. */
  const texteErreur = (code: string): string => {
    const cle = `erreur.${code}`;
    const texte = traducteurDuSocle().t(cle as never);
    return texte === cle ? t("classement.refuse") : texte;
  };
  const dessinerEnvoi = (): void => {
    const d = donnees;
    tuileRang.hidden = !d?.classable;
    classement.hidden = !d?.classable;
    if (!d?.classable) return;
    legendeRang.textContent = t("fin.classement");
    classement.textContent = t("fin.voirClassement");
    recharger.hidden = true;
    formulaire.hidden = true;
    const e = envoi?.etat ?? { statut: "idle", code: "", suggestions: [] };
    const rep = envoi?.reponse ?? null;
    rangValeur.textContent = "—";
    if (envoi?.pasMieux) {
      if (rep) rangValeur.textContent = formatRang(rep.rank, langueCourante());
      rangSous.textContent = t("fin.rang.pasMieux");
    } else if (rep && e.statut !== "name" && e.statut !== "version" && e.statut !== "revoked") {
      rangValeur.textContent = formatRang(rep.rank, langueCourante());
      rangSous.textContent = t(rep.improved ? "fin.rang.record" : "fin.rang.sur", { total: formatNombre(rep.participants, langueCourante()) });
    } else if (e.statut === "sending") {
      rangSous.textContent = t("fin.rang.envoi");
    } else if (e.statut === "version") {
      rangSous.textContent = t("fin.rang.version");
      recharger.hidden = false;
      recharger.textContent = t("fin.recharger");
    } else if (e.statut === "name") {
      rangSous.textContent = t("fin.rang.pseudo");
      formulaire.hidden = false;
      champ.placeholder = t("fin.pseudo");
      champ.setAttribute("aria-label", t("fin.pseudo"));
      pseudoOk.textContent = t("fin.pseudo.ok");
      pseudoErreur.textContent = e.code ? texteErreur(e.code) : "";
      suggestions.replaceChildren(
        ...e.suggestions.map((nom) => {
          const b = el("button", { classe: "dj-bouton dj-bouton--secondaire fin__suggestion", attrs: { type: "button" }, texte: nom });
          b.addEventListener("click", () => {
            champ.value = nom;
            o.onPseudo(nom);
          });
          return b;
        }),
      );
    } else if (e.statut === "revoked" || e.statut === "refused") {
      rangSous.textContent = texteErreur(e.code);
    } else if (e.statut === "offline" || e.statut === "off" || e.statut === "idle") {
      rangSous.textContent = t(e.code === "trop_envois" ? "fin.rang.tropEnvois" : "fin.rang.horsLigne");
    }
  };
  const traduire = () => {
    coque.setAttribute("aria-label", t("fin.aria"));
    eyebrow.textContent = o.eyebrow();
    legendeHauteur.textContent = t("fin.hauteurStable");
    legendeVies.textContent = t("fin.vies");
    legendePartie.textContent = t("fin.partie");
    posees.nom.textContent = t("fin.posees");
    tombees.nom.textContent = t("fin.tombees");
    franchis.nom.textContent = t("fin.paliers");
    temps.nom.textContent = t("fin.temps");
    rejouer.textContent = t("fin.rejouer");
    partager.textContent = t("fin.partager");
    accueil.textContent = t("jeu.accueil");
    if (!donnees) return;
    const { vue, r, vies } = donnees;
    const session = donnees.note ?? null;
    const medailles = donnees.medailles ?? SANS_MEDAILLES;
    barre.replaceChildren(barreJeu(communs(), { href: "../", jour: donnees.jour ?? 0, ...(donnees.numero ? { numero: donnees.numero } : {}) }));
    barre.hidden = donnees.jour == null;
    legendeMedaille.textContent = t("fin.medaille");
    legendeMedailles.textContent = t("fin.medailles");
    tuileMedaille.hidden = tuileMedailles.hidden = !medailles.medailles && !medailles.enCalcul;
    if (medailles.medailles) {
      const m = medailles.medailles;
      const obtenue = medailleObtenue(r.hauteurMm, m);
      medailleNom.textContent = obtenue ? nomMedaille(traducteurDuSocle(), TYPE_MEDAILLE[obtenue]) : t("fin.medaille.aucune");
      // Les quatre médailles, comme la maquette (Bronze, Argent, Or, Diamant) : celle obtenue en aplat, les autres en contour.
      grilleMedailles.replaceChildren(...NOMS_MEDAILLES.map((nom) => medaille(traducteurDuSocle(), { type: TYPE_MEDAILLE[nom], obtenue: nom === obtenue, forme: "case", valeur: formatHauteur(m[nom]) })));
      const visee = medailleVisee(r.hauteurMm, m);
      noteMedailles.replaceChildren();
      noteMedailles.append(visee ? t("fin.medailles.encore", { medaille: nomMedaille(traducteurDuSocle(), TYPE_MEDAILLE[visee.nom]), reste: formatHauteur(visee.reste) }) : t("fin.medailles.toutes"));
      if (medailles.provisoire) noteMedailles.append(` ${t("medailles.provisoire")}.`);
    } else if (medailles.enCalcul) {
      medailleNom.textContent = "…";
      grilleMedailles.replaceChildren();
      noteMedailles.textContent = t("fin.medailles.calcul");
    }
    noteSession.hidden = !session;
    noteSession.textContent = session ?? "";
    hauteur.textContent = formatHauteur(r.hauteurMm);
    plusHaute.textContent = t("fin.plusHaute", { hauteur: formatHauteur(r.hauteurMaxMm) });
    replique.textContent = t(r.motif === "pieces" ? "fin.phrase.pieces" : "fin.phrase.vies");
    viesHote.replaceChildren(coeurs(vies, r.vies, t("hud.vies.aria", { n: r.vies, total: vies })));
    posees.valeur.textContent = `${r.posees}/${vue.total}`;
    tombees.valeur.textContent = String(r.tombees);
    const liste = donnees.franchis ?? [];
    franchis.valeur.textContent = liste.length === 0 ? t("fin.paliers.aucun") : liste.map((m) => formatPalier(m)).join(" · ");
    temps.valeur.textContent = formatTemps((r.ticks * 1000) / TICKS_PAR_SECONDE, langueCourante());
    dessinerEnvoi();
  };
  return {
    get ouverte() {
      return ouverte;
    },
    hoteMessage,
    majSuite(suite) {
      poserSuite(suiteHote, suite);
    },
    montrer(d) {
      donnees = d;
      envoi = null;
      retourPartage.textContent = "";
      secours.hidden = true;
      traduire();
      ouverte = true;
      voile.hidden = false;
    },
    majEnvoi(v) {
      envoi = v;
      dessinerEnvoi();
    },
    majPartage(message, texte) {
      retourPartage.textContent = message;
      secours.hidden = texte === null;
      if (texte !== null) {
        secours.value = texte;
        secours.select();
      }
    },
    majMedailles(medailles) {
      if (!donnees) return;
      donnees = { ...donnees, medailles };
      traduire();
    },
    cacher() {
      ouverte = false;
      voile.hidden = true;
    },
    traduire,
  };
}
