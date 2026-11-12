import { bm, murDePortail, MX, MZ, PX, PY, PZ, portail } from "./construction";
import { numeroOrientation } from "./orientation";
import { liaisons } from "./portails";
import { dallePalier, palier, ENTREE, type Module } from "./modules";

// La bibliothèque de modules (lot V2). Chaque module est écrit dans son repère : le palier d'entrée à l'origine, la direction −z, le haut +y. Les mètres sont ceux du monde ; les solutions sont dans le langage de
// `solution.ts`. L'outil `npm run module:vertige -w @cdj/vertige-sim -- <id>` rejoue une solution et mesure ses phases en l'air ; `modules.test.ts` vérifie tout.
const PLATEFORME_L = 3; // une plateforme fait 6 m de large (±3 m) et 1 m d'épaisseur

/** Une succession d'écarts et de plateformes : `[écart, longueur]` à partir de `z0` (le bord de la dalle d'entrée), au niveau `y` (le dessus). Rend les blocs et le z de fin. */
function suite(z0: number, y: number, tronçons: readonly [number, number][]): { blocs: ReturnType<typeof bm>[]; z: number } {
  const blocs: ReturnType<typeof bm>[] = [];
  let z = z0;
  for (const [ecart, longueur] of tronçons) {
    z -= ecart;
    blocs.push(bm(-PLATEFORME_L, y - 1, z - longueur, PLATEFORME_L, y, z));
    z -= longueur;
  }
  return { blocs, z };
}

function sautUn(): Module {
  const { blocs, z } = suite(-6, 0, [[3.5, 9], [4.5, 9]]);
  const sortie = palier(0, 0, z - 5 - 5); // un dernier écart de 5 m, puis la dalle du palier
  return {
    id: "saut-1",
    nom: "Trois sauts",
    blocs: [...blocs, dallePalier(sortie)],
    entree: ENTREE,
    sortie,
    etiquettes: { mecaniques: ["course", "saut"], difficulte: 1 },
    solution: "cours 78; saute; cours 157; saute; cours 169; saute; cours 124",
  };
}

function murUn(): Module {
  const mur = bm(-3.6, -20, -37, -3, 14, -9, "sombre"); // le mur de gauche, contre le bord des plateformes
  const p1 = bm(-3, -1, -25, 3, 0, -9);
  // L'écart de 3 m qui précède la plateforme.
  const xs = -3 + 0.3 + 0.0001; // la boîte contre le mur : le centre à 30 cm de la face
  const sortie = palier(xs, -2.5, -42);
  return {
    id: "mur-1",
    nom: "Le long du mur",
    blocs: [mur, p1, dallePalier(sortie)],
    entree: ENTREE,
    sortie: { ...sortie, x: Math.round(xs * 1e6) },
    etiquettes: { mecaniques: ["course", "saut", "mur"], difficulte: 1 },
    solution: "cours 78; saute; cours 100; cours 50 +gauche; cours 317",
  };
}

function dashUn(): Module {
  const { blocs, z } = suite(-6, 0, [[8, 14], [9.5, 14]]);
  const sortie = palier(0, 0, z - 11 - 5);
  return {
    id: "dash-1",
    nom: "Le dash",
    blocs: [...blocs, dallePalier(sortie)],
    entree: ENTREE,
    sortie,
    etiquettes: { mecaniques: ["course", "saut", "dash"], difficulte: 1 },
    solution: "cours 78; saute; cours 40; dash; cours 167; saute; cours 40; dash; cours 185; saute; cours 40; dash; cours 97",
  };
}

function graviteUn(): Module {
  // Un couloir qui s'élargit à gauche : le mur de gauche porte une plaque marquée (on la touche en courant contre lui : la gravité tourne vers le mur), puis une plaque de sol marquée ramène la gravité vers le bas.
  const sortie = palier(-5.0999, 0, -49);
  return {
    id: "gravite-1",
    nom: "Le mur devient sol",
    blocs: [
      bm(-6, -1, -32, 3, 0, -6), // le sol, jusqu'à la plaque
      bm(-6, -1, -44, 3, 0, -32, "rouge", true), // la plaque de sol marquée : on y revient
      bm(-6.5, -1, -16, -6, 8, -8, "sombre"),
      bm(-6.5, -1, -28, -6, 0.4, -16, "sombre"),
      bm(-6.5, 0.4, -28, -6, 8, -16, "rouge", true), // la plaque de mur marquée
      bm(-6.5, -1, -44, -6, 8, -28, "sombre"),
      dallePalier(sortie),
    ],
    entree: ENTREE,
    sortie,
    etiquettes: { mecaniques: ["course", "gravite"], difficulte: 1 },
    solution: "cours 80; cours 166 +gauche; cours 14 +droite; cours 206; cours 1 +droite; cours 205",
  };
}

