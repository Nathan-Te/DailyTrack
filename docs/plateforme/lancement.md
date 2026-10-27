# Le lancement public — liste de contrôle pour Nathan (lot R8)

Le jour du partage, **tout le monde repart de zéro** : la journée n° 1 est ce jour-là, et la base de production est vidée (classements, temps, morts, fantômes, séries, pseudos, codes de transfert, Salon). Compte **≈ 20 minutes**, au téléphone ou à l'ordinateur. **Chaque étape se coche : ne passe à la suivante que si la précédente est verte.** Le détail technique est dans `docs/plateforme/lots/lot-R8-lancement.md`.

> **Tu peux tout faire depuis GitHub** (github.com ou l'application, onglet **Actions**), sauf l'étape 2 (la sauvegarde), qui se fait sur un ordinateur avec le programme `turso`. Personne d'autre que toi ne joue sur playdujour.com pendant ces étapes : n'annonce rien avant l'étape 5.

## 1. Vérifier la date de lancement, mettre en production
- Ouvre `config/lancement.json` sur GitHub (branche `main`) : **`{ "premierJour": "2026-10-26" }`**. C'est le lundi 26 octobre 2026, la journée n° 1. **C'est la seule ligne à changer si le partage glisse** : modifie la date (au format `AAAA-MM-JJ`, un jour de Paris), propose le changement dans une PR d'une ligne, fusionne-la, **puis seulement** passe à « Mettre en production ». Le serveur, le portail et les deux jeux (archives, numéro de journée, ligne `Du Jour #N`) lisent cette seule ligne.
- **Actions › « Mettre en production » › Run workflow** (branche `main`), puis, quand il l'attend, **Review deployments › Approve** (le serveur), comme d'habitude. **Attends le résumé vert** (serveur, site, vérification en lecture seule, étiquette `prod-…`).
- À vérifier dans le résumé : la vérification de `playdujour.com` est verte. Tu peux aussi ouvrir `https://playdujour.com/api/portail/jour` : tu dois y lire **`"lancement":"2026-10-26"`** (ta date) et `"generation":0`. Sans ce champ, le serveur déployé n'est pas celui du lot R8 : l'étape 3 refusera de vider la production.

## 2. Sauvegarder la base de production (sur ton ordinateur)
La remise à zéro **efface sans retour** : la sauvegarde est ton seul filet. Elle contient des pseudos et des empreintes d'adresses : c'est une donnée personnelle, **jamais dans le dépôt** (il est public).
1. Installe et connecte le programme Turso si ce n'est pas fait : `turso auth login`.
2. Dans un terminal, **hors du dépôt** (par exemple un dossier `~/sauvegardes-dujour/` que tu crées) :
   ```bash
   mkdir -p ~/sauvegardes-dujour
   turso db shell dailytrack-misterzcool .dump > ~/sauvegardes-dujour/dailytrack-misterzcool-AVANT-LANCEMENT-$(date +%F).sql
   ```
   (Autre commande possible : `turso db export dailytrack-misterzcool --output-file ~/sauvegardes-dujour/dailytrack-misterzcool-AVANT-LANCEMENT.db`.)
3. **Vérifie que le fichier existe et n'est pas vide** : `ls -lh ~/sauvegardes-dujour/` (plusieurs ko au moins) et `grep -c "CREATE TABLE" ~/sauvegardes-dujour/*.sql` (≥ 10 tables).
4. **Range-la sur ton ordinateur seulement** (pas de nuage partagé, pas d'e-mail). **Supprime-la un mois après le lancement** (`rm ~/sauvegardes-dujour/dailytrack-misterzcool-AVANT-LANCEMENT-*.sql`) : on ne garde pas des pseudos plus longtemps que nécessaire. Note la date de suppression dans ton agenda.

## 3. Lancer « Lancement : remise à zéro » sur la production
1. **Essai à blanc d'abord** (rien n'est écrit) : **Actions › « Lancement : remise à zéro » › Run workflow** (branche `main`) avec **cible = production**, **base = `dailytrack-misterzcool`**, **phrase = `tout le monde repart de zéro`**, **sauvegarde faite : coché**, **essai à blanc : coché**. Review deployments › Approve. Le résumé liste chaque table avec son nombre de lignes : vérifie que ça ressemble à ce que tu attends (les joueurs de tes amis, pas zéro).
2. Puis **la vraie** : le même Run workflow, **essai à blanc décoché**. Review deployments › Approve.
3. Ce que le résumé doit afficher :
   - **« Remise à zéro de la base … (production) — appliquée »** ; la ligne « Date de lancement servie par la production : aujourd'hui ou demain (vérifié) » ;
   - le tableau des **tables vidées** (`players`, `revoked_codes`, `rate`, `results`, `salon_*`, `jump_results`, `jump_lives`, `jump_deaths`) avec **« Lignes après » = 0 partout**, et les **tables gardées** (`planning`, `circuits`, `jump_levels`, `meta`) ;
   - **« Génération de données : aucune → <un grand nombre> »** ;
   - la vérification finale **« Tout est bon »** (génération annoncée, aucun classé aujourd'hui dans Track ni Jump, aucune mort, classement du jour vide, portail sans joueur).
4. **Si le workflow refuse**, il l'écrit en tête du résumé et **rien n'a été vidé** : phrase ou nom de base mal saisis ; sauvegarde pas cochée ; « la date de lancement servie par la production est le … » (l'étape 1 n'est pas faite, ou le partage est dans plus d'un jour : on ne vide pas trop tôt) ; **« le compte de déploiement ne lit pas le secret `cdj-turso-token` »** : copie la commande donnée dans le résumé dans Cloud Shell (une seule fois), puis relance.
5. **Ne relance jamais la vraie remise à zéro après le partage** : elle effacerait les vrais joueurs.

## 4. Vérifier en 2 minutes (sur ton téléphone)
1. Ouvre `https://playdujour.com/` : **« Journée n° 1 »** à droite de la date (si le partage a glissé d'un jour, « Journée n° 1 » n'apparaît que le jour dit : avant, aucun numéro).
2. **Ton propre navigateur** (celui où tu as joué avant) arrive **en joueur neuf** : le message **« Nouveau départ : tout le monde repart de zéro. Bonne chance ! »** s'affiche **une seule fois** ; ta langue, ton son et tes réglages sont gardés ; ton ancienne série a disparu. (Un navigateur qui n'a jamais ouvert le site ne voit aucun message.)
3. Les **classements sont vides** : Track (`/track/`), Jump (`/jump/`) et le classement du jour du portail (« Finis un jeu pour entrer au classement »).
4. **Joue une partie de Track et une de Jump** : choisis un pseudo, finis un tour. Elles apparaissent au **classement du jour** de chaque jeu (« 1er sur 1 »), et au classement du jour du portail.
5. Si une de ces vérifications échoue, **ne partage pas** : écris-moi (le résumé du workflow et la sauvegarde permettent de tout comprendre).

## 5. Partager l'adresse
`https://playdujour.com/` — le portail. C'est tout. (Les aperçus de partage de la page — titre, image — sont prêts.)

## 6. Ensuite : « Mettre en production » se clique avec la liste du lot R6
À partir du partage, **un jour fige ce que les joueurs ont** : une mise en production qui changerait un niveau ou un circuit du jour (ou le temps de l'auteur, les médailles) fausserait les classements en cours. Le garde-fou qui l'empêche est **le lot R6, fusionné** : « Mettre en production » calcule le **jour de bascule** (le premier jour de Paris qui commence après le déploiement), garde **exactement** les cartes de tous les jours d'avant, recharge celles d'après avec le nouveau code, et **s'arrête avant de déployer** si un jour d'avant changeait. *(Lot R11, décision de Nathan : « jour d'avant » = un jour d'avant le lancement, déjà figé, ou **avec au moins un résultat** en production, lu en lecture seule ; un jour à partir de la journée n° 1 sans aucun résultat est régénéré avec le code déployé — après la remise à zéro, la mise en production du 26 ou du 27 octobre régénère le 27 avec la dernière version, quelle que soit l'heure du clic.)* **Suis `docs/plateforme/mise-en-production.md`** (sauvegarde, répétition sur la recette, le clic, les vérifications des 10 minutes, le retour arrière). La recette (`recette.playdujour.com`) continue de suivre chaque fusion, elle.

---

## Annexe — essai à blanc sur la recette (ce que le lot R8 a déjà fait, et que tu peux refaire)
1. **Actions › « Lancement : remise à zéro » › Run workflow** : cible **recette**, base **`dailytrack-recette`** (le nom de la base de recette dans Turso), phrase `tout le monde repart de zéro`, rien d'autre → le résumé liste les tables vidées et la vérification `smoke` est verte. (La recette n'exige ni sauvegarde ni date de lancement.)
2. Ouvre `https://recette.playdujour.com/` sur le téléphone où tu avais un profil de recette : le message « Nouveau départ », un joueur neuf, les classements vides, ta langue gardée. Pour y voir « Journée n° 1 » aujourd'hui : règle la variable du dépôt **`RECETTE_PREMIER_JOUR`** (Settings › Secrets and variables › Actions › Variables) à la date du jour, puis relance « Recette » (Run workflow) ; elle ne touche que la recette et les aperçus, **jamais la production** (qui lit `config/lancement.json`).
3. Les joueurs fictifs « Démo … » reviennent d'eux-mêmes (le remplissage automatique de la recette, chaque nuit et après chaque déploiement) : c'est normal.
