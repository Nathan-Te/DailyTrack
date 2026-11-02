# Lot K0 — Le kit de jeu : inventaire et conception (étude, sans code)

**Pour les joueurs : rien.** Un document, aucune ligne de code. À lire : `docs/plateforme/kit-de-jeu.md` (tableaux 1 et 2, plan du § 6, questions du § 7), puis le renvoyer dans la conversation de la plateforme.

## Les chiffres de l'inventaire (fichiers qui nomment Tower hors de ses zones)
| Couche | Fichiers | Avec logique |
|---|---|---|
| Portail | 18 | 15 |
| API (sources / outils et image) | 12 / 14 | 9 / 14 |
| Profil + core / `@cdj/ui` / musique | 4 / 16 / 6 | 4 / 10 / 4 |
| `scripts/` / `.github/workflows/` / racine | 17 / 6 / 3 | 17 / 6 / 3 |
| **Total code et configuration** | **96** | **82** |
| Tests partagés / documents | 40 / 26 | 40 / 25 |

Jump est nommé presque autant (API 21, portail 25, core-ui-profile 30, scripts-CI 41) : Tower n'est pas un cas à part.

## Ce qu'on retient
- **Les 5 systèmes les plus communs** : graine + jour de Paris + sac de thèmes ; enveloppe de rediffusion et validation serveur (même ordre dans `cdj.ts`, `jump.ts`, `tower.ts`) ; classement du jour + filtre Amis + noms de médailles ; plomberie client (copies de 12 à 42 lignes) ; branchement à la plateforme (registre, remise à zéro, mentions, effacement, zones de CI, budgets).
- **Les 3 plus propres** — Track : voiture et circuits à blocs, Salon et Garage, scène 3D · Jump : solveur et morceaux, vies et carnage, mécaniques de thème · Tower : Rapier et paliers, bot du Diamant, sensations.
- **Constats** : Tower n'est pas au tableau de bord (`apps/portail/src/admin.ts:428,720` : un résultat retiré à Tower s'affiche « Track ») ; deux copies de `["track","jump"]` (`core/src/jeux.ts:21`, `profile/src/jeux.ts:13`) ; marges de budget des consignes périmées (Track 42 o dans `budgets.md`, 710 o dans le `CLAUDE.md` racine).
- **Fiche** : `config/jeux/<id>.json`, un fichier par jeu, lu à la construction (projections générées, aucune requête de plus).

## Le plan (un jeu migré par lot, jamais deux ; aucune table, aucun golden, aucune version ne bouge)
- **K1** (moyenne ; K1b Jump, K1c Track : petites) — la fiche, lue par portail, `ui`, scripts de CI, site, musique. Tower d'abord (`off`).
- **K2** (grosse ; K2b, K2c : moyennes) — le module serveur et ses adaptateurs de table ; preuve : banc de réponses identiques avant / après.
- **K3** (grosse ; K3a Jump, K3b Tower, K3c Track) — `@cdj/kit` : les briques client ; Jump d'abord (marge de budget), Track en dernier.
- **K4** (moyenne) — `npm run nouveau-jeu` et le jeu témoin « Cibles » (jouable, classé, jamais en production).

## Questions pour Nathan (détail : § 7)
1. Fiche en JSON (recommandé) ou en TypeScript ? 2. Le lot du jeu écrit-il sa fiche (exception aux zones) ? 3. Jusqu'où va le témoin, et reste-t-il hors production ? 4. Neuf lots au lieu de quatre : d'accord, et dans cet ordre ? 5. Salon, Garage, vies et paliers restent-ils en dur (`routesPropres`) ? 6. Tables : adaptateurs sur les trois existantes, table commune pour un 4ᵉ jeu ? 7. Relever un plafond de budget si la mesure le justifie ? 8. `@cdj/kit` ou `@cdj/ui` ? 9. Le registre de versions de Tower, dans K1 ou à part ?

## Vérifié / non vérifié
Vérifié : chaque ligne de l'inventaire cite un fichier lu ; les chiffres sortent d'un `grep` du dépôt au 2/11/2026. Non vérifié : les tailles de lots (ordres de grandeur), le poids de `@cdj/kit` face aux budgets (mesuré en K3). Aucune CI propre à ce lot : documentation seule.
