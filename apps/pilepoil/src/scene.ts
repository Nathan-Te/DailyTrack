import { JAUGES, LONGUEUR, Partie, REGLAGES, TICKS_PAR_SECONDE, enregistrer, scoreDe, tirerJauges, type Contenu, type Reglages, type ResultatJauge, type Sorte } from "@cdj/pilepoil-sim";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { creerSons, type Sons } from "./sons";
import "./scene.css";

// Le rendu et les entrées de « Pile poil » (lot PA2), en Canvas 2D comme la maquette (`docs/pilepoil/maquettes/`, elle fait foi pour l'écran) : les dix lampes, la jauge, la cible et sa zone « pile », le curseur
// interpolé entre deux pas, le mot de l'appui et ses points, les éclats et la petite secousse du « pile » (coupés si l'appareil ou le joueur demande moins de mouvement), la vibration, les sons. Le score, « n/10 » et
// « PILE ×n » sont dans les zones du HUD en surimpression du kit. **De l'affichage seulement** : la partie est `Partie` de `@cdj/pilepoil-sim` (entière, 120 pas par seconde) ; un appui est enregistré à son pas et
// la suite des pas est la rediffusion. Les couleurs sont les jetons de `@cdj/ui` et la teinte de la fiche, lus dans la feuille : aucune couleur écrite ici.

interface Couleurs {
  creme: string;
  papier: string;
  encre: string;
  gris: string;
  terre: string;
  moutarde: string;
  diamant: string;
  or: string;
  argent: string;
  rose: string;
  coque: string;
  chiffres: string;
  titre: string;
}
function couleurs(hote: HTMLElement): Couleurs {
  const s = getComputedStyle(hote);
  const v = (nom: string, repli: string): string => s.getPropertyValue(nom).trim() || repli;
  const terre = v("--dj-terre", "currentColor");
  return {
    creme: v("--dj-creme", "transparent"),
    papier: v("--dj-papier", "transparent"),
    encre: v("--dj-encre", "currentColor"),
    gris: v("--dj-encre-douce", "currentColor"),
    terre,
    moutarde: v("--dj-moutarde", terre),
    diamant: v("--dj-diamant", terre),
    or: v("--dj-or", terre),
    argent: v("--dj-argent", terre),
    rose: v("--jeu-fond", terre),
    coque: v("--jeu-coque", terre),
    chiffres: v("--dj-police-chiffres", "monospace"),
    titre: v("--jeu-police", "sans-serif"),
  };
}

/** La couleur de la lampe d'une sorte : bleu « pile », or « bien », argent « ouf » ; une lampe ratée reste vide, barrée. */
const lampe = (k: Couleurs, s: Sorte): string | null => (s === "pile" ? k.diamant : s === "bien" ? k.or : s === "touche" ? k.argent : null);
const PAS_MS = 1000 / TICKS_PAR_SECONDE;

interface Eclat {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: string;
  vie: number;
}

/** Les réglages d'une partie d'essai (`?debug&tune`), gardés d'une partie à l'autre (« Recommencer ») tant que la page vit. */
let reglagesEssai: Reglages | null = null;
/** Les sons : un seul contexte pour la page (il s'ouvre au premier geste et reste réveillé d'une partie à l'autre). */
let sons: Sons | null = null;
let volume: () => number = () => 1;

