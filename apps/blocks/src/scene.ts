import { actionDe, COLONNES, LIGNES, NB_CASES, Partie, VARIANTE, caseOccupee, enregistrer, grilleEnTexte, type Contenu, type Piece } from "@cdj/blocks-sim";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { ENCRE, decrirePiece, type CoucheRelief } from "@cdj/visuels/blocs";
import { dessinerPiece } from "@cdj/visuels/blocs/canvas";
import { boitesDeCases, boitesDePiece, casesDe } from "./boites";
import { COULEUR_DEPART, couleurDeFamille } from "./couleurs";
import { lireEssai } from "./essai";
import { dans, disposer, type Disposition, type Rect } from "./miseEnPage";
import { ecrireScore, texte } from "./textes";

// Le rendu et les entrées de « Blocks » (lot B1) : la grille de 8 × 8, la pièce du moment dans une grande zone de saisie, la pièce suivante petite (non saisissable), en Canvas 2D avec les blocs communs
// (`@cdj/visuels/blocs`, la direction artistique de Tower). **De l'affichage seulement** : la partie est `Partie` de `@cdj/blocks-sim` ; une pose est une action `ligne × 8 + colonne`, et cette suite d'actions
// est la rediffusion. Le glisser-déposer (seed § 6) : la pièce saisie grossit à la taille des cases et flotte au-dessus du doigt ; une ombre est aimantée à la case la plus proche ; les lignes et colonnes qui
// seraient effacées s'allument ; relâcher hors d'un endroit valide la renvoie à sa place. Clavier et manette (M1, M2) : déplacer l'ombre case par case (`gauche` … `bas`), `poser`.
// Hors lot : effets, particules, sons, yeux (B2), fantôme (B4). Aucune couleur écrite ici hors la palette commune : les fonds sont les jetons de `@cdj/ui`.

/** Les actions de « Blocks » : l'ombre au clavier et à la manette, et `poser` ; `pose:<colonne>:<ligne>` pose directement (tests, outils). */
export const ACTIONS_SCENE = ["gauche", "droite", "haut", "bas", "poser"] as const;

/** Le décalage de la pièce au-dessus du doigt (en cases) : le bas de la pièce flotte à cette hauteur du point touché. Réglable : `?debug&tune&decalage=`. */
export const DECALAGE_TACTILE = 1.3;
export const DECALAGE_SOURIS = 0.4;
/** Combien de ticks (30 Hz) « Plus de place ! » reste affiché avant l'écran de fin (environ 1 s). */
export const TICKS_PLUS_DE_PLACE = 30;
const TICKS_GAIN = 36;
const TICKS_FLASH = 8;
/** Le glissement : une case d'ombre est choisie si la pièce est à moins d'une case d'une position légale. */
const PORTEE_AIMANT = 1;

const jeton = (nom: string): string => getComputedStyle(document.documentElement).getPropertyValue(`--dj-${nom}`).trim() || "currentColor";
interface Palette {
  fond: string;
  case: string;
  trait: string;
  zone: string;
  surligne: string;
  texte: string;
  bandeau: string;
}
function palette(theme: string): Palette {
  return theme === "sombre"
    ? { fond: jeton("encre"), case: jeton("encre-douce"), trait: jeton("creme-2"), zone: jeton("encre-douce"), surligne: jeton("moutarde"), texte: jeton("creme"), bandeau: jeton("encre") }
    : { fond: jeton("creme-2"), case: jeton("creme"), trait: jeton("encre"), zone: jeton("creme"), surligne: jeton("moutarde"), texte: jeton("encre"), bandeau: jeton("creme") };
}

