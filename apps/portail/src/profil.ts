import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "@cdj/ui/src/polices/lilita-one-400.css";
import "./portail.css";
import { parisDay } from "@cdj/clock";
import { parseDay } from "@cdj/core";
import {
  NAME_KEY,
  ProfileClient,
  call,
  decodeTransfer,
  ecrireLangue,
  encodeTransfer,
  isValidName,
  lireLangue,
  noteIdentityChange,
  normalizeName,
  readIdentity,
  readPlayerId,
  writeIdentity,
  type ApiResult,
  type Langue,
} from "@cdj/profile";
import {
  CATALOGUE_COMMUN,
  MEDAILLES,
  barreJeu,
  bouton,
  choixLangue,
  el,
  etiquetteJump,
  etiquetteTrack,
  formatDateCourte,
  formatNombre,
  formatRang,
  icone,
  medaille,
  traducteur,
  tuile,
} from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { cartes } from "./jours";
import { stockageDuPortail } from "./stockage";

// Lot I2 : le profil commun (`/profil/`), ouvert par l'avatar du portail. **Le même profil** que Réglages › Profil des jeux : même stockage
// (`cdj:player`, `cdj:name`, même origine), mêmes routes et mêmes refus (`PUT /api/player` pour le pseudo ; un code chargé est lu sur le
// serveur et confirmé avant de remplacer l'identité), et la révision d'identité du lot P4 (un code chargé ici avance `cdj:identite:code` :
// chaque jeu vide son cache de l'ancienne identité à son prochain démarrage). Une requête au chargement : `GET /api/portail/profil` (pseudo,
// série tous jeux, journées parfaites, et par jeu jours finis, médailles, meilleure place). Jamais de requête sans identité.

const stockage = stockageDuPortail();
let langue: Langue = lireLangue(stockage, navigator.languages).langue;
const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_COMMUN);
type T = ReturnType<typeof traduire>;
type Cle = Parameters<T["t"]>[0];
const cleConnue = (cle: string): Cle | null => (cle in CATALOGUE_PORTAIL.fr || cle in CATALOGUE_COMMUN.fr ? (cle as Cle) : null);
const client = new ProfileClient("");

interface ProfilJeu {
  jeu: string;
  joursFinis: number;
  medailles: Record<"author" | "gold" | "silver" | "bronze", number>;
  meilleurRang: { date: string; rang: number; classes: number } | null;
}
interface Profil {
  pseudo: string;
  renameRequired: boolean;
  date: string;
  serie: number;
  aProlonger: boolean;
  journeesParfaites: number;
  aujourdhuiParfaite: boolean;
  jeux: ProfilJeu[];
}

const lireProfil = (id: string) => call<Profil>("", "GET", "/api/portail/profil", undefined, 8000, { "X-Player-Id": id });

/** L'état de la page. */
let profil: ApiResult<Profil> | null = null;
let messagePseudo: { texte: string; suggestions?: string[] } | null = null;
let messageCode: string | null = null;
let apercu: { id: string; profil: Profil } | null = null;

/** Un échec du serveur ou du réseau, traduit (code d'erreur du catalogue commun). */
function erreur(t: T, r: { code: string }): string {
  if (r.code === "timeout") return t.t("portail.delai");
  return t.t(cleConnue(`erreur.${r.code}`) ?? "portail.horsLigne");
}

const MED = { author: "auteur", gold: "or", silver: "argent", bronze: "bronze" } as const;

function blocJeu(t: T, j: ProfilJeu): HTMLElement | null {
  const carte = cartes(0).find((c) => c.jeu === j.jeu);
  if (!carte) return null;
  const numero = t.t("profil.jours", { n: j.joursFinis });
  const rang = j.meilleurRang
    ? t.t("profil.meilleurRang", { rang: formatRang(j.meilleurRang.rang, langue), classes: formatNombre(j.meilleurRang.classes, langue), date: formatDateCourte(parseDay(j.meilleurRang.date) ?? 0, langue) })
    : t.t("profil.pasClasse");
  const medailles = el(
    "div",
    { classe: "profil-medailles", attrs: { role: "group", "aria-label": t.t("profil.medailles") } },
    ...MEDAILLES.map((type) => {
      const cle = (Object.keys(MED) as (keyof typeof MED)[]).find((k) => MED[k] === type)!;
      const n = j.medailles[cle] ?? 0;
      return medaille(t, { type, obtenue: n > 0, forme: "case", jeu: carte.code, valeur: formatNombre(n, langue) });
    }),
  );
  const o = { titre: t.t(carte.code === "track" ? "jeu.track.titre" : "jeu.jump.titre"), numero, texte: rang, suite: medailles, niveau: "h3" as const };
  const e = carte.code === "track" ? etiquetteTrack(o) : etiquetteJump(o);
  e.setAttribute("data-jeu", carte.code);
  return e;
}

function section(titre: string, id: string, ...enfants: (Node | null)[]): HTMLElement {
  return el("section", { classe: "profil-section", attrs: { "aria-labelledby": id } }, el("h2", { classe: "profil-section__titre", attrs: { id }, texte: titre }), ...enfants);
}

