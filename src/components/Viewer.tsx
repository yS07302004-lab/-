import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Bvh, Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { MODEL_URL, kotsudoById } from '../data';
import type { Acupoint, Landmark, Vec3 } from '../types';

// 描画順（小さいほど先に描く）
// 骨(不透明) → 皮膚の深度だけ先に描く → 皮膚の色(半透明, depthWrite off) → 走行線・物差し・経穴（depthTest off で常に手前）
const ORDER = { skinDepth: 1, skinColor: 2, line: 10, ruler: 11, point: 12 };

const SKIN_COLOR = '#e3b99c';
const BONE_COLOR = '#fbf7ec';
const POINT_COLOR = '#d6336c';
const SELECTED_COLOR = '#ffb000';
const LINE_COLOR = '#c2255c';
const RULER_COLOR = '#1971c2';

export const INITIAL_CAMERA = { position: [-0.55, 1.3, 1.25] as Vec3, target: [-0.17, 1.1, 0.08] as Vec3 };

function firstGeometry(scene: THREE.Object3D): THREE.BufferGeometry {
  let g: THREE.BufferGeometry | null = null;
  scene.traverse((o) => {
    if (!g && (o as THREE.Mesh).isMesh) g = (o as THREE.Mesh).geometry;
  });
  if (!g) throw new Error('mesh not found');
  return g;
}

function Body({ skinOpacity, placing, onPlace }: { skinOpacity: number; placing: boolean; onPlace: (p: Vec3) => void }) {
  const skin = useGLTF(MODEL_URL.skin, MODEL_URL.draco);
  const bones = useGLTF(MODEL_URL.bones, MODEL_URL.draco);
  const skinGeo = useMemo(() => firstGeometry(skin.scene), [skin]);
  const boneGeo = useMemo(() => firstGeometry(bones.scene), [bones]);

  const opaque = skinOpacity >= 0.999;
  const hidden = skinOpacity <= 0.001;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onPlace([e.point.x, e.point.y, e.point.z]);
  };

  return (
    <group>
      <mesh geometry={boneGeo}>
        <meshStandardMaterial color={BONE_COLOR} roughness={0.75} />
      </mesh>

      {/* 配置モードのタップ判定用。皮膚だけを対象にし、透明度 0% でも当たる（骨には当たらない） */}
      <Bvh firstHitOnly>
        <mesh geometry={skinGeo} visible={false} onClick={placing ? handleClick : undefined} />
      </Bvh>

      {/* 半透明時：一番手前の皮膚だけを描くため、先に深度だけ書く */}
      <mesh geometry={skinGeo} renderOrder={ORDER.skinDepth} visible={!opaque && !hidden} raycast={() => null}>
        <meshBasicMaterial colorWrite={false} transparent depthWrite />
      </mesh>
      <mesh geometry={skinGeo} renderOrder={ORDER.skinColor} visible={!hidden} raycast={() => null}>
        {/* transparent の切り替えはシェーダの再コンパイルが要るので、key で作り直す */}
        <meshStandardMaterial
          key={opaque ? 'opaque' : 'transparent'}
          color={SKIN_COLOR}
          roughness={0.85}
          transparent={!opaque}
          opacity={skinOpacity}
          depthWrite={opaque}
          depthFunc={THREE.LessEqualDepth}
        />
      </mesh>
    </group>
  );
}

/** カメラからの距離に応じて大きさを変え、どの倍率でも同じくらいの大きさに見せる */
function useScreenScale(pos: Vec3 | null, ref: React.RefObject<THREE.Object3D>, factor: number, min: number) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (!ref.current || !pos) return;
    const d = camera.position.distanceTo(v.set(...pos));
    ref.current.scale.setScalar(Math.max(min, d * factor));
  });
}

