// Lot 41 — construit la planche de maquettes du Garage : `node docs/lots/lot-41-garage/planche.mjs` lit planche.src.html, les feuilles du jeu (@cdj/ui :
// jetons, socle, composants, cadre, polices ; Track : interface, accueil, arrivée), la feuille proposée garage.css et les images de img/ (la vraie scène
// du palier 1 et les vraies voitures, rendues par le jeu), et écrit maquettes.html : un seul fichier, qui s'ouvre sans serveur et sans réseau.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, "../../..");
const lire = (p) => readFileSync(join(RACINE, p), "utf8");
const image = (nom) => `data:image/webp;base64,${readFileSync(join(ICI, "img", `${nom}.webp`)).toString("base64")}`;

// --- Polices (les faces de Track), en ligne -----------------------------------------------------------------------------------------------------
const FACES = ["archivo-black-400", "archivo-400", "archivo-600", "archivo-700", "jetbrains-mono-700", "barlow-condensed-600", "barlow-condensed-700-italique", "barlow-condensed-800-italique"];
const polices = FACES.map((f) =>
  lire(`packages/ui/src/polices/${f}.css`).replace(/url\("\.\.\/\.\.\/polices\/([^"]+)"\)/g, (_, fichier) => `url("data:font/woff2;base64,${readFileSync(join(RACINE, "packages/ui/polices", fichier)).toString("base64")}")`),
).join("\n");

// --- Les feuilles du jeu ------------------------------------------------------------------------------------------------------------------------------
const FEUILLES = ["packages/ui/src/jetons.css", "packages/ui/src/socle.css", "packages/ui/src/composants.css", "packages/ui/src/cadre.css", "apps/web/src/interface.css", "apps/web/src/accueil.css", "apps/web/src/arrivee.css", "docs/lots/lot-41-garage/garage.css"];
// Les règles `body:has(…)` du jeu effacent ce qui n'est pas un écran : inutiles (et gênantes) dans un cadre de maquette.
const feuilles = FEUILLES.map((f) => lire(f).replaceAll("body:has(", "body.jamais:has(")).join("\n");
const cssJeu = `${polices}\n${feuilles}
/* La maquette : la scène (une image rendue par le jeu) à la place du canvas. */
html, body { overflow: hidden; }
.scene-maquette { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
body.paused #pause { z-index: var(--z-pause); }
`;

// --- Les données de l'exemple -------------------------------------------------------------------------------------------------------------------
const PALETTE = [
  ["orange", 0xe8552d],
  ["grenat", 0xa3264f],
  ["fuchsia", 0xd63aa6],
  ["glycine", 0xc9a0dc],
  ["petrole", 0x2e86a6],
  ["lagon", 0x7fd6e0],
  ["olive", 0x7d8a2e],
  ["poudre", 0xe0a3a0],
];
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => 0.2126 * lin((hex >> 16) & 255) + 0.7152 * lin((hex >> 8) & 255) + 0.0722 * lin(hex & 255);
const contraste = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
// La coche se dessine en asphalte ou en crème, celle qui contraste le plus avec la couleur.
const sombre = (hex) => contraste(luminance(hex), luminance(0xf4efe6)) > contraste(luminance(hex), luminance(0x1e1b19));
const hex6 = (n) => `#${n.toString(16).padStart(6, "0").toUpperCase()}`;

const VOITURES = ["civile", "evolution", "gt", "proto"];
// Le joueur de l'exemple : 4 jours joués, 3 avec l'or, aucun auteur.
const REGLES = { civile: null, evolution: { cle: "or", n: 3, fait: 3 }, gt: { cle: "jours", n: 10, fait: 4 }, proto: { cle: "auteur", n: 1, fait: 0 } };
const debloquee = (id) => !REGLES[id] || REGLES[id].fait >= REGLES[id].n;

// --- Icônes (au trait, comme celles de Track : src/icones.ts) ---------------------------------------------------------------------------------
const icone = (traces, taille = 18, classe = "") =>
  `<svg class="dj-icone ${classe}" viewBox="0 0 24 24" width="${taille}" height="${taille}" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${traces.map((d) => `<path d="${d}"/>`).join("")}</svg>`;
