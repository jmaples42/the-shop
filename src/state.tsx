import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getBackend, newKey } from "./backend";
import type { Backend } from "./backend";
import type { AppUser, Deal, Edition, ListItem, Profile, ShopList, Store } from "./types";

export const DEFAULT_AREA_ID = "west-bend-wi";
export const itemArea = (i: ListItem) => i.areaId ?? DEFAULT_AREA_ID;

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
// Guests (not signed in) keep their list and stores on this device; they move
// into the account the first time the person signs in.
const GUEST_LIST_KEY = "theshop.guest.list";
const GUEST_FAVS_KEY = "theshop.guest.favorites";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: lasts until reload */
  }
}
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
  const [profileReady, setProfileReady] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const creating = useRef<Promise<string> | null>(null);
  const [guestItems, setGuestItems] = useState<ListItem[]>(() => readJSON<ListItem[]>(GUEST_LIST_KEY, []));
  const [guestFavs, setGuestFavs] = useState<string[]>(() => readJSON<string[]>(GUEST_FAVS_KEY, []));
  const merged = useRef<string | null>(null);

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
      setProfileReady(false);
      return;
    }
    const a = backend.watchProfile(user.uid, (p) => {
      setProfile(p);
      setProfileReady(true);
    });
    const b = backend.watchLists(user.uid, (l) => {
      setLists(l);
      setListReady(true);
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

  // The oldest list is "the" list (accounts made before single-list mode may have several).
  const accountList = useMemo(() => (lists.length ? [...lists].sort((a, b) => a.createdAt - b.createdAt)[0] : null), [lists]);
  const guestList = useMemo<ShopList>(() => ({ id: "guest", name: "My list", createdAt: 0, updatedAt: 0, items: guestItems }), [guestItems]);
  const list = user ? accountList : guestList;
  const effectiveProfile = useMemo<Profile>(() => (user ? profile : { favoriteStores: guestFavs }), [user, profile, guestFavs]);

  const ensureList = useCallback(async (): Promise<string> => {
    if (!backend || !user) throw new Error("Not signed in.");
    if (accountList) return accountList.id;
    if (!creating.current) {
      creating.current = backend.createList(user.uid, "My list").finally(() => {
        creating.current = null;
      });
    }
    return creating.current;
  }, [backend, user, accountList]);

  const updateItems = useCallback(
    async (fn: (items: ListItem[]) => ListItem[]) => {
      if (!user) {
        setGuestItems((cur) => {
          const next = fn(cur);
          writeJSON(GUEST_LIST_KEY, next);
          return next;
        });
        return;
      }
      const id = await ensureList();
      await backend!.updateItems(user.uid, id, fn);
    },
    [ensureList, backend, user],
  );

  // First time a person signs in on this device: move the guest list and stores into the account.
  useEffect(() => {
    if (!backend || !user || !listReady || !profileReady || merged.current === user.uid) return;
    merged.current = user.uid;
    const items = readJSON<ListItem[]>(GUEST_LIST_KEY, []);
    const favs = readJSON<string[]>(GUEST_FAVS_KEY, []);
    if (!items.length && !favs.length) return;
    (async () => {
      try {
        if (items.length) {
          const id = await ensureList();
          await backend.updateItems(user.uid, id, (cur) => {
            const has = (g: ListItem) =>
              cur.some((c) => (g.dealId ? c.dealId === g.dealId && c.edition === g.edition : !c.dealId && c.name.toLowerCase() === g.name.toLowerCase()));
            return [...cur, ...items.filter((g) => !has(g))];
          });
        }
        if (favs.length) {
          const union = [...new Set([...profile.favoriteStores, ...favs])];
          await backend.setFavorites(user.uid, union);
        }
        writeJSON(GUEST_LIST_KEY, null);
        writeJSON(GUEST_FAVS_KEY, null);
        setGuestItems([]);
        setGuestFavs([]);
        toast("Your list is saved to your account.");
      } catch {
        merged.current = null; // try again next time
        toast("Couldn't move your list into your account. It's still on this device.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, user, listReady, profileReady]);

  const storesById = useMemo(() => Object.fromEntries((edition?.stores ?? []).map((s) => [s.id, s])), [edition]);

  const onList = useMemo(() => {
    const ids = new Set<string>();
    for (const i of list?.items ?? [])
      if (i.dealId && i.edition === edition?.edition && itemArea(i) === area?.id) ids.add(i.dealId);
    return ids;
  }, [list, edition, area]);

  const toggleDeal = useCallback(
    async (deal: Deal) => {
      if (!edition) throw new Error("Deals are still loading.");
      const ed = edition.edition;
      const areaId = area?.id ?? DEFAULT_AREA_ID;
      const same = (i: ListItem) => i.dealId === deal.id && i.edition === ed && itemArea(i) === areaId;
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
        areaId,
        storeId: deal.storeId,
        storeName: store?.name ?? deal.storeId,
        price: deal.price,
        ...(deal.conditions ? { conditions: deal.conditions } : {}),
      };
      await updateItems((items) => (items.some(same) ? items : [...items, item]));
      return "added" as const;
    },
    [edition, area, onList, storesById, updateItems],
  );

  const toggleFavorite = useCallback(
    async (storeId: string) => {
      const cur = effectiveProfile.favoriteStores;
      if (!backend || !user) {
        const next = cur.includes(storeId) ? cur.filter((s) => s !== storeId) : [...cur, storeId];
        setGuestFavs(next);
        writeJSON(GUEST_FAVS_KEY, next);
        return;
      }
      const next = cur.includes(storeId) ? cur.filter((s) => s !== storeId) : [...cur, storeId];
      await backend.setFavorites(user.uid, next);
    },
    [backend, user, effectiveProfile],
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
    profile: effectiveProfile,
    list,
    listReady: user ? listReady : true,
    toast,
    toastMsg,
    isOnList: (id) => onList.has(id),
    toggleDeal,
    updateItems,
    toggleFavorite,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
