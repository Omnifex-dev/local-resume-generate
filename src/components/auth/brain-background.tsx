"use client";

import { useEffect, useRef } from "react";
import { useColorMode } from "@/components/theme/color-mode";
import type { ColorMode } from "@/lib/color-mode";

/*
 * "Living brain": a slowly turning 3D neural network shaped like a brain, drawn
 * on a 2D canvas (no WebGL or extra packages). Signals travel along the
 * connections and set off chain reactions, so the network keeps "thinking".
 * Respects prefers-reduced-motion (one still frame) and follows the pointer a little.
 * Dark mode glows (additive blending); light mode draws deeper colours normally,
 * because additive light disappears on a light background.
 */

type Palette = {
  stops: [string, string, string];
  composite: GlobalCompositeOperation;
  halo: (breath: number) => [string, string];
  glowCyan: string;
  glowPink: string;
  glowCore: string;
  pulseCyan: string;
  pulsePink: string;
  dust: string;
  /** Multiplies line/node alpha. */
  strength: number;
};

const PALETTES: Record<ColorMode, Palette> = {
  dark: {
    stops: ["#22d3ee", "#818cf8", "#e879f9"],
    composite: "lighter",
    halo: (b) => [`rgba(99,102,241,${0.17 + b * 0.05})`, "rgba(34,211,238,0.06)"],
    glowCyan: "103,232,249",
    glowPink: "232,121,249",
    glowCore: "255,255,255",
    pulseCyan: "#a5f3fc",
    pulsePink: "#f0abfc",
    dust: "#c7d2fe",
    strength: 1,
  },
  light: {
    stops: ["#0891b2", "#4f46e5", "#c026d3"],
    composite: "source-over",
    halo: (b) => [`rgba(129,140,248,${0.16 + b * 0.05})`, "rgba(103,232,249,0.08)"],
    glowCyan: "6,182,212",
    glowPink: "217,70,239",
    glowCore: "236,254,255",
    pulseCyan: "#0e7490",
    pulsePink: "#a21caf",
    dust: "#818cf8",
    strength: 1.15,
  },
};

/** "auth": upper left beside the sign-in form; "center": centred behind the workspace. */
export type BrainPlacement = "auth" | "center";

type Brain = { pos: Float32Array; count: number; edges: Uint16Array; adj: number[][] };
type Pulse = { from: number; to: number; t: number; speed: number; pink: boolean };

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const CAMERA = 3.6;
const MAX_PULSES = 260;

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Evenly spread direction i of n on the unit sphere. */
function fibonacci(i: number, n: number): [number, number, number] {
  const y = 1 - ((i + 0.5) / n) * 2;
  const r = Math.sqrt(1 - y * y);
  const t = GOLDEN * i;
  return [Math.cos(t) * r, y, Math.sin(t) * r];
}

/** A bumpy radius gives the cortex its folds. */
const folds = (x: number, y: number, z: number) =>
  0.06 * Math.sin(x * 9 + y * 4 + Math.sin(z * 6) * 1.6) * Math.sin(y * 8 - z * 7 + Math.sin(x * 5)) +
  0.03 * Math.sin(z * 13 + y * 3);