function PointMarker({
  point,
  selected,
  placing,
  onSelect,
}: {
  point: Acupoint & { position: Vec3 };
  selected: boolean;
  placing: boolean;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  useScreenScale(point.position, ref, selected ? 0.009 : 0.006, 0.0015);
  return (
    <group position={point.position}>
      <group ref={ref}>
        <mesh renderOrder={ORDER.point}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial color={selected ? SELECTED_COLOR : POINT_COLOR} depthTest={false} depthWrite={false} transparent />
        </mesh>
        {/* 指でタップしやすいように、見た目より大きい当たり判定 */}
        <mesh
          visible={false}
          onClick={
            placing
              ? undefined
              : (e) => {
                  e.stopPropagation();
                  onSelect(point.id);
                }
          }
        >
          <sphereGeometry args={[2.6, 8, 6]} />
        </mesh>
      </group>
      {selected && (
        <Html center position={[0, 0, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
          <div className="point-label">
            {point.name}
            <span>{point.id}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function MeridianLine({ points }: { points: Acupoint[] }) {
  const pts = points.filter((p) => p.position).map((p) => p.position as Vec3);
  if (pts.length < 2) return null;
  return (
    <Line
      points={pts}
      color={LINE_COLOR}
      lineWidth={2.5}
      renderOrder={ORDER.line}
      depthTest={false}
      depthWrite={false}
      transparent
      opacity={0.85}
    />
  );
}

/** 骨度法の物差し：from〜to を sun 等分し、extend 寸だけ to の先へ延長する */
function KotsudoRuler({ point, landmarks }: { point: Acupoint | undefined; landmarks: Landmark[] }) {
  const seg = kotsudoById(point?.kotsudo ?? null);
  const a = landmarks.find((l) => l.name === seg?.from)?.position;
  const b = landmarks.find((l) => l.name === seg?.to)?.position;
  const geo = useMemo(() => {
    if (!seg || !a || !b) return null;
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A);
    const unit = dir.length() / seg.sun; // 1寸の長さ(m)
    dir.normalize();
    // 目盛りは「前方(+Z)と物差しの向き」に直交する向きに出す（前から見て見やすい）
    let perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1));
    if (perp.lengthSq() < 1e-6) perp = new THREE.Vector3(1, 0, 0);
    perp.normalize();
    const total = seg.sun + (seg.extend ?? 0);
    const end = A.clone().addScaledVector(dir, unit * total);
    const ticks: THREE.Vector3[] = [];
    const labels: { pos: Vec3; text: string; ext: boolean }[] = [];
    for (let i = 0; i <= total * 2; i++) {
      const s = i / 2; // 0.5寸ごと
      const p = A.clone().addScaledVector(dir, unit * s);
      const major = Number.isInteger(s);
      const len = (major ? 0.009 : 0.005) * (s === 0 || s === seg.sun ? 1.6 : 1);
      ticks.push(p.clone().addScaledVector(perp, -len), p.clone().addScaledVector(perp, len));
      if (major) {
        const lp = p.clone().addScaledVector(perp, 0.02);
        labels.push({ pos: [lp.x, lp.y, lp.z], text: String(s), ext: s > seg.sun });
      }
    }
    return { A, B, end, ticks, labels, unit };
  }, [seg, a, b]);
  if (!geo || !seg) return null;
  const common = { renderOrder: ORDER.ruler, depthTest: false, depthWrite: false, transparent: true } as const;
  return (
    <group>
      <Line points={[geo.A, geo.B]} color={RULER_COLOR} lineWidth={3} {...common} />
      {seg.extend ? <Line points={[geo.B, geo.end]} color={RULER_COLOR} lineWidth={3} dashed dashSize={0.006} gapSize={0.004} {...common} /> : null}
      <Line points={geo.ticks} segments color={RULER_COLOR} lineWidth={2} {...common} />
      {geo.labels.map((l) => (
        <Html key={l.text} position={l.pos} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div className={'ruler-label' + (l.ext ? ' ext' : '')}>{l.text}</div>
        </Html>
      ))}
    </group>
  );
}

function Lights() {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(({ camera }) => {
    // カメラの少し左上から照らす
    light.current?.position.copy(camera.position).add(new THREE.Vector3(0.3, 0.5, 0));
  });
  return (
    <>
      <hemisphereLight args={['#ffffff', '#8a7f74', 0.9]} />
      <directionalLight ref={light} intensity={1.6} />
    </>
  );
}

/** 一覧から選んだ穴へカメラを寄せる */
function CameraRig({ focus, focusKey }: { focus: Vec3 | null; focusKey: number }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  // 開発時の確認用（スクリーンショットの自動撮影でカメラを動かす）
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__view = { controls, camera };
  }, [controls, camera]);
  const anim = useRef<{ t: number; fromT: THREE.Vector3; toT: THREE.Vector3; fromP: THREE.Vector3; toP: THREE.Vector3 } | null>(null);
  useEffect(() => {
    if (!controls || !focus || focusKey === 0) return;
    const toT = new THREE.Vector3(...focus);
    const offset = camera.position.clone().sub(controls.target);
    // 体の前（+Z）側から見るように、オフセットの向きを少し前へ寄せる
    offset.normalize();
    if (offset.z < 0.3) offset.z = 0.3;
    offset.normalize().multiplyScalar(0.42);
    anim.current = { t: 0, fromT: controls.target.clone(), toT, fromP: camera.position.clone(), toP: toT.clone().add(offset) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, controls]);
  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / 0.6);
    const k = 1 - Math.pow(1 - a.t, 3);
    controls.target.lerpVectors(a.fromT, a.toT, k);
    camera.position.lerpVectors(a.fromP, a.toP, k);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

export interface ViewerProps {
  points: Acupoint[];
  landmarks: Landmark[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  skinOpacity: number;
  placing: boolean;
  onPlace: (p: Vec3) => void;
  focus: Vec3 | null;
  focusKey: number;
  showLandmarks: boolean;
}

export default function Viewer(props: ViewerProps) {
  const { points, landmarks, selectedId, onSelect, skinOpacity, placing, onPlace, focus, focusKey, showLandmarks } = props;
  const selected = points.find((p) => p.id === selectedId);
  return (
    <Canvas
      className="viewer"
      camera={{ position: INITIAL_CAMERA.position, fov: 35, near: 0.01, far: 20 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#f6f3ee']} />
      <Lights />
      <Suspense fallback={<Html center>読み込み中…</Html>}>
        <Body skinOpacity={skinOpacity} placing={placing} onPlace={onPlace} />
      </Suspense>
      <MeridianLine points={points} />
      {!placing && <KotsudoRuler point={selected} landmarks={landmarks} />}
      {points
        .filter((p): p is Acupoint & { position: Vec3 } => !!p.position)
        .map((p) => (
          <PointMarker key={p.id} point={p} selected={p.id === selectedId} placing={placing} onSelect={onSelect} />
        ))}
      {showLandmarks &&
        landmarks
          .filter((l) => l.position)
          .map((l) => (
            <mesh key={l.name} position={l.position as Vec3} renderOrder={ORDER.point}>
              <sphereGeometry args={[0.003, 12, 8]} />
              <meshBasicMaterial color={RULER_COLOR} depthTest={false} transparent />
            </mesh>
          ))}
      <OrbitControls makeDefault target={INITIAL_CAMERA.target} enableDamping minDistance={0.08} maxDistance={4} />
      <CameraRig focus={focus} focusKey={focusKey} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL.skin, MODEL_URL.draco);
useGLTF.preload(MODEL_URL.bones, MODEL_URL.draco);
