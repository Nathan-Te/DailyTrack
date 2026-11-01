// Généré par `npm run phases:modules -w @cdj/jump-sim` (lot 15) à partir de `modules/phases.json` : ne pas modifier à la main.
// Un test vérifie que ce fichier est exactement celui que le script écrirait (sinon : « relancer phases:modules »).

/**
 * Lot 15 — **validation toutes phases** : les variantes (par morceau) dont une reprise à l'arrêt, à l'une des phases essayées de leur horloge,
 * n'a pas de solution jouable par un humain. Le générateur v4 ne les pose jamais (`daily.ts`) ; le détail est dans `modules/phases.json`.
 */
export const PHASE_REFUSED: Readonly<Record<string, readonly number[]>> = {"champignon-rafale":[5],"champignon-tourbillon":[2],"laser-cheminee":[5],"nuit-opposition":[4],"presse-couloir":[2,3],"presse-ilot":[2,3],"scie-sol":[3],"tapis-contraire":[0]};

/**
 * Lot 31 — **portion dure selon la pire phase** : les variantes (par morceau) dont la solution jouable est notée 4 ou 5 à au moins une des phases essayées de leur horloge. Le générateur g25
 * les traite comme les variantes notées 4 ou 5 par leur course de référence : voie lente posée, voies parasites examinées (`daily.ts`, `voies:modules`).
 */
export const PHASE_HARD: Readonly<Record<string, readonly number[]>> = {"balancier":[4],"chaland":[2,3,4],"champignon-rafale":[4],"champignon-tourbillon":[4],"cheminee-scie":[1,2,5,8,9],"chute-pics":[2],"descente-scies":[1],"escalier-scies":[1,4],"iles-scie":[3],"laser-alterne-balai":[3,6],"laser-alterne-portes":[1,2,5,6],"laser-balayage":[0,4,5],"laser-cheminee":[0,1,2,3,4,6,8],"laser-serre":[7,9],"nuit-cheminee":[3,6,7],"nuit-escalier":[1,3],"nuit-marelle":[4],"nuit-opposition":[2,6,8],"nuit-portes":[5],"nuit-relais":[0,3,5],"pendule":[6],"piliers-scie":[0,1,2,3,4,5],"plongeon":[4],"presse-couloir":[0,4,5,6],"presse-rythme":[3,4,7],"presse-tapis-contre":[1],"ressort-mur-iles":[2],"ressort-scie":[2],"scies-jumelles":[2],"tour-mobile":[0,2],"tunnel-rase":[2,5],"vent-relais":[1]};
