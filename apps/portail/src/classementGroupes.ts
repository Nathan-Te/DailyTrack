import "./groupesPortail.css";
import { baseApi } from "./jour"; // la feuille est importée par les modules à la demande (jamais par une page d'entrée qui l'embarquerait dans le premier chargement de l'accueil)
import { adresseAvatar, type Langue } from "@cdj/profile";
import { adresseGroupe, clientGroupes, type ClassementGroupes } from "@cdj/profile/src/groupes";
import { avatar, el, formatNombre, formatScore } from "@cdj/ui";
import { formatDeVue } from "./formatDeVue";
import { CATALOGUE_COMMUN } from "@cdj/ui";
import { CATALOGUE_AMIS } from "@cdj/ui/src/catalogue.amis";

// Lot C1, partie C — le classement des **groupes** de `/classement/` (mode « Groupes », à côté de « Joueurs »), chargé **à la demande**. Une requête par jour et par vue (`GET /api/groupes/classement`) et, avec
// une identité, `GET /api/groupes/moi` pour surligner ton groupe. La moyenne des 3 meilleurs de chaque groupe ; les groupes de moins de 3 classés sont listés dessous, sans rang. Chaque nom mène à la page du
// groupe. Tout texte du serveur est posé en `textContent`.

export interface OptionsGroupes {
  tr: Parameters<typeof avatar>[0] & { t: (cle: never, params?: never) => string };
  langue: Langue;
  base: string;
  id: string | null;
  date: string | null;
  vue: string;
  /** Un autre onglet a été choisi (la page met l'adresse à jour). */
  surVue(vue: string): void;
}

const dire = (o: OptionsGroupes) => (cle: string, params?: Record<string, string | number>): string => (o.tr.t as (c: string, p?: Record<string, string | number>) => string)(cle, params);

export async function monterGroupes(zone: HTMLElement, o: OptionsGroupes): Promise<void> {
  const t = dire(o);
  const client = clientGroupes({ base: o.base || baseApi(), playerId: o.id });
  zone.replaceChildren(el("p", { classe: "classement-etat", attrs: { role: "status", id: "groupes-etat" }, texte: t("classement.chargement") }));
  const [r, moi] = await Promise.all([client.classement(o.date ?? undefined, o.vue), o.id ? client.moi() : Promise.resolve(null)]);
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
      avatar(o.tr, { pseudo: g.nom, ref: g.id, image: adresseAvatar(o.base, g.avatar), taille: 24, decoratif: true }),
      lien(g),
      g.id === monId ? el("span", { classe: "classement-toi", texte: t("classement.groupes.toi") }) : null,
      el("span", { classe: "groupes-ligne__score", texte: valeur(g.score) }),
      el("span", { classe: "dj-cache", texte: t("classement.groupes.classes", { n: g.classes }) }),
    ),
  );
  const moins = c.moins.map((g) =>
    el("li", { classe: ["groupes-ligne", g.id === monId && "groupes-ligne--moi"], attrs: { "data-groupe": g.id } }, avatar(o.tr, { pseudo: g.nom, ref: g.id, image: adresseAvatar(o.base, g.avatar), taille: 24, decoratif: true }), lien(g), g.id === monId ? el("span", { classe: "classement-toi", texte: t("classement.groupes.toi") }) : null, el("span", { classe: "profil-aide", texte: t("classement.groupes.classes", { n: g.classes }) })),
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
