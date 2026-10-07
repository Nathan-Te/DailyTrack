# Retouche 9b — Visuels, voiture, traces de pneus

**À essayer** : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?scenario=surfaces&demo
(ou n'importe quel thème : `?seed=2026-10-07&theme=banquise` — freine en braquant pour voir les traces)

Demande de Nathan : améliorer globalement les visuels, la voiture, et avoir des **traces de pneus** au sol au freinage / en dérapage. Rendu seul : `packages/sim` inchangé (golden non régénérés).

## Cause du « pas de traces » du lot 9
Les traces existaient dans le code mais **ne s'affichaient jamais** : `Float32BufferAttribute` **copie** le tableau qu'on lui donne, alors que le code écrivait dans le tableau d'origine — le processeur graphique ne voyait que des zéros. Corrigé (`BufferAttribute`, qui garde la référence). Je n'avais vérifié que le *compteur* d'émission, pas l'image : le nouveau test e2e vérifie les segments réellement posés (`__cdj.fx.marks`), et j'ai regardé des captures.

## Traces de pneus (`fx.ts`, `Skids`)
- **Une trace par roue** (4), tampon circulaire de 2400 segments recyclés (≈ 15 s de traces à pleine vitesse) ; seule la partie modifiée du tampon part au GPU.
- Déclenchées par la dérive franche, le **dérapage au frein** (`car.drift`, lu) ou un **freinage appuyé** à plus de 14 m/s ; les roues arrière marquent le plus, les avant seulement au freinage.
- La trace **s'estompe** à son début et à sa fin (transparence par sommet) et **prend la teinte du revêtement** : gomme noire sur la route, sillon brun sur la terre, herbe arrachée, rayures claires sur la glace.
- Coupées au niveau de qualité 0 et avec `?fx=off`.

## Voiture (`carMesh.ts`)
Caisse par **sections lissées** (au lieu de boîtes) : épaules, bas de caisse sombre, bulle de toit avec lunette et pare-brise inclinés, **bandes crème** sur le capot, le toit et le coffre, liseré et **rond de portière**, prise d'air, rétroviseurs, calandre et blocs optiques lumineux, becquet avant, diffuseur, **échappements**, aileron resserré avec bord d'attaque crème, **troisième feu stop**. Roues : pneu à sculptures, jante à **cinq branches**, moyeu rouge, **disque de frein et étrier** (fixes). Une **ombre douce** se pose sous la voiture (sans carte d'ombres : coût nul) ; elle s'élargit et s'estompe en vol.

## Décor et ciel (`trackMesh.ts`)
- **Ciel dégradé** de l'horizon au zénith (par palette), **soleil / lune** (soleil rétro à bandes pour le néon), **étoiles** la nuit ; **montagnes lointaines** à sommet clair (neige sur la banquise) ; tous suivent la voiture.
- **Décor au bord de la piste**, fusionné en un maillage, graine = identifiant du circuit (le même pour tout le monde) : cactus et rochers (stade, rallye), sapins enneigés (banquise), lampadaires lumineux et sapins sombres (nuit), arbres et bottes de foin (campagne), pylônes néon ; **tribune** avec foule colorée au départ.
- **Route** : sillons d'usure et **lignes de rive** blanches sur le bitume ; éclairage hémisphérique (les faces hautes plus claires que les flancs) au lieu d'une lumière ambiante unie.

## Mesures
Fil principal par image (même script que le lot 9, profil mobile) : 3,5 / 12,7 ms (pilotage), 3,2 / 13,6 ms (surfaces) à CPU ×1 / ×4, contre 3,2 / 12,0 et 3,3 / 12,0 au lot 9. Poids JS gzip : jeu 42,1 ko (+4,6), three.js 130,3 ko (+0,4) : **≈ +5 ko**. En rendu logiciel le nombre d'images par seconde baisse (ciel et montagnes remplissent l'écran) : sans signification pour un GPU, à confirmer sur un vrai téléphone.

## Non vérifié / à décider
- **Vrai téléphone** : ciel, montagnes et décor augmentent les pixels dessinés ; si ça rame, `?quality=0` ne les coupe pas (seuls particules et traces baissent). Dis-moi si tu veux un niveau « décor allégé ».
- Les **proportions** de la voiture n'ont été jugées que sur captures (vue arrière surtout, la seule que le jeu montre).
- Goût : couleurs des thèmes (ciel, montagnes), densité du décor (≤ 650 éléments), largeur des traces (0,28 m), teinte orange de la voiture.
