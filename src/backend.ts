import type { AppUser, ListItem, Profile, ShopList } from "./types";

// One interface, two implementations: Firebase (production) and a demo mode that
// keeps everything in this browser, used when no Firebase config is present.
export interface Backend {
  mode: "firebase" | "demo";
  onAuth(cb: (u: AppUser | null) => void): () => void;
  signUp(email: string, password: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(uid: string): Promise<void>;
  watchProfile(uid: string, cb: (p: Profile) => void): () => void;
  setFavorites(uid: string, storeIds: string[]): Promise<void>;
  watchLists(uid: string, cb: (lists: ShopList[]) => void): () => void;
  createList(uid: string, name: string): Promise<string>;
  renameList(uid: string, listId: string, name: string): Promise<void>;
  deleteList(uid: string, listId: string): Promise<void>;
  updateItems(uid: string, listId: string, fn: (items: ListItem[]) => ListItem[]): Promise<void>;
}

const env = import.meta.env;
export const firebaseConfigured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID);

let backendPromise: Promise<Backend> | null = null;
export function getBackend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = firebaseConfigured
      ? import("./backend-firebase").then((m) => m.createFirebaseBackend())
      : import("./backend-demo").then((m) => m.createDemoBackend());
  }
  return backendPromise;
}

export function newKey(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Human-readable messages for common auth errors (Firebase error codes).
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/missing-password": "Enter a password.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/email-already-in-use": "There's already an account with that email. Try signing in.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/popup-closed-by-user": "Sign-in window was closed.",
    "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups and try again.",
    "auth/requires-recent-login": "For security, sign out and back in, then try again.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/configuration-not-found": "Sign-in isn't set up for this site yet. Please try again later.",
    "auth/operation-not-allowed": "That sign-in method isn't turned on for this site yet.",
    "auth/unauthorized-domain": "Sign-in isn't allowed from this web address yet.",
    "permission-denied": "Your account couldn't be saved. Please try again later.",
  };
  return map[code] ?? (e instanceof Error ? e.message : "Something went wrong.");
}
