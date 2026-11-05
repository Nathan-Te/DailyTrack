import { actionDe, BONUS_PLATEAU_VIDE, colonneDe, COLONNES, ligneDe, LIGNES, NB_CASES, Partie, PIECES, POSES_SANS_EFFACEMENT_MAX, VARIANTE, caseOccupee, enregistrer, grilleEnTexte, type Contenu, type Piece } from "@cdj/blocks-sim";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import { coupDuDiamant } from "@cdj/blocks-sim/diamant";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { centreDesYeux, Clignotement, decrirePiece, disposerYeux, ENCRE, expressionDe, regardVers, type CoucheRelief, type Niveau, type PoseOeil } from "@cdj/visuels/blocs";
import { dessinerPiece, placer } from "@cdj/visuels/blocs/canvas";
import { boitesDeCases, boitesDePiece, casesDe, type Case } from "./boites";
import "./partie.css"; // la feuille de la partie : à la demande, avec le corps du jeu (hors du premier chargement)
import { type CouleursTheme, couleursDeTheme, paletteCourante } from "./couleurs";
import { decorCourant } from "./decors/index";
import { type Annonce, bosse, type CaseEffacee, DUREE_GAIN, eclater, etatAnnonce, etatGain, etatParticule, type GainFlottant, hasardAffichage, illumination, illuminationFinie, type Particule } from "./effets";
import { lireEssai } from "./essai";
import { suivreCouche } from "./coucheLogique";
import { musiqueDuKit } from "./kitSon";
import { coteEnMain, coteEnSuivante, dans, disposer, type Disposition, type Rect, ETIQUETTE, metriquesPlaque, VALEUR_MIN } from "./miseEnPage";
import { Sons, type SonJoue } from "./sons";
import { type Evenement, niveauEffets } from "./sonsLogique";
import { ecrireScore, formaterNombre, texte } from "./textes";
import { caseDesYeux, morceaux } from "./yeuxBlocks";

// Le rendu et les entrées de « Blocks » (lots B1 et B2) : la grille de 8 × 8, la pièce du moment dans une grande zone de saisie, la pièce suivante petite (non saisissable), en Canvas 2D avec les blocs communs
// (`@cdj/visuels/blocs`, la direction artistique de Tower), le HUD de la maquette A de B0 (plaques du score et du combo ; le fantôme et la pause sont les boutons du kit, `blocks.css`) et les sensations du seed § 7.
// **De l'affichage seulement** : la partie est `Partie` de `@cdj/blocks-sim` ; une pose est une action `ligne × 8 + colonne`, et cette suite d'actions est la rediffusion. Aucun effet, aucun son, aucun regard ne change un
// octet d'une partie.
// Le geste (seed § 6, B2) : la pièce saisie grossit à la taille des cases et **reste sous le doigt, au point exact où on l'a touchée** (aucun décalage, souris comme doigt) ; une ombre hachurée est aimantée à la case la plus
// proche ; les lignes et colonnes qui seraient effacées s'allument ; relâcher hors d'un endroit valide renvoie la pièce. Clavier et manette (M1, M2) : déplacer l'ombre case par case (`gauche` … `bas`), `poser`.
// Les effets ne bloquent jamais la pose suivante : ils sont de l'affichage pur, animé à l'horloge de l'écran (60 images par seconde), jamais aux pas de la simulation.
// Lot B3 : les couleurs viennent de la palette du thème du jour (module commun, `couleurs.ts`) et le bot Diamant peut jouer à la place du joueur (`&bot`, essai local). Lot B5 : la mise en page est refaite à l'échelle du PC et du téléphone (`miseEnPage.ts`), les décors des thèmes sont dessinés derrière la grille (`decors/`), le fantôme est retiré (seed § 5). Aucune couleur écrite ici : le thème, ou les jetons de `@cdj/ui`.

/** Les actions de « Blocks » : l'ombre au clavier et à la manette, et `poser` ; `pose:<colonne>:<ligne>` pose directement (tests, outils). */
export const ACTIONS_SCENE = ["gauche", "droite", "haut", "bas", "poser"] as const;

/** Combien de ticks (30 Hz) « Plus de place ! » reste affiché avant l'écran de fin (environ 1 s). */
export const TICKS_PLUS_DE_PLACE = 30;
/** Le glissement : une case d'ombre est choisie si la pièce est à moins d'une case d'une position légale. */
const PORTEE_AIMANT = 1;
/** Le doigt doit avoir bougé de cette fraction de case pour qu'un relâcher hors d'une position valide soit une « pose refusée » (un simple appui n'en est pas une). */
const SEUIL_GLISSE = 0.4;
const DUREE_RETOUR = 0.16;
const DUREE_PERTE_COMBO = 0.7;
/** Le niveau des effets tant que le lecteur du kit n'est pas chargé. */
const VOLUME_AVANT_LECTEUR = 0.8;

const jeton = (nom: string): string => getComputedStyle(document.documentElement).getPropertyValue(`--dj-${nom}`).trim() || "currentColor";
interface Palette {
  /** Le fond de toute la scène (le ciel du thème). */
  ciel: string;
  /** Le fond de la grille, entre les cases (le sol du thème). */
  fond: string;
  case: string;
  trait: string;
  zone: string;
  zoneSuivante: string;
  surligne: string;
  texte: string;
  texteDouce: string;
  papier: string;
  encre: string;
  terre: string;
  plaque: string;
  famille: string;
  texteFamille: string;
}
/** Les couleurs de la scène : celles du thème du jour (la palette commune, `couleurs.ts`) et, pour l'encre, le papier et les textes, les jetons de la charte. */
function palette(th: CouleursTheme): Palette {
  const base = { surligne: jeton("moutarde"), papier: jeton("papier"), encre: jeton("encre"), terre: jeton("terre"), plaque: jeton("papier"), famille: jeton("police-chiffres") || "monospace", texteFamille: jeton("police-texte") || "sans-serif" };
  return {
    ...base,
    ciel: th.fond,
    fond: th.grille,
    case: th.caseVide,
    trait: th.cadre,
    zone: th.zone,
    zoneSuivante: th.zoneSuivante,
    texte: th.sombre ? jeton("creme") : jeton("encre"),
    texteDouce: th.sombre ? jeton("creme-2") : jeton("encre-douce"),
  };
}

