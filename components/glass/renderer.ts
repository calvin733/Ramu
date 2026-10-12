/**
 * RAMU WebGL2 adaptation of shape masks and edge/rim refraction from
 * dashersw/liquid-glass-js (container.js/button.js), revision 78cb6cc.
 * Copyright (c) 2025 Armagan Amcalar, MIT. See LICENSE.liquid-glass-js.
 * DOM text is never sampled. Refraction uses a cached brand-atmosphere texture.
 */
import { acquireGlassSlot } from "./policy";

const vertex = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = (a_position + 1.0) * 0.5;
  v_uv.y = 1.0 - v_uv.y;
}`;

const fragment = `#version 300 es
precision mediump float;
uniform sampler2D u_scene;
uniform vec2 u_size;
uniform vec2 u_origin;
uniform vec2 u_extent;
uniform vec2 u_pointer;
uniform vec3 u_tint;
uniform float u_tintAmount;
uniform float u_radius;
out vec4 outputColor;
in vec2 v_uv;

// Rounded-rectangle SDF also represents a capsule when radius = height / 2.
float shapeDistance(vec2 pixel) {
  vec2 halfSize = u_size * 0.5;
  vec2 corner = abs(pixel - halfSize) - (halfSize - u_radius);
  return length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) - u_radius;
}
void main() {
  vec2 pixel = v_uv * u_size;
  float distance = shapeDistance(pixel);
  float depth = max(-distance, 0.0);
  vec2 gradient = vec2(
    shapeDistance(pixel + vec2(0.5, 0.0)) - shapeDistance(pixel - vec2(0.5, 0.0)),
    shapeDistance(pixel + vec2(0.0, 0.5)) - shapeDistance(pixel - vec2(0.0, 0.5))
  );
  vec2 normal = length(gradient) > 0.001 ? normalize(gradient) : vec2(0.0, 1.0);
  float edge = exp(-depth * 0.16);
  float rim = exp(-depth * 0.72);
  vec2 uv = u_origin + v_uv * u_extent;
  // Keep the center flat. Edge refraction and a restrained rim give depth.
  uv += normal * (edge * 0.009 + rim * 0.005);
  uv += (u_pointer - 0.5) * edge * 0.001;
  vec2 blur = vec2(1.0 / 512.0, 1.0 / 320.0) * 1.2;
  vec3 color = texture(u_scene, uv).rgb * 0.5;
  color += texture(u_scene, uv + vec2(blur.x, 0.0)).rgb * 0.125;
  color += texture(u_scene, uv - vec2(blur.x, 0.0)).rgb * 0.125;
  color += texture(u_scene, uv + vec2(0.0, blur.y)).rgb * 0.125;
  color += texture(u_scene, uv - vec2(0.0, blur.y)).rgb * 0.125;
  color = mix(color, u_tint, u_tintAmount);
  float highlight = max(dot(normal, normalize(vec2(-0.4, -1.0))), 0.0);
  color = mix(color, vec3(1.0), rim * highlight * 0.12);
  float mask = 1.0 - smoothstep(-0.75, 0.75, distance);
  outputColor = vec4(color * mask, mask);
}`;

let cachedScene: { key: string; canvas: HTMLCanvasElement } | null = null;
let softwareRenderer = false;
function sceneTexture(styles: CSSStyleDeclaration) {
  const base = styles.getPropertyValue("--ramu-bg").trim() || "#f2f5ef";
  const sage = styles.getPropertyValue("--ramu-sage").trim() || "#cedecc";
  const key = `${base}:${sage}`;
  if (cachedScene?.key === key) return cachedScene.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const context = canvas.getContext("2d", {
    willReadFrequently: true,
    alpha: false,
  });
  if (!context) throw new Error("Atmosphere canvas unavailable");
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (const [x, y, radius] of [
    [430, 30, 360],
    [70, 260, 260],
  ]) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, sage);
    gradient.addColorStop(1, base);
    context.globalAlpha = 0.58;
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  cachedScene = { key, canvas };
  return canvas;
}

export function createLiquidRenderer(
  layer: HTMLElement,
  tone: "sage" | "green",
  onFailure: () => void,
) {
  if (softwareRenderer) return null;
  const parent = layer.parentElement;
  if (!parent) return null;
  const host = parent;
  const release = acquireGlassSlot();
  if (!release) return null;
  const canvas = document.createElement("canvas");
  canvas.className = "liquid-canvas";
  canvas.setAttribute("aria-hidden", "true");
  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let texture: WebGLTexture | null = null;
  let resize: ResizeObserver | null = null;
  const shaders: WebGLShader[] = [];
  let frame: number | null = null,
    disposed = false;
  let pointer = [0.5, 0.5];
  let draw: () => void = () => {};
  function schedule() {
    if (disposed || frame !== null || document.hidden) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (disposed || document.hidden) return;
      try {
        draw();
      } catch {
        dispose();
        onFailure();
      }
    });
  }
  function move(event: PointerEvent) {
    const rect = host.getBoundingClientRect();
    pointer = [
      (event.clientX - rect.left) / Math.max(rect.width, 1),
      (event.clientY - rect.top) / Math.max(rect.height, 1),
    ];
    schedule();
  }
  function leave() {
    pointer = [0.5, 0.5];
    schedule();
  }
  function lost(event: Event) {
    event.preventDefault();
    dispose();
    onFailure();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame !== null) cancelAnimationFrame(frame);
    resize?.disconnect();
    window.removeEventListener("scroll", schedule, true);
    window.removeEventListener("resize", schedule);
    host.removeEventListener("pointermove", move);
    host.removeEventListener("pointerleave", leave);
    canvas.removeEventListener("webglcontextlost", lost);
    try {
      if (gl) {
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        shaders.forEach((shader) => gl!.deleteShader(shader));
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    } catch {
      // An already-lost GPU context must not interrupt unmount or fallback.
    } finally {
      canvas.remove();
      release!();
    }
  }
  try {
    gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
      failIfMajorPerformanceCaveat: true,
    });
    if (!gl) {
      dispose();
      return null;
    }
    // Some browsers expose software WebGL despite the performance-caveat flag.
    // Probe once; keep CSS glass for the session instead of compiling on the CPU.
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      : "";
    if (/swiftshader|llvmpipe|softpipe|software rasterizer/i.test(gpu)) {
      softwareRenderer = true;
      dispose();
      return null;
    }
    function compile(type: number, source: string) {
      const shader = gl!.createShader(type);
      if (!shader) throw new Error("Shader unavailable");
      shaders.push(shader);
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS))
        throw new Error("Shader compilation failed");
      return shader;
    }
    program = gl.createProgram();
    if (!program) throw new Error("Program unavailable");
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Program linking failed");
    gl.useProgram(program);
    buffer = gl.createBuffer();
    texture = gl.createTexture();
    if (!buffer || !texture) throw new Error("GPU resources unavailable");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniform = Object.fromEntries(
      [
        "u_size",
        "u_radius",
        "u_origin",
        "u_extent",
        "u_pointer",
        "u_scene",
        "u_tint",
        "u_tintAmount",
      ].map((name) => [name, gl!.getUniformLocation(program!, name)]),
    );
    const styles = getComputedStyle(document.documentElement);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      sceneTexture(styles),
    );
    gl.uniform1i(uniform.u_scene, 0);
    const green =
      styles
        .getPropertyValue("--ramu-green")
        .trim()
        .match(/^#([\da-f]{6})$/i)?.[1] ?? "285d47";
    const tint =
      tone === "green"
        ? [0, 2, 4].map((i) => parseInt(green.slice(i, i + 2), 16) / 255)
        : [0.97, 0.985, 0.96];
    gl.uniform3f(uniform.u_tint, tint[0], tint[1], tint[2]);
    gl.uniform1f(uniform.u_tintAmount, tone === "green" ? 0.94 : 0.62);
    draw = () => {
      if (gl!.isContextLost()) throw new Error("Context lost");
      const rect = host.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      // DPR and pixel budget limit fill cost even for a large chat composer.
      const scale = Math.min(
        window.devicePixelRatio || 1,
        1.5,
        Math.sqrt(160000 / (rect.width * rect.height)),
      );
      const width = Math.max(1, Math.min(2048, Math.round(rect.width * scale)));
      const height = Math.max(
        1,
        Math.min(1024, Math.round(rect.height * scale)),
      );
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl!.viewport(0, 0, width, height);
      gl!.uniform2f(uniform.u_size, rect.width, rect.height);
      const radius =
        parseFloat(getComputedStyle(host).borderTopLeftRadius) || 24;
      gl!.uniform1f(
        uniform.u_radius,
        Math.min(radius, rect.width / 2, rect.height / 2),
      );
      gl!.uniform2f(
        uniform.u_origin,
        rect.left / innerWidth,
        rect.top / innerHeight,
      );
      gl!.uniform2f(
        uniform.u_extent,
        rect.width / innerWidth,
        rect.height / innerHeight,
      );
      gl!.uniform2f(uniform.u_pointer, pointer[0], pointer[1]);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    };
    layer.appendChild(canvas);
    draw();
    resize = new ResizeObserver(schedule);
    resize.observe(host);
    window.addEventListener("scroll", schedule, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", schedule, { passive: true });
    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerleave", leave, { passive: true });
    canvas.addEventListener("webglcontextlost", lost);
    return { dispose };
  } catch {
    dispose();
    return null;
  }
}
