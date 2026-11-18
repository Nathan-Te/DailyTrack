import "@cdj/ui/src/tacourse.css";
import { CATALOGUE_COMMUN, avatar, el, traducteur, type Langue } from "@cdj/ui";

// Lot U6 : la section « Classements » de la vitrine `/ui/` (recette et aperçus seulement) — le composant commun de `@cdj/ui/src/classement` dans tous ses états : podium plein, avec une marche libre, vide, sur crème et sur
// asphalte (`dj-sombre`), podium de groupes (emblèmes carrés et photos des membres), la liste avec écarts, places gagnées et seuils des médailles, « Ta course » (en trois formes). Chargé **à la demande**, comme le composant ;
// les exemples sont des valeurs de démonstration (pseudos, temps) sans appel au serveur.

const MOI = "Delta";
const JOUEURS = [
  { nom: "Biscotte", ref: "aaaaaaaaaaa1", ms: 31_646, mv: 2 },
  { nom: "Pépin", ref: "aaaaaaaaaaa2", ms: 31_685, mv: 0 },
  { nom: "Lenka", ref: "aaaaaaaaaaa3", ms: 31_717, mv: -1 },
  { nom: "Sacha", ref: "aaaaaaaaaaa4", ms: 31_787, mv: 0 },
  { nom: MOI, ref: "aaaaaaaaaaa5", ms: 31_897, mv: 1 },
  { nom: "Gaspard", ref: "aaaaaaaaaaa6", ms: 32_096, mv: -2 },
  { nom: "Marlou", ref: "aaaaaaaaaaa7", ms: 34_100, mv: 0 },
] as const;
const GROUPES = [
  { nom: "Les Tontons", sigle: "LT", ms: 30_977, membres: ["Biscotte", MOI, "Lenka"] },
  { nom: "Pause Café", sigle: "PC", ms: 31_683, membres: ["Gaspard", "Marlou", "Pépin"] },
  { nom: "Turbo", sigle: "TU", ms: 32_410, membres: ["Sacha", "Zadig", "Loupiote"] },
] as const;
const SEUILS = [
  { type: "diamant", ms: 31_750 },
  { type: "or", ms: 32_000 },
  { type: "argent", ms: 34_000 },
] as const;

