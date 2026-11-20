// Lot O1 (plateforme, organisation) — `npm run tableau` : le tableau de bord du dépôt, `docs/tableau.md`. Rien ne se saisit à la main.
//
//   node scripts/tableau.mjs              → écrit docs/tableau.md et docs/tableau-dates.json (à lancer en fin de lot, après la passation)
//   node scripts/tableau.mjs --verifier   → échoue (sortie 1) si l'un des deux n'est pas à jour ; n'écrit rien
//
// Une ligne par jeu des fiches (`config/jeux/*.json`) et une ligne « Plateforme » : nom, catégorie, état de la fiche, premier jour, identité (règle K5),
// dernier lot (`docs/<jeu>/lots/`), et — lus dans la passation du jeu (`docs/<jeu>/passation.md`) — « Où on en est », « Prochain lot » et « Décisions en attente ».
// L'état de la production et de la recette (`off`, `preview`, `on`) n'est PAS dans le dépôt : le tableau renvoie au panneau `/admin/` › Jeux.
//
// **D'où viennent les dates.** Un README de lot ne porte pas de date, et git ne peut pas la donner à un test (clone peu profond, commit du lot pas encore fait) :
// `docs/tableau-dates.json` garde donc, pour chaque README de lot, le jour où `npm run tableau` l'a vu pour la première fois (= le jour du lot, puisque le lot le lance
// avant de s'arrêter), et, pour chaque passation, l'empreinte de ses trois sections finales et le jour où elle a changé. Les entrées de départ (lot O1) viennent
// de l'historique git. Le fichier est produit par la commande, jamais à la main ; un conflit dessus ou sur `docs/tableau.md` se résout en relançant `npm run tableau`.
// **Avertissement « lots depuis »** : des lots dont le jour est postérieur à celui de la dernière mise à jour de la passation.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const FICHIER_TABLEAU = "docs/tableau.md";
export const FICHIER_DATES = "docs/tableau-dates.json";

/** Les trois sections finales de toute passation, dans cet ordre (titres fixes : le script les lit). */
export const TITRES_PASSATION = ["Où on en est", "Prochain lot", "Décisions en attente"];
/** « Où on en est » : 5 lignes au plus. */
export const LIGNES_MAX_OU_ON_EN_EST = 5;
/** La phrase des sections qu'une conversation n'a pas encore tenues (le générateur et la reprise des passations existantes l'écrivent). */
export const A_COMPLETER = "à compléter par la conversation du jeu";

/** Les lignes du tableau en plus des jeux : la plateforme n'a pas de fiche. */
export const PLATEFORME = { id: "plateforme", nom: "Plateforme", categorie: "—" };
/** Où vivent les README des lots d'une zone, quand ce n'est pas `docs/<id>/lots` (Track est le premier jeu : ses lots sont à la racine de `docs/lots`). */
const DOSSIERS_DE_LOTS = { track: "docs/lots", plateforme: "docs/plateforme/lots" };
export const dossierDesLots = (id) => DOSSIERS_DE_LOTS[id] ?? `docs/${id}/lots`;
export const cheminPassation = (id) => (id === "plateforme" ? "docs/plateforme/passation.md" : `docs/${id}/passation.md`);

const A_CHOISIR = "à choisir"; // `A_CHOISIR` de packages/core/src/fiche.ts (ce script n'importe aucun paquet)

