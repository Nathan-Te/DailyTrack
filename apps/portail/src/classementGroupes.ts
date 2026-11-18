import "./groupesPortail.css";
import { baseApi } from "./jour"; // la feuille est importée par les modules à la demande (jamais par une page d'entrée qui l'embarquerait dans le premier chargement de l'accueil)
import { adresseAvatar, type Langue } from "@cdj/profile";
import { adresseGroupe, clientGroupes, type ClassementGroupes } from "@cdj/profile/src/groupes";
import "@cdj/ui/src/tacourse.css";
import { avatar, el, formatNombre, formatRang, formatScore, traducteur } from "@cdj/ui";
import { CATALOGUE_TACOURSE } from "@cdj/ui/src/catalogue.tacourse";
import { course } from "@cdj/ui/src/tacourse";
import { initiales } from "@cdj/ui/src/avatar";
import { ligne, podium, type PlaceClassement, type TraducteurClassement } from "@cdj/ui/src/classement";
import { emblemeDeGroupe } from "./salle";
import { courseDesGroupes } from "./classementCourse";
import { ecritDuree, ecritEcart } from "./classementEcarts";
import { suivreLesRangs } from "./classementRangs";
import { formatDeVue } from "./formatDeVue";
import { CATALOGUE_COMMUN } from "@cdj/ui";
import { CATALOGUE_AMIS } from "@cdj/ui/src/catalogue.amis";

// Lot C1, partie C — le classement des **groupes** de `/classement/` (mode « Groupes », à côté de « Joueurs »), chargé **à la demande**. Une requête par jour et par vue (`GET /api/groupes/classement`) et, avec
// une identité, `GET /api/groupes/moi` pour surligner ton groupe. La moyenne des 3 meilleurs de chaque groupe ; les groupes de moins de 3 classés sont listés dessous, sans rang. Chaque nom mène à la page du
// groupe. Tout texte du serveur est posé en `textContent`.
// Lot U6 : **le même format que les joueurs** — le podium de trois marches (emblème carré, les trois photos des membres qui comptent, « Place à prendre » s'il y a moins de trois groupes classés), la liste avec l'écart au premier
// et les places gagnées, « Moins de 3 classés » dessous (« encore N pour entrer »), « Ta course » (ton groupe, ton temps compte-t-il) ; le panneau d'ordinateur est un petit podium. Le composant est celui de `@cdj/ui`.

