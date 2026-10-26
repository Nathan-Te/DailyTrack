# Retouche 47b — le post-traitement n'est plus choisi par « Auto »

Correctif d'urgence avant la mise en production du 27/10. Mesure de Nathan (i7-1260P, Iris Xe, plein écran) : palier 3 + post = 30 images/s saccadées ; sans post, palier 2, palier 1 et existant = 60. Le lot 50 optimisera le post-traitement.

## Fait
- `postVoulu(choix, appareil)` (`apps/web/src/qualite.ts`) : vrai seulement pour « Maximale » **et** `passesPermises`. `sceneDuNiveau` (`main.ts`) n'ajoute `post` qu'à ce prix : Auto (départ, mesure qui monte, mémoire) donne `P3` seul.
- Mémoire `cdj:qualite` ancienne (palier 3 en Auto) : palier 3 sans post, sans remesure.
- `?palier=3` (adresse, recette) garde sa chaîne ; `?reglages=3-post` inchangé.

## Tests
- Unitaires (`test/qualite.test.ts`) : Auto → pas de post, Maximale → post si permis, mémoire ancienne → palier 3.
- e2e : `post.spec.ts` (Auto + mémoire ancienne, `?appareil=ordinateur` : `P3`, module `postJeu` non chargé ; Maximale : `P3+post`) ; `qualite.spec.ts` (départ d'un ordinateur : `P3`).
- Golden inchangés ; aucune chaîne ni budget touchés (le code ajouté est de quelques octets).

## À tester (aperçu de la PR, portable)
1. Page d'admin, « Effacer les données locales » (efface `cdj:qualite`).
2. `/track/?debug&home=1`, fin de la mesure : `P3 · auto`, sans `+post` ; course à 60 images/s.
3. Réglages, « Maximale » : `P3+post` revient.

## Sol autour des vides de saut (même PR, demande de Nathan)
Sur le Désert, le sol relevé redescendait au sol lointain sur 10 m autour d'un vide de saut : de grands creux de sable. `REPLAT_VIDE` passe de 10 à 4 m (`decor/commun.ts`), la pente (0,4) ne change pas : le creux reste étroit. Rendu seul (golden, rediffusions inchangés) ; `THUMB_VERSION` 7. Non vérifié en jeu sur ton portable : à regarder sur l'aperçu, circuit Désert du 21/10 (`/track/?seed=2026-10-21`).

### Deuxième correction : la falaise au bord du sol relevé
Le vrai trou de l'aperçu n'était pas (seulement) autour des sauts : le sol relevé s'arrête à 3 cellules de la piste, et sa pente fixe (0,22 après 36 m) ne rejoignait pas le sol lointain quand la route est haute (20 à 40 m) : **falaise de 20 à 25 m au bord**, un creux béant tout autour. La pente est maintenant au moins `(hauteur − sol) / (portée − replat − 8 m)` : le sol relevé rejoint le sol lointain avant son bord. Mesuré sur 8 circuits Rallye : falaise au bord 25 m → 8 m au plus, pente maximale 1,57 → 0,66. Rendu seul. Non vérifié en jeu (le pas à pas ne redessine pas) : à voir sur l'aperçu.

### Troisième correction : le fossé le long du circuit (le vrai trou)
Rendu en couleurs (sol lointain en magenta, `quality=2`) : le sol lointain se voyait le long de **tout** le circuit. Cause : le sol relevé n'a aucun carré dans une cellule de la piste (32 m), or la route et ses rebords n'en couvrent que ~14 à 26 m : entre le rebord et le bord de la cellule rien n'existait, d'où un fossé de 10 à 25 m de profondeur (la route est haute). `terrainDe.construire` comble maintenant ces zones par des carrés de 4 m, seulement là où `trackWorld.sample` ne donne aucun sol roulable, sous la route et au plus à la hauteur du sol relevé voisin (pas de marche). Aussi : le sable remonte vite autour d'un vide de saut (`PENTE_SAUT` 3), un bloc ne retient le sol que d'une pente de 1,5 (0,5 laissait des creux le long d'une rampe), portée 5 cellules. Test ajouté : `test/terrain.test.ts` (carrés dans les cellules jamais sous la surface roulante). Mesuré : pixels de sol lointain visibles dans la même image 3 461 → 57 ; budget du décor inchangé (6,8 ko avec le commun au plus).
