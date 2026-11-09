import type { Contenu } from "./generateur";
import { niveau, type Niveau } from "./niveaux";
import { Partie, type Commande, type Resultat } from "./course";

// La vérification au bit près : on rejoue des commandes et on note l'empreinte de TOUT l'état tous les `tous` pas (et à la fin). Deux machines (Node, Chromium, Firefox, WebKit) qui divergent d'un seul bit se
// voient à la première empreinte différente. Le golden, `apps/vertige/verify.html` et la mesure du lot s'en servent.
export interface Verification {
  resultat: Resultat;
  empreintes: string[];
}

export function verifier(contenu: Pick<Contenu, "niveau">, commandes: readonly Commande[], tous = 600): Verification {
  const p = new Partie(niveau(contenu.niveau));
  const empreintes: string[] = [];
  for (let i = 0; i < commandes.length && !p.finie; i++) {
    p.avancer(commandes[i]!);
    if ((i + 1) % tous === 0) empreintes.push(p.empreinte());
  }
  empreintes.push(p.empreinte());
  return { resultat: p.resultat(), empreintes };
}

/** L'empreinte d'un niveau (ses boîtes, son départ, sa zone d'arrivée, ses reprises, ses gemmes) : un niveau modifié change le golden. */
export function empreinteNiveau(n: Niveau): string {
  let h = 0x811c9dc5;
  const entier = (v: number): void => {
    const bas = ((v % 65536) + 65536) % 65536;
    const haut = Math.floor(v / 65536);
    for (const m of [bas, haut & 0xffff, Math.floor(haut / 65536) & 0xffff]) h = Math.imul(h ^ m, 0x01000193) >>> 0;
  };
  const boite = (b: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }): void => [b.x0, b.y0, b.z0, b.x1, b.y1, b.z1].forEach(entier);
  for (const b of n.blocs) boite(b.boite);
  [n.depart.x, n.depart.y, n.depart.z, n.depart.lacet, n.chute].forEach(entier);
  if (n.arrivee) boite(n.arrivee);
  for (const r of n.reprises) {
    boite(r.zone);
    [r.x, r.y, r.z, r.lacet].forEach(entier);
  }
  for (const g of n.gemmes) [g.x, g.y, g.z].forEach(entier);
  return h.toString(16).padStart(8, "0");
}