/** Les segments d'une surface d'un tunnel le long de −z : `[z0, z1, marque]` ; `bloc(z0, z1, marque)` fait le bloc de la surface sur ce segment. */
function segments(z0: number, z1: number, marques: readonly (readonly [number, number])[], bloc: (za: number, zb: number, marque: boolean) => ReturnType<typeof bm>): ReturnType<typeof bm>[] {
  const out: ReturnType<typeof bm>[] = [];
  let z = z0;
  for (const [a, b] of marques) {
    // La plaque va de a (le plus loin) à b (le plus proche), en descendant.
    if (b < z) out.push(bloc(b, z, false));
    out.push(bloc(a, b, true));
    z = a;
  }
  if (z1 < z) out.push(bloc(z1, z, false));
  return out;
}

function graviteDeux(): Module {
  // Le tonneau : un couloir de 6 m sur 3,2 m dont chaque surface (sol, mur gauche, plafond, mur droit) porte une plaque marquée, l'une après l'autre. On court contre la plaque du mur gauche (la gravité tourne vers lui),
  // on monte contre celle du plafond, on glisse contre celle du mur droit, on descend contre celle du sol : un tour complet autour de l'axe de la course, qui ne change jamais de direction.
  const Z1 = -46;
  const sortie = palier(2.0999, 0, -51);
  const p = { gauche: [-16, -12], plafond: [-26, -22], droit: [-36, -32], sol: [-46, -42] } as const;
  return {
    id: "gravite-2",
    nom: "Le tonneau",
    blocs: [
      ...segments(-6, Z1, [p.sol], (a, b, m) => bm(-3, -1, a, 3, 0, b, m ? "rouge" : "sombre", m)),
      ...segments(-6, Z1, [p.gauche], (a, b, m) => bm(-3.5, -1, a, -3, 3.7, b, m ? "rouge" : "sombre", m)),
      ...segments(-6, Z1, [p.plafond], (a, b, m) => bm(-3, 3.2, a, 3, 3.7, b, m ? "rouge" : "sombre", m)),
      ...segments(-6, Z1, [p.droit], (a, b, m) => bm(3, -1, a, 3.5, 3.7, b, m ? "rouge" : "sombre", m)),
      dallePalier(sortie),
    ],
    entree: ENTREE,
    sortie,
    etiquettes: { mecaniques: ["course", "gravite"], difficulte: 2 },
    solution: "cours 70; cours 108 +gauche; cours 125; cours 40 +gauche; cours 41; cours 93 +gauche; cours 120; cours 40 +gauche; cours 91",
  };
}

function portailUn(): Module {
  // Un portail droit : on entre par le mur de la première plateforme, on sort 22 m plus loin et 2 m plus haut, du mur d'une autre plateforme, dans le même sens. Le vide entre les deux n'est pas à franchir.
  const a = portail(0, 1.2, -40, PZ, PY);
  const b = portail(0, 3.2, -62, MZ, PY);
  const sortie = palier(0, 2, -67);
  return {
    id: "portail-1",
    nom: "Le portail",
    blocs: [bm(-3, -1, -24, 3, 0, -10), bm(-3, -1, -40, 3, 0, -28.5), ...murDePortail(a, 3, 1.2, 2.4), ...murDePortail(b, 3, 1.2, 2.4), dallePalier(sortie)],
    portails: [{ a, b }],
    entree: ENTREE,
    sortie,
    etiquettes: { mecaniques: ["course", "saut", "portail"], difficulte: 1 },
    solution: "cours 78; saute; cours 226; saute; cours 263",
  };
}

