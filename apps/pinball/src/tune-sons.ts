import { THEMES_PINBALL, type ThemePinball } from "@cdj/pinball-sim";
import type { Sons } from "./sons";
import { Cliquetis, type Evenement, type NomSon } from "./sonsLogique";

// La table des sons de Pinball (`?debug&sons`, lot PBS1, jamais en production ; le fichier s’appelle `tune-sons` pour que son morceau suive le préfixe `tune-` des outils d’essai, que la mesure du budget ne compte jamais : un joueur ne le charge pas) : un panneau où chaque bouton joue un son, avec un bouton par thème pour les bumpers, des curseurs pour les sons continus (le roulement, le ressort,
// le trou noir) et une rafale de bumpers pour entendre le plafond de voix. **Les sons passent par le même chemin qu'en partie** (`Sons` : le volume des effets du kit, le mélange, le premier geste), donc ce qu'on entend ici est ce qu'on
// entendra en jouant. **À la demande** (chargé par la scène seulement avec `?debug&sons`) : les textes sont écrits ici, en français et en anglais, et ne pèsent rien dans les catalogues du premier chargement.
// **Un son de plus dans `sonsLogique.ts` = un exemple de plus ici** : `EXEMPLES` est typé par `NomSon`, le test et le compilateur refusent un son sans bouton.
export interface EtatTableSons {
  langue: "fr" | "en";
  sons: Sons;
  theme: ThemePinball;
}
export interface TableSons {
  detruire(): void;
}

interface Exemple {
  fr: string;
  en: string;
  e: Evenement;
}
const ex = (fr: string, en: string, e: Evenement): Exemple => ({ fr, en, e });
const bumpers = THEMES_PINBALL.map((t) => ex(`Bumper ${{ foire: "pomme d'amour", ocean: "bulle", espace: "planète", volcan: "braise" }[t]}`, `Bumper ${{ foire: "candy apple", ocean: "bubble", espace: "planet", volcan: "ember" }[t]}`, { son: "bumper", theme: t, rang: 0 }));

/** Un exemple au moins par son (le type l'impose : un son de `sonsLogique.ts` sans bouton ici ne compile pas). */
export const EXEMPLES: Readonly<Record<NomSon, readonly Exemple[]>> = {
  batteur: [
    ex("Batteur gauche : appui", "Left flipper: press", { son: "batteur", cote: "gauche", appui: true }),
    ex("Batteur droit : appui", "Right flipper: press", { son: "batteur", cote: "droite", appui: true }),
    ex("Batteur : relâche", "Flipper: release", { son: "batteur", cote: "gauche", appui: false }),
  ],
  lanceur: [ex("Lanceur : détente (pleine charge)", "Launcher: release (full charge)", { son: "lanceur", charge: 1000 }), ex("Lanceur : détente (demi-charge)", "Launcher: release (half charge)", { son: "lanceur", charge: 500 })],
  sling: [ex("Lance-pierre", "Slingshot", { son: "sling" })],
  bumper: bumpers,
  cible: [1, 2, 3].map((n) => ex(`Cible ${n}`, `Target ${n}`, { son: "cible", rang: n })),
  banque: [ex("Banque complète", "Bank complete", { son: "banque" })],
  spinner: [ex("Spinner : un clic", "Spinner: one click", { son: "spinner", spin: 12000 })],
  trou: [ex("Trou : aspiration", "Hole: suction", { son: "trou", phase: "aspire" }), ex("Trou : relance", "Hole: release", { son: "trou", phase: "relance" })],
  voie: [1, 2].map((n) => ex(`Couloir allumé (${n})`, `Lane lit (${n})`, { son: "voie", n })),
  voies: [ex("Trois couloirs : arpège", "Three lanes: arpeggio", { son: "voies" })],
  manege: [ex("Manège : un tour", "Carousel: one lap", { son: "manege" })],
  tourbillon: [ex("Tourbillon : prise", "Whirlpool: catch", { son: "tourbillon", phase: "prise" }), ex("Tourbillon : sortie", "Whirlpool: exit", { son: "tourbillon", phase: "sortie" })],
  portail: [ex("Portail", "Portal", { son: "portail" })],
  geyser: [ex("Geyser", "Geyser", { son: "geyser" })],
  coulee: [ex("Coulée", "Lava flow", { son: "coulee" })],
  rail: [ex("Rail : la bille est prise", "Rail: ball caught", { son: "rail" })],
  recul: [ex("Rail : la bille recule", "Rail: ball falls back", { son: "recul" })],
  rampe: [ex("Rampe réussie", "Ramp made", { son: "rampe" })],
  orbite: [ex("Orbite réussie", "Orbit made", { son: "orbite" })],
  combo: [2, 3, 5].map((n) => ex(`Combo ×${n}`, `Combo ×${n}`, { son: "combo", rang: n })),
  mult: [2, 3, 4, 5, 6].map((m) => ex(`Multiplicateur ×${m}`, `Multiplier ×${m}`, { son: "mult", mult: m, retard: 0 })),
  missionPas: [1, 2, 3].map((n) => ex(`Mission : pas ${n}`, `Mission: step ${n}`, { son: "missionPas", compteur: n })),
  mission: [ex("Mission réussie", "Mission complete", { son: "mission" })],
  verrouAllume: [ex("Verrou allumé", "Lock lit", { son: "verrouAllume" })],
  verrouillee: [1, 2].map((n) => ex(`Bille verrouillée (${n})`, `Ball locked (${n})`, { son: "verrouillee", n })),
  multibille: [ex("Départ de la multibille", "Multiball start", { son: "multibille" })],
  jackpot: [1, 2, 4, 8].map((n) => ex(`Jackpot n° ${n}`, `Jackpot #${n}`, { son: "jackpot", rang: n })),
  multibilleFin: [ex("Fin de la multibille", "Multiball end", { son: "multibilleFin" })],
  niveau: [2, 3, 5].map((n) => ex(`Mission niveau ${n}`, `Mission level ${n}`, { son: "niveau", n })),
  sauvee: [ex("Bille sauvée", "Ball saved", { son: "sauvee" })],
  perdue: [ex("Bille perdue", "Ball lost", { son: "perdue" })],
  fin: [ex("Fin de partie", "Game over", { son: "fin" })],
};