function buildBrain(): Brain {
  const rand = mulberry32(20261111);
  const p: number[] = [];
  const push = (x: number, y: number, z: number) => p.push(x, y + 0.15, z);

  for (const side of [-1, 1]) {
    // Hemisphere: x = left/right, y = up, z = front/back.
    const n = 620;
    for (let i = 0; i < n; i++) {
      const [dx, dy, dz] = fibonacci(i, n);
      const r = 1 + folds(dx * side, dy, dz);
      let x = dx * 0.6 * r;
      let y = dy * 0.68 * r;
      const z = dz * r;
      const outer = dx * side > 0;
      if (!outer) x *= 0.32; // flat inner wall leaves the fissure between hemispheres
      if (y < -0.22) y = -0.22 + (y + 0.22) * 0.55; // flatter underside
      // Temporal lobe: the lower middle bulges out and down.
      const temporal = Math.max(0, -dy - 0.1) * Math.max(0, 1 - Math.abs(dz - 0.15) * 1.6);
      if (outer) x += side * temporal * 0.12;
      y -= temporal * 0.12;
      push(side * 0.27 + x, y + 0.08, z);
    }
    // Cerebellum, with fine horizontal ridges.
    for (let i = 0; i < 120; i++) {
      const [dx, dy, dz] = fibonacci(i, 120);
      const r = 1 + 0.05 * Math.sin(dy * 30);
      push(side * 0.24 + dx * 0.3 * r, -0.5 + dy * 0.2 * r, -0.62 + dz * 0.3 * r);
    }
  }
  // Brain stem.
  for (let i = 0; i < 70; i++) {
    const t = i / 70;
    const a = GOLDEN * i * 3;
    push(Math.cos(a) * 0.12, -0.35 - t * 0.75, -0.28 - t * 0.18 + Math.sin(a) * 0.1);
  }
  // A few deep nodes for depth.
  for (let i = 0; i < 150; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    const [dx, dy, dz] = fibonacci(Math.floor(rand() * 1000), 1000);
    const s = 0.25 + rand() * 0.45;
    push(side * 0.3 + dx * 0.5 * s, 0.08 + dy * 0.55 * s, dz * 0.9 * s);
  }

  const pos = Float32Array.from(p);
  const count = pos.length / 3;
  const adj: number[][] = Array.from({ length: count }, () => []);
  const edges: number[] = [];
  const seen = new Set<number>();
  const K = 3;
  const MAX_D2 = 0.3 * 0.3;

  // Connect each node to its K nearest neighbours.
  for (let i = 0; i < count; i++) {
    const best: { d: number; j: number }[] = [];
    const xi = pos[i * 3]!, yi = pos[i * 3 + 1]!, zi = pos[i * 3 + 2]!;
    for (let j = 0; j < count; j++) {
      if (j === i) continue;
      const dx = pos[j * 3]! - xi, dy = pos[j * 3 + 1]! - yi, dz = pos[j * 3 + 2]! - zi;
      const d = dx * dx + dy * dy + dz * dz;
      if (d > MAX_D2 || (best.length === K && d >= best[K - 1]!.d)) continue;
      best.push({ d, j });
      best.sort((a, b) => a.d - b.d);
      if (best.length > K) best.pop();
    }
    for (const { j } of best) {
      const key = Math.min(i, j) * 65536 + Math.max(i, j);
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(i, j);
      adj[i]!.push(j);
      adj[j]!.push(i);
    }
  }
  return { pos, count, edges: Uint16Array.from(edges), adj };
}