function sautDeux(): Module {
  // Des marches et des sauts qui descendent : +1,0 m, −1,5 m, +1,2 m, des plateformes de 4 m de large.
  const sortie = palier(0, 0.7, -42);
  return {
    id: "saut-2",
    nom: "Marches en l'air",
    blocs: [bm(-2, 0, -18.5, 2, 1, -10.5), bm(-2, -1.5, -33, 2, -0.5, -25), dallePalier(sortie)],
    entree: ENTREE,
    sortie,
    etiquettes: { mecaniques: ["course", "saut"], difficulte: 2 },
    solution: "cours 78; saute; cours 157; saute; cours 182; saute; cours 111",
  };
}

function dashDeux(): Module {
  // Un dash par-dessus 10 m, un dash seul sur 3,5 m, un dash par-dessus 11 m ; des plateformes de 4 m de large.
  const sortie = palier(0, 0, -6 - 10 - 14 - 3.5 - 8 - 11 - 5);
  return {
    id: "dash-2",
    nom: "Dash sur dash",
    blocs: [bm(-2, -1, -30, 2, 0, -16), bm(-2, -1, -41.5, 2, 0, -33.5), dallePalier(sortie)],
    entree: ENTREE,
    sortie,
    etiquettes: { mecaniques: ["course", "saut", "dash"], difficulte: 2 },
    solution: "cours 78; saute; cours 40; dash; cours 195; dash; cours 90; saute; cours 40; dash; cours 105",
  };
}

function portailQuart(): Module {
  // Un portail tourné d'un quart de tour : on entre de face, on sort du mur d'une autre plateforme, vers la gauche (−x). Le repère du joueur à la sortie est tourné d'un quart de tour : le module d'après part vers la gauche.
  const a = portail(0, 1.2, -36, PZ, PY);
  const b = portail(-14, 1.2, -36, MX, PY);
  const ori = numeroOrientation(liaisons({ a, b })[0].R);
  const sortie = palier(-19, 0, -36, ori);
  return {
    id: "portail-quart",
    nom: "Le portail qui tourne",
    blocs: [bm(-3, -1, -36, 3, 0, -11), ...murDePortail(a, 3, 1.2, 2.4), ...murDePortail(b, 3, 1.2, 2.4), dallePalier(sortie)],
    portails: [{ a, b }],
    entree: ENTREE,
    sortie,
    etiquettes: { mecaniques: ["course", "saut", "portail"], difficulte: 2 },
    solution: "cours 78; saute; cours 375; cours 64",
  };
}

function portailGravite(): Module {
  // Un portail qui change la gravité : on entre de face, on sort d'une fente couchée (son grand côté vers +x) : le monde a tourné d'un quart de tour autour de l'axe de la course, la gravité va vers −x et l'on se tient debout sur
  // une dalle verticale. La direction de la course ne change pas (−z). Le module d'après est posé de ce côté-là.
  const a = portail(0, 1.2, -36, PZ, PY);
  const b = portail(2.2, 0, -64, MZ, PX);
  const ori = numeroOrientation(liaisons({ a, b })[0].R);
  const sortie = palier(1, 0, -69, ori);
  return {
    id: "portail-gravite",
    nom: "Le monde bascule",
    blocs: [bm(-3, -1, -36, 3, 0, -11), ...murDePortail(a, 3, 1.2, 2.4), ...murDePortail(b, 3, 1.2, 2.4), dallePalier(sortie)],
    portails: [{ a, b }],
    entree: ENTREE,
    sortie,
    etiquettes: { mecaniques: ["course", "saut", "portail", "gravite"], difficulte: 2 },
    solution: "cours 78; saute; cours 375; cours 64",
  };
}

function murDeux(): Module {
  // Deux murs face à face, à 2,4 m l'un de l'autre, au-dessus du vide : on court sur le mur de gauche, on saute de mur (la poussée envoie sur le mur d'en face), on court sur celui-là, on revient.
  const xs = -3 + 0.3 + 0.0001;
  const sortie = palier(xs, 0, -53);
  return {
    id: "mur-2",
    nom: "De mur en mur",
    blocs: [bm(-3.6, -20, -47, -3, 14, -9, "sombre"), bm(-3, -1, -25, 3, 0, -9), bm(-0.6, -20, -46, -0.1, 14, -27, "sombre"), dallePalier(sortie)],
    entree: ENTREE,
    sortie: { ...sortie, x: Math.round(xs * 1e6) },
    etiquettes: { mecaniques: ["course", "saut", "mur", "saut-de-mur"], difficulte: 2 },
    solution: "cours 78; saute; cours 100; cours 50 +gauche; cours 120; saute; cours 89; saute; cours 40; cours 205",
  };
}