export interface OptionsGroupes {
  tr: { langue: Langue; t: (cle: never, params?: never) => string };
  langue: Langue;
  base: string;
  id: string | null;
  date: string | null;
  vue: string;
  /** Un autre onglet a été choisi (la page met l'adresse à jour). */
  surVue(vue: string): void;
  /** Lot U6 : ton pseudo (pour dire si ton temps compte dans ton groupe) et le stockage du navigateur (les places gagnées ou perdues). */
  pseudo: string | null;
  stockage: Pick<Storage, "getItem" | "setItem"> | null;
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
const emblemeDe = (o: OptionsGroupes, g: { nom: string; avatar?: string }, taille: 22 | 48 | 52 | 72 | 92 | 112 = 48): HTMLElement => emblemeDeGroupe({ initiales: initiales(g.nom, o.langue), image: adresseAvatar(o.base, g.avatar), taille });

type LigneClasse = ClassementGroupes["groupes"][number];

/** Un groupe pour le composant commun (podium ou liste) : l'emblème carré à la taille demandée, le score, l'écart au premier, les trois photos des membres qui comptent, la page du groupe. */
function placeDeGroupe(o: OptionsGroupes, t: ReturnType<typeof dire>, g: LigneClasse, premier: LigneClasse | undefined, o2: { monId: string | null; valeur: (s: number) => string; format: "temps" | "hauteur" | "entier"; mouvements: Map<string, number>; taillesEmbleme: readonly [112 | 72, 92 | 52, 48] }): PlaceClassement {
  const moi = g.id === o2.monId;
  return {
    rang: g.rang,
    rangLu: formatRang(g.rang, o.langue),
    nom: g.nom,
    visuel: (taille) => emblemeDe(o, g, taille === "premier" ? o2.taillesEmbleme[0] : taille === "suivant" ? o2.taillesEmbleme[1] : o2.taillesEmbleme[2]),
    valeur: o2.valeur(g.score),
    ecart: !premier || g.rang === 1 ? null : g.score === premier.score ? null : ecritEcart(o2.format, Math.abs(g.score - premier.score), o.langue),
    moi,
    toi: moi ? t("classement.groupes.toi") : null,
    mouvement: o2.mouvements.get(g.id) ?? 0,
    lien: adresseGroupe("/", g.nom),
    repere: g.id,
    trio: (g.trio ?? []).map((m) => avatar(o.tr as never, { pseudo: m.pseudo, ref: m.ref, image: adresseAvatar(o.base, m.avatar), taille: 24, decoratif: true })),
    detail: t("classement.groupes.detail", { n: g.classes }),
  };
}

export async function monterGroupes(zone: HTMLElement, o: OptionsGroupes): Promise<void> {
  const t = dire(o);
  const tc = o.tr as unknown as TraducteurClassement;
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
  const format = formatDeVue(c.vue, c.sens);
  const valeur = (score: number): string => formatScore(format, score, o.langue);
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
  // Les places gagnées ou perdues depuis la dernière visite (par jour et par vue ; seulement sur un jour ouvert).
  const mouvements = suivreLesRangs(o.stockage, `groupes|${c.date}|${c.vue}`, Object.fromEntries(c.groupes.map((g) => [g.id, g.rang])), c.ouvert);
  const premier = c.groupes[0];
  const commun = { monId, valeur, format, mouvements, taillesEmbleme: [112, 92, 48] as const };
  const haut = c.groupes.slice(0, 3).map((g) => placeDeGroupe(o, t, g, premier, commun));
  const reste = c.groupes.slice(3).map((g) => ligne(tc, placeDeGroupe(o, t, g, premier, commun), { absent: t("classement.groupes.pasClasse") }));
  const avance = c.groupes[0] && c.groupes[1] && c.groupes[0].score !== c.groupes[1].score ? ecritDuree(format, Math.abs(c.groupes[1].score - c.groupes[0].score), o.langue) : null;
  // Moins de 3 classés : sans rang, en pointillés, « encore N pour entrer ».
  const moins = c.moins.map((g) =>
    ligne(
      tc,
      {
        rang: 0,
        rangLu: "",
        rangTexte: "–", // i18n-ok: le tiret des sans-rang
        nom: g.nom,
        visuel: () => emblemeDe(o, g, 48),
        valeur: null,
        ecart: null,
        moi: g.id === monId,
        toi: g.id === monId ? t("classement.groupes.toi") : null,
        lien: adresseGroupe("/", g.nom),
        repere: g.id,
        pale: g.id !== monId,
        detail: t("classement.groupes.encore", { n: g.classes, reste: Math.max(0, c.min - g.classes) }),
      },
      { absent: t("classement.groupes.pasClasse") },
    ),
  );
  const donnees = courseDesGroupes(c.groupes, { langue: o.langue, format, monGroupe: monId, pseudo: o.pseudo, vue: c.vue, nomDuJeu: c.vue === "cumul" ? null : nomDeVue(c.vue), rangLu: (n) => formatRang(n, o.langue), racine: "../" });
  zone.closest(".classement-page")?.classList.toggle("classement-page--course", donnees !== null);
  const enfants: (Node | null)[] = [
    onglets,
    el("p", { classe: "classement-egalite", texte: t("classement.groupes.regle", { min: c.min }) }),
    el("p", { classe: "classement-compte", attrs: { id: "groupes-compte" }, texte: t("classement.groupes.compte", { n: formatNombre(c.groupes.length, o.langue) }) }),
    el("div", { attrs: { id: "groupes-liste" } }, podium(tc, haut, { groupes: true, avance }), reste.length > 0 ? el("ol", { classe: "classement-liste" }, ...reste) : null),
    c.groupes.length === 0 ? el("p", { classe: "classement-vide", attrs: { id: "groupes-vide" }, texte: t("classement.groupes.vide") }) : null,
    moins.length
      ? el("section", { attrs: { "aria-labelledby": "groupes-moins-titre", id: "groupes-moins" } }, el("h2", { classe: "classement-separation groupes-moins", attrs: { id: "groupes-moins-titre" }, texte: t("groupePage.moins", { min: c.min }) }), el("ul", { classe: "classement-liste" }, ...moins))
      : null,
    donnees ? course(traducteur(o.langue, CATALOGUE_TACOURSE), donnees) : null,
  ];
  zone.replaceChildren(...enfants.filter((e): e is Node => e !== null));
}

/**
 * Lot U2, refait au lot U6 : le panneau « Groupes » de `/classement/` (à droite de la liste sur ordinateur, sous elle sur téléphone) — **un petit podium** des trois premiers groupes de la vue (emblème carré, trio des membres
 * qui comptent, avance du premier) et, si ton groupe est plus bas, sa ligne dessous ; « Tous les groupes » ouvre la vue complète (`?mode=groupes`). Même lecture que la vue « Groupes » (gardée 30 s) : le panneau ne coûte aucune
 * requête de plus quand on passe de l'une à l'autre.
 */
export async function monterPanneau(zone: HTMLElement, o: OptionsGroupes & { surTous(): void }): Promise<void> {
  const t = dire(o);
  const tc = o.tr as unknown as TraducteurClassement;
  const [r, moi] = await lire(o);
  if (!zone.isConnected) return;
  if (!r.ok) {
    zone.replaceChildren(el("p", { classe: "classement-etat", texte: t("portail.horsLigne") }));
    return;
  }
  const c = r.data;
  const monId = moi && moi.ok && moi.data ? moi.data.id : null;
  const format = formatDeVue(c.vue, c.sens);
  const valeur = (score: number): string => formatScore(format, score, o.langue);
  const mouvements = new Map<string, number>(); // le panneau ne montre pas les places gagnées : la vue complète les montre
  const premier = c.groupes[0];
  const commun = { monId, valeur, format, mouvements, taillesEmbleme: [72, 52, 48] as const };
  const haut = c.groupes.slice(0, 3);
  const mien = c.groupes.find((g) => g.id === monId);
  const avance = c.groupes[0] && c.groupes[1] && c.groupes[0].score !== c.groupes[1].score ? ecritDuree(format, Math.abs(c.groupes[1].score - c.groupes[0].score), o.langue) : null;
  const tous = el("button", { classe: "classement-groupes__tous", attrs: { type: "button", "data-cle": "groupes-tous" }, texte: t("classement.groupes.tous") });
  tous.addEventListener("click", o.surTous);
  const enfants: (Node | null)[] = [
    el("div", { attrs: { id: "classement-groupes-liste" } }, podium(tc, haut.map((g) => placeDeGroupe(o, t, g, premier, commun)), { groupes: true, petit: true, avance })),
    mien && !haut.includes(mien) ? el("ul", { classe: "classement-liste", attrs: { id: "classement-groupes-moi" } }, ligne(tc, placeDeGroupe(o, t, mien, premier, commun), { absent: t("classement.groupes.pasClasse") })) : null,
    c.groupes.length === 0 ? el("p", { classe: "classement-vide", texte: t("classement.groupes.vide") }) : null,
    el("p", { classe: "classement-egalite", texte: t("classement.groupes.regle", { min: c.min }) }),
    tous,
  ];
  zone.replaceChildren(...enfants.filter((e): e is Node => e !== null));
}
