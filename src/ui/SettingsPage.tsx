import { useProgress, useSettings } from '../store/settings';
import { useSimulatorRig, initialRig } from '../store/rig';

export function SettingsPage() {
  const s = useSettings();
  const resetProgress = useProgress((p) => p.reset);

  return (
    <div className="settings">
      <h2>設定</h2>

      <section>
        <h3>操作</h3>
        <div className="field">
          <span>F値・シャッタースピード・ISOの操作部品</span>
          <div className="segmented">
            <button className={s.controlStyle === 'dial' ? 'on' : ''} onClick={() => s.set({ controlStyle: 'dial' })}>
              ダイヤル
            </button>
            <button className={s.controlStyle === 'slider' ? 'on' : ''} onClick={() => s.set({ controlStyle: 'slider' })}>
              スライダー
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3>画質</h3>
        <div className="field">
          <span>ライブビューと撮影の画質（重いと感じたら「低」に）</span>
          <div className="segmented">
            {(['low', 'standard', 'high'] as const).map((q) => (
              <button key={q} className={s.quality === q ? 'on' : ''} onClick={() => s.set({ quality: q })}>
                {{ low: '低', standard: '標準', high: '高' }[q]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h3>補助表示</h3>
        <label className="toggle">
          <input type="checkbox" checked={s.zebra} onChange={(e) => s.set({ zebra: e.target.checked })} />
          白飛び警告（ゼブラ）
        </label>
        <label className="toggle">
          <input type="checkbox" checked={s.grid} onChange={(e) => s.set({ grid: e.target.checked })} />
          グリッド（三分割）
        </label>
        <label className="toggle">
          <input type="checkbox" checked={s.dofBar} onChange={(e) => s.set({ dofBar: e.target.checked })} />
          被写界深度バー（シミュレーター）
        </label>
        <label className="toggle">
          <input type="checkbox" checked={s.topView} onChange={(e) => s.set({ topView: e.target.checked })} />
          上から見た図（シミュレーター）
        </label>
      </section>

      <section>
        <h3>説明</h3>
        <label className="toggle">
          <input type="checkbox" checked={s.showAdvanced} onChange={(e) => s.set({ showAdvanced: e.target.checked })} />
          「もっと詳しく（発展）」を最初から開く
        </label>
      </section>

      <section>
        <h3>データ</h3>
        <p className="muted">設定、講座の進捗、撮った写真（最大50枚）は、このブラウザの中だけに保存されます。</p>
        <div className="row">
          <button
            onClick={() => {
              if (window.confirm('講座の進捗をリセットしますか？')) resetProgress();
            }}
          >
            講座の進捗をリセット
          </button>
          <button onClick={() => useSimulatorRig.setState(initialRig())}>シミュレーターのカメラ設定を初期値に戻す</button>
        </div>
      </section>
    </div>
  );
}
