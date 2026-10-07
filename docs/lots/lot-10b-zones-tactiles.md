# Retouche 10b — Zones de toucher en paysage

**À ouvrir sur le téléphone** (mode boutons, zones dessinées) : https://nathan-te.github.io/DailyTrack/b/lot-10b-zones-tactiles/?scenario=pilotage&touch=1&steer=boutons&zones=1
**Puis le même sans les zones** : https://nathan-te.github.io/DailyTrack/b/lot-10b-zones-tactiles/?scenario=pilotage&touch=1&steer=boutons
(l'aperçu est publié par la CI à chaque push ; si l'environnement a imposé un autre nom de branche, remplacer `lot-10b-zones-tactiles` dans le lien.)

Avec `zones=1` : une tranche colorée par zone (avec son nom) et **un point sous chaque doigt**, de la couleur de la zone touchée, **rouge** si le doigt est tombé hors de la couche de jeu (sur un bouton, une fenêtre…). Dis-moi où les points sont rouges.

## Causes trouvées (diagnostic par test Playwright, Chromium, gabarits iPhone et Android)
1. **La barre d'actions (pause, ↺, ⟲, ⚙, ⛶) volait les appuis voisins** : centrée en bas sur ≈ 34 % → 66 % de la largeur, donc **au milieu des zones ← | → | frein**. Le navigateur « corrige » un toucher proche d'un petit bouton vers ce bouton : un appui en bas, près du centre, **mettait en pause** (ou ouvrait les réglages), et tous les appuis suivants tombaient sur la fenêtre. Le conteneur de la barre captait aussi les toucher entre deux boutons.
2. **`lostpointercapture` levait le mauvais doigt** : il arrive après `pointerup`, et si le système réutilise l'identifiant du doigt, il pouvait lever le doigt suivant (appui « perdu »). Retiré (`pointerup` / `pointercancel` suffisent).
3. **Visuel et zone définis à deux endroits** (CSS en % d'un côté, `zoneAt` de l'autre) : décalages possibles (gaz dessiné à partir de 77 % alors que la zone commence à 75 %, rien ne tenait compte de l'encoche).
4. Pas de `preventDefault` sur `touchstart` / `touchmove` (comportements par défaut du navigateur possibles).

## Livré
- **Une seule définition des zones** (`touch.ts`) : `zoneSpans` (zones actives, **sans trou** : ← 0–25 %, → 25–50 %, frein 50–100 %, ou frein 50–75 % | gaz 75–100 %, toute la hauteur) ; `zoneAt` en découle ; `buttonRects` place les boutons dessinés (compacts, centrés dans leur zone).
- **Grandes zones, petit visuel** : le toucher se décide par la zone, pas par le bouton dessiné.
- **Glisser d'une zone à l'autre** sans lever le doigt (← vers →, frein vers gaz), plusieurs doigts à la fois (diriger + accélérer / freiner), suivi par identifiant de pointeur.
- **Zones sûres** : le visuel s'écarte de `env(safe-area-inset-*)` (encoche, barre d'accueil) et de **24 px** des bords (gestes système) ; la zone active, elle, va jusqu'aux bords.
- **Barre d'actions compacte** (boutons 44 px, 228 px de large) : de ≈ 36 % à 64 % de la largeur, loin des frontières 25 / 50 / 75 % (le test le vérifie).
- **Aucun toucher perdu** : `touch-action: none`, `preventDefault` sur `touchstart` / `touchmove` (non passifs), pas de menu d'appui long, de zoom, de double-tap.
- **Réglage « Taille des boutons »** (Petits / Moyens / Grands, `buttonSize` dans `cdj:touch`) ; `?steer=boutons|glisser` force le mode ; `?zones=1` le diagnostic ; options correspondantes dans `/admin/` (raccourci « Zones tactiles »).
- Rien dans `sim` ; golden inchangés.

## Tests
- `apps/web/test/touch.test.ts` : zones sans trou ni recouvrement (pixel par pixel), boutons dans leur zone et hors des marges, tailles, glissement ← → et frein → gaz, deux doigts.
- `e2e/tactile.spec.ts` (paysage, iPhone et Android, pas à pas) : un appui en tout point de chaque zone, coins à 8 px du bord compris, déclenche la bonne commande ; glisser ← → ; direction + gaz ensemble ; aucun point de la moitié basse hors de la couche de jeu ; `?zones=1` (points colorés, rouge hors zone) ; taille des boutons mémorisée.
- Seule exception du test d'appui : à 14 px autour d'un petit bouton d'action (barre du bas, menu du haut), le navigateur corrige le toucher vers ce bouton, c'est voulu.

## Limites / à vérifier par Nathan
- **Vrai téléphone non testé** (encoche réelle, bandes de gestes iOS / Android) : avec `zones=1`, poser les pouces aux endroits habituels, regarder les couleurs des points.
- Les boutons du menu en haut à droite (classement, archives…) captent aussi les appuis voisins dans le coin ; non déplacés (hors périmètre).