const I = {
  chevron: ["M15 4 7 12l8 8"],
  voiture: ["M2 16v-4l4-1 3-4h7l4 4 2 1v4h-2", "M9 16h6", "M7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z", "M17 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"],
  cadenas: ["M6 11h12v10H6z", "M8.5 11V8a3.5 3.5 0 0 1 7 0v3"],
  coche: ["M5 12.5 10 17l9-10"],
  tourner: ["M21 12c0 2.2-4 4-9 4s-9-1.8-9-4 4-4 9-4", "M16 5l3 3-3 3"],
  pleinEcran: ["M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"],
};
const motif = (m) => {
  const caisse = `<path d="M2 13V10l5-1 4-4h11l5 4 5 1v3z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="13.5" r="2.6" fill="currentColor"/><circle cx="25" cy="13.5" r="2.6" fill="currentColor"/>`;
  const raies = m === "bande" ? "M15 5l-2 4M18 5l-2 4M21 5l-2 4" : m === "flancs" ? "M19 9l-2 4M22 9l-2 4M16 9l-2 4" : "";
  return `<svg class="garage-motif" viewBox="0 0 34 18" aria-hidden="true">${caisse}${raies ? `<path d="${raies}" stroke="currentColor" stroke-width="1.6" fill="none"/>` : ""}</svg>`;
};

// --- Morceaux d'écran -------------------------------------------------------------------------------------------------------------------------------
const barreTrack = `<header class="dj-barre-jeu"><button class="dj-barre-jeu__retour" type="button" data-t-aria-label="garage.retour">${icone(I.chevron)}<span class="dj-logo dj-logo--petit">TRACK</span></button><span class="dj-barre-jeu__jour" data-t="barre.jour"></span></header>`;
const barrePortail = (plein) =>
  `<header class="dj-barre-jeu"><a class="dj-barre-jeu__retour" href="#" data-t-aria-label="barre.retour.aria">${icone(I.chevron)}<span class="dj-logo dj-logo--petit">DU JOUR</span></a><span class="dj-barre-jeu__droite"><span class="dj-barre-jeu__jour" data-t="barre.jour"></span>${plein ? `<button class="dj-plein-ecran dj-plein-ecran--icone dj-plein-ecran--barre" type="button" data-t-aria-label="pleinEcran">${icone(I.pleinEcran, 20)}</button>` : ""}</span></header>`;

function progres(id, avecNombre = true) {
  const r = REGLES[id];
  const cases = Array.from({ length: r.n }, (_, i) => `<span class="garage-progres__case${i < r.fait ? " garage-progres__case--pleine" : ""}"></span>`).join("");
  return `<span class="garage-progres">${icone(I.cadenas, 14)}<span class="garage-progres__cases">${cases}</span>${avecNombre ? `<span>${r.fait}/${r.n}</span>` : ""}</span>`;
}

function carte(id, choisie, regardee, horsLigne) {
  const ok = debloquee(id);
  const tienne = id === choisie;
  const nouveau = id === "evolution" && choisie !== "evolution";
  const img = image(ok ? `vignette-${id}-0-bande` : `vignette-${id}-sil`);
  let etat;
  if (tienne) etat = `${icone(I.coche, 14)}<span data-t="garage.tienne"></span>`;
  else if (nouveau) etat = `<span class="garage-pastille garage-pastille--nouveau" data-t="garage.nouveau"></span>`;
  else if (ok) etat = `<span data-t="garage.debloquee"></span>`;
  else if (horsLigne) etat = `${icone(I.cadenas, 14)}<span data-t="garage.verrouillee"></span>`;
  else etat = progres(id);
  return `<li><button class="garage-voiture${ok ? "" : " garage-voiture--verrouillee"}" type="button" aria-current="${id === regardee}"${ok ? "" : ' aria-disabled="true"'}>
    <img class="garage-voiture__image" alt="" src="${img}">
    <span class="garage-voiture__nom" data-t="voiture.${id}.nom"></span>
    <span class="garage-voiture__etat">${etat}</span></button></li>`;
}

