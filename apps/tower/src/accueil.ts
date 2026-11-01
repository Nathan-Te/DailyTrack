import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/polices/rubik-mono-one-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "./base.css";
import "./accueil.css";
import { msUntilNextParisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import { identityRevisionSeen, readPlayerId } from "@cdj/profile";
import type { Musique } from "@cdj/musique/branche";
import { barreJeu, el, formatDecompte, formatNombre, nomMedaille, type TraducteurCommun } from "@cdj/ui";
import type { ClassementTower, MoiTower } from "./apiTower";
import { monterClassement } from "./classementUi";
import { estArchive } from "./jourPasse";
import { petiteTour } from "./composants";
import { formatHauteur, formatPalier } from "./formatHauteur";
import { appliquerDocument, chargerLangue, langueCourante, t, traducteurDuSocle } from "./i18n";
import { lignesDeLAccueil, nombreDeClasses } from "./classementUi";
import { hoteMessage, monterMessage, type MessageDirect } from "./messageDirect";
import { TYPE_MEDAILLE } from "./medailles";
import { chargerPalette, paletteCourante, poserPalette } from "./palette";
import type { Preparation } from "./preparation";
import { effacerRecords, lireRecords, serieLocale } from "./records";
import { creerSession, type Session, suivreGeneration } from "./session";
import { CLE_IDENTITE_VUE, gameStorage } from "./stockage";
import { choisirJour, type OptionsUrl, PRODUCTION } from "./urlOptions";

// L'accueil de Tower (lot T4) — maquette `docs/tower/maquettes/tower-accueil.html` : l'étiquette menthe dans sa coque, sur la scène, sous le voile à rayures ; à gauche le titre, « Tour n° N · Thème »,
// la réplique du thème, ton record et ta série, JOUER et « Comment jouer » ; à droite les paliers du jour (le mot « bonus » ou « malus » toujours écrit), le classement du jour (les trois premiers, « … »,
// ta ligne en moutarde, « Tout le classement › »), « Prochaine tour dans » et « Mon profil Du Jour › ; le message en direct sur l'étiquette.
//
// **C'est le premier chargement, et lui seul** : l'interface, l'identité, la lecture du serveur, les catalogues. Il n'embarque ni three.js, ni la simulation (`Partie`), ni Rapier. Le contenu du jour (le
// générateur, les paliers) est un morceau à part chargé dès que la page est dessinée ; le jeu (la scène, la partie, le HUD, la fin) et Rapier se PRÉCHARGENT dès que l'accueil est affiché. JOUER attend
// ce qui manque, avec une ligne d'attente. Le décor sous le voile est un aplat du thème (CSS) tant que la scène n'est pas là : jamais d'écran blanc.
//
// Lot T7 : les boutons « Archives » et « Réglages » de la maquette (retirés au lot T4) sont là — leurs écrans sont à la demande (`archives.ts`, `reglages.ts`) ; l'accueil est centré dans la
// fenêtre (`accueil.css`) ; une tour passée (`?seed=` d'un jour passé, ouverte depuis les Archives) le dit : « Archive : cette tour n'est pas classée ». Le serveur est facultatif : sans lui (ou hors ligne) tout est lu du navigateur et le classement dit
// qu'il est indisponible.

const MESSAGE_HORS_LIGNE = "classement.indisponible";

interface Etat {
  options: OptionsUrl;
  session: Session;
  racine: HTMLElement;
  preparation: Preparation | null;
  classement: ClassementTower | null;
  moi: MoiTower | null;
  /** Le classement a été demandé et n'a pas répondu (ou pas de serveur). */
  classementIndisponible: boolean;
}

/** Les morceaux qui se chargent pendant que le joueur lit l'accueil. */
interface Prechargement {
  jeu: Promise<typeof import("./jeu")>;
  rapier: Promise<import("@cdj/tower-sim").Rapier>;
}

function precharger(): Prechargement {
  const jeu = import("./jeu");
  const rapier = import("@cdj/tower-sim/rapier").then((m) => m.chargerRapier());
  // Un échec de préchargement n'est pas une erreur de la page : JOUER le dira (et réessaiera).
  jeu.catch(() => undefined);
  rapier.catch(() => undefined);
  return { jeu, rapier };
}

const communs = (): TraducteurCommun => traducteurDuSocle() as unknown as TraducteurCommun;

export async function demarrerAccueil(options: OptionsUrl, musique: Musique): Promise<void> {
  musique.scene("menu"); // lot « musique » : l'accueil joue la boucle du menu (le jeu annonce ensuite la scène de son thème)
  musique.baisser(1);
  await chargerLangue();
  appliquerDocument();
  const racine = document.getElementById("tower")!;
  const session = creerSession(options);
  const etat: Etat = { options, session, racine, preparation: null, classement: null, moi: null, classementIndisponible: false };
  const stockage = gameStorage();
  // Révision d'identité de la plateforme (lot P4) : un code chargé dans un autre jeu depuis la dernière visite change le profil de ce navigateur ; les records gardés ici appartenaient à
  // l'ancien. Rotation, création ou première visite : même profil, rien n'est effacé (`identityRevisionSeen` note la révision comme vue dans tous les cas).
  try {
    if (stockage && identityRevisionSeen(stockage, CLE_IDENTITE_VUE) === "code") effacerRecords(stockage);
  } catch {
    /* stockage refusé : rien à comparer */
  }

  // --- Le squelette, dessiné tout de suite (le contenu du jour arrive juste après) ---
  const fond = el("div", { classe: "accueil__fond", attrs: { "aria-hidden": "true" } }, el("div", { classe: "accueil__sol" }));
  const barre = el("div", { classe: "accueil__barre" });
  const hoteAccueil = hoteMessage();
  const titre = el("h1", { classe: "accueil__titre", texte: t("accueil.titre") });
  const tour = el("span", { classe: "accueil__tour" });
  const dessin = el("span", { classe: "accueil__dessin" }, petiteTour());
  const replique = el("p", { classe: "accueil__replique" });
  const recordValeur = el("span", { classe: "accueil__valeur", attrs: { id: "accueil-record" } });
  const recordSous = el("span", { classe: "accueil__sous" });
  const serieValeur = el("span", { classe: "accueil__valeur", attrs: { id: "accueil-serie" } });
  const serieSous = el("span", { classe: "accueil__sous" });
  const tuileRecord = el("div", { classe: "accueil__tuile accueil__tuile--record" }, el("span", { classe: "legende", texte: t("accueil.record") }), recordValeur, recordSous);
  const tuileSerie = el("div", { classe: "accueil__tuile accueil__tuile--serie" }, el("span", { classe: "legende legende--papier", texte: t("accueil.serie") }), serieValeur, serieSous);
  const jouer = el("button", { classe: "bouton-jouer accueil__jouer", attrs: { type: "button", id: "accueil-jouer" }, texte: t("accueil.jouer") });
  const attente = el("p", { classe: "accueil__attente", attrs: { role: "status", id: "accueil-attente" } });
  const aide = el("button", { classe: "dj-bouton dj-bouton--secondaire accueil__aide", attrs: { type: "button", id: "accueil-aide" }, texte: t("accueil.aide") });
  const archives = el("button", { classe: "dj-bouton dj-bouton--secondaire accueil__aide", attrs: { type: "button", id: "accueil-archives" }, texte: t("accueil.archives") });
  const reglages = el("button", { classe: "dj-bouton dj-bouton--secondaire accueil__aide", attrs: { type: "button", id: "accueil-reglages" }, texte: t("accueil.reglages") });
  const secondaires = el("div", { classe: "accueil__secondaires" }, aide, archives, reglages);
  // Une tour passée (ouverte depuis les Archives) : une ligne le dit, avec le retour à la tour du jour.
  const choix = choisirJour(options.seed, session.aujourdhui, PRODUCTION);
  const archive = options.scenario === "jour" && estArchive(choix.jour, session.aujourdhui);
  const noteArchive = el("p", { classe: "accueil__archive", attrs: { role: "status", id: "accueil-archive", hidden: !archive } }, el("span", { texte: t("accueil.archive.note") }), el("a", { classe: "accueil__lien", attrs: { href: location.pathname, id: "accueil-archive-retour" }, texte: t("accueil.archive.retour") }));
  const hoteDeSuite = el("div", { classe: "suite-du-jour", attrs: { hidden: true } }); // rempli par `jeuSuivant.ts`, chargé à la demande (lot TP)
  const gauche = el("div", { classe: "accueil__gauche" }, hoteAccueil, el("div", { classe: "accueil__tete" }, el("div", { classe: "accueil__titres" }, titre, tour), dessin), replique, el("div", { classe: "accueil__tuiles" }, tuileRecord, tuileSerie), noteArchive, jouer, attente, secondaires, hoteDeSuite);

  const paliersTitre = el("span", { classe: "legende" });
  const paliersListe = el("ul", { classe: "accueil__paliers", attrs: { id: "accueil-paliers" } });
  const tuilePaliers = el("section", { classe: "accueil__tuile accueil__tuile--paliers", attrs: { hidden: true, "aria-label": t("accueil.paliers.aria") } }, paliersTitre, paliersListe);
  const classementTitre = el("span", { classe: "legende" }, t("accueil.classement"));
  const classementListe = el("ol", { classe: "rangs", attrs: { id: "accueil-classement" } });
  const classementMessage = el("p", { classe: "accueil__message", attrs: { role: "status" } });
  const toutLeClassement = el("button", { classe: "accueil__lien", attrs: { type: "button", id: "accueil-tout-le-classement", hidden: true }, texte: t("accueil.toutLeClassement") });
  const tuileClassement = el("section", { classe: "accueil__tuile accueil__tuile--classement", attrs: { "aria-label": t("classement.titre") } }, classementTitre, classementMessage, classementListe, toutLeClassement);
  const decompte = el("b", { classe: "accueil__decompte", attrs: { id: "accueil-decompte" } });
  const profil = el("a", { classe: "accueil__lien accueil__profil", attrs: { href: "../profil/", id: "accueil-profil" }, texte: t("accueil.profil") });
  const pied = el("div", { classe: "accueil__pied" }, el("span", {}, `${t("accueil.prochaine")} `, decompte), profil);
  const droite = el("div", { classe: "accueil__droite" }, tuilePaliers, tuileClassement, pied);

  const coque = el("main", { classe: "coque coque--accueil", attrs: { role: "dialog", "aria-modal": "true", "aria-label": t("accueil.aria") } }, el("div", { classe: "coque__stries", attrs: { "aria-hidden": "true" } }), el("div", { classe: "etiquette-tower etiquette-tower--accueil" }, gauche, droite));
  const voile = el("div", { classe: "voile voile--accueil", attrs: { id: "accueil-ecran" } }, el("div", { classe: "accueil__colonne" }, barre, coque));
  /** Le décor sous le voile : un aplat du thème (le ciel, le sol), posé depuis la palette courante — le port tant que le thème du jour n'est pas connu. Jamais un écran blanc. */
  function habillerFond(): void {
    const palette = paletteCourante();
    fond.style.setProperty("--accueil-ciel", palette.ciel);
    fond.style.setProperty("--accueil-sol", palette.sol);
  }
  habillerFond();
  racine.append(fond, voile);
  // Lot S1 : Discord et Ko-fi, deux plaques discrètes en bas à gauche de l'accueil (à la demande ; elles sont dans l'écran d'accueil, donc jamais en partie).
  void import("@cdj/ui/src/liensCommunauteJeu").then((m) => coque.append(m.liensCommunaute()));
  document.documentElement.dataset.ready = "true";

  // Le message en direct (accueil et arrivée) : un seul bandeau, jamais pendant une partie.
  let message: MessageDirect | null = null;
  if (session.base) {
    message = monterMessage({ base: session.base, stockage, hotes: { accueil: hoteAccueil, arrivee: hoteMessage() } });
    message.montrer("accueil");
  }

  // Le décompte jusqu'à minuit à Paris ; à zéro la page se recharge sur la nouvelle tour.
  const majDecompte = (): void => {
    const reste = msUntilNextParisDay(Date.now());
    decompte.textContent = formatDecompte(reste);
    if (reste <= 0) location.reload();
  };
  majDecompte();
  const minuteur = setInterval(majDecompte, 1000);

  const records = lireRecords(stockage);
  /** Le jour dont l'accueil montre le classement : celui de la tour affichée (aujourd'hui, ou une archive). */
  const dateDuJour = formatDay(choix.jour);
  const majBarre = (numero: number | null): void => {
    barre.replaceChildren(barreJeu(communs(), { href: "../", jour: choix.jour, ...(numero !== null ? { numero } : {}) })); // la date de la tour affichée (aujourd'hui, ou une archive)
  };
  majBarre(null);

  // --- Le classement et la série : lus du serveur s'il répond, sinon du navigateur ---
  const dessinerClassement = (): void => {
    const b = etat.classement;
    classementListe.replaceChildren();
    toutLeClassement.hidden = true;
    if (!b) {
      classementTitre.textContent = t("accueil.classement");
      classementMessage.textContent = etat.classementIndisponible ? t(MESSAGE_HORS_LIGNE) : t("classement.chargement");
      classementMessage.hidden = false;
      return;
    }
    classementTitre.textContent = `${t("accueil.classement")} · ${nombreDeClasses(b.participants)}`;
    classementMessage.hidden = b.participants > 0;
    classementMessage.textContent = b.participants > 0 ? "" : t("classement.vide");
    classementListe.append(...lignesDeLAccueil(b));
    toutLeClassement.hidden = b.participants === 0;
  };
  const dessinerSerie = (): void => {
    const serie = etat.moi?.stats.streak ?? serieLocale(lireRecords(stockage), session.aujourdhui, formatDay);
    const medailles = etat.moi ? Object.values(etat.moi.stats.medals).reduce((n, x) => n + x, 0) : Object.values(lireRecords(stockage)).filter((r) => r.medaille !== null).length;
    serieValeur.textContent = t("accueil.serie.jours", { n: serie });
    serieSous.textContent = t("accueil.serie.medailles", { n: medailles });
  };
  dessinerClassement();
  dessinerSerie();
  const lectures = async (): Promise<void> => {
    if (!session.source) {
      etat.classementIndisponible = true;
      return dessinerClassement();
    }
    const pid = readPlayerId(stockage ?? { getItem: () => null });
    const [b, m] = await Promise.all([session.source.board(dateDuJour, pid), pid ? session.source.towerMe(pid) : Promise.resolve(null)]);
    if (b.ok) {
      suivreGeneration(b.data);
      etat.classement = b.data;
    } else etat.classementIndisponible = true;
    if (m?.ok) {
      suivreGeneration(m.data);
      etat.moi = m.data;
    }
    dessinerClassement();
    dessinerSerie();
    // Lot TP : déjà classé aujourd'hui, il reste peut-être un autre jeu du jour : « Jeu suivant du jour » (module du jeu, chargé seulement alors).
    if (b.ok && b.data.me && pid && !archive) {
      const m2 = await import("./jeuSuivant");
      const suite = await m2.chargerSuite(session.base, pid);
      if (suite) m2.poserSuite(hoteDeSuite, suite);
    }
  };
  void lectures();
  // Ce qui attendait d'être envoyé (une partie jouée hors ligne) repart ; sans identité encore, rien à envoyer.
  if (readPlayerId(stockage ?? { getItem: () => null })) session.envoi.offrir();

  // --- Le contenu du jour : un morceau à part (le générateur), chargé dès que la page est dessinée ; le jeu et la physique se préchargent dès que l'accueil est affiché ---
  const prep = import("./preparation").then((m) => m.preparerJour(options, session.aujourdhui));
  prep.catch(() => undefined);
  let pre = precharger();

  // --- Comment jouer : une fois au premier lancement, puis à la demande ---
  let aideMontee: Awaited<ReturnType<typeof import("./commentJouer").monterAide>> | null = null;
  const ouvrirAide = async (): Promise<void> => {
    const m = await import("./commentJouer");
    aideMontee ??= m.monterAide(racine, { tactile: session.tactile, surFermeture: () => m.marquerAideVue(stockage) });
    aideMontee.ouvrir();
  };
  aide.addEventListener("click", () => void ouvrirAide());
  void import("./commentJouer").then((m) => {
    if (!m.aideDejaVue(stockage)) void ouvrirAide();
  });

  // --- Le classement en dialogue ---
  let dialogueClassement: ReturnType<typeof monterClassement> | null = null;
  toutLeClassement.addEventListener("click", () => {
    dialogueClassement ??= monterClassement(racine);
    dialogueClassement.ouvrir(etat.classement, etat.classement ? "ok" : "indisponible");
  });

  // --- Lot T7 : Réglages et Archives, deux écrans à la demande (rien au premier chargement) ---
  const jourBarre = (): { jour: number; numero: number | null } => ({ jour: etat.preparation?.jour ?? session.aujourdhui, numero: etat.preparation?.numero ?? null });
  let reglagesMontes: Awaited<ReturnType<typeof import("./reglages").monterReglages>> | null = null;
  reglages.addEventListener("click", async () => {
    const [m, sonsM, joueurM] = await Promise.all([import("./reglages"), import("./reglagesSons"), import("./reglagesJoueur")]);
    reglagesMontes ??= m.monterReglages(racine, {
      jour: jourBarre,
      musique: () => musique.lecteur(),
      sons: { lire: () => sonsM.lireSons(stockage), ecrire: (r) => sonsM.ecrireSons(stockage, r) },
      reglages: { lire: () => joueurM.lireReglagesJoueur(stockage), ecrire: (r) => joueurM.ecrireReglagesJoueur(stockage, r) },
      tactile: session.tactile,
      profilHref: "../profil/?retour=/tower/",
    });
    reglagesMontes.ouvrir();
  });
  let archivesMontees: Awaited<ReturnType<typeof import("./archives").monterArchives>> | null = null;
  archives.addEventListener("click", async () => {
    const m = await import("./archives");
    archivesMontees ??= m.monterArchives(racine, {
      aujourdhui: session.aujourdhui,
      jour: jourBarre,
      stockage,
      jours: async () => {
        if (etat.moi) return etat.moi.days;
        const pid = readPlayerId(stockage ?? { getItem: () => null });
        const r = session.source && pid ? await session.source.towerMe(pid) : null;
        return r?.ok ? r.data.days : [];
      },
    });
    archivesMontees.ouvrir();
  });

  // --- JOUER : attend ce qui manque (le contenu, le jeu, la physique), puis lance la partie ---
  let enCours = false;
  jouer.addEventListener("click", async () => {
    if (enCours) return;
    enCours = true;
    jouer.disabled = true;
    const lent = setTimeout(() => (attente.textContent = t("accueil.attente")), 250);
    try {
      const p = await prep;
      const [mod] = await Promise.all([pre.jeu, pre.rapier]);
      clearTimeout(lent);
      clearInterval(minuteur);
      message?.montrer(null);
      voile.remove();
      fond.remove();
      await mod.demarrerJeu({ options, session, preparation: p, rapier: pre.rapier, dejaClasse: etat.classement?.me != null, musique });
    } catch {
      // Un morceau n'a pas pu se charger : on le dit, on le redemande au prochain appui.
      clearTimeout(lent);
      attente.textContent = t("chargement.echec");
      pre = precharger();
      enCours = false;
      jouer.disabled = false;
    }
  });

  async function habiller(p: Preparation): Promise<void> {
    const m = await import("./preparation");
    habillerFond();
    dessin.replaceChildren(petiteTour());
    majBarre(p.numero);
    const theme = t(`theme.${p.theme}`);
    tour.textContent = p.numero !== null ? t("accueil.tour", { numero: formatNombre(p.numero, langueCourante()), theme }) : t("accueil.tourSansNumero", { theme });
    replique.textContent = t(`accueil.phrase.${p.theme}`);
    // Les paliers du jour.
    const paliers = m.paliersDuJour(p.contenu);
    const largeur = Math.round(m.largeurPlateforme(p.contenu));
    paliersTitre.textContent = t("accueil.paliers", { pieces: p.contenu.pieces.length, plateforme: t(`accueil.plateforme.${largeur}`) });
    paliersListe.replaceChildren(
      ...paliers.map((x) =>
        el("li", { classe: ["accueil__palier", x.bonus ? "accueil__palier--bonus" : "accueil__palier--malus"] }, el("b", { classe: "accueil__metres", texte: formatPalier(x.metres) }), el("span", { texte: t(`effet.${x.effet}`) }), el("span", { classe: "accueil__etiquette", texte: t(x.bonus ? "palier.bonus" : "palier.malus") })),
      ),
    );
    tuilePaliers.hidden = paliers.length === 0;
    // Ton record du jour (le navigateur), avec la médaille obtenue et la prochaine à viser.
    const r = records[formatDay(p.jour ?? session.aujourdhui)];
    if (!r) {
      recordValeur.textContent = "—";
      recordSous.textContent = t("accueil.record.aucun");
    } else {
      recordValeur.textContent = formatHauteur(r.hauteurMm);
      const e = m.etatDuRecord(r.hauteurMm, p.medailles.medailles);
      const obtenue = e.obtenue ? nomMedaille(communs(), TYPE_MEDAILLE[e.obtenue]) : null;
      const viseeTexte = e.visee ? { suivante: nomMedaille(communs(), TYPE_MEDAILLE[e.visee.nom]), seuil: formatHauteur(e.visee.seuil) } : null;
      recordSous.textContent = !p.medailles.medailles ? "" : obtenue && viseeTexte ? t("accueil.record.sous", { medaille: obtenue, ...viseeTexte }) : obtenue ? obtenue : viseeTexte ? t("accueil.record.sansMedaille", viseeTexte) : "";
    }
    if (p.refuse) attente.textContent = t("jour.pasEncore");
  }


  try {
    const apercu = await prep;
    etat.preparation = apercu;
    poserPalette(await chargerPalette(apercu.theme));
    await habiller(apercu);
  } catch {
    attente.textContent = t("chargement.echec");
  }
}
