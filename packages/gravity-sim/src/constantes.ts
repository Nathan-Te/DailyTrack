// « Gravity » (lot GR1) — les constantes de la simulation. Règles : `docs/gravity/seed.md` ; physique portée de la maquette `docs/gravity/maquettes/gravity-maquette-jouable.html` (fonction `pas()`).
// **TOUT EST ENTIER** : pas un seul flottant dans ce paquet (`test/entiers.test.ts` le garde : aucun littéral décimal, aucune transcendante, tout l'état est entier après une partie). Les constantes ci-dessous sont donc
// écrites en entiers, avec en commentaire (virgule française) la valeur physique qu'elles figurent.

/**
 * La version des RÈGLES (la physique, les cases, le score, les morts). Elle monte à tout changement qui change une partie rejouée. v1 : le squelette « Cibles » (30 s, 8 × 6, jamais joué). v2 (lot GR1) : le vrai jeu. v3 (lot GR6) : les modes de vol (avion, onde, ressort), les portails (de mode et de vitesse), l'entrée devient l'état du bouton. v4 (lot GR7) : la courbe de vitesse (départ à 8 cases/s, croisière à 550 m, une croisière plus haute à chaque boucle) et les trois dangers (scies, sols fragiles, lasers).
 * **On monte la version, jamais une date** : un jour figé nomme la version qui l'a produit.
 */
export const GRAVITY_SIM_VERSION = 4;
/** La version du GÉNÉRATEUR (les morceaux, l'ordre des thèmes, les objets). Elle monte à tout changement de ce que `dailyGravity` et `genererMorceau` produisent. v1 : le squelette. v2 (lot GR1) : les morceaux de la maquette. v3 (lot GR2) : les îlots, les étages et le néon suivent la vitesse du morceau, les étages finissent au plafond, l'escalier montant et les îlots qui ne tiennent pas à grande vitesse deviennent des trous (le robot prouve le chemin sûr). v4 (lot GR6) : les sections à mode (avion, onde, ressort), leurs portails, les portails de vitesse, l'introduction des modes selon le rang du thème. v5 (lot GR7) : le catalogue de motifs à variantes et à difficulté, la courbe en vagues, l'anti-répétition, « jamais tout droit » (Nuit, Néon…), les trois dangers introduits selon le rang du thème. */
export const GRAVITY_GENERATOR_VERSION = 5;
/** La version du calcul des SEUILS des médailles (et du robot qui les produit). v1 (lot GR1) : provisoire, « sur le papier ». v2 (lot GR2) : le robot (`robot.ts`), 60 % de son score aux points d'arrêt de `seuils.ts`. v3 (lot GR6) : le robot joue l'état du bouton et les trois modes. v4 (lot GR7) : le robot joue les dangers mobiles et les sols fragiles, la vitesse change donc les seuils. **Tout changement du robot, du pourcentage ou des points d'arrêt la monte.** Un jour figé garde les seuils de son fichier. */
export const GRAVITY_BOT_VERSION = 4;

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
/**
 * Vitesse de la caméra (lot GR7, simulation 4) : **8 cases/s au départ**, la croisière de la première boucle (12,5 cases/s) atteinte à **549 m** (`DISTANCE_PAR_CRAN` × l'écart de vitesse), **vite au début puis plus doucement**
 * (`COURBE_DOUCE` : la vitesse suit une parabole qui arrive à plat sur la croisière) ; avant le GR7 : 7 cases/s plus 1 case/s tous les 220 m, croisière à 1 210 m (`COURBE_LINEAIRE`, gardée pour les réglages d'essai `?courbe=1`).
 * **Chaque boucle relève la croisière** (`CROISIERE_PLUS` : +1,5 cases/s à la 2e boucle, +2,5 à la 3e et après), qui monte pendant `RAMPE_BOUCLE` unités (150 m) au début de la boucle ; le plafond absolu (`VITESSE_PLAFOND`) borne le tout, portails compris.
 */
export const VITESSE_BASE = 32768;
export const VITESSE_MAX = 51200;
/** La pente : 1 unité/s de plus tous les `DISTANCE_PAR_CRAN` unités de distance (courbe linéaire) ; en courbe douce la croisière est atteinte à `(VITESSE_MAX − VITESSE_BASE) × DISTANCE_PAR_CRAN` = 2 248 704 unités (549 m). */
export const DISTANCE_PAR_CRAN = 122;
export const COURBE_LINEAIRE = 1;
export const COURBE_DOUCE = 2;
/** Après la croisière de la première boucle, la courbe continue de monter d'1 unité/s tous les 220 unités : c'est la croisière de la boucle qui la borne. */
export const PENTE_APRES_CROISIERE = 220;
/** Ce qu'une boucle ajoute à la croisière (unités/s) : rien à la 1re, 1,5 case/s à la 2e (6 144), 2,5 cases/s à la 3e et après (10 240). */
export const CROISIERE_PLUS: readonly number[] = [0, 6144, 10240];
/** La croisière d'une boucle monte de celle de la précédente en 614 400 unités (150 m) : jamais d'à-coup au passage d'une boucle. */
export const RAMPE_BOUCLE = 614400;
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