function fiche(id, choisie, horsLigne) {
  const ok = debloquee(id);
  const etat = id === choisie ? `${icone(I.coche, 14)}<span data-t="garage.tienne"></span>` : ok ? `<span data-t="garage.debloquee"></span>` : `${icone(I.cadenas, 14)}<span data-t="garage.verrouillee"></span>`;
  const r = REGLES[id];
  const suite = ok
    ? `<p class="garage-fiche__description" data-t="voiture.${id}.description"></p>`
    : `<p class="garage-fiche__condition" data-t="garage.condition.${r.cle}"></p>${horsLigne ? "" : `<div class="garage-progres">${progres(id, false).replace(/^<span class="garage-progres">|<\/span>$/g, "")}<span data-t="garage.progres.${id}"></span></div>`}`;
  return `<section class="garage-fiche etiquette dj-sombre" aria-live="polite"><div class="etiquette__corps">
    <p class="garage-fiche__etat">${etat}</p>
    <h2 class="garage-fiche__nom" data-t="voiture.${id}.nom"></h2>
    ${suite}
    <p class="garage-fiche__tourner">${icone(I.tourner, 16)}<span data-t="garage.tourner"></span></p></div></section>`;
}

function perso(couleur, m) {
  const pastilles = PALETTE.map(
    ([id, hex], i) =>
      `<button class="garage-couleur${sombre(hex) ? " garage-couleur--sombre" : ""}" type="button" role="radio" aria-checked="${i === couleur}" style="--teinte: ${hex6(hex)}" data-t-aria-label="couleur.${id}">${icone(I.coche, 22)}</button>`,
  ).join("");
  const motifs = ["bande", "flancs", "unie"].map((x) => `<button class="segment__bouton" type="button" role="radio" aria-checked="${x === m}">${motif(x)}<span data-t="motif.${x}"></span></button>`).join("");
  return `<section class="garage-perso">
    <div class="garage-perso__titre"><h2 class="home-section" data-t="garage.couleur"></h2><span class="note" data-t="couleur.${PALETTE[couleur][0]}"></span></div>
    <div class="garage-couleurs" role="radiogroup" data-t-aria-label="garage.couleur">${pastilles}</div>
    <div class="garage-perso__motif"><h2 class="home-section" data-t="garage.motif"></h2>
    <div class="segment garage-motifs" role="radiogroup" data-t-aria-label="garage.motif">${motifs}</div></div></section>`;
}

function garage(choisie, couleur, m, regardee, option) {
  const horsLigne = option === "horsligne";
  const n = VOITURES.filter(debloquee).length;
  return `<div id="garage" class="cadre cadre--haut garage" role="dialog" aria-modal="true" data-t-aria-label="garage.titre">${barreTrack}
  <div class="cadre__defile"><main class="etiquette dj-sombre"><div class="etiquette__corps">
    <div class="etiquette__tete"><h1 class="etiquette__titre" data-t="garage.titre"></h1><p class="etiquette__sous-titre" data-t="garage.sousTitre.${n}"></p></div>
    ${horsLigne ? '<p class="note note--erreur" data-t="garage.horsLigne"></p>' : ""}
    <ul class="garage-voitures">${VOITURES.map((id) => carte(id, choisie, regardee, horsLigne)).join("")}</ul>
    ${perso(couleur, m)}
    <p class="garage-note" data-t="garage.equitable"></p>
  </div></main></div>
  <div class="garage__scene">${fiche(regardee, choisie, horsLigne)}</div></div>`;
}

