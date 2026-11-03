import { call, clientAmis, type ApiResult, type ClientAmis, type FetchLike, type FiltreAmis } from "@cdj/profile";
import { el, traducteur } from "@cdj/ui";
import type { CleAmis } from "@cdj/ui/src/catalogue.amis";
import { classementAmisVide, feuilleJoueur, messageErreur, selecteurAmis, textesAmis, type FeuilleJoueur, type SelecteurAmis, type TraducteurAmis } from "@cdj/ui/src/amis";
import { CATALOGUE_AMIS } from "@cdj/ui/src/catalogue.amis";
import "./amis.css";
import { adresseDuFiltre, lireClassementAmis, lignesAmis, ouvrable, sansSelecteur, type AbsentAmi, type ClassementAmis } from "./amisLogique";
import { langueCourante, traducteurDuSocle } from "./i18n";
import type { RankRowView } from "./rankView";
import type { BoardUi, BoardView } from "./screensUi";

// Les amis dans l'écran du classement du jour de Jump (lot F2 de la plateforme) : le sélecteur « Tous · N / Amis · N », les lignes d'« Amis » et la feuille d'un joueur au toucher d'une ligne.
// **Chargé à la demande** (`import()` de `main.ts`, à l'ouverture du classement d'un joueur qui a une identité sur un vrai serveur) : ni ce fichier, ni les composants de `@cdj/ui/src/amis`,
// ni leur vocabulaire (`CATALOGUE_AMIS`, fr + en) ne sont dans le premier chargement. Tout le DOM du lot est ici ; les décisions pures sont dans `amisLogique.ts`.
//   - **Un `GET /api/amis` à chaque ouverture du classement** (le nombre d'amis du sélecteur) ; le classement « Amis » est une requête séparée (`board?filtre=amis`), seulement au choix
//     d'« Amis » (jamais avec le classement « Tous », que la lecture regroupée du jour porte déjà).
//   - Une erreur ne bloque rien : le classement retombe sur « Tous » avec une phrase discrète sous le sélecteur.
//   - Tout texte du serveur (pseudo) est posé en `textContent` (`el`) ; l'identifiant secret part en en-tête, jamais dans une adresse ; la feuille ne montre que ce que `ficheJoueur` rend.

export interface OptionsAmis {
  ui: BoardUi;
  /** L'adresse du serveur (celle du classement). */
  base: string;
  playerId: () => string | null;
  /** La date du classement affiché (le jour, ou l'archive). */
  date: () => string;
  /** Le filtre au départ (`?filtre=amis` de l'adresse). */
  filtre: FiltreAmis;
  /** Une ligne du classement du jeu (`ligneClassement` de `home.ts`, passée par `main.ts` : l'importer ici ferait de `home.ts` un fichier à part dans le premier chargement). */
  ligne: (r: RankRowView) => HTMLElement;
  /** La page « Mes amis » du portail (« Inviter un ami », sans ami). */
  href: string;
  fetch?: FetchLike;
  /** L'adresse de la page, et de quoi la changer sans recharger (la page elle-même par défaut ; les tests injectent la leur). */
  page?: { lire(): { pathname: string; search: string; hash: string }; remplacer(adresse: string): void };
}

export interface ControleurAmis {
  /** Le classement vient de s'ouvrir (après `ui.open(vue)`) : lit le nombre d'amis et pose le sélecteur. */
  ouvrir(vue: BoardView): void;
  /** Il vient de se fermer : la feuille et les demandes en cours s'arrêtent. */
  fermer(): void;
  readonly filtre: FiltreAmis;
}

const pageDuNavigateur = (): NonNullable<OptionsAmis["page"]> => ({
  // L'adresse ne se lit que par `readUrlOptions` (`urlOptions.ts`) : ici on ne lit aucun paramètre, on la réécrit telle quelle avec le seul filtre changé.
  lire: () => {
    const u = new URL(location.href);
    return { pathname: u.pathname, search: u.search, hash: u.hash };
  },
  remplacer: (adresse) => {
    try {
      history.replaceState(history.state, "", adresse);
    } catch {
      /* adresse protégée : le choix reste valable sans elle */
    }
  },
});

