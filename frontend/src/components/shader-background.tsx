'use client';

import { useEffect, useRef } from 'react';

/**
 * ShaderBackground — full-viewport WebGL fragment shader.
 * Renders a flowing, bioluminescent snake-scale / particle field in the
 * NagRaksha dark palette (deep forest → gold). This is the "illustration
 * shader" layer; it sits behind all content and reacts subtly to scroll
 * velocity for a sense of living depth without decorative parallax bounce.
 */
const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_scroll;   // 0..1
uniform float u_vel;      // scroll velocity px/tick

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

// snake-scale hex-ish field
float scales(vec2 uv, float t){
  uv *= vec2(18.0, 22.0);
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  float n = hash(i);
  // scale shimmer
  float s = sin((f.x + f.y) * 3.14159 + n * 6.2831 + t * 0.6);
  s = smoothstep(0.55, 0.95, s);
  return s;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;

  float t = u_time * 0.05;
  // flowing warp
  vec2 q = p + vec2(fbm(p * 1.5 + t), fbm(p * 1.5 - t * 1.3)) * 0.18;
  float flow = fbm(q * 1.2 + vec2(0.0, -u_scroll * 1.4));

  // base forest gradient (deep)
  vec3 deep   = vec3(0.039, 0.094, 0.071);   // #0A1812
  vec3 forest = vec3(0.094, 0.302, 0.212);   // #184D36
  vec3 base = mix(deep, forest, smoothstep(0.0, 1.0, flow));

  // gold vein (antivenom) flowing like a serpent curve
  float curve = sin(p.x * 3.2 + flow * 6.0 + u_scroll * 4.0) * 0.5 + 0.5;
  float vein  = smoothstep(0.86, 0.99, curve * (0.6 + 0.4 * flow));
  vec3 gold = vec3(0.84, 0.62, 0.18); // #D69E2E
  base += vein * gold * 0.28;

  // scales overlay, density rises with scroll
  float sc = scales(p + vec2(0.0, -u_scroll * 2.0), u_time);
  base += sc * gold * (0.05 + 0.06 * u_scroll);

  // floating spores (particles)
  float sp = 0.0;
  for(int i=0;i<6;i++){
    float fi = float(i);
    vec2 c = vec2(hash(vec2(fi, 1.0)) * u_res.x / u_res.y, fract(u_time * 0.02 + fi * 0.17 - u_scroll * 0.4));
    float d = distance(p, c);
    sp += smoothstep(0.012, 0.0, d) * 0.6;
  }
  base += sp * vec3(0.18, 0.71, 0.45);

  // subtle vignette
  float vig = smoothstep(1.2, 0.2, length(uv - 0.5) * 1.7);
  base *= 0.85 + 0.15 * vig;

  // scroll-velocity pulse
  base += vec3(0.05, 0.12, 0.08) * clamp(u_vel * 0.002, 0.0, 0.25);

  gl_FragColor = vec4(base, 1.0);
}
`;

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scroll = useRef(0);
  const targetScroll = useRef(0);
  const vel = useRef(0);
  const lastY = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uScroll = gl.getUniformLocation(prog, 'u_scroll');
    const uVel = gl.getUniformLocation(prog, 'u_vel');

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();

    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      targetScroll.current = max > 0 ? h.scrollTop / max : 0;
      const v = h.scrollTop - lastY.current;
      lastY.current = h.scrollTop;
      vel.current = v;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);

    let raf = 0;
    const start = performance.now();
    const render = (now: number) => {
      scroll.current += (targetScroll.current - scroll.current) * 0.08;
      vel.current *= 0.9;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform1f(uScroll, scroll.current);
      gl.uniform1f(uVel, vel.current);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
