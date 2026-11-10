# Lot V0 — le détail des mesures

Les chiffres du README, avec leur méthode. **Ce que ces mesures ne disent pas** : aucune main humaine n'a joué (les souris sont synthétiques), aucun vrai portable moyen n'a servi (le « portable simulé » est un rendu logiciel avec le processeur ralenti), Firefox ne se lance pas sur cette machine (`spawn UNKNOWN` ; WebKit et Chromium ont rejoué le golden à l'identique, la CI lit Firefox). Tout se refait : `npm run mesures:vertige -w @cdj/vertige-sim` (rejeu et tailles, Node), `CAPTURES=1 npx playwright test captures-lot-v0 --project=chromium` dans `apps/vertige` (captures, images du GIF, images par seconde).

## Le coût du rejeu d'une partie (Node 24.16, AMD Ryzen 7 7800X3D)

Médiane de 25 rejeux (3 d'échauffement), en ms (min – max). Une partie qui n'arrive pas joue ses 14 400 pas au plus : c'est le pire cas d'un envoi. Le coût vient des **boîtes testées à chaque pas** (collisions, sonde de mur), pas de la durée seule.

| partie | niveau (boîtes) | pas | rejeu (ms) | par seconde de jeu (ms) |
|---|---|---:|---|---:|
| marche au hasard 60 s | bac-a-sable (17) | 7 200 | 3,18 (3,04 – 4,30) | 0,05 |
| marche au hasard 120 s | bac-a-sable (17) | 14 400 | 6,49 (6,27 – 7,62) | 0,05 |
| marche au hasard 120 s | mur (3) | 14 400 | 3,79 (3,68 – 4,36) | 0,03 |
| le parcours, joueur scripté | parcours (12) | 741 | 0,34 (0,32 – 0,66) | 0,05 |
| marche au hasard 120 s | synthétique (200) | 14 400 | 43,6 (41,7 – 57,2) | 0,36 |

**Cloud Run** : un processeur partagé, sans la même fréquence ni le même cache ; compter **2 à 4 fois** plus, soit 15 à 25 ms pour 120 s sur un niveau de 17 boîtes et 90 à 180 ms avec 200 boîtes (plus le démarrage à froid du JIT). Rien d'inquiétant avec l'unité de rejeu de la fiche (`rejeu.unitesServeur: 1`, `maxTicks: 14 400`) ; à regarder si les niveaux du jour passent à plusieurs centaines de boîtes (un test de taille de niveau au lot V2 ?).

## La taille de la rediffusion (la souris comprise)

Charge brute = les octets des commandes (nombre de pas, changements de touches, mouvements du regard) ; texte = ce qui part au serveur (enveloppe + base64url) ; gzip = zlib niveau 9 (un envoi n'est pas compressé aujourd'hui : `MAX_BODY_BYTES` du serveur, 400 000 o, est loin). Souris **synthétique** : des gestes de 0,17 à 0,6 s (une vitesse qui monte et retombe) séparés de repos ; « calme » = un geste un quart du temps, « actif » = trois quarts, « continu » = toujours. **L'affichage compte** : le jeu lit la souris à chaque image, et le kit joue 120 pas par seconde ; sur un écran 60 Hz, un pas sur deux reçoit le regard.

| partie | souris | regard | pas non nuls | brute (o) | texte (car.) | gzip charge (o) | gzip texte (o) |
|---|---|---|---:|---:|---:|---:|---:|
| 60 s | calme, 60 Hz | 120 Hz | 625 | 2 760 | 3 690 | 2 063 | 2 225 |
| 60 s | calme, 60 Hz | 30 Hz | 324 | 1 725 | 2 310 | 1 347 | 1 526 |
| 60 s | actif, 60 Hz | 120 Hz | 2 259 | 9 314 | 12 428 | 6 700 | 7 313 |
| 60 s | actif, 60 Hz | 30 Hz | 1 146 | 5 373 | 7 174 | 4 047 | 4 599 |
| 60 s | actif, 144 Hz | 120 Hz | 5 241 | 21 207 | 28 286 | 11 696 | 13 818 |
| 60 s | actif, 144 Hz | 60 Hz | 2 635 | 10 796 | 14 404 | 7 736 | 8 537 |
| 60 s | continu, 144 Hz | 120 Hz | 7 200 | 28 814 | 38 428 | 15 945 | 18 947 |
| 60 s | continu, 144 Hz | 60 Hz | 3 600 | 14 643 | 19 534 | 10 499 | 11 484 |
| 60 s | continu, 144 Hz | 30 Hz | 1 800 | 8 403 | 11 214 | 6 038 | 7 037 |
| 120 s | calme, 60 Hz | 120 Hz | 1 694 | 7 283 | 9 720 | 5 411 | 5 871 |
| 120 s | actif, 60 Hz | 120 Hz | 5 492 | 22 504 | 30 015 | 16 189 | 17 627 |
| 120 s | actif, 60 Hz | 30 Hz | 2 782 | 12 825 | 17 110 | 9 519 | 10 860 |
| 120 s | actif, 144 Hz | 120 Hz | 11 148 | 44 870 | 59 836 | 24 476 | 29 016 |
| 120 s | actif, 144 Hz | 60 Hz | 5 606 | 23 020 | 30 703 | 16 541 | 18 031 |
| 120 s | continu, 144 Hz | 120 Hz | 14 400 | 57 513 | 76 694 | 31 786 | 37 420 |
| 120 s | continu, 144 Hz | 60 Hz | 7 200 | 29 392 | 39 199 | 20 960 | 22 890 |
| 120 s | continu, 144 Hz | 30 Hz | 3 600 | 16 710 | 22 290 | 12 085 | 13 906 |

Pour mémoire : le joueur scripté du parcours (741 pas, aucune souris humaine) fait 939 o bruts, 1 262 caractères. **Ce qui fait la taille, c'est le regard** : un mouvement coûte 3 à 5 octets (écart de pas, lacet en zigzag, tangage). Pistes si la taille gêne : regard à 60 Hz ou 30 Hz appliqué par le jeu (la vue peut rester à la souris, pas la simulation), tangage sur un seul octet, regard en « delta de delta ». Le serveur refuse au-delà de 200 000 caractères (`MAX_CARACTERES`).

## Images par seconde (Chromium, 1 280 × 720 ou 960 × 540, parcours joué par le joueur scripté)

Image par seconde = les `requestAnimationFrame` comptés pendant 5 s, limite d'images et vsync coupées (`--disable-frame-rate-limit --disable-gpu-vsync`). « GPU » : un Radeon RX 7800 XT par ANGLE/D3D11, donc **très au-dessus d'un portable moyen** ; « portable simulé » : rendu logiciel (SwiftShader) et processeur ralenti 4 fois (CDP), à 960 × 540 — **bien en dessous** d'un portable à carte intégrée. Les ordres de grandeur utiles sont les **rapports** entre lignes.

| style | halo | ombres | appels de dessin | GPU (i/s) | portable simulé (i/s) |
|---|---|---|---:|---:|---:|
| Lumière douce | oui | oui | 194 | 1 101 | 18,2 |
| Lumière douce | non | oui | 139 | 1 342 | 55,0 |
| Lumière douce | oui | non | 136 | 1 308 | 29,9 |
| Lumière douce | non | non | 85 | 1 714 | 63,4 |
| Cartouche (sans halo) | — | oui | 187 | 1 153 | 54,0 |
| Cartouche (sans halo) | — | non | 133 | 1 440 | 67,4 |

**Lecture** : le halo (la passe de flou du bloom) est le plus gros coût sur une petite machine (÷ 3), puis les ombres (÷ 1,8) ; sur un GPU de bureau, rien ne se voit (la scène fait ~200 appels de dessin et ~7 000 triangles). Cartouche coûte le prix de Lumière douce sans halo. **Le vrai chiffre est celui du portable de Nathan** : `?debug&fps` (images par seconde, appels, triangles, taille de la rediffusion en cours), `&bloom=0` et `&ombres=0` coupent le halo et les ombres.
