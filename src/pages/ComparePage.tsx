import { useApp } from "../state";
import { Loading } from "../components";

export default function ComparePage() {
  const { edition, editionError, storesById, profile, user } = useApp();
  if (editionError) return <p className="pad error">{editionError}</p>;
  if (!edition) return <Loading />;

  const favs = user ? profile.favoriteStores : [];
  // Column order: favorites first, then the rest, keeping only stores that appear in the table.
  const inTable = new Set(edition.compare.flatMap((r) => Object.keys(r.prices)));
  const cols = edition.stores
    .filter((s) => inTable.has(s.id))
    .sort((a, b) => Number(favs.includes(b.id)) - Number(favs.includes(a.id)));

  return (
    <div className="page">
      <header className="top">
        <div className="brand">The Shop</div>
        <h1>Compare stores</h1>
        <p className="sub">{edition.title}</p>
      </header>

      <section>
        <h2 className="section-h">Cheapest store for staples</h2>
        <p className="note pad-x">Trader Joe's prices are regular prices, not sales.</p>
        <div className="stack">
          {edition.staples.map((s) => (
            <div key={s.item} className="card staple">
              <h3>{s.item}</h3>
              <div className="cheapest">
                <span className="label">Cheapest</span> {s.cheapest}
              </div>
              <div className="others">
                <span className="label">Others</span> {s.others}
              </div>
              {s.traderJoes && (
                <div className="others">
                  <span className="label">Trader Joe's (regular)</span> {s.traderJoes}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-h">On sale at two or more stores</h2>
        <div className="stack">
          {edition.compare.map((r) => (
            <div key={r.item} className="card cmp">
              <h3>{r.item}</h3>
              <ul>
                {cols
                  .filter((c) => r.prices[c.id])
                  .map((c) => (
                    <li key={c.id} className={favs.includes(c.id) ? "fav" : undefined}>
                      <span className="s">{storesById[c.id]?.name}</span>
                      <span className="p">{r.prices[c.id]}</span>
                    </li>
                  ))}
              </ul>
              {r.conditions && <p className="note">{r.conditions}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
