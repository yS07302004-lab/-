/** アプリ座標（m, Y-up, 前方=+Z, 体の右=-X）。README「座標系」参照 */
export type Vec3 = [number, number, number];

export type PositionStatus = 'draft' | 'checked';

export interface Acupoint {
  id: string; // WHO コード（LU1 など）
  name: string;
  reading: string;
  meridian: string;
  location: string;
  landmarks: string[];
  kotsudo: string | null;
  tags: string[];
  etymology: { text: string; status: 'draft' | 'checked'; sources: string[] };
  position: Vec3 | null;
  /** 位置が教科書で確認済みか（無ければ draft 扱い） */
  positionStatus?: PositionStatus;
}

export interface KotsudoSegment {
  id: string;
  from: string;
  to: string;
  sun: number;
  extend?: number;
  note?: string;
}

export interface Landmark {
  name: string;
  side: 'R' | 'L' | 'midline';
  note: string;
  position: Vec3 | null;
  positionStatus?: PositionStatus;
}

/** 配置モードで置く対象（経穴 or 骨度法の基準点） */
export type PlaceTarget = { kind: 'point'; id: string } | { kind: 'landmark'; id: string };
