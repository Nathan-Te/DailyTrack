import "@cdj/ui/src/seuils.css";

// Lot U6 — les seuils des médailles de `/classement/` (« Or · 32,000 s » entre ceux qui ont la médaille et ceux qui la visent), **chargés à la demande** : seules les vues par jeu en ont, le cumul ne paie rien. Le module, sa feuille
// et la logique (où poser chaque ligne) arrivent ensemble ; la page les demande dès qu'elle affiche une vue par jeu.
export { listeAvecSeuils, seuil } from "@cdj/ui/src/seuils";
export { seuilsAvant, seuilsDuServeur, type Seuil } from "@cdj/ui/src/classementLogique";
