# Lot 10 — Commandes tactiles

**À ouvrir sur le téléphone** : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?scenario=pilotage
**Le circuit du jour** : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/ (l'aperçu est publié par la CI à chaque push de la branche)

Mode paysage conseillé. Rien à activer : le téléphone est reconnu (`pointer: coarse`). Sur ordinateur, `?touch=1` fait simuler le doigt par la souris.

**Livré**
- **Disposition (paysage)**
  - *moitié gauche* : **direction par glissement horizontal** relatif au point de pose (analogique, zone morte 8 %, plein braquage à 70 px, sensibilité réglable). Au-delà du plein braquage, le point de pose suit le doigt : pour redresser, un petit retour suffit. Un curseur (anneau + pastille) montre le glissement ;
  - *moitié droite* : **frein / marche arrière**. **Accélérateur automatique** par défaut (coupé tant qu'on freine) ;
  - **plusieurs doigts** : on dirige et on freine en même temps ; un second doigt à gauche est ignoré ;
  - boutons en bas : **⏸ pause · ↺ dernier point de contrôle · ⟲ départ · ⚙ réglages · ⛶ plein écran** (celui-ci n'apparaît que si le navigateur le permet : pas sur iPhone).
- **Réglages** (⚙, mémorisés) : direction *Glisser* ou *Boutons ← →* (quart gauche = ←, deuxième quart = →, plein braquage, on peut glisser de l'un à l'autre) · sensibilité · zone morte · accélérateur *Automatique* ou *Bouton gaz* (la moitié droite se partage en FREIN et GAZ) · vibration. Le jeu se fige tant que la fenêtre est ouverte.
- **Pause** (⏸, ou **P** au clavier) : fige la course (le chrono compte des pas : rien ne se perd) ; l'ouverture des archives ou des réglages au toucher fige aussi (avec l'accélérateur automatique, la voiture ne doit pas rouler pendant qu'on lit).
- **Confort** : en portrait, une invitation à tourner le téléphone (qu'on peut écarter : « Jouer quand même ») ; pas de zoom (`user-scalable=no`, gestes de pincement bloqués), de défilement, de menu d'appui long ni de double-tap ; **vibration** courte au point de contrôle (25 ms) et au choc (40 ms) si le téléphone sait vibrer (jamais sur iPhone : Safari n'expose pas l'API) ; boutons de menu, d'action et de réglage ≥ 44 px ; aide « Glisse à gauche pour tourner · touche à droite pour freiner » jusqu'au premier toucher.
- **Même chaîne de commandes** : les doigts produisent les mêmes axes que le clavier et la manette, quantifiés par `makeInput` en commandes entières (jamais −0). **Rien ne change dans `sim`** : `SIM_VERSION` et les références ne bougent pas, une course au doigt se rejoue exactement comme une autre.
- Outils de test (`?debug`) : `spec=<blocs>` (un circuit écrit à la main), `__cdj.input` (dernière commande appliquée), `__cdj.manual(true)` + `__cdj.advance(n)` (simulation pas à pas, indépendante de la vitesse de la machine), `__cdj.paused`, `__cdj.touch`.

**Garde-fous**
- `test/touch.test.ts` (19 tests) : détection, zone morte et sensibilité, zones, point de pose qui suit le doigt, multi-doigts, boutons ← →, accélérateur manuel, quantification entière, réglages (valeurs illisibles ou hors limites), seuil de choc.
- `e2e/tactile.spec.ts` (**vrais événements tactiles** envoyés par le protocole du navigateur, Chromium), sur un gabarit **Android** (851×393) et un **iPhone** (844×390) : accélérateur automatique, glissement (valeurs attendues des commandes), frein au second doigt, pause qui fige le chrono, reprise et départ, réglages gardés d'une visite à l'autre, cibles ≥ 44 px ; mise en page sans chevauchement en paysage et en portrait (police DejaVu Sans imposée, cf. orchestration § 8) ; invitation à tourner ; `?touch=1` à la souris ; détection sans option ; **un tour fini au doigt** (deux grands virages, direction poussée au pouce, **sans sortie de route**) dont **la rediffusion rejouée par `sim` redonne exactement le même temps** ; vibrations (et désactivation).
- `e2e/mobile.spec.ts` (existant) : a trouvé un vrai chevauchement (menu à 44 px sur les médailles en portrait), corrigé ; il vérifie maintenant aussi la barre de boutons.

**Ce qui ne ressemble pas à la demande**
- Le prompt du lot demande de terminer `?scenario=plat` : ce terrain n'a **pas de ligne d'arrivée**. Le test « finir un tour » utilise donc un circuit écrit à la main (`?debug&spec=…`) ; `?scenario=plat` sert aux tests de commandes.
- La branche est `claude/bold-thompson-ank8u1` (imposée par la session), pas `lot-10-tactile`. Les lots 8 (surfaces) et 9 (rendu, sons) ne sont pas faits : Nathan a demandé le tactile en premier ; la retouche 7b attend toujours les réglages.

**Décisions pour Nathan**
- **Direction par défaut** : *Glisser* (analogique, plus fin) ; *Boutons ← →* est plus simple mais tout-ou-rien. À juger au pouce sur ton téléphone.
- **Accélérateur automatique par défaut** : on ne se concentre que sur la direction et le frein, mais on ne peut pas lâcher les gaz pour « cadrer » une courbe (seul le frein ralentit). Si ça manque : *Bouton gaz* dans les réglages.
- À envisager : **gyroscope** (incliner le téléphone pour diriger) — non fait, hors périmètre ; **application installable** (PWA : plein écran sur iPhone) — non fait.

**Non vérifié**
- **Aucun vrai téléphone n'a été testé** (ni Android, ni iPhone) : les gestes sont synthétiques (Chromium, émulation mobile). À confirmer en vrai : confort du pouce, taille des zones, dimensions réelles (encoche, barre d'adresse), vibration sur Android, plein écran, rotation de l'écran en pleine course, performances (rendu).
- Safari iOS : l'événement `pointer` tactile et `touch-action: none` sont standard, mais ce navigateur n'est pas installé ici (la CI n'exécute pas ces tests de rendu hors Chromium).
- Le test de vibration passe par une fausse `navigator.vibrate` : il vérifie que le jeu l'appelle, pas ce que le téléphone en fait.
