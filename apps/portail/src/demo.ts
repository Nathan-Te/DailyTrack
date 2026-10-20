import { noteIdentityChange, readIdentity, readPlayerId, writeIdentity } from "@cdj/profile";
import { CATALOGUE_COMMUN, bouton, el, traducteur, type Langue } from "@cdj/ui";
import { CATALOGUE_DEMO } from "./catalogueDemo";

// Lot I2 : `/?demo=joueur` — **recette et aperçus seulement**. Installe dans ce navigateur l'identité du joueur de démonstration « Démo » que
// `recette:seed` crée sur le serveur de recette (`apps/api/src/portailDemo.ts` : même identifiant, test `test/demo.test.ts`), pour juger le
// portail plein en deux clics. Avec une autre identité déjà là : la confirmation habituelle (le profil de l'appareil sera remplacé), comme un
// code chargé. **Absent de la production** : `portail.ts` n'importe ce module que si `__PORTAIL_DEMO__` (faux pour la construction de
// production, `vite.config.ts`) ; le chemin, l'identifiant et ces textes ne sont pas dans les fichiers publiés (test `construction.test.ts`).
// Exception assumée à la règle du lot R5 (« rien dans l'adresse ne remplace une identité ») : seulement hors production, seulement ce compte
// de démonstration connu, et jamais sans confirmation s'il y a déjà une identité.

/** Le joueur de démonstration de la recette (`DEMO_JOUEUR_ID`, `DEMO_JOUEUR_NOM` d'apps/api/src/portailDemo.ts). */
export const DEMO_JOUEUR = { id: "de30de30de30de30de30de30de30de30", nom: "Démo" } as const;

type Stockage = Parameters<typeof writeIdentity>[1];

function installer(stockage: Stockage): void {
  writeIdentity({ id: DEMO_JOUEUR.id, name: DEMO_JOUEUR.nom }, stockage);
  // Un code chargé : les jeux vident leur cache de l'ancienne identité à leur prochain démarrage (révision d'identité, lot P4).
  noteIdentityChange(stockage, "code");
}

/**
 * Le lien de démonstration : rend `true` quand le portail peut se charger (identité installée, déjà là, ou refusée), après la confirmation si
 * elle est nécessaire (montrée dans `racine`). L'adresse perd `?demo=joueur` (un rechargement ne redemande rien).
 */
export function lienDemo(stockage: Stockage | null, langue: Langue, racine: HTMLElement): Promise<boolean> {
  const sansParametre = () => {
    const url = new URL(location.href);
    url.searchParams.delete("demo");
    history.replaceState(null, "", url);
  };
  if (!stockage) return Promise.resolve(true);
  const actuel = readPlayerId(stockage);
  if (actuel === null || actuel === DEMO_JOUEUR.id) {
    installer(stockage);
    sansParametre();
    return Promise.resolve(true);
  }
  const t = traducteur(langue, CATALOGUE_DEMO, CATALOGUE_COMMUN);
  return new Promise((fin) => {
    const finir = (oui: boolean) => {
      if (oui) installer(stockage);
      sansParametre();
      fin(true);
    };
    const nom = readIdentity(stockage).name ?? "—";
    const titre = el("h1", { classe: "portail-demo__titre", attrs: { id: "demo-titre" }, texte: t.t("demo.titre") });
    racine.replaceChildren(
      el(
        "section",
        { classe: "portail-demo", attrs: { id: "demo", role: "dialog", "aria-labelledby": "demo-titre" } },
        titre,
        el("p", { texte: t.t("demo.texte", { nom: DEMO_JOUEUR.nom, actuel: nom }) }),
        el(
          "div",
          { classe: "portail-demo__actions" },
          bouton({ texte: t.t("demo.installer"), variante: "marque", onClick: () => finir(true) }),
          bouton({ texte: t.t("demo.annuler"), variante: "secondaire", onClick: () => finir(false) }),
        ),
      ),
    );
    racine.querySelector<HTMLElement>(".dj-bouton--marque")?.focus();
  });
}
