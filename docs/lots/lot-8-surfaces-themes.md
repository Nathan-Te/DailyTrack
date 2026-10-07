# Lot 8 — Surfaces, blocs à effet et circuits à thèmes

**À essayer** : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?scenario=surfaces
(un circuit écrit à la main : terre, glace, herbe, super turbo, moteur coupé, virages relevés serré et large, plaque)

**Un lien par thème** (même date, thème forcé — essai, jamais classé) :
- Stade : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?seed=2026-10-07&theme=stade
- Rallye : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?seed=2026-10-07&theme=rallye
- Banquise : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?seed=2026-10-07&theme=banquise
- Nuit : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?seed=2026-10-07&theme=nuit
- Campagne : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?seed=2026-10-07&theme=campagne

(l'aperçu est publié par la CI à chaque push de la branche ; `&debug&tune` pour retoucher la voiture ; `?touch=1` sur ordinateur pour le tactile)

**Livré**
- **Revêtements** (attribut du bloc, notation `S/t` terre, `S/g` glace, `S/h` herbe ; table `SURFACES` dans `world.ts`, lue sous chaque roue) :

| | grip | motricité / freinage | roulement | mesures (flat, Node) |
|---|---|---|---|---|
| route | 1 | 1 | 0 | freinage 30 → 0 m/s : **11,2 m** ; virage de 16 m : **25,4 m/s** ; 0 → 20 m/s : 1,0 s |
| terre | 0,7 | 0,85 | 1,5 | **12,6 m** ; **20,8 m/s** ; 1,4 s |
| herbe | 0,5 | 0,55 | 7 | 15,5 m ; 17,4 m/s ; **5,9 s** ; roue libre : −8,6 m/s en 1 s (route : −3) |
| glace | 0,3 | 0,4 | 0,3 | **27,6 m** (×2,5) ; **13,5 m/s** ; 2,7 s |
  Chacun se reconnaît à sa couleur et à un motif léger (traces de roues, éclats, brins), sans texture. Le HUD (en bas à gauche) affiche le revêtement sous la voiture.
- **Blocs à effet** (état dans la voiture, donc rejoué à l'identique) :
  - **super turbo** (`T`, rouge à trois chevrons jaunes) : 180 pas (1,5 s), 42 m/s², plafond 68 m/s — contre 108 pas, 30 m/s² et 58 m/s pour la plaque. Mesuré à 30 m/s : pointe **68,1 m/s** pendant 1,7 s (plaque : 58,1 m/s, 1,1 s) ;
  - **moteur coupé** (`C`, bande damier sombre et jaune en travers de la route) : l'accélérateur n'agit plus (le frein, si) **jusqu'au prochain point de contrôle**, qui le rend dans le pas même où on le franchit. Indicateurs dans le HUD : « 🔥 SUPER TURBO », « ⚡ TURBO », « ⛔ MOTEUR COUPÉ ». Après l'arrivée, une plaque ne relance plus la voiture à l'arrêt.
- **Virages relevés** (`/b`, serrés de 16 m et larges de 48 m) : la route monte vers l'extérieur (pente 0,3 serré, 0,22 large, en rampe de 8 m à l'entrée et à la sortie : aucune marche), la voiture suit (suspension), et la pente latérale pousse vers l'intérieur (g × pente : +7,4 m/s² serré, +5,4 large). Le rebord extérieur est plus haut avec la route. **Vitesse minimale dans un virage serré (pilote) : +17 %** (22,0 → 25,8 m/s) ; dans un virage large : +4 %.
- **Thèmes** (`themes.ts`, tirés de la date comme la palette avant le lot 8) : *Stade* (palette néon : turbos, virages relevés, signature turbo puis grand virage relevé) · *Rallye* (désert : terre ; signature tremplin sur la terre) · *Banquise* (neige : glace et terre ; signature chicane sur la glace) · *Nuit* (moteur coupé suivi d'un point de contrôle deux blocs plus loin, turbos) · *Campagne* (nouvelle palette verte : terre et herbe ; signature épingle sur la terre). Le nom du thème remplace la palette dans l'en-tête et dans les archives.
- **Générateur** : les revêtements viennent par **zones** de 3 à 6 blocs ordinaires (jamais sur effets, bosses, tremplins sauf signature, départ ni arrivée) ; **cinq lignes droites derrière un super turbo** (il pousse 1,5 s : il faut ~150 m pour freiner), deux derrière une plaque (règle du 7b). Circuits plus longs : jusqu'à 75 blocs (60 avant).
- **Pilote** : vitesse de passage et freinage tiennent compte du revêtement (adhérence, motricité, roulement) et du relevé (g × pente) ; il reste près de l'axe en virage relevé (le bord intérieur est en contrebas et sa rampe d'entrée raide) ; sa trajectoire n'est plus plafonnée à 58 m/s mais à celle du super turbo.
- **`?theme=<nom>`** force le thème d'une date : autre circuit (identifiant `jour-AAAA-MM-JJ-g4-<nom>`), annoncé « thème forcé » dans l'en-tête, **jamais envoyé au classement** (l'API n'est même pas appelée) ni confondu avec le record du jour.
- `SIM_VERSION` **4**, `GENERATOR_VERSION` **4** ; références régénérées (le test du navigateur compare aussi le thème de chaque date).
- Un détail de physique : sur une route en pente, la pesanteur a maintenant une composante **latérale** (nulle sauf en virage relevé) — d'où le changement de version.

**Garde-fous**
- `packages/sim/test/surfaces.test.ts` (17 tests) : notation (revêtements, relevé, effets, erreurs) ; circuit des surfaces fini par le pilote ; **freinage glace > herbe > terre > route** (de 30 m/s, glace > 2 × route) ; **vitesse de passage d'un même virage route > terre > glace** (glace < 65 % de la route) ; herbe ≥ 2,5 × la route en roue libre ; accélération glace < terre < route ; **super turbo plus haut et plus long que la plaque** ; **moteur coupé : accélérateur sans effet, coupé à chaque pas jusqu'au pas exact du point de contrôle, frein actif, reprise** ; plaque inerte après l'arrivée ; relevé (hauteurs de l'axe, de l'intérieur, de l'extérieur, raccord à plat à l'entrée) ; plus vite en relevé ; rebord extérieur toujours arrêtant.
- `generator.test.ts` (22) : **sur 60 jours consécutifs, chaque thème apparaît, aucun circuit de secours, tous validés par le pilote dans la fenêtre 28–48 s** ; signature de chaque thème ; moteur coupé → point de contrôle deux blocs plus loin ; cinq blocs sans virage après un turbo ; thème forcé (identifiant, reproductible, inconnu ignoré).
- `e2e/surfaces.spec.ts` : `?scenario=surfaces` (chaque revêtement, turbo, moteur coupé dans le HUD, vitesse sans effet de l'accélérateur), les cinq thèmes forcés, aucun appel d'API avec un thème forcé, en-tête du thème du jour.
- Génération (60 jours consécutifs, sous Vitest) : **moyenne ≈ 100 ms, pire ≈ 460 ms** (sans autre charge ; le serveur la met en cache).

**Décisions pour Nathan**
- **Herbe : surface jouable ou seulement bas-côté ?** Elle est ici une surface de bloc entière, très lente (0 → 20 m/s en 5,9 s, un virage de 16 m à 17 m/s) : à éviter, mais le circuit y passe quand même dans *Campagne*. Un vrai « raccourci risqué » ou « bas-côté » demanderait des revêtements **par zone de la route** (et non par bloc) : plus lourd, non fait.
- **Fréquence des thèmes** : tirés à parts égales (1/5 chacun) ; sur 60 jours, *Campagne* n'est sortie que 4 fois, *Stade* et *Nuit* 15 et 14. Le tirage est le même qu'avant (juste à 5 au lieu de 4).
- **Circuits plus longs** : les lignes droites derrière turbos et plaques les allongent (temps d'auteur médian ≈ 36–44 s selon le thème, fenêtre 28–48 s inchangée).
- **Moteur coupé** : coupe environ 1 s avant le point de contrôle (deux blocs) ; on peut l'allonger (trois blocs, ou un autre point de contrôle) si ça te paraît trop gentil.

**Non vérifié**
- La **sensation** de chaque revêtement et des virages relevés n'est jugée que par des mesures (rien d'essayé au volant ni sur téléphone) : la glace en particulier (grip 0,3) pourrait être trop ou pas assez sévère pour un humain.
- Les seuils de médailles ne sont pas recalés (le pilote conduit sur la glace comme sur la route, en plus lent).
- Firefox et WebKit : le déterminisme y est vérifié par la CI (non installés ici).
