import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Mood } from "../../lib/scan";

/** Reads an "r g b" CSS custom property into a THREE.Color. */
function cssColor(name: string): THREE.Color {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "79 240 210";
  const [r, g, b] = raw.split(/\s+/).map(Number);
  return new THREE.Color(r / 255, g / 255, b / 255);
}

const N = 1600;

function SonarGlobe({ mood }: { mood: Mood }) {
  const group = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Mesh[]>([]);
  const { pointer } = useThree();
  const [palette, setPalette] = useState(() => ({ a: cssColor("--biolume"), b: cssColor("--lure"), c: cssColor("--kelp") }));

  useEffect(() => {
    const obs = new MutationObserver(() => setPalette({ a: cssColor("--biolume"), b: cssColor("--lure"), c: cssColor("--kelp") }));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  // Fibonacci sphere: evenly spread "nodes" of the web; ~4% are lure-coloured threats.
  const { positions, threat, lines } = useMemo(() => {
    const pos = new Float32Array(N * 3);
    const thr = new Uint8Array(N);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = golden * i;
      const jitter = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.04;
      pos.set([Math.cos(t) * r * 2 * jitter, y * 2 * jitter, Math.sin(t) * r * 2 * jitter], i * 3);
      thr[i] = (i * 7919) % 25 === 0 ? 1 : 0;
    }
    const seg: number[] = [];
    for (let i = 0; i < N; i += 4) {
      const j = (i + 21) % N;
      const a = new THREE.Vector3(...pos.slice(i * 3, i * 3 + 3));
      const b = new THREE.Vector3(...pos.slice(j * 3, j * 3 + 3));
      if (a.distanceTo(b) < 0.55) seg.push(...a.toArray(), ...b.toArray());
    }
    return { positions: pos, threat: thr, lines: new Float32Array(seg) };
  }, []);

  const colors = useMemo(() => {
    const col = new Float32Array(N * 3);
    const hot = mood === "phishing" ? palette.b : mood === "suspicious" ? palette.c : palette.b;
    for (let i = 0; i < N; i++) {
      const c = threat[i] || mood === "phishing" && i % 3 === 0 ? hot : palette.a;
      col.set([c.r, c.g, c.b], i * 3);
    }
    return col;
  }, [mood, palette, threat]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const speed = mood === "scanning" ? 0.9 : 0.12;
    g.rotation.y += dt * speed;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, pointer.y * 0.25, 0.05);
    g.position.x = THREE.MathUtils.lerp(g.position.x, pointer.x * 0.25, 0.05);
    const t = state.clock.elapsedTime;
    rings.current.forEach((m, k) => {
      if (!m) return;
      const period = mood === "scanning" ? 1.4 : 4;
      const p = ((t + k * (period / 3)) % period) / period;
      const s = 0.6 + p * 2.6;
      m.scale.setScalar(s);
      (m.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.45;
    });
  });

  const ringColor = mood === "phishing" ? palette.b : mood === "suspicious" ? palette.c : palette.a;

  return (
    <>
      <group ref={group}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.035} vertexColors transparent opacity={0.9} sizeAttenuation depthWrite={false} />
        </points>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[lines, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={palette.a} transparent opacity={0.18} />
        </lineSegments>
      </group>
      {[0, 1, 2].map((k) => (
        <mesh key={k} ref={(m) => { if (m) rings.current[k] = m; }} rotation={[Math.PI / 2.2, 0, 0]}>
          <ringGeometry args={[0.98, 1, 96]} />
          <meshBasicMaterial color={ringColor} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

export default function HeroScene({ mood }: { mood: Mood }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={wrap} className="absolute inset-0" aria-hidden="true">
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 6.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <SonarGlobe mood={mood} />
      </Canvas>
    </div>
  );
}
