import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { CATALOGUE_COMMUN } from "../../../packages/ui/src/catalogue";
import { CATALOGUE_TRACK } from "../src/catalogue";
import { CATALOGUE_APERCU } from "../src/catalogue.apercu";
import { CATALOGUE_BASE } from "../src/catalogue.base";
import { fr as GARAGE_FR } from "../src/catalogue.base.garage.fr";
import { fr as FIGURES_FR } from "../src/catalogue.course.figures.fr";
import { fr as FANTOMES_FR } from "../src/catalogue.course.fantomes.fr";
import { fr as GLISSIERE_FR } from "../src/catalogue.reglages.glissiere";
import { fr as GYROSCOPE_FR } from "../src/catalogue.reglages.gyroscope";
import { fr as VOLANT_FR } from "../src/catalogue.reglages.volant";
import { chargerLangue, setLangue, t } from "../src/i18n";

// L'anglais est un fichier à part, chargé à la demande (i18n.ts) : on le charge avant les tests qui passent en anglais.
beforeAll(() => chargerLangue("en"));

// Lot I4 : le catalogue de DailyTrack (fr + en) couvre tout ce que le code et le HTML demandent. La parité (mêmes clés, mêmes paramètres, aucune valeur vide) et
// les chaînes en dur sont vérifiées par packages/ui/test ; ici : chaque clé écrite dans le code existe, et chaque clé du catalogue sert.
const SRC = join(__dirname, "../src");
const sources = readdirSync(SRC).filter((f) => f.endsWith(".ts") && !f.startsWith("catalogue"));
const code = sources.map((f) => readFileSync(join(SRC, f), "utf8")).join("\n") + readFileSync(join(__dirname, "../index.html"), "utf8");
// Lot I6 : les balises de partage de `index.html` lisent le catalogue de l'aperçu (construction seulement).
// Lot 41 : les textes du Garage sont chargés avec lui (`catalogue.base.garage.*.ts`, réunis à la zone « base » pour les tests).
const connues = new Set([...Object.keys(CATALOGUE_TRACK.fr), ...Object.keys(CATALOGUE_BASE.fr), ...Object.keys(CATALOGUE_COMMUN.fr), ...Object.keys(CATALOGUE_APERCU.fr), ...Object.keys(FIGURES_FR), ...Object.keys(FANTOMES_FR), ...Object.keys(GLISSIERE_FR), ...Object.keys(VOLANT_FR), ...Object.keys(GYROSCOPE_FR)]);
// Lot 49 : la page des nouvelles figures, chargée avec les scénarios (`catalogue.course.figures.*.ts`).

describe("catalogue de DailyTrack", () => {
  it("chaque clé appelée par t(\"…\"), lier(…), data-t existe, en français et en anglais", () => {
    const appelees = new Set<string>();
    for (const m of code.matchAll(/\bt\(\s*["'`]([a-zA-Z0-9_.]+)["'`]/g)) appelees.add(m[1]!);
    for (const m of code.matchAll(/\blier\([^,]+,\s*["'`]([a-zA-Z0-9_.]+)["'`]/g)) appelees.add(m[1]!);
    for (const m of code.matchAll(/data-t(?:-[a-z-]+)?="([a-zA-Z0-9_.]+)"/g)) appelees.add(m[1]!);
    expect(appelees.size).toBeGreaterThan(40);
    const manquantes = [...appelees].filter((k) => !connues.has(k));
    expect(manquantes).toEqual([]);
  });

  it("les clés construites (`theme.${…}`, `course.camera.${…}`…) ont toutes leurs valeurs", () => {
    const dynamiques = [...code.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g)].map((m) => m[1]!);
    expect(new Set(dynamiques).size).toBeGreaterThan(2);
    for (const prefixe of new Set(dynamiques)) expect([...connues].some((k) => k.startsWith(`${prefixe}.`)), `aucune clé « ${prefixe}.… »`).toBe(true);
  });

  it("lot 41 : les textes du Garage ne sont pas dans le premier chargement (ils viennent avec le Garage), et pas en double", () => {
    for (const cle of Object.keys(GARAGE_FR)) expect(CATALOGUE_TRACK.fr[cle], cle).toBeUndefined();
    expect(CATALOGUE_TRACK.fr["garage.ouvrir"]).toBe("Garage"); // le bouton, lui, est au premier écran
  });

  it("lot 55 : les textes du choix des fantômes ne sont pas dans le premier chargement (ils viennent avec lui), et pas en double", () => {
    for (const cle of Object.keys(FANTOMES_FR)) expect(CATALOGUE_TRACK.fr[cle], cle).toBeUndefined();
  });

  it("lot 52 : les textes de la glissière, du volant et du gyroscope ne sont pas dans le premier chargement (ils viennent avec leur mode), et pas en double", () => {
    for (const cle of [...Object.keys(GLISSIERE_FR), ...Object.keys(VOLANT_FR), ...Object.keys(GYROSCOPE_FR)]) expect(CATALOGUE_TRACK.fr[cle], cle).toBeUndefined();
    expect(new Set([...Object.keys(GLISSIERE_FR), ...Object.keys(VOLANT_FR), ...Object.keys(GYROSCOPE_FR)]).size).toBe(Object.keys(GLISSIERE_FR).length + Object.keys(VOLANT_FR).length + Object.keys(GYROSCOPE_FR).length);
    expect(CATALOGUE_TRACK.fr["tactile.indice.fleches"]).toBeTruthy(); // les boutons, mode par défaut : leur aide est au premier écran
  });

  it("les huit thèmes du jeu sont traduits (mêmes noms que le portail)", () => {
    for (const code of ["stade", "rallye", "banquise", "nuit", "campagne", "canyon", "col", "ville"]) {
      expect(CATALOGUE_TRACK.fr[`theme.${code}`], code).toBeTruthy();
      expect(CATALOGUE_TRACK.en[`theme.${code}`], code).toBeTruthy();
    }
  });

  it("le Salon s'appelle « Room » en anglais (décision de Nathan, lot I4), « Salon » en français", () => {
    const salon = Object.entries(CATALOGUE_TRACK.en).filter(([, v]) => typeof v === "string" && /\blounge\b/i.test(v));
    expect(salon).toEqual([]);
    expect(Object.values(CATALOGUE_TRACK.en).some((v) => typeof v === "string" && /\bRoom\b/.test(v))).toBe(true);
    expect(Object.values(CATALOGUE_TRACK.fr).some((v) => typeof v === "string" && /\bSalon\b/.test(v))).toBe(true);
  });

  it("t() suit la langue, rend la clé quand elle manque et remplit les paramètres et les pluriels", () => {
    setLangue("fr", { ecrire: false });
    expect(t("course.depart")).toBe("PARTEZ !");
    expect(t("archives.pilotes", { n: 1 })).toBe("1 pilote"); // lot I6 : « commun.pilote » (jamais lue) retirée
    expect(t("archives.pilotes", { n: 12 })).toBe("12 pilotes");
    expect(t("cle.inconnue")).toBe("cle.inconnue");
    setLangue("en", { ecrire: false });
    expect(t("course.depart")).toBe("GO!");
    expect(t("archives.pilotes", { n: 1 })).toBe("1 driver");
    expect(t("erreur.name_taken")).toMatch(/already/i); // le catalogue commun du socle
    setLangue("fr", { ecrire: false });
  });
});
