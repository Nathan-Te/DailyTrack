import { consumeMigrationFragment, importMigration, migrationQuestion, type ListableStore, type MigrationOutcome, type PageAddress } from "@cdj/profile";
import { applyIdentity, noteCodeLoaded, pendingTrackIds } from "./transfer";

// Lot R4 (plateforme) : l'arrivée depuis l'ancienne adresse (GitHub Pages). La page de redirection a mis l'identité du joueur dans le fragment
// (`#dujour=…`, jamais envoyé au serveur) ; DailyTrack l'efface de l'adresse aussitôt lue, puis l'importe une seule fois (`@cdj/profile`,
// `importMigration`). Une **autre** identité déjà là : le joueur choisit (`confirm`) ; s'il prend celle de l'ancienne adresse, c'est la règle
// d'un code chargé ici (`applyIdentity` puis `noteCodeLoaded`). La synchronisation du serveur (lot P2) reconstruit records et profil.

/** Ce que l'import demande de la page (injecté : testé sans navigateur). */
export interface MigrationPage {
  address: PageAddress;
  replaceUrl(url: string): void;
  ask(question: string): boolean;
}

export function importFromOldAddress(storage: ListableStore & Pick<Storage, "setItem" | "removeItem">, today: string, page: MigrationPage): MigrationOutcome {
  const read = consumeMigrationFragment(page.address, (u) => page.replaceUrl(u));
  return importMigration(storage, read, {
    choose: (current, incoming) => page.ask(migrationQuestion(current, incoming)),
    adopt: (identity) => {
      if (!applyIdentity(identity, storage, pendingTrackIds(storage, today))) return false;
      noteCodeLoaded(storage);
      return true;
    },
  }).outcome;
}

/** La page réelle : l'adresse courante, `history.replaceState`, `confirm`. */
export function browserMigrationPage(): MigrationPage {
  return {
    address: { pathname: location.pathname, search: location.search, hash: location.hash },
    replaceUrl: (url) => history.replaceState(history.state, "", url),
    ask: (question) => confirm(question),
  };
}
