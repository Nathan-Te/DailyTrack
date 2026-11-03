import "./amisClassement.css";
import { adresseDuFiltre, filtreDeLAdresse, lireClassementAmis, ouvreUneFeuille, sansAmi, type ClassementAmisTower, type LigneTouchable } from "./amisLogique";
import { clientAmis, ProfileClient, type ApiResult, type FiltreAmis } from "@cdj/profile";
import { CATALOGUE_COMMUN_FR, el, traducteur } from "@cdj/ui";
import { classementAmisVide, feuilleJoueur, messageErreur, selecteurAmis, textesAmis, type ResultatAction, type TraducteurAmis } from "@cdj/ui/src/amis";
import { CATALOGUE_AMIS } from "@cdj/ui/src/catalogue.amis";
import type { ClassementTower } from "./apiTower";
import type { ControleAmis, EtatClassement, HoteAmis, SourceAmis } from "./classementUi";
import { langueCourante } from "./i18n";

// Lot F2 — « Les amis » dans le classement de Tower, **à la demande** (chargé par `classementUi.ts` (`monterClassement`) à la première ouverture d'un joueur qui a une identité et un serveur ; jamais dans l'accueil ni
// dans le jeu). Le sélecteur « Tous · N / Amis · N » et la feuille d'un joueur sont ceux de `@cdj/ui/src/amis` (aucun appel réseau dans le socle : on lui donne des callbacks) ; le client des routes
// est `clientAmis` de `@cdj/profile`. **Le classement « Amis » est à la hauteur** : toi et tes amis, tous, sans la limite des 50, rang entre amis, rang général au toucher, les amis qui n'ont rien
// fini en bas. La requête « Amis » n'est faite qu'au choix d'« Amis » (ou à l'ouverture si l'adresse porte `?filtre=amis`) ; le compteur « Amis · N » est lu une seule fois par ouverture.
// Une erreur ramène à « Tous » avec un message discret. Un pseudo est une donnée : `textContent` (R7).

/** Le client des routes de Tower qui n'existent que pour les amis : le même `call` que le reste du profil (délai, erreurs en valeur, `X-Player-Id` en en-tête, jamais dans l'adresse). */
class LectureAmis extends ProfileClient {
  classement(date: string, playerId: string, filtre: "amis" | "groupe"): Promise<ApiResult<unknown>> {
    return this.call<unknown>("GET", `/api/tower/day/${encodeURIComponent(date)}/board?filtre=${filtre}`, undefined, { "X-Player-Id": playerId });
  }
}

/** Les textes des composants : le commun (médailles, `erreur.<code>`) et `CATALOGUE_AMIS` ; l'anglais du commun est le morceau à part que le jeu charge déjà. */
async function traducteurAmis(): Promise<TraducteurAmis> {
  const en = langueCourante() === "en" ? (await import("./catalogue.en")).CATALOGUE_COMMUN_EN : {};
  return traducteur(langueCourante(), { fr: CATALOGUE_COMMUN_FR, en }, CATALOGUE_AMIS) as unknown as TraducteurAmis;
}

const resultat = <T>(r: ApiResult<T>): ResultatAction => (r.ok ? { ok: true } : { ok: false, code: r.code ?? "network" });

/** Ce que les amis savent de l'écran à cet instant ; `null` sans serveur, sans identité ou sans jour : pas de sélecteur. */
interface ContexteAmis {
  base: string;
  playerId: string;
  date: string;
}
const contexteDe = (s: SourceAmis | undefined): ContexteAmis | null => {
  const playerId = s?.id() ?? null;
  return s?.base && playerId && s.date ? { base: s.base, playerId, date: s.date } : null;
};

/** Appelé par le dialogue à chaque ouverture (`neuve` : il vient de s'ouvrir) : monte le sélecteur une fois, puis met à jour. Sans contexte (pas d'identité ou de serveur), rien ne change. */
export async function surOuverture(h: HoteAmis, neuve: boolean, b: ClassementTower | null, etat: EtatClassement): Promise<void> {
  if (!contexteDe(h.amis)) return;
  const c = await (h.controle ??= brancherAmis(h, () => contexteDe(h.amis)));
  if (neuve) c.ouverture();
  c.tous(b, etat);
}

