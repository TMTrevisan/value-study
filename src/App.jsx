import { useState, useRef, useEffect } from 'react';
import { Upload, Droplet, Sun, Layers, X, Download, CircleDashed, Contrast, Printer, Palette, Image as ImageIcon } from 'lucide-react';
import { get, set } from 'idb-keyval';

const PALETTES = {
  zorn: [
    { r: 35, g: 30, b: 28 },    // Ivory Black (Dark)
    { r: 178, g: 60, b: 48 },   // Cadmium Red (Mid-Dark)
    { r: 200, g: 153, b: 88 },  // Yellow Ocher (Mid-Light)
    { r: 236, g: 232, b: 228 }, // Titanium White (Light)
  ],
  earth: [
    { r: 40, g: 45, b: 40 },    // Dark Earth
    { r: 89, g: 66, b: 54 },    // Umber
    { r: 140, g: 98, b: 89 },   // Terra Rosa
    { r: 191, g: 165, b: 138 }, // Buff
    { r: 245, g: 240, b: 230 }, // Cream
  ],
  cool: [
    { r: 30, g: 40, b: 60 },    // Deep Navy
    { r: 80, g: 110, b: 140 },  // Ocean
    { r: 130, g: 160, b: 190 }, // Steel Sky
    { r: 210, g: 230, b: 240 }, // Ice
  ],
};

