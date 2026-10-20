import { collectMigration, migrationFragment } from "@cdj/profile";
import { correspondance } from "./correspondance";

// Les pages de redirection de l'ancienne adresse (GitHub Pages, lot R4), publiées par `.github/workflows/pages.yml` à la bascule : `index.html`,
// `jump/index.html` et `404.html` (tout autre chemin, les anciens aperçus `b/…` compris). Elles lisent dans le stockage de l'ancienne origine
// l'identité de la plateforme (et les données locales utiles de DailyJump, si la taille le permet) et les transmettent **dans le fragment**
// (`#dujour=…`, `@cdj/profile`) : jamais en paramètre, le fragment n'est jamais envoyé au serveur. Le nouveau domaine est fixé à la
// construction (`__CIBLE__`) : aucune adresse lue dans l'URL (une page qui enverrait l'identité vers une adresse choisie par un lien serait un piège).

declare const __CIBLE__: string;

function stockage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    void s.length;
    return s;
  } catch {
    return null;
  }
}

function go(): void {
  const where = correspondance(location.pathname, location.search, __CIBLE__);
  for (const a of document.querySelectorAll<HTMLAnchorElement>("a[data-cible]")) a.href = where.url;
  if (where.kind === "apercu") {
    document.body.dataset.etat = "apercu";
    return;
  }
  const store = stockage();
  const payload = store ? collectMigration(store) : null;
  // `replace` : l'ancienne adresse ne reste pas dans l'historique (le bouton « retour » ne ramène pas ici).
  location.replace(payload ? `${where.url}${migrationFragment(payload)}` : where.url);
}

go();
