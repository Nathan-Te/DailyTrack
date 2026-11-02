import { CATALOGUE_COMMUN, el, traducteur, type Langue } from "@cdj/ui";

// Lot F2 : la section « Les amis » de la vitrine `/ui/` (recette et aperçus seulement). Les composants sont chargés à la demande, comme dans les pages du portail ; les exemples sont des valeurs de démonstration
// (pseudos, références de douze hexadécimaux, temps), sans appel au serveur : chaque callback répond tout de suite.

/** Une référence de démonstration (12 hexadécimaux) et des pseudos qui ne sont à personne. */
const REF = "0123456789ab";
const AMIS = [
  { ref: "aaaaaaaaaaa1", pseudo: "Vitesse88", reciproque: true },
  { ref: "aaaaaaaaaaa2", pseudo: "Lilou_R", reciproque: true },
  { ref: "aaaaaaaaaaa3", pseudo: "Kraken42", reciproque: false },
];
const ok = async () => ({ ok: true as const });

/** La zone de la section, remplie quand les composants sont arrivés. */
export function remplirAmis(l: Langue, texte: (cle: string) => string): HTMLElement {
  const zone = el("div", { classe: "vitrine-amis", attrs: { "data-amis": l } });
  const titre = (contenu: string) => el("h3", { classe: "vitrine-sous-titre", texte: contenu });
  void Promise.all([import("@cdj/ui/src/amis"), import("@cdj/ui/src/catalogue.amis")]).then(([ui, c]) => {
    const ta = traducteur(l, CATALOGUE_COMMUN, c.CATALOGUE_AMIS);
    const fiche = (ami: boolean) => ({
      pseudo: "Kraken42",
      ami,
      reciproque: ami,
      rang: 8,
      classes: 412,
      jeux: [
        { nom: "Track", unite: "temps" as const, valeur: 40_112, medaille: "or" },
        { nom: "Jump", unite: "temps" as const, valeur: 61_838, medaille: "argent" },
        { nom: "Tower", unite: "hauteur" as const, valeur: null, medaille: null },
      ],
    });
    /** Une feuille dans l'état voulu (elle couvre l'écran : on la ferme pour voir la suivante). */
    const feuille = (cle: "chargement" | "fiche" | "ami" | "erreur") =>
      el("button", {
        classe: "dj-bouton dj-bouton--secondaire",
        attrs: { type: "button", "data-feuille": cle },
        texte: texte(`vitrine.amis.feuille.${cle}`),
      });
    const boutons = (["chargement", "fiche", "ami", "erreur"] as const).map((cle) => {
      const b = feuille(cle);
      b.addEventListener("click", () => {
        const f = ui.feuilleJoueur({ t: ta, pseudo: "Kraken42", onAjouter: ok, onRetirer: ok });
        if (cle === "fiche") f.afficher(fiche(false));
        else if (cle === "ami") f.afficher(fiche(true));
        else if (cle === "erreur") f.erreur("network", () => f.afficher(fiche(false)));
      });
      return b;
    });
    const selecteurs = (jeu: "track" | "jump" | "tower" | undefined) => ui.selecteurAmis({ t: ta, filtre: "amis", total: 412, amis: 6, onChange: () => undefined, jeu }).racine;
    zone.replaceChildren(
      titre(texte("vitrine.amis.selecteur")),
      el("div", { classe: "vitrine-ligne" }, ui.selecteurAmis({ t: ta, filtre: "tous", total: 412, amis: 6, onChange: () => undefined }).racine, ui.selecteurAmis({ t: ta, filtre: "tous", onChange: () => undefined }).racine),
      el("div", { classe: "vitrine-asphalte dj-sombre" }, selecteurs("track")),
      el("div", { classe: "vitrine-jaune" }, selecteurs("jump")),
      el("div", { classe: "vitrine-menthe" }, selecteurs("tower")),
      titre(texte("vitrine.amis.feuille")),
      el("div", { classe: "vitrine-ligne" }, ...boutons),
      titre(texte("vitrine.amis.liste")),
      ui.listeAmis({ t: ta, amis: AMIS, max: 100, onRetirer: ok, niveau: "h3" }).racine,
      titre(texte("vitrine.amis.ajout")),
      ui.formulaireAjoutAmi({ t: ta, onAjouter: ok, onSuggestions: async () => [{ ref: REF, pseudo: "Kraken42" }] }),
      ui.blocInvitation({ t: ta, active: false, creer: async () => ({ ok: true as const, lien: "https://playdujour.com/amis/?invitation=Zm9vYmFyYmF6cXV4MTIzNDU2" }) }),
      titre(texte("vitrine.amis.carte")),
      ui.carteInvitation({ t: ta, pseudo: "Nathan", demanderPseudo: true, onAccepter: ok }),
      ui.carteInvitation({ t: ta, pseudo: "Nathan", demanderPseudo: false, onAccepter: ok }),
      titre(texte("vitrine.amis.vide")),
      ui.classementAmisVide(ta, { href: "#" }),
    );
  });
  return zone;
}
