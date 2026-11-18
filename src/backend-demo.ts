import type { Backend } from "./backend";
import { newKey } from "./backend";
import type { AppUser, Profile, ShopList } from "./types";

// Demo mode: no Firebase project configured. One local "account" per browser,
// stored in localStorage. Lets the app be tried and tested before Firebase is set up.

const K = { user: "theshop.demo.user", profile: "theshop.demo.profile", lists: "theshop.demo.lists" };

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: changes last until reload */
  }
}

export function createDemoBackend(): Backend {
  let user: AppUser | null = read<AppUser | null>(K.user, null);
  let profile: Profile = read<Profile>(K.profile, { favoriteStores: [] });
  let lists: ShopList[] = read<ShopList[]>(K.lists, []);
  const authSubs = new Set<(u: AppUser | null) => void>();
  const profileSubs = new Set<(p: Profile) => void>();
  const listSubs = new Set<(l: ShopList[]) => void>();

  const emitAuth = () => authSubs.forEach((f) => f(user));
  const emitProfile = () => profileSubs.forEach((f) => f(profile));
  const emitLists = () => {
    const sorted = [...lists].sort((a, b) => b.updatedAt - a.updatedAt);
    listSubs.forEach((f) => f(sorted));
  };
  const saveLists = () => {
    write(K.lists, lists);
    emitLists();
  };
  const login = (email: string) => {
    user = { uid: "demo", email, displayName: null };
    write(K.user, user);
    emitAuth();
  };

  return {
    mode: "demo",
    onAuth(cb) {
      authSubs.add(cb);
      queueMicrotask(() => cb(user));
      return () => authSubs.delete(cb);
    },
    async signUp(email, password) {
      if (!email.includes("@")) throw Object.assign(new Error(), { code: "auth/invalid-email" });
      if (password.length < 6) throw Object.assign(new Error(), { code: "auth/weak-password" });
      login(email);
    },
    async signIn(email, password) {
      if (!email.includes("@")) throw Object.assign(new Error(), { code: "auth/invalid-email" });
      if (!password) throw Object.assign(new Error(), { code: "auth/missing-password" });
      login(email);
    },
    async signInWithGoogle() {
      login("demo@example.com");
    },
    async resetPassword() {},
    async signOut() {
      user = null;
      write(K.user, null);
      emitAuth();
    },
    async deleteAccount() {
      lists = [];
      profile = { favoriteStores: [] };
      write(K.lists, null);
      write(K.profile, null);
      emitLists();
      emitProfile();
      user = null;
      write(K.user, null);
      emitAuth();
    },
    watchProfile(_uid, cb) {
      profileSubs.add(cb);
      queueMicrotask(() => cb(profile));
      return () => profileSubs.delete(cb);
    },
    async setFavorites(_uid, storeIds) {
      profile = { favoriteStores: storeIds };
      write(K.profile, profile);
      emitProfile();
    },
    watchLists(_uid, cb) {
      listSubs.add(cb);
      queueMicrotask(emitLists);
      return () => listSubs.delete(cb);
    },
    async createList(_uid, name) {
      const now = Date.now();
      const id = newKey();
      lists = [...lists, { id, name, createdAt: now, updatedAt: now, items: [] }];
      saveLists();
      return id;
    },
    async renameList(_uid, listId, name) {
      lists = lists.map((l) => (l.id === listId ? { ...l, name, updatedAt: Date.now() } : l));
      saveLists();
    },
    async deleteList(_uid, listId) {
      lists = lists.filter((l) => l.id !== listId);
      saveLists();
    },
    async updateItems(_uid, listId, fn) {
      lists = lists.map((l) => (l.id === listId ? { ...l, items: fn(l.items), updatedAt: Date.now() } : l));
      saveLists();
    },
  };
}