/** Les groupes du panneau (les titres ; les sons sont ceux d'`EXEMPLES`, dans l'ordre). */
const GROUPES: readonly { fr: string; en: string; sons: readonly NomSon[] }[] = [
  { fr: "La table", en: "The table", sons: ["batteur", "lanceur", "sling"] },
  { fr: "Les modules communs", en: "Common modules", sons: ["bumper", "cible", "banque", "spinner", "trou", "voie", "voies"] },
  { fr: "Les éléments des thèmes", en: "Theme elements", sons: ["manege", "tourbillon", "portail", "geyser", "coulee"] },
  { fr: "Les rails (lot PBG1)", en: "Rails (lot PBG1)", sons: ["rail", "recul", "rampe", "orbite", "combo"] },
  { fr: "La boucle (lot PBG2)", en: "The loop (lot PBG2)", sons: ["verrouAllume", "verrouillee", "multibille", "jackpot", "multibilleFin", "niveau"] },
  { fr: "Les moments", en: "Moments", sons: ["mult", "missionPas", "mission", "sauvee", "perdue", "fin"] },
];

const TEXTES = {
  fr: {
    ouvrir: "Table des sons",
    titre: "Table des sons",
    note: "Chaque bouton joue un son comme en partie (volume des effets des Réglages, plafond de voix). Le premier appui réveille le son.",
    continus: "Sons continus",
    roulement: "Roulement (vitesse de la bille, px/s)",
    ressort: "Ressort du lanceur (charge)",
    trouNoir: "Trou noir (proximité de la bille)",
    spinner: "Spinner qui tourne (le cliquetis ralentit)",
    rafale: "Rafale de bumpers (le plafond de voix)",
    fermer: "Fermer",
    dernier: "Derniers sons (joué · refusé)",
  },
  en: {
    ouvrir: "Sound table",
    titre: "Sound table",
    note: "Each button plays a sound as in a game (Settings effects volume, voice cap). The first press wakes the sound.",
    continus: "Continuous sounds",
    roulement: "Rolling (ball speed, px/s)",
    ressort: "Launcher spring (charge)",
    trouNoir: "Black hole (ball proximity)",
    spinner: "Spinning spinner (the clicks slow down)",
    rafale: "Bumper burst (the voice cap)",
    fermer: "Close",
    dernier: "Last sounds (played · refused)",
  },
};

const bouton = (texte: string, surClic: () => void): HTMLButtonElement => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = texte;
  Object.assign(b.style, { font: "inherit", padding: "4px 8px", minHeight: "32px", cursor: "pointer", textAlign: "left" });
  b.addEventListener("click", surClic);
  return b;
};

