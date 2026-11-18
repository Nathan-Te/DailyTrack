// Les dessins propres à Gravity (lot GR3), **purs** : des tampons de géométrie (`Art` de `@cdj/visuels/plateformes/three`, sans moteur de rendu), dans l'espace d'une case (1 × 1, y vers le haut, origine au centre pour les objets,
// au coin bas-gauche pour les blocs). Ce que Jump dessine déjà vient de `@cdj/visuels` (thèmes, tuiles, fonds, personnage, couleurs des blocs) ; ici : les objets à ramasser, l'aura, le bandeau du héros, l'inverseur, le dessin des
// piques et des blocs qui changent, avec leurs états d'avertissement. **Rien ici ne lit la simulation** : les états (allumé, bientôt éteint…) sont calculés par `etatDuBloc` à partir d'un pas et d'un décalage, que la scène lit.
import { BLOCK_STYLE, HAZARD, HAZARD_OUTLINE, mix, type BlockStyle } from "@cdj/visuels/plateformes";
import { Art } from "@cdj/visuels/plateformes/three";
import { ALTERNE_BATTEMENT, CLIGNOTANT_ALLUME, CLIGNOTANT_CYCLE, ALTERNE_A, ALTERNE_B, CLIGNOTANT } from "@cdj/gravity-sim";
/* Lot GR7 : les dessins des dangers sont en bas du fichier. */

const BLANC = 0xffffff;
const Z = { piques: 0.05, bloc: 0.02, repere: 0.03, objet: 0.1, aura: 0.2, bandeau: 0.06 } as const;
export { Z };

/** Une pièce : disque papier cerclé d'encre, une fente d'encre (la tranche qui tourne). Centrée en (0, 0), rayon ≈ 0,29. */
export function dessinPiece(encre: number, papier: number): Art {
  const a = new Art();
  a.disc(0, 0, 0.29, Z.objet, encre, 16);
  a.disc(0, 0, 0.215, Z.objet + 0.001, papier, 16);
  a.rect(-0.022, -0.12, 0.022, 0.12, Z.objet + 0.002, encre);
  return a;
}

/** Une gemme : un losange couleur Diamant cerné d'encre, une facette claire. */
export function dessinGemme(encre: number, diamant: number): Art {
  const a = new Art();
  const losange = (r: number, l: number): number[] => [0, r, l, 0, 0, -r, -l, 0];
  a.fan(0, 0, losange(0.4, 0.33), Z.objet, encre, encre);
  a.fan(0, 0, losange(0.32, 0.25), Z.objet + 0.001, diamant, diamant);
  const clair = mix(diamant, BLANC, 0.65);
  a.fan(-0.07, 0.07, [-0.07, 0.2, 0.09, 0.06, -0.14, -0.02], Z.objet + 0.002, clair, clair);
  return a;
}

/** Un bonus : un disque papier cerclé d'encre, le dessin Diamant au centre (bouclier : un écu ; aimant : un fer à cheval). */
export function dessinBonus(type: "bouclier" | "aimant", encre: number, papier: number, diamant: number): Art {
  const a = new Art();
  a.disc(0, 0, 0.44, Z.objet, encre, 20);
  a.disc(0, 0, 0.375, Z.objet + 0.001, papier, 20);
  const z = Z.objet + 0.002;
  if (type === "bouclier") {
    const ecu = (k: number): number[] => [0, 0.22 * k, 0.18 * k, 0.13 * k, 0.15 * k, -0.08 * k, 0, -0.22 * k, -0.15 * k, -0.08 * k, -0.18 * k, 0.13 * k];
    a.fan(0, 0, ecu(1.32), z, encre, encre);
    a.fan(0, 0, ecu(1), z + 0.001, diamant, diamant);
  } else {
    // le fer à cheval : un arc en haut, deux branches ; l'encre dessous, un peu plus large
    const fer = (e: number, couleur: number, dz: number): void => {
      a.arcBand(0, 0.02, 0.07 - e, 0.2 + e, Math.PI, 0, z + dz, couleur, 10);
      a.rect(-0.2 - e, -0.19 - e, -0.07 + e, 0.02, z + dz, couleur);
      a.rect(0.07 - e, -0.19 - e, 0.2 + e, 0.02, z + dz, couleur);
    };
    fer(0.04, encre, 0);
    fer(0, diamant, 0.001);
    a.rect(-0.2, -0.19, -0.07, -0.11, z + 0.002, papier);
    a.rect(0.07, -0.19, 0.2, -0.11, z + 0.002, papier);
  }
  return a;
}

