import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getBackend, newKey } from "./backend";
import type { Backend } from "./backend";
import type { AppUser, Deal, Edition, ListItem, Profile, ShopList, Store } from "./types";

export interface Area {
  id: string;
  name: string;
  data: string; // URL of that area's current deals file
}

interface AppState {
  backend: Backend | null;
  areas: Area[];
  area: Area | null;
  setAreaId: (id: string) => void;
  edition: Edition | null;
  editionError: string | null;
  storesById: Record<string, Store>;
  authReady: boolean;
  user: AppUser | null;
  profile: Profile;
  // The shopping list. Each account has one; it's created on first use.
  list: ShopList | null;
  listReady: boolean;
  toast: (msg: string) => void;
  toastMsg: string | null;
  isOnList: (dealId: string) => boolean;
  // Adds the deal to the list, or removes it if it's already there.
  toggleDeal: (deal: Deal) => Promise<"added" | "removed">;
  updateItems: (fn: (items: ListItem[]) => ListItem[]) => Promise<void>;
  toggleFavorite: (storeId: string) => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}

const AREA_KEY = "theshop.area";
const FALLBACK_AREA: Area = { id: "west-bend-wi", name: "West Bend, WI", data: "/data/current.json" };

function readAreaId(): string | null {
  try {
    return localStorage.getItem(AREA_KEY);
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaId, setAreaIdState] = useState<string | null>(readAreaId);
  const [edition, setEdition] = useState<Edition | null>(null);
  const [editionError, setEditionError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile>({ favoriteStores: [] });
  const [lists, setLists] = useState<ShopList[]>([]);
  const [listReady, setListReady] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const creating = useRef<Promise<string> | null>(null);

  useEffect(() => {
    fetch("/data/areas.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { areas: Area[] }) => setAreas(d.areas?.length ? d.areas : [FALLBACK_AREA]))
      .catch(() => setAreas([FALLBACK_AREA]));
    getBackend().then(setBackend);
  }, []);

  const area = useMemo(() => areas.find((a) => a.id === areaId) ?? areas[0] ?? null, [areas, areaId]);

  useEffect(() => {
    if (!area) return;
    setEdition(null);
    setEditionError(null);
    fetch(area.data, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Edition) => setEdition(d))
      .catch((e) => setEditionError(`Couldn't load this week's deals (${e.message}).`));
  }, [area]);

  const setAreaId = useCallback((id: string) => {
    setAreaIdState(id);
    try {
      localStorage.setItem(AREA_KEY, id);
    } catch {
      /* ignore */
    }
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
      setListReady(false);
      return;
    }
    const a = backend.watchProfile(user.uid, setProfile);
    const b = backend.watchLists(user.uid, (l) => {
      setLists(l);
      setListReady(true);
    });
    return () => {
      a();
      b();
    };
  }, [backend, user]);

  // The oldest list is "the" list (accounts made before single-list mode may have several).
  const list = useMemo(() => (lists.length ? [...lists].sort((a, b) => a.createdAt - b.createdAt)[0] : null), [lists]);

  const ensureList = useCallback(async (): Promise<string> => {
    if (!backend || !user) throw new Error("Sign in to save your list.");
    if (list) return list.id;
    if (!creating.current) {
      creating.current = backend.createList(user.uid, "My list").finally(() => {
        creating.current = null;
      });
    }
    return creating.current;
  }, [backend, user, list]);

  const updateItems = useCallback(
    async (fn: (items: ListItem[]) => ListItem[]) => {
      const id = await ensureList();
      await backend!.updateItems(user!.uid, id, fn);
    },
    [ensureList, backend, user],
  );

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const storesById = useMemo(() => Object.fromEntries((edition?.stores ?? []).map((s) => [s.id, s])), [edition]);

  const onList = useMemo(() => {
    const ids = new Set<string>();
    for (const i of list?.items ?? []) if (i.dealId && i.edition === edition?.edition) ids.add(i.dealId);
    return ids;
  }, [list, edition]);

  const toggleDeal = useCallback(
    async (deal: Deal) => {
      if (!edition) throw new Error("Deals are still loading.");
      const ed = edition.edition;
      const same = (i: ListItem) => i.dealId === deal.id && i.edition === ed;
      if (onList.has(deal.id)) {
        await updateItems((items) => items.filter((i) => !same(i)));
        return "removed" as const;
      }
      const store = storesById[deal.storeId];
      const item: ListItem = {
        key: newKey(),
        name: deal.name,
        checked: false,
        addedAt: Date.now(),
        dealId: deal.id,
        edition: ed,
        storeId: deal.storeId,
        storeName: store?.name ?? deal.storeId,
        price: deal.price,
        ...(deal.conditions ? { conditions: deal.conditions } : {}),
      };
      await updateItems((items) => (items.some(same) ? items : [...items, item]));
      return "added" as const;
    },
    [edition, onList, storesById, updateItems],
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
    areas,
    area,
    setAreaId,
    edition,
    editionError,
    storesById,
    authReady,
    user,
    profile,
    list,
    listReady,
    toast,
    toastMsg,
    isOnList: (id) => onList.has(id),
    toggleDeal,
    updateItems,
    toggleFavorite,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
