# Lot PA1c (plateforme, kit) — Le moule Party, corrigé d'après Pile poil

PA2 (« Pile poil ») est déjà fusionnée dans `main` (PR #374) : ce lot part de `main` et ne touche que les zones partagées (un seul test de Tower, voir plus bas).

## Partie 1 — ce qui rendait la CI de PA2 rouge
1. **Identité Party** : `packages/core/test/identite.test.ts` saute `categorie === "party"` (la fiche impose `aujourdhui: false`, `validerFiche`).
2. **Plusieurs jeux Party** : le test du modèle (`cibles.test.ts.modele`, « aperçu de PR »), `baseDeReference.ts` (un jeu Party n'a de parties que les jours où il est en tête) et `routesChaudes.ts` (chaque envoi se mesure un jour de tour de son jeu, `RouteSpec.jour`) cherchent le jour de leur jeu, horloge maîtrisée. Reproduit puis vérifié : l'ancien code échoue dans la copie à deux jeux Party (`not_party_of_the_day`), le nouveau passe. **`routesChaudes.test.ts`** : « portail jour (joueur) » lit une fois chaque jeu (29 instructions avec 10 fiches, 31 avec 12) : le plafond d'instructions devient **20 + 1 par fiche** (30 aujourd'hui, comme avant), pas un relâchement.
3. **Mentions** : les clés de `pilepoil:` sont dans les deux pages ; **le générateur les écrit** pour tout nouveau jeu (repère `<!-- jeux-du-kit:fin -->`, `ENTREES_MECANIQUES`). PA2b peut retirer ses préfixes « À remplacer ».
4. **Dockerfile** : plus de `COPY apps/<id>/public/jours` pour un jeu Party (ni dans le moule, ni pour Pile poil).
5. **Copies** : `entrees(rejeu)` d'un contrat Party rend `null` sans entrée jouée ; le module ne compare jamais cette partie (`sansEntree`). Le reste de la règle est inchangé.

## Partie 2 — le jeu Party suivant
6. **Commandes** : `manette` d'une action peut être une liste (« n'importe quel bouton de face », la première est la liaison gardée au stockage : format inchangé) ; un jeu redéclare `recommencer` sans touche (`coherent` l'accepte) ; un réglage enregistré reste relu.
7. **Moule Party** : plus d'essais du témoin, de specs du kit (`chargement-partie`, `surimpression`, `fin-et-aide`) ni de `variante.ts` — les règles et le texte du score sont dans `partie.ts` ; `--categorie party --classement temps` est refusé. 8. `hud: "surimpression-claire"`. 9. `dessiner(avancement)`.
Détails : `docs/regles/kit/commandes-surimpression-et-avancement-lot-pa1c.md`, `docs/regles/api/un-jeu-party-lot-pa1.md`, `docs/regles/racine/creer-un-jeu.md`.

## Mesures
- **Ce qui a été retiré du premier chargement** (le kit n'avait presque plus de marge) : de la classe `Commandes`, `estDorigine()`, `emplacementsDe`, `enregistrer` (devenus des fonctions de `commandesEdition.ts`, à la demande), `texteTouches` (en ligne) et la double copie de l'origine dans `charger`. `rush.jsCss` : **45 961 → 45 890 o** (plafond 46 000) ; dans la copie de « Kit de bout en bout » : 46 016 (déjà **au-dessus** du plafond avec Pile poil) → **45,94 Ko**.
- Jetons : `packages/kit/CLAUDE.md` +1 ligne (renvoi) ; session Track 53 868 → 53 920 (plafond 54 000).
- Bancs de réponses : inchangés (réponses des jeux existants identiques).

## Reste rouge : à décider par Nathan
- **`portail.classement` : 57,08 Ko pour 57 Ko (83 o) dans la copie de « Kit de bout en bout » (trois jeux générés)**, identique avant ce lot : Pile poil a ajouté 170 o à cette page, chaque jeu de plus en coûte ≈ 130 (JS de la fiche + 4 règles CSS). Le dépôt lui-même est à 56 693 o. Non corrigé (relever un plafond est à Nathan ; le relèvement 57 → 60 Ko proposé par U6 règle aussi ce cas). Tant qu'il est rouge, le job s'arrête à cette étape : l'e2e Chromium des trois jeux générés ne tourne pas dans ce job (vérifié à part : `--jeux essaiparty`).
- Un test de Tower (`apps/tower/test/commandes.test.ts`) appelle `estDorigine(c)` de l'édition au lieu de la méthode retirée (même assertion).
- PA2b : `entrees` de Pile poil doit rendre `null` sans appui (sinon deux parties vides restent des copies), puis `recommencer` sans touche, `surimpression-claire`, `dessiner(avancement)` ; le `public/jours/.gitkeep` de Pile poil devient inutile.

## Vérifié / non vérifié
Unitaires touchés (ui, kit, core, api, portail), typage, `jeu-fictif` (deux jeux Party), `kit-bout-en-bout`, `npm run consignes`. Non vérifié : la CI de la PR (voir son résultat), téléphone réel.

## Pour les joueurs
rien
