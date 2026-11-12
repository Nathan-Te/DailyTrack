// Lot QA2 : barre commune des maquettes visuelles — thèmes, propositions à allumer / éteindre, compteur d'images par seconde.
// Adresse : #base (tout éteint), #solo=<proposition>, #theme=<thème>, #mesure (le compteur écrit window.__fps après 1 s de chauffe, sur 3 s).
function initVisuel(cfg) {
  const h = new URLSearchParams(location.hash.slice(1));
  const etat = {};
  for (const f of cfg.features) etat[f.k] = h.has("base") ? false : h.get("solo") ? f.k === h.get("solo") : true;
  let theme = h.get("theme") || cfg.themes[0].k;
  const barre = document.getElementById("barre");
  const g1 = document.createElement("div"); g1.className = "grp"; g1.innerHTML = "<small>Thème</small>";
  for (const t of cfg.themes) { const b = document.createElement("button"); b.textContent = t.label; b.setAttribute("aria-pressed", String(t.k === theme)); b.onclick = () => { theme = t.k; for (const x of g1.querySelectorAll("button")) x.setAttribute("aria-pressed", String(x === b)); cfg.onTheme && cfg.onTheme(theme); }; g1.append(b); }
  const g2 = document.createElement("div"); g2.className = "grp"; g2.innerHTML = "<small>Propositions</small>";
  cfg.features.forEach((f, i) => { const l = document.createElement("label"); const c = document.createElement("input"); c.type = "checkbox"; c.checked = etat[f.k]; l.className = c.checked ? "on" : ""; c.onchange = () => { etat[f.k] = c.checked; l.className = c.checked ? "on" : ""; cfg.onFeature && cfg.onFeature(f.k, c.checked); }; l.append(c, `${i + 1} · ${f.label}`); g2.append(l); });
  const fps = document.createElement("div"); fps.id = "fps"; fps.textContent = "— i/s";
  barre.append(g1, g2, fps);
  let n = 0, t0 = performance.now(), tm = null, nm = 0;
  const api = { on: (k) => !!etat[k], get theme() { return theme; }, etat,
    loop(cb) { let last = performance.now(); const f = (t) => { const dt = Math.min(0.05, (t - last) / 1000); last = t; cb(t / 1000, dt); n++; nm++; if (t - t0 > 500) { fps.textContent = Math.round((n * 1000) / (t - t0)) + " i/s"; n = 0; t0 = t; } if (h.has("mesure")) { if (tm === null && t > 1000) { tm = t; nm = 0; } else if (tm !== null && t - tm >= 3000 && !window.__fpsPret) { window.__fps = (nm * 1000) / (t - tm); window.__fpsPret = true; } } requestAnimationFrame(f); }; requestAnimationFrame(f); } };
  return api;
}
