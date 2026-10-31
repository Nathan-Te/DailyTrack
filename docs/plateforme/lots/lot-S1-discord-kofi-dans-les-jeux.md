# Lot S1 — Discord et Ko-fi sur l'accueil des jeux

**Pour les joueurs**
- [Du Jour] Le Discord et Ko-fi sont aussi sur l'accueil de chaque jeu. // Discord and Ko-fi are now on each game's home screen too.

## Ce qui est fait
- **Composant** : `packages/ui/src/liensCommunaute.ts` (+ `.css`, `discord.svg`, `kofi-tasse.png`), à la demande côté jeux. **Même aspect que les boutons du pied du portail** (retour de Nathan : bleu de Ko-fi et sa tasse, bleu-violet de Discord et son pictogramme ; jetons `--dj-kofi`, `--dj-discord`, `--dj-blanc` et deux paires de contraste). Le portail s'en sert (`lienCommunaute`).
- **Adresses** : écrites une seule fois, dans ce fichier (`LIEN_DISCORD`, `LIEN_KOFI`) ; `apps/portail/src/liens.ts` est supprimé, le portail s'en sert.
- **Noms lus** : `communaute.discord` « Rejoindre le Discord » / “Join the Discord”, `communaute.kofi` « Soutenir sur Ko-fi » / “Support on Ko-fi” (catalogue commun, `npm run traductions` à jour).
- **Place** : en bas à gauche de l'écran d'accueil de Track (`#home`), Jump (`#home`) et Tower (coque de l'accueil), posées sur la scène sous le voile ; ni en partie, ni en pause, ni à l'arrivée (elles disparaissent avec l'accueil). L'écran leur réserve une bande en bas ; à 844 × 390 la rangée de boutons de Jump défile au-dessus d'elles.
- **Liens** : `target="_blank"`, `rel="noopener noreferrer"`, aucun script ni paramètre.
- **Manette** : ce sont des liens dans le dialogue d'accueil, donc joignables au focus ; l'action principale reste JOUER / COURIR.
- Captures : `docs/plateforme/lots/img/lot-S1-{track,jump}-{844x390,390x844}.png` (Tower aussi vérifié, non copié).

## Budgets
Track `jsCss` 296 275 / 296 736 · Jump `jsCss` 375 905 / 378 490 (**`liensCommunauteJeu-*` exclu de `mesureJump` et de `poids.spec.ts`, comme `manette-*` : à confirmer par Nathan**) · Tower ≈ +245 o.
**Portail : 32 897 / 32 768 o — DÉPASSE de 129 o** (la marge de `main` était de 13 o ; le déplacement des boutons dans le socle ajoute trois jetons de couleur et du code). Décision de Nathan : relever le plafond du portail d'environ 200 o, ou laisser le portail garder son propre code et ses couleurs (les jeux reprennent alors le même aspect sans passer par le portail).

## Vérifié / non vérifié
- Vérifié en local : typecheck, vitest `packages/ui` `apps/portail` `apps/tower` (verts), e2e Chromium ciblés (Track `accueil`, Jump `plein-ecran`, Tower `partie` et `classement`), absence de chevauchement à 844 × 390, 740 × 360 et 390 × 844 pour les trois jeux (mesure par script, zones défilantes tenues en compte).
- Non vérifié : CI de PR (voir le run sur la PR), Firefox / WebKit, iPhone réel (marges `env(safe-area-inset-*)` posées, non essayées), aucune capture de Tower regardée en portrait paysage hors celles notées.