export function monterTableSons(hote: HTMLElement, e: EtatTableSons): TableSons {
  const T = TEXTES[e.langue];
  const racine = document.createElement("div");
  racine.className = "pinball-sons";
  Object.assign(racine.style, { position: "absolute", top: "6px", left: "6px", zIndex: "20", font: "12px/1.3 system-ui, sans-serif", color: "#fff6e0", maxHeight: "calc(100% - 12px)", display: "flex", flexDirection: "column", alignItems: "flex-start", pointerEvents: "none" });
  const panneau = document.createElement("div");
  panneau.hidden = true;
  Object.assign(panneau.style, { pointerEvents: "auto", background: "rgba(28,20,14,.94)", border: "2px solid #2A1E16", borderRadius: "8px", padding: "8px", width: "min(320px, calc(100vw - 24px))", overflowY: "auto", minHeight: "0" });
  const ouvrir = bouton(T.ouvrir, () => {
    panneau.hidden = false;
    ouvrir.hidden = true;
  });
  Object.assign(ouvrir.style, { pointerEvents: "auto" });
  const titre = document.createElement("strong");
  titre.textContent = T.titre;
  const note = document.createElement("div");
  note.textContent = T.note;
  note.style.margin = "4px 0 6px";
  panneau.append(titre, note);

  const dernier = document.createElement("div");
  Object.assign(dernier.style, { marginTop: "8px", font: "11px monospace", wordBreak: "break-word" });
  const jouer = (ev: Evenement): void => {
    e.sons.deverrouiller(); // un bouton est un geste : il crée ou réveille le contexte audio
    e.sons.jouer(ev);
    dernier.textContent = `${T.dernier} : ${e.sons.joues.slice(-8).map((s) => `${s.son}${s.joue ? "" : " ✕"}`).join(" · ")}`;
  };
  const titreDe = (texte: string): HTMLElement => {
    const h = document.createElement("div");
    h.textContent = texte;
    Object.assign(h.style, { fontWeight: "700", margin: "8px 0 2px", color: "#E8B23A" });
    return h;
  };
  for (const g of GROUPES) {
    panneau.append(titreDe(e.langue === "en" ? g.en : g.fr));
    const grille = document.createElement("div");
    Object.assign(grille.style, { display: "flex", flexWrap: "wrap", gap: "4px" });
    for (const son of g.sons) for (const x of EXEMPLES[son]) grille.append(bouton(e.langue === "en" ? x.en : x.fr, () => jouer(x.e)));
    panneau.append(grille);
  }

  // Les sons continus : un curseur chacun, qui les remet à jour tant qu'on y touche ; sans mise à jour, ils s'éteignent seuls (l'homme mort de `Sons.continu`).
  panneau.append(titreDe(T.continus));
  const etat = { vitesse: 0, charge: 0, proximite: 0 };
  let battement = 0;
  const pousser = (): void => {
    e.sons.deverrouiller();
    e.sons.continu(etat.vitesse, etat.charge, etat.proximite > 0 ? { distance: 95 * (1 - etat.proximite), rayon: 95 } : null);
  };
  const curseur = (nom: string, max: number, pas: number, surChange: (v: number) => void): HTMLElement => {
    const l = document.createElement("label");
    Object.assign(l.style, { display: "grid", gridTemplateColumns: "1fr", gap: "0" });
    const n = document.createElement("span");
    n.textContent = nom;
    const r = document.createElement("input");
    r.type = "range";
    r.min = "0";
    r.max = String(max);
    r.step = String(pas);
    r.value = "0";
    r.addEventListener("input", () => {
      surChange(Number(r.value));
      pousser();
      // tant qu'un curseur n'est pas à zéro, on le remet à jour toutes les 120 ms (sinon l'homme mort l'éteint)
      clearInterval(battement);
      if (etat.vitesse > 0 || etat.charge > 0 || etat.proximite > 0) battement = window.setInterval(pousser, 120);
    });
    l.append(n, r);
    return l;
  };
  panneau.append(
    curseur(T.roulement, 1500, 10, (v) => (etat.vitesse = v)),
    curseur(T.ressort, 1000, 10, (v) => (etat.charge = v)),
    curseur(T.trouNoir, 1, 0.05, (v) => (etat.proximite = v)),
  );

  // Le cliquetis du spinner : la rotation part de son maximum et retombe comme celle de la simulation (997 ‰ par pas, 600 pas par seconde).
  let rotation = 0;
  const horloge = new Cliquetis();
  let fil = 0;
  const lancerSpinner = (): void => {
    clearInterval(fil);
    rotation = 30000;
    let dernierT = performance.now();
    fil = window.setInterval(() => {
      const t = performance.now();
      const dt = (t - dernierT) / 1000;
      dernierT = t;
      rotation *= 0.997 ** (600 * dt);
      for (let i = horloge.avancer(dt, rotation); i > 0; i--) e.sons.jouer({ son: "spinner", spin: rotation });
      if (rotation < 800) clearInterval(fil);
    }, 25);
    e.sons.deverrouiller();
  };
  const rafale = (): void => {
    // 40 touches de bumpers en une seconde, sur le thème du jour : le délai minimal et le plafond de voix décident de ce qu'on entend
    e.sons.deverrouiller();
    for (let i = 0; i < 40; i++) window.setTimeout(() => jouer({ son: "bumper", theme: e.theme, rang: i % 5 }), i * 25);
  };
  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" });
  actions.append(
    bouton(T.spinner, lancerSpinner),
    bouton(T.rafale, rafale),
    bouton(T.fermer, () => {
      panneau.hidden = true;
      ouvrir.hidden = false;
    }),
  );
  panneau.append(actions, dernier);
  racine.append(ouvrir, panneau);
  hote.append(racine);
  return {
    detruire: () => {
      clearInterval(battement);
      clearInterval(fil);
      racine.remove();
    },
  };
}
