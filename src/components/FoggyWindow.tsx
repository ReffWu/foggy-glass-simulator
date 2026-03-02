import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

export interface FoggySettings {
  blurAmount: number;
  brushSize: number;
  dripSpeed: number;
}

export interface FoggyWindowHandle {
  resetFog: () => void;
  exportImage: () => void;
}

interface FoggyWindowProps {
  imageUrl: string;
  settings: FoggySettings;
}

interface Drip {
  x: number;
  y: number;
  speed: number;
  volume: number;
  width: number;
  wiggle: number;
}

// --- Shader Source ---
const VERTEX_SHADER = `
  attribute vec2 position;
  varying vec2 v_uv;
  void main() {
    v_uv = position * 0.5 + 0.5;
    v_uv.y = 1.0 - v_uv.y;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_clearBg;
  uniform sampler2D u_mask;
  uniform float u_fogDensity;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_imgSize;

  // Manual fit calculation to avoid stretching
  vec2 get_fitted_uv() {
    float canvasAspect = u_resolution.x / u_resolution.y;
    float imgAspect = u_imgSize.x / u_imgSize.y;
    vec2 fitted_uv = v_uv;
    
    if (imgAspect > canvasAspect) {
      float scale = canvasAspect / imgAspect;
      fitted_uv.x = v_uv.x * scale + (1.0 - scale) * 0.5;
    } else {
      float scale = imgAspect / canvasAspect;
      fitted_uv.y = v_uv.y * scale + (1.0 - scale) * 0.5;
    }
    return fitted_uv;
  }

  void main() {
    vec2 fitted_uv = get_fitted_uv();
    
    // 1. Sample the mask
    float mask = texture2D(u_mask, v_uv).a;
    
    // 2. Generate Normals from mask for Refraction
    float texelSize = 1.0 / max(u_resolution.x, u_resolution.y);
    float m_left  = texture2D(u_mask, v_uv + vec2(-texelSize, 0.0)).a;
    float m_right = texture2D(u_mask, v_uv + vec2(texelSize, 0.0)).a;
    float m_up    = texture2D(u_mask, v_uv + vec2(0.0, -texelSize)).a;
    float m_down  = texture2D(u_mask, v_uv + vec2(0.0, texelSize)).a;
    vec2 normal = vec2(m_left - m_right, m_up - m_down);
    
    // 3. Distortion/Refraction calculation
    vec2 distorted_uv = fitted_uv + normal * 0.015;
    
    // 4. Layers
    vec4 clearColor = texture2D(u_clearBg, distorted_uv);
    
    // Improved Multi-tap Gaussian Blur to avoid ghosting
    // We use a broader distribution with smaller steps
    vec4 blurColor = vec4(0.0);
    float blurRadius = 0.015; // Controlled radius
    
    // 13-tap jittered sampling for smooth dispersion
    blurColor += texture2D(u_clearBg, distorted_uv) * 0.15;
    blurColor += texture2D(u_clearBg, distorted_uv + vec2(blurRadius * 0.4, blurRadius * 0.7)) * 0.12;
    blurColor += texture2D(u_clearBg, distorted_uv + vec2(-blurRadius * 0.4, -blurRadius * 0.7)) * 0.12;
    blurColor += texture2D(u_clearBg, distorted_uv + vec2(blurRadius * 0.7, -blurRadius * 0.4)) * 0.12;
    blurColor += texture2D(u_clearBg, distorted_uv + vec2(-blurRadius * 0.7, blurRadius * 0.4)) * 0.12;
    blurColor += texture2D(u_clearBg, distorted_uv + vec2(0.0, blurRadius)) * 0.09;
    blurColor += texture2D(u_clearBg, distorted_uv + vec2(0.0, -blurRadius)) * 0.09;
    blurColor += texture2D(u_clearBg, distorted_uv + vec2(blurRadius, 0.0)) * 0.09;
    blurColor += texture2D(u_clearBg, distorted_uv + vec2(-blurRadius, 0.0)) * 0.09;
    
    // Normalize color
    blurColor = blurColor / (0.15 + 0.12 * 4.0 + 0.09 * 4.0);
    
    // 5. Fog Layer (Smooth, no procedural noise)
    vec4 fogTint = vec4(0.92, 0.96, 1.0, 1.0); // Slightly cool white
    float fogAlpha = 0.3 + u_fogDensity * 0.6;
    vec4 compositeFog = mix(blurColor, fogTint, fogAlpha);
    
    // 6. Final mix based on mask
    vec4 finalColor = mix(compositeFog, clearColor, mask);
    
    // 7. Specular highlight
    float edge = length(normal);
    float spec = pow(max(0.0, edge), 4.0) * 0.4;
    finalColor += vec4(spec);

    gl_FragColor = finalColor;
  }
`;

