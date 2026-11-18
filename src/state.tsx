import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getBackend, newKey } from "./backend";
import type { Backend } from "./backend";
import type { AppUser, Deal, Edition, ListItem, Profile, ShopList, Store } from "./types";

interface AppState {
  backend: Backend | null;
  edition: Edition | null;
  editionError: string | null;
  storesById: Record<string, Store>;
  authReady: boolean;
  user: AppUser | null;
  profile: Profile;
  lists: ShopList[];
  listsReady: boolean;
  toast: (msg: string) => void;
  toastMsg: string | null;
  // Adds a deal to a list; creates "My list" if the user has none. Returns the list id.
  addDeal: (deal: Deal, listId?: string) => Promise<string>;
  isSaved: (dealId: string) => boolean;
  toggleFavorite: (storeId: string) => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [edition, setEdition] = useState<Edition | null>(null);
  const [editionError, setEditionError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile>({ favoriteStores: [] });
  const [lists, setLists] = useState<ShopList[]>([]);
  const [listsReady, setListsReady] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    fetch("/data/current.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: Edition) => setEdition(d))
      .catch((e) => setEditionError(`Couldn't load this week's deals (${e.message}).`));
    getBackend().then(setBackend);
  }, []);

  useEffect(() => {
    if (!backend) return;
    return backend.onAuth((u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, [backend]);

  useEffect(() => {
    if (!backend || !user) {
      setProfile({ favoriteStores: [] });
      setLists([]);
      setListsReady(false);
      return;
    }
    const a = backend.watchProfile(user.uid, setProfile);
    const b = backend.watchLists(user.uid, (l) => {
      setLists(l);
      setListsReady(true);
    });
    return () => {
      a();
      b();
    };
  }, [backend, user]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const storesById = useMemo(
    () => Object.fromEntries((edition?.stores ?? []).map((s) => [s.id, s])),
    [edition],
  );

  const savedDealIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of lists) for (const i of l.items) if (i.dealId && i.edition === edition?.edition) ids.add(i.dealId);
    return ids;
  }, [lists, edition]);

  const addDeal = useCallback(
    async (deal: Deal, listId?: string) => {
      if (!backend || !user || !edition) throw new Error("Sign in to save deals.");
      let target = listId ?? lists[0]?.id;
      if (!target) target = await backend.createList(user.uid, "My list");
      const store = storesById[deal.storeId];
      const item: ListItem = {
        key: newKey(),
        name: deal.name,
        checked: false,
        addedAt: Date.now(),
        dealId: deal.id,
        edition: edition.edition,
        storeId: deal.storeId,
        storeName: store?.name ?? deal.storeId,
        price: deal.price,
        ...(deal.conditions ? { conditions: deal.conditions } : {}),
      };
      await backend.updateItems(user.uid, target, (items) =>
        items.some((i) => i.dealId === deal.id && i.edition === edition.edition) ? items : [...items, item],
      );
      return target;
    },
    [backend, user, edition, lists, storesById],
  );

  const toggleFavorite = useCallback(
    async (storeId: string) => {
      if (!backend || !user) return;
      const cur = profile.favoriteStores;
      const next = cur.includes(storeId) ? cur.filter((s) => s !== storeId) : [...cur, storeId];
      await backend.setFavorites(user.uid, next);
    },
    [backend, user, profile],
  );

  const value: AppState = {
    backend,
    edition,
    editionError,
    storesById,
    authReady,
    user,
    profile,
    lists,
    listsReady,
    toast,
    toastMsg,
    addDeal,
    isSaved: (id) => savedDealIds.has(id),
    toggleFavorite,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
