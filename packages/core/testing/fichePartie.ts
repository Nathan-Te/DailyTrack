// Lot PA1 — une fiche Party pour les tests : celle du jeu témoin « Cibles », réduite à ce qu'un jeu Party garde (c'est aussi ce que `npm run nouveau-jeu --categorie party` écrit). Jamais versée au dépôt.
import { readFileSync } from "node:fs";
import { A_CHOISIR, MOTIF_PARTY, POLICE_PARTY } from "../src/fiche";

const RACINE = new URL("../../../", import.meta.url);

export function fichePartieDeTest(id = "fete"): Record<string, any> {
  const modele = JSON.parse(readFileSync(new URL("config/jeux/cibles.json", RACINE), "utf8"));
  const p = JSON.parse(JSON.stringify(modele).replaceAll("cibles", id));
  p.id = p.code = id;
  p.categorie = "party";
  delete p.categorieDepuis;
  delete p.jours;
  p.themes = [];
  p.nomsThemes = { fr: {}, en: {} };
  p.musique = { scenes: ["menu"] };
  p.etiquette.police = `"${POLICE_PARTY}", "Archivo", sans-serif`;
  p.identite = { police: POLICE_PARTY, motif: MOTIF_PARTY, illustration: A_CHOISIR, aujourdhui: false };
  p.etatDepart = "off";
  p.temoin = false;
  p.classement.cumul = false;
  p.ordre = 99;
  p.zoneNouveautes = id;
  return p;
}
