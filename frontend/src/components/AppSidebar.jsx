import { Link, useLocation } from 'react-router-dom';

export default function AppSidebar({ user, onLogout }) {
  const location = useLocation();

  const getNavClassName = (isActive) =>
    `flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
      isActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
    }`;

  return (
    <aside className="w-full bg-slate-900 px-5 py-6 text-white lg:min-h-screen lg:w-72">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
          Library System
        </p>
        <h1 className="mt-3 text-2xl font-bold">Workspace</h1>
        <p className="mt-2 text-sm text-slate-300">
          Move between dashboard, circulation, and settings without crowding one screen.
        </p>
      </div>

      <div className="mb-8 space-y-3">
        <Link to="/?view=dashboard" className={getNavClassName(location.pathname === '/' && location.search !== '?view=borrowed')}>
          <span className="font-medium">Dashboard</span>
          <span className="text-xs uppercase tracking-[0.2em]">Home</span>
        </Link>

        <Link to="/?view=borrowed" className={getNavClassName(location.pathname === '/' && location.search === '?view=borrowed')}>
          <span className="font-medium">Borrowed Books</span>
          <span className="text-xs uppercase tracking-[0.2em]">Loans</span>
        </Link>

        <Link to="/checkout" className={getNavClassName(location.pathname === '/checkout')}>
          <span className="font-medium">Checkout</span>
          <span className="text-xs uppercase tracking-[0.2em]">Circulation</span>
        </Link>

        <Link to="/settings" className={getNavClassName(location.pathname === '/settings')}>
          <span className="font-medium">Settings</span>
          <span className="text-xs uppercase tracking-[0.2em]">Due Dates</span>
        </Link>
      </div>

      <div className="rounded-2xl bg-slate-800 p-4">
        <p className="text-sm text-slate-400">Signed in as</p>
        <p className="mt-1 font-semibold">{user?.username || 'admin'}</p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-4 w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
