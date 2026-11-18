import { describe, expect, it } from "vitest";
import { atteint, manque, prochaineMedaille, seuilsAvant, seuilsDuServeur } from "../src/classementLogique";
import { CLE_RANGS, VISITE_MS, VUES_GARDEES_MAX, lireRangs, mouvementsDe, noterRangs, rangsVides } from "../src/classementRangs";

// Lot U6 : la logique pure du composant de classement — où poser les seuils des médailles, la médaille suivante, les places gagnées ou perdues.

const SEUILS = seuilsDuServeur({ author: 31_750, gold: 32_000, silver: 34_000, bronze: 38_500 })!;

describe("lot U6 : les seuils des médailles", () => {
  it("ceux du serveur (`author` = Diamant), du meilleur au moins bon ; sans seuils ou illisibles : null", () => {
    expect(SEUILS.map((s) => [s.type, s.valeur])).toEqual([["diamant", 31_750], ["or", 32_000], ["argent", 34_000], ["bronze", 38_500]]);
    expect(seuilsDuServeur(null)).toBeNull();
    expect(seuilsDuServeur({})).toBeNull();
    expect(seuilsDuServeur({ gold: "x", silver: Number.NaN })).toBeNull();
    expect(seuilsDuServeur({ bronze: 40_000, gold: 33_000 })!.map((s) => s.type)).toEqual(["or", "bronze"]);
  });
  it("atteint / manque : au temps le plus petit gagne, à la hauteur le plus grand", () => {
    expect(atteint(32_000, SEUILS[1]!, "petit")).toBe(true);
    expect(atteint(32_001, SEUILS[1]!, "petit")).toBe(false);
    expect(manque(32_147, SEUILS[1]!, "petit")).toBe(147);
    expect(manque(31_000, SEUILS[1]!, "petit")).toBe(0);
    const hauteur = seuilsDuServeur({ gold: 1000, bronze: 400 })!;
    expect(atteint(1000, hauteur[0]!, "grand")).toBe(true);
    expect(manque(900, hauteur[0]!, "grand")).toBe(100);
  });
  it("la prochaine médaille : le meilleur seuil pas encore atteint ; aucune s'ils le sont tous", () => {
    expect(prochaineMedaille(40_000, SEUILS, "petit")?.type).toBe("bronze");
    expect(prochaineMedaille(36_000, SEUILS, "petit")?.type).toBe("argent");
    expect(prochaineMedaille(31_897, SEUILS, "petit")?.type).toBe("diamant");
    expect(prochaineMedaille(32_100, SEUILS, "petit")?.type).toBe("or"); // 32 100 a l'Argent, vise l'Or
    expect(prochaineMedaille(31_000, SEUILS, "petit")).toBeNull();
    expect(prochaineMedaille(40_000, null, "petit")).toBeNull();
  });
  it("une ligne de seuil sépare ceux qui ont la médaille de ceux qui la visent ; elle part de la médaille de la 3e place", () => {
    // 3e place : 31 717 (Diamant). La liste : 31 787 (Or), 31 831, 32 096 (Argent), 33 000, 36 000 (Bronze), 45 000 (rien).
    const valeurs = [31_787, 31_831, 32_096, 33_000, 36_000, 45_000];
    const a = seuilsAvant(valeurs, SEUILS, "petit", 31_717);
    expect([...a].map(([i, s]) => [i, s.map((x) => x.type)])).toEqual([[0, ["diamant"]], [2, ["or"]], [4, ["argent"]], [5, ["bronze"]]]);
  });
  it("sans seuils, sans 3e place ou si la 3e n'a aucune médaille : aucune ligne ; un seuil que personne n'a dépassé n'est jamais écrit", () => {
    expect(seuilsAvant([31_787], null, "petit", 31_717).size).toBe(0);
    expect(seuilsAvant([31_787], SEUILS, "petit", null).size).toBe(0);
    expect(seuilsAvant([50_000], SEUILS, "petit", 45_000).size).toBe(0);
    expect(seuilsAvant([31_787, 31_900], SEUILS, "petit", 31_717).size).toBe(1); // seul « Diamant » est dépassé ; Or, Argent, Bronze : personne en dessous
    expect(seuilsAvant([null, 31_787], SEUILS, "petit", 31_717).get(1)?.[0]?.type).toBe("diamant"); // une ligne sans résultat ne déclenche rien
  });
  it("à la hauteur (le plus grand gagne), les seuils se posent à l'envers", () => {
    const s = seuilsDuServeur({ gold: 1000, silver: 700, bronze: 400 })!;
    const a = seuilsAvant([950, 720, 500, 100], s, "grand", 1100);
    expect([...a].map(([i, x]) => [i, x.map((y) => y.type)])).toEqual([[0, ["or"]], [1, []], [2, ["argent"]], [3, ["bronze"]]].filter(([, x]) => (x as string[]).length > 0));
  });
});

