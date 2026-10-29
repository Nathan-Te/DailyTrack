import { lireNouveauDepart } from "@cdj/profile";
import { astuceIphone, avisNouveauDepart, bouton, el, icone, medaille, suivreDialogue } from "@cdj/ui";
import { barreDuJour, onJour } from "./cadre";
import { MEDAL_TYPE } from "./dailyInfo";
import type { EtatDuJour } from "./homeLogic";
import { fNombre, lier, onLangue, t, traducteurDuSocle } from "./i18n";
import type { RankRowView } from "./rankView";

// L'accueil (lot 10, **refait au lot I5** : maquettes `jump-accueil.html` — ordinateur, deux colonnes — et `jump.html` — téléphone, une colonne ; charte
// rév. 6 et 7, § 9). Il est **posé sur la scène du niveau du jour**, derrière un **voile à rayures** (motif net, ni flou ni transparence), avec la barre des
// jeux dans une plaque crème (« ‹ DU JOUR », date et numéro) et **l'étiquette jaune dans sa coque moutarde** (stries de préhension) : « JUMP », le niveau
// et son thème, la réplique du thème, ton record (ou « Pas encore ») et la médaille à viser, ta série Jump, **JOUER** / **CONTINUER** / **REJOUER** selon
// l'état du jour (qui est aussi le geste qui réveille le son), Archives, Comment jouer, Réglages ; à côté (ou dessous sur téléphone) : le carnage du jour
// (les morts de tout le monde), les cinq premiers du classement, le compte à rebours et « Mon profil Du Jour › ». Ouvert, la partie est en pause (aucun pas
// de simulation). DOM seulement : les textes et les données viennent de `homeLogic.ts`, `rankView.ts` et main.ts. Cibles de 44 px au moins.

export interface HomeView {
  title: string;
  subtitle: string;
  replique: string;
  /** La tuile « Ton record » : le temps (ou « Pas encore ») et la médaille à viser. */
  record: { valeur: string; sous: string };
  /** La tuile « Série Jump » : « 3 jours », « 5 médailles ». */
  serie: { valeur: string; sous: string };
  etat: EtatDuJour;
  /** L'état en une ligne (lecteurs d'écran, `__jump.home`). */
  status: string;
  finished: boolean;
  countdown: string;
  /** Lot P1 : « Ton rang du jour : 3e sur 128 » (un temps classé aujourd'hui), sinon "". */
  rank: string;
  /** Le carnage du jour : les morts de tout le monde (carte des morts du serveur), et si l'on peut le voir (ton meilleur essai du jour en héros). */
  carnage: { morts: number; peut: boolean } | null;
  /** Les cinq premiers du classement du jour (et le nombre de classés), ou `null` : pas de classement ici (sans serveur). */
  board: { rows: RankRowView[]; participants: number } | null;
  /** Lot P2 : le code de cet appareil a été remplacé ailleurs (le profil commun le dit). */
  revoked: boolean;
  /** Lot G1 : le fantôme choisi (son nom). */
  fantome: { nom: string };
}

export interface HomeOptions {
  onPlay(): void;
  onSettings(): void;
  onHelp(): void;
  onArchives(): void;
  onBoard(): void;
  onCarnage(): void;
  /** Lot G1 : un toucher sur le fantôme choisi passe au suivant (Aucun compris). */
  onGhost(): void;
  /** `../profil/?retour=/jump/` : le profil commun. */
  profilHref: string;
  /** Lot I7 : le stockage où se souvenir que l'astuce de l'iPhone (plein écran) a été fermée. */
  store?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  onChange?(): void;
}

export interface Home {
  readonly isOpen: boolean;
  /** Le niveau est prêt : Jouer et Réglages répondent (avant : « Préparation du niveau… »). */
  readonly ready: boolean;
  open(view: HomeView): void;
  close(): void;
  update(view: HomeView): void;
  setReady(ready: boolean): void;
  setCountdown(text: string): void;
  /** Remet le focus sur Jouer (fermeture d'un écran ouvert depuis l'accueil). */
  focus(): void;
  /** Lot N2 : l'emplacement du message en direct (sous la barre des jeux) ; vide, il n'occupe aucune place. */
  readonly hoteMessage: HTMLElement;
}

const BOUTON_JOUER: Record<EtatDuJour, string> = { pas_joue: "accueil.jouer", en_cours: "accueil.continuer", fini: "accueil.rejouer" };

/** Une ligne de classement (accueil, écran du classement) : rang, pseudo et ses morts, médaille en pastille, temps ; ta ligne en encre (charte § 9). */
export function ligneClassement(r: RankRowView, avecMedaille: boolean): HTMLElement {
  const nom = el("span", { classe: "ligne__qui" }, el("span", { classe: "ligne__nom", texte: r.name }), el("span", { classe: "ligne__morts", texte: r.deaths }));
  if (r.mine) nom.append(lier(el("span", { classe: "dj-cache" }), "classement.toi"));
  const md = avecMedaille
    ? el("span", { classe: "ligne__medaille" }, r.medal ? medaille(traducteurDuSocle(), { type: MEDAL_TYPE[r.medal], obtenue: true, jeu: "jump" }) : lier(el("span", { classe: "ligne__sans" }), "classement.sansMedaille"))
    : null;
  return el("li", { classe: ["ligne", r.mine && "ligne--moi"] }, el("span", { classe: "ligne__rang", texte: r.rank }), nom, md, el("span", { classe: "ligne__temps", texte: r.time }));
}

