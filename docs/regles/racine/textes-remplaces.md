# Textes remplacés par le lot T1 (conservés mot pour mot)

> Phrases que le lot T1 a remplacées par une formulation plus courte (ou supprimées parce qu'elles disaient la même chose qu'ailleurs). Elles sont gardées ici pour qu'aucune règle ne se perde.

Préambule d'avant (remplacé par la section « Comment lire ces consignes ») :

**Ce fichier est court exprès.** Les consignes détaillées vivent dans le `CLAUDE.md` de chaque zone : Claude Code charge ceux des sous-dossiers **à la demande**, dès qu'on lit ou modifie un fichier du dossier (`docs/plateforme/lots/lot-R2-hygiene.md` cite la doc). **Avant de travailler dans une zone, lis son `CLAUDE.md`** s'il n'a pas été chargé (par exemple `cat apps/jump/CLAUDE.md`).

- **Zones partagées** (un seul propriétaire à la fois, conflits à éviter) : `packages/core` (`@cdj/core`, socle sans logique de jeu), `packages/clock` (jour de Paris), `packages/profile` (`@cdj/profile`, profil commun côté client), `packages/ui` (`@cdj/ui`, socle de l'interface, lot I1) et `packages/kit` (`@cdj/kit`, briques communes côté jeu, lot K3), `apps/portail` et `firebase.json` (lot R4 : portail, mentions légales, configuration de Firebase Hosting), `package.json` et `package-lock.json` racine, `.github/workflows/`, la configuration Vitest / Playwright / TypeScript racine (`vitest.config.ts`, `tsconfig.base.json`, `tsconfig.json`), ce `CLAUDE.md` racine.
- **Règle : un lot ne modifie une zone partagée que si son prompt le dit.** Les consignes d'un jeu vivent dans le dossier de ce jeu, pas ici.

Blockquote « Renvois » (identique dans cinq `CLAUDE.md` de zone, réécrit car l'index des rubriques n'est plus dans le racine) :

> **Renvois « voir <rubrique> »** : une rubrique citée mais absente de ce fichier se trouve dans un autre `CLAUDE.md` du dépôt ; l'index des rubriques est dans le `CLAUDE.md` racine. Pour l'état d'ensemble, partir de la synthèse ; n'ouvrir un README de lot que pour un détail.

Les trois sections « Mon groupe » de `apps/web`, `apps/jump` et `apps/tower` étaient identiques : le texte est dans `packages/kit/CLAUDE.md`.

Préambule de `docs/tower/consignes.md` (avant : « Chargé par le `CLAUDE.md` racine (comme les consignes de Jump). » ; l'import `@docs/tower/consignes.md` du racine est supprimé, il chargeait 33 000 jetons dans chaque session ; titre de `docs/tower/consignes.md` : « Tower — consignes (lots T0, T1, T2, T3, T3b, T4, T5, T6, T7, T8, T9 et R15) »).

Carte du dépôt, paragraphe Tower : l'import `@docs/tower/consignes.md` est devenu un renvoi (voir `carte-du-depot.md`).

Ancien titre de `docs/tower/consignes.md` :

# Tower — consignes (lots T0, T1, T2, T3, T3b, T4, T5, T6, T7, T8, T9 et R15)
