# Lot PA1b (plateforme, serveur, kit et portail) — Le jeu Party du jour

**État : fait** (la partie 2 du lot PA1). **« Pour les joueurs » : `rien`** (aucun jeu Party n'est ouvert : rien ne se voit).

## Décisions de Nathan (21/11) appliquées
Tour de rôle dans l'ordre des jeux Party `on` par date d'ouverture, en boucle ; record personnel sur l'appareil ; police `Lilita One` ; **motif `confettis`** (Pinball a les losanges : `fondDuMotif`, trois trames de pastilles à arrêt franc, aucune face de plus).

## Livré
- **Tour de rôle** (`@cdj/core/jeux` : `jeuPartyDuJour`, `ordreParty`, `prochainJourParty`, `debutDePeriode`, purs) : `jour mod N` sur les jeux Party qui **comptent ce jour-là** (périodes du lot P) — un jeu ouvert ou fermé en cours de journée compte dès le lendemain, le jeu du jour commencé ne bouge pas ; sans table, un jour passé se recalcule ; sans jeu `on`, pas de jeu du jour. En aperçu, tous les jeux Party du registre sont en lice.
- **Serveur** : `GET /api/jeux` et `GET /api/portail/jour` portent `party: { jeu, prochains }` (seulement si le registre a un jeu Party : bancs des autres jeux **inchangés**, vérifié) ; le classement d'un jeu Party porte `party: { classe, prochain }`. **Un autre jeu Party refuse l'envoi** par `not_party_of_the_day` (409, liste unique, doc, `erreur.*` fr + en), avant tout rejeu. Le classement du jour ne garde que le jeu du jour (onglet, vue, groupes).
- **Portail** : section « Party » sous l'arcade (jeu du jour en tête, « Classé aujourd'hui » ; les autres « Jeu libre · classé le <date> » ; absente sans jeu `on`) ; onglet du jeu du jour après l'arcade sous « Party » (aussi en mode Groupes).
- **Kit** : l'accueil d'un jeu Party dit son statut ; hors de son jour il est **libre** (jouable, jamais envoyé, record gardé dans `<id>:records`, affiché tous jours confondus). Tout est dans un morceau à la demande `party-` (préfixe ajouté à `A_LA_DEMANDE_PAR_DEFAUT`).
- **Mentions légales** (fr + en) : le record personnel d'un jeu Party. **Consignes** : `apps/api`, `apps/portail` (une ligne + renvoi), détail dans `docs/regles/api/un-jeu-party-lot-pa1.md`.

## Preuve
`apps/api/test/partyTourDeRole.test.ts` (SQLite et libSQL : alternance, refus, `party.classe`, ouverture en cours de journée, aperçu) ; **`jeu-fictif`** : `scripts/modele-fictif/partyessai.test.ts.modele` (écrit dans la copie) — `partyessai` classé le jour où il est en tête, refusé l'autre jour, horloge maîtrisée. Tests purs du tour de rôle (`packages/core/test/party.test.ts`) et du kit (`packages/kit/test/party.test.ts`).

## Mesures
`portail.premier` 44,16 Ko pour 47 (PA1 : 43,61) : **aucun relèvement**. **Budgets des jeux du kit** : le premier essai coûtait +1 063 o à Rush (marge de 5 o) ; `definitionDeParty` est passée dans le morceau `party` (elle quittait le premier chargement de tous les jeux) et ce morceau n'importe rien que le premier chargement utilise : `rush.jsCss` 45,96 Ko pour 46 (**marge de 40 o**, plus mince encore : le prochain changement du kit devra alléger avant d'ajouter).

## À savoir / décisions pour Nathan
- **Le scénario « 2 clics » ne se voit pas sur l'aperçu de cette PR** : le registre n'a **aucun jeu Party** (PA2, « Pile poil », le premier), donc ni section ni onglet. Ils sont prouvés par la CI (jeu fictif) ; à regarder sur l'aperçu de PA2.
- Hors ligne, un jeu Party tente l'envoi (statut inconnu) ; le serveur refuse au besoin (`not_party_of_the_day`, terminal : le record reste local).
- La prochaine date « classé le … » suppose que les jeux Party en lice restent ceux de demain.
- Marge de Track en jetons : +15 jetons (`npm run mesure-jetons`, 53 844 pour 54 000).
- **Vérifié en local** : `npm run verifier` (typage, unitaires SQLite et libSQL, e2e Chromium de tous les jeux, budgets) ; `node scripts/jeu-fictif.mjs` (0 échec sur 9 542 + 1 052 tests) ; `kit-bout-en-bout --jeux essaiparty` ; `npm run consignes`. **Non vérifié** : la CI de la PR (voir son résultat) et le rendu de la section « Party » à l'écran (aucune capture : aucun jeu Party à montrer).
