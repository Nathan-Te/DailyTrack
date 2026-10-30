import { Rng } from "@cdj/core";
import { type Commande, BANC_CONFIG, BANC_REPOS, apparition, bancCommandes, sommetTour } from "@cdj/tower-sim/lab/banc";
import { empreinte } from "@cdj/tower-sim/lab/empreinte";
import { type Engine, type PieceKind, type PieceSpec, type Snapshot, type World, type WorldConfig, PIECE_KINDS } from "@cdj/tower-sim/lab/interface";
import { pieceBoxes } from "@cdj/tower-sim/lab/pieces";
import "./demo.css";
import { charger, type NomMoteur } from "./moteurs";

// Lot T0 — page de démonstration de la physique (pas un jeu : aucune vie, aucun score, aucune interface au-delà de ce qu'il faut pour juger la SENSATION).
//   ?scenario=banc&engine=a|b                  le banc d'essai (40 pièces, un effondrement provoqué) rejoué à l'écran ; l'empreinte finale s'affiche
//   …&libre                                    on lâche des pièces au clavier (← → déplacent d'un demi-mètre, ↑ ou R tourne, ↓ ou espace lâche)
//   …&debug&tune                               panneau de réglage : gravité, frottement, rebond, itérations, sommeil (relance le monde)
// Texte en français seulement : c'est une page d'essai hors production (le site de production ne la publie pas, scripts/site.mjs) ; pas de catalogue.
// Règle R9 : ces options ne servent à rien en production ; sur une construction de production la page se tait.

const q = new URLSearchParams(location.search);
const NOM: NomMoteur = q.get("engine") === "b" ? "b" : "a";
const LIBRE = q.has("libre");
const TUNE = q.has("debug") && q.has("tune");
const PRODUCTION = import.meta.env.VITE_PRODUCTION === "1";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const hud = document.getElementById("hud")!;
const ctx = canvas.getContext("2d")!;

const COULEURS: Record<PieceKind, string> = { I: "#4cc9f0", O: "#f9c74f", T: "#b5179e", L: "#f8961e", J: "#4361ee", S: "#43aa8b", Z: "#f94144" };

let moteur: Engine;
let config: WorldConfig = { ...BANC_CONFIG };
let monde: World;
let specs: PieceSpec[] = [];
let commandes: Commande[] = [];
let prochaine = 0;
let vitesse = 1;
let pasMs = 0;
let pasCompte = 0;

// ---- mode libre : la pièce en main et la suivante ----
const rng = new Rng(20261030);
let sac: PieceKind[] = [];
const tirer = (): PieceKind => {
  if (sac.length === 0) sac = rng.shuffle(PIECE_KINDS);
  return sac.pop()!;
};
let main: { kind: PieceKind; rot: number; x8: number } = { kind: tirer(), rot: 0, x8: 0 };
let suivante: PieceKind = tirer();

function demarrer(): void {
  if (monde) moteur.dispose(monde);
  monde = moteur.createWorld(config);
  specs = [];
  prochaine = 0;
  pasMs = 0;
  pasCompte = 0;
  commandes = LIBRE ? [] : bancCommandes();
}

function lacher(): void {
  const spec = apparition({ tick: 0, kind: main.kind, rot: main.rot, x8: main.x8, vx8: 0, depart: "dessus" }, sommetTour(moteur.snapshot(monde), specs));
  moteur.addPiece(monde, spec);
  specs.push(spec);
  main = { kind: suivante, rot: 0, x8: main.x8 };
  suivante = tirer();
}

function avancer(): void {
  while (prochaine < commandes.length && commandes[prochaine]!.tick === monde.tick) {
    const spec = apparition(commandes[prochaine++]!, sommetTour(moteur.snapshot(monde), specs));
    moteur.addPiece(monde, spec);
    specs.push(spec);
  }
  const t0 = performance.now();
  moteur.step(monde);
  pasMs += performance.now() - t0;
  pasCompte++;
}

const FIN = (): number => (commandes.length ? commandes[commandes.length - 1]!.tick + BANC_REPOS : Infinity);