const FoggyWindow = forwardRef<FoggyWindowHandle, FoggyWindowProps>(({ imageUrl, settings }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const dripsRef = useRef<Drip[]>([]);
  const waterGrid = useRef<Map<string, number>>(new Map());
  const animationFrameRef = useRef<number>(0);
  
  // WebGL States
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const texturesRef = useRef<{ bg?: WebGLTexture; mask?: WebGLTexture }>({});
  const imgSizeRef = useRef({ width: 1, height: 1 });

  useImperativeHandle(ref, () => ({
    resetFog: () => {
      const maskCtx = maskCanvasRef.current.getContext('2d');
      maskCtx?.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
      dripsRef.current = [];
      waterGrid.current.clear();
    },
    exportImage: () => {
      const canvas = glCanvasRef.current;
      if (canvas) {
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'foggy-glass-export.png';
        a.click();
      }
    }
  }));

  // --- Initial Setup ---
  useEffect(() => {
    const gl = glCanvasRef.current?.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) return;
    glRef.current = gl;

    // Helper: Create Shader
    const createShader = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    programRef.current = program;

    // Setup Geometry (Full-screen quad)
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posAttrib = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posAttrib);
    gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

    // Initial texture slots
    texturesRef.current.bg = gl.createTexture()!;
    texturesRef.current.mask = gl.createTexture()!;

    // Start loop
    const render = (time: number) => {
      updatePhysics();
      drawShader(time * 0.001);
      animationFrameRef.current = requestAnimationFrame(render);
    };
    animationFrameRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []);

  // --- Handle Image Load ---
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !texturesRef.current.bg) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgSizeRef.current = { width: img.width, height: img.height };
      gl.bindTexture(gl.TEXTURE_2D, texturesRef.current.bg!);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    img.src = imageUrl;

    // Resize canvases
    if (containerRef.current && glCanvasRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      glCanvasRef.current.width = width;
      glCanvasRef.current.height = height;
      maskCanvasRef.current.width = width;
      maskCanvasRef.current.height = height;
      gl.viewport(0, 0, width, height);
    }
  }, [imageUrl]);

  const updatePhysics = () => {
    const maskCtx = maskCanvasRef.current.getContext('2d');
    if (!maskCtx) return;

    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = 'rgba(255, 255, 255, 1.0)';
    
    for (let i = dripsRef.current.length - 1; i >= 0; i--) {
      const drip = dripsRef.current[i];
      maskCtx.beginPath();
      maskCtx.arc(drip.x, drip.y, drip.width / 2, 0, Math.PI * 2);
      maskCtx.fill();

      drip.speed += 0.06 * settings.dripSpeed;
      drip.speed *= 0.88;
      drip.y += drip.speed;
      if (Math.random() < 0.2) drip.x += (Math.random() - 0.5) * drip.wiggle;
      drip.volume -= drip.speed;
      if (drip.volume <= 0) dripsRef.current.splice(i, 1);
    }
  };

  const drawShader = (time: number) => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    gl.useProgram(program);

    // Update Mask Texture from 2D Canvas
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texturesRef.current.mask!);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvasRef.current);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Set Uniforms
    gl.uniform1i(gl.getUniformLocation(program, 'u_clearBg'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_mask'), 1);
    gl.uniform1f(gl.getUniformLocation(program, 'u_fogDensity'), settings.blurAmount / 40);
    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), time);
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), glCanvasRef.current!.width, glCanvasRef.current!.height);
    gl.uniform2f(gl.getUniformLocation(program, 'u_imgSize'), imgSizeRef.current.width, imgSizeRef.current.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texturesRef.current.bg!);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  // --- Input Handlers ---
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = glCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    } else {
      return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
    }
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const coords = getCoordinates(e);
    if (coords) {
      lastPos.current = coords;
      drawMask(coords.x, coords.y, coords.x, coords.y);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (coords && lastPos.current) {
      drawMask(lastPos.current.x, lastPos.current.y, coords.x, coords.y);
      lastPos.current = coords;
    }
  };

  const handleEnd = () => { setIsDrawing(false); lastPos.current = null; };

  const drawMask = (x1: number, y1: number, x2: number, y2: number) => {
    const ctx = maskCanvasRef.current.getContext('2d');
    if (!ctx) return;
    const radius = settings.brushSize;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = radius * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Drip Logic
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.floor(dist / (radius * 0.25)));
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const cx = x1 + (x2 - x1) * t;
      const cy = y1 + (y2 - y1) * t;
      const key = `${Math.floor(cx / 30)},${Math.floor(cy / 30)}`;
      const currentWater = waterGrid.current.get(key) || 0;
      const newWater = currentWater + (radius * 0.1);
      waterGrid.current.set(key, newWater);
      if (newWater > 25) {
        dripsRef.current.push({ x: cx, y: cy, speed: 0, volume: Math.random() * 80 + 30, width: Math.random() * (radius * 0.3) + (radius * 0.1), wiggle: Math.random() });
        waterGrid.current.set(key, 0);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none bg-black">
      <canvas ref={glCanvasRef} className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
        onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}
        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
      />
    </div>
  );
});

export default FoggyWindow;