export function brancherAmis(o: OptionsAmis): ControleurAmis {
  const { ui } = o;
  const page = o.page ?? pageDuNavigateur();
  const base = o.base === "/" ? "" : o.base.replace(/\/+$/, "");
  const client: ClientAmis = clientAmis({ base: o.base, playerId: o.playerId, fetch: o.fetch });
  // Le vocabulaire des amis d'abord, puis le traducteur du jeu (qui porte déjà le catalogue commun : médailles, `erreur.<code>`), dans la langue du moment.
  const nouveauT = (): TraducteurAmis => {
    const amisT = traducteur(langueCourante(), CATALOGUE_AMIS);
    const jeu = traducteurDuSocle();
    return { langue: jeu.langue, t: (cle: string, params?: never) => (amisT.t(cle as never, params) !== cle ? amisT.t(cle as never, params) : jeu.t(cle as never, params)) } as unknown as TraducteurAmis;
  };
  let t = nouveauT();
  let filtre: FiltreAmis = o.filtre;
  /** Le sélecteur est posé (une identité connue du serveur) : sinon le classement reste « Tous ». */
  let disponible = false;
  let amis: number | null = null;
  let groupe: number | undefined; // lot C1, partie C : les membres de mon groupe (absent : pas de « Mon groupe »)
  let selecteur: SelecteurAmis | null = null;
  let classement: ClassementAmis | null = null;
  let vue: BoardView | null = null;
  let feuille: FeuilleJoueur | null = null;
  /** Numéro de la dernière ouverture / demande : une réponse d'avant est ignorée. */
  let ouverture = 0;
  let demande = 0;
  const message = el("p", { classe: "dj-amis-message dj-amis-message--echec", attrs: { role: "status", "aria-live": "polite" } });
  /** Un texte du vocabulaire des amis (`CATALOGUE_AMIS`, à la demande), pas du catalogue du jeu. */
  const texte = (cle: CleAmis): string => t.t(cle);
  const actif = (): FiltreAmis => (disponible ? filtre : "tous");

  const ecrireAdresse = () => page.remplacer(adresseDuFiltre(page.lire(), filtre));
  const redessiner = () => {
    if (vue) ui.update(vue);
  };

  // --- Le toucher d'une ligne : la feuille du joueur ---
  function rendreOuvrable(li: HTMLElement, r: { ref?: string; name: string }): void {
    const qui = li.querySelector(".ligne__qui");
    const nom = qui ? [...qui.children].find((c) => c.classList.contains("ligne__nom")) : undefined;
    if (!qui || !nom || !r.ref) return;
    const ref = r.ref;
    // Le pseudo devient un bouton dont le ::after couvre toute la ligne (cible de 44 px, un seul arrêt de tabulation par ligne).
    const b = el("button", { classe: "ligne__bouton", attrs: { type: "button" } });
    const reste = [...qui.children].filter((c) => c !== nom);
    b.append(nom);
    qui.replaceChildren(b, ...reste);
    li.classList.add("ligne--ouvrable");
    b.addEventListener("click", () => ouvrirFeuille(ref, r.name));
  }

  function ouvrirFeuille(ref: string, pseudo: string): void {
    feuille?.fermer();
    let change = false;
    const suite = async (envoi: Promise<ApiResult<{ total: number }>>): Promise<ApiResult<{ total: number }>> => {
      const r = await envoi;
      if (r.ok) {
        change = true;
        amis = r.data.total;
        selecteur?.maj({ amis });
      }
      return r;
    };
    const f: FeuilleJoueur = feuilleJoueur({
      t,
      pseudo,
      jeu: "jump",
      onAjouter: () => suite(client.ajouterAmi({ ref })),
      onRetirer: () => suite(client.retirerAmi(ref)),
      onFermer: () => {
        if (feuille === f) feuille = null;
        // Un ami de plus ou de moins : « Amis » se relit (la ligne apparaît ou disparaît) ; « Tous » n'a rien à changer.
        if (change && actif() === "amis" && ui.isOpen) void chargerAmis();
      },
    });
    feuille = f;
    const lire = async (): Promise<void> => {
      f.chargement();
      const r = await client.ficheJoueur(ref, o.date());
      if (!f.ouverte) return;
      if (r.ok) f.afficher(r.data);
      else f.erreur(r.code, () => void lire());
    };
    void lire();
  }

  // --- Le dessin : « Tous » (les lignes du jeu, rendues tactiles) ou « Amis » ---
  function decorerTous(v: BoardView): void {
    const lis = [...ui.hote.liste.children].filter((c) => !c.classList.contains("ligne--trou")) as HTMLElement[];
    v.rows.forEach((r, i) => {
      const li = lis[i];
      if (li && ouvrable(r)) rendreOuvrable(li, r);
    });
  }

  function ligneAbsent(a: AbsentAmi): HTMLElement {
    const li = el(
      "li",
      { classe: "ligne ligne--absent" },
      el("span", { classe: "ligne__rang", attrs: { "aria-hidden": "true" }, texte: "—" }),
      el("span", { classe: "ligne__qui" }, el("span", { classe: "ligne__nom", texte: a.pseudo })),
      el("span", { classe: "ligne__medaille", attrs: { "aria-hidden": "true" } }),
      el("span", { classe: "ligne__temps", texte: textesAmis(t).pasJoue() }),
    );
    rendreOuvrable(li, { ref: a.ref, name: a.pseudo });
    return li;
  }

  function dessinerAmis(c: ClassementAmis): void {
    const { classes, absents } = lignesAmis(c);
    const lis = classes.map((r: RankRowView) => {
      const li = o.ligne(r);
      if (ouvrable(r)) rendreOuvrable(li, r);
      return li;
    });
    const bas = absents.map(ligneAbsent);
    const h = ui.hote;
    h.liste.replaceChildren(...lis, ...bas);
    h.tete.hidden = lis.length + bas.length === 0;
    h.message.textContent = "";
    h.message.hidden = true;
    h.course.hidden = true;
    h.pied.replaceChildren(...(filtre === "amis" && c.amis === 0 ? [classementAmisVide(t, { href: o.href })] : []));
  }

  function dessinerChargement(): void {
    const h = ui.hote;
    h.liste.replaceChildren();
    h.tete.hidden = true;
    h.message.textContent = texte("amis.chargement");
    h.message.hidden = false;
    h.course.hidden = true;
    h.pied.replaceChildren();
  }

  /** Appelé à la fin de chaque dessin du classement du jeu (ouverture, nouvelle lecture, changement de langue). */
  function apresRendu(v: BoardView): void {
    vue = v;
    selecteur?.maj({ total: v.participants ?? null });
    if (actif() === "tous") {
      ui.hote.pied.replaceChildren();
      if (disponible) decorerTous(v); // sans profil connu du serveur, une feuille n'aurait rien à ajouter
    } else if (classement === null) dessinerChargement();
    else dessinerAmis(classement);
  }

  // --- Le choix du filtre ---
  async function chargerAmis(): Promise<void> {
    const mon = ++demande;
    classement = null;
    message.textContent = "";
    redessiner();
    const id = o.playerId();
    // `GET …/board?filtre=amis` : la réponse est lue prudemment (`lireClassementAmis`) ; l'identifiant part en en-tête.
    const r: ApiResult<unknown> = id ? await call<unknown>(base, "GET", `/api/jump/day/${encodeURIComponent(o.date())}/board?filtre=${filtre === "groupe" ? "groupe" : "amis"}`, undefined, undefined, { "X-Player-Id": id }, o.fetch) : { ok: false, status: 0, code: "invalid_player", message: "" };
    if (mon !== demande || !ui.isOpen) return;
    const lu = r.ok ? lireClassementAmis(r.data, filtre === "groupe" ? "groupe" : "amis") : null;
    if (lu) {
      classement = lu;
      amis = lu.amis;
      selecteur?.maj({ amis });
      redessiner();
      return;
    }
    // Repli : « Tous », et une phrase discrète (hors ligne, ou le code du serveur ; une réponse qui n'est pas celle du filtre : la phrase générale).
    filtre = "tous";
    ecrireAdresse();
    selecteur?.maj({ filtre: "tous" });
    message.textContent = messageErreur(t, r.ok ? "illisible" : r.code);
    redessiner();
  }

  function choisir(f: FiltreAmis): void {
    if (f === filtre) return;
    filtre = f;
    ecrireAdresse();
    message.textContent = "";
    if (f === "tous") {
      demande++;
      classement = null;
      redessiner();
    } else void chargerAmis();
  }

  function poserSelecteur(): void {
    selecteur = selecteurAmis({ t, filtre, total: vue?.participants ?? null, amis, groupe, onChange: choisir, jeu: "jump" });
    ui.hote.amis.replaceChildren(selecteur.racine, message);
  }

  const brancher = () => {
    ui.hote.apres = apresRendu;
    ui.hote.echap = () => feuille?.ouverte ?? false;
  };

  return {
    get filtre() {
      return filtre;
    },
    ouvrir(v) {
      const mon = ++ouverture;
      t = nouveauT();
      vue = v;
      brancher();
      disponible = false;
      selecteur = null;
      classement = null;
      message.textContent = "";
      ui.hote.amis.replaceChildren();
      if (!o.playerId()) return; // pas d'identité : rien à filtrer, aucune requête
      void client.lireAmis().then(async (r) => {
        if (mon !== ouverture || !ui.isOpen) return;
        if (!r.ok && sansSelecteur(r.code)) return; // pas de profil connu du serveur : rien à filtrer
        amis = r.ok ? r.data.total : null;
        groupe = r.ok ? r.data.groupe : undefined;
        disponible = true;
        poserSelecteur();
        if (filtre !== "tous") await chargerAmis();
        else redessiner();
      });
    },
    fermer() {
      ouverture++;
      demande++;
      disponible = false;
      feuille?.fermer();
      feuille = null;
    },
  };
}
