# Lot de plateforme — le Garage de « Démo » sur la recette

Branche `claude/lot-42-nouvelles-voitures-0b1a8a` (repartie de `main` à `646c485`, après la fusion du lot 42). Demande de Nathan (24/10/2026) : sur la recette, pouvoir voir et choisir les dix voitures du Garage sans les gagner, **pour le joueur « Démo » seulement**, jamais en production.

## Ce qui change
- **Serveur seulement** (`apps/api/src/cdj.ts`, `garageOuvert`) : sur un serveur `ENVIRONMENT=recette`, un joueur de démonstration (`players.demo = 1`) reçoit les dix voitures débloquées dans `GET /api/garage` et dans la réponse de l'envoi d'un temps (`nouvelles` vide). La progression rendue (`progres`) reste la vraie.
- **Qui** : « Démo » (créé par `recette:seed`, `/?demo=joueur` du portail) et, de fait, les 20 joueurs fictifs du classement de la recette (personne ne joue avec eux). Un vrai joueur de la recette (`players.demo = 0`) garde ses vrais déblocages : la progression reste testable avec son propre profil.
- **Jamais en production** : l'environnement est lu d'abord (hors de la recette, aucune lecture de plus et rien ne change), et un serveur de production ne crée jamais de joueur de démonstration (`demoPlayers`, que `readConfig` ne connaît pas).
- **Le jeu ne change pas** : les déblocages viennent toujours du serveur (lot 41) ; aucune clé de catalogue, aucune donnée gardée de plus (mentions légales inchangées), simulation et golden intouchés.

## Comment s'en servir
1. `https://recette.playdujour.com/?demo=joueur` : le portail installe l'identité « Démo » (confirmation si une autre identité est là ; garder son code de transfert pour revenir, ou utiliser une fenêtre privée).
2. `/track/` → Garage : les dix voitures sont débloquées ; on choisit, on court classé avec, comme en vrai.

## Vérifié
- `apps/api/test/planning.test.ts` (bloc « Garage ») : recette + joueur de démonstration → 10 voitures (lecture et envoi, `nouvelles` vide, vraie progression) ; vrai joueur de la recette → ses vrais déblocages ; le même joueur de démonstration en `production` et en `local` → seulement ce qu'il a gagné. Le test échoue sans le changement de `cdj.ts` (« expected 1 to be 10 »).
- `apps/api/test/portailDemo.test.ts` : « Démo » créé par `seedPortailDemo` a ses dix voitures sur un serveur de recette, pas ailleurs.
