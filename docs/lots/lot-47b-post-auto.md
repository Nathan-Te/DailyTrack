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
