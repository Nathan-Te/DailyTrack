import type { ModuleEntry } from "@cdj/jump-sim";
import { MODULE_TAGS, type ModuleTag } from "@cdj/jump-sim";
import { TAG_LABELS, galleryFamilies, galleryOrder, matchesFilter, type GalleryFilter, type ModuleInfo } from "./modulesInfo";
import { formatTicks } from "./session";
import { moduleHref, type UrlChoices } from "./urlOptions";

// La galerie des morceaux (lot 4, `?modules`) : une page HTML simple, utilisable au téléphone (elle défile, cibles d'au moins 44 px).
// Pour chaque morceau : intention, étiquettes, famille (lot 7) ; pour chaque variante : paramètres, mutateurs (lot 7), exigence, durées des
// solutions, « Jouer » et « Regarder ». Le choix de l'entrée (à l'arrêt ou en élan) change les liens ; deux listes (lot 7) filtrent par
// étiquette et par famille.

const ENTRY_LABELS: Record<ModuleEntry, string> = { arret: "À l'arrêt", elan: "En élan" };

function dots(n: number): string {
  return n <= 0 ? "—" : "●".repeat(n) + "○".repeat(5 - n);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export interface GalleryView {
  modules: number;
  variants: number;
  entry: ModuleEntry;
  setEntry(entry: ModuleEntry): void;
  /** Lot 7 : le filtre en vigueur, et le nombre de morceaux affichés. */
  filter: GalleryFilter;
  shown: number;
  setFilter(filter: Partial<GalleryFilter>): void;
}

export function mountGallery(options: UrlChoices): GalleryView {
  document.body.classList.add("gallery");
  document.title = "DailyJump · morceaux";
  const order = galleryOrder();
  const root = el("div", "");
  root.id = "gallery";
  const head = el("header", "");
  head.append(el("h1", "", "Les morceaux"));
  head.append(el("p", "lead", `${order.length} morceaux, chacun avec sa solution. Exigence de 1 (facile) à 5 (exigeant) ; durées de la solution, au départ arrêté et lancé.`));
  const toggle = el("div", "entry");
  toggle.setAttribute("role", "group");
  toggle.setAttribute("aria-label", "Entrée");
  toggle.append(el("span", "label", "Entrée :"));
  const buttons = new Map<ModuleEntry, HTMLButtonElement>();
  for (const entry of ["arret", "elan"] as const) {
    const b = el("button", "", ENTRY_LABELS[entry]);
    b.type = "button";
    b.addEventListener("click", () => view.setEntry(entry));
    buttons.set(entry, b);
    toggle.append(b);
  }
  head.append(toggle);
  // Lot 7 : filtres par étiquette et par famille.
  const filters = el("div", "filters");
  const select = (label: string, name: string, options: [string, string][]) => {
    const wrap = el("label", "filter");
    wrap.append(el("span", "label", label));
    const s = el("select", "");
    s.name = name;
    for (const [value, text] of options) {
      const o = el("option", "", text);
      o.value = value;
      s.append(o);
    }
    wrap.append(s);
    filters.append(wrap);
    return s;
  };
  const tagSelect = select("Étiquette :", "etiquette", [["", "toutes"], ...MODULE_TAGS.map((t) => [t, TAG_LABELS[t]] as [string, string])]);
  const familySelect = select("Famille :", "famille", [["", "toutes"], ...galleryFamilies(order).map((f) => [f.family, `${f.family} (${f.count})`] as [string, string])]);
  const count = el("p", "count");
  tagSelect.addEventListener("change", () => view.setFilter({ tag: (tagSelect.value || null) as ModuleTag | null }));
  familySelect.addEventListener("change", () => view.setFilter({ family: familySelect.value || null }));
  head.append(filters, count);
  root.append(head);

  const links: { play: HTMLAnchorElement; watch: HTMLAnchorElement; id: string; variant: number }[] = [];
  const cards: { li: HTMLLIElement; m: ModuleInfo }[] = [];
  const list = el("ul", "cards");
  let variants = 0;
  for (const m of order) list.append(card(m));
  root.append(list);
  document.body.append(root);

  function card(m: ModuleInfo): HTMLLIElement {
    const li = el("li", "card");
    li.dataset.id = m.id;
    li.dataset.family = m.family;
    cards.push({ li, m });
    const title = el("h2", "", m.id);
    li.append(title, el("p", "intent", m.intention));
    const tags = el("p", "tags");
    tags.append(el("span", "tag family", `famille ${m.family}`));
    if (m.long) tags.append(el("span", "tag long", "enchaînement long"));
    for (const t of m.tags) tags.append(el("span", "tag", TAG_LABELS[t]));
    li.append(tags);
    for (const v of m.variants) {
      variants++;
      const row = el("div", "variant");
      row.dataset.variant = String(v.index);
      const info = el("div", "info");
      info.append(el("span", "vname", `Variante ${v.index}${v.label ? ` · ${v.label}` : ""}`));
      info.append(el("span", "mut", v.mutations ? `mutateurs ${v.mutations.replace(/\+/g, "").split(" ").join(" · ")}` : "sans mutateur"));
      const ex = el("span", "ex", `${dots(v.exigence)} ${v.exigence > 0 ? `${v.exigence}/5` : "sans solution"}`);
      ex.title = "Exigence (1 facile, 5 exigeant)";
      info.append(ex);
      const fmt = (t: number | null) => (t === null ? "—" : formatTicks(t));
      info.append(el("span", "dur", `arrêt ${fmt(v.ticks.arret)} · élan ${fmt(v.ticks.elan)}`));
      const play = el("a", "btn play", "Jouer");
      const watch = el("a", "btn watch", "Regarder");
      links.push({ play, watch, id: m.id, variant: v.index });
      const actions = el("div", "actions");
      actions.append(play, watch);
      row.append(info, actions);
      li.append(row);
    }
    return li;
  }

  const view: GalleryView = {
    modules: order.length,
    variants,
    entry: "arret",
    filter: { tag: null, family: null },
    shown: order.length,
    setFilter(f) {
      view.filter = { ...view.filter, ...f };
      tagSelect.value = view.filter.tag ?? "";
      familySelect.value = view.filter.family ?? "";
      let shown = 0;
      for (const c of cards) {
        const ok = matchesFilter(c.m, view.filter);
        c.li.hidden = !ok;
        if (ok) shown++;
      }
      view.shown = shown;
      count.textContent = shown === order.length ? `${shown} morceaux` : `${shown} morceau${shown > 1 ? "x" : ""} sur ${order.length}`;
    },
    setEntry(entry) {
      view.entry = entry;
      for (const [e, b] of buttons) b.setAttribute("aria-pressed", e === entry ? "true" : "false");
      for (const l of links) {
        l.play.href = moduleHref({ id: l.id, variant: l.variant, entry }, options);
        l.watch.href = moduleHref({ id: l.id, variant: l.variant, entry, solution: true }, options);
      }
    },
  };
  view.setEntry("arret");
  view.setFilter({});
  if (options.debug) {
    window.__jump = { phase: "gallery", gallery: view } as unknown as Window["__jump"];
  }
  return view;
}
