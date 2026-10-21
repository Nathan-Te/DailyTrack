# Lot 33 — Track : partage qui se copie, et classement final du Salon avant le changement de circuit

Retours des amis qui testent le jeu en ligne : (1) sur PC, partager son temps ne permettait pas de copier le message type ; (2) à la fin d'une session du Salon, le classement final s'affichait en même temps que le nouveau circuit prenait la place, sans le temps de lire les scores.

Zones : `apps/web/**`, `docs/lots/**`, `docs/orchestration.md`, la ligne de Track de `docs/plateforme/budgets.md`, les clés de catalogue (fr + en) et `docs/plateforme/traductions.md` régénéré. **Rien dans `packages/sim`, l'API, les classements, les rediffusions ni les golden.**

## 1. Partage

- **Cause du défaut sur PC** : l'ancien bouton appelait la feuille de partage du système dès que `navigator.share` existait. Chrome, Edge et Safari sur ordinateur l'ont : le clic ouvrait une fenêtre sans rien copier.
- **Message** (une seule définition : `clipboard.ts`, `shareMessage`) : la ligne à partager (inchangée), puis le lien du jeu à la ligne — `Du Jour · Track #8 — 32,805 s 🥇 — 4e/12` puis `https://playdujour.com/track/`. Même forme en français et en anglais. Jour d'archive : `…/track/?seed=AAAA-MM-JJ` (comme avant). Salon : la ligne `Du Jour · Track Salon 14:20 — …` et `…/track/?mode=salon`. L'origine est celle de la page (jamais une adresse en dur).
- **« Copier »** (`copyShare`) : `navigator.clipboard.writeText` ; succès → le bouton affiche « Copié » (`partage.copie`) un instant. Refus (page non sécurisée, permission, navigateur ancien) → le message s'affiche dans un **champ déjà sélectionné et focalisé** (`textarea.partage__champ`, nom accessible `partage.champ`), prêt pour Ctrl+C. L'ancien repli par `execCommand("copy")` est retiré (le champ le remplace : il marche partout, y compris quand `writeText` est refusé).
- **Partage natif** : `canNativeShare()` = `navigator.share` existe **et** `(pointer: coarse)`. Seulement là, un bouton « Partager » (`partage.partager`) apparaît à côté de « Copier ». Sur ordinateur « Copier » est la seule action de partage.
- **Où** : arrivée du circuit du jour et d'un jour d'archive (`main.ts`, `finishRun`), arrivée d'une course du Salon (`salonArrivee.ts`), classement final du Salon (`salonUi.ts`).
- **Piège évité** : le classement final était redessiné **chaque seconde** (décompte) : le champ de repli, sa sélection et le « Copié » auraient disparu à chaque tick. `renderPodium` ne reconstruit le DOM que si son contenu change (langue, classement, ta place, ligne, lien) ; sinon il met à jour le texte du décompte seulement.
- **Catalogues** : ajoutées `partage.copier`, `partage.copie`, `partage.partager`, `partage.champ` ; retirées `arrivee.partager`, `lignePartage.copie`, `lignePartage.copieImpossible`, `salon.arrivee.partager`, `podium.copier`, `podium.copie`, `podium.copieEchec` (plus lues). `npm run traductions` relancé.

## 2. Fin de session du Salon

Avant : à l'heure pile, le circuit suivant s'installait tout de suite et le podium s'affichait par-dessus pendant 10 s. Maintenant (`salonMode.ts`) :