// ---- dessin ----
function dessiner(snap: Snapshot): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const sommet = sommetTour(snap, specs);
  const vue = Math.max(16, sommet + 9); // mètres visibles en hauteur
  const echelle = h / vue;
  const bas = h - 40; // le dessus de la plateforme (y = 0)
  const X = (m: number): number => w / 2 + m * echelle;
  const Y = (m: number): number => bas - m * echelle;
  // plateforme
  const demi = config.platformHalf8 / 8;
  ctx.fillStyle = "#8d99ae";
  ctx.fillRect(X(-demi), Y(0), 2 * demi * echelle, 40 + echelle);
  // niveau « tombée »
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, Y(-4));
  ctx.lineTo(w, Y(-4));
  ctx.stroke();
  ctx.setLineDash([]);
  // pièces
  for (const p of snap.pieces) {
    if (p.lost) continue;
    const spec = specs[p.id]!;
    const c = Math.cos(p.angle);
    const s = Math.sin(p.angle);
    ctx.fillStyle = COULEURS[spec.kind];
    ctx.globalAlpha = p.asleep ? 0.75 : 1;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.5;
    for (const b of pieceBoxes(spec.kind, spec.rot)) {
      const cx = b.cx / 8;
      const cy = b.cy / 8;
      const hw = b.hw / 8;
      const hh = b.hh / 8;
      ctx.beginPath();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], i) => {
        const lx = cx + sx! * hw;
        const ly = cy + sy! * hh;
        const px = p.x + c * lx - s * ly;
        const py = p.y + s * lx + c * ly;
        if (i === 0) ctx.moveTo(X(px), Y(py));
        else ctx.lineTo(X(px), Y(py));
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // pièce en main (mode libre) : fantôme au-dessus de la tour
  if (LIBRE) {
    const spec = apparition({ tick: 0, kind: main.kind, rot: main.rot, x8: main.x8, vx8: 0, depart: "dessus" }, sommet);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = COULEURS[main.kind];
    for (const b of pieceBoxes(spec.kind, spec.rot)) {
      ctx.fillRect(X(spec.x8 / 8 + (b.cx - b.hw) / 8), Y(spec.y8 / 8 + (b.cy + b.hh) / 8), (2 * b.hw * echelle) / 8, (2 * b.hh * echelle) / 8);
    }
    ctx.globalAlpha = 1;
  }
  const perdues = snap.pieces.filter((p) => p.lost).length;
  const eveillees = moteur.awake(monde);
  const lignes = [
    `${moteur.label}`,
    `${LIBRE ? "mode libre" : "banc"} · pas ${snap.tick} (${(snap.tick / config.hz).toFixed(1)} s) · vitesse ×${vitesse}`,
    `pièces ${snap.pieces.length}${LIBRE ? "" : `/${commandes.length}`} · tombées ${perdues} · éveillées ${eveillees} · sommet ${sommet.toFixed(2)} m`,
    `un pas coûte ${pasCompte ? ((pasMs / pasCompte) * 1000).toFixed(0) : "–"} µs en moyenne`,
  ];
  if (LIBRE) lignes.push(`en main : ${main.kind} · suivante : ${suivante} · ← → déplacer · ↑ ou R tourner · ↓ ou espace lâcher`);
  else if (monde.tick >= FIN()) lignes.push(`TERMINÉ — empreinte ${empreinte(snap)}`);
  else lignes.push(`empreinte ${empreinte(snap)} · touches + et − : vitesse`);
  hud.textContent = lignes.join("\n");
}

// ---- boucle ----
let reste = 0;
let dernier = performance.now();
function image(now: number): void {
  const dt = Math.min(0.1, (now - dernier) / 1000);
  dernier = now;
  reste += dt * config.hz * vitesse;
  let n = Math.floor(reste);
  reste -= n;
  while (n-- > 0 && monde.tick < FIN()) avancer();
  dessiner(moteur.snapshot(monde));
  requestAnimationFrame(image);
}

// ---- clavier et boutons ----
function touche(code: string): void {
  if (code === "Equal" || code === "NumpadAdd") vitesse = Math.min(16, vitesse * 2);
  else if (code === "Minus" || code === "NumpadSubtract") vitesse = Math.max(1, vitesse / 2);
  if (!LIBRE) return;
  if (code === "ArrowLeft") main.x8 = Math.max(-20, main.x8 - 4);
  else if (code === "ArrowRight") main.x8 = Math.min(20, main.x8 + 4);
  else if (code === "ArrowUp" || code === "KeyR") main.rot = (main.rot + 1) & 3;
  else if (code === "ArrowDown" || code === "Space") lacher();
}
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
  touche(e.code);
});

function boutons(): void {
  const zone = document.getElementById("commandes")!;
  zone.hidden = false;
  for (const [texte, code] of [["←", "ArrowLeft"], ["⟳", "ArrowUp"], ["→", "ArrowRight"], ["⤓", "Space"]] as const) {
    const b = document.createElement("button");
    b.textContent = texte;
    b.addEventListener("click", () => touche(code));
    zone.append(b);
  }
}

// ---- panneau de réglage (?debug&tune) ----
function panneau(): void {
  const zone = document.getElementById("reglages")!;
  zone.hidden = false;
  const champs: [string, keyof WorldConfig, number, number, number][] = [
    ["gravité (cm/s²)", "gravityCm", 100, 3000, 1],
    ["frottement (%)", "frictionPct", 0, 200, 5],
    ["rebond (%)", "restitutionPct", 0, 95, 5],
    ["itérations", "iterations", 1, 120, 1],
  ];
  const lus: (() => void)[] = [];
  for (const [nom, cle, min, max, pas] of champs) {
    const l = document.createElement("label");
    l.textContent = nom;
    const r = document.createElement("input");
    r.type = "range";
    r.min = String(min);
    r.max = String(max);
    r.step = String(pas);
    r.value = String(config[cle]);
    const v = document.createElement("span");
    v.className = "valeur";
    v.textContent = r.value;
    r.addEventListener("input", () => (v.textContent = r.value));
    zone.append(l, r, v);
    lus.push(() => ((config as unknown as Record<string, number>)[cle] = Number(r.value)));
  }
  const l = document.createElement("label");
  l.textContent = "sommeil";
  const c = document.createElement("input");
  c.type = "checkbox";
  c.checked = config.sleep;
  zone.append(l, c, document.createElement("span"));
  const ok = document.createElement("button");
  ok.textContent = "Appliquer et relancer";
  ok.addEventListener("click", () => {
    for (const lire of lus) lire();
    config.sleep = c.checked;
    demarrer();
  });
  zone.append(ok);
}

async function init(): Promise<void> {
  if (PRODUCTION) {
    hud.textContent = "Bientôt.";
    return;
  }
  hud.textContent = "Chargement du moteur…";
  moteur = await charger(NOM);
  demarrer();
  if (LIBRE) boutons();
  if (TUNE) panneau();
  (window as unknown as { __cdj?: unknown }).__cdj = { moteur: () => moteur, monde: () => monde, config: () => config };
  document.documentElement.dataset.ready = "true";
  requestAnimationFrame(image);
}
void init();
