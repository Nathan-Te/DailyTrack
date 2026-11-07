import "./groupesPortail.css";
import { baseApi } from "./jour"; // la feuille est importée par les modules à la demande (jamais par une page d'entrée qui l'embarquerait dans le premier chargement de l'accueil)
import { adresseAvatar, type Langue } from "@cdj/profile";
import { adresseGroupe, clientGroupes, type ClassementGroupes } from "@cdj/profile/src/groupes";
import { el, formatNombre, formatScore } from "@cdj/ui";
import { initiales } from "@cdj/ui/src/avatar";
import { emblemeDeGroupe } from "./salle";
import { EMBLEME_GROUPE } from "./classementPodium";
import { formatDeVue } from "./formatDeVue";
import { CATALOGUE_COMMUN } from "@cdj/ui";
import { CATALOGUE_AMIS } from "@cdj/ui/src/catalogue.amis";

// Lot C1, partie C — le classement des **groupes** de `/classement/` (mode « Groupes », à côté de « Joueurs »), chargé **à la demande**. Une requête par jour et par vue (`GET /api/groupes/classement`) et, avec
// une identité, `GET /api/groupes/moi` pour surligner ton groupe. La moyenne des 3 meilleurs de chaque groupe ; les groupes de moins de 3 classés sont listés dessous, sans rang. Chaque nom mène à la page du
// groupe. Tout texte du serveur est posé en `textContent`.

export interface OptionsGroupes {
  tr: { langue: Langue; t: (cle: never, params?: never) => string };
  langue: Langue;
  base: string;
  id: string | null;
  date: string | null;
  vue: string;
  /** Un autre onglet a été choisi (la page met l'adresse à jour). */
  surVue(vue: string): void;
}

const dire = (o: OptionsGroupes) => (cle: string, params?: Record<string, string | number>): string => (o.tr.t as (c: string, p?: Record<string, string | number>) => string)(cle, params);

/** Une lecture des groupes (le classement du jour et de la vue, et ton groupe) gardée 30 s : la page se redessine souvent (chaque réponse, chaque sélecteur), les groupes ne sont demandés qu'une fois pour le panneau et la vue « Groupes ». */
const DUREE_GARDEE_MS = 30_000;
type Client = ReturnType<typeof clientGroupes>;
type LectureGroupes = [Awaited<ReturnType<Client["classement"]>>, Awaited<ReturnType<Client["moi"]>> | null];
const gardees = new Map<string, { jusque: number; lecture: Promise<LectureGroupes> }>();
function lire(o: OptionsGroupes) {
  const cle = `${o.base}|${o.id ?? ""}|${o.date ?? ""}|${o.vue}`;
  const deja = gardees.get(cle);
  if (deja && deja.jusque > Date.now()) return deja.lecture;
  const client = clientGroupes({ base: o.base || baseApi(), playerId: o.id });
  const lecture = Promise.all([client.classement(o.date ?? undefined, o.vue), o.id ? client.moi() : Promise.resolve(null)]);
  gardees.set(cle, { jusque: Date.now() + DUREE_GARDEE_MS, lecture });
  void lecture.then(([r]) => { if (!r.ok) gardees.delete(cle); }, () => gardees.delete(cle));
  return lecture;
}

/** L'emblème carré d'un groupe (charte § 9 : toujours carré, jamais rond) : son image, sinon les deux premières lettres de son nom. */
const emblemeDe = (o: OptionsGroupes, g: { nom: string; avatar?: string }, taille: 22 | 48 = EMBLEME_GROUPE): HTMLElement => emblemeDeGroupe({ initiales: initiales(g.nom, o.langue), image: adresseAvatar(o.base, g.avatar), taille });

