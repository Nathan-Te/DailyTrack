import { defineConfig } from "vite";

// Lot R4 (plateforme) : deux constructions, sans `package.json` (le dossier n'est pas un espace de travail npm : le verrou racine ne change pas).
//   `vite build -c apps/portail/vite.config.ts`                    → `dist/` : la page d'accueil du portail (racine de playdujour.com)
//   `… --mode redirection` (+ CIBLE, ANCIENNE_BASE facultatives)   → `dist-redirection/` : les pages de redirection de l'ancienne adresse
// `scripts/site.mjs` les lance et assemble le site (portail, /track/, /jump/) ou les pages de GitHub Pages.
export default defineConfig(({ mode }) => {
  const redirection = mode === "redirection";
  return {
    root: import.meta.dirname,
    // Le portail : chemins relatifs. Les redirections : chemin absolu de l'ancien site (le `404.html` est servi à n'importe quelle profondeur).
    base: redirection ? (process.env.ANCIENNE_BASE ?? "/DailyTrack/") : "./",
    define: { __CIBLE__: JSON.stringify((process.env.CIBLE ?? "https://playdujour.com").replace(/\/+$/, "")) },
    build: {
      target: "es2022",
      outDir: redirection ? "dist-redirection" : "dist",
      emptyOutDir: true,
      rollupOptions: { input: redirection ? "redirection.html" : "index.html" },
    },
  };
});
