import { useState } from "react";
import { useApp } from "../state";
import { Loading, StarButton } from "../components";
import { authErrorMessage } from "../backend";

export default function AccountPage() {
  const { user, authReady, backend } = useApp();
  if (!authReady || !backend) return <Loading />;
  return user ? <Profile /> : <SignIn />;
}

function SignIn() {
  const { backend } = useApp();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="top">
        <div className="brand">The Shop</div>
        <h1>{mode === "in" ? "Sign in" : "Create an account"}</h1>
        <p className="sub">Your list and stores are already saved on this device. An account keeps them safe and on all your devices.</p>
      </header>
      <div className="card pad">
        <button className="btn google" disabled={busy} onClick={() => run(() => backend!.signInWithGoogle())}>
          Continue with Google
        </button>
        <div className="or">or</div>
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => (mode === "in" ? backend!.signIn(email.trim(), pw) : backend!.signUp(email.trim(), pw)));
          }}
        >
          <label>
            Email
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              minLength={mode === "up" ? 6 : undefined}
              required
            />
          </label>
          {err && <p className="error" role="alert">{err}</p>}
          {info && <p className="note">{info}</p>}
          <button className="btn primary" type="submit" disabled={busy}>
            {mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <div className="row-links">
          <button className="link" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
          </button>
          {mode === "in" && (
            <button
              className="link"
              onClick={() => {
                if (!email.trim()) {
                  setErr("Enter your email above first.");
                  return;
                }
                run(async () => {
                  await backend!.resetPassword(email.trim());
                  setInfo("If there's an account for that email, a reset link is on its way.");
                });
              }}
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Profile() {
  const { user, backend, edition, profile, list, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const favCount = profile.favoriteStores.length;

  return (
    <div className="page">
      <header className="top">
        <div className="brand">The Shop</div>
        <h1>Account</h1>
        <p className="sub">{user!.email}</p>
      </header>

      <section>
        <h2 className="section-h">My stores</h2>
        <p className="note pad-x">
          Starred stores show first on Deals and Compare. {favCount ? `${favCount} selected.` : "None selected yet."}
        </p>
        {edition ? (
          <ul className="card store-picker">
            {edition.stores.map((s) => (
              <li key={s.id}>
                <div>
                  <div className="store-name">{s.name}</div>
                  <div className="muted small">{s.location || s.dates}</div>
                </div>
                <StarButton storeId={s.id} name={s.name} />
              </li>
            ))}
          </ul>
        ) : (
          <Loading />
        )}
      </section>

      <section className="pad stack">
        <button className="btn" onClick={() => backend!.signOut()}>
          Sign out
        </button>
        <button
          className="btn danger"
          disabled={busy}
          onClick={async () => {
            if (!confirm(`Delete your account${list?.items.length ? ` and the ${list.items.length} items on your list` : ""}? This can't be undone.`)) return;
            setBusy(true);
            try {
              await backend!.deleteAccount(user!.uid);
            } catch (e) {
              toast(authErrorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Delete account
        </button>
      </section>
    </div>
  );
}
