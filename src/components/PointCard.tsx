import { useState } from 'react';
import { kotsudoById } from '../data';
import type { Acupoint, Landmark } from '../types';

export default function PointCard({ point, landmarks, onClose }: { point: Acupoint; landmarks: Landmark[]; onClose: () => void }) {
  const seg = kotsudoById(point.kotsudo);
  const a = landmarks.find((l) => l.name === seg?.from)?.position;
  const b = landmarks.find((l) => l.name === seg?.to)?.position;
  const unitMm = a && b && seg ? (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / seg.sun) * 1000 : null;
  const ety = point.etymology;
  // 3Dを広く見たいときは見出しだけに畳める
  const [folded, setFolded] = useState(false);

  return (
    <section className="card" aria-label={`${point.name}の詳細`}>
      <header className="card-head">
        <div className="card-title" onClick={() => setFolded((v) => !v)} role="button" aria-expanded={!folded}>
          <div className="card-code">{point.id}</div>
          <h2>
            {point.name}
            <small>{point.reading}</small>
          </h2>
        </div>
        <div className="card-actions">
          <button className="icon-btn" onClick={() => setFolded((v) => !v)} aria-label={folded ? '開く' : '畳む'}>
            {folded ? '▴' : '▾'}
          </button>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
      </header>
      {!folded && (
        <>

      {point.tags.length > 0 && (
        <ul className="tags">
          {point.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      {!point.position ? (
        <p className="warn">この穴はまだ3Dモデル上に配置されていません（配置モードで置けます）</p>
      ) : point.positionStatus !== 'checked' ? (
        <p className="warn">3D上の位置は仮置きです（教科書で未確認）</p>
      ) : null}

      <h3>取穴部位</h3>
      <p>{point.location}</p>

      <h3>目印</h3>
      <ul className="chips">
        {point.landmarks.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

      {seg && (
        <>
          <h3>骨度法</h3>
          <p>
            {seg.from}〜{seg.to} ＝ <b>{seg.sun}寸</b>
            {seg.extend ? `（外へ${seg.extend}寸延長して表示）` : ''}
            {unitMm ? <span className="muted">　このモデルでは1寸≒{unitMm.toFixed(1)}mm</span> : <span className="muted">　（基準点が未配置のため物差しは出ません）</span>}
          </p>
          {seg.note && <p className="muted small">{seg.note}</p>}
        </>
      )}

      <h3>
        名前の由来
        {ety.status === 'draft' ? <span className="badge draft">未確認</span> : <span className="badge ok">確認済み</span>}
      </h3>
      <p>{ety.text}</p>
      <p className="muted small">
        出典：{ety.sources.length ? ety.sources.join(' / ') : '未記入'}
      </p>
        </>
      )}
    </section>
  );
}
