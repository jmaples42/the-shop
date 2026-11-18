import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../state";
import { Loading } from "../components";

export default function ListsPage() {
  const { user, authReady, lists, listsReady, backend, toast } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");

  if (!authReady) return <Loading />;
  if (!user)
    return (
      <div className="page">
        <header className="top">
          <div className="brand">The Shop</div>
          <h1>Your lists</h1>
        </header>
        <div className="card pad empty">
          <p>Sign in to save deals into shopping lists and get them back on any device.</p>
          <Link className="btn primary" to="/account">
            Sign in or create an account
          </Link>
        </div>
      </div>
    );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!backend || !user) return;
    const n = name.trim() || "My list";
    try {
      const id = await backend.createList(user.uid, n);
      setName("");
      navigate(`/lists/${id}`);
    } catch {
      toast("Couldn't create the list. Try again.");
    }
  }

  return (
    <div className="page">
      <header className="top">
        <div className="brand">The Shop</div>
        <h1>Your lists</h1>
      </header>
      <form className="inline-form" onSubmit={create}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New list name (e.g. Thanksgiving)" aria-label="New list name" maxLength={60} />
        <button className="btn primary" type="submit">
          Create
        </button>
      </form>
      {!listsReady ? (
        <Loading />
      ) : lists.length === 0 ? (
        <p className="pad muted">No lists yet. Tap + on any deal to start one, or create one above.</p>
      ) : (
        <ul className="stack">
          {lists.map((l) => {
            const done = l.items.filter((i) => i.checked).length;
            const stores = [...new Set(l.items.map((i) => i.storeName).filter(Boolean))];
            return (
              <li key={l.id}>
                <Link className="card list-card" to={`/lists/${l.id}`}>
                  <div>
                    <div className="list-name">{l.name}</div>
                    <div className="muted small">{stores.length ? stores.join(", ") : "No store items"}</div>
                  </div>
                  <span className="count">
                    {done ? `${done}/${l.items.length}` : l.items.length} {l.items.length === 1 ? "item" : "items"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
