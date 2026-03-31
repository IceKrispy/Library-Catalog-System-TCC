import { useState } from 'react';

const DEFAULT_CREDENTIALS = {
  username: '',
  password: ''
};

export default function LoginPage({ onLogin }) {
  const [credentials, setCredentials] = useState(DEFAULT_CREDENTIALS);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const username = credentials.username.trim();
    const password = credentials.password;

    if (username === 'admin' && password === 'library123') {
      onLogin({ username });
      return;
    }

    setError('Invalid username or password.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_55%,_#e2e8f0)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <img
            src="/tcc-logo.png"
            alt="Tagoloan Community College logo"
            className="h-32 w-32 object-contain drop-shadow-[0_12px_30px_rgba(15,23,42,0.18)] sm:h-40 sm:w-40"
          />
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/90 p-8 shadow-2xl shadow-slate-200 backdrop-blur">
          <div className="mb-8 text-center">
            <p className="mb-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
              Library System
            </p>
            <h1 className="text-3xl font-bold text-slate-900">Sign in to continue</h1>
            <p className="mt-2 text-sm text-slate-600">
              Use the library administrator account to access the catalog dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Username</span>
              <input
                name="username"
                type="text"
                value={credentials.username}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
              <input
                name="password"
                type="password"
                value={credentials.password}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </label>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Login
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