export function mountHome(opts: HomeOptions): Home {
  const root = el("div", { classe: "accueil", attrs: { id: "home", role: "dialog", hidden: true } });
  const plaque = el("div", { classe: "accueil__barre" });
  // Le retour au portail garde l'identifiant du lot I2 (`#home-portail`, e2e de apps/web), comme Track au lot I4.
  const majBarre = () => {
    plaque.replaceChildren(barreDuJour({ pleinEcran: true })); // lot I7 : le plein écran à côté de la date, avant de jouer
    plaque.querySelector(".dj-barre-jeu__retour")?.setAttribute("id", "home-portail");
  };
  majBarre();
  onJour(majBarre);
  onLangue(majBarre);

  // ——— Colonne de gauche : le niveau, ton record, ta série, JOUER ———
  const title = el("h1", { classe: "accueil__titre" });
  const subtitle = el("p", { classe: "accueil__niveau" });
  const replique = el("p", { classe: "accueil__replique" });
  const recordValeur = el("span", { classe: "tuile__valeur" });
  const recordSous = el("span", { classe: "tuile__sous" });
  const serieValeur = el("span", { classe: "tuile__valeur" });
  const serieSous = el("span", { classe: "tuile__sous" });
  const tuiles = el(
    "div",
    { classe: "accueil__tuiles" },
    el("div", { classe: "tuile", attrs: { id: "home-record" } }, lier(el("span", { classe: "tuile__legende" }), "accueil.record.legende"), recordValeur, recordSous),
    el("div", { classe: "tuile tuile--encre", attrs: { id: "home-streak" } }, lier(el("span", { classe: "tuile__legende" }), "accueil.serie.legende"), serieValeur, serieSous),
  );
  // Lot G1 : le fantôme choisi, comme un bouton (un toucher passe au suivant : le tien, le premier, aucun).
  const fantome = bouton({ texte: t("fantome.bouton", { nom: "" }), variante: "secondaire", onClick: () => opts.onGhost() }) as HTMLButtonElement;
  fantome.id = "home-ghost";
  fantome.classList.add("accueil__fantome");
  const status = el("p", { classe: "dj-cache", attrs: { id: "home-status", "aria-live": "off" } });
  const play = bouton({ texte: t("page.preparation"), variante: "jump", pleineLargeur: true, desactive: true }) as HTMLButtonElement;
  play.id = "home-play";
  play.classList.add("accueil__jouer");
  const second = (id: string, cle: string, f: () => void) => {
    const b = bouton({ texte: t(cle), variante: "secondaire", onClick: () => f() }) as HTMLButtonElement;
    b.id = id;
    lier(b, cle);
    return b;
  };
  const archives = second("home-archives", "accueil.archives", () => opts.onArchives());
  const help = second("home-help", "accueil.aide", () => opts.onHelp());
  const settings = second("home-settings", "accueil.reglages", () => {
    if (ready) opts.onSettings();
  });
  settings.disabled = true;
  const revoked = el("a", { classe: "accueil__alerte", attrs: { id: "home-revoked", href: opts.profilHref, hidden: true } });
  // Lot I7 : sur iPhone (pas de plein écran de page), une ligne qui dit comment jouer en plein écran ; fermée, elle ne revient pas.
  const astuce = opts.store ? astuceIphone({ textes: () => ({ astuce: t("pleinEcran.iphone"), fermer: t("pleinEcran.iphone.fermer") }), stockage: opts.store }) : null;
  // Lot R8 : « Nouveau départ… », une fois, après la remise à zéro du lancement (le drapeau est retiré à la lecture).
  const depart = opts.store && lireNouveauDepart(opts.store) ? avisNouveauDepart(traducteurDuSocle()) : null;
  const gauche = el("div", { classe: "accueil__gauche" }, el("div", { classe: "accueil__tete" }, title, subtitle), depart, astuce, replique, tuiles, status, play, el("div", { classe: "accueil__actions" }, archives, help, settings), revoked);

  // ——— Colonne de droite : le carnage du jour, le classement, le compte à rebours, le profil ———
  const carnageMorts = el("span", { classe: "carnage-jour__morts" });
  const carnageVoir = second("home-carnage", "accueil.carnage.voir", () => opts.onCarnage());
  carnageVoir.classList.add("carnage-jour__voir");
  const carnageTexte = el("span", { classe: "carnage-jour__texte" });
  const carnage = el("div", { classe: "carnage-jour", attrs: { id: "home-deaths", hidden: true } }, icone("crane", { taille: 40 }), el("div", { classe: "carnage-jour__corps" }, carnageMorts, carnageTexte), carnageVoir);
  const boardTitre = el("span", { classe: "classement-jour__titre" });
  const boardList = el("ol", { classe: "lignes lignes--courtes" });
  const boardVide = lier(el("p", { classe: "classement-jour__vide" }), "accueil.classement.vide");
  const rank = el("p", { classe: "classement-jour__rang", attrs: { id: "home-rank" } });
  const boardAll = el("button", { classe: "lien", attrs: { type: "button", id: "home-board" } });
  lier(boardAll, "accueil.classement.tout");
  boardAll.addEventListener("click", () => opts.onBoard());
  const board = el("div", { classe: "classement-jour", attrs: { id: "home-leaderboard", hidden: true } }, boardTitre, boardList, boardVide, rank, boardAll);
  const countdown = el("span", { classe: "accueil__decompte", attrs: { id: "home-countdown", "aria-live": "off" } });
  const profil = el("a", { classe: "lien", attrs: { id: "home-profil", href: opts.profilHref } });
  lier(profil, "accueil.profil");
  const droite = el("div", { classe: "accueil__droite" }, el("div", { classe: "accueil__fantomes" }, fantome), carnage, board, el("div", { classe: "accueil__pied" }, countdown, profil));

  const etiquette = el("main", { classe: "etiquette etiquette--accueil" }, el("div", { classe: "accueil__grille" }, gauche, droite));
  const coque = el("div", { classe: "coque" }, el("div", { classe: "coque__stries", attrs: { "aria-hidden": "true" } }), etiquette);
  const hoteMessage = el("div", { classe: ["message-direct", "message-direct--accueil"] });
  root.append(plaque, hoteMessage, el("div", { classe: "accueil__defile" }, coque));
  document.body.append(root);
  suivreDialogue(root); // lot I6 : focus mis dedans à l'ouverture, rendu à la fermeture
  // Lot I6 : « JOUER » prend le focus, sauf si un dialogue posé au-dessus de l'accueil l'a (« Comment jouer » à la première visite).
  const focusJouer = () => {
    const dessus = document.activeElement?.closest('[role="dialog"]');
    if (!dessus || dessus === root) play.focus({ preventScroll: true });
  };

  let open = false;
  let ready = false;
  let view: HomeView | null = null;
  const changed = () => opts.onChange?.();

  const show = (v: HomeView) => {
    view = v;
    root.setAttribute("aria-label", t("accueil.aria"));
    title.textContent = v.title;
    subtitle.textContent = v.subtitle;
    replique.textContent = v.replique ? t("commun.citation", { texte: v.replique }) : "";
    recordValeur.textContent = v.record.valeur;
    recordSous.textContent = v.record.sous;
    serieValeur.textContent = v.serie.valeur;
    serieSous.textContent = v.serie.sous;
    status.textContent = v.status;
    fantome.textContent = t("fantome.bouton", { nom: v.fantome.nom });
    if (ready) lier(play, BOUTON_JOUER[v.etat]);
    play.dataset.etat = v.etat;
    rank.textContent = v.rank;
    rank.hidden = v.rank === "";
    countdown.textContent = v.countdown;
    revoked.hidden = !v.revoked;
    if (v.revoked) revoked.textContent = t("erreur.code_revoked");
    carnage.hidden = v.carnage === null;
    if (v.carnage) {
      carnageMorts.textContent = t("accueil.carnage.morts", { n: v.carnage.morts, total: fNombre(v.carnage.morts) });
      carnageTexte.textContent = t(v.carnage.morts > 0 ? "accueil.carnage.tous" : "accueil.carnage.aucun");
      carnageVoir.hidden = !v.carnage.peut;
    }
    board.hidden = v.board === null;
    if (v.board) {
      boardTitre.textContent = `${t("accueil.classement.titre")} · ${t("rang.classes", { n: v.board.participants, total: fNombre(v.board.participants) })}`;
      boardList.replaceChildren(...v.board.rows.slice(0, 5).map((r) => ligneClassement(r, false)));
      boardVide.hidden = v.board.rows.length > 0;
      boardAll.hidden = v.board.rows.length === 0;
    }
  };
  onLangue(() => changed()); // main.ts redessine la vue dans la nouvelle langue (`home.update`)

  play.addEventListener("click", () => {
    if (ready) opts.onPlay();
  });
  const self: Home = {
    hoteMessage,
    get isOpen() {
      return open;
    },
    get ready() {
      return ready;
    },
    open(v) {
      show(v);
      open = true;
      root.hidden = false;
      document.body.classList.add("home-open");
      if (ready) focusJouer();
      changed();
    },
    close() {
      open = false;
      root.hidden = true;
      document.body.classList.remove("home-open");
      (document.activeElement as HTMLElement | null)?.blur?.();
      changed();
    },
    update: show,
    setReady(on) {
      ready = on;
      play.disabled = !on;
      settings.disabled = !on;
      if (on && view) lier(play, BOUTON_JOUER[view.etat]);
      else lier(play, "page.preparation");
      if (on && open) focusJouer();
    },
    setCountdown(text) {
      if (countdown.textContent !== text) countdown.textContent = text;
    },
    focus() {
      if (open && ready) focusJouer();
    },
  };
  return self;
}