/** L'aura du bouclier : un anneau Diamant (rayon 0,62 à 0,69). Le disque qui le remplit est un autre tampon (transparent). */
export function dessinAnneau(diamant: number): Art {
  const a = new Art();
  a.arcBand(0, 0, 0.6, 0.68, 0, Math.PI * 2, Z.aura, diamant, 32);
  return a;
}
export function dessinDisque(couleur: number, r = 0.6): Art {
  const a = new Art();
  a.disc(0, 0, r, Z.aura - 0.01, couleur, 32);
  return a;
}

/** Le cercle en tirets de l'aimant (rayon `r` en cases). */
export function dessinTirets(couleur: number, r: number): Art {
  const a = new Art();
  const n = 30;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2;
    a.arcBand(0, 0, r - 0.045, r + 0.045, a0, a0 + (Math.PI * 2) / n / 2, Z.aura - 0.02, couleur, 2);
  }
  return a;
}

/**
 * Le bandeau d'encre du héros : le ruban autour de la tête et, séparément, ses deux pans qui flottent (chacun pivote autour de son attache, en (0, 0) de son tampon). Repère du héros : bas-milieu de la boîte (0,8 × 0,8), y vers le haut ;
 * les yeux sont à 0,37–0,63, le ruban juste au-dessus.
 */
export const BANDEAU = { y0: 0.645, y1: 0.765, demi: 0.43, attacheX: -0.41, attacheY: 0.705 } as const;
export function dessinRuban(encre: number): Art {
  const a = new Art();
  a.rect(-BANDEAU.demi, BANDEAU.y0, BANDEAU.demi, BANDEAU.y1, Z.bandeau, encre);
  return a;
}
export function dessinPan(encre: number, haut: boolean): Art {
  const a = new Art();
  if (haut) a.quad([0, 0.035, -0.4, 0.13, -0.34, -0.02, 0, -0.035], Z.bandeau, encre);
  else a.quad([0, 0.02, -0.34, -0.1, -0.27, -0.22, 0, -0.055], Z.bandeau, encre);
  return a;
}

/** Un pique de la case : deux pointes rouges cernées de sombre, vers le haut (la base en bas de la case) ou vers le bas. `(cx, r)` : colonne et rangée de la case (y = −rangée). */
export function ajouterPique(a: Art, cx: number, r: number, versLeHaut: boolean): void {
  for (let k = 0; k < 2; k++) {
    const x = cx + k * 0.5;
    const base = versLeHaut ? -r - 1 : -r;
    const sens = versLeHaut ? 1 : -1;
    const pointe = (marge: number, hauteur: number): number[] => [x + 0.04 - marge, base - sens * marge * 0.4, x + 0.25, base + sens * hauteur, x + 0.46 + marge, base - sens * marge * 0.4];
    const cerne = pointe(0.045, 0.82);
    const t = (pts: number[], z: number, couleur: number): void => {
      const v = [0, 1, 2].map((i) => a.vertex(pts[i * 2]!, pts[i * 2 + 1]!, z, couleur));
      a.tri(v[0]!, v[1]!, v[2]!);
    };
    t(cerne, Z.piques, HAZARD_OUTLINE);
    t(pointe(0, 0.75), Z.piques + 0.001, HAZARD);
  }
}

/** L'inverseur : une plaque violette, le liseré papier, une double flèche. Case entière (0 à 1). */
export function dessinInverseur(papier: number): Art {
  const a = new Art();
  const face = 0x3a3550;
  a.rect(0, 0, 1, 1, Z.bloc, face);
  const e = 0.09;
  a.rect(0, 0, 1, e, Z.repere, papier);
  a.rect(0, 1 - e, 1, 1, Z.repere, papier);
  a.rect(0, 0, e, 1, Z.repere, papier);
  a.rect(1 - e, 0, 1, 1, Z.repere, papier);
  // la double flèche : une tige, une pointe à chaque bout
  a.rect(0.46, 0.22, 0.54, 0.78, Z.repere, papier);
  a.quad([0.5, 0.86, 0.32, 0.64, 0.68, 0.64, 0.5, 0.86], Z.repere, papier);
  a.quad([0.5, 0.14, 0.32, 0.36, 0.68, 0.36, 0.5, 0.14], Z.repere, papier);
  return a;
}

