import { msUntilNextParisDay, parisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import { identityRevisionSeen, readPlayerId, type OuAnnonce } from "@cdj/profile";
import { activerManette } from "@cdj/ui/src/manetteLien";
import { barreJeu, bouton, creerCadre, el, etiquetteDe, formatDecompte, type Jeu, type TraducteurCommun } from "@cdj/ui";
import { noterGeneration, brancherInterrupteur, messageALaDemande } from "../branche";
import { gameStorage } from "../stockage";
import type { Donnees } from "./donnees";
import { creerI18n, type I18n } from "./i18n";
import { creerDessin, creerFond, habillerPage } from "./peau";
import { baseDeLaPage, choisirJour, lireOptions, serieLocale, type OptionsUrl } from "./session";
import type { ClassementJeu } from "./source";
import type { DefinitionJeu, FicheClient, OptionsBrancher } from "./types";

// Lot K4f — **`brancherJeu(fiche, definition, options)`** : l'assemblage côté jeu d'un jeu neuf. Le jeu donne sa fiche (le sous-ensemble que lit le client), sa définition (simulation, rendu, aide) et ses
// catalogues ; le kit branche tout le reste, à partir des briques de `@cdj/kit` et `@cdj/ui` : la génération de données, l'interrupteur et l'aperçu, la langue, l'accueil (record, série, classement du jour, décompte,
// « Comment jouer », Réglages, Discord et Ko-fi, le message en direct, la version), puis — **à la demande**, dès que l'accueil est affiché — la partie (boucle à pas fixe, HUD compact, pause, arrivée, envoi et sa
// file, records, classement avec Amis et Mon groupe, ligne à partager, « Jeu suivant du jour »), la manette (M1) et les commandes réglables (M2). **Le premier chargement est l'accueil seul.**
// Track, Jump et Tower ne l'utilisent pas.

/** Le délai avant l'unique nouvel essai de la lecture du classement de l'accueil (lot « manques de Blocks »). */
export const DELAI_REESSAI_CLASSEMENT_MS = 2000;

/** Les ids que la manette et les tests visent. */
export const IDS = { accueil: "jeu-accueil", jouer: "jeu-jouer", aide: "jeu-bouton-aide", archives: "jeu-bouton-archives", reglages: "jeu-bouton-reglages", classement: "jeu-tout-le-classement" } as const;

export interface JeuBranche {
  i18n: I18n;
  options: OptionsUrl;
}

export async function brancherJeu<C>(fiche: FicheClient, def: DefinitionJeu<C>, o: OptionsBrancher<C>): Promise<JeuBranche> {
  const options = lireOptions(location.search);
  noterGeneration(() => options.api === "demo");
  // La manette : le moteur des menus se charge à la première manette (jamais avant).
  activerManette(() => import("./manette"));
  const base = baseDeLaPage(options);
  try {
    if (base) await brancherInterrupteur(fiche.id, fiche.nom, base, options.apercu);
  } catch {
    /* stockage ou réseau refusé : le jeu s'ouvre comme avant */
  }
  const i18n = creerI18n(o.catalogues, gameStorage());
  await i18n.charger();
  document.documentElement.lang = i18n.langue;
  document.title = i18n.t("page.titre");
  habillerPage(fiche.id, def.peau); // lot « écrans du kit » : la peau du jeu (étiquette de la fiche, accent)
  void accueil(fiche, def, o, options, i18n);
  return { i18n, options };
}

const communs = (i18n: I18n): TraducteurCommun => i18n.socle() as unknown as TraducteurCommun;

async function accueil<C>(fiche: FicheClient, def: DefinitionJeu<C>, o: OptionsBrancher<C>, options: OptionsUrl, i18n: I18n): Promise<void> {
  const { t } = i18n;
  const musique = o.musique;
  musique.scene("menu");
  musique.baisser(1);
  const aujourdhui = parisDay(Date.now());
  const choix = choisirJour(options.seed, aujourdhui);
  const jour = choix.jour;
  const date = formatDay(jour);
  const stockage = gameStorage();
  // Lot « manques de Blocks » : `?theme=<code>` (hors production, code de la fiche) force le thème de la page — pour l'essayer en un clic, pour tout jeu branché ; la partie qui en résulte est un essai, jamais classé.
  const themeForce = options.theme !== null && fiche.themes.includes(options.theme) ? options.theme : null;
  const theme = themeForce ?? def.themeDuJour(jour);
  document.documentElement.dataset.theme = theme;

  // --- Le squelette, dessiné tout de suite ---
  const hoteMessage = el("div", { classe: "message-direct" });
  const tour = def.numero(jour);
  const etiquette = etiquetteDe(fiche.id as Jeu, {
    titre: t(`jeu.${fiche.id}.nom`).toUpperCase(),
    texte: tour >= 1 ? t("kit.accueil.numero", { numero: tour, theme: t(`theme.${theme}`) }) : t("kit.accueil.sansNumero", { theme: t(`theme.${theme}`) }),
  });
  const replique = el("p", { classe: "jeu-replique", texte: t(`accueil.phrase.${theme}`) });
  const recordValeur = el("span", { classe: "jeu-tuile__valeur", attrs: { id: "jeu-record" }, texte: "—" });
  const recordSous = el("span", { classe: "jeu-tuile__sous", texte: t("kit.accueil.record.aucun") });
  const serieValeur = el("span", { classe: "jeu-tuile__valeur", attrs: { id: "jeu-serie" }, texte: "—" });
  const tuiles = el(
    "div",
    { classe: "jeu-tuiles" },
    el("div", { classe: "jeu-tuile" }, el("span", { classe: "jeu-tuile__legende", texte: t("kit.accueil.record") }), recordValeur, recordSous),
    el("div", { classe: "jeu-tuile jeu-tuile--serie" }, el("span", { classe: "jeu-tuile__legende", texte: t("kit.accueil.serie") }), serieValeur),
  );
  const jouer = bouton({ texte: t("kit.accueil.jouer"), variante: "marque" }) as HTMLButtonElement;
  jouer.id = IDS.jouer;
  jouer.classList.add("jeu-jouer");
  const secondaire = (id: string, cle: string): HTMLButtonElement => {
    const b = bouton({ texte: t(cle), variante: "secondaire" }) as HTMLButtonElement;
    b.id = id;
    return b;
  };
  const aide = secondaire(IDS.aide, "kit.accueil.aide");
  // Lot K5 : « Archives » — le jeu dit ce qu'il ouvre (`o.archives`) ; sans lui le bouton est désactivé (charte § 5 : aplat, bordure pointillée) et dit « Bientôt ».
  const archives = secondaire(IDS.archives, "kit.accueil.archives");
  if (o.archives) archives.addEventListener("click", o.archives);
  else {
    archives.disabled = true;
    archives.append(el("small", { texte: t("kit.accueil.bientot") }));
  }
  const reglages = secondaire(IDS.reglages, "kit.accueil.reglages");
  const attente = el("p", { classe: "jeu-attente", attrs: { role: "status", id: "jeu-attente" } });
  // Lot B1 : une partie d'essai (scénario, réglage…) que le jeu déclare non classable — le jour reste celui d'aujourd'hui, la partie n'est ni classée ni envoyée.
  const essai = def.classable?.(location.search) === false || themeForce !== null;
  const noteArchive = choix.archive || choix.refuse || essai ? el("p", { classe: "jeu-archive", attrs: { role: "status", id: "jeu-archive" }, texte: choix.refuse ? t("kit.accueil.pasEncore") : choix.archive ? t("kit.fin.archive") : t("kit.fin.essai") }) : null;
  const suite = el("div", { classe: "suite-du-jour", attrs: { hidden: true, id: "suite-du-jour" } });
  const classementTitre = el("span", { classe: "jeu-tuile__legende", texte: t("kit.accueil.classement") });
  const classementListe = el("ol", { classe: "jeu-rangs", attrs: { id: "jeu-classement" } });
  const classementMessage = el("p", { classe: "jeu-message", attrs: { role: "status" }, texte: t("kit.classement.chargement") });
  const toutLeClassement = el("button", { classe: "jeu-lien", attrs: { type: "button", id: IDS.classement, hidden: true }, texte: t("kit.accueil.toutLeClassement") });
  const decompte = el("b", { classe: "jeu-decompte", attrs: { id: "jeu-decompte" } });
  const profil = el("a", { classe: "jeu-lien", attrs: { href: "../profil/", id: "jeu-profil" }, texte: t("kit.accueil.profil") });

  const cadre = creerCadre({
    id: IDS.accueil,
    etiquette: "jeu-ecran jeu-ecran--accueil",
    barre: () => barreJeu(communs(i18n), { href: "../", jour, ...(tour >= 1 ? { numero: tour } : {}), pleinEcran: true }),
    aria: () => t("kit.accueil.aria"),
  });
  // Lot K5 — l'accueil aux proportions de celui de Tower (charte § 9, planche 1 de `jeux-du-kit-au-niveau.html`) : deux colonnes équilibrées dans l'étiquette. À gauche l'identité : le titre dans la police du jeu, « Partie n° N · Thème »,
  // l'illustration, la réplique, le record et la série, JOUER puis Comment jouer · Archives · Réglages. À droite : le panneau « Aujourd'hui » (propre au jeu : `o.aujourdhui`), le classement du jour avec ta ligne, le pied.
  // Sous 760 px les deux colonnes s'empilent dans cet ordre. Le décor du thème du jour est derrière, sous le voile à rayures ; il reste derrière les écrans que l'accueil ouvre.
  const dessin = creerDessin(def.peau);
  // Le panneau « Aujourd'hui » : la légende porte le thème ; le jeu remplit le corps. Sans `o.aujourdhui`, le panneau montre seulement le thème et la réplique (le kit ne dessine rien de propre au jeu).
  const aujourdhuiCorps = el("div", { classe: "jeu-aujourdhui__corps" }, ...(o.aujourdhui ? [] : [replique]));
  const panneauAujourdhui = el("section", { classe: "jeu-tuile" }, el("span", { classe: "jeu-tuile__legende", texte: `${t("kit.accueil.aujourdhui")} · ${t(`theme.${theme}`)}` }), aujourdhuiCorps);
  const gauche = el(
    "div",
    { classe: "jeu-accueil__gauche" },
    hoteMessage,
    el("div", { classe: "jeu-accueil__tete" }, etiquette, dessin),
    ...(o.aujourdhui ? [replique] : []),
    tuiles,
    ...(noteArchive ? [noteArchive] : []),
    jouer,
    attente,
    el("div", { classe: "jeu-secondaires" }, aide, archives, reglages),
  );
  const panneau = el("section", { classe: "jeu-tuile jeu-accueil__classement", attrs: { "aria-label": t("kit.accueil.classement") } }, classementTitre, classementMessage, classementListe, toutLeClassement);
  const droite = el("div", { classe: "jeu-accueil__droite" }, panneauAujourdhui, panneau, el("div", { classe: "jeu-pied" }, el("span", {}, `${t("kit.accueil.prochaine")} `, decompte), profil));
  cadre.corps.classList.add("jeu-accueil");
  cadre.corps.append(gauche, droite);
  cadre.pied.append(suite);
  cadre.racine.hidden = false;
  const fond = creerFond(def.peau, theme);
  o.racine.append(fond, cadre.racine);
  document.documentElement.dataset.ready = "true";
  void import("@cdj/ui/src/liensCommunauteJeu").then((m) => cadre.racine.append(m.liensCommunaute()));

  // --- Le décompte jusqu'à minuit à Paris ; à zéro la page se recharge sur la nouvelle partie ---
  const majDecompte = (): void => {
    const reste = msUntilNextParisDay(Date.now());
    decompte.textContent = formatDecompte(reste);
    if (reste <= 0) location.reload();
  };
  majDecompte();
  const minuteur = setInterval(majDecompte, 1000);

  // --- Le message en direct : à la demande, jamais en partie ---
  const message = options.apercu || baseDeLaPage(options) ? messageALaDemande(() => import("../message").then((m) => m.monterMessageEnDirect({ base: baseDeLaPage(options)!, stockage, ou: fiche.id as OuAnnonce, hotes: { accueil: hoteMessage, arrivee: el("div"), pause: el("div") }, langue: () => i18n.langue, traducteur: () => i18n.socle() }))) : null;
  if (baseDeLaPage(options)) message?.montrer("accueil");

  // --- Les données (records, série, classement) : un module à la demande, après le premier dessin ---
  let donnees: Donnees | null = null;
  const prets = import("./donnees").then((m) => (donnees = m.creerDonnees(fiche, options)));
  const ctxPartie = import("./partie"); // préchargé : JOUER n'attend plus que le contenu du jour
  ctxPartie.catch(() => undefined);
  let classement: ClassementJeu | null = null;
  const contenuP = def.contenuDuJour(jour, document.baseURI, theme);
  contenuP.catch(() => undefined);
  // Lot K5 : le panneau « Aujourd'hui » se remplit quand le contenu du jour est lu ; une erreur du jeu ne casse jamais l'accueil.
  if (o.aujourdhui) void contenuP.then((c) => o.aujourdhui!(c, aujourdhuiCorps, { t, langue: i18n.langue, theme, jour, date })).catch(() => undefined);

  const idJoueur = (): string | null => readPlayerId(stockage ?? { getItem: () => null });
  const dessinerClassement = (indisponible = false): void => {
    classementListe.replaceChildren();
    toutLeClassement.hidden = true;
    if (!classement) {
      classementMessage.hidden = false;
      classementMessage.textContent = t(indisponible ? "kit.classement.indisponible" : "kit.classement.chargement");
      return;
    }
    classementTitre.textContent = `${t("kit.accueil.classement")} · ${t("kit.classement.participants", { n: classement.participants })}`;
    classementMessage.hidden = classement.participants > 0;
    classementMessage.textContent = classement.participants > 0 ? "" : t("kit.classement.vide");
    const lignes = classement.top.slice(0, 3);
    if (classement.me && !lignes.some((l) => l.rank === classement!.me!.rank)) lignes.push(classement.me);
    for (const l of lignes) {
      const moi = classement.me?.rank === l.rank && classement.me?.name === l.name;
      classementListe.append(el("li", { classe: ["rang", moi && "rang--moi"] }, el("span", { classe: "rang__rang", texte: String(l.rank) }), el("span", { classe: "rang__nom", texte: l.name }), el("span", { classe: "rang__score", texte: def.formatScore(fiche.colonnes.map((c) => Number(l[c.nom] ?? 0)), i18n.langue, i18n.t) })));
    }
    toutLeClassement.hidden = classement.participants === 0;
  };
  dessinerClassement();

  void prets.then(async (d) => {
    // Révision d'identité de la plateforme (lot P4) : un code chargé dans un autre jeu change le profil de ce navigateur ; les records gardés ici appartenaient à l'ancien.
    try {
      if (stockage && identityRevisionSeen(stockage, `${fiche.prefixe}identite:vue`) === "code") d.records.effacer(stockage);
    } catch {
      /* stockage refusé */
    }
    const records = d.records.lire(stockage);
    const r = records[date];
    if (r) {
      recordValeur.textContent = def.formatScore(r.score, i18n.langue, i18n.t);
      recordSous.textContent = r.medaille ? t("kit.accueil.record.sous", { medaille: t(`medaille.${r.medaille === "author" ? "diamant" : r.medaille === "gold" ? "or" : r.medaille === "silver" ? "argent" : "bronze"}`), envoi: t(r.envoye ? "kit.envoi.deja" : "kit.fin.horsLigne") }) : t(r.envoye ? "kit.envoi.deja" : "kit.fin.horsLigne");
    }
    serieValeur.textContent = t("kit.accueil.serie.jours", { n: serieLocale(Object.keys(records), aujourdhui) });
    if (!d.source) return dessinerClassement(true);
    const pid = idJoueur();
    if (pid) d.envoi.offrir(); // ce qui attendait d'être envoyé (une partie jouée hors ligne) repart
    let [b, moi] = await Promise.all([d.source.board(date, pid), pid ? d.source.moi(pid) : Promise.resolve(null)]);
    // Lot « manques de Blocks » (« Classement indisponible pour le moment » vu en recette) : une panne passagère — l'instance du serveur qui se réveille, un délai dépassé — se réessaie UNE fois, 2 s plus tard, avant de dire « indisponible » ; l'accueil reste « Chargement… » entre-temps.
    if (!b.ok) {
      await new Promise((r) => setTimeout(r, DELAI_REESSAI_CLASSEMENT_MS));
      b = await d.source.board(date, pid);
    }
    if (b.ok) {
      d.suivreGeneration(b.data);
      classement = b.data;
    }
    if (moi?.ok) {
      d.suivreGeneration(moi.data);
      serieValeur.textContent = t("kit.accueil.serie.jours", { n: moi.data.stats.streak });
    }
    dessinerClassement(!b.ok);
    // Déjà classé : il reste peut-être un autre jeu du jour (« Jeu suivant du jour », à la demande).
    if (b.ok && b.data.me && pid && !choix.archive) {
      const s = await import("../suite").then((m) => m.chargerSuite(d.base, pid, fiche.id));
      if (s) void import("../suite").then((m) => { suite.hidden = false; suite.replaceChildren(...m.elementsDeSuite(s, i18n.t, ["suite-jeu-suivant", "suite-parfaite", "suite-portail"], ["legende", "suite-du-jour__parfaite"], "kit.suite.legende")); });
    }
    if (baseDeLaPage(options)) void import("./version").then((m) => m.monterVersion(fiche, def, d, options, i18n));
  });

  // --- « Comment jouer » : une fois au premier lancement, puis à la demande ; Réglages ; le classement en dialogue (modules à la demande) ---
  const ctx = () => ({ fiche, def, o, options, i18n, donnees: donnees!, jour, date, theme, archive: choix.archive, essai, musique });
  let aideMontee: Awaited<ReturnType<typeof import("./aide")["monterAide"]>> | null = null;
  // Lot « écrans du kit » : la feuille de ces écrans est celle du morceau de la partie (préchargé dès l'accueil) : on l'attend avant de les ouvrir.
  const feuilles = async (): Promise<void> => {
    await prets;
    await ctxPartie.catch(() => undefined);
  };
  const ouvrirAide = async (): Promise<void> => {
    await feuilles();
    const m = await import("./aide");
    aideMontee ??= m.monterAide(ctx());
    aideMontee.ouvrir();
  };
  aide.addEventListener("click", () => void ouvrirAide());
  void import("./aide").then(async (m) => {
    await prets;
    if (!m.aideDejaVue(fiche, stockage)) void ouvrirAide();
  });
  let reglagesMontes: Awaited<ReturnType<typeof import("./reglages")["monterReglages"]>> | null = null;
  reglages.addEventListener("click", async () => {
    await feuilles();
    const m = await import("./reglages");
    reglagesMontes ??= m.monterReglages(ctx());
    reglagesMontes.ouvrir();
  });
  let dialogue: Awaited<ReturnType<typeof import("./classement")["monterClassement"]>> | null = null;
  toutLeClassement.addEventListener("click", async () => {
    await feuilles();
    const m = await import("./classement");
    dialogue ??= m.monterClassement(ctx(), () => idJoueur());
    dialogue.ouvrir(classement);
  });

  // --- JOUER : attend ce qui manque (le contenu du jour, la partie), puis lance ---
  let enCours = false;
  jouer.addEventListener("click", async () => {
    if (enCours) return;
    enCours = true;
    jouer.disabled = true;
    const lent = setTimeout(() => (attente.textContent = t("kit.accueil.attente")), 250);
    try {
      await prets;
      const [contenu, partie] = await Promise.all([contenuP, ctxPartie]);
      clearTimeout(lent);
      clearInterval(minuteur);
      message?.montrer(null);
      cadre.racine.remove();
      fond.remove();
      await partie.demarrerPartie({ ...ctx(), contenu, classementConnu: classement?.me != null, retour: () => location.reload() });
    } catch {
      clearTimeout(lent);
      attente.textContent = t("kit.accueil.echec");
      enCours = false;
      jouer.disabled = false;
    }
  });
}