async function brancherAmis(h: HoteAmis, contexte: () => ContexteAmis | null): Promise<ControleAmis> {
  const t = await traducteurAmis();
  const textes = textesAmis(t);
  let filtre: FiltreAmis = filtreDeLAdresse(location.search);
  h.filtre = filtre;
  let tousEtat: EtatClassement = "ok";
  let envoi = 0; // la dernière demande « Amis » : une réponse plus ancienne est ignorée
  let comptage = 0; // idem pour le compteur
  let sale = false; // une amitié a changé pendant que « Amis » était affiché

  const selecteur = selecteurAmis({ t, filtre, total: null, amis: null, jeu: "tower", onChange: (f) => choisir(f) });
  h.tete.after(selecteur.racine);
  const extras = el("div", { classe: "amis-extras" });
  h.liste.after(extras);

  const client = (c: ContexteAmis) => clientAmis({ base: c.base, playerId: c.playerId });

  // --- Les lignes touchables : le nom d'un autre joueur devient un bouton (clavier, manette, toucher) qui ouvre sa feuille ---
  function habiller(): void {
    for (const li of Array.from(h.liste.children) as HTMLElement[]) {
      const nom = li.querySelector<HTMLElement>(".rang__nom");
      const l: LigneTouchable = { ref: li.dataset.ref, pseudo: nom?.textContent ?? "", moi: li.classList.contains("rang--moi") };
      if (!nom || nom.tagName === "BUTTON" || !ouvreUneFeuille(l)) continue;
      const b = el("button", { classe: "rang__nom rang__bouton", attrs: { type: "button", "aria-haspopup": "dialog" }, texte: l.pseudo });
      b.addEventListener("click", () => ouvrirFeuille(l));
      nom.replaceWith(b);
    }
  }

  function ouvrirFeuille(l: LigneTouchable & { ref: string }): void {
    const c = contexte();
    if (!c) return;
    const api = client(c);
    const feuille = feuilleJoueur({
      t,
      pseudo: l.pseudo,
      jeu: "tower",
      onAjouter: async () => {
        const r = await api.ajouterAmi({ ref: l.ref });
        if (r.ok) {
          selecteur.maj({ amis: r.data.total });
          sale = true;
        }
        return resultat(r);
      },
      onRetirer: async () => {
        const r = await api.retirerAmi(l.ref);
        if (r.ok) {
          selecteur.maj({ amis: r.data.total });
          sale = true;
        }
        return resultat(r);
      },
      onFermer: () => {
        if (sale && filtre === "amis") void montrerAmis();
        sale = false;
      },
    });
    const charger = async (): Promise<void> => {
      feuille.chargement();
      const r = await api.ficheJoueur(l.ref, c.date);
      if (!feuille.ouverte) return;
      if (r.ok) feuille.afficher(r.data);
      else feuille.erreur(r.code ?? "network", () => void charger());
    };
    void charger();
  }

  // --- Le classement « Amis » ---
  function effacerExtras(): void {
    extras.replaceChildren();
  }

  function dessinerAmis(c: ClassementAmisTower): void {
    h.sous.textContent = h.classes(c.classes);
    h.message.textContent = "";
    h.message.hidden = true;
    h.liste.replaceChildren(...c.lignes.map((l) => {
      const li = h.ligne(l, l.moi);
      // Le rang général au toucher de la ligne (et pour les lecteurs d'écran) : « 8e sur 412 ».
      li.title = t.t("amis.feuille.rang", { rang: l.rangGeneral, classes: c.participants });
      return li;
    }));
    effacerExtras();
    if (c.absents.length > 0) {
      const titre = el("h3", { classe: "amis-absents__titre", texte: textes.absents() });
      const items = c.absents.map((a) => {
        const b = el("button", { classe: "rang__bouton", attrs: { type: "button", "aria-haspopup": "dialog" }, texte: a.pseudo });
        b.addEventListener("click", () => ouvrirFeuille({ ref: a.ref, pseudo: a.pseudo, moi: false }));
        return el("li", { classe: "amis-absent" }, b, el("span", { classe: "amis-absent__vide", texte: textes.pasJoue() }));
      });
      extras.append(titre, el("ul", { classe: "amis-absents" }, ...items));
    }
    if (filtre === "amis" && sansAmi(c)) extras.append(classementAmisVide(t, { href: "../amis/" }));
    habiller();
  }

  async function montrerAmis(): Promise<void> {
    const c = contexte();
    const mon = ++envoi;
    if (!c) return retomber("network");
    h.liste.replaceChildren();
    effacerExtras();
    h.sous.textContent = "";
    h.message.textContent = t.t("amis.chargement");
    h.message.hidden = false;
    const demande = filtre === "groupe" ? "groupe" : "amis";
    const r = await new LectureAmis(c.base).classement(c.date, c.playerId, demande);
    if (mon !== envoi || filtre !== demande) return;
    const lu = r.ok ? lireClassementAmis(r.data, demande) : null;
    if (!lu) return retomber(r.ok ? "network" : (r.code ?? "network"));
    dessinerAmis(lu);
  }

  /** « Amis » n'a pas répondu : retour à « Tous », et une ligne discrète pour le dire. */
  function retomber(code: string): void {
    appliquer("tous");
    h.message.textContent = messageErreur(t, code);
    h.message.hidden = false;
  }

  function appliquer(f: FiltreAmis): void {
    filtre = f;
    h.filtre = f;
    envoi++;
    selecteur.maj({ filtre: f });
    try {
      history.replaceState(history.state, "", adresseDuFiltre(location, f));
    } catch {
      /* adresse non modifiable : le choix vaut quand même pour cette visite */
    }
    if (f === "tous") {
      effacerExtras();
      h.rendreTous();
      habiller();
    }
  }

  function choisir(f: FiltreAmis): void {
    appliquer(f);
    if (f !== "tous") void montrerAmis();
  }

  return {
    ouverture() {
      // Le compteur « Amis · N » : une seule lecture par ouverture du dialogue.
      const c = contexte();
      const mon = ++comptage;
      if (c) {
        void client(c)
          .lireAmis()
          .then((r) => {
            if (r.ok && mon === comptage) selecteur.maj({ amis: r.data.total, groupe: r.data.groupe });
          });
      }
      selecteur.maj({ filtre });
      if (filtre !== "tous") void montrerAmis();
    },
    tous(b, etat) {
      tousEtat = etat;
      selecteur.maj({ total: b ? b.participants : null });
      selecteur.racine.hidden = b === null && tousEtat === "indisponible" && filtre === "tous";
      if (filtre === "tous") habiller();
    },
  };
}
