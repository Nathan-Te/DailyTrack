# Lot 1b — DailyJump jouable sur mobile

## À tester
Sur téléphone : `https://nathan-te.github.io/DailyTrack/b/claude-lot-1b-mobile-dailyjump-d46mal/jump/?scenario=bac-a-sable&debug&tune`
(la branche de la session s'appelle `claude/lot-1b-mobile-dailyjump-d46mal`, d'où l'adresse ; l'aperçu n'existe qu'une fois la CI passée). Sans `debug` : `…/jump/`.

- **Paysage conseillé.** Pouce gauche : **←** (premier quart de l'écran) et **→** (deuxième quart) ; on peut **glisser de l'un à l'autre sans lever le doigt**. Pouce droit : **saut** (moitié droite, tenir = saut plus haut). **↻** en haut à gauche recommence. **⚙** (avec `tune`) ouvre les réglages : la partie est en pause, **✕** referme. **⛶** = plein écran (Android seulement).
- Les boutons n'apparaissent qu'au premier toucher. `&zones=1` dessine les zones et un point par doigt (utile pour vérifier une frontière sous le pouce) ; `&touch=1` force le tactile sur ordinateur (la souris simule le doigt).
- « Copier les valeurs » : presse-papiers ; s'il refuse, le JSON s'affiche dans une zone de texte déjà sélectionnée (appui long → Copier).

## Zones (`touch.ts`, définies une fois par taille d'écran, sans trou)
```
 portrait 390 × 844                paysage 844 × 390
┌──────────────────────┐          ┌───────────────────────────────────────────┐
│ ↻      bande      ⚙ ⛶│ 60 px    │ ↻               bande                  ⚙ ⛶│ 60 px
├────────┬─────┬───────┤          ├──────────┬──────────┬────────────────────┤
│        │     │       │          │          │          │                    │
│   ←    │  →  │ saut  │          │    ←     │    →     │       saut         │
│ 0–¼    │ ¼–½ │  ½–1  │          │   0–¼    │   ¼–½    │        ½–1         │
└────────┴─────┴───────┘          └──────────┴──────────┴────────────────────┘
```
- Les tranches se touchent (0, ¼, ½, 1 de la largeur) et vont jusqu'en bas ; la bande haute fait 60 px + la zone sûre haute. Une frontière appartient à la zone de droite.
- Un doigt prend son **rôle à la pose** : direction (← ou →, d'après son abscisse seule, donc glissable) ou saut (suit son propre doigt). Un doigt de direction qui sort de la moitié gauche compte pour la zone la plus proche de cette moitié (→ à droite de l'écran, ← hors de l'écran à gauche) ; seul le **lever** (ou l'annulation) arrête la commande. Un doigt posé dans la bande haute ne commande rien, même s'il glisse ensuite dans le jeu.
- Plusieurs doigts de direction : le plus récent l'emporte, le précédent revient quand il est levé (décision à valider, voir plus bas).
- Les appuis de saut passent par `JumpLatch` comme au clavier : un appui bref entre deux pas compte pour un pas tenu.
- Boutons dessinés : un carré par zone (jusqu'à 104 px, au moins 44), centré dans sa zone, à 12 px au moins des frontières et des bords, 36 px au-dessus du bas, écartés des zones sûres. Boutons de la bande : 48 px.

## Page
`touch-action: none`, `overscroll-behavior: none`, corps `position: fixed` en `100dvh`, `viewport-fit=cover`, marges `safe-area-inset-*`, ni sélection de texte (`user-select`, `-webkit-touch-callout`) ni menu contextuel ni zoom par pincement (`gesturestart`). Invitation « Tourne ton téléphone pour plus de confort » en portrait : pastille discrète, sans effet sur le toucher, retirée au premier toucher de jeu (sinon elle s'efface d'elle-même au bout de 9 s).

## Cadrage de la caméra (`viewHeightTiles`, affichage seul)
| Écran | Hauteur d'image | Largeur d'image |
|---|---|---|
| ordinateur (souris, clavier) | 18 tuiles (inchangé) | selon l'écran |
| téléphone en paysage (844 × 390) | **13 tuiles** (une tuile ≈ 30 px) | 28 tuiles |
| téléphone en portrait (390 × 844) | **21,6 tuiles** | **10 tuiles** |
Règle : `max(base, 10 × hauteur / largeur)` ; jamais moins de 10 tuiles de large, dans les deux modes. La caméra reste bornée au niveau (centrée s'il est plus petit que l'image).

## Optimisation de la sim : `tileOf(u) = u >> 12`
`tileOf` existait (bâtie sur `floorDiv` → `idiv`, avec `%` et plusieurs vérifications) ; elle est maintenant `v >> 12`, **seul décalage permis dans la sim**, exact tant que `v` tient sur 32 bits signés (±524 288 tuiles). `floorDiv`, devenue inutile, est supprimée. Testée contre `Math.floor(v / 4096)` : toutes les valeurs de −3 à +3 tuiles, 200 000 coordonnées au hasard sur ±2 000 tuiles, aucun `-0`.
**Golden (DailyJump) inchangés, `JUMP_SIM_VERSION` = 1** : aucun résultat n'a bougé.

| Coût moyen d'un `stepPlayer` (commandes au hasard, bac à sable, Node 22, 2 M de pas, 7 passages × 2) | |
|---|---|
| avant (`floorDiv` + `idiv`) | ≈ 1 300 ns (1 230 – 1 450) |
| après (`v >> 12`) | **≈ 520 ns** (470 – 680) |
Soit environ 2,5 fois plus vite ; à 120 pas/s, 0,06 % d'un cœur au lieu de 0,16 %.

## Tests
- Unitaires (`apps/jump/test/touch.test.ts`, 39 tests) : zones sans trou sur 9 tailles d'écran (portrait, paysage, tablette), frontières, bande et encoche ; boutons ≥ 44 px dans leur zone ; glissement ← → sans lever ; deux doigts ; doigt hors zone et dans la bande ; plus récent gagnant ; appui bref mémorisé ; cadrage. `packages/jump-sim/test/collide.test.ts` : `tileOf`.
- e2e (`apps/jump/e2e/mobile.spec.ts`, 30 tests ; téléphone émulé, tactile) en portrait 390 × 844, paysage 844 × 390 et petit écran 320 × 568 : → et saut font avancer et sauter (pas à pas), glissement, doigt dans la bande, recommencer, cibles ≥ 44 px (réglages ouverts compris), page sans défilement ni zoom, cadrage, invitation portrait ; panneau ⚙ (pause réelle, couche coupée), curseur au doigt, repli du presse-papiers, surimpression lisible ; détection `pointer: coarse`, `?touch=0`, `?zones=1`. Chromium : vrais événements tactiles (`Input.dispatchTouchEvent`).
- Les tests de DailyTrack et les golden de DailyTrack n'ont pas été touchés.

## Vérifié / non vérifié
**Vérifié** (ici, Chromium en émulation de téléphone, rendu logiciel) : tout ce qui précède ; captures portrait et paysage relues à l'œil (bande, boutons, surimpression, panneau).
**Non vérifié** :
- **Vrai iPhone, vrai Android** : ressenti du pouce, zones sûres réelles (encoche, barre d'accueil), bouton plein écran, verrouillage d'orientation, retour haptique (hors lot), barre d'adresse qui se replie.
- **Firefox et WebKit** : je n'ai que Chromium ici ; ces deux navigateurs sont couverts par la CI (mêmes tests, doigts envoyés en pointer events sur la couche tactile faute de protocole). Si un test y échoue, c'est un vrai point à corriger.
- **Curseurs au doigt sur iOS** : `touch-action: pan-y` sur les curseurs (le défilement vertical reste possible depuis un curseur, le glissement horizontal règle la valeur) est le réglage standard mais n'est testé qu'avec Chromium.
- Police DejaVu Sans de la CI : les tests ne mesurent que des marges et des tailles de boutons, pas des largeurs de texte (la surimpression de debug passe à la ligne sur petit écran).

## Décisions pour Nathan
1. **Plusieurs doigts de direction** : le plus récent l'emporte (le pouce qui roule de ← à → ne se bloque pas). Alternative : gauche + droite = neutre, comme au clavier.
2. **Zone de saut = toute la moitié droite** (comme demandé) ; le bouton dessiné est plus petit, mais le pouce n'a pas à viser.
3. **Boutons visibles au premier toucher seulement** ; `↻` toujours visible sur un appareil tactile. Un appui sur ↻ recommence aussitôt (pas de confirmation : le jeu est fait pour recommencer vite) — à revoir si tu le touches par erreur.
4. **Cadrage téléphone paysage : 13 tuiles.** 12 donne des tuiles plus grosses (32 px), 14 plus de visibilité ; à régler d'après ce que tu ressens (`VIEW_TILES_PHONE`, `camera.ts`).
5. Hors périmètre, non fait : vibrations, son, PWA. Aucune zone partagée touchée, aucune dépendance ajoutée.