export function nouvellePartiePilepoil(contenu: Contenu, hote: HTMLElement, o: OptionsPartie, essai: boolean): PartieDuJeu {
  sons ??= creerSons(() => volume());
  volume = o.volumeEffets;
  const son = sons;
  const nouvelle = (r: Readonly<Reglages>): Partie => new Partie(essai ? tirerJauges(contenu.graine, r) : contenu.jauges, r);
  let partie = nouvelle(essai ? (reglagesEssai ??= { ...REGLAGES }) : REGLAGES);
  let vus = 0;
  let annonceA = 0;
  let avanceA = performance.now();
  let eclats: Eclat[] = [];
  let secousse = 0;
  let avant = performance.now();

  const canvas = document.createElement("canvas");
  canvas.className = "pilepoil-plateau";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", o.libelle);
  hote.append(canvas);
  const g = canvas.getContext("2d")!;
  const k = couleurs(hote);
  let W = 1;
  let H = 1;
  const redimensionner = (): void => {
    // La boîte intérieure du plateau (ses marges gardent les bords de l'iPhone : `env(safe-area-inset-*)`, posées par le kit).
    const s = getComputedStyle(hote);
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(1, Math.floor(hote.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)));
    H = Math.max(1, Math.floor(hote.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom)));
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(hote);
  redimensionner();

  // La mise en page : la jauge au milieu, les lampes au-dessus (sous le HUD), le mot entre les deux.
  const marge = (): number => Math.max(16, Math.min(28, W * 0.06));
  const place = (): { gx: number; gw: number; gy: number; gh: number; ly: number; lr: number } => {
    const gx = marge();
    const gw = Math.min(W - 2 * gx, 720);
    const x0 = (W - gw) / 2;
    const lr = Math.min(11, (gw - 9 * 8) / 20);
    const gh = Math.max(56, Math.min(78, H * 0.12));
    const gy = Math.max(222, H * 0.46);
    const ly = Math.max(104, gy - 150);
    return { gx: x0, gw, gy, gh, ly, lr };
  };

  // --- HUD en surimpression (les zones du kit) : le score à gauche, « PILE ×n » au centre, « n/10 » à droite ---
  const zones = o.zones;
  const neuf = (classe: string, zone: HTMLElement): HTMLElement => zone.appendChild(Object.assign(document.createElement("span"), { className: classe }));
  const zScore = zones && neuf("jeu-surimpression__valeur pilepoil-score", zones.hautGauche);
  const zEnchaine = zones && neuf("jeu-surimpression__etiquette", zones.centre);
  const zJauge = zones && neuf("jeu-surimpression__cartouche", zones.hautDroite);
  const numero = (): string => `${Math.min(partie.i + 1, JAUGES)}/${JAUGES}`;
  const majZones = (): void => {
    if (!zones) return;
    zScore!.textContent = o.t("hud.valeur", { n: partie.score });
    zJauge!.textContent = numero();
    zEnchaine!.hidden = partie.enchaine < 2;
    zEnchaine!.textContent = partie.enchaine >= 2 ? o.t("hud.enchaine", { n: partie.enchaine }) : "";
  };

  // --- Ce qui suit un résultat : le son, la vibration, les éclats et la secousse du « pile » ---
  const annoncer = (res: ResultatJauge): void => {
    annonceA = performance.now();
    son.appui(res.sorte, partie.enchaine);
    o.vibrer(res.sorte === "pile" ? [20, 30, 20] : res.sorte === "rate" ? 60 : 12);
    if (o.reduit) return;
    const n = res.sorte === "pile" ? 26 : res.sorte === "bien" ? 12 : 0;
    const p = place();
    const x = p.gx + (res.x / LONGUEUR) * p.gw;
    const teintes = [k.diamant, k.moutarde, k.rose, k.papier];
    for (let i = 0; i < n; i++) eclats.push({ x, y: p.gy + 20, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 8 - 2, r: 3 + Math.random() * 4, c: teintes[i % 4]!, vie: 1 });
    if (res.sorte === "pile") secousse = 7;
  };
  const suivre = (): void => {
    while (vus < partie.resultats.length) annoncer(partie.resultats[vus++]!);
  };
  const appuyer = (): void => {
    son.reveiller();
    if (partie.appuyer()) suivre();
  };
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    appuyer();
  });

  // --- `?debug&tune` : les curseurs de la maquette (à la demande, jamais en production) ; un réglage changé recommence la partie, qui n'est jamais classée ---
  let tune: { detruire(): void } | null = null;
  let detruite = false;
  if (essai) {
    void import("./tune").then((m) => {
      if (detruite) return;
      tune = m.monterTune(o.langue, reglagesEssai!, (r) => {
        reglagesEssai = r;
        partie = nouvelle(r);
        vus = 0;
        eclats = [];
      });
    });
  }

  const texte = (t: string, x: number, y: number, police: string, couleur: string, aligne: CanvasTextAlign = "center"): void => {
    g.font = police;
    g.textAlign = aligne;
    g.fillStyle = couleur;
    g.fillText(t, x, y);
  };
  const rect = (x: number, y: number, w: number, h: number, r: number): void => {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  };

  function dessiner(): void {
    const maintenant = performance.now();
    const dt = Math.min(0.1, (maintenant - avant) / 1000);
    avant = maintenant;
    majZones();
    g.fillStyle = k.creme;
    g.fillRect(0, 0, W, H);
    const p = place();
    const sx = secousse > 0.3 && !o.reduit ? (Math.random() - 0.5) * secousse : 0;
    secousse *= 0.85 ** (dt * 60);
    g.save();
    g.translate(sx, 0);
    g.textBaseline = "alphabetic";

    // Les dix lampes : bleu « pile », or « bien », argent « ouf », barrée si ratée ; la lampe en cours a un trait plus épais.
    const lpas = (p.gw - p.lr * 2) / (JAUGES - 1);
    for (let i = 0; i < JAUGES; i++) {
      const x = p.gx + p.lr + i * lpas;
      const res = partie.resultats[i];
      g.beginPath();
      g.arc(x, p.ly, p.lr, 0, Math.PI * 2);
      g.fillStyle = res ? (lampe(k, res.sorte) ?? k.creme) : i === partie.i ? k.papier : k.creme;
      g.fill();
      g.lineWidth = i === partie.i && !res ? 3.5 : 2.5;
      g.strokeStyle = k.encre;
      g.stroke();
      if (res?.sorte === "rate") {
        const d = p.lr * 0.5;
        g.beginPath();
        g.moveTo(x - d, p.ly - d);
        g.lineTo(x + d, p.ly + d);
        g.moveTo(x + d, p.ly - d);
        g.lineTo(x - d, p.ly + d);
        g.stroke();
      }
    }

    // La jauge : le cartouche, les graduations, la cible et sa zone « pile », le contour.
    const j = partie.jauge;
    const dernier = partie.pause > 0 || partie.fini ? partie.dernier : null;
    const px = (v: number): number => p.gx + (v / LONGUEUR) * p.gw;
    rect(p.gx + 5, p.gy + 5, p.gw, p.gh, 12);
    g.fillStyle = k.encre;
    g.fill();
    rect(p.gx, p.gy, p.gw, p.gh, 12);
    g.fillStyle = k.papier;
    g.fill();
    g.strokeStyle = k.creme;
    g.lineWidth = 2;
    for (let t = 1; t < 20; t++) {
      const x = p.gx + (p.gw * t) / 20;
      g.beginPath();
      g.moveTo(x, p.gy + p.gh - (t % 5 ? 12 : 22));
      g.lineTo(x, p.gy + p.gh);
      g.stroke();
    }
    const c = dernier ? dernier.c : partie.centreCible();
    g.fillStyle = k.moutarde;
    g.fillRect(px(c - j.demi), p.gy, px(c + j.demi) - px(c - j.demi), p.gh);
    g.fillStyle = k.coque;
    g.fillRect(px(c) - 2, p.gy, 4, p.gh);
    g.fillStyle = k.diamant;
    g.fillRect(px(c - partie.r.parfait), p.gy + p.gh - 10, Math.max(3, px(c + partie.r.parfait) - px(c - partie.r.parfait)), 10);
    rect(p.gx, p.gy, p.gw, p.gh, 12);
    g.lineWidth = 4;
    g.strokeStyle = k.encre;
    g.stroke();
    if (j.bouge && !partie.fini) texte(o.t("partie.bouge"), W / 2, p.gy + p.gh + 30, `14px ${k.titre}`, k.terre);

    // Le curseur, interpolé entre deux pas pour la fluidité (arrêté : sa place à l'appui).
    let xx = partie.x;
    if (dernier) xx = dernier.x;
    else if (partie.enJeu) {
      const alpha = Math.max(0, Math.min(1, (maintenant - avanceA) / PAS_MS));
      xx = Math.max(0, Math.min(LONGUEUR, partie.x + j.vitesse * partie.sens * alpha));
    }
    const cxp = px(xx);
    g.fillStyle = k.terre;
    g.strokeStyle = k.encre;
    g.lineWidth = 3;
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(cxp - 11, p.gy - 30);
    g.lineTo(cxp + 11, p.gy - 30);
    g.lineTo(cxp, p.gy - 8);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(cxp, p.gy - 8);
    g.lineTo(cxp, p.gy + p.gh + 10);
    g.lineWidth = 4;
    g.stroke();

    // Le mot de l'appui (« PILE ! », « BIEN », « OUF », « RATÉ ») et ses points, pendant la pause.
    if (dernier) {
      const avance = Math.min(1, (maintenant - annonceA) / ((partie.r.pauseResultat * 1000) / TICKS_PAR_SECONDE));
      const s = o.reduit ? 1 : 1 + Math.max(0, 0.35 - avance) * 1.2;
      g.save();
      g.translate(W / 2, p.gy - 52);
      g.scale(s, s);
      g.font = `46px ${k.titre}`;
      g.textAlign = "center";
      g.lineWidth = 7;
      g.strokeStyle = k.encre;
      g.lineJoin = "round";
      g.fillStyle = dernier.sorte === "pile" ? k.diamant : dernier.sorte === "rate" ? k.argent : dernier.sorte === "bien" ? k.moutarde : k.papier;
      const mot = o.t(`mot.${dernier.sorte}`);
      g.strokeText(mot, 0, 0);
      g.fillText(mot, 0, 0);
      g.restore();
      const gain = dernier.points + dernier.bonus > 0 ? o.t(dernier.bonus ? "partie.pointsBonus" : "partie.points", { n: dernier.points, b: dernier.bonus }) : o.t("partie.zero");
      texte(gain, W / 2, p.gy + p.gh + 58, `700 22px ${k.chiffres}`, k.encre);
    } else if (partie.i === 0 && partie.pasJauge < 150) {
      texte(o.t(o.tactile ? "partie.consigne.toucher" : "partie.consigne.touche"), W / 2, p.gy + p.gh + 58, `700 15px ${k.titre}`, k.gris);
    }

    // Les éclats du « pile ».
    for (const e of eclats) {
      e.x += e.vx * dt * 60;
      e.y += e.vy * dt * 60;
      e.vy += 0.35 * dt * 60;
      e.vie -= 1.5 * dt;
      if (e.vie <= 0) continue;
      g.globalAlpha = Math.max(0, e.vie);
      g.fillStyle = e.c;
      g.beginPath();
      g.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = k.encre;
      g.lineWidth = 1.5;
      g.stroke();
    }
    g.globalAlpha = 1;
    eclats = eclats.filter((e) => e.vie > 0);
    g.restore();
  }

  return {
    avancer() {
      partie.avancer();
      avanceA = performance.now();
      if (partie.rebond) son.tic();
      suivre();
    },
    finie: () => partie.fini,
    action(id) {
      if (id === "arreter") appuyer();
    },
    hud: () => ({ principal: o.t("hud.score", { n: partie.score }), secondaire: numero() }),
    resultat: () => ({ score: scoreDe(partie.resultat()), rediffusion: enregistrer(contenu, partie.appuis) }),
    bilan: () => {
      const r = partie.resultat();
      return { lignes: [{ cle: "bilan.piles", valeur: o.t("bilan.surDix", { n: r.piles }) }, { cle: "bilan.enchaine", valeur: r.enchaineMax > 1 ? o.t("hud.enchaine", { n: r.enchaineMax }) : "" }, { cle: "bilan.ratees", valeur: o.t("bilan.surDix", { n: r.ratees }) }] };
    },
    fantome: () => undefined,
    dessiner,
    detruire() {
      detruite = true;
      tune?.detruire();
      observateur.disconnect();
      canvas.remove();
    },
  };
}