/** Soft round glow, pre-rendered once and stamped with drawImage. */
function glowSprite(rgb: string, core: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${core},1)`);
  grad.addColorStop(0.18, `rgba(${rgb},0.9)`);
  grad.addColorStop(0.5, `rgba(${rgb},0.22)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function BrainBackground({ className, placement = "auth" }: { className?: string; placement?: BrainPlacement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mode = useColorMode();
  const modeRef = useRef(mode);
  // Set by the effect below: re-applies colours without rebuilding the brain.
  const restyleRef = useRef<() => void>(() => {});

  useEffect(() => {
    modeRef.current = mode;
    restyleRef.current();
  }, [mode]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { pos, count, edges, adj } = buildBrain();
    const edgeCount = edges.length / 2;
    const sx = new Float32Array(count);
    const sy = new Float32Array(count);
    const depth = new Float32Array(count);
    const energy = new Float32Array(count);
    const rand = Math.random;

    // Floating dust around the brain.
    const DUST = 110;
    const dust = new Float32Array(DUST * 4);
    for (let i = 0; i < DUST; i++) {
      const [dx, dy, dz] = fibonacci(i, DUST);
      const r = 1.35 + rand() * 1.3;
      dust.set([dx * r * 1.3, dy * r * 0.9, dz * r, rand() * TAU], i * 4);
    }

    let pal = PALETTES[modeRef.current];
    let glowCyan = glowSprite(pal.glowCyan, pal.glowCore);
    let glowPink = glowSprite(pal.glowPink, pal.glowCore);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let dpr = 1, cx = 0, cy = 0, scale = 0, unit = 1;
    let lineGrad: CanvasGradient | string = "#67e8f9";
    let pulses: Pulse[] = [];
    let rotation = 0.6, spawnDebt = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.max(1, Math.round(rect.width * dpr));
      canvas!.height = Math.max(1, Math.round(rect.height * dpr));
      const w = rect.width, h = rect.height;
      // Wide screens: upper left, above the headline and clear of the form.
      // Narrow: centred behind the form (which is opaque).
      const wide = w >= 1024;
      const centered = placement === "center";
      cx = (wide && !centered ? w * 0.31 : w * 0.5) * dpr;
      cy = (centered ? h * 0.52 : wide ? h * 0.47 : h * 0.4) * dpr;
      // The top of the brain reaches ~1.1 × scale above the centre, so h × 0.36 always fits.
      const cssScale = centered
        ? Math.min(w * (wide ? 0.24 : 0.42), h * 0.36)
        : wide
          ? Math.min(w * 0.26, h * 0.36)
          : Math.min(w * 0.5, h * 0.33);
      scale = cssScale * dpr;
      unit = dpr * Math.min(1.4, Math.max(0.7, cssScale / 260));
      const g = ctx!.createLinearGradient(cx - scale * 1.1, cy - scale * 0.8, cx + scale * 1.1, cy + scale * 0.8);
      g.addColorStop(0, pal.stops[0]);
      g.addColorStop(0.5, pal.stops[1]);
      g.addColorStop(1, pal.stops[2]);
      lineGrad = g;
      if (reduceMotion) draw(performance.now());
    }

    function fire(from: number, to: number) {
      if (pulses.length >= MAX_PULSES) return;
      pulses.push({ from, to, t: 0, speed: 1 / (450 + rand() * 550), pink: rand() < 0.3 });
    }

    function fireFromRandomNode() {
      const a = Math.floor(rand() * count);
      const nb = adj[a]!;
      if (nb.length) fire(a, nb[Math.floor(rand() * nb.length)]!);
    }

    function step(dt: number) {
      rotation += dt * 0.00011;
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 0.003);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 0.003);

      spawnDebt += dt * 0.028;
      while (spawnDebt >= 1) {
        spawnDebt -= 1;
        fireFromRandomNode();
      }

      const next: Pulse[] = [];
      for (const p of pulses) {
        p.t += dt * p.speed;
        if (p.t < 1) {
          next.push(p);
          continue;
        }
        // Arrived: the node lights up and may pass the signal on.
        energy[p.to] = 1;
        const nb = adj[p.to]!.filter((n) => n !== p.from);
        if (!nb.length) continue;
        const branches = rand() < 0.62 ? (rand() < 0.15 ? 2 : 1) : 0;
        for (let b = 0; b < branches && next.length < MAX_PULSES; b++) {
          next.push({ from: p.to, to: nb[Math.floor(rand() * nb.length)]!, t: 0, speed: p.speed, pink: p.pink });
        }
      }
      pulses = next;

      const decay = Math.pow(0.05, dt / 1000);
      for (let i = 0; i < count; i++) if (energy[i]! > 0.01) energy[i] = energy[i]! * decay;
    }

    function draw(now: number) {
      const W = canvas!.width, H = canvas!.height;
      ctx!.globalCompositeOperation = "source-over";
      ctx!.globalAlpha = 1;
      ctx!.clearRect(0, 0, W, H);

      // Breathing halo behind the brain.
      const breath = 0.5 + 0.5 * Math.sin(now * 0.0011);
      const halo = ctx!.createRadialGradient(cx, cy, 0, cx, cy, scale * (1.9 + breath * 0.12));
      const [haloIn, haloMid] = pal.halo(breath);
      halo.addColorStop(0, haloIn);
      halo.addColorStop(0.45, haloMid);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = halo;
      ctx!.fillRect(0, 0, W, H);

      // Project the nodes.
      const ry = rotation + pointer.x * 0.45;
      const rx = -0.2 + pointer.y * 0.22;
      const cY = Math.cos(ry), sY = Math.sin(ry), cX = Math.cos(rx), sX = Math.sin(rx);
      const pulse = 1 + 0.012 * Math.sin(now * 0.0011);
      for (let i = 0; i < count; i++) {
        const x = pos[i * 3]! * pulse, y = pos[i * 3 + 1]! * pulse, z = pos[i * 3 + 2]! * pulse;
        const x1 = x * cY - z * sY;
        const z1 = x * sY + z * cY;
        const y1 = y * cX - z1 * sX;
        const z2 = y * sX + z1 * cX;
        const f = CAMERA / (CAMERA - z2);
        sx[i] = cx + x1 * f * scale;
        sy[i] = cy - y1 * f * scale;
        depth[i] = clamp01((z2 + 1.1) / 2.2);
      }

      ctx!.globalCompositeOperation = pal.composite;

      // Connections, grouped by depth so far ones are fainter.
      const BUCKETS = 4;
      const linePaths = Array.from({ length: BUCKETS }, () => new Path2D());
      for (let e = 0; e < edgeCount; e++) {
        const a = edges[e * 2]!, b = edges[e * 2 + 1]!;
        const d = (depth[a]! + depth[b]!) / 2;
        const path = linePaths[Math.min(BUCKETS - 1, Math.floor(d * BUCKETS))]!;
        path.moveTo(sx[a]!, sy[a]!);
        path.lineTo(sx[b]!, sy[b]!);
      }
      ctx!.strokeStyle = lineGrad;
      ctx!.lineWidth = 0.7 * unit;
      const lineAlpha = [0.05, 0.09, 0.15, 0.24];
      linePaths.forEach((path, b) => {
        ctx!.globalAlpha = Math.min(1, lineAlpha[b]! * pal.strength);
        ctx!.stroke(path);
      });

      // Nodes.
      const nodePaths = Array.from({ length: BUCKETS }, () => new Path2D());
      for (let i = 0; i < count; i++) {
        const d = depth[i]!;
        const r = (0.5 + d) * unit;
        const path = nodePaths[Math.min(BUCKETS - 1, Math.floor(d * BUCKETS))]!;
        path.moveTo(sx[i]! + r, sy[i]!);
        path.arc(sx[i]!, sy[i]!, r, 0, TAU);
      }
      ctx!.fillStyle = lineGrad;
      const nodeAlpha = [0.25, 0.4, 0.6, 0.9];
      nodePaths.forEach((path, b) => {
        ctx!.globalAlpha = Math.min(1, nodeAlpha[b]! * pal.strength);
        ctx!.fill(path);
      });

      // Nodes that just received a signal.
      for (let i = 0; i < count; i++) {
        const en = energy[i]!;
        if (en < 0.03) continue;
        const s = (10 + 26 * en) * unit * (0.6 + 0.6 * depth[i]!);
        ctx!.globalAlpha = en;
        ctx!.drawImage(glowCyan, sx[i]! - s / 2, sy[i]! - s / 2, s, s);
      }

      // Signals travelling along the connections.
      ctx!.lineWidth = 1.4 * unit;
      for (const p of pulses) {
        const ax = sx[p.from]!, ay = sy[p.from]!, bx = sx[p.to]!, by = sy[p.to]!;
        const hx = ax + (bx - ax) * p.t, hy = ay + (by - ay) * p.t;
        const tail = Math.max(0, p.t - 0.4);
        const d = (depth[p.from]! + depth[p.to]!) / 2;
        ctx!.globalAlpha = 0.25 + 0.55 * d;
        ctx!.strokeStyle = p.pink ? pal.pulsePink : pal.pulseCyan;
        ctx!.beginPath();
        ctx!.moveTo(ax + (bx - ax) * tail, ay + (by - ay) * tail);
        ctx!.lineTo(hx, hy);
        ctx!.stroke();
        const s = 14 * unit * (0.6 + 0.7 * d);
        ctx!.drawImage(p.pink ? glowPink : glowCyan, hx - s / 2, hy - s / 2, s, s);
      }

      // Dust, turning more slowly than the brain.
      const dr = rotation * 0.4 + pointer.x * 0.2;
      const dc = Math.cos(dr), ds = Math.sin(dr);
      ctx!.fillStyle = pal.dust;
      for (let i = 0; i < DUST; i++) {
        const x = dust[i * 4]!, y = dust[i * 4 + 1]!, z = dust[i * 4 + 2]!, ph = dust[i * 4 + 3]!;
        const x1 = x * dc - z * ds;
        const z1 = x * ds + z * dc;
        const f = CAMERA / (CAMERA - z1 * 0.6);
        const twinkle = 0.5 + 0.5 * Math.sin(now * 0.0015 + ph);
        ctx!.globalAlpha = (0.12 + 0.35 * twinkle) * clamp01((z1 + 2.6) / 4);
        const r = (0.6 + 0.8 * twinkle) * unit;
        ctx!.beginPath();
        ctx!.arc(cx + x1 * f * scale, cy - (y + Math.sin(now * 0.0004 + ph) * 0.05) * f * scale, r, 0, TAU);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
    }

    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };

    restyleRef.current = () => {
      pal = PALETTES[modeRef.current];
      glowCyan = glowSprite(pal.glowCyan, pal.glowCore);
      glowPink = glowSprite(pal.glowPink, pal.glowCore);
      resize(); // rebuilds the line gradient (and redraws the still frame)
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let raf = 0;
    if (reduceMotion) {
      // One still frame with some activity, redrawn on resize.
      for (let i = 0; i < 60; i++) fireFromRandomNode();
      for (let i = 0; i < 40; i++) step(16);
      resize();
    } else {
      window.addEventListener("pointermove", onPointer, { passive: true });
      let last = performance.now();
      const frame = (now: number) => {
        const dt = Math.min(50, now - last); // tab switches don't cause a jump
        last = now;
        step(dt);
        draw(now);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointer);
      restyleRef.current = () => {};
    };
  }, [placement]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