// Les changements du bouton : **la rediffusion est la liste des pas où l'appui commence ou finit** (lot GR6). Le premier est toujours un appui, ils alternent ensuite (appui, relâché, appui…).
/** Au plus 8 000 changements par partie (4 000 appuis et autant de relâchés : un joueur ne touche pas plus de 6 fois par seconde pendant 10 minutes) : au-delà, la rediffusion est refusée. */
export const MAX_CHANGEMENTS = 8000;

/**
 * Le pourcentage du score du robot que vaut un seuil de médaille (seed : « 60 % »), arrondi à 10 près (`seuils.ts`). **Il se règle par Nathan** (lot GR4) et monte `GRAVITY_BOT_VERSION`. Lot GR5 : ici et non dans
 * `seuils.ts`, pour que la lecture des réglages d'essai (`apps/gravity/src/essai.ts`, dans le premier chargement) ne tire pas le robot avec elle.
 */
export const POURCENT_DU_ROBOT = 60;

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// Les modes de vol (lot GR6). **Toutes ces constantes seront réglées au lot GR7** avec les réglages d'essai ; elles sont nommées, entières, avec la valeur physique en commentaire.
// Un mode ne change que ce que fait le bouton (et la gravité) : le rouge tue, le vide aussi, ainsi que le bord gauche ; le bouclier sauve ; les pièces et le multiplicateur sont ceux de la gravité.
export const MODE_GRAVITE = 0;
export const MODE_AVION = 1;
export const MODE_ONDE = 2;
export const MODE_RESSORT = 3;
export type ModeDeVol = 0 | 1 | 2 | 3;

/** Avion : relâché, l'avion tombe (30 cases/s² = 1 024 unités par pas) ; maintenu, il monte (36 cases/s² = 1 229) ; |vy| ≤ 8 cases/s (32 768) : de l'inertie, ni tout ni rien. */
export const AVION_GRAVITE = 1024;
export const AVION_POUSSEE = 1229;
export const AVION_VY_MAX = 32768;
/** Onde : vy = ± la vitesse horizontale (45°) ; le signe suit l'état du bouton (maintenu : on monte). Rien à régler : la pente est de 1. */
/** Ressort : la gravité est réduite (28 cases/s² = 956 par pas) ; chaque début d'appui donne un bond de 13,4 cases/s (54 886), même en l'air ; au moins 12 pas entre deux bonds (0,1 s). */
export const RESSORT_GRAVITE = 956;
export const RESSORT_BOND = 54886;
export const RESSORT_ATTENTE = 12;

/** Les portails de vitesse : la vitesse de la caméra est multipliée (en pour cent) jusqu'au portail de vitesse suivant, par-dessus la montée normale. Lent ×0,8 ; › ×1,15 ; ›› ×1,3 ; ››› ×1,5. */
export const FACTEUR_NORMAL = 100;
export const FACTEUR_LENT = 80;
export const FACTEUR_V1 = 115;
export const FACTEUR_V2 = 130;
export const FACTEUR_V3 = 150;
/** **Le plafond absolu de la vitesse** de la caméra, portails compris : 17 cases/s (69 632 unités par seconde : à cette vitesse une case se traverse en 7 pas, la collision par axe ne saute rien). */
export const VITESSE_PLAFOND = 69632;

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// Les dangers du GR7 (simulation 4) : **tous rouges**. Les scies, les sols fragiles, les lasers. Place laissée au GR8 : les écraseurs, les plateformes mobiles, les projectiles (mêmes données dans le morceau : une liste par danger).
/** Sol fragile : il craque au premier contact (on se pose dessus), puis tout le tronçon tombe 54 pas plus tard (0,45 s) et ne revient pas dans la partie. */
export const FRAGILE_DELAI = 54;
/** Scie : le disque a un rayon de 0,5 case à l'écran ; sa collision est un peu réduite, 0,4 case (1 638 unités). */
export const SCIE_RAYON = 1638;
export const SCIE_RAYON_VISU = 2048;
/** Laser : un cycle de 300 pas (2,5 s) ; il s'annonce par un mince trait pâle pendant 60 pas (0,5 s), puis brûle 90 pas (0,75 s) ; le rayon est large de 0,4 case (de 0,3 à 0,7 de la colonne). */
export const LASER_CYCLE = 300;
export const LASER_ANNONCE = 60;
export const LASER_ALLUME = 90;
export const LASER_X0 = 1229;
export const LASER_X1 = 2867;
