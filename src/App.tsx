import React, { useState, useRef } from 'react';
import { Upload, Settings2, X, Download, Eraser, Image as ImageIcon } from 'lucide-react';
import FoggyWindow, { FoggySettings, FoggyWindowHandle } from './components/FoggyWindow';

const PRESET_IMAGES = [
  { id: 'night', url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=2000&auto=format&fit=crop', label: 'Night Street' },
  { id: 'city', url: 'https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=2000&auto=format&fit=crop', label: 'City Day' },
  { id: 'cafe', url: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2000&auto=format&fit=crop', label: 'Cozy Cafe' },
  { id: 'forest', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2000&auto=format&fit=crop', label: 'Forest Road' },
];

export default function App() {
  const [imageUrl, setImageUrl] = useState<string | null>(PRESET_IMAGES[0].url);
  const [activePanel, setActivePanel] = useState<'settings' | 'gallery' | null>(null);
  const [settings, setSettings] = useState<FoggySettings>({
    blurAmount: 12,
    brushSize: 12,
    dripSpeed: 1.0,
    fogColor: 1.0, // Default to white
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const foggyWindowRef = useRef<FoggyWindowHandle>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setActivePanel(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
    }
  };

  const togglePanel = (panel: 'settings' | 'gallery') => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  return (
    <div 
      className="min-h-screen bg-black text-white flex flex-col font-sans overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <main className="flex-1 relative flex items-center justify-center">
        {!imageUrl ? (
          <div 
            className="w-full max-w-md p-10 border border-white/10 rounded-[2rem] bg-white/5 backdrop-blur-3xl flex flex-col items-center justify-center gap-5 hover:bg-white/10 transition-all cursor-pointer m-4 shadow-2xl"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-white/80" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-xl font-medium tracking-tight">Upload a photo</p>
              <p className="text-sm text-white/50 mt-2">Drag and drop or click to browse</p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0">
            <FoggyWindow ref={foggyWindowRef} imageUrl={imageUrl} settings={settings} />
            
            {/* Unified Top Right Controls */}
            <div className="absolute top-6 right-6 z-50 flex flex-col items-end gap-4">
              
              {/* Main Trigger & Quick Actions */}
              <div className="flex items-center gap-2 p-2 bg-black/40 backdrop-blur-3xl border border-white/20 rounded-full shadow-2xl">
                <button
                  onClick={() => togglePanel('gallery')}
                  className={`p-2.5 rounded-full transition-all ${activePanel === 'gallery' ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}
                  title="Gallery"
                >
                  <ImageIcon className="w-5 h-5" strokeWidth={1.5} />
                </button>
                
                <button
                  onClick={() => foggyWindowRef.current?.resetFog()}
                  className="p-2.5 rounded-full text-white hover:bg-white/20 transition-all active:scale-90"
                  title="Reset"
                >
                  <Eraser className="w-5 h-5" strokeWidth={1.5} />
                </button>

                <button
                  onClick={() => foggyWindowRef.current?.exportImage()}
                  className="p-2.5 rounded-full text-white hover:bg-white/20 transition-all active:scale-90"
                  title="Save"
                >
                  <Download className="w-5 h-5" strokeWidth={1.5} />
                </button>

                <div className="w-px h-6 bg-white/20 mx-1" />

                <button
                  onClick={() => togglePanel('settings')}
                  className={`p-2.5 rounded-full transition-all ${activePanel === 'settings' ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}
                  title="Settings"
                >
                  <Settings2 className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Settings Island */}
              <div className={`transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] origin-top-right ${
                activePanel === 'settings' 
                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
                : 'opacity-0 scale-90 -translate-y-4 pointer-events-none absolute'
              } w-72 sm:w-80`}>
                <div className="bg-black/90 backdrop-blur-3xl border border-white/20 rounded-[2.5rem] p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="font-bold tracking-tight text-lg">Settings</h3>
                    <button onClick={() => setActivePanel(null)} className="text-white/40 hover:text-white"><X className="w-5 h-5"/></button>
                  </div>
                  
                  <div className="space-y-8 text-white/90">
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm font-semibold tracking-wide">
                        <label>Fog Color (Black to White)</label>
                        <span className="bg-white/10 px-2 py-0.5 rounded-md text-xs font-mono">{Math.round(settings.fogColor * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-black border border-white/20" />
                        <input type="range" min="0" max="1" step="0.01" value={settings.fogColor} onChange={(e) => setSettings({...settings, fogColor: Number(e.target.value)})} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white" />
                        <div className="w-4 h-4 rounded-full bg-white border border-white/20" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between text-sm font-semibold tracking-wide">
                        <label>Fog Density</label>
                        <span className="bg-white/10 px-2 py-0.5 rounded-md text-xs font-mono">{Math.round((settings.blurAmount / 40) * 100)}%</span>
                      </div>
                      <input type="range" min="0" max="40" step="1" value={settings.blurAmount} onChange={(e) => setSettings({...settings, blurAmount: Number(e.target.value)})} className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white" />
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm font-semibold tracking-wide">
                        <label>Finger Size</label>
                        <span className="bg-white/10 px-2 py-0.5 rounded-md text-xs font-mono">{settings.brushSize}px</span>
                      </div>
                      <input type="range" min="2" max="50" step="1" value={settings.brushSize} onChange={(e) => setSettings({...settings, brushSize: Number(e.target.value)})} className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white" />
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between text-sm font-semibold tracking-wide">
                        <label>Drip Gravity</label>
                        <span className="bg-white/10 px-2 py-0.5 rounded-md text-xs font-mono">{settings.dripSpeed.toFixed(1)}x</span>
                      </div>
                      <input type="range" min="0.1" max="3.0" step="0.1" value={settings.dripSpeed} onChange={(e) => setSettings({...settings, dripSpeed: Number(e.target.value)})} className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Backgrounds Island */}
              <div className={`transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] origin-top-right ${
                activePanel === 'gallery' 
                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
                : 'opacity-0 scale-90 -translate-y-4 pointer-events-none absolute'
              } w-72 sm:w-80`}>
                <div className="bg-black/90 backdrop-blur-3xl border border-white/20 rounded-[2.5rem] p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="font-bold tracking-tight text-lg text-white">Gallery</h3>
                    <button onClick={() => setActivePanel(null)} className="text-white/40 hover:text-white"><X className="w-5 h-5"/></button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {PRESET_IMAGES.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => { setImageUrl(preset.url); setActivePanel(null); }}
                        className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${imageUrl === preset.url ? 'border-white scale-95' : 'border-transparent hover:border-white/50'}`}
                      >
                        <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                      </button>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="relative aspect-square rounded-2xl overflow-hidden border-2 border-dashed border-white/30 hover:border-white/60 hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-2"
                    >
                      <Upload className="w-6 h-6 text-white/80" strokeWidth={1.5} />
                      <span className="text-[10px] font-medium text-white/80 uppercase tracking-tighter">Custom</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
      
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
    </div>
  );
}
