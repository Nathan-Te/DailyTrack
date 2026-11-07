import { cleBoss } from "./bosses";
import { formatDay } from "@cdj/core";
import { BOSS_IDS, CM_PAR_CHANFREIN, DUREE_TICKS, M, MUR, STRATEGIES, TICKS_PAR_SECONDE, PONT, SOL, tempsSansRencontre, Z_ARENE, Z_CHEMIN, Z_CLAIRIERE, Z_PORTE, caseDe, centreDeCase, dailyRush, descendre, formatTemps, jouerLePilote, type Contenu } from "@cdj/rush-sim";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { PALETTES } from "./palette";

// `?scenario=carte&jours=7` (lot BR1) : la vue de DESSUS des N prochains jours, pour juger la variété du générateur. Pour chaque jour : la grille (sol, murs bas, vide, ponts), le chemin principal (orange, le plus court sur la grille), les détours (bleu),
// les camps (rouge, avec leur nombre de monstres), les groupes qui barrent le chemin (orange, avec le cercle de leur alerte), les obstacles cassables (marron), les monstres épars (jaune), le départ (S), l'arène du golem (G), la longueur du chemin, le temps du pilote (le Diamant provisoire : « foncer ») et (lot BR3) le NOM du boss du jour. Jamais classé, jamais en production.

const TAILLE = 360;
const css = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;

