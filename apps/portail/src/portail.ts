import { parisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import { cartes } from "./jours";

// La page d'accueil minimale du portail « Du Jour » (lot R4) : une carte par jeu (nom, numéro du jour, lien). Le vrai portail viendra en phase 3.
// Le jour est celui de Paris (`@cdj/clock`), comme dans les jeux. Aucun stockage, aucune requête.

function render(): void {
  const day = parisDay(Date.now());
  const list = document.getElementById("jeux");
  if (!list) return;
  list.replaceChildren(
    ...cartes(day).map((c) => {
      const a = document.createElement("a");
      a.className = "carte";
      a.href = c.lien;
      a.dataset.jeu = c.code;
      const nom = Object.assign(document.createElement("h2"), { textContent: c.nom });
      const numero = Object.assign(document.createElement("p"), { className: "numero", textContent: c.titre });
      const accroche = Object.assign(document.createElement("p"), { className: "accroche", textContent: c.accroche });
      const jouer = Object.assign(document.createElement("span"), { className: "jouer", textContent: "Jouer →" });
      a.append(nom, numero, accroche, jouer);
      return a;
    }),
  );
  const date = document.getElementById("date");
  if (date) {
    const [y, m, d] = formatDay(day).split("-");
    date.textContent = `${d}/${m}/${y}`;
  }
}

render();
