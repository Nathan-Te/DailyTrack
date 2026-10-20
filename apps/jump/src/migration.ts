import { consumeMigrationFragment, importMigration, migrationQuestion, type ListableStore, type MigrationOutcome, type PageAddress } from "@cdj/profile";
import type { DayRecord } from "./history";
import { applyJumpIdentity } from "./jumpProfile";
import { pageAddress } from "./urlOptions";

// Lot R4 (plateforme) : l'arrivée depuis l'ancienne adresse (GitHub Pages). La page de redirection a mis l'identité du joueur et les données
// locales utiles de DailyJump (envoi en attente, vies à envoyer, mémoire du jour) dans le fragment (`#dujour=…`, jamais envoyé au serveur) ;
// DailyJump l'efface de l'adresse aussitôt lue, puis l'importe une seule fois (`@cdj/profile`, `importMigration`). Une **autre** identité
// déjà là : le joueur choisit (`confirm`) ; s'il prend celle de l'ancienne adresse, c'est la règle d'un code chargé ici (`applyJumpIdentity`).

/** Ce que l'import demande de la page (injecté : testé sans navigateur). */
export interface MigrationPage {
  address: PageAddress;
  replaceUrl(url: string): void;
  ask(question: string): boolean;
}

export function importFromOldAddress(storage: ListableStore, local: readonly DayRecord[], today: string, page: MigrationPage): MigrationOutcome {
  const read = consumeMigrationFragment(page.address, (u) => page.replaceUrl(u));
  return importMigration(storage, read, {
    choose: (current, incoming) => page.ask(migrationQuestion(current, incoming)),
    adopt: (identity) => applyJumpIdentity(identity, storage, local, today),
  }).outcome;
}

/** La page réelle : l'adresse courante, `history.replaceState`, `confirm`. */
export function browserMigrationPage(): MigrationPage {
  return {
    address: pageAddress(),
    replaceUrl: (url) => history.replaceState(history.state, "", url),
    ask: (question) => confirm(question),
  };
}