function dessiner(c: Contenu, theme: string): HTMLCanvasElement {
  const n = c.niveau!;
  const pal = PALETTES[theme] ?? PALETTES.prairie!;
  const cv = document.createElement("canvas");
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = cv.height = TAILLE * dpr;
  cv.style.width = cv.style.height = `${TAILLE}px`;
  const g = cv.getContext("2d")!;
  g.scale(dpr, dpr);
  g.fillStyle = "#1c1a24";
  g.fillRect(0, 0, TAILLE, TAILLE);
  const k = Math.min(TAILLE / n.l, TAILLE / n.h);
  const ox = (TAILLE - n.l * k) / 2;
  const oy = (TAILLE - n.h * k) / 2;
  for (let j = 0; j < n.h; j++) {
    for (let i = 0; i < n.l; i++) {
      const idx = j * n.l + i;
      const t = n.cases[idx]!;
      const z = n.zones[idx]!;
      if (t === SOL) g.fillStyle = z === Z_ARENE ? "#d8c26a" : z === Z_PORTE ? "#b48a3c" : z === Z_CHEMIN ? css(pal.sol2) : z === Z_CLAIRIERE ? css(pal.sol) : css(pal.sol);
      else if (t === PONT) g.fillStyle = css(pal.bois);
      else if (t === MUR) g.fillStyle = css(pal.mur);
      else continue;
      g.fillRect(ox + i * k, oy + j * k, k + 0.5, k + 0.5);
    }
  }
  const px = (x: number): number => ox + ((x - n.ox) / (2 * M)) * k;
  const py = (y: number): number => oy + ((y - n.oy) / (2 * M)) * k;
  // les détours (liens qui ne sont pas du chemin principal)
  g.lineCap = "round";
  g.strokeStyle = "#3d7bff";
  g.lineWidth = 2.2;
  for (const l of n.liens) {
    if (l.principal) continue;
    const a = n.clairieres[l.a]!;
    const b = n.clairieres[l.b]!;
    g.beginPath();
    g.moveTo(px(a.x), py(a.y));
    g.lineTo(px(b.x), py(b.y));
    g.stroke();
  }
  // le chemin principal : le plus court sur la grille, du départ à l'arène
  g.strokeStyle = "#ff7a1a";
  g.lineWidth = 2.6;
  g.beginPath();
  let idx = caseDe(n, n.depart.x, n.depart.y);
  const [sx, sy] = centreDeCase(n, idx);
  g.moveTo(px(sx), py(sy));
  for (let pas = 0; pas < 4000; pas++) {
    const s = descendre(n, n.dist, idx);
    if (s < 0) break;
    idx = s;
    const [x, y] = centreDeCase(n, idx);
    g.lineTo(px(x), py(y));
  }
  g.stroke();
  // les camps, les monstres épars
  for (const d of n.detours) {
    const cl = n.clairieres[d.camp]!;
    g.fillStyle = "rgba(220,50,50,0.85)";
    g.beginPath();
    g.arc(px(cl.x), py(cl.y), Math.max(7, k * 1.8), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 11px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(n.monstres.filter((m) => m.camp === d.camp).length), px(cl.x), py(cl.y));
  }
  // lot BR1b : les groupes (leur alerte large), les obstacles cassables, les épars
  const alerteK = (u: number): number => (u / (2 * M)) * k;
  for (const m of n.monstres) {
    if (m.groupe < 0) continue;
    g.strokeStyle = "rgba(255,150,40,0.55)";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(px(m.x), py(m.y), alerteK(m.alerte), 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#ff8a1a";
    g.beginPath();
    g.arc(px(m.x), py(m.y), 3.2, 0, Math.PI * 2);
    g.fill();
  }
  for (const o of n.obstacles) {
    g.fillStyle = o.coups === 1 ? "#4f9a3a" : "#8a5a2b";
    for (const idxO of o.cases) {
      const [x, y] = centreDeCase(n, idxO);
      g.fillRect(px(x) - k * 0.45, py(y) - k * 0.45, k * 0.9, k * 0.9);
    }
  }
  g.fillStyle = "#ffe14a";
  for (const m of n.monstres) {
    if (m.camp >= 0 || m.groupe >= 0) continue;
    g.beginPath();
    g.arc(px(m.x), py(m.y), 3, 0, Math.PI * 2);
    g.fill();
  }
  const marque = (x: number, y: number, couleur: string, lettre: string): void => {
    g.fillStyle = couleur;
    g.beginPath();
    g.arc(px(x), py(y), 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 12px sans-serif";
    g.fillText(lettre, px(x), py(y) + 0.5);
  };
  marque(n.depart.x, n.depart.y, "#2f9e44", "S");
  marque(n.arene.x, n.arene.y, "#7048b6", "G");
  return cv;
}

export function carteDesJours(jour: number, nombre: number, hote: HTMLElement, o: OptionsPartie): PartieDuJeu {
  const racine = document.createElement("div");
  racine.className = "rush-carte";
  racine.dataset.jours = String(nombre);
  const titre = document.createElement("h2");
  titre.className = "rush-carte__titre";
  titre.textContent = o.t("carte.titre", { n: nombre });
  racine.append(titre);
  const grille = document.createElement("div");
  grille.className = "rush-carte__grille";
  racine.append(grille);
  for (let d = 0; d < nombre; d++) {
    const c = dailyRush(jour + d);
    const n = c.niveau!;
    // Lot BR2 : les trois stratégies du pilote jouent le jour ; la plus rapide, et de combien elle l'est sur la suivante (une partie perdue vaut le pire temps).
    const parties = STRATEGIES.map((s) => jouerLePilote(c, undefined, Infinity, s));
    const temps3 = parties.map((q) => (q.resultat.victoire ? q.ticks : DUREE_TICKS));
    const meilleur = temps3.indexOf(Math.min(...temps3));
    const suivante = Math.min(...temps3.filter((_, i) => i !== meilleur));
    const pilote = parties[0]!;
    const f = document.createElement("figure");
    f.className = "rush-carte__jour";
    f.dataset.meilleure = STRATEGIES[meilleur]!;
    f.dataset.boss = BOSS_IDS[c.boss]!;
    const cap = document.createElement("figcaption");
    const temps = formatTemps(pilote.ticks, o.langue);
    cap.textContent = o.t("carte.legende", {
      date: formatDay(c.jour),
      theme: o.t(`theme.${c.theme}`),
      boss: o.t(`boss.nom.${cleBoss(BOSS_IDS[c.boss]!)}`), // lot BR3 : le boss du jour
      m: Math.round(n.longueurCm / 100),
      d: n.detours.length,
      b: n.detours.filter((q) => q.hub2 >= 0).length,
      tue: n.monstres.length,
      o: n.obstacles.length,
      sr: tempsSansRencontre(n).toFixed(1),
      t: temps,
      tp: formatTemps(parties[1]!.ticks, o.langue),
      tn: formatTemps(parties[2]!.ticks, o.langue),
      fin: (pilote.resultat.victoire ? "" : o.t("carte.perdu")) + o.t("carte.meilleure", { s: o.t(`strategie.${STRATEGIES[meilleur]!}`), ecart: ((suivante - temps3[meilleur]!) / TICKS_PAR_SECONDE).toFixed(1) }),
    });
    f.append(dessiner(c, c.theme), cap);
    grille.append(f);
  }
  hote.append(racine);
  void CM_PAR_CHANFREIN;
  return {
    avancer() {},
    dessiner() {},
    finie: () => false,
    action() {},
    hud: () => ({ principal: "", secondaire: "" }),
    resultat: () => ({ score: [36000], rediffusion: "" }),
    fantome() {},
    detruire() {
      racine.remove();
    },
  };
}