const MEDAILLES = [
  ["auteur", "36,892"],
  ["or", "39,843"],
  ["argent", "44,270"],
  ["bronze", "51,649"],
];
const LIGNES = [
  ["Démo Orage", "auteur", "36,219"],
  ["Démo Crabe", "or", "37,314"],
  ["Démo Mulot", "or", "37,872"],
  ["Démo Marmotte", "or", "38,575"],
  ["Démo Fusée", "or", "39,552"],
];
const accueil = `<div id="home" class="cadre accueil" role="dialog" aria-modal="true" data-t-aria-label="accueil.aria">${barrePortail(true)}
<div class="cadre__defile"><main class="etiquette dj-sombre"><div class="etiquette__corps">
  <div class="etiquette__tete"><h1 class="etiquette__titre home-nom">TRACK</h1><p class="etiquette__sous-titre home-circuit" data-t="accueil.sousTitre"></p>
    <button class="dj-bouton dj-bouton--secondaire home-garage" type="button">${icone(I.voiture, 20)}<span data-t="garage.titre"></span><span class="garage-pastille garage-pastille--nouveau" data-t="garage.nouveau"></span></button></div>
  <div class="home-grille">
    <div class="home-col home-col--a"><div class="home-apercu" role="img"><img alt="" src="${image("trace")}"></div>
      <div class="mine home-resume"><span class="label note" data-t="accueil.pasCourse"></span></div>
      <div class="home-medailles" role="group">${MEDAILLES.map(([m, v]) => `<div class="dj-medaille dj-medaille--case dj-medaille--${m} dj-medaille--pas-encore dj-medaille--track" role="group"><span class="dj-medaille__nom" data-t="medaille.${m}"></span><span class="dj-medaille__valeur">${v}&nbsp;s</span></div>`).join("")}</div></div>
    <div class="home-col home-col--b"><section class="card board-card home-classement"><div class="home-classement__tete"><h2 class="home-section" data-t="palmares.titreJour"></h2></div>
      <div class="board-body"><div class="rows lignes">${LIGNES.map(([nom, m, t], i) => `<div class="row ligne"><span class="rank ligne__rang">${i + 1}</span><span class="who ligne__nom">${nom}</span><span class="icon ligne__medaille"><span class="dj-medaille dj-medaille--pastille dj-medaille--${m} dj-medaille--obtenue dj-medaille--track" role="img"><span class="dj-medaille__pastille" aria-hidden="true"></span><span class="dj-medaille__nom" aria-hidden="true" data-t="medaille.${m}"></span></span></span><span class="time ligne__temps">${t}&nbsp;s</span></div>`).join("")}</div></div>
      <button class="lien home-classement__tout" type="button" data-t="palmares.tout"></button></section></div>
    <div class="home-col home-col--c"><section class="card salon home-salon"><h2 class="home-section" data-t="accueil.salon.titre"></h2><p class="note" data-t="accueil.salon.lead"></p><div class="salon-state"><p class="status" data-t="accueil.salon.etat"></p></div><button class="dj-bouton dj-bouton--secondaire play-salon" type="button" data-t="accueil.salon.rejoindre"></button></section>
      <nav class="links home-liens"><button class="dj-bouton dj-bouton--secondaire" type="button" data-t="accueil.archives"></button><button class="dj-bouton dj-bouton--secondaire" type="button" data-t="accueil.reglages"></button><button class="dj-bouton dj-bouton--secondaire" type="button" data-t="accueil.aide"></button><a class="dj-bouton dj-bouton--secondaire" href="#" data-t="accueil.profil"></a></nav></div>
  </div>
  <div class="home-actions"><button class="dj-bouton dj-bouton--track dj-bouton--large play-daily" type="button" data-t="accueil.courir"></button></div>
</div></main><div class="cadre__pied"></div></div></div>`;

