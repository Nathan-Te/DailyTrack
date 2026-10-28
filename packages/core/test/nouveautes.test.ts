import { describe, expect, it } from "vitest";
import {
  LIGNE_MAX,
  MESSAGE_MAX,
  contientLienOuHtml,
  lirePourLesJoueurs,
  messageActif,
  nettoyerMessage,
  nettoyerNouveaute,
  nettoyerTexte,
  problemesDeMessage,
  problemesDePublication,
  separerLangues,
  texteProbleme,
  zoneDeNom,
} from "../src/nouveautes";

// Lot N2 — la lecture de la section « Pour les joueurs » d'une PR, la validation d'une nouveauté et celle d'un message.

describe("lirePourLesJoueurs : la section d'une PR", () => {
  it("lit les lignes bien formées : zone, français, `//`, anglais", () => {
    const s = lirePourLesJoueurs("Résumé\n\n## Pour les joueurs\n- [Track] Le bouton caméra revient à l'écran sur téléphone. // The camera button is back on screen on phones.\n- [Du Jour] Une ligne // A line\n- [jump] Encore // More\n\n## Tests\nrien ici");
    expect(s.presente).toBe(true);
    expect(s.rien).toBe(false);
    expect(s.lignes).toEqual([
      { zone: "track", fr: "Le bouton caméra revient à l'écran sur téléphone.", en: "The camera button is back on screen on phones.", brut: "- [Track] Le bouton caméra revient à l'écran sur téléphone. // The camera button is back on screen on phones.", malformee: false },
      { zone: "dujour", fr: "Une ligne", en: "A line", brut: "- [Du Jour] Une ligne // A line", malformee: false },
      { zone: "jump", fr: "Encore", en: "More", brut: "- [jump] Encore // More", malformee: false },
    ]);
  });

  it("`rien` : rien ne se voit (casse, point, puce, accents du titre et commentaires du modèle ignorés)", () => {
    for (const corps of ["## Pour les joueurs\nrien", "## Pour les joueurs\n\n  Rien.  \n", "### pour les joueurs\n- rien", "## Pour les joueurs\n<!-- Une ligne par changement visible… ou `rien`. -->\n`rien`\n"]) {
      expect(lirePourLesJoueurs(corps), corps).toMatchObject({ presente: true, rien: true, lignes: [] });
    }
  });

  it("une ligne mal formée est gardée telle quelle, à retoucher : zone inconnue, rien après la zone, pas de puce", () => {
    const s = lirePourLesJoueurs("## Pour les joueurs\n- [Plateforme] Quelque chose // Something\n- [Track]\n- Sans zone du tout // x\nUne phrase libre\n- [Jump] Valide // Valid");
    expect(s.lignes.map((l) => [l.malformee, l.zone, l.brut])).toEqual([
      [true, null, "- [Plateforme] Quelque chose // Something"],
      [true, null, "- [Track]"],
      [true, null, "- Sans zone du tout // x"],
      [true, null, "Une phrase libre"],
      [false, "jump", "- [Jump] Valide // Valid"],
    ]);
    expect(s.lignes[0]!.fr).toBe("[Plateforme] Quelque chose // Something"); // montrée telle quelle
  });

  it("un anglais manquant n'est pas « mal formé » : la ligne est lue et bloquera la publication", () => {
    const l = lirePourLesJoueurs("## Pour les joueurs\n- [Track] Seulement en français").lignes[0]!;
    expect(l).toMatchObject({ zone: "track", fr: "Seulement en français", en: "", malformee: false });
  });

  it("une adresse n'est pas un séparateur ; le premier ` // ` coupe", () => {
    expect(separerLangues("Voir https://exemple.test/a // See https://exemple.test/b")).toEqual({ fr: "Voir https://exemple.test/a", en: "See https://exemple.test/b" });
    expect(separerLangues("a // b // c")).toEqual({ fr: "a", en: "b // c" });
    expect(separerLangues("sans séparateur")).toEqual({ fr: "sans séparateur", en: "" });
  });

  it("une PR sans la section n'est ni « rien » ni lue ; une section vide non plus", () => {
    expect(lirePourLesJoueurs("Rien d'autre ici")).toEqual({ presente: false, rien: false, lignes: [] });
    expect(lirePourLesJoueurs(null)).toEqual({ presente: false, rien: false, lignes: [] });
    expect(lirePourLesJoueurs("## Pour les joueurs\n\n## Suite")).toEqual({ presente: true, rien: false, lignes: [] });
  });

  it("le texte de GitHub n'est jamais interprété : une balise reste du texte, les retours à la ligne Windows sont lus", () => {
    const s = lirePourLesJoueurs("## Pour les joueurs\r\n- [Track] <img src=x onerror=alert(1)> // <b>x</b>\r\n");
    expect(s.lignes[0]).toMatchObject({ zone: "track", fr: "<img src=x onerror=alert(1)>", en: "<b>x</b>" });
  });

  it("les zones : accents, casse, noms longs", () => {
    expect([zoneDeNom("Du Jour"), zoneDeNom("DUJOUR"), zoneDeNom("Portail"), zoneDeNom("DailyTrack"), zoneDeNom("jump"), zoneDeNom("Autre")]).toEqual(["dujour", "dujour", "dujour", "track", "jump", null]);
  });
});

