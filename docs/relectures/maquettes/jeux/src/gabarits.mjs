// Lot QA2 : les gabarits des écrans « après » des jeux. Chaque fonction rend le corps HTML d'un écran à sa taille réelle (l, h) pour un jeu `g` (voir donnees.mjs).
// Ce qui est COMMUN (barre des jeux, « Jouer » toujours visible, ordre de l'arrivée, bande de HUD, plaques de 44 px) est écrit une fois ici ; ce qui fait l'IDENTITÉ d'un jeu (couleur, police, motif,
// aperçu, panneau « Aujourd'hui », commandes tactiles) vient de `g`.
const t = (d, plus = "") => `<svg viewBox="0 0 24 24" aria-hidden="true"${plus}>${d}</svg>`;
export const IC = {
  pause: t('<path d="M8 5v14M16 5v14"/>'),
  drapeau: t('<path d="M6 21V4M6 5h11l-2.500 3.500L17 12H6"/>'),
  relance: t('<path d="M4 12a8 8 0 1 0 3-6.200M4 4v5h5"/>'),
  camera: t('<path d="M3.500 8h3l1.500-2.500h8L17.500 8h3v11h-17z"/><circle cx="12" cy="13" r="3.500"/>'),
  plein: t('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  fantome: t('<path d="M5 20V10a7 7 0 0 1 14 0v10l-3-2-2 2-2-2-2 2-2-2z"/><circle cx="10" cy="11" r=".6"/><circle cx="14" cy="11" r=".6"/>'),
  gauche: t('<path d="M15 5l-7 7 7 7"/>'),
  droite: t('<path d="M9 5l7 7-7 7"/>'),
  haut: t('<path d="M5 15l7-7 7 7"/>'),
  roue: t('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100"/>'),
  jouer: t('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  crane: t('<path d="M5 12a7 7 0 1 1 14 0v3h-3v3H8v-3H5z"/><circle cx="9.500" cy="12" r="1.200"/><circle cx="14.500" cy="12" r="1.200"/>'),
};
const r = (g, k) => (g.n?.[k] ? rep(g.n[k]) : "");
export const rep = (n, plus = "") => `<b class="rep"${plus ? ` style="${plus}"` : ""}>${n}</b>`;
export const repAbs = (n, x, y) => `<b class="rep abs" style="left:${x}px;top:${y}px">${n}</b>`;
const med = (cls, nom, val, ok) => `<div class="md ${cls}${ok ? " ok" : ""}">${nom}<b>${val}</b></div>`;
export const medaillesHtml = (g, avecNom = true) => (g.meds.length ? `<div class="meds">${g.meds.map(([c, n, v, ok]) => med(c, avecNom ? n : "", v, ok)).join("")}</div>` : "");
const ligne = (rg, nom, tps, moi, extra = "") => `<div class="lg${moi ? " moi" : ""}"><span class="rg">${rg}</span><span class="nom">${nom}${moi ? ' <span class="pastille" style="font-size:10px;padding:1px 5px">toi</span>' : ""}</span>${extra}<span class="tps">${tps}</span></div>`;
const classementHtml = (g, n = 5, moiSeul = false, avecMoi = false, liste = g.classement) =>
  `<div class="pan${g.moiEncre ? " moi-encre" : ""}"><h3>Classement du jour<small>${g.classes} classés</small></h3>${liste.slice(0, n).map(([r, nom, tps, moi]) => ligne(r, nom, tps, moi)).join("")}${avecMoi && g.moi && !liste.slice(0, n).some((l) => l[3]) ? `<div class="douce" style="text-align:center;font-size:12px">…</div>${ligne(g.moi[0], g.moi[1], g.moi[2], true)}` : ""}${moiSeul ? "" : `<div class="pied-j" style="margin-top:6px"><span style="text-decoration:underline">Tout le classement ›</span><span style="text-decoration:underline">${g.lienClassement ?? "Revoir le meilleur tour ›"}</span></div>`}</div>`;
export const style = (g) => `--fond:${g.fond};--texte:${g.texte ?? "#2A1E16"};--bouton:${g.bouton};--bouton-texte:${g.boutonTexte};--bouton-ombre:${g.boutonOmbre ?? "#2A1E16"};--coque:${g.coqueCouleur ?? "transparent"}`;
const motifRayures = (g, w = 130, h = 70) => (g.motif ? `<div class="motif" style="width:${w}px;height:${h}px;background:${g.motif}"></div>` : "");
const barre = (g, avecPlein = true) => `<div class="bj"><a class="retour">${t('<path d="M15 5l-7 7 7 7"/>', ' width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.600" stroke-linecap="round"')}<b>DU JOUR</b></a><span class="jour">Jeu. 12 nov. · n° ${g.numero}</span>${avecPlein ? `<span class="carre">${IC.plein.replace("<svg ", '<svg fill="none" stroke="currentColor" stroke-width="2.200" ')}</span>` : ""}</div>`;
const sceneCol = (g, l, h) => `<div class="scene">${g.scene(l, h)}</div><div class="voile"></div>`;
const titre = (g, taille, replique = false) => `<h1 class="${g.cls}" style="font-size:${taille}px;${g.titreStyle ?? ""}">${g.nom}</h1><div class="sous">${g.sous}</div>${replique && g.replique ? `<p style="margin:8px 0 0;font:700 15px/1.35 Archivo">${g.replique}</p>` : ""}`;
const tuilesHtml = (g, n = 2) => `<div class="tuiles">${g.tuiles.slice(0, n).map(([l, v, s, enc]) => `<div class="tu${enc ? " encre" : ""}"><small>${l}</small><b>${v}</b>${s ? `<span>${s}</span>` : ""}</div>`).join("")}</div>`;
const liensHtml = (g) => `<div class="liens">${g.liens.map((x) => `<span class="lien-b">${x}</span>`).join("")}</div>`;
const pied = (g) => `<div class="pied-j"><span class="mono">Prochaine partie dans 14:22:10</span><span style="text-decoration:underline">Mon profil Du Jour ›</span></div>`;

/** Accueil : ordinateur (deux colonnes, étiquette bornée à 1 160 px), téléphone en paysage (« Jouer » ancré en bas), téléphone en portrait. */
export function accueil(g, l, h) {
  const ordi = l >= 900;
  const pay = !ordi && l > h;
  if (ordi) {
    return `${sceneCol(g, l, h)}<div class="col" style="justify-content:center;padding:0 20px">${barre(g)}<div class="etq${g.coque ? " coque" : ""}" style="${style(g)};flex:none;margin-top:12px">${motifRayures(g, 170, 90)}
      <div class="zone" style="display:grid;grid-template-columns:1fr 1fr;gap:26px;padding:22px 28px 14px;overflow:visible">
        <div style="display:flex;flex-direction:column;gap:14px"><div>${titre(g, 72, true)}${r(g, "ordiLarge")}</div>${g.apercu(480, 150)}${tuilesHtml(g)}${medaillesHtml(g)}
          <div class="jouer xl" style="flex:none">${g.jouer}</div>${liensHtml(g)}</div>
        <div style="display:flex;flex-direction:column;gap:12px">${g.aujourdhui(false)}${classementHtml(g)}${pied(g)}</div>
      </div></div></div>`;
  }
  if (pay) {
    return `${sceneCol(g, l, h)}<div class="col" style="padding:0 47px 21px">${barre(g, false)}<div class="etq${g.coque ? " coque" : ""}" style="${style(g)};margin-top:8px">${motifRayures(g, 90, 50)}
      <div class="zone defile" style="display:grid;grid-template-columns:44% 1fr;gap:14px;padding:10px 14px 6px">
        <div style="display:flex;flex-direction:column;gap:7px">${titre(g, 38)}${tuilesHtml(g)}${medaillesHtml(g)}</div>
        <div style="display:flex;flex-direction:column;gap:8px">${classementHtml(g, 3, true)}${g.aujourdhui(true)}</div>
      </div>
      <div class="actions"><div class="jouer" style="min-height:48px;flex:2">${g.jouer}${r(g, "jouerAncre")}</div>${g.liens.map((x) => `<span class="lien-b" style="flex:1">${x}</span>`).join("")}</div></div></div>`;
  }
  return `${sceneCol(g, l, h)}<div class="col" style="padding:0 0 34px">${barre(g)}<div class="etq${g.coque ? " coque" : ""}" style="${style(g)};margin:8px 8px 0;width:auto">${motifRayures(g, 80, 60)}
    <div class="zone defile" style="padding:12px 14px 8px;display:flex;flex-direction:column;gap:10px">${titre(g, 44, true)}${tuilesHtml(g)}${medaillesHtml(g)}
      <div class="jouer" style="flex:none">${g.jouer}</div>${liensHtml(g)}${g.aujourdhui(true)}${classementHtml(g, 5)}${pied(g)}</div></div></div>`;
}

/** Arrivée : même ordre dans les cinq jeux — temps, médaille (nom écrit, prochain palier), place du jour, puis les actions ; « Jeu suivant du jour » ancré en bas. */
export function arrivee(g, l, h) {
  const ordi = l >= 900;
  const a = g.arrivee;
  const gauche = `<div style="display:flex;flex-direction:column;gap:12px"><div><div class="sous" style="margin:0 0 4px">${a.titre}</div>
      <div class="mono" style="font-size:${ordi ? 76 : 56}px;line-height:1;font-family:${g.fontChrono ?? "'JetBrains Mono'"};font-weight:700">${a.temps}<span style="font-size:.4em">${a.unite ?? " s"}</span></div>
      <div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="pastille" style="background:var(--diamant);color:#0B2530">${a.etiquette}</span><span style="font:600 13px Archivo">${a.sousEtiquette}</span></div>${a.replique ? `<p style="margin:8px 0 0;font:700 14px/1.3 Archivo">${a.replique}</p>` : ""}</div>
    <div style="display:flex;align-items:center;gap:12px;background:var(--${a.med[0] ?? "creme2"});color:#1E1B19;border:3px solid var(--encre);padding:8px 12px;box-shadow:3px 3px 0 var(--encre)"><span class="med" style="width:30px;height:30px;background:var(--${a.med[0] ?? "creme2"});border:3px solid var(--encre);flex:none"></span><div><b style="font:20px 'Archivo Black';text-transform:uppercase;line-height:1.05;display:block">${a.med[1]}</b><span style="font:700 13px Archivo">${a.med[2]}</span></div>${r(g, "arriveeOrdre")}</div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid var(--encre);border-bottom:2px solid var(--encre);padding:6px 0"><span style="font:600 14px Archivo">Classement du jour</span><b style="font:24px 'Archivo Black'">${a.place}<small style="font:600 13px Archivo"> sur ${g.classes}</small></b></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="jouer" style="grid-column:1/3;min-height:54px">${g.rejouer ?? "Rejouer"}</div><span class="lien-b">Partager</span><span class="lien-b">${a.revoir ?? "Classement"}</span></div></div>`;
  const droite = `<div style="display:flex;flex-direction:column;gap:10px">${a.droite ?? classementHtml(g, 5, false, true, a.liste ?? g.classement)}${a.partage ? `<div class="pan" style="font:600 12px 'JetBrains Mono'">${a.partage}</div>` : ""}</div>`;
  const suivant = `<div style="flex:none;background:var(--creme);border-top:3px solid var(--encre);padding:8px 12px calc(8px + ${l < 900 && h > l ? 34 : 0}px)"><div class="sous" style="margin:0 0 4px;color:var(--douce)">Il te reste aujourd'hui</div><div class="jouer" style="--bouton:#C2401F;--bouton-texte:#FFF4E0;min-height:44px;font:700 14px 'Archivo Black';letter-spacing:1.4px">${a.suivant} ›${r(g, "arriveeSuivant")}</div></div>`;
  if (ordi) {
    return `${sceneCol(g, l, h)}<div class="col" style="justify-content:center;padding:0 20px">${barre(g)}<div class="etq${g.coque ? " coque" : ""}" style="${style(g)};flex:none;margin-top:12px">${motifRayures(g, 150, 80)}<div class="zone" style="display:grid;grid-template-columns:1.1fr 1fr;gap:28px;padding:22px 28px;overflow:visible">${gauche}${droite}</div>${suivant}</div></div>`;
  }
  return `${sceneCol(g, l, h)}<div class="col" style="padding:0 0 0">${barre(g, false)}<div class="etq${g.coque ? " coque" : ""}" style="${style(g)};margin:8px 8px 0;width:auto;flex:1;border-bottom:0">${motifRayures(g, 80, 50)}<div class="zone defile" style="padding:12px 14px 8px">${gauche}<div style="height:10px"></div>${droite}</div>${suivant}</div></div>`;
}

/** Pause : deux colonnes en paysage (les actions d'un côté, les réglages de l'autre) pour ne plus défiler. */
export function pause(g, l, h) {
  const pay = l > h;
  const actions = ["Recommencer", g.pause?.[0] ?? "Dernier point", "Comment jouer", "Réglages", "Plein écran", "Accueil de " + g.nomCourt];
  return `${sceneCol(g, l, h)}<div class="dlg" style="${style(g)};width:${pay ? l - 94 : l - 24}px;max-height:${h - (pay ? 28 : 60)}px;overflow:hidden;background:var(--papier)">
    <div style="display:grid;grid-template-columns:${pay ? "1.1fr 1fr" : "1fr"};gap:${pay ? 18 : 10}px"><div><h2 class="${g.cls}">Pause ${r(g, "pauseDeux")}</h2><div class="btn-d pr" style="margin-bottom:8px">Reprendre</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${actions.map((x) => `<div class="btn-d" style="padding:0 6px;font-size:13px">${x}</div>`).join("")}</div></div>
    <div><div class="titre-g" style="margin-top:${pay ? 4 : 12}px">Son et musique</div><div class="reg"><span>Son</span><span class="inter"></span></div><div class="reg"><span>Musique</span><span class="inter"></span></div><div class="reg"><span>Volume</span><span class="curseur"><i></i></span></div><div class="reg"><span>Morceau</span><b style="font-size:13px">Suivant ›</b></div></div></div></div>`;
}

/** Réglages / classement d'un jeu sur téléphone : onglets, lignes de 44 px, retour. */
export function reglages(g, l, h) {
  return `${sceneCol(g, l, h)}<div class="col" style="padding:0 0 34px">${barre(g, false)}<div class="etq${g.coque ? " coque" : ""}" style="${style(g)};margin:8px 8px 0;width:auto"><div class="zone defile" style="padding:12px 14px">${motifRayures(g, 70, 44)}
    <h1 class="${g.cls}" style="font-size:34px">Réglages</h1>
    <div class="seg" style="margin:10px 0;width:100%"><span class="ici" style="flex:1;justify-content:center">${g.reglagesOnglets[0]}</span>${g.reglagesOnglets.slice(1).map((x) => `<span style="flex:1;justify-content:center">${x}</span>`).join("")}</div>
    <div class="pan"><div class="reg"><span>Particules</span><span class="inter"></span></div><div class="reg"><span>Traces et effets</span><span class="inter"></span></div><div class="reg"><span>Secousses de l'écran</span><span class="inter"></span></div><div class="reg"><span>Vibration</span><span class="inter off"></span></div><div class="reg"><span>Un bug ? Une idée ?</span><b>›</b></div></div></div>
    <div class="actions"><div class="jouer" style="min-height:48px;--bouton:var(--encre);--bouton-texte:#fff">Retour</div></div></div></div>`;
}

export function classement(g, l, h) {
  return `${sceneCol(g, l, h)}<div class="col" style="padding:0 0 34px">${barre(g, false)}<div class="etq${g.coque ? " coque" : ""}" style="${style(g)};margin:8px 8px 0;width:auto"><div class="zone defile" style="padding:12px 14px">${motifRayures(g, 70, 44)}
    <h1 class="${g.cls}" style="font-size:30px">Classement</h1><div class="sous">Jeu n° ${g.numero} · ${g.classes} classés</div>
    <div class="seg" style="margin:10px 0"><span class="ici">Tous</span><span>Amis</span><span>Mon groupe</span></div>
    <div class="pan${g.moiEncre ? " moi-encre" : ""}">${[...g.classement, ...g.classement2 ?? []].map(([r, n, tp, moi]) => ligne(r, n, tp, moi)).join("")}<div class="douce" style="text-align:center">…</div>${ligne(g.moi[0], g.moi[1], g.moi[2], true)}</div></div>
    <div class="actions"><div class="jouer" style="min-height:48px;--bouton:var(--encre);--bouton-texte:#fff">Retour</div></div></div></div>`;
}

/** En partie : une seule bande, des plaques de 44 px, le centre libre, les commandes aux bords dans la marge de sécurité ; `g.hud(l, h, sure)` donne ce qui est propre au jeu. */
export function enPartie(g, l, h, sure = true) {
  const pay = l > h;
  const marge = pay ? { t: 0, b: 21, g: 47, d: 47 } : { t: 47, b: 34, g: 0, d: 0 };
  const zones = sure
    ? `<div class="zone-sure" style="left:${marge.g}px;right:${marge.d}px;top:${marge.t}px;bottom:${marge.b}px"><span>marge de sécurité de l'iPhone</span>${r(g, "hudSure")}</div>`
    : "";
  return `<div class="scene">${g.sceneJeu(l, h)}</div><div style="position:absolute;inset:0;${style(g)};${g.fort ? `--bouton:${g.fort[0]};--bouton-texte:${g.fort[1]};--bouton-ombre:${g.fort[2]}` : ""}">${zones}${g.hud(l, h, marge)}</div>`;
}
