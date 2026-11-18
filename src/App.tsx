import { NavLink, Route, Routes } from "react-router-dom";
import { useApp } from "./state";
import DealsPage from "./pages/DealsPage";
import ComparePage from "./pages/ComparePage";
import ListsPage from "./pages/ListsPage";
import ListPage from "./pages/ListPage";
import AccountPage from "./pages/AccountPage";
import AboutPage from "./pages/AboutPage";

const tabs = [
  { to: "/", label: "Deals", icon: "M4 6h16M4 12h16M4 18h10", end: true },
  { to: "/compare", label: "Compare", icon: "M6 20V10M12 20V4M18 20v-6" },
  { to: "/lists", label: "Lists", icon: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" },
  { to: "/account", label: "Account", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0" },
];

export default function App() {
  const { toastMsg, backend } = useApp();
  return (
    <div className="app">
      {backend?.mode === "demo" && (
        <div className="demo-banner" role="note">
          Demo mode: accounts and lists are saved only in this browser.
        </div>
      )}
      <main className="main">
        <Routes>
          <Route path="/" element={<DealsPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/lists/:id" element={<ListPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<DealsPage />} />
        </Routes>
      </main>
      <nav className="tabbar" aria-label="Main">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="tab">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={t.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className={"toast" + (toastMsg ? " show" : "")} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
  );
}