/** La porte des tests de navigateur (`window.__blocks`, `?debug` seulement) : positions en coordonnées de la page. */
export interface PorteBlocks {
  disposition(): { portrait: boolean; cote: number; grille: Rect; main: Rect; coteMain: number; centreMain: { x: number; y: number }; coteSuivante: number };
  piece(): string | null;
  suivante(): string | null;
  ombre(): { col: number; ligne: number; legale: boolean } | null;
  surlignage(): { lignes: number; colonnes: number } | null;
  saisie(): { doigt: { x: number; y: number }; piece: Rect; cote: number } | null;
  grille(): string[];
  etat(): { score: number; combo: number; comboMax: number; poses: number; sansEffacement: number; fin: string | null };
}

interface Gain {
  texte: string;
  x: number;
  y: number;
  t0: number;
}

export function nouvellePartieBlocks(contenu: Contenu, hote: HTMLElement, o: OptionsPartie): PartieDuJeu {
  const essai = lireEssai(location.search, BUILD_RESTRICTED, 0); // sur la production, aucune option d'essai (règle R9)
  const decalageTactile = essai.decalage ?? DECALAGE_TACTILE;
  const partie = new Partie(contenu);
  const actions: number[] = [];
  const couleurs = palette(o.theme);
  const canvas = document.createElement("canvas");
  canvas.className = "blocks-plateau";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", o.libelle);
  hote.append(canvas);
  const g = canvas.getContext("2d")!;

  // --- L'état d'AFFICHAGE : la pose d'origine de chaque case occupée (pour sa couleur), les gains flottants, l'éclair des cases effacées ---
  const poseDe = new Int16Array(NB_CASES); // 0 : vide ; sinon l'index de la pose + 1 (les cases de départ d'un scénario : -1)
  const familles: (Piece["famille"] | null)[] = [];
  for (let l = 0; l < LIGNES; l++) for (let c = 0; c < COLONNES; c++) if (caseOccupee(partie.grille, c, l)) poseDe[l * COLONNES + c] = -1;
  let groupes: { couches: CoucheRelief[] }[] = [];
  const reconstruire = (): void => {
    const parPose = new Map<number, { col: number; ligne: number }[]>();
    poseDe.forEach((p, i) => {
      if (p !== 0) parPose.set(p, [...(parPose.get(p) ?? []), { col: i % COLONNES, ligne: Math.floor(i / COLONNES) }]);
    });
    groupes = [...parPose].map(([p, cases]) => ({ couches: decrirePiece(boitesDeCases(cases, 0, 0), { couleur: p < 0 ? COULEUR_DEPART : couleurDeFamille(familles[p - 1]!), encre: ENCRE }) }));
  };
  reconstruire();
  const gains: Gain[] = [];
  let flash: { masque: boolean[]; t0: number } | null = null;
  let t = 0; // les ticks de la scène (30 Hz) : animations seulement
  let tFin = partie.finie ? 0 : -1;

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
  };
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(hote);
  redimensionner();

  // --- Le glisser-déposer, le clavier ---
  let saisie: { x: number; y: number; souris: boolean; depuis: number } | null = null; // le point touché (coordonnées du canvas)
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

  /** Le coin haut-gauche de la pièce saisie, en cases (fractionnaire), d'après le point touché. */
  const positionSaisie = (): { cx: number; cy: number } | null => {
    const p = partie.piece;
    if (!saisie || !p) return null;
    const decal = saisie.souris ? DECALAGE_SOURIS : decalageTactile;
    const gauche = saisie.x - (p.largeur * mep.cote) / 2;
    const bas = saisie.y - decal * mep.cote;
    return { cx: (gauche - decalageBord.x - mep.grille.x) / mep.cote, cy: (bas - p.hauteur * mep.cote - decalageBord.y - mep.grille.y) / mep.cote };
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

  const caseCentre = (col: number, ligne: number): { x: number; y: number } => ({ x: decalageBord.x + mep.grille.x + (col + 0.5) * mep.cote, y: decalageBord.y + mep.grille.y + (ligne + 0.5) * mep.cote });

  function poser(col: number, ligne: number): boolean {
    const p = partie.piece;
    const pose = partie.poser(col, ligne);
    if (!p || !pose) return false;
    actions.push(actionDe(col, ligne));
    const index = actions.length; // l'index de la pose + 1
    familles[index - 1] = p.famille;
    for (const c of casesDe(p)) poseDe[(ligne + c.ligne) * COLONNES + col + c.col] = index;
    const effaces: boolean[] = Array(NB_CASES).fill(false);
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let l = 0; l < LIGNES; l++) {
      for (let c = 0; c < COLONNES; c++) {
        if ((pose.lignes >> l) & 1 || (pose.colonnes >> c) & 1) {
          effaces[l * COLONNES + c] = true;
          poseDe[l * COLONNES + c] = 0;
          sx += c + 0.5;
          sy += l + 0.5;
          n++;
        }
      }
    }
    if (n > 0) flash = { masque: effaces, t0: t };
    reconstruire();
    const centre = n > 0 ? caseCentre(sx / n - 0.5, sy / n - 0.5) : caseCentre(col + (p.largeur - 1) / 2, ligne + (p.hauteur - 1) / 2);
    gains.push({ texte: `+${pose.gain}`, x: centre.x, y: centre.y, t0: t });
    if (partie.finie) tFin = t;
    bornes();
    return true;
  }

  const point = (e: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const dansMain = (x: number, y: number): boolean => dans({ x: mep.main.x + decalageBord.x, y: mep.main.y + decalageBord.y, w: mep.main.w, h: mep.main.h }, x, y);
  canvas.addEventListener("pointerdown", (e) => {
    if (partie.finie || saisie) return;
    const { x, y } = point(e);
    if (!dansMain(x, y)) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    saisie = { x, y, souris: e.pointerType === "mouse", depuis: performance.now() };
    clavier = false;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!saisie) return;
    const { x, y } = point(e);
    saisie.x = x;
    saisie.y = y;
  });
  const relacher = (pose: boolean): void => {
    if (!saisie) return;
    const cible = pose ? aimante() : null;
    saisie = null;
    if (cible) {
      poser(cible.col, cible.ligne);
      curseur.col = cible.col;
      curseur.ligne = cible.ligne;
      bornes();
    }
  };
  canvas.addEventListener("pointerup", () => relacher(true));
  canvas.addEventListener("pointercancel", () => relacher(false));

  // --- Le dessin ---
  const police = (px: number): string => `700 ${Math.round(px)}px ${jeton("police-chiffres") || "sans-serif"}`;
  function pieceEn(c: CanvasRenderingContext2D, p: Piece, x: number, y: number, cote: number, alpha = 1): void {
    c.globalAlpha = alpha;
    dessinerPiece(c, { x, y, pxParMetre: cote }, decrirePiece(boitesDePiece(p), { couleur: couleurDeFamille(p.famille), encre: ENCRE }));
    c.globalAlpha = 1;
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
  function dessiner(): void {
    g.clearRect(0, 0, largeur, hauteur);
    g.save();
    g.translate(decalageBord.x, decalageBord.y);
    const { grille, cote, main } = mep;
    // La zone de saisie.
    g.fillStyle = couleurs.zone;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.roundRect(main.x, main.y, main.w, main.h, 14);
    g.fill();
    g.globalAlpha = 1;
    // La grille.
    g.fillStyle = couleurs.fond;
    g.fillRect(grille.x, grille.y, grille.w, grille.h);
    for (let l = 0; l < LIGNES; l++) {
      for (let c = 0; c < COLONNES; c++) {
        g.fillStyle = couleurs.case;
        g.fillRect(grille.x + c * cote + 1, grille.y + l * cote + 1, cote - 2, cote - 2);
      }
    }
    // Les blocs posés (les groupes de cases d'une même pose, réunis sans joint).
    for (const grp of groupes) dessinerGroupe(grp.couches);
    // L'éclair des cases tout juste effacées.
    if (flash && !o.reduit && t - flash.t0 < TICKS_FLASH) {
      g.fillStyle = couleurs.surligne;
      g.globalAlpha = 0.8 * (1 - (t - flash.t0) / TICKS_FLASH);
      flash.masque.forEach((oui, i) => oui && g.fillRect(grille.x + (i % COLONNES) * cote, grille.y + Math.floor(i / COLONNES) * cote, cote, cote));
      g.globalAlpha = 1;
    }
    g.strokeStyle = couleurs.trait;
    g.lineWidth = 3;
    g.strokeRect(grille.x - 1.5, grille.y - 1.5, grille.w + 3, grille.h + 3);

    // L'ombre (glisser-déposer ou clavier) et les lignes qui seraient effacées.
    const p = partie.piece;
    const ombre = ombreCourante();
    if (p && ombre) {
      const apercu = ombre.legale ? partie.apercu(ombre.col, ombre.ligne) : null;
      if (apercu) {
        g.fillStyle = couleurs.surligne;
        g.globalAlpha = 0.45;
        for (let l = 0; l < LIGNES; l++) if ((apercu.lignes >> l) & 1) g.fillRect(grille.x, grille.y + l * cote, grille.w, cote);
        for (let c = 0; c < COLONNES; c++) if ((apercu.colonnes >> c) & 1) g.fillRect(grille.x + c * cote, grille.y, cote, grille.h);
        g.globalAlpha = 1;
      }
      pieceEn(g, p, grille.x + (ombre.col + p.largeur / 2) * cote, grille.y + (ombre.ligne + p.hauteur / 2) * cote, cote, ombre.legale ? 0.5 : 0.2);
    }

    // La pièce suivante (petite, non saisissable) et la pièce du moment.
    const suivante = partie.suivante;
    if (suivante) pieceEn(g, suivante, mep.centreSuivante.x, mep.centreSuivante.y, mep.coteSuivante, 0.9);
    if (p) {
      pieceEn(g, p, mep.centreMain.x, mep.centreMain.y, mep.coteMain, saisie ? 0.25 : 1);
    }
    g.restore();
    if (p && saisie) {
      // La pièce saisie : à la taille des cases, au-dessus du doigt (elle grossit en un instant).
      const age = o.reduit ? 1 : Math.min(1, (performance.now() - saisie.depuis) / 90);
      const cotePiece = mep.coteMain + (cote - mep.coteMain) * age;
      const decal = saisie.souris ? DECALAGE_SOURIS : decalageTactile;
      pieceEn(g, p, saisie.x, saisie.y - decal * cote - (p.hauteur * cotePiece) / 2, cotePiece);
    }
    g.save();
    g.translate(decalageBord.x, decalageBord.y);
    // Les gains flottants : « +n » en texte simple.
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const gain of gains) {
      const age = (t - gain.t0) / TICKS_GAIN;
      if (age < 0 || age > 1) continue;
      const y = gain.y - decalageBord.y - (o.reduit ? 0 : age * cote * 1.2);
      g.globalAlpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3;
      g.font = police(cote * 0.55);
      g.lineWidth = 4;
      g.strokeStyle = couleurs.bandeau;
      g.strokeText(gain.texte, gain.x - decalageBord.x, y);
      g.fillStyle = couleurs.texte;
      g.fillText(gain.texte, gain.x - decalageBord.x, y);
    }
    g.globalAlpha = 1;
    // « Plus de place ! » : environ 1 s avant l'écran de fin.
    if (partie.finie) {
      const bw = Math.min(grille.w - 16, cote * 6.5);
      const bh = cote * 1.5;
      const bx = grille.x + (grille.w - bw) / 2;
      const by = grille.y + (grille.h - bh) / 2;
      g.fillStyle = couleurs.bandeau;
      g.strokeStyle = couleurs.trait;
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(bx, by, bw, bh, 12);
      g.fill();
      g.stroke();
      g.fillStyle = couleurs.texte;
      g.font = police(cote * 0.62);
      g.fillText(texte("fin.plusDePlace"), grille.x + grille.w / 2, by + bh / 2);
    }
    g.restore();
  }
  function dessinerGroupe(couches: CoucheRelief[]): void {
    dessinerPiece(g, { x: mep.grille.x, y: mep.grille.y, pxParMetre: mep.cote }, couches);
  }

  // La porte des tests de navigateur (`?debug`, jamais en production) : de quoi viser la grille et la zone de saisie en coordonnées de la page, et lire ce que le joueur voit.
  if (!BUILD_RESTRICTED && new URLSearchParams(location.search).has("debug")) {
    const page = (r: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } => {
      const c = canvas.getBoundingClientRect();
      return { x: c.left + decalageBord.x + r.x, y: c.top + decalageBord.y + r.y, w: r.w, h: r.h };
    };
    const porte: PorteBlocks = {
      disposition() {
        const c = canvas.getBoundingClientRect();
        return { portrait: mep.portrait, cote: mep.cote, grille: page(mep.grille), main: page(mep.main), coteMain: mep.coteMain, centreMain: { x: c.left + decalageBord.x + mep.centreMain.x, y: c.top + decalageBord.y + mep.centreMain.y }, coteSuivante: mep.coteSuivante };
      },
      piece: () => partie.piece?.nom ?? null,
      suivante: () => partie.suivante?.nom ?? null,
      ombre: () => ombreCourante(),
      surlignage: () => {
        const o = ombreCourante();
        return o?.legale ? partie.apercu(o.col, o.ligne) : null;
      },
      saisie() {
        const p = partie.piece;
        if (!saisie || !p) return null;
        const c = canvas.getBoundingClientRect();
        const age = o.reduit ? 1 : Math.min(1, (performance.now() - saisie.depuis) / 90);
        const cotePiece = mep.coteMain + (mep.cote - mep.coteMain) * age;
        const decal = saisie.souris ? DECALAGE_SOURIS : decalageTactile;
        const bas = saisie.y - decal * mep.cote;
        return { doigt: { x: c.left + saisie.x, y: c.top + saisie.y }, piece: { x: c.left + saisie.x - (p.largeur * cotePiece) / 2, y: c.top + bas - p.hauteur * cotePiece, w: p.largeur * cotePiece, h: p.hauteur * cotePiece }, cote: cotePiece };
      },
      grille: () => grilleEnTexte(partie.grille),
      etat: () => ({ score: partie.score, combo: partie.combo, comboMax: partie.comboMax, poses: partie.poses, sansEffacement: partie.sansEffacement, fin: partie.fin }),
    };
    (window as unknown as { __blocks?: PorteBlocks }).__blocks = porte;
  }

  return {
    avancer() {
      t++;
      while (gains.length > 0 && t - gains[0]!.t0 > TICKS_GAIN) gains.shift();
    },
    // La partie est finie pour le kit une seconde après la dernière pose possible : « Plus de place ! » reste à l'écran.
    finie: () => partie.finie && tFin >= 0 && t - tFin >= TICKS_PLUS_DE_PLACE,
    action(id) {
      if (id.startsWith("pose:")) {
        const [c, l] = id.slice(5).split(":").map(Number);
        poser(c!, l!);
        return;
      }
      const p = partie.piece;
      if (!p) return;
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
    hud: () => ({ principal: ecrireScore(partie.score), secondaire: partie.combo > 0 ? texte("hud.combo", { n: partie.combo }) : "" }),
    resultat: () => {
      const r = partie.resultat() ?? { score: partie.score, combo: partie.comboMax, poses: partie.poses, raison: "bloquee" as const };
      return { score: VARIANTE.score(r), rediffusion: enregistrer(contenu, actions) };
    },
    fantome() {
      /* le fantôme vient au lot B4 */
    },
    dessiner,
    detruire() {
      observateur.disconnect();
      canvas.remove();
      delete (window as unknown as { __blocks?: PorteBlocks }).__blocks;
    },
  };
}