function rendre(): void {
  const racine = document.getElementById("profil");
  if (!racine) return;
  const t = traduire(langue);
  const focus = (document.activeElement as HTMLElement | null)?.getAttribute("data-cle");
  document.documentElement.lang = langue;
  document.title = t.t("profil.titre");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t.t("profil.description"));
  const id = stockage ? readPlayerId(stockage) : null;
  const identite = readIdentity(stockage);
  const p = profil?.ok ? profil.data : null;
  const day = (p && parseDay(p.date)) ?? parisDay(Date.now());

  let etat: string | null = null;
  if (!id) etat = t.t("profil.sansProfil");
  else if (!profil) etat = t.t("profil.chargement");
  else if (!profil.ok) etat = profil.code === "unknown_player" ? t.t("profil.inconnu") : erreur(t, profil);

  // Le pseudo : celui du serveur (il fait foi), sinon celui de cet appareil.
  const pseudo = p?.pseudo ?? identite.name;
  const champ = el("input", { classe: "profil-champ", attrs: { id: "pseudo-champ", name: "pseudo", type: "text", maxlength: 20, autocomplete: "nickname", value: pseudo ?? "", "data-cle": "pseudo-champ" } });
  const formPseudo = p
    ? el(
        "form",
        { classe: "profil-formulaire", attrs: { id: "pseudo" } },
        el("label", { classe: "profil-etiquette-champ", attrs: { for: "pseudo-champ" }, texte: t.t("profil.pseudo.champ") }),
        el("div", { classe: "profil-ligne" }, champ, bouton({ texte: t.t("profil.pseudo.changer"), variante: "secondaire" })),
        el("p", { classe: "profil-aide", texte: t.t("profil.pseudo.regle") }),
        messagePseudo ? el("p", { classe: "profil-message", attrs: { id: "pseudo-message", role: "status" }, texte: messagePseudo.texte }) : null,
        messagePseudo?.suggestions?.length
          ? el(
              "div",
              { classe: "profil-ligne", attrs: { role: "group", "aria-label": t.t("profil.pseudo.libres") } },
              ...messagePseudo.suggestions.map((s) => bouton({ texte: s, variante: "secondaire", onClick: () => void renommer(s) })),
            )
          : null,
      )
    : null;
  formPseudo?.querySelector("button")?.setAttribute("type", "submit");
  formPseudo?.addEventListener("submit", (e) => {
    e.preventDefault();
    void renommer((champ as HTMLInputElement).value);
  });

  // Le code de transfert : affiché, copié ; charger un code (lu sur le serveur, confirmé).
  const code = id ? encodeTransfer(id) : null;
  const champCode = el("input", { classe: "profil-champ profil-champ--code", attrs: { id: "code-champ", name: "code", type: "text", autocomplete: "off", spellcheck: "false", "data-cle": "code-champ" } });
  const formCode = el(
    "form",
    { classe: "profil-formulaire", attrs: { id: "charger" } },
    el("label", { classe: "profil-etiquette-champ", attrs: { for: "code-champ" }, texte: t.t("profil.code.champ") }),
    el("div", { classe: "profil-ligne" }, champCode, bouton({ texte: t.t("profil.code.verifier"), variante: "secondaire" })),
  );
  formCode.querySelector("button")?.setAttribute("type", "submit");
  formCode.addEventListener("submit", (e) => {
    e.preventDefault();
    void verifierCode((champCode as HTMLInputElement).value);
  });

  const enfants: (HTMLElement | null)[] = [
    barreJeu(t, { href: "../", jour: day }),
    el("h1", { classe: "profil-titre", texte: t.t("profil.titre") }),
    etat ? el("p", { classe: "profil-etat", attrs: { id: "profil-etat", role: "status" }, texte: etat }) : null,
    section(t.t("profil.pseudo.titre"), "titre-pseudo", el("p", { classe: "profil-pseudo", attrs: { id: "pseudo-actuel" }, texte: pseudo ?? "—" }), formPseudo),
    p
      ? section(
          t.t("profil.serie.titre"),
          "titre-serie",
          el(
            "div",
            { classe: "profil-tuiles" },
            tuile({ legende: t.t("portail.serie.legende"), valeur: t.t("portail.serie.valeur", { n: p.serie }), sousTexte: p.aProlonger ? t.t("portail.serie.aProlonger") : undefined, icone: icone("flamme", { taille: 22 }) }),
            tuile({ legende: t.t("profil.parfaites.legende"), valeur: formatNombre(p.journeesParfaites, langue), sousTexte: p.aujourdhuiParfaite ? t.t("portail.serie.parfaiteAujourdhui") : undefined }),
          ),
        )
      : null,
    p ? section(t.t("profil.jeux.titre"), "titre-jeux", el("div", { classe: "profil-jeux" }, ...p.jeux.map((j) => blocJeu(t, j)))) : null,
    section(
      t.t("profil.code.titre"),
      "titre-code",
      el("p", { classe: "profil-aide", texte: t.t("profil.code.aide") }),
      code ? el("code", { classe: "profil-code", attrs: { id: "code" }, texte: code }) : null,
      code ? bouton({ texte: t.t("profil.code.copier"), variante: "secondaire", onClick: () => void copier(code) }) : null,
      el("h3", { classe: "profil-sous-titre", texte: t.t("profil.code.charger") }),
      formCode,
      apercu
        ? el(
            "div",
            { classe: "profil-apercu", attrs: { id: "apercu", role: "group", "aria-labelledby": "apercu-texte" } },
            el("p", { attrs: { id: "apercu-texte" }, texte: t.t("profil.code.apercu", { nom: apercu.profil.pseudo, n: apercu.profil.jeux.reduce((s, j) => Math.max(s, j.joursFinis), 0) }) }),
            el(
              "div",
              { classe: "profil-ligne" },
              bouton({ texte: t.t("profil.code.confirmer"), variante: "marque", onClick: () => chargerCode() }),
              bouton({ texte: t.t("profil.code.annuler"), variante: "secondaire", onClick: () => ((apercu = null), rendre()) }),
            ),
          )
        : null,
      messageCode ? el("p", { classe: "profil-message", attrs: { id: "code-message", role: "status" }, texte: messageCode }) : null,
    ),
    section(t.t("profil.langue.titre"), "titre-langue", choixLangue(t, { langue, onChange: changerLangue })),
    el(
      "footer",
      { classe: "portail-pied" },
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: "../mentions-legales/", hreflang: langue === "fr" ? null : "fr" }, texte: t.t("portail.mentions") }),
    ),
  ];
  racine.replaceChildren(...enfants.filter((e): e is HTMLElement => e !== null));
  if (focus) racine.querySelector<HTMLElement>(`[data-cle="${focus}"]`)?.focus();
}