describe("une nouveauté : ce qui bloque la publication", () => {
  const bonne = nettoyerNouveaute({ titre: { fr: "Titre", en: "Title" }, date: "2026-10-27", lignes: [{ zone: "track", fr: "a", en: "b" }] });
  it("une nouveauté complète se publie", () => expect(problemesDePublication(bonne)).toEqual([]));
  it("« Anglais : n lignes pas encore traduites »", () => {
    const n = { ...bonne, lignes: [{ zone: "track" as const, fr: "a", en: "" }, { zone: "jump" as const, fr: "b", en: "" }, { zone: "dujour" as const, fr: "c", en: "d" }] };
    const p = problemesDePublication(n);
    expect(p).toEqual([{ code: "anglais", n: 2 }]);
    expect(texteProbleme(p[0]!)).toBe("Anglais : 2 lignes pas encore traduites");
    expect(texteProbleme({ code: "anglais", n: 1 })).toBe("Anglais : 1 ligne pas encore traduite");
  });
  it("titre, date, zone, ligne vide, longueur, aucune ligne", () => {
    expect(problemesDePublication({ ...bonne, titre: { fr: "", en: "" } })).toEqual([{ code: "titre_fr" }, { code: "titre_en" }]);
    expect(problemesDePublication({ ...bonne, date: "2026-02-30" })).toEqual([{ code: "date" }]);
    expect(problemesDePublication({ ...bonne, date: "demain" })).toEqual([{ code: "date" }]);
    expect(problemesDePublication({ ...bonne, lignes: [] })).toEqual([{ code: "sans_ligne" }]);
    expect(problemesDePublication({ ...bonne, lignes: [{ zone: null, fr: "x", en: "y" }] })).toEqual([{ code: "zone", n: 1 }]);
    expect(problemesDePublication({ ...bonne, lignes: [{ zone: "track", fr: "", en: "y" }] })).toEqual([{ code: "francais", n: 1 }]);
    expect(problemesDePublication({ ...bonne, lignes: [{ zone: "track", fr: "x".repeat(LIGNE_MAX + 1), en: "y" }] })).toEqual([{ code: "ligne_longue", n: 1 }]);
  });
  it("le serveur ne garde que du texte propre et des zones connues", () => {
    const n = nettoyerNouveaute({ titre: { fr: "  A\n\tB ", en: 4 }, date: " 2026-10-27 ", lignes: [{ zone: "x", fr: "\u0000a​b", en: "c" }, 12, null] });
    expect(n.titre).toEqual({ fr: "A B", en: "" });
    expect(n.date).toBe("2026-10-27");
    expect(n.lignes).toEqual([{ zone: null, fr: "a b", en: "c" }, { zone: null, fr: "", en: "" }, { zone: null, fr: "", en: "" }]);
    expect(nettoyerNouveaute(undefined)).toEqual({ titre: { fr: "", en: "" }, date: "", lignes: [] });
    expect(nettoyerTexte(5)).toBe("");
  });
});

describe("le message en direct : texte seul, 160 caractères, fin", () => {
  const maintenant = 1_000_000;
  const bon = nettoyerMessage({ fr: "Bonjour", en: "Hello", ou: ["portail", "jump", "ailleurs"], ton: "important", fin: maintenant + 3_600_000 });
  it("un message valide ; les endroits inconnus sont ignorés", () => {
    expect(bon.ou).toEqual(["portail", "jump"]);
    expect(problemesDeMessage(bon, maintenant)).toEqual([]);
  });
  it(`${MESSAGE_MAX} caractères au plus, un émoji compte pour un`, () => {
    expect(problemesDeMessage({ ...bon, fr: "a".repeat(MESSAGE_MAX) }, maintenant)).toEqual([]);
    expect(problemesDeMessage({ ...bon, fr: "a".repeat(MESSAGE_MAX - 1) + "😀" }, maintenant)).toEqual([]);
    expect(problemesDeMessage({ ...bon, fr: "a".repeat(MESSAGE_MAX + 1) }, maintenant)).toEqual([{ code: "long", langue: "fr" }]);
  });
  it("ni lien ni HTML", () => {
    for (const t of ["https://x.test", "http://x", "va sur www.test", "<b>x</b>", "a > b", "écris à moi@exemple.com", "exemple.fr", "mailto:a@b.c"]) expect(contientLienOuHtml(t), t).toBe(true);
    for (const t of ["Maintenance ce soir à 22 h.", "Le serveur redémarre… 3.5 minutes", "Vive Du Jour !"]) expect(contientLienOuHtml(t), t).toBe(false);
  });
  it("la fin : pas passée, pas à plus de 7 jours ; `messageActif` s'éteint à l'heure pile", () => {
    expect(problemesDeMessage({ ...bon, fin: maintenant }, maintenant)).toEqual([{ code: "fin_passee" }]);
    expect(problemesDeMessage({ ...bon, fin: Number.NaN }, maintenant)).toEqual([{ code: "fin_passee" }]);
    expect(problemesDeMessage({ ...bon, fin: maintenant + 8 * 86_400_000 }, maintenant)).toEqual([{ code: "fin_lointaine" }]);
    expect(messageActif({ fin: 10 }, 9)).not.toBeNull();
    expect(messageActif({ fin: 10 }, 10)).toBeNull();
    expect(messageActif(null, 0)).toBeNull();
  });
});
