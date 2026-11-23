import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { itemArea, useApp } from "../state";
import { Loading } from "../components";
import { newKey } from "../backend";
import type { ListItem } from "../types";

// One shopping list per account, laid out like an Apple Notes checklist:
// tap the circle when you've got it, and the line stays put but gets highlighted.
// Deals added from the Deals tab are grouped by store; anything else is typed
// into the free-form section at the bottom.
export default function ListPage() {
  const { user, authReady, list, listReady, edition, area, areas, updateItems, toast } = useApp();
  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? id;
  // An item from an earlier week of the area you're looking at may have expired.
  const isOld = (i: ListItem) => Boolean(i.edition && edition && itemArea(i) === area?.id && i.edition < edition.edition);
  const otherArea = (i: ListItem) => Boolean(i.dealId && area && itemArea(i) !== area.id);
  const [clearArmed, setClearArmed] = useState(false);

  if (!authReady || !listReady) return <Loading />;

  const items = list?.items ?? [];
  const save = (fn: (items: ListItem[]) => ListItem[]) => updateItems(fn).catch((e) => toast(e instanceof Error ? e.message : "Couldn't save."));
  const toggle = (key: string) => save((all) => all.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i)));
  const remove = (key: string) => save((all) => all.filter((i) => i.key !== key));

  // Store groups in the order stores appear in this week's data; stores from other areas or weeks after.
  const storeOrder = (edition?.stores ?? []).map((s) => s.id);
  const groups = new Map<string, { name: string; items: ListItem[] }>();
  for (const i of items) {
    if (!i.storeId) continue;
    const key = otherArea(i) ? `${itemArea(i)}:${i.storeId}` : i.storeId;
    const name = (i.storeName ?? i.storeId) + (otherArea(i) ? ` · ${areaName(itemArea(i))}` : "");
    if (!groups.has(key)) groups.set(key, { name, items: [] });
    groups.get(key)!.items.push(i);
  }
  const groupIds = [...groups.keys()].sort((a, b) => {
    const ia = storeOrder.indexOf(a), ib = storeOrder.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  const freeItems = items.filter((i) => !i.storeId);
  const got = items.filter((i) => i.checked).length;
  const stale = items.some(isOld);

  return (
    <div className="page">
      <header className="top">
        <div className="brand">The Shop</div>
        <h1>My list</h1>
        <p className="sub">
          {items.length === 0 ? "Nothing on it yet" : `${items.length - got} to get${got ? ` · ${got} got` : ""}`}
        </p>
      </header>

      {items.length === 0 && (
        <p className="note">
          Tap + on anything in <Link to="/">Deals</Link> to add it here, or type below.
        </p>
      )}
      {!user && items.length > 0 && (
        <p className="guest-note">
          Your list is saved on this phone. <Link to="/account">Create a free account</Link> to keep it on all your devices.
        </p>
      )}
      {stale && <p className="note">Some deals came from an earlier week's ad. Those prices may have ended.</p>}

      {groupIds.map((sid) => {
        const g = groups.get(sid)!;
        return (
          <section key={sid} className="list-section">
            <h2 className="list-store">{g.name}</h2>
            <ul className="checklist">
              {gotLast(g.items).map((i) => {
                const old = isOld(i);
                return (
                  <li key={i.key} className={i.checked ? "got" : undefined}>
                    <CheckCircle checked={i.checked} label={i.name} onToggle={() => toggle(i.key)} />
                    <div className="line-text" onClick={() => toggle(i.key)}>
                      <span className="line-name">{i.name}</span>
                      {(i.conditions || old) && (
                        <small>{[i.conditions, old ? `From the week of ${fmtDate(i.edition!)}` : null].filter(Boolean).join(" · ")}</small>
                      )}
                    </div>
                    {i.price && <span className="line-price">{i.price}</span>}
                    <button className="line-remove" onClick={() => remove(i.key)} aria-label={`Remove ${i.name}`}>
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="list-section">
        <h2 className="list-store">{groupIds.length ? "Everything else" : "My items"}</h2>
        <FreeForm items={freeItems} save={save} onToggle={toggle} onRemove={remove} />
      </section>

      {got > 0 && (
        <div className="pad-y">
          <button
            className={"btn" + (clearArmed ? " danger" : "")}
            onClick={() => {
              if (!clearArmed) {
                setClearArmed(true);
                window.setTimeout(() => setClearArmed(false), 3000);
                return;
              }
              setClearArmed(false);
              save((all) => all.filter((i) => !i.checked));
            }}
          >
            {clearArmed ? `Tap again to clear ${got} checked` : "Clear checked items"}
          </button>
        </div>
      )}
    </div>
  );
}

function CheckCircle({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button className={"circle" + (checked ? " on" : "")} role="checkbox" aria-checked={checked} aria-label={label} onClick={onToggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M7.5 12.5l3 3 6-6.5" />
      </svg>
    </button>
  );
}

// Free-form lines, Notes-style: each line is editable in place; there's always an
// empty line at the bottom. Enter adds the line and moves to a fresh one; clearing a
// line's text removes it.
function FreeForm({
  items,
  save,
  onToggle,
  onRemove,
}: {
  items: ListItem[];
  save: (fn: (items: ListItem[]) => ListItem[]) => Promise<unknown>;
  onToggle: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const newLine = useRef<HTMLInputElement>(null);

  function commitNew() {
    const n = draft.trim();
    if (!n) return;
    setDraft("");
    save((all) => [...all, { key: newKey(), name: n, checked: false, addedAt: Date.now() }]);
    newLine.current?.focus();
  }

  // Still-to-get lines, then the line for typing a new item, then the ones already got.
  const line = (i: ListItem) => (
    <FreeLine key={i.key} item={i} save={save} onToggle={onToggle} onRemove={onRemove} focusNew={() => newLine.current?.focus()} />
  );
  return (
    <ul className="checklist">
      {items.filter((i) => !i.checked).map(line)}
      <li className="new-line">
        <span className="circle ghost" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
        </span>
        <input
          ref={newLine}
          className="line-input"
          value={draft}
          placeholder="Add an item"
          aria-label="Add an item"
          maxLength={120}
          enterKeyHint="enter"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitNew();
            }
          }}
          onBlur={commitNew}
        />
      </li>
      {items.filter((i) => i.checked).map(line)}
    </ul>
  );
}

// Items you've got sink to the bottom of their section, keeping their order otherwise.
function gotLast(items: ListItem[]): ListItem[] {
  return [...items.filter((i) => !i.checked), ...items.filter((i) => i.checked)];
}

function FreeLine({
  item,
  save,
  onToggle,
  onRemove,
  focusNew,
}: {
  item: ListItem;
  save: (fn: (items: ListItem[]) => ListItem[]) => Promise<unknown>;
  onToggle: (key: string) => void;
  onRemove: (key: string) => void;
  focusNew: () => void;
}) {
  const [text, setText] = useState(item.name);
  const focused = useRef(false);
  // Pick up edits made on another device, unless this line is being typed in.
  useEffect(() => {
    if (!focused.current) setText(item.name);
  }, [item.name]);

  function commit() {
    const n = text.trim();
    if (!n) onRemove(item.key);
    else if (n !== item.name) save((all) => all.map((i) => (i.key === item.key ? { ...i, name: n } : i)));
  }

  return (
    <li className={item.checked ? "got" : undefined}>
      <CheckCircle checked={item.checked} label={item.name} onToggle={() => onToggle(item.key)} />
      <input
        className="line-input"
        value={text}
        aria-label={`Edit ${item.name}`}
        maxLength={120}
        onFocus={() => (focused.current = true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
            focusNew();
          }
        }}
      />
      <button className="line-remove" onClick={() => onRemove(item.key)} aria-label={`Remove ${item.name}`}>
        ×
      </button>
    </li>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
