// Lot QA2 : les données de chaque jeu pour les maquettes d'interface — identité (couleur, police, motif), contenu des écrans (celui des captures du 12/11/2026), scène schématique, HUD propre au jeu,
// écrans à montrer et légende numérotée. Rien ici n'est du code de jeu ; les valeurs de couleur viennent de la charte (`docs/plateforme/identite.md`) et des fiches `config/jeux/`.
import { IC, rep } from "./gabarits.mjs";

const r = (g, k) => (g.n?.[k] ? rep(g.n[k]) : "");
const abs = (g, k, x, y) => (g.n?.[k] ? `<b class="rep abs" style="left:${x}px;top:${y}px">${g.n[k]}</b>` : "");
const plq = (g, k, x, y, ic, plus = "") => `<div class="p44" style="left:${x}px;top:${y}px;${plus}">${IC[ic]}${abs(g, k, 28, -10)}</div>`;
const touche = (x, y, w, h, contenu, cls = "", plus = "") => `<div class="touche ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${plus}">${contenu}</div>`;
const svg = (l, h, corps, defs = "") => `<svg viewBox="0 0 ${l} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${defs}${corps}</svg>`;

// ------------------------------------------------------------------ scènes schématiques (une par jeu ; le visuel est l'objet de la partie 2)
const sceneTrack = (l, h) => {
  const hz = h * 0.42, cx = l / 2;
  return svg(l, h, `<rect width="${l}" height="${hz}" fill="url(#c)"/><circle cx="${l * .72}" cy="${hz * .62}" r="${Math.min(l, h) * .06}" fill="#ffd89a"/>
    <polygon points="0,${hz} 0,${hz - h * .07} ${l * .12},${hz - h * .1} ${l * .22},${hz - h * .05} ${l * .38},${hz - h * .09} ${l * .55},${hz - h * .04} ${l * .7},${hz - h * .1} ${l * .88},${hz - h * .06} ${l},${hz - h * .09} ${l},${hz}" fill="#a8452a"/>
    <rect y="${hz}" width="${l}" height="${h - hz}" fill="#d49a55"/><polygon points="${cx - l * .03},${hz} ${cx + l * .03},${hz} ${cx + l * .36},${h} ${cx - l * .36},${h}" fill="#8a7468"/>
    <polygon points="${cx - l * .03},${hz} ${cx - l * .028},${hz} ${cx - l * .33},${h} ${cx - l * .36},${h}" fill="#e8e0d0"/><polygon points="${cx + l * .03},${hz} ${cx + l * .028},${hz} ${cx + l * .33},${h} ${cx + l * .36},${h}" fill="#e8e0d0"/>
    <rect x="${cx - l * .045}" y="${h * .66}" width="${l * .09}" height="${h * .12}" rx="6" fill="#e8502a"/>`, '<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a5aa0"/><stop offset="1" stop-color="#f2a463"/></linearGradient></defs>');
};
const sceneJump = (l, h, sol = 0.77) => {
  const y = h * sol;
  const pics = Array.from({ length: Math.ceil(l * .56 / 28) }, (_, i) => `<polygon points="${l * .22 + i * 28},${h} ${l * .22 + i * 28 + 14},${h - 40} ${l * .22 + i * 28 + 28},${h}" fill="#FF3B3B" stroke="#1a0408" stroke-width="2"/>`).join("");
  return svg(l, h, `<rect width="${l}" height="${h}" fill="#241448"/><rect y="${y * .3}" width="${l}" height="${y * .5}" fill="#2d1a5c"/><rect x="0" y="${y}" width="${l * .22}" height="${h - y}" fill="#3b2278"/><rect x="${l * .78}" y="${y}" width="${l * .22}" height="${h - y}" fill="#3b2278"/>
    ${Array.from({ length: 10 }, (_, i) => `<rect x="${l * .22 + i * 30}" y="${y}" width="28" height="28" fill="${i % 3 === 1 ? "#2d1a5c" : "#14b8a6"}"/>`).join("")}${pics}<rect x="${l * .1}" y="${y - 28}" width="26" height="26" fill="#FFD23F"/>`);
};
const sceneTower = (l, h) => svg(l, h, `<rect width="${l}" height="${h * .8}" fill="#9FD3E6"/><circle cx="${l * .66}" cy="${h * .28}" r="${h * .07}" fill="#FFE9A8"/><rect y="${h * .62}" width="${l}" height="${h * .38}" fill="#2F6F8F"/><rect x="${l * .38}" y="${h * .78}" width="${l * .24}" height="${h * .05}" fill="#6B5847"/><rect x="${l * .44}" y="${h * .66}" width="${l * .09}" height="${h * .12}" fill="#9B6BD6"/><rect x="${l * .46}" y="${h * .54}" width="${l * .09}" height="${h * .12}" fill="#FFD23F"/>`);
const sceneBlocks = (l, h) => svg(l, h, `<rect width="${l}" height="${h}" fill="#F4D9A8"/><rect y="${h * .8}" width="${l}" height="${h * .2}" fill="#9a968f"/>${Array.from({ length: 6 }, (_, i) => `<rect x="${i * l / 6 + 10}" y="${h * (.4 + (i % 3) * .08)}" width="${l / 6 - 20}" height="${h * .4}" fill="#e3c590"/>`).join("")}`);
const sceneRush = (l, h) => svg(l, h, `<rect width="${l}" height="${h}" fill="#bfe3f2"/><polygon points="${l * .1},${h * .5} ${l * .9},${h * .45} ${l * .98},${h * .8} ${l * .02},${h * .85}" fill="#7DB36A"/><polygon points="${l * .1},${h * .5} ${l * .9},${h * .45} ${l * .98},${h * .8} ${l * .02},${h * .85}" fill="none" stroke="#b9854f" stroke-width="10"/><circle cx="${l * .5}" cy="${h * .62}" r="14" fill="#F2B544"/>`);

// ------------------------------------------------------------------ éléments communs à toutes les légendes
const COMMUN = {
  jouerAncre: { t: "« Jouer » ne sort plus de l'écran.", d: "À 844 × 390, l'accueil de Tower, Jump, Blocks et Rush coupe le bouton au pli (Track l'ancre déjà, exprès). Le bouton et les trois liens passent dans une barre ancrée en bas de l'étiquette ; le reste de l'accueil défile au-dessus.", ref: "Constat J1 ; charte § 9 : hauteur du bouton constante.", m: [["plat", "kit"]] },
  ordiLarge: { t: "Sur grand écran, l'étiquette se remplit.", d: "À 1 440 × 900 l'étiquette tient à peu près 900 px et les textes gardent leur taille de téléphone. Elle passe à 1 160 px, le titre à 72 px, l'aperçu est agrandi : même grille à deux colonnes (identité à gauche, « Aujourd'hui » et classement à droite), seulement plus grande.", ref: "Constat J2, TO3 ; charte § 9 (deux colonnes équilibrées).", m: [["plat", "kit"]] },
  pauseDeux: { t: "La pause tient dans l'écran.", d: "La pause défile à 390 px de haut (« Plein écran » et « Accueil » sont sous le pli). En paysage elle passe en deux colonnes : les actions à gauche, son et musique à droite, « Reprendre » en premier.", ref: "Constat J3 ; manette : l'action principale est « Reprendre ».", m: [["plat", "kit"]] },
  arriveeOrdre: { t: "Même ordre d'arrivée dans les cinq jeux.", d: "Temps (ou score) en grand → médaille, nom écrit, et ce qu'il manque pour la suivante → place du jour → Rejouer, Partager et le bouton propre au jeu → détails du jeu → classement. Aujourd'hui chaque jeu a son ordre : Blocks et Rush n'ont ni place ni « Jeu suivant », Tower a trois tuiles, Jump un autocollant.", ref: "Cohérence ; charte § 3.2 : le texte dit toujours le nom de la médaille.", m: [["plat", "kit"]] },
  arriveeSuivant: { t: "« Jeu suivant du jour » reste en vue.", d: "Une plaque crème ancrée en bas de l'arrivée (jamais sous le pli d'un classement long), avec la marge de sécurité de l'iPhone. C'est une porte de sortie voulue par le joueur : aucune autre.", ref: "Charte § 9 (on reste dans le jeu) ; lot I3.", m: [["plat", "kit"]] },
  hudBande: { t: "Une seule bande de 30 px, sur une plaque.", d: "Le chronomètre (ou le score) est toujours sur une plaque opaque : papier ou encre, jamais directement sur le décor, quel que soit le thème. Une seule ligne, centrée en haut, jamais empilée.", ref: "Charte § 9 (surimpressions compactes).", m: [["plat", "HUD commun"]] },
  hudPlaques: { t: "Trois plaques à gauche, le reste à droite.", d: "Pause et les deux actions de course à gauche ; plein écran, fantôme (et caméra pour Track) en groupe à droite avec l'objectif. Les plaques ont un liseré clair extérieur (1 px) : elles se lisent aussi sur un décor sombre. Toutes à 44 px au moins.", ref: "Charte § 9, révision 12 (plein écran, caméra, fantôme restent en vue).", m: [["plat", "HUD commun"]] },
  hudCommandes: { t: "Les commandes tiennent dans les marges.", d: "Boutons aux bords, dans la marge de sécurité, de 64 px au moins pour les directions et 88 px pour l'action principale, sans jamais passer devant l'élément qu'on contrôle. Le cadre bleu en pointillé montre la zone qui reste libre.", ref: "Charte § 9 (commandes aux bords) ; § 10 (cibles de 44 px).", m: [["plat", "HUD commun"]] },
};
const pick = (...ks) => ks.map((k) => ({ k, ...COMMUN[k] }));

// ------------------------------------------------------------------ TRACK
const track = {
  id: "track", nom: "TRACK", nomCourt: "Track", cls: "n-track", fond: "#1E1B19", texte: "#F4EFE6", bouton: "#E8552D", boutonTexte: "#1E1B19", boutonOmbre: "#8E2E14", coque: false,
  motif: "repeating-linear-gradient(115deg,#E8552D 0 11px,transparent 11px 20px)", numero: 31, sous: "Circuit du jour · Canyon", jouer: "Courir", rejouer: "Recourir", classes: 28, fontChrono: "'Barlow Condensed';font-style:italic",
  liens: ["Archives", "Comment jouer", "Réglages"], pause: ["Dernier point de contrôle"], reglagesOnglets: ["Graphismes", "Son", "Jeu", "Commandes"], lienClassement: "Revoir le meilleur tour ›",
  tuiles: [["Meilleur temps", "35,394 s", "1er sur 28", true]],
  meds: [["diamant", "Diamant", "32,798 s"], ["or", "Or", "34,274 s"], ["argent", "Argent", "35,094 s"], ["bronze", "Bronze", "37,062 s", true]],
  classement: [[1, "Démo", "35,394 s", true], [2, "Démo Iris", "36,222 s"], [3, "Démo Sirocco", "36,387 s"], [4, "Démo Cerise", "36,693 s"], [5, "Démo Pétale", "36,829 s"]],
  scene: sceneTrack, sceneJeu: sceneTrack, fort: ["#E8552D", "#1E1B19", "#8E2E14"],
  apercu: (w, h) => `<div style="height:${h}px;background:#26221F;border:2px solid #5A524C;display:grid;place-items:center"><svg viewBox="0 0 300 80" style="width:80%;height:80%"><path d="M10 60 L90 60 C120 60 120 30 150 30 L230 30 C260 30 270 50 290 20" stroke="#E8552D" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="10" cy="60" r="5" fill="#F4EFE6"/><circle cx="290" cy="20" r="5" fill="#4FC3DC"/></svg></div>`,
  aujourdhui: (c) => `<div class="pan"><h3>Salon<small>nouveau circuit toutes les 10 min</small></h3>${c ? "" : '<p style="font-size:13px;margin:0 0 8px">Les fantômes des autres joueurs et un classement de session. En cours : Col alpin · prochain circuit dans 03:09.</p>'}<div class="btn-d" style="min-height:44px">Rejoindre le Salon</div></div><div class="liens"><span class="lien-b">Garage</span><span class="lien-b">Fantôme : ton record</span></div>`,
  arrivee: { titre: "Arrivée · Circuit n° 31 · Canyon", temps: "35,875", etiquette: "Premier temps", sousEtiquette: "Sans reprise", med: ["bronze", "Médaille bronze", "Argent : encore 0,781 s"], place: "2e", partage: "Du Jour · Track #31 — 35,875 s — 🥉 — 2e/30", suivant: "Jeu suivant du jour : Jump", revoir: "Revoir le tour" },
  hud(l, h, m) {
    const g = this, pay = l > h;
    const b = (x, y, w, hh, c, cls = "", st = "") => touche(x, y, w, hh, c, cls, st);
    if (pay) {
      return `<div class="bande">3,575 s<span class="sep"></span><span style="color:#1f7a3d">−0,412</span>${abs(g, "hudBande", -12, -14)}</div><div class="aide-h">← → pour tourner · frein et gaz à droite</div>
        ${plq(g, "hudPlaques", m.g, 8, "pause")}${plq(g, "", m.g + 50, 8, "drapeau")}${plq(g, "", m.g + 100, 8, "relance")}
        ${plq(g, "", l - m.d - 150, 8, "plein")}${plq(g, "", l - m.d - 100, 8, "camera")}${plq(g, "", l - m.d - 50, 8, "fantome")}
        <div class="pastille-h" style="right:${m.d}px;top:58px;font-size:13px"><span class="med bronze" style="width:12px;height:12px;background:var(--bronze)"></span>Bronze 37,062 s${abs(g, "objectif", -10, -14)}</div>
        ${b(m.g, 287, 72, 72, IC.gauche, "", "")}${b(m.g + 80, 287, 72, 72, IC.droite)}${abs(g, "hudCommandes", m.g + 70, 270)}
        ${b(l - m.d - 88 - 8 - 68, 295, 68, 64, "FREIN")}${b(l - m.d - 88, 271, 88, 88, "GAZ", "fort")}
        <div class="pastille-h" style="left:${l / 2 - 50}px;top:${h - m.b - 38}px">153 km/h</div>`;
    }
    return `${plq(g, "hudPlaques", 10, m.t + 6, "pause")}${plq(g, "", 60, m.t + 6, "drapeau")}${plq(g, "", 110, m.t + 6, "relance")}${plq(g, "", 286, m.t + 6, "camera")}${plq(g, "", 336, m.t + 6, "fantome")}
      <div class="bande" style="top:${m.t + 56}px">1,283 s<span class="sep"></span><span style="color:#1f7a3d">−0,21</span>${abs(g, "hudBande", -12, -14)}</div>
      <div class="aide-h" style="top:${m.t + 94}px;font-size:12px;display:flex;gap:10px;align-items:center">Mieux en paysage <b style="background:var(--moutarde);color:var(--encre);padding:0 8px;border-radius:3px;min-height:24px;display:inline-grid;place-items:center">Jouer quand même</b>${abs(g, "portrait", -10, -12)}</div>
      ${b(10, h - m.b - 76, 64, 64, IC.gauche)}${b(82, h - m.b - 76, 64, 64, IC.droite)}${b(l - 10 - 84 - 8 - 62, h - m.b - 70, 62, 58, "FREIN")}${b(l - 94, h - m.b - 96, 84, 84, "GAZ", "fort")}
      <div class="pastille-h" style="left:${l / 2 - 40}px;top:${h - m.b - 110}px">85 km/h</div>`;
  },
  ecrans: [
    { cle: "accueil-ordi", titre: "Accueil — ordinateur, 1 440 × 900", l: 1440, h: 900, avant: "track-accueil/1440x900", gabarit: "accueil" },
    { cle: "accueil-paysage", titre: "Accueil — téléphone en paysage, 844 × 390", l: 844, h: 390, avant: "track-accueil/844x390", gabarit: "accueil", note: "L'accueil de Track ancre déjà « Courir » en bas : il sert de modèle aux quatre autres jeux. Ce qui manque : le meilleur temps, les médailles et le classement, introuvables sans défiler au milieu d'un panneau vide." },
    { cle: "accueil-portrait", titre: "Accueil — téléphone en portrait, 390 × 844", l: 390, h: 844, avant: "track-accueil/390x844", gabarit: "accueil" },
    { cle: "arrivee-ordi", titre: "Arrivée — ordinateur", l: 1440, h: 900, avant: "track-arrivee/1440x900", gabarit: "arrivee" },
    { cle: "arrivee-portrait", titre: "Arrivée — téléphone en portrait", l: 390, h: 844, avant: "track-arrivee/390x844", gabarit: "arrivee" },
    { cle: "pause", titre: "Pause — téléphone en paysage", l: 844, h: 390, avant: "track-pause/844x390", gabarit: "pause" },
    { cle: "reglages", titre: "Réglages — téléphone en portrait", l: 390, h: 844, avant: "track-reglages/390x844", gabarit: "reglages" },
    { cle: "classement", titre: "Classement — ordinateur", l: 1440, h: 900, avant: "track-classement/1440x900", gabarit: "accueil", note: "Le classement du jeu s'ouvre depuis « Tout le classement ›» : sur l'accueil proposé la liste est déjà à droite ; l'écran complet reprend la même mise en page (vues Tous · Amis · Mon groupe)." },
    { cle: "hud-paysage", titre: "En partie — téléphone en paysage", l: 844, h: 390, avant: "track-partie/844x390", gabarit: "enPartie" },
    { cle: "hud-portrait", titre: "En partie — téléphone en portrait", l: 390, h: 844, avant: "track-partie/390x844", gabarit: "enPartie" },
  ],
  intro: "Track, le jeu de course : étiquette sans coque (asphalte, bandes de livrée), la seule à ancrer déjà « Courir » en bas. L'interface hors partie est la plus avancée des cinq ; la partie en paysage est dense (cinq plaques à gauche) et les plaques sombres se perdent sur le sol brun du Canyon.",
  legende: [
    { k: "jouerAncre", t: "L'accueil se range autour de « Courir ».", d: "Le bouton reste ancré en bas (déjà le cas) ; à 390 px de haut l'aperçu de circuit ne prend plus 214 px au milieu d'un panneau vide : il passe à gauche en petit, avec le meilleur temps, les quatre médailles (le nom écrit) et les premières lignes du classement. Garage, Salon, Archives, Réglages passent dans la barre du bas.", ref: "Constat J1 ; charte § 3.2 (le nom de la médaille).", m: [["plat", "kit"]] },
    ...pick("ordiLarge"),
    { k: "pauseDeux", t: "La pause tient dans l'écran, et rien ne passe dessus.", d: "Deux colonnes en paysage (« Reprendre » en premier, son et musique à droite) : « Plein écran » et « Accueil de Track » ne sont plus sous le pli. Le panneau « Classement » de la course, visible dans la capture au-dessus de la pause avec « Serveur injoignable », se masque tant que la pause est ouverte.", ref: "Constat J3 ; charte § 9 (la pause est un dialogue).", m: [["plat", "kit"]] },
    ...pick("arriveeOrdre"),
    { k: "arriveeSuivant", t: "« Jeu suivant du jour » est déjà ancré : on le garde.", d: "C'est la seule arrivée qui le fait bien aujourd'hui. Les autres jeux le reprennent, avec la marge de 34 px du bas de l'iPhone.", ref: "Charte § 9 ; lot I3.", m: [["plat", "kit"]] },
    ...pick("hudBande"),
    ...pick("hudPlaques"),
    { k: "objectif", t: "L'objectif de médaille se lit.", d: "Le seuil (« Bronze 37,062 s ») passe de 11 à 13 px, sur sa plaque, sous le groupe de droite ; le mot « Objectif » reste absent.", ref: "Constat T2 (seuil à 11 px).", m: [] },
    ...pick("hudCommandes"),
    { k: "portrait", t: "« Tourne ton téléphone » ne couvre plus la voiture.", d: "En portrait, la carte centrale de la capture cache le véhicule et la route. Elle devient une ligne sous la bande (« Mieux en paysage · Jouer quand même ») qui disparaît seule après quelques secondes, comme l'aide des commandes.", ref: "Constat T3 ; charte § 9 (le centre reste libre).", m: [["plat", "HUD commun"]] },
    { k: "hudSure", t: "Marge du haut de l'iPhone en portrait.", d: "Les plaques du haut commencent à 8 px dans la capture alors que la marge simulée est de 47 px ; si la marge est bien lue sur un iPhone avec encoche, elles passent dessous. À vérifier sur un vrai téléphone (Safari n'est pas lancé par la relecture).", ref: "Charte § 10 ; à vérifier.", m: [] },
  ],
};

// ------------------------------------------------------------------ JUMP
const jump = {
  id: "jump", nom: "JUMP", nomCourt: "Jump", cls: "n-jump", fond: "#FFD23F", texte: "#2A1E16", bouton: "#2A1E16", boutonTexte: "#FFD23F", boutonOmbre: "#C2401F", coque: true, coqueCouleur: "#E8B23A",
  motif: "", numero: 28, sous: "Niveau n° 28 · Néon", replique: "« Une plateforme sur deux. Devine laquelle. »", titreStyle: "text-shadow:3px 3px 0 #FFF6E0", jouer: "Jouer", classes: 41, moiEncre: true, fontChrono: "'Lilita One'",
  liens: ["Archives", "Comment jouer", "Réglages"], pause: ["Dernier point de passage"], reglagesOnglets: ["Affichage", "Son", "Jeu", "Commandes"], lienClassement: "Voir la course du n° 1 ›",
  tuiles: [["Ton record", "Pas encore", "Bronze à 52,392 s"], ["Série Jump", "2 jours", "2 médailles", true]], meds: [],
  classement: [[1, "Démo Turbine <small class=\"douce\">0 mort</small>", "30,817 s"], [2, "Démo Lynx <small class=\"douce\">0 mort</small>", "30,825 s"], [3, "Démo Pirate <small class=\"douce\">0 mort</small>", "30,833 s"], [4, "Démo Brume <small class=\"douce\">1 mort</small>", "32,625 s"], [5, "Démo Mistral <small class=\"douce\">1 mort</small>", "32,625 s"]],
  moi: [3, "Photo 1767", "30,817 s"],
  fort: ["#FFD23F", "#2A1E16", "#2A1E16"], scene: (l, h) => sceneJump(l, h), sceneJeu: (l, h) => sceneJump(l, h, l > h ? 0.62 : 0.66),
  apercu: (w, h) => `<div style="height:${h}px;background:#FFF6E0;border:3px solid #2A1E16;display:grid;place-items:center"><svg viewBox="0 0 300 80" style="width:80%;height:80%"><path d="M0 60h70v-14h60v14h90v-24h80v44H0z" fill="#2A1E16"/><polygon points="140,60 148,44 156,60" fill="#D7263D"/><polygon points="156,60 164,44 172,60" fill="#D7263D"/><rect x="20" y="36" width="14" height="14" fill="#FFD23F" stroke="#2A1E16" stroke-width="2"/></svg></div>`,
  aujourdhui: (c) => `<div class="pan" style="text-align:center;font:700 14px Archivo">Fantôme : le tien</div><div class="tu encre" style="display:flex;gap:12px;align-items:center"><span style="width:38px;height:38px;display:grid;place-items:center">${IC.crane.replace("<svg ", '<svg style="width:34px;height:34px;stroke:#FFF6E0;fill:none;stroke-width:2" ')}</span><div><b style="font-size:20px">278 morts</b><span style="color:var(--creme)">aujourd'hui, tous joueurs</span></div></div>`,
  arrivee: { liste: [[1, "Démo Turbine <small class=\"douce\">0 mort</small>", "30,817 s"], [2, "Photo 3fc0 <small class=\"douce\">0 mort</small>", "30,817 s"], [3, "Photo 1767 <small>0 mort</small>", "30,817 s", true], [4, "Démo Lynx <small class=\"douce\">0 mort</small>", "30,825 s"], [5, "Démo Pirate <small class=\"douce\">0 mort</small>", "30,833 s"]], titre: "Arrivée !", temps: "30,817", etiquette: "Nouveau record du jour !", sousEtiquette: "0 mort", med: ["diamant", "Temps de l'auteur battu !", "Médaille diamant"], place: "3e", replique: "« Zéro mort. On va vérifier que tu n'as pas triché. »", suivant: "Jeu suivant du jour : Track", revoir: "Voir le carnage" },
  hud(l, h, m) {
    const g = this, pay = l > h;
    const crane = (st) => `<div class="pastille-h" style="background:#FFD23F;transform:rotate(2deg);${st}">${IC.crane.replace("<svg ", '<svg style="width:18px;height:18px;stroke:#2A1E16;fill:none;stroke-width:2" ')}0</div>`;
    if (pay) {
      return `<div class="bande">0,217<span class="sep"></span>⚑ 0/9${abs(g, "hudBande", -12, -14)}</div>
        ${plq(g, "hudPlaques", m.g, 8, "pause")}${plq(g, "", m.g + 50, 8, "drapeau")}${plq(g, "", m.g + 100, 8, "relance")}${plq(g, "", l - m.d - 100, 8, "plein")}${plq(g, "", l - m.d - 50, 8, "fantome")}
        <div class="pastille-h" style="right:${m.d + 66}px;top:58px"><span class="med bronze" style="width:12px;height:12px;background:var(--bronze)"></span>Bronze 52,392</div>${crane(`right:${m.d}px;top:58px`)}
        <div class="zone-sure" style="left:${m.g}px;right:${m.d}px;top:262px;height:0;background:none;border-width:2px 0 0"><span>les commandes commencent ici : le sol du niveau reste au-dessus</span>${r(g, "cadrage")}</div>
        ${touche(m.g, 283, 72, 76, IC.gauche)}${touche(m.g + 80, 283, 72, 76, IC.droite)}${abs(g, "hudCommandes", m.g + 70, 262)}${touche(l - m.d - 100, 263, 100, 96, "SAUT", "fort", "font-size:20px")}`;
    }
    return `${plq(g, "hudPlaques", 10, m.t + 6, "pause")}${plq(g, "", 60, m.t + 6, "drapeau")}${plq(g, "", 110, m.t + 6, "relance")}<div class="pastille-h" style="right:10px;top:${m.t + 12}px"><span class="med bronze" style="width:12px;height:12px;background:var(--bronze)"></span>Bronze 52,392</div>
      <div class="bande" style="top:${m.t + 56}px">0,217<span class="sep"></span>⚑ 0/9${abs(g, "hudBande", -12, -14)}</div>${crane(`right:10px;top:${m.t + 56}px`)}
      <div class="aide-h" style="top:${m.t + 94}px;font-size:12px;display:flex;gap:10px;align-items:center">Mieux en paysage <b style="background:var(--moutarde);color:var(--encre);padding:0 8px;border-radius:3px;min-height:24px;display:inline-grid;place-items:center">Jouer quand même</b>${abs(g, "toast", -10, -12)}</div>
      ${touche(10, h - m.b - 76, 64, 64, IC.gauche)}${touche(82, h - m.b - 76, 64, 64, IC.droite)}${touche(l - 10 - 92, h - m.b - 100, 92, 88, "SAUT", "fort", "font-size:20px")}`;
  },
  ecrans: [
    { cle: "accueil-ordi", titre: "Accueil — ordinateur, 1 440 × 900", l: 1440, h: 900, avant: "jump-accueil/1440x900", gabarit: "accueil" },
    { cle: "accueil-paysage", titre: "Accueil — téléphone en paysage, 844 × 390", l: 844, h: 390, avant: "jump-accueil/844x390", gabarit: "accueil" },
    { cle: "accueil-portrait", titre: "Accueil — téléphone en portrait, 390 × 844", l: 390, h: 844, avant: "jump-accueil/390x844", gabarit: "accueil" },
    { cle: "arrivee-ordi", titre: "Arrivée — ordinateur", l: 1440, h: 900, avant: "jump-arrivee/1440x900", gabarit: "arrivee" },
    { cle: "arrivee-portrait", titre: "Arrivée — téléphone en portrait", l: 390, h: 844, avant: "jump-arrivee/390x844", gabarit: "arrivee" },
    { cle: "pause", titre: "Pause — téléphone en paysage", l: 844, h: 390, avant: "jump-pause/844x390", gabarit: "pause" },
    { cle: "reglages", titre: "Réglages — téléphone en portrait", l: 390, h: 844, avant: "jump-reglages/390x844", gabarit: "reglages" },
    { cle: "classement", titre: "Classement — téléphone en portrait", l: 390, h: 844, avant: "jump-classement/390x844", gabarit: "classement" },
    { cle: "hud-paysage", titre: "En partie — téléphone en paysage", l: 844, h: 390, avant: "jump-partie/844x390", gabarit: "enPartie" },
    { cle: "hud-portrait", titre: "En partie — téléphone en portrait", l: 390, h: 844, avant: "jump-partie/390x844", gabarit: "enPartie" },
  ],
  intro: "Jump, le jeu de plateformes : étiquette jaune dans sa coque moutarde, police Lilita One, rouge réservé aux dangers. L'interface hors partie est solide ; c'est en partie que les commandes mangent le jeu : sur un téléphone en paysage, les flèches et « Saut » recouvrent le sol et l'arrivée, et en portrait le message « Tourne ton téléphone » couvre la flèche de droite.",
  legende: [
    ...pick("jouerAncre", "ordiLarge", "pauseDeux", "arriveeOrdre", "arriveeSuivant"),
    { k: "classementLignes", t: "Les lignes du classement se touchent et se voient au focus.", d: "Les lignes sont des boutons de 44 px au moins (21 px aujourd'hui sur tablette et téléphone) avec un contour au focus du clavier ; ta ligne reste en encre sur le jaune, la moutarde ne s'y verrait pas.", ref: "Constat JU1 ; charte § 9 (ta ligne sur l'étiquette jaune).", m: [] },
    ...pick("hudBande", "hudPlaques"),
    { k: "cadrage", t: "Le sol du niveau reste au-dessus des commandes.", d: "À 390 px de haut le sol est à 77 % de la hauteur : les flèches et « Saut » (88 px) recouvrent les premières tuiles, le gouffre et le drapeau d'arrivée. Le cadrage remonte le sol à 62 % en paysage : les commandes recouvrent le vide et les pics, jamais ce sur quoi on marche. C'est un réglage de caméra, pas de simulation.", ref: "Constat de la mission : le jeu masqué par les commandes. À valider avec ?debug&tune.", m: [["com", "affichage seulement"]] },
    ...pick("hudCommandes"),
    { k: "toast", t: "« Tourne ton téléphone » ne couvre plus la flèche de droite.", d: "En portrait, le message (et la ligne de débogage) se pose sur le bouton « → ». Il devient une ligne sous la bande, avec « Jouer quand même », et se retire seul.", ref: "Planche ; charte § 9.", m: [["plat", "HUD commun"]] },
  ],
};

// ------------------------------------------------------------------ TOWER
const tower = {
  id: "tower", nom: "TOWER", nomCourt: "Tower", cls: "n-tower", fond: "#9ED9BE", texte: "#2A1E16", bouton: "#2A1E16", boutonTexte: "#9ED9BE", boutonOmbre: "#2F7D62", coque: true, coqueCouleur: "#2F7D62",
  motif: "", numero: 11, sous: "Tour n° 11 · Nuit", replique: "« Il fait nuit. Les pièces ne voient rien, mais elles sentent la tour penser à tomber. »", titreStyle: "text-shadow:3px 3px 0 #FFF6E0", jouer: "Jouer", classes: 8, fontChrono: "'Rubik Mono One'",
  liens: ["Comment jouer", "Archives", "Réglages"], pause: ["Fantôme : aucun"], reglagesOnglets: ["Affichage", "Son", "Commandes"], lienClassement: "Prochaine tour dans 14:20:34",
  tuiles: [["Ton record", "—", "Pas encore joué"], ["Série Tower", "0 jour", "0 médaille", true]],
  meds: [["bronze", "Bronze", "4,381 m"], ["argent", "Argent", "8,762 m"], ["or", "Or", "14,603 m"], ["diamant", "Diamant", "29,207 m"]],
  classement: [["1er", "Démo Pirate <small class=\"douce\">0 vie</small>", "22,535 m"], ["2e", "Démo Renard <small class=\"douce\">0 vie</small>", "8,723 m"], ["3e", "Démo Biscotte <small class=\"douce\">0 vie</small>", "8,081 m"]],
  moi: ["9e", "Photo 1767", "0,000 m"],
  scene: sceneTower, sceneJeu: sceneTower,
  apercu: (w, h) => `<div style="height:${h}px;display:grid;place-items:center"><svg viewBox="0 0 120 80" style="height:90%"><rect x="20" y="64" width="80" height="10" fill="#3F7FD9" stroke="#2A1E16" stroke-width="3"/><rect x="34" y="46" width="24" height="18" fill="#FFD23F" stroke="#2A1E16" stroke-width="3"/><rect x="58" y="34" width="24" height="30" fill="#F07FB0" stroke="#2A1E16" stroke-width="3"/><rect x="34" y="28" width="16" height="18" fill="#9B6BD6" stroke="#2A1E16" stroke-width="3"/></svg></div>`,
  aujourdhui: (c) => `<div class="pan"><h3>Aujourd'hui<small>40 pièces · plateforme large</small></h3>${[["8 m", "Pièce figée", "bonus"], ["16 m", "Pièce géante", "malus"], ["24 m", "Lierre", "bonus"], ...(c ? [] : [["32 m", "Coup de vent", "malus"], ["40 m", "Petite pièce", "bonus"], ["48 m", "Pièce glissante", "malus"]])].map(([a, b, k]) => `<div class="lg" style="min-height:${c ? 30 : 36}px"><span class="mono" style="width:44px">${a}</span><span class="nom">${b}</span><span class="pastille" style="${k === "bonus" ? "background:#5DBB63" : "background:#2A1E16;color:#FFF6E0"}">${k}</span></div>`).join("")}</div>`,
  arrivee: { titre: "Tower · Tour n° 11 · Nuit", temps: "0,000", unite: " m", etiquette: "Hauteur stable", sousEtiquette: "Plus haute atteinte : 0,000 m (ne compte pas)", replique: "Les pièces ne t'en veulent pas. Presque pas.", med: [null, "Aucune médaille", "Bronze : encore 4,381 m"], place: "9e", suivant: "Jeu suivant du jour : Track",
    droite: `<div class="pan"><h3>Médailles du jour</h3><div class="meds" style="flex-wrap:wrap"><div class="md bronze" style="flex:1 1 40%">Bronze<b>4,381 m</b></div><div class="md argent" style="flex:1 1 40%">Argent<b>8,762 m</b></div><div class="md or" style="flex:1 1 40%">Or<b>14,603 m</b></div><div class="md diamant" style="flex:1 1 40%">Diamant<b>29,207 m</b></div></div></div><div class="pan"><h3>Ta partie</h3>${[["Pièces posées", "0/40"], ["Pièces tombées", "3"], ["Paliers franchis", "Aucun"], ["Temps", "3,450 s"]].map(([a, b]) => `<div class="lg" style="min-height:34px"><span class="nom">${a}</span><span class="tps">${b}</span></div>`).join("")}</div>` },
  hud(l, h, m) {
    const g = this, pay = l > h;
    const suivante = (x, y) => `<div class="p44" style="left:${x}px;top:${y}px;width:84px;height:64px;font:700 10px Archivo;letter-spacing:1px;align-content:center;gap:2px">SUIVANTE<svg viewBox="0 0 24 24" style="width:30px;height:28px"><path d="M6 4h6v8h6v8H6z" fill="#F07FB0" stroke="#2A1E16"/></svg>${abs(g, "", 0, 0)}</div>`;
    const bande = `<div class="bande" style="background:var(--papier)">4,038 m<span class="sep"></span><span style="background:#9ED9BE;padding:1px 6px">3/40</span><span class="sep"></span><span style="color:#C2401F">♥ ♥ ♥</span>${abs(g, "hudBande", -12, -14)}</div>`;
    if (pay) {
      return `${bande}${plq(g, "hudPlaques", m.g, 8, "pause")}${plq(g, "", m.g + 50, 8, "plein")}${plq(g, "", m.g + 100, 8, "fantome")}${suivante(l - m.d - 84, 8)}
        ${touche(m.g, 241, 76, 44, "⏮", "", "font-size:18px")}${touche(m.g + 84, 241, 76, 44, "⏭", "", "font-size:18px")}${abs(g, "taquet", m.g + 62, 222)}${touche(m.g, 293, 76, 76, IC.gauche)}${touche(m.g + 84, 293, 76, 76, IC.droite)}${abs(g, "hudCommandes", m.g + 150, 280)}
        ${touche(l - m.d - 104 - 8 - 80, 289, 80, 80, '<svg viewBox="0 0 24 24"><path d="M6 6l6 6 6-6M6 13l6 6 6-6"/></svg>')}${touche(l - m.d - 104, 277, 104, 92, '<span>⟳<br>TOURNER</span>', "fort", "font-size:14px")}`;
    }
    return `${bande.replace('class="bande"', `class="bande" style="top:${m.t + 6}px;background:var(--papier)"`)}${plq(g, "hudPlaques", 10, m.t + 48, "pause")}${plq(g, "", 60, m.t + 48, "plein")}${plq(g, "", 110, m.t + 48, "fantome")}${suivante(l - 94, m.t + 48)}
      ${touche(10, h - m.b - 168, 84, 44, "⏮", "", "font-size:18px")}${touche(102, h - m.b - 168, 84, 44, "⏭", "", "font-size:18px")}${abs(g, "taquet", 80, h - m.b - 184)}
      ${touche(10, h - m.b - 112, 72, 72, IC.gauche)}${touche(90, h - m.b - 112, 72, 72, IC.droite)}${touche(l - 10 - 104 - 8 - 72, h - m.b - 112, 72, 72, '<svg viewBox="0 0 24 24"><path d="M6 6l6 6 6-6M6 13l6 6 6-6"/></svg>')}${touche(l - 10 - 104, h - m.b - 124, 104, 88, '<span>⟳<br>TOURNER</span>', "fort", "font-size:14px")}`;
  },
  ecrans: [
    { cle: "accueil-ordi", titre: "Accueil — ordinateur, 1 440 × 900", l: 1440, h: 900, avant: "tower-accueil/1440x900", gabarit: "accueil" },
    { cle: "accueil-paysage", titre: "Accueil — téléphone en paysage, 844 × 390", l: 844, h: 390, avant: "tower-accueil/844x390", gabarit: "accueil" },
    { cle: "accueil-portrait", titre: "Accueil — téléphone en portrait, 390 × 844", l: 390, h: 844, avant: "tower-accueil/390x844", gabarit: "accueil" },
    { cle: "arrivee-ordi", titre: "Arrivée — ordinateur", l: 1440, h: 900, avant: "tower-arrivee/1440x900", gabarit: "arrivee" },
    { cle: "arrivee-portrait", titre: "Arrivée — téléphone en portrait", l: 390, h: 844, avant: "tower-arrivee/390x844", gabarit: "arrivee" },
    { cle: "pause", titre: "Pause — téléphone en paysage", l: 844, h: 390, avant: "tower-pause/844x390", gabarit: "pause" },
    { cle: "reglages", titre: "Réglages — téléphone en portrait", l: 390, h: 844, avant: "tower-reglages/390x844", gabarit: "reglages" },
    { cle: "classement", titre: "Classement — téléphone en portrait", l: 390, h: 844, avant: "tower-classement/390x844", gabarit: "classement" },
    { cle: "hud-paysage", titre: "En partie — téléphone en paysage", l: 844, h: 390, avant: "tower-partie/844x390", gabarit: "enPartie" },
    { cle: "hud-portrait", titre: "En partie — téléphone en portrait", l: 390, h: 844, avant: "tower-partie/390x844", gabarit: "enPartie" },
  ],
  intro: "Tower, le jeu de construction : étiquette menthe dans sa coque sapin, police Rubik Mono One, panneau « Aujourd'hui » des paliers. C'est la référence de l'accueil des jeux du kit, et son HUD tient déjà bien ; il lui manque surtout un accueil qui tienne en paysage, des boutons de taquet de 44 px et une arrivée qui suive l'ordre commun.",
  legende: [
    ...pick("jouerAncre", "ordiLarge", "pauseDeux"),
    ...pick("arriveeOrdre", "arriveeSuivant"),
    { k: "noteMedaille", t: "La note des médailles à 12 px.", d: "« Bronze : encore 4,381 m » est à 11 px : elle passe à 12 px, dans la tuile « Médaille ». Les quatre cases de médailles gardent leurs couleurs et leurs noms.", ref: "Constat TO2.", m: [] },
    ...pick("hudBande", "hudPlaques"),
    { k: "taquet", t: "Taquet à 44 px.", d: "« Taquet à gauche » et « Taquet à droite » font 40 px de haut : ils passent à 44 px, sans toucher à la place de la tour (le groupe de gauche monte de 4 px).", ref: "Constat TO1 ; charte § 10.", m: [] },
    ...pick("hudCommandes"),
  ],
};

// ------------------------------------------------------------------ BLOCKS
const blocks = {
  id: "blocks", nom: "BLOCKS", nomCourt: "Blocks", cls: "n-blocks", fond: "#B5D8F2", texte: "#2A1E16", bouton: "#2A1E16", boutonTexte: "#B5D8F2", boutonOmbre: "#2B5C8A", coque: true, coqueCouleur: "#2B5C8A",
  motif: "", numero: 11, sous: "Partie n° 11 · Chantier", jouer: "Jouer", classes: 8,
  liens: ["Comment jouer", "Archives · bientôt", "Réglages"], pause: ["Fantôme : aucun"], reglagesOnglets: ["Affichage", "Son", "Commandes"], lienClassement: "Prochaine partie dans 14:19:34",
  tuiles: [["Ton record", "—", "Pas encore joué aujourd'hui"], ["Ta série", "0 jour", "", true]],
  meds: [["diamant", "Diamant", "11 000"], ["or", "Or", "4 600"], ["argent", "Argent", "1 900"], ["bronze", "Bronze", "850"]],
  classement: [[1, "Démo Crabe", "19 535 pts"], [2, "Démo Gaufre", "6 757 pts"], [3, "Démo Zéphyr", "4 247 pts"]],
  moi: ["—", "Toi", "pas encore"],
  scene: sceneBlocks, sceneJeu: sceneBlocks,
  apercu: () => `<div style="height:120px;display:grid;place-items:center"><svg viewBox="0 0 120 80" style="height:100%"><rect x="20" y="40" width="26" height="26" fill="#F07FB0" stroke="#2A1E16" stroke-width="3"/><rect x="46" y="40" width="26" height="26" fill="#3F7FD9" stroke="#2A1E16" stroke-width="3"/><rect x="46" y="14" width="26" height="26" fill="#9B6BD6" stroke="#2A1E16" stroke-width="3"/><rect x="72" y="40" width="26" height="26" fill="#FFD23F" stroke="#2A1E16" stroke-width="3"/></svg></div>`,
  aujourdhui: (c) => `<div class="pan"><h3>Aujourd'hui · Chantier</h3><p style="margin:0;font:600 15px/1.35 Archivo">« Le chantier est ouvert. Les pièces attendent d'être posées, dans le même ordre pour tous. »</p></div>`,
  arrivee: { titre: "Partie terminée", temps: "4 816", unite: " pts", etiquette: "Partie d'essai", sousEtiquette: "non classée", med: ["or", "Médaille or", "Diamant : encore 6 184"], place: "—", suivant: "Jeu suivant du jour : Track",
    droite: `<div class="pan"><h3>Médailles du jour</h3><div class="meds"><div class="md diamant">Diamant<b>11 000</b></div><div class="md or ok">Or<b>4 600</b></div><div class="md argent">Argent<b>1 900</b></div><div class="md bronze">Bronze<b>850</b></div></div></div>` },
  hud(l, h, m) {
    const g = this, pay = l > h;
    const grille = (x, y, t) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${t}px;height:${t}px;border:3px solid var(--encre);background:#5d6269;display:grid;grid-template-columns:repeat(8,1fr);box-shadow:3px 3px 0 var(--encre)">${Array.from({ length: 64 }, (_, i) => `<i style="border:1px solid #484d54;${[27, 28, 35, 36, 43].includes(i) ? `background:${["#F07FB0", "#3F7FD9", "#9B6BD6", "#FFD23F", "#5DBB63"][[27, 28, 35, 36, 43].indexOf(i)]}` : ""}"></i>`).join("")}</div>`;
    const plaque = (x, y, w, t, v, plus = "") => `<div class="pastille-h" style="left:${x}px;top:${y}px;width:${w}px;height:52px;display:block;padding:4px 10px;${plus}"><small style="font:700 10px Archivo;letter-spacing:1px;display:block">${t}</small><span style="font:700 20px 'JetBrains Mono'">${v}</span></div>`;
    const piece = (x, y, c) => `<div style="position:absolute;left:${x}px;top:${y}px;width:36px;height:36px;background:${c};border:3px solid var(--encre);z-index:5"></div>`;
    const grue = (x, y, w) => `<svg style="position:absolute;left:${x}px;top:${y}px;z-index:2" width="${w}" height="110" viewBox="0 0 300 110"><path d="M40 108V20h190M40 20l-14 30M230 20v50" stroke="#2A1E16" stroke-width="4" fill="none"/><rect x="214" y="70" width="32" height="24" fill="#E8B23A" stroke="#2A1E16" stroke-width="3"/><rect x="20" y="92" width="60" height="16" fill="#E8B23A" stroke="#2A1E16" stroke-width="3"/></svg>`;
    if (pay) {
      return `${plaque(m.g, 47, 130, "SCORE", "4 816")}${abs(g, "hudBande", m.g + 110, 36)}${plaque(m.g, 107, 130, "COMBO", "×27")}<div class="aide-h" style="left:${m.g}px;top:170px;transform:none;white-space:normal;width:130px;font-size:12px">Glisse une des trois pièces dans la grille</div>
        ${grille(300, 47, 296)}${plq(g, "hudPlaques", l - m.d - 44, 8, "pause")}
        <div style="position:absolute;left:${l - m.d - 110}px;top:58px;width:110px;height:290px;background:var(--papier);border:3px solid var(--encre);box-shadow:3px 3px 0 var(--encre);z-index:4"><small style="font:700 10px Archivo;letter-spacing:1px;margin:6px;display:block">TES PIÈCES</small>${abs(g, "hudCommandes", 0, -12)}</div>${piece(l - m.d - 73, 130, "#5DBB63")}${piece(l - m.d - 73, 198, "#FFD23F")}${piece(l - m.d - 73, 266, "#9B6BD6")}`;
    }
    return `${plaque(10, m.t + 6, 152, "SCORE", "4 816")}${plaque(170, m.t + 6, 152, "COMBO", "×27")}${plq(g, "hudPlaques", 336, m.t + 12, "pause")}${abs(g, "hudBande", 130, m.t - 8)}
      ${grue(40, m.t + 62, 300)}${abs(g, "portrait", 160, m.t + 70)}<div class="aide-h" style="top:${m.t + 150}px;font-size:12px">Glisse une des trois pièces dans la grille</div>
      ${grille(9, 262, 372)}<div style="position:absolute;left:8px;right:8px;top:${h - m.b - 168}px;height:164px;background:var(--papier);border:3px solid var(--encre);box-shadow:3px 3px 0 var(--encre);z-index:4"><small style="font:700 11px Archivo;letter-spacing:1px;margin:6px;display:block">TES PIÈCES</small></div>${piece(60, h - m.b - 100, "#5DBB63")}${piece(170, h - m.b - 100, "#FFD23F")}${piece(280, h - m.b - 100, "#9B6BD6")}`;
  },
  ecrans: [
    { cle: "accueil-ordi", titre: "Accueil — ordinateur, 1 440 × 900", l: 1440, h: 900, avant: "blocks-accueil/1440x900", gabarit: "accueil" },
    { cle: "accueil-paysage", titre: "Accueil — téléphone en paysage, 844 × 390", l: 844, h: 390, avant: "blocks-accueil/844x390", gabarit: "accueil" },
    { cle: "accueil-portrait", titre: "Accueil — téléphone en portrait, 390 × 844", l: 390, h: 844, avant: "blocks-accueil/390x844", gabarit: "accueil" },
    { cle: "arrivee-ordi", titre: "Arrivée — ordinateur", l: 1440, h: 900, avant: "blocks-arrivee/1440x900", gabarit: "arrivee", note: "L'arrivée de la capture est l'écran d'essai du jeu (`?scenario=partage`) : « Partie d'essai : non classée ». La mise en page est celle d'une vraie partie." },
    { cle: "arrivee-portrait", titre: "Arrivée — téléphone en portrait", l: 390, h: 844, avant: "blocks-arrivee/390x844", gabarit: "arrivee" },
    { cle: "pause", titre: "Pause — téléphone en paysage", l: 844, h: 390, avant: "blocks-pause/844x390", gabarit: "pause" },
    { cle: "reglages", titre: "Réglages — téléphone en portrait", l: 390, h: 844, avant: "blocks-reglages/390x844", gabarit: "reglages" },
    { cle: "classement", titre: "Classement — téléphone en portrait", l: 390, h: 844, avant: "blocks-classement/390x844", gabarit: "classement" },
    { cle: "hud-paysage", titre: "En partie — téléphone en paysage", l: 844, h: 390, avant: "blocks-partie/844x390", gabarit: "enPartie" },
    { cle: "hud-portrait", titre: "En partie — téléphone en portrait", l: 390, h: 844, avant: "blocks-partie/390x844", gabarit: "enPartie" },
  ],
  intro: "Blocks, le jeu de grille 8 × 8 : étiquette bleue dans sa coque marine, police Rubik Mono One, blocs du module commun. Le défaut de fond est en portrait : la grille est collée en haut, les pièces en bas, et le milieu ne porte qu'une phrase d'aide.",
  legende: [
    ...pick("jouerAncre", "ordiLarge", "pauseDeux", "arriveeOrdre", "arriveeSuivant"),
    { k: "bientot", t: "« Bientôt » est écrit à 12 px, pas à 11,7.", d: "« Archives · bientôt » garde le style pointillé et passe en une ligne à 12 px au moins ; il n'est jamais une cible morte de 44 px sans le dire.", ref: "Constat B2.", m: [] },
    ...pick("hudBande"),
    { k: "portrait", t: "Portrait : la grille descend, le décor monte.", d: "Au lieu de coller la grille en haut et de laisser un trou au milieu, le haut de l'écran porte le chantier (la grue, les engins) et l'aide d'une ligne ; la grille se pose juste au-dessus des pièces, à portée du pouce, et les pièces gagnent 24 px de hauteur.", ref: "Constat B1.", m: [] },
    ...pick("hudPlaques"),
    { k: "hudCommandes", t: "Plateau de pièces dans la marge, plaques alignées.", d: "En paysage, score et combo se rangent dans la marge de gauche (47 px) et le plateau des pièces dans celle de droite : la grille reste au centre, rien ne flotte à 122 px du bord. Les pièces se prennent au doigt : le plateau reste à droite, hors du chemin de la grille.", ref: "Charte § 9 (commandes aux bords).", m: [["plat", "HUD commun"]] },
  ],
};

// ------------------------------------------------------------------ RUSH
const rush = {
  id: "rush", nom: "RUSH", nomCourt: "Rush", cls: "n-rush", fond: "#D9C4F0", texte: "#2A1E16", bouton: "#2A1E16", boutonTexte: "#D9C4F0", boutonOmbre: "#4B2E83", coque: true, coqueCouleur: "#4B2E83",
  motif: "", numero: 11, sous: "Partie n° 11 · Prairie", jouer: "Jouer", classes: 8,
  liens: ["Comment jouer", "Archives · bientôt", "Réglages"], pause: ["Fantôme : aucun"], reglagesOnglets: ["Affichage", "Son", "Commandes"], lienClassement: "Prochaine partie dans 14:18:45",
  tuiles: [["Ton record", "—", "Pas encore joué aujourd'hui"], ["Ta série", "0 jour", "", true]],
  meds: [["diamant", "Diamant", "2:44,83"], ["or", "Or", "4:07,25"], ["argent", "Argent", "5:29,66"], ["bronze", "Bronze", "8:14,50"]],
  classement: [[1, "Démo Gaufre", "2:44,83"], [2, "Démo Zéphyr", "10:00,00"], [3, "Démo Crabe", "10:00,00"]],
  moi: ["—", "Toi", "pas encore"],
  scene: sceneRush, sceneJeu: sceneRush,
  apercu: () => `<div style="height:120px;display:grid;place-items:center"><svg viewBox="0 0 120 80" style="height:100%"><circle cx="60" cy="50" r="22" fill="#E7E9F3" stroke="#2A1E16" stroke-width="3"/><circle cx="52" cy="46" r="5" fill="#fff" stroke="#2A1E16" stroke-width="2"/><circle cx="68" cy="46" r="5" fill="#fff" stroke="#2A1E16" stroke-width="2"/><path d="M60 22l4 8h-8z" fill="#D7263D"/><path d="M82 28l6 40" stroke="#2A1E16" stroke-width="5"/></svg></div>`,
  aujourdhui: (c) => `<div class="pan"><h3>Aujourd'hui · Prairie</h3><p style="margin:0;font:600 15px/1.35 Archivo">Suis le chemin jusqu'à l'arène. Le boss t'attend.</p></div>`,
  arrivee: { titre: "Partie terminée", temps: "1:05,00", unite: "", etiquette: "Partie d'essai", sousEtiquette: "non classée", med: ["diamant", "Médaille diamant", "Le Diamant : 2:44,83 (foncer)"], place: "—", suivant: "Jeu suivant du jour : Track",
    droite: `<div class="pan"><h3>Ta partie</h3>${[["Boss du jour", "Reine gelée"], ["Compétence", "Tourbillon"], ["Cartes choisies", "Lame lourde, Moulinet, Esquive vive, Maîtrise"]].map(([a, b]) => `<div class="lg" style="min-height:34px;align-items:flex-start;padding:5px 0"><span class="nom" style="white-space:normal">${a}</span><span style="font:700 13px Archivo;text-align:right;max-width:60%">${b}</span></div>`).join("")}</div><div class="pan"><h3>Médailles du jour</h3><div class="meds"><div class="md diamant ok">Diamant<b>2:44,83</b></div><div class="md or">Or<b>4:07,25</b></div><div class="md argent">Argent<b>5:29,66</b></div><div class="md bronze">Bronze<b>8:14,50</b></div></div></div>` },
  hud(l, h, m) {
    const g = this, pay = l > h;
    const coeurs = `<div class="pastille-h" style="gap:8px;width:auto;padding:0 10px;white-space:nowrap;position:static"><span style="color:#D7263D;font-size:16px">♥ ♥ ♥</span><span style="font:700 12px 'JetBrains Mono'">Nv 1</span><span style="width:64px;height:10px;border:2px solid var(--encre);background:#fff;display:inline-block;position:relative"><i style="position:absolute;inset:0 70% 0 0;background:var(--moutarde)"></i></span></div>`;
    const rond = (x, y, d, txt, cls = "") => `<div class="touche r ${cls}" style="left:${x}px;top:${y}px;width:${d}px;height:${d}px;font-size:${d > 90 ? 14 : 12}px">${txt}</div>`;
    const joy = (x, y, d) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${d}px;height:${d}px;border-radius:50%;border:3px solid rgba(42,30,22,.75);background:rgba(255,246,224,.35);z-index:4"><i style="position:absolute;left:${d * .3}px;top:${d * .3}px;width:${d * .4}px;height:${d * .4}px;border-radius:50%;background:var(--papier);border:2px solid var(--encre)"></i></div>`;
    if (pay) {
      return `<div class="bande">0:03,00<span class="sep"></span>Tués 0${abs(g, "hudBande", -12, -14)}</div>
        ${plq(g, "hudPlaques", m.g, 8, "pause")}${plq(g, "", m.g + 50, 8, "fantome")}<div style="position:absolute;left:${m.g}px;top:58px;z-index:4">${coeurs}${abs(g, "rushCoeurs", 168, -10)}</div>
        <div class="pastille-h" style="left:${l / 2 - 62}px;top:44px">↖ BOSS 152 m${abs(g, "rushBoss", 112, -12)}</div>
        ${joy(m.g, 253, 108)}${abs(g, "hudCommandes", m.g + 94, 240)}${rond(l - m.d - 72, 196, 72, "✸")}${rond(l - m.d - 72 - 10 - 96, 270, 96, "COUP", "fort")}${rond(l - m.d - 72, 287, 72, "ESQUIVE")}`;
    }
    return `${plq(g, "hudPlaques", 10, m.t + 6, "pause")}${plq(g, "", 60, m.t + 6, "fantome")}<div class="bande" style="top:${m.t + 12}px;left:auto;right:10px;transform:none">0:03,00<span class="sep"></span>Tués 0${abs(g, "hudBande", -12, -14)}</div>
      <div style="position:absolute;left:10px;top:${m.t + 58}px;z-index:4">${coeurs}</div><div class="pastille-h" style="left:${l / 2 - 62}px;top:${m.t + 100}px">↖ BOSS 152 m</div>
      ${joy(14, h - m.b - 130, 116)}${rond(l - 14 - 72, h - m.b - 290, 72, "✸")}${rond(l - 14 - 72 - 10 - 100, h - m.b - 170, 100, "COUP", "fort")}${rond(l - 14 - 72, h - m.b - 100, 72, "ESQUIVE")}`;
  },
  ecrans: [
    { cle: "accueil-ordi", titre: "Accueil — ordinateur, 1 440 × 900", l: 1440, h: 900, avant: "rush-accueil/1440x900", gabarit: "accueil" },
    { cle: "accueil-paysage", titre: "Accueil — téléphone en paysage, 844 × 390", l: 844, h: 390, avant: "rush-accueil/844x390", gabarit: "accueil" },
    { cle: "accueil-portrait", titre: "Accueil — téléphone en portrait, 390 × 844", l: 390, h: 844, avant: "rush-accueil/390x844", gabarit: "accueil" },
    { cle: "arrivee-ordi", titre: "Arrivée — ordinateur", l: 1440, h: 900, avant: "rush-arrivee/1440x900", gabarit: "arrivee", note: "L'arrivée de la capture est l'écran d'essai du jeu (`?scenario=fin`) : « Partie d'essai : non classée »." },
    { cle: "arrivee-portrait", titre: "Arrivée — téléphone en portrait", l: 390, h: 844, avant: "rush-arrivee/390x844", gabarit: "arrivee" },
    { cle: "pause", titre: "Pause — téléphone en paysage", l: 844, h: 390, avant: "rush-pause/844x390", gabarit: "pause" },
    { cle: "reglages", titre: "Réglages — téléphone en portrait", l: 390, h: 844, avant: "rush-reglages/390x844", gabarit: "reglages" },
    { cle: "classement", titre: "Classement — téléphone en portrait", l: 390, h: 844, avant: "rush-classement/390x844", gabarit: "classement" },
    { cle: "hud-paysage", titre: "En partie — téléphone en paysage", l: 844, h: 390, avant: "rush-partie/844x390", gabarit: "enPartie" },
    { cle: "hud-portrait", titre: "En partie — téléphone en portrait", l: 390, h: 844, avant: "rush-partie/390x844", gabarit: "enPartie" },
  ],
  intro: "Rush, le hack and slash à déplacement libre : étiquette lilas dans sa coque violette, police Bungee, joystick à gauche et actions à droite (révision 17). C'est le seul jeu dont le HUD n'a pas la bande de 30 px : une barre crème de 52 px sur toute la largeur et de grosses plaques de cœurs prennent le haut du monde.",
  legende: [
    ...pick("jouerAncre", "ordiLarge", "pauseDeux", "arriveeOrdre", "arriveeSuivant"),
    { k: "bientot", t: "« Bientôt » à 12 px.", d: "Même correction que Blocks : une ligne à 12 px, pointillés gardés.", ref: "Constat R2.", m: [] },
    { k: "hudBande", t: "La barre de 52 px devient la bande de 30 px.", d: "Chrono et « Tués » se rangent dans la bande centrale du kit ; pause et fantôme redeviennent deux plaques de 44 px à gauche. Le monde gagne 22 px de hauteur et le bord haut n'est plus une barre pleine largeur.", ref: "Charte § 9 (une seule bande de 30 px).", m: [["plat", "HUD commun"]] },
    ...pick("hudPlaques"),
    { k: "rushCoeurs", t: "Cœurs, niveau et XP sur une seule plaque.", d: "Trois plaques de 160 × 60 (cœurs, « Nv 1 », barre d'XP) couvraient le coin haut gauche du monde ; une plaque de 30 px les range sur une ligne. Les cœurs restent en rouge : ce rouge n'annonce pas un danger mais une vie, et le texte « Nv » est écrit.", ref: "Planche ; charte § 3.4 (le rouge réservé aux dangers : à garder en tête).", m: [] },
    { k: "rushBoss", t: "La flèche du boss est collée sous la bande.", d: "« ↖ BOSS 152 m » reste au centre, juste sous la bande, et tourne vers l'arène ; ce n'est plus une plaque de 160 px posée au milieu du monde.", ref: "Planche.", m: [] },
    { k: "hudCommandes", t: "Joystick, compétence, Coup, Esquive dans les marges.", d: "Le joystick (108 px) reste en bas à gauche, hors de la marge de 47 px ; Coup (96 px) est l'action principale, Esquive (70) et la compétence (76) sont autour : les trois ne se recouvrent pas et ne dépassent pas la marge de droite.", ref: "Charte § 9, révision 17.", m: [["plat", "HUD commun"]] },
  ],
};

export const JEUX = { track, jump, tower, blocks, rush };

export const comparaison = {
  intro: "<p>Les cinq jeux côte à côte : l'accueil et l'arrivée, avant (captures du 12 novembre 2026) et après (propositions). Ce qui doit être <b>commun</b> — place des boutons, chrono, médailles, partage — est proposé une seule fois, au kit et à la charte ; ce qui fait l'<b>identité</b> de chaque jeu (couleur, police, motif, aperçu, panneau « Aujourd'hui », commandes) reste propre à chacun.</p><p>Les sources sont les mêmes que celles des cinq maquettes d'interface (<code>docs/relectures/maquettes/jeux/src/</code>).</p>",
  sections: [
    { sujet: "accueil", l: 1440, h: 900, aff: 470, gabarit: "accueil", titre: "Accueil — ordinateur, 1 440 × 900", note: "Aujourd'hui l'étiquette de Tower, Blocks et Rush occupe 40 % de la largeur à la taille du téléphone, et celle de Track est la seule à trois colonnes. Les cinq passent à la même grille : identité à gauche, « Aujourd'hui » et classement à droite, « Jouer » de 62 px.", commun: "La barre « ‹ DU JOUR », l'étiquette bornée à 1 160 px, la grille à deux colonnes, « Jouer » de 62 px sous les tuiles, les trois liens en rangée, le classement à cinq lignes avec ta ligne en moutarde (en encre sur Jump), le pied « Prochaine partie · Mon profil ».", identite: "La couleur, la police et le motif du jeu (livrée de Track, coque de Jump, Tower, Blocks, Rush), l'aperçu (tracé, niveau, tour, blocs, chevalier), le panneau « Aujourd'hui » (Salon, fantôme et morts, paliers, mot du jour) et le mot du bouton (« Courir » ou « Jouer »)." },
    { sujet: "accueil", l: 390, h: 844, aff: 300, gabarit: "accueil", titre: "Accueil — téléphone en portrait, 390 × 844", note: "Les cinq accueils portrait sont déjà proches : « Jouer » est visible sans défiler. Les différences viennent des médailles (absentes de Jump) et de l'ordre des blocs.", commun: "Ordre : tuiles (record, série) → médailles écrites → « Jouer » → liens → « Aujourd'hui » → classement → pied.", identite: "Tout ce qui est dans la coque : couleur, police, illustration, panneau « Aujourd'hui »." },
    { sujet: "arrivee", l: 1440, h: 900, aff: 470, gabarit: "arrivee", titre: "Arrivée — ordinateur", note: "Aujourd'hui chaque jeu a sa propre arrivée : Track et Jump en une colonne de résultats, Tower en deux colonnes avec trois tuiles, Blocks et Rush en une carte étroite sans place ni « Jeu suivant ». Les cinq passent au même ordre.", commun: "Temps ou score en grand → médaille avec son nom et le palier suivant → place du jour (ou « — » hors classement) → Rejouer plein, Partager et le bouton propre au jeu → « Jeu suivant du jour » ancré en bas.", identite: "Le contenu du panneau de droite (classement, « Ta partie » de Tower, boss et cartes de Rush, médailles de Blocks), l'étiquette du résultat (« Nouveau record du jour », « Hauteur stable »), l'autocollant « 0 mort » de Jump." },
    { sujet: "arrivee", l: 390, h: 844, aff: 300, gabarit: "arrivee", titre: "Arrivée — téléphone en portrait", note: "Sur téléphone l'arrivée tient dans l'écran, « Jeu suivant du jour » ancré en bas avec la marge de 34 px ; le classement défile en dessous.", commun: "L'ordre ci-dessus, en une colonne ; la plaque « Jeu suivant du jour » ancrée.", identite: "Les mêmes éléments que sur ordinateur." },
  ],
  legende: `<ol class="legende"><li><b>« Jouer » ancré en bas (J1).</b> Une barre d'actions propre au kit, dans les cinq accueils en paysage. <span class="marque plat">kit</span></li><li><b>L'étiquette de grand écran.</b> Bornée à 1 160 px, titre à 72 px, même grille dans les cinq jeux. <span class="marque plat">kit</span></li><li><b>L'ordre de l'arrivée et « Jeu suivant du jour ».</b> Un seul composant d'arrivée au kit, qui reçoit le panneau propre au jeu. <span class="marque plat">kit</span></li><li><b>La pause en deux colonnes.</b> Un seul dialogue de pause pour les cinq. <span class="marque plat">kit</span></li><li><b>La bande de 30 px, les plaques de 44 px, les marges de l'iPhone.</b> HUD commun, posé par le kit. <span class="marque plat">HUD commun</span></li></ol>`,
};