export function remplirClassement(l: Langue, texte: (cle: string) => string): HTMLElement {
  const zone = el("div", { classe: "vitrine-classement", attrs: { "data-classement": l } });
  const titre = (contenu: string) => el("h3", { classe: "vitrine-sous-titre", texte: contenu });
  void Promise.all([import("@cdj/ui/src/classement"), import("@cdj/ui/src/catalogue.classement"), import("@cdj/ui/src/classementLogique"), import("@cdj/ui/src/formats"), import("@cdj/ui/src/tacourse"), import("@cdj/ui/src/catalogue.tacourse")]).then(([ui, c, logique, formats, tc, cc]) => {
    const t = traducteur(l, CATALOGUE_COMMUN, c.CATALOGUE_CLASSEMENT);
    const tt = traducteur(l, cc.CATALOGUE_TACOURSE);
    const temps = (ms: number): string => formats.formatTemps(ms, l);
    const ecart = (ms: number): string => `+${temps(ms).replace(/ s$/u, "")}`;
    const rang = (n: number): string => formats.formatRang(n, l);
    const place = (j: (typeof JOUEURS)[number], i: number, o: { liste?: boolean } = {}): import("@cdj/ui/src/classement").PlaceClassement => ({
      rang: i + 1,
      rangLu: rang(i + 1),
      nom: j.nom,
      visuel: (taille) => avatar(t, { pseudo: j.nom, ref: j.ref, taille: taille === "premier" ? 112 : taille === "suivant" ? 92 : 48, decoratif: true }),
      valeur: temps(j.ms),
      ecart: i === 0 ? null : ecart(j.ms - JOUEURS[0].ms),
      moi: j.nom === MOI,
      toi: j.nom === MOI ? texte("vitrine.classement.toi") : null,
      mouvement: o.liste ? j.mv : 0,
      ouvrir: null,
      repere: j.ref,
    });
    const joueurs = (n: number) => JOUEURS.slice(0, n).map((j, i) => place(j, i));
    const avance = temps(JOUEURS[1].ms - JOUEURS[0].ms);
    const podiumDe = (n: number) => ui.podium(t, joueurs(n), { avance: n > 1 ? avance : null });

    // Le podium : plein, avec une marche libre (deux classés), vide ; sur crème et sur asphalte.
    const etats = (sombre: boolean) =>
      el(
        "div",
        { classe: sombre ? "vitrine-asphalte dj-sombre" : "vitrine-creme-large" },
        el("div", { classe: "vitrine-classement__podiums" }, podiumDe(3), podiumDe(2), podiumDe(0)),
      );

    // La liste : écarts, places gagnées et perdues, ta ligne, les seuils des médailles.
    const reste = JOUEURS.slice(3);
    const lignes = reste.map((j, i) => ui.ligne(t, place(j, i + 3, { liste: true }), { absent: texte("vitrine.classement.pasFini") }));
    const avantSeuils = logique.seuilsAvant(
      reste.map((j) => j.ms),
      SEUILS.map((s) => ({ type: s.type, valeur: s.ms })),
      "petit",
      JOUEURS[2].ms,
    );
    const seuils = new Map([...avantSeuils].map(([i, s]) => [i, s.map((x) => ui.seuil(x.type, `${texte(`vitrine.classement.${x.type}`)} · ${temps(x.valeur)}`))]));
    const liste = (sombre: boolean) => el("div", { classe: sombre ? "vitrine-asphalte dj-sombre" : "vitrine-classement__liste" }, ...ui.listeAvecSeuils(lignes, seuils));

    // Les groupes : l'emblème carré, les trois photos des membres qui comptent.
    const emblemeDeGroupe = (g: (typeof GROUPES)[number], px: number): HTMLElement => el("span", { classe: "vitrine-classement__embleme", style: { width: `${px}px`, height: `${px}px` }, attrs: { "aria-hidden": "true" }, texte: g.sigle });
    const groupes = GROUPES.map((g, i): import("@cdj/ui/src/classement").PlaceClassement => ({
      rang: i + 1,
      rangLu: rang(i + 1),
      nom: g.nom,
      visuel: (taille) => emblemeDeGroupe(g, taille === "premier" ? 112 : taille === "suivant" ? 92 : 48),
      valeur: temps(g.ms),
      ecart: i === 0 ? null : ecart(g.ms - GROUPES[0].ms),
      moi: i === 0,
      toi: i === 0 ? texte("vitrine.classement.tonGroupe") : null,
      ouvrir: null,
      repere: g.nom,
      trio: g.membres.map((m) => avatar(t, { pseudo: m, ref: JOUEURS.find((j) => j.nom === m)?.ref, taille: 24, decoratif: true })),
    }));
    const groupesPodium = ui.podium(t, groupes, { groupes: true, avance: temps(GROUPES[1].ms - GROUPES[0].ms) });
    const groupesPodiumDeux = ui.podium(t, groupes.slice(0, 2), { groupes: true, avance: temps(GROUPES[1].ms - GROUPES[0].ms) });

    // « Ta course » : derrière un joueur, premier, et la seconde ligne d'une vue par jeu.
    const courses = [
      tc.course(tt, { rangLu: rang(5), phrase: { type: "doubler", ecart: temps(110), nom: "Sacha" }, sous: { type: "perte", nom: "Sacha", ecart: temps(147), jeu: "Track" }, bouton: { href: "#", jeu: "Track" } }),
      tc.course(tt, { rangLu: rang(2), phrase: { type: "premier", ecart: temps(39) }, sous: { type: "medaille", medaille: texte("vitrine.classement.or"), ecart: temps(147) }, bouton: { href: "#", jeu: "Track" } }),
      tc.course(tt, { rangLu: rang(1), phrase: { type: "avance", ecart: temps(39), nom: "Pépin" }, sous: null, bouton: { href: "#", jeu: "Track" } }),
      tc.course(tt, { rangLu: rang(1), phrase: { type: "avance", ecart: temps(706), nom: "Pause Café" }, sous: { type: "groupeCompte", rangLu: rang(2) }, bouton: { href: "#", jeu: null } }),
    ];
    const coursesSombres = el("div", { classe: "vitrine-asphalte dj-sombre" }, ...courses.slice(0, 2).map((x) => x.cloneNode(true) as HTMLElement));

    zone.replaceChildren(
      titre(texte("vitrine.classement.podium")),
      etats(false),
      etats(true),
      titre(texte("vitrine.classement.liste")),
      liste(false),
      liste(true),
      titre(texte("vitrine.classement.groupes")),
      el("div", { classe: "vitrine-classement__podiums" }, groupesPodium, groupesPodiumDeux),
      titre(texte("vitrine.classement.course")),
      el("div", { classe: "vitrine-classement__courses" }, ...courses),
      coursesSombres,
    );
  });
  return zone;
}
