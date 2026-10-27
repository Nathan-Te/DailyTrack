# Effacer un joueur à sa demande — procédure pour Nathan (lot R5)

Un joueur peut demander l'effacement de ses données (page « Mentions légales et confidentialité », `playdujour.com/mentions-legales/`). Il n'a ni compte ni e-mail chez nous : **la preuve que le profil est à lui, c'est son code de transfert** (`CDJ2.…`, Réglages › Profil › « Copier mon code »). Compte **≈ 5 minutes**.

## 1. Recevoir la demande
- Elle arrive sur `mzc.studios.gamedev@gmail.com`. Il faut **le code de transfert actuel** (46 caractères, `CDJ2.<32 caractères>.<8 caractères>`). Sans code, on ne peut pas savoir quel profil est le sien : réponds-lui de le copier dans Réglages › Profil (DailyTrack ou DailyJump : c'est le même).
- Le code est un secret (il vaut un mot de passe) : ne le recopie nulle part ailleurs que dans la commande ci-dessous, et supprime l'e-mail une fois l'effacement fait.
- Réponds **dans le mois** (RGPD, article 12).

## 2. Essai à blanc (rien n'est effacé)
Le jeton est celui de l'admin (`ADMIN_TOKEN`, Secret Manager ; c'est celui que tu colles dans `/track/admin/`). Dans un terminal (ou Cloud Shell) :

```bash
read -rs ADMIN_TOKEN   # colle le jeton, Entrée (il ne s'affiche pas)
CODE='CDJ2.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxx'
curl -sS -X POST https://playdujour.com/api/admin/effacer \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\"}"
```

- **Tu dois voir** `{"essai":true,"pseudo":"…","tempsDailyTrack":12,"coursesSalon":0,"essaisDailyJump":4,"viesDailyJump":30}` : le pseudo et ce qui serait effacé. Vérifie que le pseudo est bien celui que le joueur dit avoir.
- `404 unknown_player` : aucun profil sur le serveur pour ce code (le joueur n'a jamais envoyé de temps) — rien à effacer chez nous ; dis-lui d'effacer les données du site dans son navigateur.
- `410 code_revoked` : le code a été remplacé (« Changer mon code ») ; demande-lui le code **actuel**.
- `400 invalid_code` : code mal copié. `401` : jeton faux (10 échecs en 10 minutes bloquent l'adresse).

## 3. Effacer
La même commande avec `"confirmer":true` :

```bash
curl -sS -X POST https://playdujour.com/api/admin/effacer \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\",\"confirmer\":true}"
unset ADMIN_TOKEN CODE
```

- **Tu dois voir** `{"efface":true,"pseudo":"…",…}`. Relancer la même commande rend alors `404` : il n'y a plus rien.
- Ce qui est effacé, **en une transaction** : le joueur (identifiant secret et pseudo — **le pseudo est libéré**), ses anciens codes remplacés, ses temps et rediffusions de DailyTrack et de DailyJump (tous les jours), ses courses du Salon en cours, sa présence au Salon, ses vies de DailyJump pas encore oubliées.
- **Classements des jours passés** : sa ligne est **retirée** (les suivants montent d'une place ; les places finales gardées sont recalculées à la prochaine lecture du profil des autres) ; son fantôme de premier n'est plus servi : c'est le suivant qui devient le premier.
- **Ce qui reste** (sans aucun lien avec lui) : la carte des morts et l'échantillon du carnage figés des jours passés (des cases comptées et des rediffusions de vies sans identifiant ni pseudo), et les compteurs de débit (empreintes, effacés d'eux-mêmes en moins d'une heure).

## 4. Délais à connaître (et à dire au joueur si besoin)
- **Mémoire du serveur** : l'instance qui a traité la demande oublie tout de suite ; une autre instance peut encore montrer son fantôme de premier d'un jour passé **jusqu'à 10 minutes** (`CLOSED_GHOST_TTL_MS`), et la carte des morts du jour **jusqu'à 3 minutes**.
- **Cache de Firebase** : les lectures publiques d'un jour **passé** (classement, fantôme du premier, carte) sont gardées par le réseau de Firebase **jusqu'à 24 heures** (`CACHE_CLOSED_S`, lot P4). Pour vider ce cache tout de suite, une nouvelle mise en production du site suffit (Firebase vide son cache à chaque publication).
- **Journaux de Google** : les journaux de requêtes de Cloud Run (adresse IP, adresse demandée) sont gardés **30 jours** par Google (durée par défaut de Cloud Logging), puis effacés ; on ne peut pas y effacer une ligne seule.
- **Sauvegardes de la base** (lot R12) : chaque mise en production garde une copie complète de la base dans un bucket privé, **effacée au bout de 30 jours** (`SAUVEGARDE_JOURS`) ; on n'efface pas une ligne d'une copie : ses données en disparaissent au plus tard 30 jours après l'effacement (c'est ce que disent les mentions légales). Ne jamais restaurer une copie antérieure à un effacement sans refaire l'effacement ensuite.
- **Son navigateur** : le serveur n'y touche pas. S'il veut tout effacer chez lui aussi : effacer les données du site `playdujour.com` dans son navigateur. **Sinon, son prochain temps envoyé recrée un profil** (nouveau, vide) avec le même identifiant.

## 5. Répondre
« Bonjour, ton profil (pseudo « … ») et toutes tes données de jeu ont été effacés de nos serveurs le JJ/MM/AAAA. Pour effacer aussi ce que ton navigateur garde, efface les données du site playdujour.com dans ses réglages. — MZC Studios »

## Recette et tests
- Pour voir le résultat sans risque : joue un temps sur `https://recette.playdujour.com/track/`, copie le code de ce profil de test, puis la même commande avec `https://recette.playdujour.com/api/admin/effacer` et le jeton d'admin **de la recette**.
- Code : `apps/api/src/identity.ts` (`erasePlayer`), crochets `erase` des jeux (`cdj.ts`, `jump.ts`, `jumpLives.ts`), `players.eraseStatements` ; tests `apps/api/test/effacement.test.ts` (SQLite et libSQL).
- **Règle** : toute nouvelle donnée gardée sur un joueur est effacée par le crochet `erase` de son jeu **et** décrite sur la page de confidentialité (`apps/api/CLAUDE.md`).
