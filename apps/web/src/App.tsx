import { lazy, Suspense, useEffect } from 'react';
import { History, Info, Languages, ScanLine, Settings } from 'lucide-react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useT } from './i18n/i18n';
import { cn } from './lib/cn';
import { DEFAULT_PROFILE_STORE } from './state/profile-store';

const About = lazy(() => import('./pages/About').then((m) => ({ default: m.About })));
const Confirm = lazy(() => import('./pages/Confirm').then((m) => ({ default: m.Confirm })));
const Demo = lazy(() => import('./pages/Demo').then((m) => ({ default: m.Demo })));
const HistoryPage = lazy(() => import('./pages/History').then((m) => ({ default: m.History })));
const Onboarding = lazy(() =>
  import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })),
);
const Result = lazy(() => import('./pages/Result').then((m) => ({ default: m.Result })));
const Scan = lazy(() => import('./pages/Scan').then((m) => ({ default: m.Scan })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

const NAV_ITEMS = [
  { to: '/', key: 'nav.scan', Icon: ScanLine, end: true },
  { to: '/history', key: 'nav.history', Icon: History, end: false },
  { to: '/settings', key: 'nav.settings', Icon: Settings, end: false },
  { to: '/about', key: 'nav.about', Icon: Info, end: false },
] as const;

/** Returns the app shell with top bar, routed content and mobile bottom navigation. */
export function App() {
  const { t, lang, setLang } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const nextLang = lang === 'en' ? 'bn' : 'en';
  const needsOnboarding = location.pathname !== '/welcome' && !DEFAULT_PROFILE_STORE.hasSaved();

  useEffect(() => {
    if (!DEFAULT_PROFILE_STORE.hasSaved()) {
      return;
    }
    const profile = DEFAULT_PROFILE_STORE.load();
    if (profile.language !== lang) {
      DEFAULT_PROFILE_STORE.save({ ...profile, language: lang });
    }
  }, [lang]);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex min-h-14 w-full max-w-3xl items-center justify-between gap-4 px-4">
          <span className="text-lg font-bold tracking-tight">{t('app.name')}</span>
          <button
            type="button"
            onClick={() => setLang(nextLang)}
            aria-label={t('button.toggleLanguage')}
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Languages aria-hidden="true" className="h-4 w-4" />
            {t('button.language')}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6">
        {needsOnboarding ? (
          <Navigate to="/welcome" replace />
        ) : (
          <Suspense
            fallback={
              <div role="status" aria-busy="true" className="space-y-3">
                <div className="h-8 w-2/3 rounded-md bg-muted" />
                <div className="h-24 rounded-md bg-muted" />
                <div className="h-24 rounded-md bg-muted" />
              </div>
            }
          >
            <Routes>
              <Route
                path="/welcome"
                element={
                  <Onboarding
                    store={DEFAULT_PROFILE_STORE}
                    now={() => new Date().toISOString()}
                    onDone={() => navigate('/')}
                  />
                }
              />
              <Route path="/" element={<Scan />} />
              <Route path="/confirm" element={<Confirm />} />
              <Route path="/result" element={<Result />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/about" element={<About />} />
              <Route path="/demo" element={<Demo />} />
            </Routes>
          </Suspense>
        )}
      </main>

      <nav
        aria-label={t('app.name')}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto grid w-full max-w-3xl grid-cols-4">
          {NAV_ITEMS.map(({ to, key, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium',
                  isActive ? 'text-primary' : 'text-fg',
                )
              }
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
              {t(key)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
