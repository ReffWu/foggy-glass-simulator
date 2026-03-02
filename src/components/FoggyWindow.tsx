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

const FoggyWindow = forwardRef<FoggyWindowHandle, FoggyWindowProps>(({ imageUrl, settings }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const dripsRef = useRef<Drip[]>([]);
  const waterGrid = useRef<Map<string, number>>(new Map());
  const animationFrameRef = useRef<number>(0);
  const settingsRef = useRef(settings);

  useImperativeHandle(ref, () => ({
    resetFog: () => {
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas) {
        const ctx = maskCanvas.getContext('2d');
        ctx?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      }
      dripsRef.current = [];
      waterGrid.current.clear();
    },
    exportImage: () => {
      const mainCanvas = mainCanvasRef.current;
      if (mainCanvas) {
        const url = mainCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'foggy-glass-export.png';
        a.click();
      }
    }
  }));

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const container = containerRef.current;
    const mainCanvas = mainCanvasRef.current;
    if (!container || !mainCanvas) return;

    let isUnmounted = false;

    const setupCanvases = () => {
      const { width, height } = container.getBoundingClientRect();
      mainCanvas.width = width;
      mainCanvas.height = height;

      if (!bgCanvasRef.current) bgCanvasRef.current = document.createElement('canvas');
      if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement('canvas');

      bgCanvasRef.current.width = width;
      bgCanvasRef.current.height = height;
      
      const oldMask = maskCanvasRef.current;
      const newMask = document.createElement('canvas');
      newMask.width = width;
      newMask.height = height;
      if (oldMask.width > 0) {
        newMask.getContext('2d')?.drawImage(oldMask, 0, 0);
      }
      maskCanvasRef.current = newMask;

      renderBgCanvas(width, height);
    };

    const renderBgCanvas = (width: number, height: number) => {
      const bgCanvas = bgCanvasRef.current;
      if (!bgCanvas) return;
      const ctx = bgCanvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (isUnmounted) return;
        
        ctx.clearRect(0, 0, width, height);
        
        const imgRatio = img.width / img.height;
        const canvasRatio = width / height;
        let drawWidth = width;
        let drawHeight = height;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > canvasRatio) {
          drawWidth = height * imgRatio;
          offsetX = (width - drawWidth) / 2;
        } else {
          drawHeight = width / imgRatio;
          offsetY = (height - drawHeight) / 2;
        }

        // Draw blurred image
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = `blur(20px) brightness(0.85)`; // Fixed visual blur radius
        
        const padding = 40; 
        ctx.drawImage(img, offsetX - padding, offsetY - padding, drawWidth + padding*2, drawHeight + padding*2);
        ctx.restore();
        
        // Draw fog overlay based on density
        const density = settingsRef.current.blurAmount / 40; // 0 to 1
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + density * 0.45})`;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = `rgba(180, 210, 255, ${density * 0.15})`;
        ctx.fillRect(0, 0, width, height);
      };
      img.src = imageUrl;
    };

    setupCanvases();

    const handleResize = () => {
      setupCanvases();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isUnmounted = true;
      window.removeEventListener('resize', handleResize);
    };
  }, [imageUrl]);

  useEffect(() => {
    const container = containerRef.current;
    const bgCanvas = bgCanvasRef.current;
    if (!container || !bgCanvas) return;
    
    const { width, height } = container.getBoundingClientRect();
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const ctx = bgCanvas.getContext('2d');
      if (!ctx) return;
      
      ctx.clearRect(0, 0, width, height);
      
      const imgRatio = img.width / img.height;
      const canvasRatio = width / height;
      let drawWidth = width;
      let drawHeight = height;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > canvasRatio) {
        drawWidth = height * imgRatio;
        offsetX = (width - drawWidth) / 2;
      } else {
        drawHeight = width / imgRatio;
        offsetY = (height - drawHeight) / 2;
      }

      // Draw blurred image
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = `blur(20px) brightness(0.85)`;
      
      const padding = 40;
      ctx.drawImage(img, offsetX - padding, offsetY - padding, drawWidth + padding*2, drawHeight + padding*2);
      ctx.restore();
      
      // Draw fog overlay based on density
      const density = settings.blurAmount / 40; // 0 to 1
      ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + density * 0.45})`;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = `rgba(180, 210, 255, ${density * 0.15})`;
      ctx.fillRect(0, 0, width, height);
    };
    img.src = imageUrl;
  }, [settings.blurAmount, imageUrl]);

  useEffect(() => {
    let isUnmounted = false;

    const loop = () => {
      if (isUnmounted) return;
      updateAndDraw();
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      isUnmounted = true;
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const updateAndDraw = () => {
    const mainCanvas = mainCanvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    
    if (!mainCanvas || !bgCanvas || !maskCanvas) return;
    
    const mainCtx = mainCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!mainCtx || !maskCtx) return;

    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = 'black';
    
    for (let i = dripsRef.current.length - 1; i >= 0; i--) {
      const drip = dripsRef.current[i];
      
      maskCtx.beginPath();
      maskCtx.arc(drip.x, drip.y, drip.width / 2, 0, Math.PI * 2);
      maskCtx.fill();

      drip.speed += 0.06 * settingsRef.current.dripSpeed;
      drip.speed *= 0.88;
      
      drip.y += drip.speed;
      
      if (Math.random() < 0.2) {
        drip.x += (Math.random() - 0.5) * drip.wiggle;
      }

      drip.volume -= drip.speed;

      if (drip.volume <= 0) {
        dripsRef.current.splice(i, 1);
      }
    }

    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    
    mainCtx.globalCompositeOperation = 'source-over';
    mainCtx.drawImage(bgCanvas, 0, 0);
    
    mainCtx.globalCompositeOperation = 'destination-out';
    mainCtx.drawImage(maskCanvas, 0, 0);
  };

  const spawnDrip = (x: number, y: number, radius: number) => {
    const size = Math.random() * (radius * 0.3) + (radius * 0.1);
    dripsRef.current.push({
      x: x + (Math.random() - 0.5) * radius * 0.5,
      y: y + (Math.random() * radius * 0.5),
      speed: 0,
      volume: Math.random() * 80 + 30,
      width: size,
      wiggle: Math.random() * 1.0
    });
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
        y: ((e as React.MouseEvent).clientY - rect.top) * scaleY
      };
    }
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const coords = getCoordinates(e);
    if (coords) {
      lastPos.current = coords;
      draw(coords.x, coords.y, coords.x, coords.y);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (coords && lastPos.current) {
      draw(lastPos.current.x, lastPos.current.y, coords.x, coords.y);
      lastPos.current = coords;
    }
  };

  const handleEnd = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const draw = (x1: number, y1: number, x2: number, y2: number) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    const radius = settingsRef.current.brushSize;

    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.strokeStyle = 'black';
    maskCtx.lineWidth = radius * 2;
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';

    maskCtx.beginPath();
    maskCtx.moveTo(x1, y1);
    maskCtx.lineTo(x2, y2);
    maskCtx.stroke();

    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.floor(dist / (radius * 0.25)));
    
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const cx = x1 + (x2 - x1) * t;
      const cy = y1 + (y2 - y1) * t;
      
      const cellX = Math.floor(cx / 30);
      const cellY = Math.floor(cy / 30);
      const key = `${cellX},${cellY}`;
      const currentWater = waterGrid.current.get(key) || 0;
      
      const newWater = currentWater + (radius * 0.1);
      waterGrid.current.set(key, newWater);

      if (newWater > 25) {
        spawnDrip(cx, cy, radius);
        waterGrid.current.set(key, 0);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none bg-black">
      <img 
        src={imageUrl} 
        alt="Background" 
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      <canvas
        ref={mainCanvasRef}
        className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
    </div>
  );
});

export default FoggyWindow;
