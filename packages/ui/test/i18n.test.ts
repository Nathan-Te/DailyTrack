import { describe, expect, it } from "vitest";
import { parametresDe, remplir, traducteur, type Catalogues } from "../src/i18n";

// Lot I1 : le moteur de traduction — clés, paramètres nommés, pluriels par Intl.PluralRules (paramètre `n`), nombres au format de la langue.
const fr = {
  "essai.titre": "Les jeux du jour",
  "essai.temps": "Meilleur temps : {temps}",
  "essai.morts": { one: "{n} mort", other: "{n} morts" },
  "essai.rang": "{rang} sur {total}",
} as const;
const en: Catalogues<typeof fr>["en"] = {
  "essai.titre": "Today's games",
  "essai.temps": "Best time: {temps}",
  "essai.morts": { one: "{n} death", other: "{n} deaths" },
  "essai.rang": "{rang} of {total}",
};
const CAT = { fr, en };

describe("moteur de traduction", () => {
  it("une clé, dans chaque langue", () => {
    expect(traducteur("fr", CAT).t("essai.titre")).toBe("Les jeux du jour");
    expect(traducteur("en", CAT).t("essai.titre")).toBe("Today's games");
    expect(traducteur("en", CAT).langue).toBe("en");
  });

  it("paramètres nommés ; un nombre est écrit au format de la langue ; un paramètre absent reste visible", () => {
    expect(traducteur("fr", CAT).t("essai.temps", { temps: "31,402 s" })).toBe("Meilleur temps : 31,402 s");
    expect(traducteur("fr", CAT).t("essai.rang", { rang: "14e", total: 1284 })).toBe("14e sur 1\u00a0284");
    expect(traducteur("en", CAT).t("essai.rang", { rang: "14th", total: 1284 })).toBe("14th of 1,284");
    expect(remplir("{a} et {b}", { a: "x" }, "fr")).toBe("x et {b}");
  });

  it("pluriels par Intl.PluralRules : 0 et 1 au singulier en français, seul 1 en anglais", () => {
    const t = traducteur("fr", CAT).t;
    expect([0, 1, 2, 37].map((n) => t("essai.morts", { n }))).toEqual(["0 mort", "1 mort", "2 morts", "37 morts"]);
    const u = traducteur("en", CAT).t;
    expect([0, 1, 2].map((n) => u("essai.morts", { n }))).toEqual(["0 deaths", "1 death", "2 deaths"]);
  });

  it("plusieurs catalogues : le premier qui a la clé gagne ; une clé absente rend la clé", () => {
    const autre = { fr: { "essai.titre": "Autre", "essai.seul": "Seul" }, en: { "essai.titre": "Other", "essai.seul": "Alone" } };
    const t = traducteur("fr", autre as never, CAT as never) as { t(k: string): string };
    expect(t.t("essai.titre")).toBe("Autre");
    expect(t.t("essai.temps")).toBe("Meilleur temps : {temps}");
    expect(t.t("essai.inconnue")).toBe("essai.inconnue");
  });

  it("paramètres d'une valeur, toutes formes confondues", () => {
    expect(parametresDe("{b} {a} {b}")).toEqual(["a", "b"]);
    expect(parametresDe({ one: "{n} mort", other: "{n} morts dont {x}" })).toEqual(["n", "x"]);
  });
});