export async function monterGroupes(zone: HTMLElement, o: OptionsGroupes): Promise<void> {
  const t = dire(o);
  zone.replaceChildren(el("p", { classe: "classement-etat", attrs: { role: "status", id: "groupes-etat" }, texte: t("classement.chargement") }));
  const [r, moi] = await lire(o);
  if (!zone.isConnected) return;
  if (!r.ok) {
    const cle = `erreur.${r.code}`;
    zone.replaceChildren(el("p", { classe: "classement-etat", attrs: { role: "alert", id: "groupes-etat" }, texte: cle in CATALOGUE_AMIS.fr ? t(cle) : t("portail.horsLigne") }));
    return;
  }
  const c: ClassementGroupes = r.data;
  const monId = moi && moi.ok && moi.data ? moi.data.id : null;
  const nomDeVue = (v: string): string => {
    if (v === "cumul") return t("classement.vue.cumul");
    const cle = `jeu.${v}.nom`; // le dossier d'un jeu est l'identifiant de sa fiche
    return cle in CATALOGUE_COMMUN.fr ? t(cle) : v;
  };
  const valeur = (score: number): string => formatScore(formatDeVue(c.vue, c.sens), score, o.langue);
  const onglets = el(
    "div",
    { classe: "groupes-bascule", attrs: { role: "radiogroup", "aria-label": t("classement.vues.aria"), id: "groupes-vues" } },
    ...c.vues.flatMap((v) => {
      const b = el("button", { classe: "dj-bouton dj-bouton--secondaire", attrs: { type: "button", role: "radio", "aria-checked": String(v === c.vue), id: `groupes-vue-${v}` }, texte: nomDeVue(v) });
      b.addEventListener("click", () => o.surVue(v));
      // Lot A3 : les jeux d'arcade viennent après un séparateur « Arcade ».
      const premierArcade = c.arcade?.[0] === v;
      return premierArcade ? [el("span", { classe: "classement-vues__sep", attrs: { role: "presentation" }, texte: t("classement.vues.arcade") }), b] : [b];
    }),
  );
  const lien = (g: { nom: string; id: string; avatar?: string }) =>
    el("a", { classe: "groupes-ligne__nom", attrs: { href: adresseGroupe("/", g.nom) }, texte: g.nom });
  const classes = c.groupes.map((g) =>
    el(
      "li",
      { classe: ["groupes-ligne", g.id === monId && "groupes-ligne--moi"], attrs: { "data-groupe": g.id } },
      el("span", { classe: "groupes-ligne__rang dj-chiffres", texte: String(g.rang) }),
      emblemeDe(o, g),
      lien(g),
      g.id === monId ? el("span", { classe: "classement-toi", texte: t("classement.groupes.toi") }) : null,
      el("span", { classe: "groupes-ligne__score", texte: valeur(g.score) }),
      el("span", { classe: "dj-cache", texte: t("classement.groupes.classes", { n: g.classes }) }),
    ),
  );
  const moins = c.moins.map((g) =>
    el("li", { classe: ["groupes-ligne", g.id === monId && "groupes-ligne--moi"], attrs: { "data-groupe": g.id } }, emblemeDe(o, g), lien(g), g.id === monId ? el("span", { classe: "classement-toi", texte: t("classement.groupes.toi") }) : null, el("span", { classe: "profil-aide", texte: t("classement.groupes.classes", { n: g.classes }) })),
  );
  const enfants: (Node | null)[] = [
    onglets,
    el("p", { classe: "classement-egalite", texte: t("classement.groupes.regle", { min: c.min }) }),
    el("p", { classe: "classement-compte", attrs: { id: "groupes-compte" }, texte: t("classement.groupes.compte", { n: formatNombre(c.groupes.length, o.langue) }) }),
    classes.length ? el("ol", { classe: "groupes-liste", attrs: { id: "groupes-liste" } }, ...classes) : el("p", { classe: "classement-vide", attrs: { id: "groupes-vide" }, texte: t("classement.groupes.vide") }),
    moins.length
      ? el("section", { attrs: { "aria-labelledby": "groupes-moins-titre", id: "groupes-moins" } }, el("h2", { classe: "classement-separation groupes-moins", attrs: { id: "groupes-moins-titre" }, texte: t("groupePage.moins", { min: c.min }) }), el("ul", { classe: "groupes-liste" }, ...moins))
      : null,
  ];
  zone.replaceChildren(...enfants.filter((e): e is Node => e !== null));
}

/**
 * Lot U2 : le panneau « Groupes » de `/classement/` (à droite de la liste sur ordinateur, sous elle sur téléphone) : les trois premiers groupes de la vue, leur emblème de 48 px, et ton groupe — en moutarde — s'il est plus bas ;
 * « Tous les groupes » ouvre la vue complète (`?mode=groupes`). Même lecture que la vue « Groupes » (gardée 30 s) : le panneau ne coûte aucune requête de plus quand on passe de l'une à l'autre.
 */
export async function monterPanneau(zone: HTMLElement, o: OptionsGroupes & { surTous(): void }): Promise<void> {
  const t = dire(o);
  const [r, moi] = await lire(o);
  if (!zone.isConnected) return;
  if (!r.ok) {
    zone.replaceChildren(el("p", { classe: "classement-etat", texte: t("portail.horsLigne") }));
    return;
  }
  const c = r.data;
  const monId = moi && moi.ok && moi.data ? moi.data.id : null;
  const valeur = (score: number): string => formatScore(formatDeVue(c.vue, c.sens), score, o.langue);
  const ligne = (g: (typeof c.groupes)[number]): HTMLElement =>
    el(
      "li",
      { classe: ["groupes-panneau__ligne", g.id === monId && "groupes-ligne--moi"], attrs: { "data-groupe": g.id } },
      el("span", { classe: "groupes-ligne__rang dj-chiffres", texte: String(g.rang) }),
      emblemeDe(o, g),
      el("span", { classe: "groupes-panneau__texte" }, el("a", { classe: "groupes-ligne__nom", attrs: { href: adresseGroupe("/", g.nom) }, texte: g.nom }), el("small", { texte: g.id === monId ? t("classement.groupes.toi") : t("classement.groupes.classes", { n: g.classes }) })),
      el("span", { classe: "groupes-ligne__score", texte: valeur(g.score) }),
    );
  const haut = c.groupes.slice(0, 3);
  const mien = c.groupes.find((g) => g.id === monId);
  const lignes = [...haut, ...(mien && !haut.includes(mien) ? [mien] : [])];
  const tous = el("button", { classe: "classement-groupes__tous", attrs: { type: "button", "data-cle": "groupes-tous" }, texte: t("classement.groupes.tous") });
  tous.addEventListener("click", o.surTous);
  zone.replaceChildren(
    ...(lignes.length > 0 ? [el("ol", { classe: "groupes-panneau", attrs: { id: "classement-groupes-liste" } }, ...lignes.map(ligne))] : [el("p", { classe: "classement-vide", texte: t("classement.groupes.vide") })]),
    el("p", { classe: "classement-egalite", texte: t("classement.groupes.regle", { min: c.min }) }),
    tous,
  );
}