const arrivee = `<div id="finish" class="cadre" role="dialog" aria-modal="true" data-t-aria-label="arrivee.titre">${barrePortail(false)}
<div class="cadre__defile"><main class="etiquette dj-sombre"><div class="etiquette__corps arrivee">
  <div class="etiquette__tete"><h1 class="etiquette__titre" data-t="arrivee.titre"></h1><span class="etiquette__sous-titre arrivee__circuit" data-t="arrivee.circuit"></span></div>
  <div class="arrivee__grille">
    <div class="arrivee__colonne">
      <div class="arrivee__resultat"><div class="big temps arrivee__temps">39,513<span class="arrivee__unite">&nbsp;s</span></div>
        <div class="record arrivee__badges"><span class="arrivee__badge arrivee__badge--ok" data-t="arrivee.record"></span><span class="arrivee__ecart arrivee__ecart--devant">−0,412</span></div></div>
      <div class="arrivee__bloc"><div class="medal arrivee__medaille"><div class="arrivee__medaille-nom arrivee__medaille-nom--or"><span class="pastille pastille--or" aria-hidden="true"></span><span class="arrivee__medaille-texte" data-t="arrivee.medailleOr"></span></div><div class="arrivee__auteur"><span class="arrivee__auteur-legende" data-t="medaille.auteur"></span><span class="chiffres arrivee__auteur-valeur" data-t="arrivee.auteurA"></span></div></div></div>
      <p class="arrivee__garage" role="status">${icone(I.voiture, 18)}<span data-t="arrivee.garage.nouvelle"></span><b data-t="voiture.evolution.nom"></b><button class="lien" type="button" data-t="arrivee.garage.voir"></button></p>
    </div>
    <div class="arrivee__colonne"><div class="actions arrivee__actions">
      <button class="dj-bouton dj-bouton--track dj-bouton--large" type="button" data-t="arrivee.recourir"></button>
      <button class="dj-bouton dj-bouton--secondaire arrivee__secondaire" type="button" data-t="arrivee.revoir"></button>
      <button class="dj-bouton dj-bouton--secondaire arrivee__secondaire" type="button" data-t="arrivee.partager"></button>
      <button class="dj-bouton dj-bouton--secondaire arrivee__secondaire" type="button" data-t="arrivee.accueil"></button></div></div>
  </div>
</div></main>
<div class="cadre__pied"><div class="next arrivee__suite"><span class="arrivee__legende" data-t="arrivee.reste"></span><a class="dj-bouton dj-bouton--marque dj-bouton--large" href="#" data-t="arrivee.jeuSuivant"></a></div></div></div></div>`;

