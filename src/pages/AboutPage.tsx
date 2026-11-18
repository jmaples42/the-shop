import { Link } from "react-router-dom";
import { useApp } from "../state";
import { Loading } from "../components";

export default function AboutPage() {
  const { edition } = useApp();
  if (!edition) return <Loading />;
  const updated = new Date(edition.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="page">
      <header className="top list-top">
        <Link to="/" className="back">
          ‹ Deals
        </Link>
        <h1>About this week's data</h1>
        <p className="sub">
          {edition.title} · updated {updated}
        </p>
      </header>
      <div className="pad prose">
        <p>
          Prices are collected once a week from each store's published ad and from the third-party sources listed below. Ads change, and
          some prices need a loyalty card, digital coupon or membership. Check with the store before you shop.
        </p>
        <h2>Store dates</h2>
        <ul>
          {edition.stores.map((s) => (
            <li key={s.id}>
              <strong>{s.name}</strong>: {s.dates}
            </li>
          ))}
        </ul>
        <h2>Known gaps</h2>
        <ul>
          {edition.gaps.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
        <h2>Sources</h2>
        <ul>
          {edition.sources.map((s, i) => (
            <li key={i}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              ) : (
                s.label
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
