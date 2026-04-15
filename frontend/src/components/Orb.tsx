/**
 * Animated WebGL orb — hero background for the Home page.
 *
 * Signature visual: a morphing, glowing sphere rendered by a single
 * fragment shader. Custom colour palette to match our brand (acid lime
 * with amber highlights) — not the default reactbits gradient.
 *
 * Kept contained: only mounts on Home's hero, never over gameplay.
 * Respects prefers-reduced-motion.
 */
import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle, Vec3 } from "ogl";

interface OrbProps {
  /** Acid lime by default; override for accent variants. */
  hue?: [number, number, number];
  /** Secondary glow colour. */
  hue2?: [number, number, number];
  /** 0..1 — visual intensity of the effect. */
  intensity?: number;
  className?: string;
}

// --- shaders ---
const VERT = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/**
 * A raymarched 3D noise orb. Compact — everything expressible in a
 * single pass with simnoise + a smooth-minimum sphere SDF.
 */
const FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uIntensity;

varying vec2 vUv;

// --- simplex-ish noise ---
vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289v(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289v(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m*m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uResolution.x / uResolution.y;

  float t = uTime * 0.12;
  // distance from centre with gentle breathing
  float r = length(uv) - 0.02 * sin(t * 2.0);

  // 3D noise field threaded through the UV — warps the orb surface
  vec3 p = vec3(uv * 1.35, t);
  float n = snoise(p * 1.2) * 0.5 + 0.5;
  n = mix(n, snoise(p * 2.7 + 10.0) * 0.5 + 0.5, 0.5);

  // soft orb mask
  float orb = smoothstep(0.95, 0.15, r);
  orb *= 0.55 + 0.45 * n;

  // core glow
  float core = smoothstep(0.65, 0.0, r);
  vec3 col = mix(uColor, uColor2, n);
  vec3 rgb = col * orb * uIntensity;
  rgb += uColor * core * 0.35 * uIntensity;

  // subtle vignette so edges fade into page bg
  float vignette = smoothstep(1.6, 0.3, length(uv));
  rgb *= vignette;

  gl_FragColor = vec4(rgb, orb * 0.9);
}
`;

export default function Orb({
  hue = [0.72, 1.0, 0.23], // accent lime #B8FF3B
  hue2 = [0.96, 0.72, 0.23], // honey amber #F6B93B
  intensity = 1.0,
  className,
}: OrbProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new Renderer({
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      dpr: Math.min(window.devicePixelRatio, 2),
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    mount.appendChild(gl.canvas);
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    gl.canvas.style.display = "block";

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [mount.clientWidth, mount.clientHeight] },
        uColor: { value: new Vec3(...hue) },
        uColor2: { value: new Vec3(...hue2) },
        uIntensity: { value: intensity },
      },
      transparent: true,
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      program.uniforms.uResolution.value = [w, h];
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const now = performance.now();
      program.uniforms.uTime.value = reduced ? 0 : (now - start) / 1000;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mount.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [hue, hue2, intensity]);

  return <div ref={mountRef} className={className} aria-hidden />;
}