// --- Lecture d'une passation -------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Les sections `## …` d'un texte Markdown : `[{ titre, corps }]` (le corps sans ses lignes vides de tête et de queue). */
export function sections(texte) {
  const resultat = [];
  let courante = null;
  let dansCode = false;
  for (const ligne of texte.replace(/\r\n/g, "\n").split("\n")) {
    if (/^```/.test(ligne)) dansCode = !dansCode;
    const m = dansCode ? null : /^##\s+(.+?)\s*$/.exec(ligne);
    if (m) {
      courante = { titre: m[1], lignes: [] };
      resultat.push(courante);
    } else if (courante) courante.lignes.push(ligne);
  }
  return resultat.map((s) => ({ titre: s.titre, corps: s.lignes.join("\n").trim() }));
}

/**
 * Ce que le tableau lit dans une passation : `{ ouOnEnEst: string[], prochainLot: string, decisions: string[] | "aucune", problemes: string[], empreinte }`.
 * `problemes` dit ce qui manque ou déborde (les trois titres, dans l'ordre et en dernier ; 5 lignes au plus ; une ligne ; une liste ou « aucune »).
 */
export function lirePassation(texte) {
  const toutes = sections(texte);
  const problemes = [];
  const fin = toutes.slice(-TITRES_PASSATION.length);
  const bonsTitres = fin.length === TITRES_PASSATION.length && fin.every((s, i) => s.titre === TITRES_PASSATION[i]);
  if (!bonsTitres) problemes.push(`la passation doit se terminer par les sections « ${TITRES_PASSATION.join(" », « ")} » (titres exacts, dans cet ordre)`);
  const corps = (titre) => toutes.find((s) => s.titre === titre)?.corps ?? "";
  const lignes = (c) => c.split("\n").map((l) => l.trim()).filter(Boolean);
  const nettoyer = (l) => l.replace(/^[-*]\s+/, "");

  const ouOnEnEst = lignes(corps(TITRES_PASSATION[0])).map(nettoyer);
  if (bonsTitres && ouOnEnEst.length === 0) problemes.push("« Où on en est » est vide");
  if (ouOnEnEst.length > LIGNES_MAX_OU_ON_EN_EST) problemes.push(`« Où on en est » : ${ouOnEnEst.length} lignes (${LIGNES_MAX_OU_ON_EN_EST} au plus)`);

  const prochain = lignes(corps(TITRES_PASSATION[1])).map(nettoyer);
  if (bonsTitres && prochain.length !== 1) problemes.push(`« Prochain lot » : ${prochain.length} lignes (une seule)`);

  const brutes = lignes(corps(TITRES_PASSATION[2]));
  const decisions = brutes.length === 1 && /^aucune\.?$/i.test(nettoyer(brutes[0])) ? "aucune" : brutes.map(nettoyer);
  if (bonsTitres && decisions !== "aucune") {
    if (decisions.length === 0) problemes.push("« Décisions en attente » est vide (une liste, ou « aucune »)");
    else if (!brutes.every((l) => /^[-*]\s+/.test(l))) problemes.push("« Décisions en attente » : une liste à puces, ou « aucune » seul");
  }
  const empreinte = createHash("sha256").update(fin.map((s) => `${s.titre}\n${s.corps}`).join("\n\n")).digest("hex").slice(0, 12);
  return { ouOnEnEst, prochainLot: prochain[0] ?? "", decisions, problemes, empreinte };
}

// --- Lecture du dépôt --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Les fiches des jeux, dans l'ordre de leur champ `ordre` : `[{ id, nom, categorie, etat, premierJour, temoin, identiteManque }]`. */
export function lireJeux(racine = RACINE) {
  const dossier = join(racine, "config/jeux");
  return readdirSync(dossier)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dossier, f), "utf8")))
    .sort((a, b) => a.ordre - b.ordre)
    .map((f) => ({
      id: f.id,
      nom: f.nom.fr,
      categorie: f.categorie,
      etat: f.etatDepart ?? "?",
      premierJour: f.premierJour ?? "?",
      temoin: Boolean(f.temoin),
      identiteManque: ["police", "motif", "illustration"].filter((k) => f.identite?.[k] === A_CHOISIR),
    }));
}

/** Les README de lots d'une zone (chemins du dépôt, triés), `docs/<…>/lots/lot-*.md` : les images, les sous-dossiers et les relevés de mesures (`V3-mesures.md`) n'en sont pas. */
export function lotsDe(id, racine = RACINE) {
  const dossier = dossierDesLots(id);
  if (!existsSync(join(racine, dossier))) return [];
  return readdirSync(join(racine, dossier), { withFileTypes: true })
    .filter((e) => e.isFile() && /^lot-.+\.md$/.test(e.name))
    .map((e) => `${dossier}/${e.name}`)
    .sort();
}

/** Tri « naturel » des noms de lots (`lot-9` avant `lot-10`, `BR2` avant `BR10`). */
const naturel = (a, b) => a.localeCompare(b, "fr", { numeric: true });

/** Le jour d'une entrée de dates (`AAAA-MM-JJ`). */
export const jourDe = (valeur) => String(valeur);

/** Le titre d'un lot (sa première ligne `# `, sans « Lot X — »), ou son nom de fichier. */
export function titreDuLot(chemin, racine = RACINE) {
  const nom = chemin.split("/").pop().replace(/\.md$/, "");
  const premiere = readFileSync(join(racine, chemin), "utf8").split("\n").find((l) => /^#\s+/.test(l));
  if (!premiere) return nom;
  return premiere.replace(/^#\s+/, "").replace(/^Lot\s+/i, "").replace(/\s+/g, " ").trim();
}

// --- Les dates -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Le jour d'aujourd'hui à Paris, `AAAA-MM-JJ`. */
export const aujourdhuiParis = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());

export function lireDates(racine = RACINE) {
  const chemin = join(racine, FICHIER_DATES);
  if (!existsSync(chemin)) return { lots: {}, passations: {} };
  const brut = JSON.parse(readFileSync(chemin, "utf8"));
  return { lots: brut.lots ?? {}, passations: brut.passations ?? {} };
}

/** Le fichier des dates, une entrée par ligne et par ordre alphabétique (deux lots qui ajoutent chacun une ligne ne se heurtent presque jamais). */
export function ecrireDates(dates) {
  const bloc = (objet) => {
    const cles = Object.keys(objet).sort();
    return cles.length ? `{\n${cles.map((c) => `    ${JSON.stringify(c)}: ${JSON.stringify(objet[c])}`).join(",\n")}\n  }` : "{}";
  };
  return `{\n  "lots": ${bloc(dates.lots)},\n  "passations": ${bloc(dates.passations)}\n}\n`;
}

// --- Le tableau ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const jjmm = (valeur) => {
  const [, m, j] = /^\d{4}-(\d{2})-(\d{2})$/.exec(jourDe(valeur)) ?? [];
  return j ? `${j}/${m}` : String(valeur);
};
const cellule = (texte) => String(texte).replace(/\|/g, "\\|").replace(/\n/g, " ");
const COUPE = 90;
const couper = (texte, n = COUPE) => (texte.length > n ? `${texte.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : texte);

/**
 * Calcule le tableau **et** le fichier des dates à partir du dépôt. `aujourdhui` date ce qui est nouveau (un lot jamais vu, une passation dont les sections ont changé).
 * Retourne `{ texte, dates, lignes }` ; `lignes` sert aux tests (une par zone, avec ses avertissements).
 */
export function calculer(racine = RACINE, aujourdhui = aujourdhuiParis()) {
  const anciennes = lireDates(racine);
  const dates = { lots: {}, passations: {} };
  const zones = [PLATEFORME, ...lireJeux(racine)];
  const lignes = [];

  for (const z of zones) {
    const lots = lotsDe(z.id, racine);
    for (const l of lots) dates.lots[l] = anciennes.lots[l] ?? aujourdhui;
    // Le dernier lot : le jour le plus récent ; à jour égal, le plus grand nom (tri naturel : `lot-GR7` après `lot-GR6`).
    const dernier = [...lots].sort((a, b) => jourDe(dates.lots[a]).localeCompare(jourDe(dates.lots[b])) || naturel(a, b)).pop() ?? null;

    const cheminP = cheminPassation(z.id);
    const passation = existsSync(join(racine, cheminP)) ? lirePassation(readFileSync(join(racine, cheminP), "utf8")) : null;
    let jourPassation = null;
    if (passation) {
      const avant = anciennes.passations[cheminP];
      jourPassation = avant && avant.empreinte === passation.empreinte ? avant.jour : aujourdhui;
      dates.passations[cheminP] = { empreinte: passation.empreinte, jour: jourPassation };
    }
    const depuis = passation ? lots.filter((l) => jourDe(dates.lots[l]) > jourPassation).sort(naturel) : [];
    lignes.push({ zone: z, lots, dernier, passation, cheminPassation: cheminP, jourPassation, depuis });
  }

    const sortie = [];
  sortie.push(
    "# Tableau de bord — où en est chaque jeu",
    "",
    "> **Produit par `npm run tableau`** — rien à saisir ici : tout est lu dans `config/jeux/` (fiches), `docs/<jeu>/lots/` (README des lots) et `docs/<jeu>/passation.md` (trois sections finales : « Où on en est », « Prochain lot », « Décisions en attente »). Tout lot met sa passation à jour, puis lance `npm run tableau` (`-- --verifier` : échoue si ce fichier n'est pas à jour). Règle : `CLAUDE.md`, « Règles communes à tous les lots ».",
    ">",
    "> **L'état de la production et de la recette (`off`, `preview`, `on`) n'est pas dans le dépôt** : il se lit dans le panneau d'administration, `/admin/` › Jeux. La colonne « Fiche » ne dit que l'état de départ de la fiche (`etatDepart`) ; ⚠ identité : règle K5 (ni `preview` ni `on`).",
    ">",
    "> **Dates des lots** : le jour où `npm run tableau` a vu le README pour la première fois (`docs/tableau-dates.json`). Les lots d'avant le lot O1 sont datés d'après l'historique de git.",
    "",
    "| Zone | Fiche | Dernier lot | Passation |",
    "|---|---|---|---|",
  );
  for (const l of lignes) {
    const z = l.zone;
    // Le tableau reste étroit (téléphone) : l'essentiel ici, le premier jour et l'identité complète dans la section du jeu ; une identité qui manque se voit tout de suite.
    const fiche = z.id === "plateforme" ? "—" : `${z.categorie} · \`${z.etat}\`${z.temoin ? " · témoin" : ""}${z.identiteManque.length ? " ⚠ identité" : ""}`;
    const dernier = l.dernier ? `${couper(titreDuLot(l.dernier, racine), 45)} (${jjmm(dates.lots[l.dernier])})` : "—";
    const p = !l.passation ? "aucune" : `${jjmm(l.jourPassation)}${l.passation.problemes.length ? " ⚠ sections" : ""}${l.depuis.length ? ` ⚠ ${l.depuis.length} lot${l.depuis.length > 1 ? "s" : ""} depuis` : ""}`;
    sortie.push(`| **${cellule(z.nom)}** | ${cellule(fiche)} | ${cellule(dernier)} | ${p} |`);
  }
  for (const l of lignes) {
    const z = l.zone;
    sortie.push("", `## ${z.nom}${z.id === "plateforme" ? "" : ` — ${z.categorie}`}`);
    if (z.id !== "plateforme") sortie.push(`- **Fiche** : état de départ \`${z.etat}\`, premier jour ${z.premierJour}${z.temoin ? ", jeu témoin (jamais en production)" : ""} ; ${z.identiteManque.length ? `**identité incomplète** : ${z.identiteManque.join(", ")} (règle K5 : ni \`preview\` ni \`on\`)` : "identité complète"}. Production et recette : \`/admin/\` › Jeux.`);
    sortie.push(`- **Dernier lot** : ${l.dernier ? `${couper(titreDuLot(l.dernier, racine), 120)} — ${jjmm(dates.lots[l.dernier])} (\`${l.dernier.split("/").pop()}\`)` : "aucun README de lot"}.`);
    if (!l.passation) {
      sortie.push(`- **Passation** : aucune (\`${l.cheminPassation}\`)${z.temoin ? " — jeu témoin, pas de conversation d'orchestration" : ""}.`);
      continue;
    }
    sortie.push(`- **Passation** : mise à jour le ${jjmm(l.jourPassation)} (\`${l.cheminPassation}\`).`);
    if (l.depuis.length) sortie.push(`- ⚠ **${l.depuis.length} lot${l.depuis.length > 1 ? "s" : ""} fusionné${l.depuis.length > 1 ? "s" : ""} depuis cette mise à jour** (le dernier : ${couper(titreDuLot(l.depuis[l.depuis.length - 1], racine), 80)}) : la passation est peut-être en retard.`);
    for (const p of l.passation.problemes) sortie.push(`- ⚠ ${p}.`);
    sortie.push("- **Où on en est** :", ...(l.passation.ouOnEnEst.length ? l.passation.ouOnEnEst.map((x) => `  - ${x}`) : ["  - (vide)"]));
    sortie.push(`- **Prochain lot** : ${l.passation.prochainLot || "(vide)"}`);
    sortie.push(`- **Décisions en attente (Nathan)** : ${l.passation.decisions === "aucune" ? "aucune." : ""}`);
    if (l.passation.decisions !== "aucune") sortie.push(...l.passation.decisions.map((x) => `  - ${x}`));
  }
  return { texte: `${sortie.join("\n")}\n`, dates, lignes };
}

/** Les écarts entre le dépôt et ce que `npm run tableau` écrirait (liste vide : tout est à jour). Rien n'est écrit. */
export function ecarts(racine = RACINE) {
  // Un jour impossible : tout ce qui serait nouveau (lot jamais vu, passation changée) diffère forcément du fichier des dates.
  const { texte, dates } = calculer(racine, "9999-12-31");
  const p = [];
  const lire = (f) => (existsSync(join(racine, f)) ? readFileSync(join(racine, f), "utf8") : null);
  if (lire(FICHIER_DATES) !== ecrireDates(dates)) p.push(`${FICHIER_DATES} n'est pas à jour (un lot ou une passation de plus, ou de moins)`);
  if (lire(FICHIER_TABLEAU) !== texte) p.push(`${FICHIER_TABLEAU} n'est pas à jour`);
  return p;
}

// --- La commande ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--verifier")) {
    const p = ecarts();
    if (p.length) {
      console.error(`${p.join("\n")}\nLance : npm run tableau (après avoir mis à jour la passation de ta zone).`);
      process.exit(1);
    }
    console.log("docs/tableau.md est à jour.");
  } else {
    const { texte, dates, lignes } = calculer();
    writeFileSync(join(RACINE, FICHIER_DATES), ecrireDates(dates));
    writeFileSync(join(RACINE, FICHIER_TABLEAU), texte);
    console.log(`${FICHIER_TABLEAU} écrit (${lignes.length} lignes).`);
    for (const l of lignes) for (const p of l.passation?.problemes ?? []) console.warn(`⚠ ${l.zone.nom} : ${p}`);
    for (const l of lignes) if (l.depuis.length) console.warn(`⚠ ${l.zone.nom} : ${l.depuis.length} lot(s) depuis la dernière mise à jour de la passation`);
  }
}
