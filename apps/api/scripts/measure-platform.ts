// `npm run measure:platform -w @cdj/api -- --jump 800 --track 300 --salon 40` (lot P4 de la plateforme) : le coût projeté d'un mois à partir
// du nombre **réel** de joueurs par jour de chaque jeu, saisi à la main (`--jump` : DailyJump ; `--track` : circuit du jour de DailyTrack ;
// `--salon` : joueurs qui passent 30 minutes au Salon par jour ; lot I2 : `--portail` : visiteurs du portail par jour ; lot TP : `--tower` : joueurs de Tower par jour). Les coûts unitaires viennent des mesures des lots P1 à P4 et de DailyTrack
// (`scripts/platformBudget.ts` dit d'où vient chaque chiffre). Rien n'est lu ni écrit : un calcul. Seuils et décisions : docs/plateforme/couts.md.
import { FREE_TIER, projectMonth } from "./platformBudget";

const arg = (name: string, fallback: number): number => {
  const at = process.argv.indexOf(`--${name}`);
  const v = at > 0 ? Number(process.argv[at + 1]) : fallback;
  if (!Number.isFinite(v) || v < 0) {
    console.error(`--${name} attend un nombre de joueurs par jour (reçu « ${process.argv[at + 1]} »)`);
    process.exit(1);
  }
  return v;
};
const input = { jump: arg("jump", 0), track: arg("track", 0), salon: arg("salon", 0), portail: arg("portail", 0), tower: arg("tower", 0) };
const fr = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });
const p = projectMonth(input);

console.log(`Mois projeté (30 jours) : DailyJump ${fr(input.jump)} joueurs/jour · DailyTrack ${fr(input.track)} · Salon ${fr(input.salon)} (30 min chacun) · Tower ${fr(input.tower)} · Portail ${fr(input.portail)} visiteurs\n`);
for (const r of p.resources) {
  const bar = "█".repeat(Math.min(20, Math.round(r.share * 20))).padEnd(20, "·");
  const over = r.overUsd === null ? (r.share > 1 ? "  → au-delà : offre payante de Turso" : "") : r.overUsd > 0 ? `  → au-delà : ≈ ${fr(r.overUsd, 2)} $` : "";
  console.log(`${r.name.padEnd(40)} ${bar} ${fr(r.share * 100, 1).padStart(6)} %  (${fr(r.used)} sur ${fr(r.free)})${over}`);
}
console.log("\nPar jeu (mois) :");
for (const [game, g] of Object.entries(p.byGame)) {
  console.log(`  ${game.padEnd(11)} ${fr(g.requests / 1e6, 2).padStart(6)} M requêtes · ${fr(g.billedS).padStart(8)} vCPU-s · ${fr(g.read / 1e6, 1).padStart(7)} M lignes lues · ${fr(g.written / 1e6, 2).padStart(6)} M écrites`);
}
const overUsd = p.resources.reduce((s, r) => s + (r.overUsd ?? 0), 0);
console.log(
  p.firstLimit
    ? `\n⚠ Offre gratuite dépassée : ${p.firstLimit}. Cloud Run au-delà ≈ ${fr(overUsd, 2)} $ par mois (tarif public, à vérifier). Voir docs/plateforme/couts.md, « Quand l'offre gratuite approche ».`
    : `\nDans l'offre gratuite. Marge : ×${fr(p.headroom, 1)} joueurs avant le premier plafond (${p.resources.reduce((a, b) => (b.share > a.share ? b : a)).name}).`,
);
console.log(`(Offre gratuite par mois : ${fr(FREE_TIER.requests / 1e6)} M requêtes, ${fr(FREE_TIER.vcpuS)} vCPU-s, ${fr(FREE_TIER.tursoRead / 1e6)} M lignes lues, ${fr(FREE_TIER.tursoWritten / 1e6)} M écrites.)`);