export default function App() {
  const [imageObj, setImageObj] = useState(null);
  const [recentImages, setRecentImages] = useState([]);
  
  // UI Tabs State: 'values', 'notan', 'palette'
  const [activeTab, setActiveTab] = useState('values');

  // Shared Core Settings
  const [blurAmount, setBlurAmount] = useState(0);

  // Tab 1: Values
  const [isGrayscale, setIsGrayscale] = useState(true);
  const [posterizeLevels, setPosterizeLevels] = useState(5);
  const [highlightValue, setHighlightValue] = useState(null);
  
  // Tab 2: Notan
  const [notanThreshold, setNotanThreshold] = useState(128);

  // Tab 3: Palette Mapping
  const [selectedPalette, setSelectedPalette] = useState('zorn');

  const canvasRef = useRef(null);

  // Load IndexedDB recents
  useEffect(() => {
    get('recent_uploads').then((val) => {
      if (val && Array.isArray(val)) setRecentImages(val);
    });
  }, []);

  const saveToHistory = async (srcData) => {
    const updated = [srcData, ...recentImages.filter(x => x !== srcData)].slice(0, 10);
    setRecentImages(updated);
    await set('recent_uploads', updated);
  };

  const handleClearHistory = async () => {
    setRecentImages([]);
    await set('recent_uploads', []);
  };

  const processImageFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target.result;
      
      // Load onto image to downscale and cache
      const img = new Image();
      img.onload = () => {
        // We will create a fresh mini canvas to downscale huge images to keep IndexedDB and RAM happy (~2000px max)
        const mx = 2000;
        let w = img.width; let h = img.height;
        if (w > mx || h > mx) {
          if (w > h) { h = Math.floor(h * (mx / w)); w = mx; }
          else { w = Math.floor(w * (mx / h)); h = mx; }
        }
        
        const tempCnv = document.createElement('canvas');
        tempCnv.width = w; tempCnv.height = h;
        const tctx = tempCnv.getContext('2d');
        tctx.drawImage(img, 0, 0, w, h);
        const optimizedURI = tempCnv.toDataURL('image/jpeg', 0.85); // Compress for storage
        
        const optimizedImg = new Image();
        optimizedImg.onload = () => {
          setImageObj(optimizedImg);
          setHighlightValue(null);
          saveToHistory(optimizedURI);
        };
        optimizedImg.src = optimizedURI;
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) processImageFile(file);
  };

  const loadFromHistory = (src) => {
    const img = new Image();
    img.onload = () => {
      setImageObj(img);
      setHighlightValue(null);
      // Bring to front
      saveToHistory(src);
    };
    img.src = src;
  };

  const handleClear = () => {
    setImageObj(null);
    setHighlightValue(null);
  };

  const handleDownload = () => {
    if (!canvasRef.current || !imageObj) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement('a');
    a.href = url;
    a.download = `value-study-${activeTab}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (!imageObj || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    let width = imageObj.width;
    let height = imageObj.height;
    
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Apply blur FIRST
    if (blurAmount > 0) {
      ctx.filter = `blur(${blurAmount}px)`;
    } else {
      ctx.filter = 'none';
    }

    ctx.drawImage(imageObj, 0, 0, width, height);

    // Reset filter
    ctx.filter = 'none';

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Prep palette logic
    let paletteArr = [];
    if (activeTab === 'palette') {
      paletteArr = PALETTES[selectedPalette];
    }
    const palCount = paletteArr.length;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      let outR, outG, outB;

      if (activeTab === 'notan') {
        const val = L >= notanThreshold ? 255 : 0;
        outR = outG = outB = val;
      } 
      else if (activeTab === 'palette') {
        const bucket = Math.min(palCount - 1, Math.floor((L / 256) * palCount));
        const color = paletteArr[bucket];
        outR = color.r; outG = color.g; outB = color.b;
      }
      else {
        // 'values' standard posterize
        const bucket = Math.min(posterizeLevels - 1, Math.floor((L / 256) * posterizeLevels));
        const step = 255 / (posterizeLevels - 1);
        const quantizedL = Math.round(bucket * step);
        
        if (isGrayscale) {
          outR = outG = outB = quantizedL;
        } else {
          outR = Math.round(Math.min(posterizeLevels - 1, Math.floor((r / 256) * posterizeLevels)) * step);
          outG = Math.round(Math.min(posterizeLevels - 1, Math.floor((g / 256) * posterizeLevels)) * step);
          outB = Math.round(Math.min(posterizeLevels - 1, Math.floor((b / 256) * posterizeLevels)) * step);
        }

        if (highlightValue !== null && bucket === highlightValue) {
          outR = 239; outG = 68; outB = 68; // Vivid red
        }
      }

      data[i] = outR;
      data[i + 1] = outG;
      data[i + 2] = outB;
    }

    ctx.putImageData(imgData, 0, 0);
  }, [imageObj, activeTab, isGrayscale, posterizeLevels, highlightValue, blurAmount, notanThreshold, selectedPalette]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500/30">
      <header className="border-b border-zinc-800/50 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplet className="w-6 h-6 text-purple-400" />
            <h1 className="font-semibold text-lg tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent hidden sm:block">
              Watercolor Value Study Tool
            </h1>
          </div>
          {imageObj && (
            <div className="flex items-center gap-3">
              <button 
                onClick={handlePrint}
                title="Print value view"
                className="text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 active:scale-95 px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
              >
                <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Print</span>
              </button>
              <button 
                onClick={handleDownload}
                title="Download PNG"
                className="text-white bg-purple-600 hover:bg-purple-700 active:scale-95 px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 text-sm font-medium shadow-lg shadow-purple-500/20"
              >
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
              </button>
              <button 
                onClick={handleClear}
                className="text-zinc-400 hover:text-red-400 transition-colors flex items-center gap-1 text-sm font-medium ml-2"
              >
                <X className="w-4 h-4" /> <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!imageObj ? (
          <div className="space-y-6 no-print">
            <div className="h-[50vh] flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-zinc-700 transition-all cursor-pointer relative group">
              <input 
                type="file" 
                accept="image/jpeg, image/png, image/webp" 
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="bg-zinc-800/50 p-4 rounded-full mb-4 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all duration-300">
                <Upload className="w-8 h-8 text-zinc-400 group-hover:text-purple-400 transition-colors" />
              </div>
              <h2 className="text-xl font-medium mb-2 text-center px-4">Upload Reference Photo</h2>
              <p className="text-zinc-500 text-sm text-center px-4">Drag and drop or click to browse (JPG, PNG)</p>
            </div>
            
            {recentImages.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-3 px-2">
                  <h3 className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Recent Uploads (Local)
                  </h3>
                  <button onClick={handleClearHistory} className="text-xs text-zinc-500 hover:text-red-400 transition-colors">
                    Clear History
                  </button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                  {recentImages.map((src, idx) => (
                    <button 
                      key={idx}
                      onClick={() => loadFromHistory(src)}
                      className="snap-start shrink-0 relative group rounded-xl overflow-hidden border border-zinc-800 hover:border-purple-500 transition-all"
                    >
                      <img src={src} className="h-24 w-24 object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Sidebar Controls - Hide on Print */}
            <div className="lg:col-span-1 bg-zinc-900/30 border border-zinc-800/50 rounded-3xl h-fit sticky top-24 no-print overflow-hidden">
              
              {/* Top Tabs */}
              <div className="flex border-b border-zinc-800/50 bg-zinc-900/40 text-xs font-semibold">
                <button 
                  onClick={() => setActiveTab('values')}
                  className={`flex-1 py-3 px-2 text-center transition-colors ${activeTab === 'values' ? 'text-purple-400 border-b-2 border-purple-500 bg-purple-500/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Layers className="w-4 h-4 mx-auto mb-1" /> Values
                </button>
                <button 
                  onClick={() => setActiveTab('notan')}
                  className={`flex-1 py-3 px-2 text-center transition-colors ${activeTab === 'notan' ? 'text-purple-400 border-b-2 border-purple-500 bg-purple-500/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Contrast className="w-4 h-4 mx-auto mb-1" /> Notan
                </button>
                <button 
                  onClick={() => setActiveTab('palette')}
                  className={`flex-1 py-3 px-2 text-center transition-colors ${activeTab === 'palette' ? 'text-purple-400 border-b-2 border-purple-500 bg-purple-500/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Palette className="w-4 h-4 mx-auto mb-1" /> Colors
                </button>
              </div>

              {/* Dynamic Tab Body */}
              <div className="p-6 space-y-6">
                
                {/* ---- TAB: VALUES ---- */}
                {activeTab === 'values' && (
                  <div className="animate-in fade-in space-y-6">
                    <div>
                      <label className="flex items-center justify-between cursor-pointer group">
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                          <Sun className="w-4 h-4" /> Grayscale Match
                        </div>
                        <div className={`w-11 h-6 rounded-full transition-colors relative ${isGrayscale ? 'bg-purple-500' : 'bg-zinc-700'}`}>
                          <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isGrayscale ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                        <input type="checkbox" className="hidden" checked={isGrayscale} onChange={() => setIsGrayscale(!isGrayscale)} />
                      </label>
                    </div>

                    <hr className="border-t border-zinc-800" />

                    <div>
                      <div className="flex items-center gap-2 mb-4 text-sm font-medium text-zinc-300">
                        <Layers className="w-4 h-4" />
                        Value Steps: <span className="text-white ml-auto font-bold">{posterizeLevels}</span>
                      </div>
                      <input 
                        type="range" 
                        min="2" max="9" step="1" 
                        value={posterizeLevels}
                        onChange={(e) => {
                          setPosterizeLevels(parseInt(e.target.value));
                          setHighlightValue(null);
                        }}
                        className="w-full mb-2"
                      />
                      <div className="flex justify-between text-xs text-zinc-500 font-medium px-1">
                        <span>2</span><span>5</span><span>9</span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center justify-between">
                        <span>Threshold Highlight</span>
                        {highlightValue !== null && (
                          <button onClick={() => setHighlightValue(null)} className="text-xs text-purple-400 hover:text-purple-300">Clear</button>
                        )}
                      </h3>
                      <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: posterizeLevels }).map((_, i) => {
                          const lightness = Math.round((i / (posterizeLevels - 1)) * 255);
                          const hexValue = lightness.toString(16).padStart(2, '0');
                          const color = `#${hexValue}${hexValue}${hexValue}`;
                          const isSelected = highlightValue === i;

                          return (
                            <button
                              key={i}
                              onClick={() => setHighlightValue(isSelected ? null : i)}
                              title={`Value ${i + 1}`}
                              className={`h-10 rounded-lg border-2 transition-all duration-200 shadow-sm hover:scale-105 active:scale-95 flex-grow ${isSelected ? 'border-red-500 ring-2 ring-red-500/50 scale-110 z-10' : 'border-zinc-700/50'}`}
                              style={{ backgroundColor: color }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ---- TAB: NOTAN ---- */}
                {activeTab === 'notan' && (
                  <div className="animate-in fade-in space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-4 text-sm font-medium text-zinc-300">
                        <Contrast className="w-4 h-4" />
                        Light/Dark Balance: <span className="text-white ml-auto font-bold">{Math.round((notanThreshold/255)*100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" max="254" step="1" 
                        value={notanThreshold}
                        onChange={(e) => setNotanThreshold(parseInt(e.target.value))}
                        className="w-full mb-2"
                      />
                      <div className="flex justify-between text-xs text-zinc-500 font-medium px-1">
                        <span>Darker Bias</span><span>Lighter Bias</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
                        Strict 2-value thresholding. Shift the slider to decide which mid-tones become pure black or pure white.
                      </p>
                    </div>
                  </div>
                )}

                {/* ---- TAB: PALETTE MAP ---- */}
                {activeTab === 'palette' && (
                  <div className="animate-in fade-in space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                        <Palette className="w-4 h-4" /> Select Base Palette
                      </h3>
                      <div className="space-y-3">
                        {Object.keys(PALETTES).map(key => {
                          const isSelected = selectedPalette === key;
                          const pObj = PALETTES[key];
                          return (
                            <button
                              key={key}
                              onClick={() => setSelectedPalette(key)}
                              className={`w-full p-3 rounded-xl border flex flex-col gap-2 transition-all text-left ${isSelected ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/50' : 'border-zinc-700/50 hover:border-zinc-500 hover:bg-zinc-800/30'}`}
                            >
                              <div className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex justify-between">
                                <span>{key} ({pObj.length} tones)</span>
                              </div>
                              <div className="flex h-6 w-full rounded-md overflow-hidden">
                                {pObj.map((c, i) => (
                                  <div key={i} className="flex-1" style={{ backgroundColor: `rgb(${c.r}, ${c.g}, ${c.b})` }} />
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <hr className="border-t border-zinc-800" />
                
                {/* Global Shared Setting */}
                <div>
                  <div className="flex items-center gap-2 mb-4 text-sm font-medium text-zinc-300">
                    <CircleDashed className="w-4 h-4" />
                    Simplify Shapes: <span className="text-white ml-auto font-bold">{blurAmount}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="25" step="1" 
                    value={blurAmount}
                    onChange={(e) => setBlurAmount(parseInt(e.target.value))}
                    className="w-full mb-2"
                  />
                </div>

              </div>
            </div>

            {/* Canvas Output -> Reverts to minimal size and pure white background on Print */}
            <div className="lg:col-span-3 pb-8 print-canvas">
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-4 md:p-8 flex items-center justify-center shadow-xl overflow-hidden relative w-full h-full print-canvas">
                <canvas 
                  ref={canvasRef} 
                  className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl mx-auto block print-canvas"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
