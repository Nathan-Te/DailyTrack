import { COLONNES, DUREE_TICKS, LIGNES, MAX_TOUCHES, NB_CASES, NB_CIBLES, Partie, TICKS_PAR_SECONDE, caseAuPoint, decoderRediffusion, enregistrer, type Contenu, type Touche } from "@cdj/cibles-sim";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";

// Le rendu et les entrées de « Cibles » : un plateau de 8 × 6 cases en Canvas 2D (pas de Three.js), la cible visible, le curseur du clavier et de la manette, le fantôme. **De l'affichage seulement** : la partie est
// `Partie` de `@cdj/cibles-sim` (entière, 30 Hz) ; une touche est enregistrée à son tick et c'est cette suite de touches qui est la rediffusion. Les couleurs sont celles des jetons de `@cdj/ui`, lues dans la feuille de style :
// aucune couleur écrite ici. Les deux thèmes (sable, ardoise) ne changent que ces couleurs. Avec `prefers-reduced-motion` (ou le réglage du joueur) rien ne pulse ni ne clignote.

interface Couleurs {
  fond: string;
  case: string;
  ligne: string;
  cible: string;
  cercle: string;
  curseur: string;
  fantome: string;
  gagne: string;
}
const jeton = (nom: string): string => getComputedStyle(document.documentElement).getPropertyValue(`--dj-${nom}`).trim() || "currentColor";
function couleurs(theme: string): Couleurs {
  return theme === "ardoise"
    ? { fond: jeton("encre"), case: jeton("encre-douce"), ligne: jeton("creme-2"), cible: jeton("moutarde"), cercle: jeton("creme"), curseur: jeton("creme"), fantome: jeton("argent"), gagne: jeton("or") }
    : { fond: jeton("creme-2"), case: jeton("creme"), ligne: jeton("encre"), cible: jeton("terre"), cercle: jeton("encre"), curseur: jeton("moutarde"), fantome: jeton("encre-douce"), gagne: jeton("ambre") };
}

/** Les actions de « Cibles » : le curseur (clavier, manette) et la touche ; `case:<n>` touche directement la case n (tests, outils). */
export const ACTIONS_SCENE = ["gauche", "droite", "haut", "bas", "toucher"] as const;

