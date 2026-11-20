// 配置モードで決めた座標を保持する（ブラウザの localStorage に一時保存し、JSON で書き出す）
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ACUPOINTS, LANDMARKS } from './data';
import type { Acupoint, Landmark, PositionStatus, Vec3 } from './types';

const KEY = 'tsubotan.placement.v1';

interface Override {
  position: Vec3 | null;
  positionStatus?: PositionStatus;
}
type Overrides = { points: Record<string, Override>; landmarks: Record<string, Override> };

function load(): Overrides {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* 保存できない環境では無視 */
  }
  return { points: {}, landmarks: {} };
}

/** 0.1mm に丸める（単位 m） */
export function roundVec(v: Vec3): Vec3 {
  return v.map((x) => Math.round(x * 10000) / 10000) as Vec3;
}

export function usePlacement() {
  const [ov, setOv] = useState<Overrides>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ov));
    } catch {
      /* ignore */
    }
  }, [ov]);

  const points: Acupoint[] = useMemo(
    () => ACUPOINTS.map((p) => (ov.points[p.id] ? { ...p, ...ov.points[p.id] } : p)),
    [ov],
  );
  const landmarks: Landmark[] = useMemo(
    () => LANDMARKS.map((l) => (ov.landmarks[l.name] ? { ...l, ...ov.landmarks[l.name] } : l)),
    [ov],
  );

  const set = useCallback((kind: 'points' | 'landmarks', id: string, o: Partial<Override>) => {
    setOv((prev) => {
      const base =
        prev[kind][id] ??
        (kind === 'points'
          ? { position: ACUPOINTS.find((p) => p.id === id)?.position ?? null, positionStatus: ACUPOINTS.find((p) => p.id === id)?.positionStatus }
          : { position: LANDMARKS.find((l) => l.name === id)?.position ?? null, positionStatus: LANDMARKS.find((l) => l.name === id)?.positionStatus });
      return { ...prev, [kind]: { ...prev[kind], [id]: { ...base, ...o } } };
    });
  }, []);

  const reset = useCallback(() => setOv({ points: {}, landmarks: {} }), []);
  const dirty = Object.keys(ov.points).length + Object.keys(ov.landmarks).length > 0;

  return { points, landmarks, set, reset, dirty };
}

// 1行にまとめた JSON（["a", "b"] / {"k": 1} の形。文字列の中は変えない）
const j = (v: unknown) =>
  JSON.stringify(v, null, 1)
    .replace(/\n\s*/g, ' ')
    .replace(/([[{]) /g, '$1')
    .replace(/ ([\]}])/g, '$1');

/** data/lung.json と同じ書式（1穴を数行にまとめる）で書き出す */
export function formatAcupoints(points: Acupoint[]): string {
  const body = points.map((p) => {
    const { id, name, reading, meridian, location, landmarks, kotsudo, tags, etymology, position, positionStatus, ...rest } = p;
    const lines = [
      `"id": ${j(id)}, "name": ${j(name)}, "reading": ${j(reading)}, "meridian": ${j(meridian)},`,
      `"location": ${j(location)},`,
      `"landmarks": ${j(landmarks)},`,
      `"kotsudo": ${j(kotsudo)},`,
      `"tags": ${j(tags)},`,
      `"etymology": { "text": ${j(etymology.text)}, "status": ${j(etymology.status)}, "sources": ${j(etymology.sources)} },`,
      ...Object.entries(rest).map(([k, v]) => `${j(k)}: ${j(v)},`),
      `"position": ${j(position)}${positionStatus ? `, "positionStatus": ${j(positionStatus)}` : ''}`,
    ];
    return `  {\n${lines.map((l) => '    ' + l).join('\n')}\n  }`;
  });
  return `[\n${body.join(',\n')}\n]\n`;
}

/** data/landmarks.json と同じ書式（1行1件）で書き出す */
export function formatLandmarks(items: Landmark[]): string {
  return `[\n${items.map((l) => '  ' + j(l)).join(',\n')}\n]\n`;
}
