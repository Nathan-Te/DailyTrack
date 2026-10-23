// Lot 43 — le compteur d'images par seconde de `?debug` (outil interne de Nathan, pour lire sur son téléphone l'ancienne et la nouvelle scène) : la
// moyenne et la pire image de la dernière seconde, dans un coin. Chargé à la demande (`import()` sous `?debug`), jamais dans le premier chargement
// d'un joueur ; `?debug&fps=0` le coupe. Exempté du test des chaînes en dur : des nombres et leurs unités, pas du texte d'interface.

export class CompteurImages {
  private readonly el: HTMLElement;
  private debut = -1;
  private dernier = -1;
  private images = 0;
  private pire = 0;
  /** Dernière mesure : images par seconde (moyenne sur une seconde) et pire intervalle (ms). */
  mesure = { ips: 0, pireMs: 0 };

  constructor(parent: HTMLElement) {
    this.el = document.createElement("div");
    this.el.id = "compteur-images";
    this.el.setAttribute("aria-hidden", "true");
    Object.assign(this.el.style, {
      position: "fixed",
      left: "max(8px, env(safe-area-inset-left))",
      bottom: "max(8px, env(safe-area-inset-bottom))",
      zIndex: "50",
      padding: "2px 6px",
      font: "600 12px/1.3 'JetBrains Mono', monospace",
      color: "#fff6e0",
      background: "rgba(42, 30, 22, 0.72)",
      borderRadius: "4px",
      pointerEvents: "none",
    });
    parent.append(this.el);
  }

  /** À chaque image (`requestAnimationFrame`) : `now` en ms. */
  image(now: number) {
    if (this.dernier >= 0) this.pire = Math.max(this.pire, now - this.dernier);
    this.dernier = now;
    if (this.debut < 0) this.debut = now;
    this.images++;
    const duree = now - this.debut;
    if (duree < 1000) return;
    this.mesure = { ips: Math.round(((this.images - 1) * 1000) / duree), pireMs: Math.round(this.pire) };
    this.el.textContent = `${this.mesure.ips} i/s · pire ${this.mesure.pireMs} ms`;
    this.debut = now;
    this.images = 1;
    this.pire = 0;
  }
}