describe("lot U6 : les places gagnées ou perdues depuis la dernière visite", () => {
  const T0 = Date.UTC(2026, 10, 18, 9, 0, 0);
  const cle = "2026-11-18|cumul|tous";
  it("première visite : rien à comparer ; la visite suivante (plus de 30 min après) compare à la première", () => {
    let etat = noterRangs(rangsVides(), cle, { a: 1, b: 2, c: 3 }, T0);
    expect(mouvementsDe(etat, cle).size).toBe(0);
    etat = noterRangs(etat, cle, { b: 1, a: 2, c: 3, d: 4 }, T0 + VISITE_MS + 1);
    expect([...mouvementsDe(etat, cle)]).toEqual([["b", 1], ["a", -1]]); // c n'a pas bougé, d n'était pas là
  });
  it("pendant la même visite (relue moins de 30 min après), la visite d'avant ne change pas", () => {
    let etat = noterRangs(rangsVides(), cle, { a: 1, b: 2 }, T0);
    etat = noterRangs(etat, cle, { b: 1, a: 2 }, T0 + VISITE_MS + 1); // nouvelle visite
    expect([...mouvementsDe(etat, cle)]).toEqual([["b", 1], ["a", -1]]);
    etat = noterRangs(etat, cle, { b: 1, a: 2 }, T0 + VISITE_MS + 60_000); // la page se redessine
    expect([...mouvementsDe(etat, cle)]).toEqual([["b", 1], ["a", -1]]);
    etat = noterRangs(etat, cle, { a: 1, b: 2 }, T0 + VISITE_MS + 120_000); // un autre changement, même visite : toujours comparé à l'avant
    expect(mouvementsDe(etat, cle).size).toBe(0);
  });
  it("par jour, par vue et par filtre : chaque classement a sa mémoire ; au plus 10 gardés (les plus récents)", () => {
    let etat = rangsVides();
    for (let i = 0; i < VUES_GARDEES_MAX + 3; i++) etat = noterRangs(etat, `j${i}|cumul|tous`, { a: 1 }, T0 + i);
    expect(Object.keys(etat.vues)).toHaveLength(VUES_GARDEES_MAX);
    expect(etat.vues["j0|cumul|tous"]).toBeUndefined();
    expect(etat.vues[`j${VUES_GARDEES_MAX + 2}|cumul|tous`]).toBeDefined();
    expect(mouvementsDe(etat, "autre|vue|tous").size).toBe(0);
  });
  it("ce qu'un navigateur garde se relit ; une valeur illisible ou étrangère est ignorée (on repart de rien)", () => {
    const etat = noterRangs(rangsVides(), cle, { a: 1 }, T0);
    expect(lireRangs(JSON.stringify(etat))).toEqual(etat);
    for (const brut of [null, "", "pas du json", "[]", '{"v":2,"vues":{}}', '{"v":1,"vues":null}']) expect(lireRangs(brut)).toEqual(rangsVides());
    const abime = lireRangs(JSON.stringify({ v: 1, vues: { x: { at: 5, avant: { a: "un", b: 2.5, c: 3 }, courant: { a: -1 } }, y: { at: "non" } } }));
    expect(abime.vues.x).toEqual({ at: 5, avant: { c: 3 }, courant: {} });
    expect(abime.vues.y).toBeUndefined();
  });
  it("la clé du navigateur est une donnée de jeu (préfixe cdj:), jamais un réglage gardé", () => {
    expect(CLE_RANGS).toBe("cdj:classement:rangs");
  });
});
