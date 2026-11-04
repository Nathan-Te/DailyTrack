# Ajustements (lot 17)

> Déplacé **mot pour mot** de `packages/jump-sim/CLAUDE.md` (lot T1, économie de jetons) : rien n'est réécrit, les règles sont en vigueur. Le renvoi est dans [`packages/jump-sim/CLAUDE.md`](../../../packages/jump-sim/CLAUDE.md).

## Ajustements (lot 17)
README : `docs/jump/lots/lot-17-ajustements.md`. `JUMP_GENERATOR_VERSION` **12** (identifiants `…-g12`), `JUMP_SIM_VERSION` 4 inchangée, golden v3 identiques.
- **Une variante refusée se remplace par une variante ajoutée, jamais corrigée en place** : la refusée garde son texte, ses solutions et sa place (donc la référence v3, g9, au bit près : les golden v3 sont la preuve) ; la nouvelle, **au bout de la liste**, est dans `V4_ONLY_VARIANTS` (`daily.ts`) : le catalogue v3 (`choices(3)`) ne la connaît pas, le catalogue v4 la pose si elle passe toutes les phases. Les trois du lot 17 : `scie-sol` v6 (`cycle=330 +patrouille:220` : période commune 660 pas au lieu de 6 600), `cheminee-scie` v4 (`cycle=780`), `nuit-opposition` v5 (`cycle=360 solide=180`). **Les solutions dépendent de l'indice de la variante** (graine de la gigue) : une même grille à un autre indice peut tomber autrement ; essayer plusieurs valeurs, garder celle qui passe la règle complète, ne rien relâcher.
- **Famille et étiquettes** : une variante ajoutée appartient au même morceau, donc à sa famille et à ses étiquettes ; une variante notée 4–5 passe aussi `voies:modules` (parasites).
- **Tout changement de règle de la validation toutes phases se mesure d'abord sur les solutions déjà gardées** (`modules/phases.json`) : la règle des 12 s a été vérifiée sur les 928 reprises du catalogue avant d'être appliquée (une seule variante refusée), sans refaire la recherche (`PHASES_RULE_VERSION` inchangée).