// --- Les textes (fr / en) : ceux du jeu (catalogues actuels) et ceux proposés pour le Garage ---------------------------------------------------------
const TEXTES = {
  fr: {
    "barre.jour": "Ven. 23 oct. · n° 11",
    "barre.retour.aria": "Retour au portail Du Jour",
    pleinEcran: "Plein écran",
    "accueil.aria": "Accueil de Track",
    "accueil.sousTitre": "Circuit du jour · Stade",
    "accueil.pasCourse": "Tu n'as pas encore couru aujourd'hui.",
    "medaille.auteur": "Auteur",
    "medaille.or": "Or",
    "medaille.argent": "Argent",
    "medaille.bronze": "Bronze",
    "palmares.titreJour": "Classement du jour · 12 pilotes",
    "palmares.tout": "Tout le classement",
    "accueil.salon.titre": "Salon",
    "accueil.salon.lead": "Un nouveau circuit toutes les 10 minutes, avec les fantômes des autres joueurs et un classement de session.",
    "accueil.salon.etat": "En cours : Ville · prochain circuit dans 09:46 · 3 joueurs présents",
    "accueil.salon.rejoindre": "Rejoindre le Salon",
    "accueil.archives": "Archives",
    "accueil.reglages": "Réglages",
    "accueil.aide": "Comment jouer",
    "accueil.profil": "Mon profil Du Jour",
    "accueil.courir": "Courir",
    "pause.titre": "Pause",
    "pause.circuit": "Circuit n° 11 · Stade",
    "pause.record": "record",
    "pause.reprendre": "Reprendre",
    "pause.recommencer": "Recommencer",
    "pause.pointDeControle": "Dernier point de contrôle",
    "pause.fantome": "Fantôme · ton record",
    "pause.son": "Son : activé",
    "pause.camera": "Caméra proche",
    "pause.pleinEcran": "Plein écran",
    "pause.reglages": "Réglages",
    "pause.aide": "Comment jouer",
    "pause.archives": "Archives",
    "pause.accueil": "Accueil de Track",
    "arrivee.titre": "Arrivée",
    "arrivee.circuit": "Circuit n° 11 · Stade",
    "arrivee.record": "Nouveau record",
    "arrivee.medailleOr": "Médaille or",
    "arrivee.auteurA": "à 0,676",
    "arrivee.recourir": "Recourir",
    "arrivee.revoir": "Revoir le tour",
    "arrivee.partager": "Partager mon temps",
    "arrivee.accueil": "Accueil de Track",
    "arrivee.reste": "Il te reste aujourd'hui",
    "arrivee.jeuSuivant": "Jeu suivant du jour : Jump ›",
    // Garage (proposés)
    "garage.titre": "Garage",
    "garage.retour": "Fermer le Garage",
    "garage.sousTitre.2": "2 voitures sur 4",
    "garage.nouveau": "Nouveau",
    "garage.tienne": "Ta voiture",
    "garage.debloquee": "Débloquée",
    "garage.verrouillee": "Verrouillée",
    "garage.couleur": "Couleur",
    "garage.motif": "Motif",
    "garage.tourner": "Glisse pour tourner autour",
    "garage.equitable": "Toutes les voitures roulent pareil : seul le style change.",
    "garage.horsLigne": "Hors connexion : tes voitures débloquées restent là ; la progression reviendra avec le réseau.",
    "garage.condition.or": "Décroche l'or (ou l'auteur) sur 3 circuits du jour.",
    "garage.condition.jours": "Termine 10 circuits du jour.",
    "garage.condition.auteur": "Bats le temps de l'auteur sur un circuit du jour.",
    "garage.progres.evolution": "3/3 médailles d'or",
    "garage.progres.gt": "4/10 jours",
    "garage.progres.proto": "0/1 médaille d'auteur",
    "arrivee.garage.nouvelle": "Nouvelle voiture :",
    "arrivee.garage.voir": "Voir au Garage",
    "voiture.civile.nom": "Moineau",
    "voiture.evolution.nom": "Belette",
    "voiture.gt.nom": "Murène",
    "voiture.proto.nom": "Libellule",
    "voiture.civile.description": "Compacte cinq portes, hayon, petit becquet. À toi dès le premier jour.",
    "voiture.evolution.description": "Coupé trapu : passages de roue larges, aileron sur deux jambes, quatre phares ronds.",
    "voiture.gt.description": "GT basse et large : capot long, grand aileron sur cols de cygne.",
    "voiture.proto.description": "Prototype d'endurance : bulle étroite, ailes détachées, dérive.",
    "couleur.orange": "Orange Track",
    "couleur.grenat": "Grenat",
    "couleur.fuchsia": "Fuchsia",
    "couleur.glycine": "Glycine",
    "couleur.petrole": "Pétrole",
    "couleur.lagon": "Lagon",
    "couleur.olive": "Olive",
    "couleur.poudre": "Rose poudré",
    "motif.bande": "Bande",
    "motif.flancs": "Flancs",
    "motif.unie": "Unie",
  },
  en: {
    "barre.jour": "Fri, Oct 23 · #11",
    "barre.retour.aria": "Back to Du Jour",
    pleinEcran: "Full screen",
    "accueil.aria": "Track home",
    "accueil.sousTitre": "Today's track · Stadium",
    "accueil.pasCourse": "You haven't raced yet today.",
    "medaille.auteur": "Author",
    "medaille.or": "Gold",
    "medaille.argent": "Silver",
    "medaille.bronze": "Bronze",
    "palmares.titreJour": "Today's leaderboard · 12 drivers",
    "palmares.tout": "Full leaderboard",
    "accueil.salon.titre": "Room",
    "accueil.salon.lead": "A new track every 10 minutes, with other players' ghosts and a session leaderboard.",
    "accueil.salon.etat": "Now: City · next track in 09:46 · 3 players here",
    "accueil.salon.rejoindre": "Join the Room",
    "accueil.archives": "Archives",
    "accueil.reglages": "Settings",
    "accueil.aide": "How to play",
    "accueil.profil": "My Du Jour profile",
    "accueil.courir": "Race",
    "pause.titre": "Pause",
    "pause.circuit": "Track #11 · Stadium",
    "pause.record": "best",
    "pause.reprendre": "Resume",
    "pause.recommencer": "Restart",
    "pause.pointDeControle": "Last checkpoint",
    "pause.fantome": "Ghost · your best",
    "pause.son": "Sound: on",
    "pause.camera": "Close camera",
    "pause.pleinEcran": "Full screen",
    "pause.reglages": "Settings",
    "pause.aide": "How to play",
    "pause.archives": "Archives",
    "pause.accueil": "Track home",
    "arrivee.titre": "Finish",
    "arrivee.circuit": "Track #11 · Stadium",
    "arrivee.record": "New best",
    "arrivee.medailleOr": "Gold medal",
    "arrivee.auteurA": "0.676 off",
    "arrivee.recourir": "Race again",
    "arrivee.revoir": "Watch the lap",
    "arrivee.partager": "Share my time",
    "arrivee.accueil": "Track home",
    "arrivee.reste": "Still to play today",
    "arrivee.jeuSuivant": "Next game of the day: Jump ›",
    "garage.titre": "Garage",
    "garage.retour": "Close the Garage",
    "garage.sousTitre.2": "2 of 4 cars",
    "garage.nouveau": "New",
    "garage.tienne": "Your car",
    "garage.debloquee": "Unlocked",
    "garage.verrouillee": "Locked",
    "garage.couleur": "Colour",
    "garage.motif": "Livery",
    "garage.tourner": "Drag to turn it around",
    "garage.equitable": "Every car drives the same: only the look changes.",
    "garage.horsLigne": "Offline: your unlocked cars stay here; progress comes back with the network.",
    "garage.condition.or": "Get gold (or Author) on 3 daily tracks.",
    "garage.condition.jours": "Finish 10 daily tracks.",
    "garage.condition.auteur": "Beat the Author time on a daily track.",
    "garage.progres.evolution": "3/3 gold medals",
    "garage.progres.gt": "4/10 days",
    "garage.progres.proto": "0/1 Author medal",
    "arrivee.garage.nouvelle": "New car:",
    "arrivee.garage.voir": "See it in the Garage",
    "voiture.civile.nom": "Sparrow",
    "voiture.evolution.nom": "Weasel",
    "voiture.gt.nom": "Moray",
    "voiture.proto.nom": "Dragonfly",
    "voiture.civile.description": "Five-door hatchback with a small spoiler. Yours from day one.",
    "voiture.evolution.description": "Stocky coupé: wide arches, a wing on two legs, four round headlights.",
    "voiture.gt.description": "Low, wide GT: long bonnet, big swan-neck wing.",
    "voiture.proto.description": "Endurance prototype: narrow bubble, separate wings, a fin.",
    "couleur.orange": "Track orange",
    "couleur.grenat": "Garnet",
    "couleur.fuchsia": "Fuchsia",
    "couleur.glycine": "Wisteria",
    "couleur.petrole": "Petrol",
    "couleur.lagon": "Lagoon",
    "couleur.olive": "Olive",
    "couleur.poudre": "Powder pink",
    "motif.bande": "Stripe",
    "motif.flancs": "Sides",
    "motif.unie": "Plain",
  },
};

