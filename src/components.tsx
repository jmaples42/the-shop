import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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

// "The Shop" masthead with tagline and the current location.
export function Masthead() {
  const { areas, area, setAreaId } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <header className="masthead">
      <h1 className="wordmark">The Shop</h1>
      <p className="tagline">Groceries Done Right</p>
      <div className="location">
        <span>
          <span className="loc-label">Location:</span> {area?.name ?? "…"}
        </span>
        <button className="link-btn" onClick={() => setOpen(true)}>
          Change location
        </button>
      </div>
      {open && (
        <Sheet open onClose={() => setOpen(false)} title="Choose your location">
          <ul className="picker">
            {areas.map((a) => (
              <li key={a.id}>
                <button
                  className="picker-item"
                  aria-current={a.id === area?.id}
                  onClick={() => {
                    setAreaId(a.id);
                    setOpen(false);
                  }}
                >
                  <span>{a.name}</span>
                  {a.id === area?.id && <span className="muted">Current</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="note">More areas are coming. For now The Shop covers {areas.map((a) => a.name).join(", ")}.</p>
        </Sheet>
      )}
    </header>
  );
}

export function StarButton({ storeId, name }: { storeId: string; name: string }) {
  const { profile, toggleFavorite, toast } = useApp();
  const on = profile.favoriteStores.includes(storeId);
  return (
    <button
      className={"star" + (on ? " on" : "")}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from my stores` : `Add ${name} to my stores`}
      onClick={() => {
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
  const { toggleDeal, isOnList, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const on = isOnList(deal.id);
  const regular = store?.priceType === "regular";

  async function onTap() {
    setBusy(true);
    try {
      const r = await toggleDeal(deal);
      toast(r === "added" ? "Added to your list" : "Removed from your list");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const meta = [showStore ? store?.name : null, deal.conditions, deal.regularPrice ? `Reg. ${deal.regularPrice}` : null, note].filter(Boolean);

  return (
    <li className={"deal" + (on ? " on-list" : "")}>
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
        className={"add-btn" + (on ? " saved" : "")}
        onClick={onTap}
        disabled={busy}
        aria-pressed={on}
        aria-label={on ? `Remove ${deal.name} from your list` : `Add ${deal.name} to your list`}
      >
        {on ? (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        )}
      </button>
    </li>
  );
}