// ——— Les blocs qui changent : clignotant (violet bleu), alternés A (turquoise, barre) et B (violet, losange) ———
export type TypeBloc = typeof CLIGNOTANT | typeof ALTERNE_A | typeof ALTERNE_B;
export const STYLE_BLOC: Record<TypeBloc, BlockStyle> = { [CLIGNOTANT]: BLOCK_STYLE.blink, [ALTERNE_A]: BLOCK_STYLE.altA, [ALTERNE_B]: BLOCK_STYLE.altB };

/** Les quatre états visibles d'un bloc qui change : plein, plein qui s'annonce (plus clair), absent (contour), absent qui revient (contour vif). */
export type VarianteBloc = "plein" | "alerte" | "absent" | "retour";

function cadre(a: Art, l: number, z: number, couleur: number): void {
  a.rect(0, 0, 1, l, z, couleur);
  a.rect(0, 1 - l, 1, 1, z, couleur);
  a.rect(0, l, l, 1 - l, z, couleur);
  a.rect(1 - l, l, 1, 1 - l, z, couleur);
}
function repere(a: Art, type: TypeBloc, couleur: number): void {
  const z = Z.repere;
  if (type === ALTERNE_A) a.rect(0.44, 0.24, 0.56, 0.76, z, couleur); // la barre
  else if (type === ALTERNE_B) a.fan(0.5, 0.5, [0.5, 0.78, 0.72, 0.5, 0.5, 0.22, 0.28, 0.5], z, couleur, couleur); // le losange
  else a.rect(0.4, 0.4, 0.6, 0.6, z, couleur); // la lampe du clignotant
}

export function dessinBloc(type: TypeBloc, variante: VarianteBloc): Art {
  const s = STYLE_BLOC[type];
  const a = new Art();
  switch (variante) {
    case "plein":
    case "alerte": {
      const alerte = variante === "alerte";
      a.rect(0, 0, 1, 1, Z.bloc, alerte ? mix(s.fill, BLANC, 0.5) : s.fill);
      cadre(a, 0.1, Z.bloc + 0.001, s.edge);
      repere(a, type, alerte ? s.fill : s.edge);
      break;
    }
    case "absent":
      // un contour de la couleur du bloc, plus un second liseré fin : on voit où il va revenir
      cadre(a, 0.07, Z.bloc, s.fill);
      a.rect(0.16, 0.16, 0.84, 0.19, Z.bloc, mix(s.fill, 0x000000, 0.35));
      a.rect(0.16, 0.81, 0.84, 0.84, Z.bloc, mix(s.fill, 0x000000, 0.35));
      repere(a, type, mix(s.fill, 0x000000, 0.25));
      break;
    case "retour":
      cadre(a, 0.12, Z.bloc, s.edge);
      repere(a, type, s.edge);
      break;
  }
  return a;
}

/** L'état d'un bloc qui change à un pas donné : ce qu'il montre. Pure, entière : la même sur tous les appareils. */
export function etatDuBloc(type: TypeBloc, tick: number, decalage: number): VarianteBloc {
  const t = tick + decalage;
  if (type === CLIGNOTANT) {
    const p = t % CLIGNOTANT_CYCLE;
    if (p < CLIGNOTANT_ALLUME) {
      const reste = CLIGNOTANT_ALLUME - p;
      // il s'annonce de loin : un battement lent (3,3 par seconde) dans les 0,7 s qui précèdent, puis plus vite (7,5 par seconde) dans les 0,3 dernières secondes
      if (reste <= 36) return Math.floor((reste - 1) / 8) % 2 === 0 ? "alerte" : "plein";
      if (reste <= 84) return Math.floor((reste - 1) / 18) % 2 === 0 ? "alerte" : "plein";
      return "plein";
    }
    // absent : le contour vif dans les 0,2 s avant son retour
    return CLIGNOTANT_CYCLE - p <= 24 ? "retour" : "absent";
  }
  const phase = t % ALTERNE_BATTEMENT;
  const actif = (Math.floor(t / ALTERNE_BATTEMENT) % 2 === 0) === (type === ALTERNE_A);
  const reste = ALTERNE_BATTEMENT - phase;
  if (actif) return reste <= 30 && Math.floor((reste - 1) / 6) % 2 === 0 ? "alerte" : "plein";
  return reste <= 30 ? "retour" : "absent";
}