// --- Assemblage -------------------------------------------------------------------------------------------------------------------------------------
const SCENES = ["t-accueil", "d-accueil", "t-civile-0-bande", "t-civile-4-flancs", "t-evolution-0-bande", "t-gt-sil", "t-proto-sil", "d-civile-0-bande", "d-civile-4-flancs", "d-gt-sil"];
let html = lire("docs/lots/lot-41-garage/planche.src.html");
const jetonsPage = lire("packages/ui/src/jetons.css");
html = html
  .replace("/*@JETONS*/", () => jetonsPage)
  .replace("/*@POLICES*/", () => polices)
  .replaceAll("@ACCUEIL", () => accueil)
  .replaceAll("@ARRIVEE", () => arrivee)
  .replace(/@GARAGE\(([^)]*)\)/g, (_, a) => {
    const [choisie, couleur, m, regardee, option] = a.split(",");
    return garage(choisie, Number(couleur), m, regardee, option);
  })
  .replace(/@img\(([^)]+)\)/g, (_, nom) => image(nom))
  .replace("/*@CSS*/", () => cssJeu.replace(/<\/script/gi, "<\\/script"))
  .replace("/*@SCENES*/", () => JSON.stringify(Object.fromEntries(SCENES.map((s) => [s, image(s)]))))
  .replace("/*@TEXTES*/", () => JSON.stringify(TEXTES));
writeFileSync(join(ICI, "maquettes.html"), html);
console.log(`maquettes.html : ${(html.length / 1024).toFixed(0)} Kio`);
