import lungJson from '../data/lung.json';
import kotsudoJson from '../data/kotsudo.json';
import landmarksJson from '../data/landmarks.json';
import type { Acupoint, KotsudoSegment, Landmark } from './types';

export const ACUPOINTS = lungJson as unknown as Acupoint[];
export const KOTSUDO = kotsudoJson as unknown as KotsudoSegment[];
export const LANDMARKS = landmarksJson as unknown as Landmark[];

export const MERIDIAN_NAMES: Record<string, string> = { LU: '手の太陰肺経' };

export const CREDIT =
  'BodyParts3D, Copyright© The Database Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan';

export const MODEL_URL = {
  skin: `${import.meta.env.BASE_URL}models/skin.glb`,
  bones: `${import.meta.env.BASE_URL}models/bones.glb`,
  draco: `${import.meta.env.BASE_URL}draco/`,
};

export function kotsudoById(id: string | null): KotsudoSegment | undefined {
  return id ? KOTSUDO.find((k) => k.id === id) : undefined;
}
