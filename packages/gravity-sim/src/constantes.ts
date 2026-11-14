// « Gravity » (lot GR1) — les constantes de la simulation. Règles : `docs/gravity/seed.md` ; physique portée de la maquette `docs/gravity/maquettes/gravity-maquette-jouable.html` (fonction `pas()`).
// **TOUT EST ENTIER** : pas un seul flottant dans ce paquet (`test/entiers.test.ts` le garde : aucun littéral décimal, aucune transcendante, tout l'état est entier après une partie). Les constantes ci-dessous sont donc
// écrites en entiers, avec en commentaire (virgule française) la valeur physique qu'elles figurent.

/**
 * La version des RÈGLES (la physique, les cases, le score, les morts). Elle monte à tout changement qui change une partie rejouée. v1 : le squelette « Cibles » (30 s, 8 × 6, jamais joué). v2 (lot GR1) : le vrai jeu.
 * **On monte la version, jamais une date** : un jour figé nomme la version qui l'a produit.
 */
export const GRAVITY_SIM_VERSION = 2;
/** La version du GÉNÉRATEUR (les morceaux, l'ordre des thèmes, les objets). Elle monte à tout changement de ce que `dailyGravity` et `genererMorceau` produisent. v1 : le squelette. v2 (lot GR1) : les morceaux de la maquette. */
export const GRAVITY_GENERATOR_VERSION = 2;
/** La version du calcul des SEUILS des médailles. v1 (lot GR1) : provisoire, « sur le papier » (`seuils.ts`) ; le lot GR2 le remplace par le robot (v2). Un jour figé garde les seuils de son fichier. */
export const GRAVITY_BOT_VERSION = 1;

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// Le temps : 120 pas par seconde — **la fréquence de Jump** (`TICK_RATE` de `@cdj/jump-sim`), pour la même raison : à 17 m/s une case se traverse en 7 pas, la collision par axe ne saute jamais une case, et la
// maquette sous-divisait déjà chaque image en 4 pas. Une partie de 10 minutes fait 72 000 pas (le plafond que Jump accepte déjà au rejeu : `rejeu.maxTicks` de la fiche).
export const TICKS_PAR_SECONDE = 120;
/** Dix minutes : au-delà, la partie finit « temps écoulé ». */
export const DUREE_MAX_TICKS = 72000;

// L'espace : point fixe, **1 case = 1 m = 4 096 unités** (puissance de deux : les divisions par une case sont exactes). Les positions sont en unités, les VITESSES en unités par SECONDE (un pas déplace `vitesse / 120`,
// tronqué vers zéro : l'erreur est de moins d'une unité par pas, 0,02 % d'une case) et les accélérations en unités par seconde ajoutées à chaque pas.
export const CASE = 4096;
export const LIGNES = 12;
export const LARGEUR_MORCEAU = 16;
export const MORCEAUX_PAR_THEME = 19;
export const NB_THEMES = 5;
/** Un tour des cinq thèmes : 95 morceaux (1 520 m), puis la boucle reprend. */
export const MORCEAUX_PAR_BOUCLE = MORCEAUX_PAR_THEME * NB_THEMES;

// Le joueur : un carré de 0,8 case ; il part à la colonne 3, posé sur le sol (rangée 10 : 10 × 4 096 − 3 277 − 1).
export const TAILLE = 3277;
export const DEPART_X = 12288;
export const DEPART_Y = 37682;

