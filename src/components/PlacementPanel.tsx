import { useState } from 'react';
import { formatAcupoints, formatLandmarks } from '../placement';
import type { Acupoint, Landmark, PlaceTarget, PositionStatus } from '../types';

interface Props {
  points: Acupoint[];
  landmarks: Landmark[];
  target: PlaceTarget;
  onTarget: (t: PlaceTarget) => void;
  autoNext: boolean;
  onAutoNext: (v: boolean) => void;
  onClear: () => void;
  onStatus: (s: PositionStatus) => void;
  onResetAll: () => void;
}

export function targetKey(t: PlaceTarget) {
  return `${t.kind}:${t.id}`;
}

export function allTargets(points: Acupoint[], landmarks: Landmark[]): PlaceTarget[] {
  return [...points.map((p) => ({ kind: 'point', id: p.id }) as const), ...landmarks.map((l) => ({ kind: 'landmark', id: l.name }) as const)];
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PlacementPanel(props: Props) {
  const { points, landmarks, target, onTarget, autoNext, onAutoNext, onClear, onStatus, onResetAll } = props;
  const [exportOpen, setExportOpen] = useState(false);
  const cur = target.kind === 'point' ? points.find((p) => p.id === target.id) : landmarks.find((l) => l.name === target.id);
  const pos = cur?.position;
  const status = cur?.positionStatus ?? 'draft';
  const lungText = formatAcupoints(points);
  const lmText = formatLandmarks(landmarks);

  return (
    <section className="card placement">
      <header className="card-head">
        <h2>配置モード（開発用）</h2>
      </header>
      <p className="small muted">皮膚をタップすると、選んだ対象の位置が保存されます（骨には置かれません）。</p>
      <label className="field">
        対象
        <select
          value={`${target.kind}:${target.id}`}
          onChange={(e) => {
            const [kind, ...rest] = e.target.value.split(':');
            onTarget({ kind: kind as PlaceTarget['kind'], id: rest.join(':') });
          }}
        >
          <optgroup label="経穴">
            {points.map((p) => (
              <option key={p.id} value={`point:${p.id}`}>
                {p.position ? '● ' : '○ '}
                {p.id} {p.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="骨度法の基準点">
            {landmarks.map((l) => (
              <option key={l.name} value={`landmark:${l.name}`}>
                {l.position ? '● ' : '○ '}
                {l.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {target.kind === 'point' ? (
        <p className="small">{points.find((p) => p.id === target.id)?.location}</p>
      ) : (
        <p className="small">{landmarks.find((l) => l.name === target.id)?.note}</p>
      )}
      <p className="mono small">position: {pos ? `[${pos.join(', ')}]` : 'null'}</p>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={status === 'checked'} disabled={!pos} onChange={(e) => onStatus(e.target.checked ? 'checked' : 'draft')} />
          教科書で確認済み
        </label>
        <label className="check">
          <input type="checkbox" checked={autoNext} onChange={(e) => onAutoNext(e.target.checked)} />
          置いたら次へ
        </label>
      </div>
      <div className="row">
        <button onClick={onClear} disabled={!pos}>
          この位置を消す
        </button>
        <button className="primary" onClick={() => setExportOpen(true)}>
          JSONを書き出す
        </button>
      </div>

      {exportOpen && (
        <div className="modal" role="dialog" aria-label="JSON書き出し">
          <div className="modal-body">
            <header className="card-head">
              <h2>JSON書き出し</h2>
              <button className="icon-btn" onClick={() => setExportOpen(false)} aria-label="閉じる">
                ×
              </button>
            </header>
            <p className="small">それぞれ data/ の同名ファイルに上書きして使います。</p>
            {[
              ['lung.json', lungText],
              ['landmarks.json', lmText],
            ].map(([name, text]) => (
              <div key={name} className="export">
                <div className="row">
                  <b>data/{name}</b>
                  <button onClick={() => navigator.clipboard?.writeText(text)}>コピー</button>
                  <button onClick={() => download(name, text)}>保存</button>
                </div>
                <textarea readOnly value={text} rows={6} />
              </div>
            ))}
            <button
              className="danger"
              onClick={() => {
                if (confirm('このブラウザに保存している配置をすべて消して、data/ の内容に戻しますか？')) onResetAll();
              }}
            >
              配置をリセット（data/ の内容に戻す）
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