async function charger(): Promise<void> {
  const id = stockage ? readPlayerId(stockage) : null;
  if (!id) return;
  profil = await lireProfil(id);
  if (profil.ok && stockage) {
    try {
      if (stockage.getItem(NAME_KEY) !== profil.data.pseudo) stockage.setItem(NAME_KEY, profil.data.pseudo); // le pseudo du serveur fait foi
    } catch {
      /* stockage refusé */
    }
  }
  rendre();
}

/** Changer de pseudo : les règles et les refus du serveur (pseudo pris : pseudos libres à toucher). */
async function renommer(saisi: string): Promise<void> {
  const t = traduire(langue);
  const id = stockage ? readPlayerId(stockage) : null;
  const nom = normalizeName(saisi);
  if (!id) return;
  if (!isValidName(nom)) {
    messagePseudo = { texte: t.t("erreur.invalid_name") };
    return rendre();
  }
  const r = await client.rename(id, nom);
  if (r.ok) {
    messagePseudo = { texte: t.t("profil.pseudo.change", { nom: r.data.name }) };
    try {
      stockage?.setItem(NAME_KEY, r.data.name);
    } catch {
      /* stockage refusé */
    }
    if (profil?.ok) profil = { ok: true, data: { ...profil.data, pseudo: r.data.name } };
  } else messagePseudo = { texte: erreur(t, r), suggestions: r.suggestions };
  rendre();
}

async function copier(code: string): Promise<void> {
  const t = traduire(langue);
  try {
    await navigator.clipboard.writeText(code);
    messageCode = t.t("profil.code.copie");
  } catch {
    messageCode = t.t("profil.code.pasDeCopie");
  }
  rendre();
}

/** Charger un code : lu, puis le profil du serveur montré ; rien ne change avant la confirmation. */
async function verifierCode(saisi: string): Promise<void> {
  const t = traduire(langue);
  apercu = null;
  const d = decodeTransfer(saisi);
  if (!d.ok || d.data.version !== 2) {
    messageCode = t.t("profil.code.illisible");
    return rendre();
  }
  if (stockage && readPlayerId(stockage) === d.data.id) {
    messageCode = t.t("profil.code.deja");
    return rendre();
  }
  const r = await lireProfil(d.data.id);
  if (!r.ok) messageCode = erreur(t, r);
  else {
    messageCode = null;
    apercu = { id: d.data.id, profil: r.data };
  }
  rendre();
}

function chargerCode(): void {
  if (!apercu || !stockage) return;
  const t = traduire(langue);
  writeIdentity({ id: apercu.id, name: apercu.profil.pseudo }, stockage);
  // Un code chargé (lot P4) : chaque jeu vide son cache de l'ancienne identité à son prochain démarrage.
  noteIdentityChange(stockage, "code");
  profil = { ok: true, data: apercu.profil };
  messageCode = t.t("profil.code.charge", { nom: apercu.profil.pseudo });
  apercu = null;
  messagePseudo = null;
  rendre();
}

function changerLangue(l: Langue): void {
  langue = l;
  ecrireLangue(stockage, l);
  rendre();
  document.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus();
}

rendre();
void charger();