/** La flèche du vent (une pointe vers le haut), dans une case : 0,34 de large. */
export function dessinFleche(couleur: number): Art {
  const a = new Art();
  a.quad([0, 0.14, -0.14, -0.02, -0.07, -0.06, 0, 0.05], 0.04, couleur);
  a.quad([0, 0.14, 0.14, -0.02, 0.07, -0.06, 0, 0.05], 0.04, couleur);
  return a;
}

/** Les chevrons du tapis : une file qui couvre `longueur` cases plus une (elle glisse d'une demi-case, le tapis la découpe). */
export function dessinChevrons(longueur: number, couleur: number, sens: 1 | -1): Art {
  const a = new Art();
  const z = 0.0065;
  for (let x = -0.5; x < longueur + 0.5; x += 0.5) {
    const p = x + 0.25;
    a.quad([p - sens * 0.07, 0.065, p + sens * 0.04, 0, p - sens * 0.07, -0.065, p - sens * 0.12, 0], z, couleur);
  }
  return a;
}

// ——— Les dangers du GR7 : tout est ROUGE (HAZARD), cerné de sombre : le rouge reste réservé aux dangers ———

/** Une scie : un disque rouge à dents, cerné de sombre, un moyeu papier et trois ouvertures. Centré en (0, 0), rayon visuel 0,5 case (la collision de la simulation est un peu plus petite : 0,4). */
export function dessinScie(encre: number, papier: number): Art {
  const a = new Art();
  const z = 0.08;
  const DENTS = 12;
  const dent = (marge: number, rayonBase: number, rayonPointe: number, zz: number, couleur: number): void => {
    for (let k = 0; k < DENTS; k++) {
      const t = (k / DENTS) * Math.PI * 2;
      const b = (da: number, r: number): [number, number] => [Math.cos(t + da) * r, Math.sin(t + da) * r];
      const [x0, y0] = b(-0.17 - marge * 0.1, rayonBase);
      const [x1, y1] = b(0.17 + marge * 0.1, rayonBase);
      const [x2, y2] = b(0.3, rayonPointe + marge);
      const v = [a.vertex(x0, y0, zz, couleur), a.vertex(x1, y1, zz, couleur), a.vertex(x2, y2, zz, couleur)];
      a.tri(v[0]!, v[1]!, v[2]!);
    }
  };
  dent(0.04, 0.4, 0.5, z, HAZARD_OUTLINE);
  a.disc(0, 0, 0.43, z + 0.001, HAZARD_OUTLINE, 28);
  dent(0, 0.38, 0.49, z + 0.002, HAZARD);
  a.disc(0, 0, 0.39, z + 0.003, HAZARD, 28);
  for (let k = 0; k < 3; k++) {
    const t = (k / 3) * Math.PI * 2 + 0.5;
    a.disc(Math.cos(t) * 0.24, Math.sin(t) * 0.24, 0.07, z + 0.004, HAZARD_OUTLINE, 10);
  }
  a.disc(0, 0, 0.12, z + 0.004, encre, 14);
  a.disc(0, 0, 0.065, z + 0.005, papier, 12);
  return a;
}

/** Le rail d'une scie : un trait d'encre de `longueur` cases le long de l'axe x, à (0, 0) ; deux petits arrêts aux bouts. */
export function dessinRail(longueur: number, encre: number): Art {
  const a = new Art();
  const z = 0.04;
  a.rect(0, -0.035, longueur, 0.035, z, encre);
  a.rect(-0.04, -0.13, 0.04, 0.13, z, encre);
  a.rect(longueur - 0.04, -0.13, longueur + 0.04, 0.13, z, encre);
  return a;
}