1. À l'heure de fin (horloge recalée sur le serveur) : la course s'arrête (règle inchangée : non comptée, rien n'est envoyé) et le classement final s'affiche **seul, sur l'ancien circuit** (podium, ta place, ta ligne à partager avec « Copier », décompte « Circuit suivant dans »).
2. **Pendant `PODIUM_MS` = 8 s** (constante unique, `apps/web/src/salon.ts`, documentée) : le contrôleur garde **la même session et le même identifiant de circuit** (`__cdj.salon.trackId`, `session` inchangés, `state: "podium"`). Le circuit suivant se charge (fil de travail, préparé depuis 2 minutes) et sa **scène est construite derrière** le classement (`prebuild`), pour qu'aucun gel ne se voie ensuite.
3. À `fin + 8 s`, toujours sur l'horloge du Salon (donc au même instant pour tous), `openNext` installe le circuit : `swapSalonCircuit` met la nouvelle scène et lance son décompte de départ.

- Les sessions restent calées sur l'horloge (xx:00, xx:10…) : la suivante perd **8 s de course**. Même comportement en démo et avec `?salonMinutes=N` (la durée 8 s ne dépend pas de celle de la session).
- Si le circuit suivant n'est pas prêt, le classement reste affiché et le chargement est réessayé (bandeau « circuit indisponible », toutes les 3 s) : on ne bascule jamais sur un circuit absent.
- Classement du serveur : il reste servi 20 s après la fin (`SERVE_GRACE_MS`) ; le classement final le relit à `fin + 3,5 s`, bien avant ses 8 s.
- Spectateur (`?watch=best`) : classement final, puis retour au Salon normal à `fin + 8 s` (comme avant, avec la nouvelle durée).

## 3. Tests

| Test | Vérifie |
|---|---|
| `e2e/share.spec.ts` « Copier met le message complet… » | Chromium avec permission accordée : le presse-papiers contient **exactement** `ligne\n<origine>/` ; pas de bouton « Partager » sur ordinateur ; pas de champ de repli |
| `e2e/share.spec.ts` « copie refusée… » | `writeText` rejeté : le champ est visible, contient le message exact, est focalisé et sélectionné en entier ; pas de « Copié » |
| `e2e/share.spec.ts` « sur téléphone… » | contexte tactile : « Partager » appelle `navigator.share({ text: ligne, url })`, « Copier » reste proposé |
| `e2e/salon.spec.ts` « une course commencée avant la fin… » | « Copier » du classement final : ligne du Salon + `…/?mode=salon` |
| `e2e/salon.spec.ts` « fin de session : classement final… » | session de 3 min : identifiant et session **inchangés** sous le classement, puis le suivant s'installe ; pas de calcul sur le fil principal ; pas de saccade à la bascule |
| `e2e/salon.spec.ts` « une course non finie… » | course coupée, rien envoyé, session toujours l'ancienne sous le classement, puis la suivante |
| `e2e/salon.spec.ts` « le classement final reste 8 s… » | `?salonMinutes=1`, **deux contextes de navigateur** : aucun changement avant `fin + 8 s` (horloge du Salon), classement visible et identifiant inchangé pendant ces 8 s, changement au même instant à une image près |

Tests unitaires : Vitest du jeu, de `@cdj/ui` et du portail verts (549 tests), `tsc -b` vert.

**Résultats locaux des e2e (Chromium, rendu logiciel)** : `share.spec.ts` (3 nouveaux) et, dans `salon.spec.ts`, la copie du classement final, la course coupée et le test à deux contextes passent. Deux tests de `salon.spec.ts` échouent **aussi sur `main` dans cet environnement** (mesurés sur `eb6647d`) et ne sont pas corrigés ici : « accueil ⇄ Salon » (la confirmation de départ apparaît parce que la course a commencé avant le clic ; sensible à la vitesse de la machine) et, dans « fin de session… », le seuil de 250 ms de tâche longue après la bascule (361 ms ici ; sur `main` aussi). Les shaders de la nouvelle scène sont compilés derrière le classement final (`renderer.compile` dans `prebuild`) pour que la saccade ne tombe pas au départ du décompte. À confirmer par la CI de la PR.

## 4. Budget de Track (premier chargement, octets compressés)

| Mesure | Avant (`main` à `eb6647d`) | Après | Budget | Marge |
|---|---|---|---|---|
| JS + CSS | 283 440 | **283 844** | 284 100 | 256 |
| JS | 272 185 | 272 589 | 274 000 | 1 411 |
| hors three.js | 139 419 | 139 823 | 141 000 | 1 177 |
| catalogue anglais (à la demande) | 7 245 | 7 224 | 8 000 | 776 |

+404 o au total, **sous le budget** sans le relever ; les retraits (ancienne copie, 7 clés, reconstruction du podium) sont déjà comptés. `docs/plateforme/budgets.md` mis à jour. **La marge de Track tombe à 256 o** : le prochain lot qui ajoute du code doit en retirer ailleurs ou demander à Nathan de relever le budget.

## 5. Rapport

Voir le message de fin de session et la description de la PR (vérifié / non vérifié / décisions pour Nathan, « À tester » et lien de l'aperçu).
