import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../state";
import { Loading, Sheet } from "../components";
import { newKey } from "../backend";
import type { ListItem } from "../types";

export default function ListPage() {
  const { id } = useParams();
  const { user, authReady, lists, listsReady, backend, edition, toast } = useApp();
  const navigate = useNavigate();
  const [newItem, setNewItem] = useState("");
  const [hideChecked, setHideChecked] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rename, setRename] = useState("");

  if (!authReady || (user && !listsReady)) return <Loading />;
  if (!user) {
    navigate("/lists");
    return null;
  }
  const list = lists.find((l) => l.id === id);
  if (!list)
    return (
      <div className="page pad">
        <p>That list doesn't exist anymore.</p>
        <Link to="/lists">Back to lists</Link>
      </div>
    );

  const uid = user.uid;
  const update = (fn: (items: ListItem[]) => ListItem[]) =>
    backend!.updateItems(uid, list.id, fn).catch((e) => toast(e instanceof Error ? e.message : "Couldn't save."));

  const toggle = (key: string) => update((items) => items.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i)));
  const remove = (key: string) => update((items) => items.filter((i) => i.key !== key));

  function addCustom(e: React.FormEvent) {
    e.preventDefault();
    const n = newItem.trim();
    if (!n) return;
    setNewItem("");
    update((items) => [...items, { key: newKey(), name: n, checked: false, addedAt: Date.now() }]);
  }

  // Group by store; custom items go under "Other items".
  const groups = new Map<string, ListItem[]>();
  for (const i of list.items) {
    const g = i.storeName ?? "Other items";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(i);
  }
  const done = list.items.filter((i) => i.checked).length;
  const stale = list.items.some((i) => i.edition && edition && i.edition !== edition.edition);

  return (
    <div className="page">
      <header className="top list-top">
        <Link to="/lists" className="back">
          ‹ Lists
        </Link>
        <div className="title-row">
          <h1>{list.name}</h1>
          <button
            className="btn"
            onClick={() => {
              setRename(list.name);
              setMenu(true);
            }}
          >
            Edit
          </button>
        </div>
        <p className="sub">
          {list.items.length} items{done ? ` · ${done} checked` : ""}
        </p>
      </header>

      <form className="inline-form" onSubmit={addCustom}>
        <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add your own item" aria-label="Add your own item" maxLength={120} />
        <button className="btn primary" type="submit">
          Add
        </button>
      </form>

      {stale && <p className="pad note">Some items came from an earlier week's ad. Those prices may have ended.</p>}

      {list.items.length === 0 ? (
        <p className="pad muted">
          Empty list. Go to <Link to="/">Deals</Link> and tap + to add items.
        </p>
      ) : (
        <>
          <label className="toggle pad-x">
            <input type="checkbox" checked={hideChecked} onChange={(e) => setHideChecked(e.target.checked)} /> Hide checked items
          </label>
          {[...groups.entries()].map(([store, items]) => {
            const shown = hideChecked ? items.filter((i) => !i.checked) : items;
            if (shown.length === 0) return null;
            return (
              <section key={store}>
                <h2 className="section-h">{store}</h2>
                <ul className="card checklist">
                  {shown.map((i) => {
                    const old = i.edition && edition && i.edition !== edition.edition;
                    return (
                      <li key={i.key} className={i.checked ? "done" : undefined}>
                        <label>
                          <input type="checkbox" checked={i.checked} onChange={() => toggle(i.key)} />
                          <span className="box" aria-hidden="true">
                            <svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" /></svg>
                          </span>
                          <span className="item-name">
                            {i.name}
                            {(i.conditions || old) && (
                              <small>
                                {[i.conditions, old ? `From the week of ${fmtDate(i.edition!)}` : null].filter(Boolean).join(" · ")}
                              </small>
                            )}
                          </span>
                          {i.price && <span className="item-price">{i.price}</span>}
                        </label>
                        <button className="icon-btn" onClick={() => remove(i.key)} aria-label={`Remove ${i.name}`}>
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {done > 0 && (
            <div className="pad">
              <button className="btn" onClick={() => update((items) => items.filter((i) => !i.checked))}>
                Remove checked items
              </button>
            </div>
          )}
        </>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title="Edit list">
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            const n = rename.trim();
            if (n) backend!.renameList(uid, list.id, n).catch(() => toast("Couldn't rename."));
            setMenu(false);
          }}
        >
          <label>
            Name
            <input value={rename} onChange={(e) => setRename(e.target.value)} maxLength={60} />
          </label>
          <button className="btn primary" type="submit">
            Save
          </button>
        </form>
        <hr />
        <button
          className="btn danger"
          onClick={async () => {
            if (!confirm(`Delete “${list.name}”? This can't be undone.`)) return;
            setMenu(false);
            await backend!.deleteList(uid, list.id).catch(() => toast("Couldn't delete."));
            navigate("/lists");
          }}
        >
          Delete list
        </button>
      </Sheet>
    </div>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
