import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../state";
import { DealRow, Loading, StarButton } from "../components";
import type { Deal } from "../types";

const FILTER_KEY = "theshop.filter";

function readFilter(): string {
  try {
    return localStorage.getItem(FILTER_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function DealsPage() {
  const { edition, editionError, storesById, profile, user } = useApp();
  const [q, setQ] = useState("");
  // "" = default (my stores if any, else all), "all", "mine", or a store id
  const [filter, setFilter] = useState<string>(readFilter);

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, filter);
    } catch {
      /* ignore */
    }
  }, [filter]);

  const favs = profile.favoriteStores;
  const hasFavs = Boolean(user) && favs.length > 0;
  const effective = filter === "" ? (hasFavs ? "mine" : "all") : filter === "mine" && !hasFavs ? "all" : filter;

  const visibleStores = useMemo(() => {
    const all = edition?.stores ?? [];
    if (effective === "all") return all;
    if (effective === "mine") {
      // Favorites first in the order the user has them, then nothing else.
      return all.filter((s) => favs.includes(s.id));
    }
    return all.filter((s) => s.id === effective);
  }, [edition, effective, favs]);
  const visibleIds = new Set(visibleStores.map((s) => s.id));

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (d: Deal) => {
    const hay = `${d.name} ${d.department} ${storesById[d.storeId]?.name ?? ""}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  };

  if (editionError) return <p className="pad error">{editionError}</p>;
  if (!edition) return <Loading text="Loading this week's deals…" />;

  const dealsById = Object.fromEntries(edition.deals.map((d) => [d.id, d]));
  const best = edition.best
    .map((b) => ({ ...b, deal: dealsById[b.dealId] }))
    .filter((b) => b.deal && visibleIds.has(b.deal.storeId));

  const searchResults = terms.length ? edition.deals.filter((d) => visibleIds.has(d.storeId) && matches(d)) : [];

  return (
    <div className="page">
      <header className="top">
        <div className="brand">The Shop</div>
        <h1>{edition.area} grocery deals</h1>
        <p className="sub">
          {edition.title} · {edition.deals.length} items from {edition.stores.length} stores ·{" "}
          <Link to="/about">About the data</Link>
        </p>
      </header>

      <div className="sticky-tools">
        <label className="search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            type="search"
            placeholder="Search deals (turkey, butter, eggs…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search deals"
          />
        </label>
        <div className="chips" role="group" aria-label="Filter by store">
          {user && (
            <button className={"chip" + (effective === "mine" ? " on" : "")} onClick={() => setFilter("mine")} aria-pressed={effective === "mine"}>
              ★ My stores{hasFavs ? "" : " (none yet)"}
            </button>
          )}
          <button className={"chip" + (effective === "all" ? " on" : "")} onClick={() => setFilter("all")} aria-pressed={effective === "all"}>
            All stores
          </button>
          {edition.stores.map((s) => (
            <button key={s.id} className={"chip" + (effective === s.id ? " on" : "")} onClick={() => setFilter(s.id)} aria-pressed={effective === s.id}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {effective === "mine" && !hasFavs && (
        <p className="pad muted">Tap the ★ next to a store below to add it to your stores.</p>
      )}

      {terms.length > 0 ? (
        <section>
          <h2 className="section-h">
            {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
          </h2>
          {searchResults.length === 0 ? (
            <p className="pad muted">Nothing on sale matches “{q.trim()}” at {effective === "all" ? "any store" : "the selected stores"} this week.</p>
          ) : (
            <ul className="card deal-list">
              {searchResults.map((d) => (
                <DealRow key={d.id} deal={d} store={storesById[d.storeId]} showStore />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {edition.summary && effective === "all" && <p className="summary">{edition.summary}</p>}
          {best.length > 0 && (
            <section>
              <h2 className="section-h">Best deals</h2>
              <ul className="card deal-list">
                {best.map((b) => (
                  <DealRow key={b.dealId} deal={b.deal} store={storesById[b.deal.storeId]} note={b.note} showStore />
                ))}
              </ul>
            </section>
          )}
          {visibleStores.map((s) => {
            const deals = edition.deals.filter((d) => d.storeId === s.id);
            const depts = [...new Set(deals.map((d) => d.department))];
            return (
              <section key={s.id} id={`store-${s.id}`} className="store-section">
                <div className="store-head">
                  <div>
                    <h2>
                      {s.name}
                      {s.location ? <span className="loc"> · {s.location}</span> : null}
                    </h2>
                    <div className="dates">{s.dates}</div>
                  </div>
                  <StarButton storeId={s.id} name={s.name} />
                </div>
                {s.notes && s.notes.length > 0 && (
                  <ul className="store-notes">
                    {s.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
                {deals.length === 0 ? (
                  <p className="muted">No item prices this week.</p>
                ) : (
                  <details className="card store-deals" open={visibleStores.length === 1}>
                    <summary>
                      <span>{deals.length} items</span>
                      <span className="muted">{depts.length} departments</span>
                    </summary>
                    {depts.map((dep) => (
                      <div key={dep}>
                        <h3 className="dept">{dep}</h3>
                        <ul className="deal-list">
                          {deals
                            .filter((d) => d.department === dep)
                            .map((d) => (
                              <DealRow key={d.id} deal={d} store={s} />
                            ))}
                        </ul>
                      </div>
                    ))}
                  </details>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
