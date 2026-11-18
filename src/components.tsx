import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "./state";
import type { Deal, Store } from "./types";

export function Loading({ text = "Loading…" }: { text?: string }) {
  return <p className="muted pad">{text}</p>;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="sheet-body">
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function StarButton({ storeId, name }: { storeId: string; name: string }) {
  const { user, profile, toggleFavorite, toast } = useApp();
  const navigate = useNavigate();
  const on = profile.favoriteStores.includes(storeId);
  return (
    <button
      className={"star" + (on ? " on" : "")}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from my stores` : `Add ${name} to my stores`}
      onClick={() => {
        if (!user) {
          toast("Sign in to pick your stores.");
          navigate("/account");
          return;
        }
        toggleFavorite(storeId).catch(() => toast("Couldn't save. Try again."));
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
      </svg>
    </button>
  );
}

export function DealRow({ deal, store, note, showStore }: { deal: Deal; store?: Store; note?: string; showStore?: boolean }) {
  const { user, lists, addDeal, isSaved, toast } = useApp();
  const navigate = useNavigate();
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const saved = isSaved(deal.id);
  const regular = store?.priceType === "regular";

  async function save(listId?: string) {
    setBusy(true);
    try {
      const id = await addDeal(deal, listId);
      const name = lists.find((l) => l.id === id)?.name ?? "My list";
      toast(`Added to ${name}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't add. Try again.");
    } finally {
      setBusy(false);
      setPicker(false);
    }
  }

  function onAdd() {
    if (!user) {
      toast("Sign in to save deals to a list.");
      navigate("/account");
      return;
    }
    if (lists.length > 1) setPicker(true);
    else save();
  }

  const meta = [
    showStore ? store?.name : null,
    deal.conditions,
    deal.regularPrice ? `Reg. ${deal.regularPrice}` : null,
    note,
  ].filter(Boolean);

  return (
    <li className="deal">
      <div className="deal-main">
        <div className="deal-name">{deal.name}</div>
        {(meta.length > 0 || deal.unverified || regular) && (
          <div className="deal-meta">
            {regular && <span className="badge">Regular price</span>}
            {deal.unverified && <span className="badge warn">Unverified</span>}
            {meta.join(" · ")}
          </div>
        )}
      </div>
      <div className={"deal-price" + (regular ? " regular" : "")}>{deal.price}</div>
      <button
        className={"add-btn" + (saved ? " saved" : "")}
        onClick={onAdd}
        disabled={busy}
        aria-label={saved ? `${deal.name} is on a list; add again` : `Add ${deal.name} to a list`}
      >
        {saved ? (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        )}
      </button>
      {picker && (
      <Sheet open onClose={() => setPicker(false)} title="Add to which list?">
        <ul className="picker">
          {lists.map((l) => (
            <li key={l.id}>
              <button className="picker-item" onClick={() => save(l.id)} disabled={busy}>
                <span>{l.name}</span>
                <span className="muted">{l.items.length} items</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
      )}
    </li>
  );
}