function murDash(): Module {
  // Le mur, puis le dash : on court sur le mur de gauche jusqu'à son bout, on dashe dans le vide pour atteindre la plateforme d'après, plus bas.
  const xs = -3 + 0.3 + 0.0001;
  const sortie = palier(xs, -2.6, -46);
  return {
    id: "mur-dash",
    nom: "Du mur au dash",
    blocs: [bm(-3.6, -20, -33, -3, 14, -9, "sombre"), bm(-3, -1, -25, 3, 0, -9), dallePalier(sortie)],
    entree: ENTREE,
    sortie: { ...sortie, x: Math.round(xs * 1e6) },
    etiquettes: { mecaniques: ["course", "saut", "mur", "dash"], difficulte: 3 },
    solution: "cours 78; saute; cours 100; cours 50 +gauche; cours 201; dash; cours 99",
  };
}

function gravitePortail(): Module {
  // La gravité, puis le portail : le mur de gauche porte une plaque marquée (la gravité tourne vers lui), une plaque de sol marquée ramène vers le bas, puis un portail droit saute le vide jusqu'à la dalle de sortie, 22 m plus loin et 2 m plus haut.
  const xs = -5.0999;
  const a = portail(xs, 1.2, -46, PZ, PY);
  const b = portail(xs, 3.2, -68, MZ, PY);
  const sortie = palier(xs, 2, -73);
  return {
    id: "gravite-portail",
    nom: "Du mur au portail",
    blocs: [
      bm(-6, -1, -26, 3, 0, -6),
      bm(-6, -1, -36, 3, 0, -26, "rouge", true),
      bm(-6, -1, -46, 3, 0, -36),
      bm(-6.5, -1, -13, -6, 8, -8, "sombre"),
      bm(-6.5, -1, -22, -6, 0.4, -13, "sombre"),
      bm(-6.5, 0.4, -22, -6, 8, -13, "rouge", true),
      bm(-6.5, -1, -46, -6, 8, -22, "sombre"),
      ...murDePortail(a, 3, 1.2, 2.4),
      ...murDePortail(b, 3, 1.2, 2.4),
      dallePalier(sortie),
    ],
    portails: [{ a, b }],
    entree: ENTREE,
    sortie,
    etiquettes: { mecaniques: ["course", "gravite", "portail"], difficulte: 3 },
    solution: "cours 80; cours 112 +gauche; cours 14 +droite; cours 170; cours 1 +droite; cours 305",
  };
}

function portailGraviteRetour(): Module {
  // Le portail qui change la gravité de l'autre côté : la fente est couchée dans l'autre sens, le monde tourne d'un quart de tour dans l'autre sens (la gravité va vers +x). Posé après « Le monde bascule », il remet le monde à l'endroit.
  const a = portail(0, 1.2, -36, PZ, PY);
  const b = portail(-2.2, 0, -64, MZ, MX);
  const ori = numeroOrientation(liaisons({ a, b })[0].R);
  const sortie = palier(-1, 0, -69, ori);
  return {
    id: "portail-gravite-retour",
    nom: "Le monde se remet",
    blocs: [bm(-3, -1, -23, 3, 0, -11), bm(-3, -1, -36, 3, 0, -28), ...murDePortail(a, 3, 1.2, 2.4), ...murDePortail(b, 3, 1.2, 2.4), dallePalier(sortie)],
    portails: [{ a, b }],
    entree: ENTREE,
    sortie,
    etiquettes: { mecaniques: ["course", "saut", "portail", "gravite"], difficulte: 3 },
    solution: "cours 78; saute; cours 214; saute; cours 160; cours 64",
  };
}

export const MODULES: readonly Module[] = [sautUn(), sautDeux(), murUn(), murDeux(), murDash(), dashUn(), dashDeux(), graviteUn(), graviteDeux(), gravitePortail(), portailUn(), portailQuart(), portailGravite(), portailGraviteRetour()];
