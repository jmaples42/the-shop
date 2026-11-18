import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  collection,
  onSnapshot,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  runTransaction,
  writeBatch,
  query,
  orderBy,
} from "firebase/firestore";
import type { Backend } from "./backend";
import type { ListItem, ShopList } from "./types";

export function createFirebaseBackend(): Backend {
  const env = import.meta.env;
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  // Offline cache so lists open in a store with weak signal.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  const userDoc = (uid: string) => doc(db, "users", uid);
  const listsCol = (uid: string) => collection(db, "users", uid, "lists");

  return {
    mode: "firebase",
    onAuth(cb) {
      return onAuthStateChanged(auth, (u) =>
        cb(u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null),
      );
    },
    async signUp(email, password) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(userDoc(cred.user.uid), { favoriteStores: [], createdAt: Date.now() }, { merge: true });
    },
    async signIn(email, password) {
      await signInWithEmailAndPassword(auth, email, password);
    },
    async signInWithGoogle() {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    async resetPassword(email) {
      await sendPasswordResetEmail(auth, email);
    },
    async signOut() {
      await signOut(auth);
    },
    async deleteAccount(uid) {
      const user = auth.currentUser;
      if (!user || user.uid !== uid) throw new Error("Not signed in.");
      const snap = await getDocs(listsCol(uid));
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      batch.delete(userDoc(uid));
      await batch.commit();
      await deleteUser(user);
    },
    watchProfile(uid, cb) {
      return onSnapshot(userDoc(uid), (s) => {
        const data = s.data();
        cb({ favoriteStores: Array.isArray(data?.favoriteStores) ? data.favoriteStores : [] });
      });
    },
    async setFavorites(uid, storeIds) {
      await setDoc(userDoc(uid), { favoriteStores: storeIds }, { merge: true });
    },
    watchLists(uid, cb) {
      return onSnapshot(query(listsCol(uid), orderBy("updatedAt", "desc")), (s) => {
        cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ShopList, "id">) })));
      });
    },
    async createList(uid, name) {
      const now = Date.now();
      const ref = await addDoc(listsCol(uid), { name, createdAt: now, updatedAt: now, items: [] });
      return ref.id;
    },
    async renameList(uid, listId, name) {
      await updateDoc(doc(listsCol(uid), listId), { name, updatedAt: Date.now() });
    },
    async deleteList(uid, listId) {
      await deleteDoc(doc(listsCol(uid), listId));
    },
    async updateItems(uid, listId, fn) {
      const ref = doc(listsCol(uid), listId);
      // Transaction so two devices editing the same list don't overwrite each other.
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error("That list no longer exists.");
        const items = (snap.data().items ?? []) as ListItem[];
        tx.update(ref, { items: fn(items), updatedAt: Date.now() });
      });
    },
  };
}