export function nouvellePartieCibles(contenu: Contenu, hote: HTMLElement, o: OptionsPartie): PartieDuJeu {
  const partie = new Partie(contenu);
  const touches: Touche[] = [];
  const palette = couleurs(o.theme);
  const canvas = document.createElement("canvas");
  canvas.className = "cibles-plateau";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", o.libelle);
  hote.append(canvas);
  const g = canvas.getContext("2d")!;
  let fantome: Touche[] = [];
  const lireFantome = (r: string | null): void => {
    try {
      fantome = r ? decoderRediffusion(r).touches : [];
    } catch {
      fantome = [];
    }
  };
  lireFantome(o.fantome);
  let curseur = 0;
  let largeur = 0;
  let hauteur = 0;
  let cote = 0;
  const redimensionner = (): void => {
    const r = hote.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    largeur = Math.max(1, Math.floor(r.width));
    hauteur = Math.max(1, Math.floor(r.height));
    cote = Math.floor(Math.min((largeur - 4) / COLONNES, (hauteur - 4) / LIGNES));
    canvas.width = Math.max(1, cote * COLONNES * dpr);
    canvas.height = Math.max(1, cote * LIGNES * dpr);
    canvas.style.width = `${cote * COLONNES}px`;
    canvas.style.height = `${cote * LIGNES}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(hote);
  redimensionner();

  let derniereTouche = -1000;
  let derniereCase = -1;
  const toucher = (c: number): void => {
    if (partie.finie || touches.length >= MAX_TOUCHES || c < 0 || c >= NB_CASES) return;
    touches.push({ tick: partie.tick, c });
    if (partie.toucher(c)) {
      derniereTouche = partie.tick;
      derniereCase = c;
    }
  };
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    const c = caseAuPoint(e.clientX - r.left, e.clientY - r.top, r.width, r.height, LIGNES);
    if (c >= 0) {
      curseur = c;
      toucher(c);
    }
  });
  const centre = (c: number): [number, number] => [(c % COLONNES) * cote + cote / 2, Math.floor(c / COLONNES) * cote + cote / 2];

  return {
    avancer: () => partie.avancer(),
    finie: () => partie.finie,
    action(id) {
      if (id.startsWith("case:")) return toucher(Number(id.slice(5)));
      const x = curseur % COLONNES;
      const y = Math.floor(curseur / COLONNES);
      if (id === "gauche") curseur = y * COLONNES + ((x + COLONNES - 1) % COLONNES);
      else if (id === "droite") curseur = y * COLONNES + ((x + 1) % COLONNES);
      else if (id === "haut") curseur = ((y + LIGNES - 1) % LIGNES) * COLONNES + x;
      else if (id === "bas") curseur = ((y + 1) % LIGNES) * COLONNES + x;
      else if (id === "toucher") toucher(curseur);
    },
    hud() {
      const reste = Math.max(0, Math.ceil((DUREE_TICKS - partie.tick) / TICKS_PAR_SECONDE));
      return { principal: `${partie.touches} / ${NB_CIBLES}`, secondaire: `0:${String(reste).padStart(2, "0")}` };
    },
    resultat() {
      const r = partie.resultat();
      return { score: [r.touches, r.dernier], rediffusion: enregistrer(contenu, touches) };
    },
    fantome: lireFantome,
    dessiner() {
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = palette.fond;
      g.fillRect(0, 0, cote * COLONNES, cote * LIGNES);
      g.lineWidth = 1;
      g.strokeStyle = palette.ligne;
      for (let c = 0; c < NB_CASES; c++) {
        const x = (c % COLONNES) * cote;
        const y = Math.floor(c / COLONNES) * cote;
        g.fillStyle = palette.case;
        g.fillRect(x + 1, y + 1, cote - 2, cote - 2);
        g.strokeRect(x + 0.5, y + 0.5, cote - 1, cote - 1);
      }
      // Le fantôme : un anneau pâle là où l'autre partie a touché, pendant 10 ticks.
      g.strokeStyle = palette.fantome;
      g.lineWidth = 3;
      for (const f of fantome) {
        if (f.tick > partie.tick || partie.tick - f.tick > 10) continue;
        const [cx, cy] = centre(f.c);
        g.beginPath();
        g.arc(cx, cy, cote * 0.3, 0, Math.PI * 2);
        g.stroke();
      }
      const v = partie.cibleVisible();
      if (v >= 0) {
        const cible = contenu.cibles[v]!;
        const [cx, cy] = centre(cible.c);
        const reste = (cible.f - partie.tick) / (cible.f - cible.d);
        g.fillStyle = palette.cible;
        g.beginPath();
        g.arc(cx, cy, cote * 0.34, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = palette.cercle;
        g.lineWidth = Math.max(2, cote * 0.05);
        g.beginPath();
        g.arc(cx, cy, cote * (o.reduit ? 0.34 : 0.14 + 0.2 * reste), 0, Math.PI * 2);
        g.stroke();
      }
      if (!o.reduit && derniereCase >= 0 && partie.tick - derniereTouche < 6) {
        const [cx, cy] = centre(derniereCase);
        g.fillStyle = palette.gagne;
        g.globalAlpha = 1 - (partie.tick - derniereTouche) / 6;
        g.beginPath();
        g.arc(cx, cy, cote * 0.42, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      g.strokeStyle = palette.curseur;
      g.lineWidth = 3;
      g.strokeRect((curseur % COLONNES) * cote + 3, Math.floor(curseur / COLONNES) * cote + 3, cote - 6, cote - 6);
    },
    detruire() {
      observateur.disconnect();
      canvas.remove();
    },
  };
}
