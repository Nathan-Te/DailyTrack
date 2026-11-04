# `apps/blocks` : le jeu Blocks

Chargé quand on lit un fichier de `apps/blocks`. Les règles du jeu (zones, état de départ, où est quoi) sont dans [docs/blocks/consignes.md](../../docs/blocks/consignes.md), sa vision dans `docs/blocks/seed.md` (**ne pas modifier**), les règles communes dans le `CLAUDE.md` racine.

## Maquettes (lot B0)
- **`docs/blocks/maquettes/` font foi pour l'étiquette et le HUD** : étiquette sur l'étagère (3 teintes), HUD en partie en portrait (4 états), en paysage et au bureau. Le README du dossier liste les questions ouvertes, les clés de catalogue et les jetons proposés.
- **État : en attente de validation par Nathan.** Tant qu'il n'a pas validé (et tranché les questions du README), **aucun code d'interface** n'est écrit : ni HUD, ni étiquette, ni écran. Une fois validé, cette section dit quelle teinte et quelles réponses sont retenues.
- Les maquettes appellent les fonctions du module commun (`@cdj/visuels/blocs`) : à l'implémentation, **fusionner les cases d'une pièce en rectangles** avant `decrirePiece` (une boîte par case laisse un point d'encre au croisement de quatre cases ; détail dans le README des maquettes).