/** La porte des tests de navigateur (`window.__blocks`, `?debug` seulement) : positions en coordonnées de la page. */
export interface PorteBlocks {
  disposition(): {
    portrait: boolean;
    cote: number;
    grille: Rect;
    main: Rect;
    suivante: Rect;
    score: Rect;
    combo: Rect;
    boutons: Rect;
    coteMain: number;
    centreMain: { x: number; y: number };
    coteSuivante: number;
  };
  piece(): string | null;
  suivante(): string | null;
  ombre(): { col: number; ligne: number; legale: boolean } | null;
  surlignage(): { lignes: number; colonnes: number } | null;
  /** La pièce du moment au repos dans la zone de saisie : son rectangle (page) et le côté de ses cases. */
  repos(): { rect: Rect; cote: number } | null;
  /** La pièce saisie : le point touché, son rectangle (page), le côté de ses cases et la case touchée (`u`, `v`, en cases depuis son coin haut-gauche). */
  saisie(): { doigt: { x: number; y: number }; piece: Rect; cote: number; u: number; v: number } | null;
  grille(): string[];
  etat(): { score: number; combo: number; comboMax: number; poses: number; sansEffacement: number; fin: string | null };
  /** Ce que le HUD dessine : le score écrit, le combo écrit (ou `null`), les carrés pleins (poses sans effacement encore permises), la couleur de la plaque du combo. */
  hud(): { score: string; combo: string | null; carres: number; moutarde: boolean };
  /** Lot B5 — les plus petites polices (px CSS) dessinées à la dernière image : les valeurs du HUD (jamais sous 18) et les étiquettes (plaques et zones, jamais sous 12). */
  polices(): { valeur: number; etiquette: number };
  /** Lot B5 — le décor du thème est-il posé derrière la grille ? */
  decor(): boolean;
  /** Les effets vivants : cases en cours d'illumination, particules, annonces et gains affichés. */
  effets(): { effacees: number; fermees: number; particules: number; annonces: string[]; gains: string[] };
  /** Les yeux : le nombre de paires dessinées et où elles regardent (le premier œil : vecteur de norme ≤ 1). */
  yeux(): { paires: number; regard: { x: number; y: number } | null };
  /** Les sons demandés (le dernier en dernier) : leur nom et la hauteur de leur première note (Hz). */
  sons(): SonJoue[];
  /** Lot B6 — la couche de la musique (arpège ou nappe) est-elle demandée ? Vrai du combo ×3 à la perte du combo ou à la fin de la partie. */
  couche(): boolean;
}

/** Ce que la scène reçoit en plus du kit : le bot Diamant qui joue à la place du joueur (`&bot`, essai local, jamais classé) à `vitesse` poses par seconde. */
export interface OptionsScene {
  bot?: { vitesse: number } | null;
  /** Lot B4 — `?scenario=partage` : les poses du résultat d'exemple, appliquées d'emblée ; la partie est donnée pour finie une seconde après (l'écran de fin du kit s'ouvre tout de suite). Essai local, jamais classé. */
  exemple?: readonly number[] | null;
}

