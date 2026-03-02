import React, { useState, useRef } from 'react';
import { Upload, Settings2, X, Download, Eraser, Image as ImageIcon } from 'lucide-react';
import FoggyWindow, { FoggySettings, FoggyWindowHandle } from './components/FoggyWindow';

const PRESET_IMAGES = [
  { id: 'night', url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=2000&auto=format&fit=crop', label: 'Night Street' },
  { id: 'city', url: 'https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=2000&auto=format&fit=crop', label: 'City Day' },
  { id: 'mountain', url: 'https://images.unsplash.com/photo-1506744626753-eba7bc3613ce?q=80&w=2000&auto=format&fit=crop', label: 'Mountain Lake' },
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
            
            {/* Floating Panels */}
            <div className="absolute bottom-32 sm:bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-40 w-full max-w-[calc(100%-2rem)] sm:max-w-md px-4 pointer-events-none">
              
              {/* Settings Panel */}
              {activePanel === 'settings' && (
                <div className="w-full bg-black/90 sm:bg-black/40 backdrop-blur-3xl border border-white/20 rounded-3xl p-5 sm:p-6 shadow-2xl pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-200 overflow-y-auto max-h-[45vh]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-semibold tracking-tight text-lg">Settings</h3>
                    <button onClick={() => setActivePanel(null)} className="text-white/70 hover:text-white transition-colors bg-white/10 rounded-full p-1.5">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-6 sm:space-y-6">
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm font-medium text-white/90">
                        <label>Fog Density</label>
                        <span>{Math.round((settings.blurAmount / 40) * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="40" step="1"
                        value={settings.blurAmount}
                        onChange={(e) => setSettings({...settings, blurAmount: Number(e.target.value)})}
                        className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                      />
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm font-medium text-white/90">
                        <label>Finger Size</label>
                        <span>{settings.brushSize}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="2" max="50" step="1"
                        value={settings.brushSize}
                        onChange={(e) => setSettings({...settings, brushSize: Number(e.target.value)})}
                        className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between text-sm font-medium text-white/90">
                        <label>Drip Gravity</label>
                        <span>{settings.dripSpeed.toFixed(1)}x</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" max="3.0" step="0.1"
                        value={settings.dripSpeed}
                        onChange={(e) => setSettings({...settings, dripSpeed: Number(e.target.value)})}
                        className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Gallery Panel */}
              {activePanel === 'gallery' && (
                <div className="w-full bg-black/90 sm:bg-black/40 backdrop-blur-3xl border border-white/20 rounded-3xl p-5 sm:p-6 shadow-2xl pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-200 overflow-y-auto max-h-[45vh]">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="font-semibold tracking-tight text-lg">Backgrounds</h3>
                    <button onClick={() => setActivePanel(null)} className="text-white/70 hover:text-white transition-colors bg-white/10 rounded-full p-1.5">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {PRESET_IMAGES.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setImageUrl(preset.url);
                          setActivePanel(null);
                        }}
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
                      <span className="text-xs font-medium text-white/80">Custom</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Floating Dock */}
            <div className="absolute bottom-12 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 w-auto">
              <div className="flex items-center gap-2 sm:gap-2 p-2 sm:p-2 bg-black/70 sm:bg-black/40 backdrop-blur-3xl border border-white/20 rounded-full shadow-2xl ring-1 ring-white/10">
                <button
                  onClick={() => togglePanel('gallery')}
                  className={`p-3 sm:p-3 rounded-full transition-all ${activePanel === 'gallery' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                  title="Gallery"
                >
                  <ImageIcon className="w-5 h-5 sm:w-5 sm:h-5" strokeWidth={1.5} />
                </button>
                
                <div className="w-px h-8 sm:h-8 bg-white/20 mx-1" />
                
                <button
                  onClick={() => foggyWindowRef.current?.resetFog()}
                  className="p-3 sm:p-3 rounded-full text-white hover:bg-white/10 transition-all active:scale-90"
                  title="Reset Fog"
                >
                  <Eraser className="w-5 h-5 sm:w-5 sm:h-5" strokeWidth={1.5} />
                </button>
                
                <button
                  onClick={() => foggyWindowRef.current?.exportImage()}
                  className="p-3 sm:p-3 rounded-full text-white hover:bg-white/10 transition-all active:scale-90"
                  title="Export Image"
                >
                  <Download className="w-5 h-5 sm:w-5 sm:h-5" strokeWidth={1.5} />
                </button>
                
                <div className="w-px h-8 sm:h-8 bg-white/20 mx-1" />
                
                <button
                  onClick={() => togglePanel('settings')}
                  className={`p-3 sm:p-3 rounded-full transition-all ${activePanel === 'settings' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                  title="Settings"
                >
                  <Settings2 className="w-5 h-5 sm:w-5 sm:h-5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={handleFileChange}
      />
    </div>
  );
}

