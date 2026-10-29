# Le panneau d'administration — étapes de Nathan (lot N1)

`https://playdujour.com/admin/` (production) et `https://recette.playdujour.com/admin/` (recette) : connexion avec **ton** compte Google, tableau de bord, joueurs, journal. Ce guide te fait faire, **une seule fois**, ce que le code ne peut pas faire à ta place : créer l'accès chez Google, créer deux secrets, les rendre lisibles par le serveur. Compte ≈ 25 minutes. **Rien de tout cela n'est dans le dépôt** : ni ton adresse, ni la clé.

Tant que ces étapes ne sont pas faites, le panneau **n'existe pas** (la page dit « non configuré », les routes répondent 404) et le déploiement réussit quand même. Les outils de Track (`/track/admin/`) restent fermés : la page demande la connexion du panneau.

> Les noms ci-dessous sont ceux du projet (`dailytrack-511513`, comptes `cdj-api-runtime` et `cdj-recette-runtime`). Si tu les as changés, prends les tiens.

## 1. L'écran de consentement (Google Cloud › 5 min)

1. [console.cloud.google.com](https://console.cloud.google.com) → choisis le projet `dailytrack-511513` (sélecteur en haut).
2. Menu ☰ → **API et services** → **Écran de consentement OAuth** (dans la nouvelle interface : **Google Auth Platform**).
3. **Type d'utilisateur** : **Externe** → **Créer**. (« Interne » n'existe que pour une organisation Google Workspace.)
4. **Nom de l'application** : `Du Jour — administration` · **E-mail d'assistance** : ton adresse · **Coordonnées du développeur** : ton adresse → **Enregistrer et continuer**.
5. **Niveaux d'accès** (*Scopes*) : **Ajouter ou supprimer des niveaux d'accès**, coche **seulement** `openid` et `…/auth/userinfo.email` (« afficher votre adresse e-mail principale ») → **Mettre à jour** → **Enregistrer et continuer**. *Rien d'autre* : ces deux niveaux sont « non sensibles », Google n'exige aucune validation.
6. **Utilisateurs de test** : **+ Add users**, saisis **ton** adresse Google (celle qui ira dans le secret de l'étape 3) → **Enregistrer et continuer**.
7. L'état de publication reste **Test** (« Testing »). **Ne clique pas** sur « Publier l'application » : en mode test, seuls les utilisateurs de test peuvent se connecter, ce qui est exactement ce qu'on veut.
   - **Tu dois voir** : l'état « Test » et ton adresse dans la liste des utilisateurs de test.

## 2. L'identifiant client OAuth (Google Cloud › 5 min)

1. **API et services** → **Identifiants** → **+ Créer des identifiants** → **ID client OAuth**.
2. **Type d'application** : **Application Web** · **Nom** : `Du Jour — panneau`.
3. **Origines JavaScript autorisées** → **+ Ajouter un URI**, deux fois : `https://playdujour.com` puis `https://recette.playdujour.com` (sans chemin, sans « / » final). **Ne remplis pas** « URI de redirection autorisés » : le bouton de Google n'en utilise pas.
4. **Créer**. Copie l'**ID client** (`123456789012-xxxxxxxx.apps.googleusercontent.com`). **Le secret client n'est pas utilisé** : ne le copie nulle part.
5. GitHub → le dépôt → **Settings** → **Secrets and variables** → **Actions** → onglet **Variables** → **New repository variable** : nom `ADMIN_GOOGLE_CLIENT_ID`, valeur l'ID client → **Add variable**.
   - L'ID client **n'est pas un secret** : il est dans la page de connexion de tout le monde. C'est une variable, pas un secret GitHub.
   - Les aperçus de PR (`….web.app`) ne sont **pas** dans les origines : le panneau n'y est pas utilisable (la page le dit). C'est voulu.

## 3. Les secrets (terminal, `gcloud` › 10 min)

Dans Cloud Shell (ou ton terminal, déjà connecté : `gcloud auth login`). **Une clé différente pour la production et la recette.**

```bash
PROJET=dailytrack-511513
MOI='ton.adresse@gmail.com'          # TON adresse Google, celle des utilisateurs de test (minuscules ; plusieurs : séparées par des virgules)

# --- Production ---
printf '%s' "$MOI" | gcloud secrets create cdj-admin-emails --project "$PROJET" --replication-policy=automatic --data-file=-
openssl rand -base64 32 | tr -d '\n' | gcloud secrets create cdj-admin-session-key --project "$PROJET" --replication-policy=automatic --data-file=-

# --- Recette ---
printf '%s' "$MOI" | gcloud secrets create cdj-recette-admin-emails --project "$PROJET" --replication-policy=automatic --data-file=-
openssl rand -base64 32 | tr -d '\n' | gcloud secrets create cdj-recette-admin-session-key --project "$PROJET" --replication-policy=automatic --data-file=-
```

- `openssl rand -base64 32` tire **32 octets au hasard** (44 caractères) et la clé va **directement** dans Secret Manager : tu ne la vois, ne la copies et ne la colles jamais. Le serveur exige 32 caractères au moins.
- **Tu dois voir** `Created secret [cdj-admin-emails].` (puis `Created version [1] of the secret …`) pour chacun des quatre.

### 3 bis. Le droit de lecture : au compte d'exécution de l'API, pas à celui du déploiement

Le serveur lit ses secrets avec **son** compte (le compte d'exécution du service Cloud Run). Le compte de déploiement de GitHub n'en lit **jamais** la valeur.

```bash
# Production : le compte d'exécution de cdj-api
for s in cdj-admin-emails cdj-admin-session-key; do
  gcloud secrets add-iam-policy-binding "$s" --project "$PROJET" \
    --member="serviceAccount:cdj-api-runtime@${PROJET}.iam.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
done
# Recette : le compte d'exécution de cdj-api-recette
for s in cdj-recette-admin-emails cdj-recette-admin-session-key; do
  gcloud secrets add-iam-policy-binding "$s" --project "$PROJET" \
    --member="serviceAccount:cdj-recette-runtime@${PROJET}.iam.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
done
```

- **Tu dois voir** la liste `bindings:` avec ce compte et `roles/secretmanager.secretAccessor`.
- **Ne donne pas** `secretAccessor` au compte de déploiement (`cdj-deploy@…`).

### 3 ter. Le compte de déploiement doit pouvoir *voir que les secrets existent* (obligatoire)

Le workflow ne monte un secret que s'il peut constater qu'il existe (Cloud Run refuse de déployer une référence à un secret introuvable). Sans ce droit, le déploiement réussit **mais le panneau reste désactivé** : la page dit « Le panneau n'est pas configuré sur ce serveur » et le journal du déploiement porte l'avertissement « le compte de déploiement n'a pas pu vérifier … (permission refusée ?) ». Le rôle `secretmanager.viewer` ne donne accès qu'aux **métadonnées** (nom, versions), **jamais à la valeur**.

```bash
for s in cdj-admin-emails cdj-admin-session-key cdj-recette-admin-emails cdj-recette-admin-session-key; do
  gcloud secrets add-iam-policy-binding "$s" --project "$PROJET" \
    --member="serviceAccount:cdj-deploy@${PROJET}.iam.gserviceaccount.com" --role=roles/secretmanager.viewer
done
```

- **Tu dois voir** quatre fois la liste `bindings:` avec `cdj-deploy@…` et `roles/secretmanager.viewer`.
- Ce n'est **pas** `secretAccessor` (celui-là reste réservé aux comptes d'exécution de l'étape 3 bis).

## 4. Déployer, puis le scénario de test (2 clics)

1. Le workflow de déploiement ne monte les secrets que **s'ils existent** à ce moment-là : après les étapes 1 à 3, relance le déploiement de la **recette** (GitHub → **Actions** → « Recette » → **Run workflow**, ou la prochaine fusion dans `main`). Le résumé du déploiement dit « Panneau d'administration : secrets montés » (sinon : « désactivé » et le secret qui manque).
   - Si le résumé dit « permission refusée » : fais l'étape 3 ter (elle est **obligatoire**), puis relance le déploiement.
2. Vérifie que le serveur voit sa configuration : `curl -s https://recette.playdujour.com/api/admin/config` → `{"actif":true,"clientId":"123456789012-….apps.googleusercontent.com","factice":false}`. (`"actif":false` : un secret manque, ou le déploiement date d'avant les secrets.)
3. **Premier clic** — `https://recette.playdujour.com/admin/` › **Se connecter avec Google** (ton compte) : le **tableau de bord** affiche les chiffres de la recette et l'état du site au vert (API, base : « OK »).
4. **Deuxième clic** — **Joueurs** › cherche « Démo » › ouvre la fiche › **Renommer** › confirme : **Journal** montre l'action ; rouvre le portail en joueur Démo (`https://recette.playdujour.com/?demo=joueur`) : le nouveau pseudo y est.
5. **Avec une autre adresse Google** (une fenêtre privée, un autre compte) : la connexion est refusée (« Connexion refusée. » ; en mode test, Google lui-même peut refuser avant).
6. Production : le panneau suit « Mettre en production » comme le reste ; mêmes vérifications sur `https://playdujour.com/admin/`.

## 5. Au quotidien

- **Se connecter** : la session dure **1 heure** (puis « Session expirée : reconnecte-toi »). **Se déconnecter** efface le cookie *et* révoque la session côté serveur.
- **Changer d'adresse, en ajouter, en retirer** : nouvelle version du secret (`printf '%s' 'a@x.fr,b@y.fr' | gcloud secrets versions add cdj-admin-emails --data-file=- --project "$PROJET"`), puis redéployer (le serveur lit `latest` au démarrage d'une instance).
- **Tout révoquer** (clé volée, doute) : une nouvelle version de `cdj-admin-session-key` + un redéploiement invalide **toutes** les sessions d'un coup. Le journal garde les empreintes d'avant (elles dépendent de la clé).
- **Un jeton volé ne sert à rien tout seul** : la connexion exige un jeton Google *récent* émis pour *cet* identifiant client, et l'adresse doit figurer dans le secret.
- **Les outils de Track** (`/track/admin/` : planning, médailles, outils de test) **ne s'ouvrent qu'avec ta session** : sans connexion la page affiche « Connexion requise » et un bouton vers `/admin/`, qui te ramène sur les outils une fois connecté (`?retour=/track/admin/` ou `?retour=/jump/admin/`, les deux seules destinations permises). Il n'y a plus de jeton à saisir (l'ancien, gardé dans ton navigateur, est effacé à l'ouverture). `ADMIN_TOKEN` ne sert plus qu'aux scripts côté serveur. Une page statique ne peut pas être cachée par l'hébergeur : le code de la page reste téléchargeable, mais **aucun outil n'est monté et aucune donnée n'est lue** tant que le serveur n'a pas confirmé la session ; les données, elles, sont protégées par le serveur.
- **Les outils de Jump** (`/jump/admin/` : le calendrier des niveaux du jour — numéro, thème, figé ou non —, les raccourcis et le menu des options de test qui composent l'adresse du jeu, les données locales du navigateur) s'ouvrent **de la même façon**, par l'entrée « Jump » du menu : même porte, même retour, rien à saisir. Sur le site publié, la rediffusion de l'auteur, le carnage de démonstration et l'outil de la variété (fermés par le jeu lui-même) ne sont pas proposés.
- **Nouveautés** (lot N2, aucune étape de plus de ta part : tout passe par la même connexion) : à gauche les PR fusionnées depuis la dernière mise en production, lues sur l'API publique de GitHub **depuis ton navigateur** (limite : 60 lectures par heure ; au-delà le panneau le dit et tu écris à la main) ; coche une PR pour reprendre ses lignes « Pour les joueurs », complète l'anglais (sans lui, « Publier » reste grisé), regarde l'aperçu, puis « Publier » (ou « Garder en brouillon »). La liste du bas sert à modifier, dépublier ou supprimer.
- **Préparer un changelog à l'avance (export / import)** : les nouveautés de la recette et de la production sont dans **deux bases séparées**. Pour préparer sur l'une et reprendre sur l'autre, en bas de « Nouveautés », **« Échanger un changelog »** : **Exporter** le brouillon en cours (même non enregistré) ou **toutes** les nouveautés — le contenu s'affiche (JSON, à relire), « Télécharger le fichier » ou « Copier » — puis, sur l'autre panneau, **Importer** (choisir le fichier ou coller le texte) : chaque nouveauté arrive en **brouillon**, jamais publiée toute seule ; celles qui existent déjà (même date, même titre français) sont ignorées, on peut donc réimporter sans crainte. Tu les relis, retouches les lignes, puis tu publies. Le fichier est du texte : rien n'y est interprété (ni HTML ni lien), il est refusé s'il est trop gros, illisible, d'un autre format ou d'une version plus récente du panneau. **Première mise en production avec ce système** : (1) rédige les nouveautés sur la recette (ou directement en brouillon en production : même éditeur) à partir des PR fusionnées ; (2) exporte ; (3) en production, importe, relis l'aperçu en français et en anglais (« Publier » est grisé tant qu'il manque de l'anglais) ; (4) après le bouton « Mettre en production », publie.
- **Message en direct** (lot N2) : un seul message actif, 160 caractères par langue, texte seul (ni lien ni HTML), où (Portail, Track, Jump), ton, jusqu'à quand (1 h, minuit de Paris, heure précise) ; « Mettre à jour » remplace le message, « Retirer maintenant » l'éteint. Les joueurs le voient en **45 s en moyenne, 90 s au pire** ; il ne s'affiche jamais pendant une course ou un niveau.

## 6. Ce qui se passe quand ça ne marche pas

| ce que tu vois | pourquoi | que faire |
|---|---|---|
| La page dit « Le panneau n'est pas configuré sur ce serveur » | les deux secrets ne sont pas montés | étape 4.1 (relancer le déploiement) |
| Google : « Erreur 400 : origin_mismatch » | l'origine de la page n'est pas dans l'identifiant client | étape 2.3 (ajouter l'origine exacte, attendre quelques minutes) |
| Google : « Accès bloqué : … n'a pas terminé la procédure de validation » | ton adresse n'est pas utilisateur de test | étape 1.6 |
| « Connexion refusée. » | l'adresse n'est pas dans `cdj-…admin-emails`, ou le jeton est périmé, ou l'identifiant client du serveur n'est pas celui de la page | la raison technique (jamais l'adresse) est dans les journaux du serveur : `gcloud run services logs read cdj-api-recette --project "$PROJET" --region europe-west1` › « admin : connexion refusée » `raison` |
| « Trop de requêtes » | 10 essais en 10 minutes par adresse | attendre |
| « Le script de connexion de Google n'a pas pu être chargé » | un bloqueur de contenu, ou la CSP de `/admin/` (`firebase.json`) | essayer sans bloqueur ; la CSP autorise exactement `accounts.google.com/gsi/…` |
| Sur un aperçu de PR : « Le panneau n'est pas utilisable » | l'adresse de l'aperçu n'est pas chez Google | ouvrir la recette |

## 7. Ce que le panneau fait des données (rappel)

- **Masquer** un joueur : il disparaît de tous les classements (portail, jeux, Salon), garde son profil, **ne voit aucune différence**. **Retirer un résultat** : retrait doux avec un motif ; la rediffusion est gardée **30 jours** pour vérification, puis effacée. **Supprimer le profil** : irréversible, il faut retaper le pseudo ; même effacement que la procédure `docs/plateforme/effacement.md`. **Renommer** : mêmes règles de pseudo qu'à la création.
- Chaque action est inscrite au **journal** (heure, empreinte de l'administrateur, action, cible, avant / après ; jamais ton adresse, jamais le contenu effacé), gardé **365 jours**. Les erreurs du serveur (code, route, heure) : **14 jours**. Tout est décrit dans les mentions légales.
- Les définitions des chiffres du tableau de bord sont dans `apps/api/CLAUDE.md`, « Administration (lot N1) ».