// La physique (maquette : `pas()`).
/** Gravité 46 cases/s² : 46 × 4 096 / 120 = 1 570 unités/s ajoutées à chaque pas. */
export const GRAVITE = 1570;
/** |vy| ≤ 17 cases/s. */
export const VY_MAX = 69632;
/** Vitesse de la caméra : 7 cases/s plus 1 case/s tous les 220 m (`base + distance / 220`), plafonnée à 12,5 cases/s. */
export const VITESSE_BASE = 28672;
export const VITESSE_MAX = 51200;
export const DISTANCE_PAR_CRAN = 220;
/** Le joueur est visé à caméra + 4,2 cases ; en retard il court 2,2 cases/s de plus ; à plus de 2 cases au-delà de la cible il ralentit à 90 %. */
export const CIBLE_CAMERA = 17203;
export const RATTRAPAGE = 9011;
export const AVANCE_MAX = 8192;
/** Tapis roulant : vitesse × 1,35 (27/20). Vent : poussée vers le haut de 26 cases/s² (887 par pas), gravité × 0,4 (628 par pas), vy ≥ −9 cases/s. */
export const TAPIS_NUM = 27;
export const TAPIS_DEN = 20;
export const VENT_POUSSEE = 887;
export const VENT_GRAVITE = 628;
export const VENT_VY_MIN = -36864;
/** Tampon d'appui 0,12 s (14 pas) : un appui juste avant un contact est gardé. Temps de grâce 0,07 s (8 pas) : un appui juste après avoir quitté un bord passe encore. */
export const TAMPON = 14;
export const GRACE = 8;
/** Les cases qui battent : clignotant, cycle de 1,6 s (192 pas), allumé 62 % (119 pas) ; alterné A / B, battement de 1 s (120 pas) ; l'avertissement du clignotant (rendu seulement) : 0,35 s. */
export const CLIGNOTANT_CYCLE = 192;
export const CLIGNOTANT_ALLUME = 119;
export const CLIGNOTANT_AVERTISSEMENT = 42;
export const ALTERNE_BATTEMENT = 120;
/** La boîte réduite des piques (maquette : 0,15 à 0,85 en x, 0,3 à 0,7 en y). */
export const PIQUE_X0 = 614;
export const PIQUE_X1 = 3482;
export const PIQUE_Y0 = 1229;
export const PIQUE_Y1 = 2867;

// Les morts, les sauvetages, les bonus.
/** Le vide : la boîte sort de l'écran de plus d'une case en haut, ou de tout l'écran en bas. */
export const VIDE_HAUT = -4096;
export const VIDE_BAS = 49152;
/** Le bord gauche : on meurt à 0,4 case derrière la caméra (le joueur est replacé à 2 cases devant). */
export const BORD_MARGE = 1638;
export const BORD_RETOUR = 8192;
/** Chute rattrapée par le bouclier : replacé à 10,5 (ou 0,5) cases, lancé à 14 cases/s vers la surface opposée. */
export const SAUVETAGE_Y_BAS = 43008;
export const SAUVETAGE_Y_HAUT = 2048;
export const SAUVETAGE_VY = 57344;
/** Invulnérabilité après un bouclier : 0,8 s. */
export const INVULNERABILITE = 96;
/** L'aimant : 8 s, rayon 3,5 cases, la pièce parcourt 1/12 de la distance à chaque pas (10 par seconde). */
export const AIMANT_TICKS = 960;
export const AIMANT_RAYON = 14336;
export const AIMANT_PART = 12;
/** Ramassage : demi-côté (en unités) autour du centre du joueur. Pièce 0,75 ; gemme 0,8 ; bonus 0,85. Une pièce est manquée à 0,6 case derrière la caméra. */
export const PIECE_PORTEE = 3072;
export const GEMME_PORTEE = 3277;
export const BONUS_PORTEE = 3482;
export const PIECE_MANQUEE = 2458;

// Le score : distance (1 point par mètre depuis le départ) + pièces 10 × multiplicateur + gemmes 100 × multiplicateur ; +1 de multiplicateur toutes les 10 pièces d'affilée, ×5 au plus.
export const POINTS_PIECE = 10;
export const POINTS_GEMME = 100;
export const PIECES_PAR_PALIER = 10;
export const MULT_MAX = 5;

// Les appuis : la rediffusion n'est que la liste des pas où le joueur a touché l'écran.
/** Au plus 4 000 appuis par partie (un joueur ne touche pas plus de 6 fois par seconde pendant 10 minutes) : au-delà, la rediffusion est refusée. */
export const MAX_APPUIS = 4000;