export function nouvellePartieBlocks(contenu: Contenu, hote: HTMLElement, o: OptionsPartie, extra: OptionsScene = {}): PartieDuJeu {
  const partie = new Partie(contenu);
  const actions: number[] = [];
  const theme = couleursDeTheme(paletteCourante()); // la palette du jour, posée par `corps.ts` avant la scène
  const couleurs = palette(theme);
  const decor = decorCourant(); // le décor du thème (derrière la grille), posé par `corps.ts` ; absent : le ciel en aplat
  const couleurDeFamille = (f: Piece["famille"]): string => theme.familles[f];
  const COULEUR_DEPART = theme.depart;
  const canvas = document.createElement("canvas");
  canvas.className = "blocks-plateau";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", o.libelle);
  hote.append(canvas);
  const g = canvas.getContext("2d")!;
  void document.fonts?.load?.(`700 20px ${couleurs.famille}`).catch(() => undefined);

  const bot = extra.bot ?? null;
  const cadence = bot ? Math.max(1, Math.round(30 / bot.vitesse)) : 0;

  // --- Le son : le volume et le « couper » du kit (le lecteur de la musique commune) ---
  let lecteur: { reglages(): { volume: number; coupee: boolean } } | null = null;
  void musiqueDuKit()?.lecteur().then((l) => (lecteur = l), () => undefined);
  const sons = new Sons({ niveau: () => (lecteur ? niveauEffets(lecteur.reglages().volume, lecteur.reglages().coupee) : niveauEffets(VOLUME_AVANT_LECTEUR, false)) });
  const jouerSon = (e: Evenement, retard = 0): void => sons.jouer(e, retard);
  // La couche de la musique (lot B6) : elle entre au combo ×3 et sort à la perte du combo ou à la fin de la partie (`coucheLogique.ts`).
  const couche = suivreCouche(musiqueDuKit());
  const geste = (): void => sons.deverrouiller();
  addEventListener("keydown", geste, { passive: true });

  // --- L'horloge d'AFFICHAGE : les secondes, à l'image (jamais aux pas de la simulation) ---
  const t0 = performance.now();
  let maintenant = 0;
  const hasard = hasardAffichage(contenu.jour * 31 + 7);

  // --- L'état d'AFFICHAGE : la pose d'origine de chaque case occupée (pour sa couleur), les yeux, les effets ---
  const poseDe = new Int16Array(NB_CASES); // 0 : vide ; sinon l'index de la pose + 1 (les cases de départ d'un scénario : -1)
  const familles: (Piece["famille"] | null)[] = [];
  for (let l = 0; l < LIGNES; l++) for (let c = 0; c < COLONNES; c++) if (caseOccupee(partie.grille, c, l)) poseDe[l * COLONNES + c] = -1;
  const couleurDeCase = (i: number): string => (poseDe[i]! < 0 ? COULEUR_DEPART : couleurDeFamille(familles[poseDe[i]! - 1]!));
  let groupes: { couches: CoucheRelief[]; yeux: Case[] }[] = [];
  let casesYeux = new Set<number>();
  const reconstruire = (): void => {
    const parPose = new Map<number, Case[]>();
    poseDe.forEach((p, i) => {
      if (p !== 0) parPose.set(p, [...(parPose.get(p) ?? []), { col: i % COLONNES, ligne: Math.floor(i / COLONNES) }]);
    });
    groupes = [...parPose].map(([p, cases]) => ({
      couches: decrirePiece(boitesDeCases(cases, 0, 0), { couleur: p < 0 ? COULEUR_DEPART : couleurDeFamille(familles[p - 1]!), encre: ENCRE }),
      // Une paire par morceau (une pièce coupée par un effacement en a plusieurs), sur sa case la plus centrale.
      yeux: p < 0 ? [] : morceaux(cases).map(caseDesYeux),
    }));
    casesYeux = new Set(groupes.flatMap((grp) => grp.yeux.map((c) => c.ligne * COLONNES + c.col)));
  };
  reconstruire();
  const gains: GainFlottant[] = [];
  const annonces: Annonce[] = [];
  let particules: Particule[] = [];
  let effacees: CaseEffacee[] = [];
  const blocsEffaces = new Map<string, CoucheRelief[]>(); // le dessin d'une case effacée, gardé le temps de l'illumination
  const clignotements = new Map<number, Clignotement>();
  let bosseCombo = -1;
  let perteCombo = -1;
  let scoreAffiche = partie.score;
  let bosseScore = -1;
  let tFin = partie.finie ? 0 : -1; // les ticks de la scène (30 Hz) : seulement la durée de « Plus de place ! »
  let t = 0;
  let retour: { depart: { x: number; y: number }; cote: number; piece: Piece; t0: number } | null = null;
  let dernierRegard: { x: number; y: number } | null = null;
  let nbPaires = 0;

  // --- La mise en page ---
  let mep: Disposition = disposer(1, 1);
  let largeur = 1;
  let hauteur = 1;
  let decalageBord = { x: 0, y: 0 };
  const redimensionner = (): void => {
    const r = hote.getBoundingClientRect();
    const s = getComputedStyle(hote);
    const px = (v: string): number => Number.parseFloat(v) || 0;
    const gauche = px(s.paddingLeft);
    const haut = px(s.paddingTop);
    const w = Math.max(1, Math.floor(r.width - gauche - px(s.paddingRight)));
    const h = Math.max(1, Math.floor(r.height - haut - px(s.paddingBottom)));
    const dpr = Math.min(2, devicePixelRatio || 1);
    largeur = Math.max(1, Math.floor(r.width));
    hauteur = Math.max(1, Math.floor(r.height));
    canvas.width = Math.round(largeur * dpr);
    canvas.height = Math.round(hauteur * dpr);
    canvas.style.width = `${largeur}px`;
    canvas.style.height = `${hauteur}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    decalageBord = { x: gauche, y: haut };
    mep = disposer(w, h);
    decor?.dimensionner(largeur, hauteur, dpr);
  };
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(hote);
  redimensionner();

  // --- Le glisser-déposer, le clavier ---
  // `x`, `y` : le point touché, en coordonnées de la mise en page ; `u`, `v` : la case touchée, en cases depuis le coin haut-gauche de la boîte de la pièce (elle reste sous le doigt pendant tout le glisser).
  let saisie: { x: number; y: number; souris: boolean; depuis: number; u: number; v: number; x0: number; y0: number; bouge: boolean } | null = null;
  let clavier = false;
  const curseur = { col: 0, ligne: 0 };
  const premiereLegale = (): void => {
    const p = partie.piece;
    if (!p) return;
    for (let l = 0; l + p.hauteur <= LIGNES; l++) for (let c = 0; c + p.largeur <= COLONNES; c++) if (partie.legale(c, l)) return void Object.assign(curseur, { col: c, ligne: l });
  };
  premiereLegale();
  const bornes = (): void => {
    const p = partie.piece;
    if (!p) return;
    curseur.col = Math.max(0, Math.min(COLONNES - p.largeur, curseur.col));
    curseur.ligne = Math.max(0, Math.min(LIGNES - p.hauteur, curseur.ligne));
  };

  /** Le côté d'une case de la pièce saisie : de sa taille au repos à celle des cases de la grille, en un instant (tout de suite avec « mouvements réduits »). */
  const coteSaisie = (p: Piece): number => {
    const repos = coteEnMain(mep, p);
    const age = o.reduit || !saisie ? 1 : Math.min(1, (performance.now() - saisie.depuis) / 90);
    return repos + (mep.cote - repos) * age;
  };
  /** Le coin haut-gauche de la pièce saisie, en pixels de la mise en page : la case touchée est sous le doigt. */
  const coinSaisi = (p: Piece, cote = coteSaisie(p)): { x: number; y: number } | null => (saisie ? { x: saisie.x - saisie.u * cote, y: saisie.y - saisie.v * cote } : null);
  /** Le coin haut-gauche de la pièce saisie, en cases de la grille (fractionnaire), à la taille finale des cases. */
  const positionSaisie = (): { cx: number; cy: number } | null => {
    const p = partie.piece;
    if (!saisie || !p) return null;
    const coin = coinSaisi(p, mep.cote)!;
    return { cx: (coin.x - mep.grille.x) / mep.cote, cy: (coin.y - mep.grille.y) / mep.cote };
  };
  /** L'ombre aimantée : la position légale la plus proche, à moins d'une case. */
  const aimante = (): { col: number; ligne: number } | null => {
    const pos = positionSaisie();
    if (!pos) return null;
    let meilleur: { col: number; ligne: number } | null = null;
    let dist = Infinity;
    for (const col of [Math.floor(pos.cx), Math.ceil(pos.cx)]) {
      for (const ligne of [Math.floor(pos.cy), Math.ceil(pos.cy)]) {
        if (!partie.legale(col, ligne)) continue;
        const d = Math.hypot(col - pos.cx, ligne - pos.cy);
        if (d <= PORTEE_AIMANT && d < dist) {
          dist = d;
          meilleur = { col, ligne };
        }
      }
    }
    return meilleur;
  };

  /** Le centre d'une case de la grille, en pixels de la mise en page. */
  const centreDeCase = (col: number, ligne: number): { x: number; y: number } => ({ x: mep.grille.x + (col + 0.5) * mep.cote, y: mep.grille.y + (ligne + 0.5) * mep.cote });

  function poser(col: number, ligne: number): boolean {
    const p = partie.piece;
    const avant = { combo: partie.combo };
    const pose = partie.poser(col, ligne);
    if (!p || !pose) return false;
    actions.push(actionDe(col, ligne));
    const index = actions.length; // l'index de la pose + 1
    familles[index - 1] = p.famille;
    for (const c of casesDe(p)) poseDe[(ligne + c.ligne) * COLONNES + col + c.col] = index;
    jouerSon({ son: "pose", cases: p.cases });
    if (pose.n > 0) {
      // Les lignes et les colonnes d'une même pose s'illuminent ensemble, puis éclatent ensemble. Les yeux sont connus avec la nouvelle pièce posée (avant l'effacement).
      reconstruire();
      const aEffacer: CaseEffacee[] = [];
      let sx = 0;
      let sy = 0;
      for (let l = 0; l < LIGNES; l++) {
        for (let c = 0; c < COLONNES; c++) {
          if (!((pose.lignes >> l) & 1 || (pose.colonnes >> c) & 1)) continue;
          const i = l * COLONNES + c;
          aEffacer.push({ col: c, ligne: l, couleur: couleurDeCase(i), yeux: casesYeux.has(i), t0: maintenant });
          sx += c;
          sy += l;
          poseDe[i] = 0;
        }
      }
      effacees.push(...aEffacer);
      for (const e of aEffacer) {
        const cle = `${e.couleur}`;
        if (!blocsEffaces.has(cle)) blocsEffaces.set(cle, decrirePiece(boitesDeCases([{ col: 0, ligne: 0 }], 0, 0), { couleur: e.couleur, encre: ENCRE }));
      }
      const centre = { x: sx / aEffacer.length + 0.5, y: sy / aEffacer.length + 0.5 };
      gains.push({ texte: `+${pose.gain}`, x: centre.x, y: centre.y, t0: maintenant, grand: pose.plateauVide });
      jouerSon({ son: "effacement", n: pose.n, combo: pose.combo });
      if (pose.combo >= 2) {
        jouerSon({ son: "combo", combo: pose.combo });
        annonces.push({ texte: texte("hud.combo.annonce", { n: pose.combo }), t0: maintenant, duree: 1.1, genre: "combo" });
      }
      if (pose.combo !== avant.combo) bosseCombo = maintenant;
      if (pose.plateauVide) {
        jouerSon({ son: "plateauVide" });
        annonces.push({ texte: texte("hud.plateauVide", { n: BONUS_PLATEAU_VIDE }), t0: maintenant + 0.15, duree: 1.8, genre: "plateau" });
        if (!o.reduit) {
          const confettis = Array.from({ length: NB_CASES }, (_, i) => ({ col: i % COLONNES, ligne: Math.floor(i / COLONNES), couleur: couleurDeFamille(PIECES[Math.floor(hasard() * PIECES.length)]!.famille) }));
          particules.push(...eclater(confettis, maintenant + 0.15, hasard, particules.length));
        }
      }
    } else {
      if (pose.comboPerdu) perteCombo = maintenant;
    }
    reconstruire();
    bosseScore = maintenant;
    couche.maj(partie.combo, partie.finie);
    if (partie.finie) {
      tFin = t;
      jouerSon({ son: "fin" }, pose.n > 0 ? 0.45 : 0.1);
    }
    bornes();
    return true;
  }

  const point = (e: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - decalageBord.x, y: e.clientY - r.top - decalageBord.y };
  };
  /** Où la pièce du moment est posée au repos dans la zone de saisie : son coin haut-gauche et le côté de ses cases. */
  const reposDe = (p: Piece): { x: number; y: number; cote: number } => {
    const cote = coteEnMain(mep, p);
    return { x: mep.centreMain.x - (p.largeur * cote) / 2, y: mep.centreMain.y - (p.hauteur * cote) / 2, cote };
  };
  canvas.addEventListener("pointerdown", (e) => {
    geste();
    const p = partie.piece;
    if (!p || saisie) return;
    const { x, y } = point(e);
    if (!dans(mep.main, x, y)) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    // La case touchée : le point exact où on a saisi la pièce, ramené dans sa boîte si on a touché la zone à côté d'elle. Elle reste sous le doigt pendant tout le glisser.
    const r = reposDe(p);
    const u = Math.max(0, Math.min(p.largeur, (x - r.x) / r.cote));
    const v = Math.max(0, Math.min(p.hauteur, (y - r.y) / r.cote));
    saisie = { x, y, souris: e.pointerType === "mouse", depuis: performance.now(), u, v, x0: x, y0: y, bouge: false };
    clavier = false;
    retour = null;
    jouerSon({ son: "prise" });
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!saisie) return;
    const { x, y } = point(e);
    saisie.x = x;
    saisie.y = y;
    if (Math.hypot(x - saisie.x0, y - saisie.y0) > SEUIL_GLISSE * mep.cote) saisie.bouge = true;
  });
  const relacher = (pose: boolean): void => {
    if (!saisie) return;
    const p = partie.piece;
    const cible = pose ? aimante() : null;
    const s = saisie;
    saisie = null;
    if (cible) {
      poser(cible.col, cible.ligne);
      curseur.col = cible.col;
      curseur.ligne = cible.ligne;
      bornes();
    } else if (p && s.bouge) {
      // La pièce retourne à sa place, sans pénalité : un petit vol de retour et deux notes qui descendent.
      const cote = Math.max(1, mep.cote);
      retour = { depart: { x: s.x - s.u * cote, y: s.y - s.v * cote }, cote, piece: p, t0: maintenant };
      jouerSon({ son: "refus" });
    }
  };
  canvas.addEventListener("pointerup", () => relacher(true));
  canvas.addEventListener("pointercancel", () => relacher(false));

  // --- Le dessin ---
  let policesVues = { valeur: Infinity, etiquette: Infinity };
  const police = (px: number): string => `700 ${Math.round(px)}px ${couleurs.famille}`;
  const policeTexte = (px: number): string => `700 ${Math.round(px)}px ${couleurs.texteFamille}`;
  const hachures = (couleur: string, fond: string): CanvasPattern | null => {
    const c = document.createElement("canvas");
    c.width = c.height = 8;
    const x = c.getContext("2d");
    if (!x) return null;
    x.fillStyle = fond;
    x.fillRect(0, 0, 8, 8);
    x.strokeStyle = couleur;
    x.lineWidth = 2;
    x.beginPath();
    for (const d of [-8, 0, 8]) {
      x.moveTo(d, 8);
      x.lineTo(d + 8, 0);
    }
    x.stroke();
    return g.createPattern(c, "repeat");
  };
  const ombreLegale = hachures(jeton("encre-douce"), couleurs.case);
  const ombreIllegale = hachures(couleurs.terre, couleurs.case);

  const niveauDePanique = (): Niveau => (partie.finie ? 2 : 0);
  const clignement = (cle: number, niveau: Niveau): number => {
    if (o.reduit) return 0;
    let c = clignotements.get(cle);
    if (!c) {
      c = new Clignotement(hasard, maintenant);
      clignotements.set(cle, c);
    }
    return c.valeur(maintenant, niveau);
  };
  /** Les yeux d'une paire posée sur la case `(col, ligne)` de la grille (repère de la grille : cases, y vers le haut), qui regardent vers `cible` (en cases de la grille) si on en a une. */
  function yeuxSurCase(col: number, ligne: number, cible: { x: number; y: number } | null, niveau: Niveau): PoseOeil[] {
    const centre = { x: col + 0.5, y: -(ligne + 0.5) };
    const regard = cible && !o.reduit ? regardVers(centre, { x: cible.x, y: -cible.y }, 0) : { x: 0, y: 0 };
    const x = expressionDe({ niveau, genre: "normal", regard, clignement: clignement(ligne * COLONNES + col, niveau), t: maintenant });
    dernierRegard = { x: x.regardX, y: x.regardY };
    return disposerYeux(centre.x, centre.y, 1, x, maintenant, col * 1.3 + ligne * 2.1);
  }
  /** Une pièce entière (en main, saisie ou à l'ombre) : ses couches et ses yeux, posés au centre de sa plus grande boîte. */
  function pieceEn(p: Piece, x: number, y: number, cote: number, opts: { yeux?: boolean; regard?: { x: number; y: number } | null; niveau?: Niveau } = {}): void {
    const boites = boitesDePiece(p);
    const couches = decrirePiece(boites, { couleur: couleurDeFamille(p.famille), encre: ENCRE });
    let yeux: PoseOeil[] | undefined;
    if (opts.yeux) {
      const c = centreDesYeux(boites);
      const regard = opts.regard && !o.reduit ? regardVers(c, opts.regard, 0) : { x: 0, y: 0 };
      const niveau = opts.niveau ?? 0;
      yeux = disposerYeux(c.x, c.y, 1, expressionDe({ niveau, genre: "normal", regard, clignement: clignement(-1 - p.id, niveau), t: maintenant }), maintenant, p.id * 1.7);
    }
    dessinerPiece(g, { x, y, pxParMetre: cote }, couches, yeux);
  }
  /** L'ombre à montrer : celle du glisser-déposer (aimantée, toujours légale) ou celle du clavier (légale ou non). */
  function ombreCourante(): { col: number; ligne: number; legale: boolean } | null {
    if (!partie.piece) return null;
    if (saisie) {
      const a = aimante();
      return a ? { ...a, legale: true } : null;
    }
    return clavier ? { col: curseur.col, ligne: curseur.ligne, legale: partie.legale(curseur.col, curseur.ligne) } : null;
  }

  /** Une plaque de la charte (bordure et ombre nette, à l'échelle de la plaque) : le score et le combo. Étiquette jamais sous 12 px, valeur jamais sous 18 px. */
  function plaque(r: Rect, fond: string, etiquette: string, valeur: string, opts: { echelle?: number; secousse?: number; carres?: { pleins: number; total: number } } = {}): void {
    const m = metriquesPlaque(r.h);
    g.save();
    g.translate(r.x + r.w / 2 + (opts.secousse ?? 0), r.y + r.h / 2);
    const e = opts.echelle ?? 1;
    g.scale(e, e);
    g.translate(-r.w / 2, -r.h / 2);
    g.fillStyle = couleurs.encre;
    g.fillRect(m.trait, m.trait, r.w, r.h);
    g.fillStyle = fond;
    g.fillRect(0, 0, r.w, r.h);
    g.strokeStyle = couleurs.encre;
    g.lineWidth = m.trait;
    g.strokeRect(m.trait / 2, m.trait / 2, r.w - m.trait, r.h - m.trait);
    g.textBaseline = "alphabetic";
    g.textAlign = "left";
    g.fillStyle = jeton("encre-douce");
    (g as unknown as { letterSpacing: string }).letterSpacing = "1px";
    g.font = policeTexte(m.etiquette);
    policesVues.etiquette = Math.min(policesVues.etiquette, m.etiquette);
    g.fillText(etiquette.toUpperCase(), m.pad, m.pad + m.etiquette * 0.8);
    (g as unknown as { letterSpacing: string }).letterSpacing = "0px";
    g.fillStyle = couleurs.encre;
    let taille = m.valeur;
    const place = r.w - 2 * m.pad - (opts.carres ? opts.carres.total * (m.carre + m.carre * 0.3) + m.pad : 0);
    g.font = police(taille);
    while (taille > VALEUR_MIN && g.measureText(valeur).width > place) g.font = police(--taille);
    policesVues.valeur = Math.min(policesVues.valeur, taille);
    g.fillText(valeur, m.pad, r.h - m.pad * 0.8);
    if (opts.carres) {
      const ecart = Math.round(m.carre * 0.3);
      for (let k = 0; k < opts.carres.total; k++) {
        const x = r.w - m.pad - (m.carre + ecart) * (opts.carres.total - k) + ecart;
        const y = r.h - m.pad - m.carre;
        g.strokeStyle = couleurs.encre;
        g.lineWidth = Math.max(2, Math.round(m.carre / 6));
        g.strokeRect(x + g.lineWidth / 2, y + g.lineWidth / 2, m.carre - g.lineWidth, m.carre - g.lineWidth);
        if (k < opts.carres.pleins) {
          g.fillStyle = couleurs.encre;
          g.fillRect(x + g.lineWidth / 2, y + g.lineWidth / 2, m.carre - g.lineWidth, m.carre - g.lineWidth);
        }
      }
    }
    g.restore();
  }
  /** Une pastille d'annonce (« Combo ×3 ! », « Plus de place ! ») : posée de travers, encre et papier ; plus grande pour un plateau vide (moutarde). */
  function pastille(txt: string, cx: number, cy: number, echelle: number, alpha: number, genre: Annonce["genre"]): void {
    const taille = mep.cote * (genre === "plateau" ? 0.8 : 0.66);
    g.save();
    g.globalAlpha = alpha;
    g.translate(cx, cy);
    g.rotate(genre === "plateau" ? 0.04 : -0.05);
    g.scale(echelle, echelle);
    g.font = police(taille);
    const w = Math.min(mep.grille.w - 8, g.measureText(txt).width + taille * 1.2);
    const h = taille * 1.9;
    const fond = genre === "plateau" ? couleurs.surligne : couleurs.encre;
    g.fillStyle = genre === "plateau" ? couleurs.encre : couleurs.encre;
    g.fillRect(-w / 2 + 4, -h / 2 + 4, w, h);
    g.fillStyle = fond;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = genre === "plateau" ? couleurs.encre : couleurs.papier;
    g.lineWidth = 2;
    g.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = genre === "plateau" ? couleurs.encre : couleurs.papier;
    let t2 = taille;
    while (t2 > 10 && g.measureText(txt).width > w - 16) g.font = police((t2 -= 1));
    g.fillText(txt, 0, 2);
    g.restore();
  }
  function carte(r: Rect, fond: string, etiquette: string, actif: boolean): void {
    g.save();
    if (actif) {
      g.fillStyle = couleurs.encre;
      g.fillRect(r.x + 2, r.y + 2, r.w, r.h);
    }
    g.fillStyle = fond;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = couleurs.encre;
    g.lineWidth = 2;
    if (!actif) g.setLineDash([6, 4]);
    g.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    g.setLineDash([]);
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.fillStyle = jeton("encre-douce");
    const px = Math.max(12, Math.min(18, Math.round(mep.cote * 0.17))); // l'étiquette d'une zone : jamais sous 12 px
    policesVues.etiquette = Math.min(policesVues.etiquette, px);
    g.font = policeTexte(px);
    (g as unknown as { letterSpacing: string }).letterSpacing = "1px";
    g.fillText(etiquette.toUpperCase(), r.x + 12, r.y + ETIQUETTE - 7);
    (g as unknown as { letterSpacing: string }).letterSpacing = "0px";
    g.restore();
  }
  /** Du texte sur plusieurs lignes, centré dans un rectangle (la ligne d'aide d'avant la première pose). */
  function texteEnLignes(txt: string, r: Rect, taille: number): void {
    g.font = policeTexte(taille);
    g.textAlign = "center";
    g.textBaseline = "middle";
    const mots = txt.split(" ");
    const lignes: string[] = [];
    let courante = "";
    for (const m of mots) {
      const essai = courante ? `${courante} ${m}` : m;
      if (courante && g.measureText(essai).width > r.w - 16) {
        lignes.push(courante);
        courante = m;
      } else courante = essai;
    }
    lignes.push(courante);
    const hl = taille * 1.35;
    const haut = r.y + r.h / 2 - ((lignes.length - 1) * hl) / 2;
    // Une plaque de papier sous le texte : l'aide reste lisible sur n'importe quel décor.
    const large = Math.max(...lignes.map((l) => g.measureText(l).width)) + taille * 1.6;
    const hauteurPlaque = lignes.length * hl + taille * 0.9;
    g.save();
    g.globalAlpha = 0.9;
    g.fillStyle = couleurs.papier;
    g.fillRect(r.x + r.w / 2 - large / 2, haut - hl / 2 - taille * 0.2, large, hauteurPlaque);
    g.restore();
    g.fillStyle = jeton("encre-douce");
    lignes.forEach((l, i) => g.fillText(l, r.x + r.w / 2, haut + i * hl));
  }

  function dessiner(): void {
    const instant = performance.now();
    maintenant = (instant - t0) / 1000;
    policesVues = { valeur: Infinity, etiquette: Infinity };
    // Les effets finis disparaissent : les cases illuminées éclatent en particules de leur couleur.
    if (effacees.some((c) => illuminationFinie(maintenant - c.t0))) {
      const finies = effacees.filter((c) => illuminationFinie(maintenant - c.t0));
      effacees = effacees.filter((c) => !illuminationFinie(maintenant - c.t0));
      if (!o.reduit) particules.push(...eclater(finies, maintenant, hasard, particules.length));
    }
    particules = particules.filter((p) => maintenant - p.t0 < p.vie);
    while (gains.length > 0 && maintenant - gains[0]!.t0 > DUREE_GAIN) gains.shift();
    while (annonces.length > 0 && maintenant - annonces[0]!.t0 > annonces[0]!.duree) annonces.shift();

    g.clearRect(0, 0, largeur, hauteur);
    if (decor) decor.dessiner(g, maintenant, !!o.reduit); // le décor du thème, sous tout (lot B5)
    else {
      g.fillStyle = couleurs.ciel; // le ciel du thème, sous tout
      g.fillRect(0, 0, largeur, hauteur);
    }
    g.save();
    g.translate(decalageBord.x, decalageBord.y);
    const { grille, cote } = mep;
    const p = partie.piece;
    const enMain = p ?? (partie.finie ? PIECES[contenu.suite[partie.rang]!]! : null); // à la fin, la pièce qui ne rentre nulle part reste en main (elle panique)
    const ombre = ombreCourante();
    const apercu = p && ombre?.legale ? partie.apercu(ombre.col, ombre.ligne) : null;

    // Le HUD : les plaques du score et du combo (la maquette A).
    const sansEff = Math.min(partie.sansEffacement, POSES_SANS_EFFACEMENT_MAX - 1);
    const carres = partie.combo > 0 ? POSES_SANS_EFFACEMENT_MAX - 1 - sansEff : 0;
    const perdu = perteCombo >= 0 && maintenant - perteCombo < DUREE_PERTE_COMBO;
    const moutarde = partie.combo >= 2;
    plaque(mep.score, couleurs.plaque, texte("hud.score"), ecrireNombre(partie.score), { echelle: o.reduit ? 1 : 1 + 0.05 * bosse(maintenant - bosseScore) });
    plaque(mep.combo, moutarde || perdu ? couleurs.surligne : couleurs.plaque, texte("hud.combo"), partie.combo > 0 ? `×${partie.combo}` : "—", {
      echelle: o.reduit ? 1 : 1 + 0.1 * bosse(maintenant - bosseCombo),
      // Un combo perdu se voit sans punir : la plaque se vide en douceur (un léger tremblement qui s'éteint), sans son ni message.
      secousse: perdu && !o.reduit ? Math.sin((maintenant - perteCombo) * 38) * 3 * (1 - (maintenant - perteCombo) / DUREE_PERTE_COMBO) : 0,
      carres: { pleins: carres, total: POSES_SANS_EFFACEMENT_MAX - 1 },
    });
    if (perdu) {
      // Le moutarde s'éclaircit vers le papier pendant que le compteur retombe.
      g.globalAlpha = Math.min(1, (maintenant - perteCombo) / DUREE_PERTE_COMBO);
      g.fillStyle = couleurs.plaque;
      const mc = metriquesPlaque(mep.combo.h);
      g.fillRect(mep.combo.x + mc.trait + 1, mep.combo.y + mc.trait + 1, mep.combo.w - 2 * mc.trait - 2, mep.combo.h - 2 * mc.trait - 2);
      g.globalAlpha = 1;
      g.fillStyle = couleurs.encre;
      g.font = police(mc.valeur);
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      g.fillText("—", mep.combo.x + mc.pad, mep.combo.y + mep.combo.h - mc.pad * 0.8);
    }

    // L'aide d'avant la première pose.
    if (partie.poses === 0 && !partie.finie && mep.aide.h >= 24) {
      g.fillStyle = couleurs.texteDouce;
      texteEnLignes(texte(o.tactile ? "hud.aide.glisser" : "hud.aide.bureau"), mep.aide, mep.portrait ? (mep.aide.h >= 40 ? 14 : 12) : Math.max(13, Math.min(24, Math.round(mep.cote * 0.2))));
    }

    // Les deux zones : « Ta pièce » (saisissable) et « Suivante » (pour information : pointillés, sans ombre).
    carte(mep.main, couleurs.zone, texte("hud.piece"), true);
    carte(mep.suivante, couleurs.zoneSuivante, texte("hud.suivante"), false);

    // La grille : les cases vides ; celles que le survol ferait effacer s'éclaircissent.
    g.fillStyle = couleurs.fond;
    g.fillRect(grille.x, grille.y, grille.w, grille.h);
    for (let l = 0; l < LIGNES; l++) {
      for (let c = 0; c < COLONNES; c++) {
        const allumee = apercu !== null && ((apercu.lignes >> l) & 1 || (apercu.colonnes >> c) & 1);
        g.fillStyle = allumee ? couleurs.papier : couleurs.case;
        g.fillRect(grille.x + c * cote + 1, grille.y + l * cote + 1, cote - 2, cote - 2);
      }
    }
    // « Plus de place ! » : les rares cases vides clignotent en pointillés.
    if (partie.finie && !o.reduit && Math.floor(maintenant * 4) % 2 === 0) {
      g.save();
      g.strokeStyle = couleurs.encre;
      g.lineWidth = 2;
      g.setLineDash([4, 3]);
      for (let l = 0; l < LIGNES; l++) for (let c = 0; c < COLONNES; c++) if (!caseOccupee(partie.grille, c, l)) g.strokeRect(grille.x + c * cote + 3, grille.y + l * cote + 3, cote - 6, cote - 6);
      g.restore();
    }

    // Les cases qui s'effacent : elles s'illuminent (le papier monte sur leur bloc), les yeux de leur pièce se ferment, contents ; puis elles éclatent.
    for (const c of effacees) {
      const age = maintenant - c.t0;
      const x = grille.x + c.col * cote;
      const y = grille.y + c.ligne * cote;
      const couches = blocsEffaces.get(c.couleur);
      if (couches) dessinerPiece(g, { x, y, pxParMetre: cote }, couches); // la boîte de la case (0, 0) a son centre à (0,5 ; −0,5) : l'origine est le coin haut-gauche de la case
      g.globalAlpha = illumination(age);
      g.fillStyle = couleurs.papier;
      g.fillRect(x + 2, y + 2, cote - 4, cote - 4);
      g.globalAlpha = 1;
      if (c.yeux) {
        g.save();
        placer(g, { x: x + cote / 2, y: y + cote / 2, pxParMetre: cote });
        const poses = disposerYeux(0, 0, 1, expressionDe({ niveau: 0, genre: "figee", regard: { x: 0, y: 0 }, clignement: 0, t: maintenant }), maintenant, 0);
        for (const oeil of poses) {
          g.fillStyle = ENCRE;
          g.fillRect(oeil.x - oeil.rEncre, oeil.y - 0.03, oeil.rEncre * 2, 0.06); // un trait d'encre : l'œil fermé, content
        }
        g.restore();
      }
    }

    // Les blocs posés (les groupes de cases d'une même pose, réunis sans joint), avec leurs yeux : ils regardent la pièce qu'on déplace.
    let cible: { x: number; y: number } | null = null;
    if (p && saisie) {
      const pos = positionSaisie()!;
      cible = { x: pos.cx + p.largeur / 2, y: pos.cy + p.hauteur / 2 };
    } else if (p && ombre) cible = { x: ombre.col + p.largeur / 2, y: ombre.ligne + p.hauteur / 2 };
    dernierRegard = null;
    let paires = 0;
    const niveau = niveauDePanique();
    for (const grp of groupes) {
      const yeux = grp.yeux.flatMap((c) => yeuxSurCase(c.col, c.ligne, cible, niveau));
      paires += grp.yeux.length;
      dessinerPiece(g, { x: grille.x, y: grille.y, pxParMetre: cote }, grp.couches, yeux);
    }
    nbPaires = paires;

    // Les lignes et colonnes qui seraient effacées : un anneau moutarde doublé de papier (la forme, pas seulement la couleur).
    if (apercu) {
      for (let l = 0; l < LIGNES; l++) {
        for (let c = 0; c < COLONNES; c++) {
          if (!((apercu.lignes >> l) & 1 || (apercu.colonnes >> c) & 1)) continue;
          const x = grille.x + c * cote;
          const y = grille.y + l * cote;
          g.strokeStyle = couleurs.surligne;
          g.lineWidth = 3;
          g.strokeRect(x + 2.5, y + 2.5, cote - 5, cote - 5);
          g.strokeStyle = couleurs.papier;
          g.lineWidth = 1;
          g.strokeRect(x + 4.5, y + 4.5, cote - 9, cote - 9);
        }
      }
    }
    // L'ombre : hachurée (un motif, ni transparence ni dégradé), aimantée à la case.
    if (p && ombre) {
      g.fillStyle = (ombre.legale ? ombreLegale : ombreIllegale) ?? couleurs.case;
      for (const c of casesDe(p)) g.fillRect(grille.x + (ombre.col + c.col) * cote + 2, grille.y + (ombre.ligne + c.ligne) * cote + 2, cote - 4, cote - 4);
    }
    g.strokeStyle = couleurs.trait;
    g.lineWidth = 3;
    g.strokeRect(grille.x - 1.5, grille.y - 1.5, grille.w + 3, grille.h + 3);

    // Les particules : de petits carrés de la couleur de la ligne qui s'est effacée.
    for (const part of particules) {
      const e = etatParticule(part, maintenant);
      if (!e) continue;
      const px = grille.x + e.x * cote;
      const py = grille.y + e.y * cote;
      const s = e.taille * cote;
      g.save();
      g.globalAlpha = e.alpha;
      g.translate(px, py);
      g.rotate(e.rot);
      g.fillStyle = part.couleur;
      g.fillRect(-s / 2, -s / 2, s, s);
      g.strokeStyle = ENCRE;
      g.lineWidth = 1;
      g.strokeRect(-s / 2, -s / 2, s, s);
      g.restore();
    }

    // La pièce suivante (petite, non saisissable) et la pièce du moment.
    const suivante = partie.suivante;
    if (suivante) pieceEn(suivante, mep.centreSuivante.x, mep.centreSuivante.y, coteEnSuivante(mep, suivante));
    if (enMain) {
      const r = reposDe(enMain);
      if (saisie && p) {
        // Sa place reste en pointillés dans la zone de saisie pendant qu'on la tient.
        g.save();
        g.strokeStyle = couleurs.texteDouce === couleurs.texte ? couleurs.encre : jeton("encre-douce");
        g.lineWidth = 2;
        g.setLineDash([4, 3]);
        for (const c of casesDe(enMain)) g.strokeRect(r.x + c.col * r.cote + 2, r.y + c.ligne * r.cote + 2, r.cote - 4, r.cote - 4);
        g.restore();
      } else if (retour && !o.reduit && maintenant - retour.t0 < DUREE_RETOUR) {
        const k = (maintenant - retour.t0) / DUREE_RETOUR;
        const e = 1 - (1 - k) * (1 - k);
        const cote2 = retour.cote + (r.cote - retour.cote) * e;
        pieceEn(enMain, retour.depart.x + (r.x - retour.depart.x) * e + (enMain.largeur * cote2) / 2, retour.depart.y + (r.y - retour.depart.y) * e + (enMain.hauteur * cote2) / 2, cote2, { yeux: true });
      } else {
        pieceEn(enMain, mep.centreMain.x, mep.centreMain.y, r.cote, { yeux: true, niveau: partie.finie ? 3 : 0 });
      }
    }
    // La pièce saisie : à la taille des cases, SOUS le doigt, au point exact où on l'a touchée ; ses yeux regardent l'ombre.
    if (p && saisie) {
      const cotePiece = coteSaisie(p);
      const coin = coinSaisi(p, cotePiece)!;
      const regard = ombre ? { x: ombre.col + p.largeur / 2, y: ombre.ligne + p.hauteur / 2 } : null;
      const centre = { x: coin.x + (p.largeur * cotePiece) / 2, y: coin.y + (p.hauteur * cotePiece) / 2 };
      const versOmbre = regard ? { x: regard.x - (centre.x - grille.x) / cote, y: -(regard.y - (centre.y - grille.y) / cote) } : null;
      pieceEn(p, centre.x, centre.y, cotePiece, { yeux: true, regard: versOmbre });
    }

    // Les gains à l'endroit de l'effacement (autocollant moutarde), les annonces.
    for (const gain of gains) {
      const e = etatGain(gain, maintenant);
      if (!e) continue;
      const taille = cote * (gain.grand ? 0.62 : 0.5);
      g.save();
      g.globalAlpha = e.alpha;
      g.translate(grille.x + e.x * cote, grille.y + (o.reduit ? gain.y : e.y) * cote);
      g.rotate(-0.06);
      g.scale(o.reduit ? 1 : e.echelle, o.reduit ? 1 : e.echelle);
      g.font = police(taille);
      g.textAlign = "center";
      g.textBaseline = "middle";
      const w = g.measureText(gain.texte).width + taille * 0.9;
      const h = taille * 1.5;
      g.fillStyle = couleurs.encre;
      g.fillRect(-w / 2 + 2, -h / 2 + 2, w, h);
      g.fillStyle = couleurs.surligne;
      g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = couleurs.encre;
      g.lineWidth = 2;
      g.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
      g.fillStyle = couleurs.encre;
      g.fillText(gain.texte, 0, 1);
      g.restore();
    }
    const centreGrille = { x: grille.x + grille.w / 2, y: grille.y + grille.h / 2 };
    for (const a of annonces) {
      const e = etatAnnonce(a, maintenant);
      if (e) pastille(a.texte, centreGrille.x, centreGrille.y + (a.genre === "combo" ? -cote * 1.6 : a.genre === "plateau" ? -cote * 0.4 : 0), o.reduit ? 1 : e.echelle, e.alpha, a.genre);
    }
    // « Plus de place ! » : environ 1 s avant l'écran de fin.
    if (partie.finie) pastille(texte("fin.plusDePlace"), centreGrille.x, centreGrille.y, 1, 1, "fin");
    g.restore();
  }
  const ecrireNombre = (n: number): string => formaterNombre(n);

  // `?scenario=partage` (lot B4) : les poses du résultat d'exemple, appliquées d'emblée et sans effets (l'écran de fin s'ouvre dessus) ; la partie est alors donnée pour finie.
  const exempleFin = !!extra.exemple;
  for (const a of extra.exemple ?? []) {
    const p = partie.piece;
    const pose = p ? partie.poser(colonneDe(a), ligneDe(a)) : null;
    if (!p || !pose) break;
    actions.push(a);
    familles[actions.length - 1] = p.famille;
    for (const c of casesDe(p)) poseDe[(pose.ligne + c.ligne) * COLONNES + pose.col + c.col] = actions.length;
    for (let i = 0; i < NB_CASES; i++) if ((pose.lignes >> Math.floor(i / COLONNES)) & 1 || (pose.colonnes >> i % COLONNES) & 1) poseDe[i] = 0;
  }
  if (exempleFin) reconstruire();

  // La porte des tests de navigateur (`?debug`, jamais en production) : de quoi viser la grille et la zone de saisie en coordonnées de la page, et lire ce que le joueur voit.
  if (!BUILD_RESTRICTED && new URLSearchParams(location.search).has("debug")) {
    const page = (r: Rect): Rect => {
      const c = canvas.getBoundingClientRect();
      return { x: c.left + decalageBord.x + r.x, y: c.top + decalageBord.y + r.y, w: r.w, h: r.h };
    };
    const pt = (x: number, y: number): { x: number; y: number } => {
      const c = canvas.getBoundingClientRect();
      return { x: c.left + decalageBord.x + x, y: c.top + decalageBord.y + y };
    };
    const porte: PorteBlocks = {
      disposition() {
        return { portrait: mep.portrait, cote: mep.cote, grille: page(mep.grille), main: page(mep.main), suivante: page(mep.suivante), score: page(mep.score), combo: page(mep.combo), boutons: page(mep.boutons), coteMain: mep.coteMain, centreMain: pt(mep.centreMain.x, mep.centreMain.y), coteSuivante: mep.coteSuivante };
      },
      piece: () => partie.piece?.nom ?? null,
      suivante: () => partie.suivante?.nom ?? null,
      ombre: () => ombreCourante(),
      surlignage: () => {
        const ombre = ombreCourante();
        return ombre?.legale ? partie.apercu(ombre.col, ombre.ligne) : null;
      },
      repos() {
        const p = partie.piece;
        if (!p) return null;
        const r = reposDe(p);
        return { rect: page({ x: r.x, y: r.y, w: p.largeur * r.cote, h: p.hauteur * r.cote }), cote: r.cote };
      },
      saisie() {
        const p = partie.piece;
        if (!saisie || !p) return null;
        const cotePiece = coteSaisie(p);
        const coin = coinSaisi(p, cotePiece)!;
        return { doigt: pt(saisie.x, saisie.y), piece: page({ x: coin.x, y: coin.y, w: p.largeur * cotePiece, h: p.hauteur * cotePiece }), cote: cotePiece, u: saisie.u, v: saisie.v };
      },
      grille: () => grilleEnTexte(partie.grille),
      etat: () => ({ score: partie.score, combo: partie.combo, comboMax: partie.comboMax, poses: partie.poses, sansEffacement: partie.sansEffacement, fin: partie.fin }),
      hud: () => ({ score: ecrireNombre(partie.score), combo: partie.combo > 0 ? `×${partie.combo}` : null, carres: partie.combo > 0 ? POSES_SANS_EFFACEMENT_MAX - 1 - Math.min(partie.sansEffacement, POSES_SANS_EFFACEMENT_MAX - 1) : 0, moutarde: partie.combo >= 2 }),
      polices: () => ({ ...policesVues }),
      decor: () => decor !== null,
      effets: () => ({
        effacees: effacees.length,
        fermees: effacees.filter((c) => c.yeux).length,
        particules: particules.length,
        annonces: annonces.filter((a) => etatAnnonce(a, maintenant) !== null).map((a) => a.texte),
        gains: gains.filter((x) => etatGain(x, maintenant) !== null).map((x) => x.texte),
      }),
      yeux: () => ({ paires: nbPaires, regard: dernierRegard }),
      sons: () => [...sons.joues],
      couche: () => couche.actif(),
    };
    (window as unknown as { __blocks?: PorteBlocks }).__blocks = porte;
  }

  return {
    avancer() {
      t++;
      // Le bot Diamant (`&bot`) : une pose toutes les `cadence` ticks, tant qu'on ne tient pas une pièce. Les poses passent par `poser`, comme celles d'un joueur : mêmes effets, mêmes sons, même rediffusion.
      if (bot && !partie.finie && !saisie && t % cadence === 0) {
        const coup = coupDuDiamant(partie);
        if (coup) poser(coup.col, coup.ligne);
      }
    },
    // La partie est finie pour le kit une seconde après la dernière pose possible : « Plus de place ! » reste à l'écran.
    finie: () => (partie.finie && tFin >= 0 && t - tFin >= TICKS_PLUS_DE_PLACE) || (exempleFin && t >= 1),
    // Lot B6 : la partie est jouée, « Plus de place ! » est encore à l'écran : le kit fait retomber la musique avant l'écran de fin.
    finEnCours: () => partie.finie && tFin >= 0,
    action(id) {
      if (id.startsWith("pose:")) {
        const [c, l] = id.slice(5).split(":").map(Number);
        poser(c!, l!);
        return;
      }
      const p = partie.piece;
      if (!p) return;
      geste();
      if (id === "poser") {
        clavier = true;
        poser(curseur.col, curseur.ligne);
        return;
      }
      clavier = true;
      if (id === "gauche") curseur.col--;
      else if (id === "droite") curseur.col++;
      else if (id === "haut") curseur.ligne--;
      else if (id === "bas") curseur.ligne++;
      bornes();
    },
    // Ce que lit un lecteur d'écran (la plaque du kit, cachée à la vue : le HUD est dessiné par la scène) : le score et le combo.
    hud: () => ({ principal: ecrireScore(partie.score), secondaire: partie.combo > 0 ? texte("hud.combo.lecteur", { n: partie.combo }) : "" }),
    resultat: () => {
      const r = partie.resultat() ?? { score: partie.score, combo: partie.comboMax, poses: partie.poses, raison: "bloquee" as const };
      return { score: VARIANTE.score(r), rediffusion: enregistrer(contenu, actions) };
    },
    // Lot B5 : plus de fantôme (seed § 5). Le kit appelle encore cette méthode (son bouton est caché par `blocks.css`, la touche G et le réglage « Fantôme » existent) : elle ne fait rien.
    fantome() {},
    dessiner,
    detruire() {
      couche.arreter();
      removeEventListener("keydown", geste);
      observateur.disconnect();
      canvas.remove();
      delete (window as unknown as { __blocks?: PorteBlocks }).__blocks;
    },
  };
}
