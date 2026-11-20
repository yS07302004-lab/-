import { MERIDIAN_NAMES } from '../data';
import type { Acupoint } from '../types';

export default function PointList({ points, selectedId, onPick }: { points: Acupoint[]; selectedId: string | null; onPick: (id: string) => void }) {
  return (
    <div className="list">
      <h2>{MERIDIAN_NAMES.LU}（{points.length}穴）</h2>
      <ol>
        {points.map((p) => (
          <li key={p.id}>
            <button className={p.id === selectedId ? 'active' : ''} onClick={() => onPick(p.id)}>
              <span className="code">{p.id}</span>
              <span className="name">
                {p.name}
                <small>{p.reading}</small>
              </span>
              <span className="tags-inline">{p.tags.join('・')}</span>
              {!p.position && <span className="unplaced">未配置</span>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
