import { useSettings, type Mode } from './store/settings';
import { LessonsPage } from './ui/LessonsPage';
import { SettingsPage } from './ui/SettingsPage';
import { SimulatorPage } from './ui/SimulatorPage';

const TABS: { id: Mode; label: string }[] = [
  { id: 'lessons', label: '講座' },
  { id: 'simulator', label: 'シミュレーター' },
  { id: 'settings', label: '設定' },
];

export function App() {
  const mode = useSettings((s) => s.mode);
  const set = useSettings((s) => s.set);

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          Camera Drill
          <small>カメラの設定を、動かして覚える</small>
        </h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={mode === t.id ? 'on' : ''} onClick={() => set({ mode: t.id })}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {mode === 'lessons' && <LessonsPage />}
        {mode === 'simulator' && <SimulatorPage />}
        {mode === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