/** Un sol fragile, à quatre états : `niveau` 0 intact, 1 une fissure, 2 deux fissures et un éclat, 3 il va tomber (fissures partout, plus clair). Case entière (0 à 1). Les fissures grandissent avec le niveau. */
export function dessinFragile(niveau: 0 | 1 | 2 | 3, encre: number): Art {
  const a = new Art();
  const z = 0.025;
  const fond = mix(HAZARD, encre, 0.62);
  a.rect(0, 0, 1, 1, z, niveau === 3 ? mix(fond, BLANC, 0.18) : fond);
  const l = 0.09;
  a.rect(0, 0, 1, l, z + 0.001, HAZARD);
  a.rect(0, 1 - l, 1, 1, z + 0.001, HAZARD);
  a.rect(0, l, l, 1 - l, z + 0.001, HAZARD);
  a.rect(1 - l, l, 1, 1 - l, z + 0.001, HAZARD);
  // les planches : deux traits sombres
  a.rect(0.12, 0.34, 0.88, 0.37, z + 0.002, mix(fond, 0x000000, 0.4));
  a.rect(0.12, 0.63, 0.88, 0.66, z + 0.002, mix(fond, 0x000000, 0.4));
  const fissure = (pts: number[], largeur: number): void => {
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const [x0, y0, x1, y1] = [pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!];
      const dx = y1 - y0;
      const dy = x0 - x1;
      const n = Math.hypot(dx, dy) || 1;
      const ox = (dx / n) * largeur;
      const oy = (dy / n) * largeur;
      a.quad([x0 - ox, y0 - oy, x1 - ox, y1 - oy, x1 + ox, y1 + oy, x0 + ox, y0 + oy], z + 0.004, 0x1a0f0a);
    }
  };
  if (niveau >= 1) fissure([0.5, 1, 0.44, 0.78, 0.56, 0.6, 0.48, 0.42], 0.018);
  if (niveau >= 2) {
    fissure([0.5, 0.6, 0.72, 0.5, 0.8, 0.3], 0.02);
    fissure([0.44, 0.78, 0.2, 0.7, 0.12, 0.52], 0.02);
  }
  if (niveau >= 3) {
    fissure([0.48, 0.42, 0.4, 0.2, 0.46, 0], 0.026);
    fissure([0.8, 0.3, 0.94, 0.12], 0.024);
    fissure([0.2, 0.7, 0.06, 0.82], 0.024);
    a.quad([0.62, 1, 0.78, 1, 0.7, 0.82, 0.58, 0.86], z + 0.003, 0x1a0f0a);
  }
  return a;
}

/** La lentille d'un émetteur de laser : un disque rouge cerné de sombre, un cœur clair. Centrée en (0, 0). */
export function dessinLentille(encre: number): Art {
  const a = new Art();
  const z = 0.09;
  a.disc(0, 0, 0.27, z, encre, 16);
  a.disc(0, 0, 0.21, z + 0.001, HAZARD_OUTLINE, 16);
  a.disc(0, 0, 0.16, z + 0.002, HAZARD, 16);
  a.disc(0, 0, 0.07, z + 0.003, 0xffffff, 12);
  return a;
}

/** Le rayon d'un laser : une bande rouge et son cœur clair, de 0 à 1 en hauteur (le maillage est étiré à la longueur du rayon), centrée sur x = 0. */
export function dessinFaisceau(): Art {
  const a = new Art();
  a.rect(-0.25, 0, 0.25, 1, 0.07, HAZARD);
  a.rect(-0.1, 0, 0.1, 1, 0.071, 0xffffff);
  return a;
}
/** Le mince trait pâle qui annonce un laser, de 0 à 1 en hauteur, centré sur x = 0. */
export function dessinAnnonceLaser(): Art {
  const a = new Art();
  a.rect(-0.035, 0, 0.035, 1, 0.065, 0xffffff);
  return a;
}

/** Le niveau de fissure (0 à 3) d'un sol fragile touché depuis `age` pas (−1 : pas touché) : il grandit avec l'âge jusqu'à la chute (`delai` pas). Pure. */
export function niveauDeFissure(age: number, delai: number): 0 | 1 | 2 | 3 {
  if (age < 0) return 0;
  return Math.min(3, 1 + Math.trunc((age * 3) / delai)) as 1 | 2 | 3;
}
/** Combien de pas un sol tombé s'affiche encore en chutant (0,25 s) avant de disparaître. */
export const CHUTE_VISIBLE = 30;
