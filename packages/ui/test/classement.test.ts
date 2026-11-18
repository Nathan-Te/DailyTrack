import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE_CLASSEMENT } from "../src/catalogue.classement";
import { ligne, podium, type PlaceClassement } from "../src/classement";
import { listeAvecSeuils, seuil } from "../src/seuils";
import { mouvement } from "../src/mouvement";
import { traducteur } from "../src/i18n";
import { installerFauxDom, type FauxDocument, type FauxElement } from "./fauxDom";

// Lot U6 : le composant de classement — le podium (toujours trois marches), la liste, les seuils, « Ta course » — sur le faux DOM de test. Un pseudo venu du serveur reste du texte, jamais du HTML.

let doc: FauxDocument;
beforeEach(() => {
  doc = installerFauxDom(vi);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
const faux = <T>(x: T) => x as unknown as FauxElement;
const fr = traducteur("fr", CATALOGUE_CLASSEMENT);
const en = traducteur("en", CATALOGUE_CLASSEMENT);

const place = (rang: number, o: Partial<PlaceClassement> = {}): PlaceClassement => ({
  rang,
  rangLu: rang === 1 ? "1er" : `${rang}e`,
  nom: `J${rang}`,
  visuel: (taille) => faux(doc.createElement("span")).setAttribute("data-taille", taille) as never,
  valeur: `3${rang},000 s`,
  ecart: rang === 1 ? null : `+0,${rang}00`,
  moi: false,
  toi: null,
  ...o,
});
const avecVisuel = (rang: number, o: Partial<PlaceClassement> = {}) => {
  const tailles: string[] = [];
  return { p: place(rang, { visuel: (t) => { tailles.push(t); return doc.createElement("span") as unknown as HTMLElement; }, ...o }), tailles };
};

describe("lot U6 : le podium", () => {
  it("trois places dans l'ordre du classement ; l'avance sous le 1er, « +0,x » sous les deux autres ; la couronne sur le premier seulement", () => {
    const p = faux(podium(fr, [place(1), place(2), place(3)], { avance: "0,185 s" }));
    expect(p.querySelectorAll("li")).toHaveLength(3);
    expect(p.querySelectorAll(".classement-place--libre")).toHaveLength(0);
    expect(p.querySelectorAll(".classement-ecart").map((e) => e.textContent)).toEqual(["0,185 s d'avance", "+0,200", "+0,300"]);
    expect(p.querySelectorAll(".classement-couronne")).toHaveLength(1);
    expect(p.querySelectorAll(".classement-marche").map((e) => e.textContent)).toEqual(["1", "2", "3"]);
    expect(p.getAttribute("role")).toBe("group");
  });
  it("trois tailles de visuel : le premier, les suivants (le composant ne dessine aucune photo : l'appelant le fait)", () => {
    const a = avecVisuel(1);
    const b = avecVisuel(2);
    const c = avecVisuel(3);
    podium(fr, [a.p, b.p, c.p]);
    expect([a.tailles, b.tailles, c.tailles]).toEqual([["premier"], ["suivant"], ["suivant"]]);
  });
  it("avec un ou deux classés, le podium est là : les marches sans personne sont libres, en `div` (la liste ne contient que de vrais classés)", () => {
    const deux = faux(podium(fr, [place(1), place(2)], { avance: "1,000 s" }));
    expect(deux.querySelectorAll("li")).toHaveLength(2);
    const libres = deux.querySelectorAll(".classement-place--libre");
    expect(libres).toHaveLength(1);
    expect(libres[0]!.tagName.toLowerCase()).toBe("div");
    expect(libres[0]!.textContent).toContain("Place à prendre");
    expect(libres[0]!.classList.contains("classement-place--3")).toBe(true);
    const vide = faux(podium(en, []));
    expect(vide.querySelectorAll("li")).toHaveLength(0);
    expect(vide.querySelectorAll(".classement-place--libre")).toHaveLength(3);
    expect(vide.textContent).toContain("Spot up for grabs");
    expect(vide.querySelectorAll(".classement-marche")).toHaveLength(3);
  });
  it("un podium de groupes : l'emblème est carré (la marche libre aussi), les trois photos des membres sous le nom", () => {
    const trio = [doc.createElement("i"), doc.createElement("i"), doc.createElement("i")] as unknown as HTMLElement[];
    const p = faux(podium(fr, [place(1, { trio, toi: "Ton groupe", moi: true })], { groupes: true }));
    expect(p.classList.contains("classement-podium--groupes")).toBe(true);
    expect(p.querySelectorAll(".classement-trio i")).toHaveLength(3);
    expect(p.querySelectorAll(".classement-libre__visuel--carre")).toHaveLength(2);
    expect(p.querySelectorAll(".classement-toi")[0]!.textContent).toBe("Ton groupe");
  });
  it("une place est un bouton (sa feuille) sauf la tienne, ou un lien (la page d'un groupe) ; la tienne est repérée", () => {
    let ouvert = 0;
    const p = faux(podium(fr, [place(1, { ouvrir: () => void ouvert++, repere: "abc" }), place(2, { moi: true, ouvrir: null }), place(3, { lien: "/groupe/Les%20Rapides" })]));
    const [un, deux, trois] = p.querySelectorAll("li");
    expect(un!.querySelectorAll("button")).toHaveLength(1);
    expect(un!.querySelectorAll("[data-cle=ligne-abc]")).toHaveLength(1);
    expect(deux!.querySelectorAll("button")).toHaveLength(0);
    expect(deux!.getAttribute("data-moi")).toBe("oui");
    expect(trois!.querySelectorAll("a")[0]!.getAttribute("href")).toBe("/groupe/Les%20Rapides");
  });
  it("un pseudo reste du texte : jamais du HTML", () => {
    const p = faux(podium(fr, [place(1, { nom: '<img src=x onerror="alert(1)">' })]));
    expect(p.querySelectorAll("img")).toHaveLength(0);
    expect(p.querySelectorAll(".classement-pseudo")[0]!.textContent).toContain("<img");
  });
});

describe("lot U6 : la liste", () => {
  it("le rang, le nom, le temps et l'écart au premier ; ta ligne est repérée ; une ligne sans résultat dit « pas fini » aux lecteurs d'écran", () => {
    const l = faux(ligne(fr, place(7, { moi: true, toi: "Toi", valeur: "35,000 s", ecart: "+3,354" }), { absent: "pas fini" }));
    expect(l.classList.contains("classement-ligne--moi")).toBe(true);
    expect(l.getAttribute("data-rang")).toBe("7");
    expect(l.querySelectorAll(".classement-rang")[0]!.textContent).toBe("7");
    expect(l.querySelectorAll(".classement-temps")[0]!.textContent).toBe("35,000 s");
    expect(l.querySelectorAll(".classement-ecart")[0]!.textContent).toBe("+3,354");
    const sans = faux(ligne(fr, place(9, { valeur: null, ecart: null }), { absent: "pas fini" }));
    expect(sans.querySelectorAll(".classement-ecart")).toHaveLength(0);
    expect(sans.querySelectorAll(".dj-cache")[0]!.textContent).toBe("pas fini");
  });
  it("les places gagnées (▲) et perdues (▼) à côté du rang, dites en toutes lettres aux lecteurs d'écran ; rien pour 0", () => {
    const monte = faux(mouvement(fr, 2)!);
    expect(monte.classList.contains("classement-mouvement--monte")).toBe(true);
    expect(monte.textContent).toContain("2 places gagnées depuis ta dernière visite");
    expect(faux(mouvement(fr, -1)!).textContent).toContain("1 place perdue depuis ta dernière visite");
    expect(faux(mouvement(en, 3)!).textContent).toContain("3 places gained since your last visit");
    expect(mouvement(fr, 0)).toBeNull();
    const l = faux(ligne(fr, place(5, { mouvement: mouvement(fr, -2) }), { absent: "" }));
    expect(l.querySelectorAll(".classement-mouvement--descend")).toHaveLength(1);
    // Le rang reste seul dans `.classement-rang` : le mouvement est à côté.
    expect(l.querySelectorAll(".classement-rang")[0]!.textContent).toBe("5");
  });
  it("un groupe : un détail sous le nom, une ligne pâle sans rang", () => {
    const l = faux(ligne(fr, place(0, { rangTexte: "–", pale: true, detail: "1 classé · encore 2 pour entrer", valeur: null }), { absent: "pas classé" }));
    expect(l.classList.contains("classement-ligne--pale")).toBe(true);
    expect(l.querySelectorAll(".classement-rang")[0]!.textContent).toBe("–");
    expect(l.querySelectorAll(".classement-detail")[0]!.textContent).toBe("1 classé · encore 2 pour entrer");
  });
  it("les seuils séparent des listes numérotées : le nombre de lignes reste celui des classés", () => {
    const lignes = [4, 5, 6, 7].map((r) => faux(ligne(fr, place(r), { absent: "" })) as unknown as HTMLElement);
    const sorties = listeAvecSeuils(lignes, new Map([[2, [seuil("or", "Or · 32,000 s")]]])).map(faux);
    expect(sorties.map((e) => e.tagName.toLowerCase())).toEqual(["ol", "p", "ol"]);
    expect(sorties[0]!.querySelectorAll("li")).toHaveLength(2);
    expect(sorties[2]!.getAttribute("start")).toBe("6");
    expect(sorties[1]!.textContent).toBe("Or · 32,000 s");
    expect(sorties[1]!.querySelectorAll(".classement-seuil__point--or")).toHaveLength(1);
    expect(listeAvecSeuils(lignes, new Map()).map(faux)).toHaveLength(1);
    expect(listeAvecSeuils([], new Map())).toEqual([]);
  });
});
