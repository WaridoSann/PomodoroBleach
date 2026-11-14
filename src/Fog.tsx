import { memo, useEffect, useRef, useState } from "react";

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 resolution;
uniform float time;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float sum = 0.0;
  float weight = 0.5;
  mat2 turn = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    sum += noise(p) * weight;
    p = turn * p + vec2(3.7, 1.9);
    weight *= 0.5;
  }
  return sum;
}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  // Leave the handle and timer clear. The moving volume hugs the ground.
  float heightFade = 1.0 - smoothstep(0.31, 0.57, uv.y);
  if (heightFade <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec2 p = vec2(uv.x * resolution.x / resolution.y, uv.y);
  float t = time;
  float warp = fbm(p * 2.3 + vec2(t * 0.014, -t * 0.009));
  vec2 flow = p * vec2(3.2, 5.4) + vec2(warp * 1.35, warp * 0.65);
  float farCloud = fbm(flow + vec2(-t * 0.038, t * 0.012));
  float nearCloud = fbm(p * vec2(5.2, 8.0) + vec2(t * 0.055, -t * 0.018) + farCloud);
  float groundHeight = 0.10 + 0.025 * sin(uv.x * 7.0 + t * 0.12);
  float ground = exp(-pow((uv.y - groundHeight) / 0.17, 2.0));
  float aroundBlade = exp(-pow((uv.x - 0.5) / 0.34, 2.0))
                    * exp(-pow((uv.y - 0.25) / 0.20, 2.0));
  float rolling = smoothstep(0.24, 0.76, farCloud);
  float wisps = pow(smoothstep(0.28, 0.78, nearCloud), 1.5);
  float density = (rolling * ground * 0.24 + wisps * aroundBlade * 0.21) * heightFade;
  // Neutral gray, not an additive glow: translucent layered water-vapor texture.
  gl_FragColor = vec4(vec3(0.63), density);
}
`;

/** Independent, noninteractive fog layer. No changes to the still background image. */
const Fog = memo(function Fog() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !("WebGLRenderingContext" in window)) return;
    let gl: WebGLRenderingContext | null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }
    if (!gl) return;

    const shaders: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let frame = 0;
    let lost = false;
    let disposed = false;
    let lastFrame = -1000;
    let elapsed = 0;
    let previousTime: number | null = null;
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let resize: ResizeObserver | undefined;
    const free = () => {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      shaders.forEach((shader) => gl.deleteShader(shader));
    };
    try {
      function compile(type: number, source: string) {
        const shader = gl!.createShader(type);
        if (!shader) throw new Error("Fog shader unavailable");
        shaders.push(shader);
        gl!.shaderSource(shader, source);
        gl!.compileShader(shader);
        if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS))
          throw new Error("Fog shader compilation failed");
        return shader;
      }
      const vertex = compile(gl.VERTEX_SHADER, VERTEX);
      const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
      program = gl.createProgram();
      if (!program) throw new Error("Fog program unavailable");
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error("Fog shader link failed");
      gl.useProgram(program);
      buffer = gl.createBuffer();
      if (!buffer) throw new Error("Fog geometry unavailable");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const resolution = gl.getUniformLocation(program, "resolution");
      const time = gl.getUniformLocation(program, "time");

      function draw() {
        if (disposed || lost) return;
        gl!.viewport(0, 0, canvas!.width, canvas!.height);
        gl!.uniform2f(resolution, canvas!.width, canvas!.height);
        gl!.uniform1f(time, elapsed);
        gl!.drawArrays(gl!.TRIANGLES, 0, 6);
      }
      function size() {
        const rect = canvas!.getBoundingClientRect();
        // Mist needs soft shapes, not a full-resolution GPU render on every device.
        const scale = Math.min(
          0.6,
          960 / Math.max(rect.width, 1),
          600 / Math.max(rect.height, 1),
        );
        canvas!.width = Math.max(1, Math.round(rect.width * scale));
        canvas!.height = Math.max(1, Math.round(rect.height * scale));
        draw();
      }
      function animate(timestamp: number) {
        if (disposed || lost || document.hidden || media?.matches) return;
        if (previousTime !== null)
          elapsed += Math.min((timestamp - previousTime) / 1000, 0.1);
        previousTime = timestamp;
        if (timestamp - lastFrame >= 1000 / 24) {
          draw();
          lastFrame = timestamp;
        }
        frame = requestAnimationFrame(animate);
      }
      function syncMotion() {
        cancelAnimationFrame(frame);
        previousTime = null;
        if (!document.hidden && !media?.matches && !lost)
          frame = requestAnimationFrame(animate);
      }
      const onLost = (event: Event) => {
        event.preventDefault();
        lost = true;
        cancelAnimationFrame(frame);
        setActive(false);
      };
      size();
      resize = new ResizeObserver(size);
      resize.observe(canvas);
      document.addEventListener("visibilitychange", syncMotion);
      media?.addEventListener("change", syncMotion);
      canvas.addEventListener("webglcontextlost", onLost);
      setActive(true);
      syncMotion();
      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        resize?.disconnect();
        document.removeEventListener("visibilitychange", syncMotion);
        media?.removeEventListener("change", syncMotion);
        canvas.removeEventListener("webglcontextlost", onLost);
        free();
      };
    } catch {
      // Keep the atmospheric CSS/image fallback if WebGL is restricted or unavailable.
      cancelAnimationFrame(frame);
      resize?.disconnect();
      free();
      return;
    }
  }, []);

  return (
    <div className={`mist ${active ? "mist-rendered" : ""}`} aria-hidden="true">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
});

export default Fog;
