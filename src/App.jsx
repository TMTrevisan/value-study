import { useState, useRef, useEffect } from 'react';
import { Upload, Droplet, Sun, Layers, X, Download, CircleDashed, Contrast, ZoomIn } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export default function App() {
  const [imageObj, setImageObj] = useState(null);
  
  // Settings State
  const [isGrayscale, setIsGrayscale] = useState(true);
  const [posterizeLevels, setPosterizeLevels] = useState(5);
  const [highlightValue, setHighlightValue] = useState(null);
  const [blurAmount, setBlurAmount] = useState(0);
  
  // Notan State
  const [isNotan, setIsNotan] = useState(false);
  const [notanThreshold, setNotanThreshold] = useState(128);

  const canvasRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImageObj(img);
        setHighlightValue(null);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
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
    a.download = `value-study-${isNotan ? 'notan' : posterizeLevels + 'level'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    if (!imageObj || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    // Scale down image if too large to ensure good performance
    const MAX_DIM = 2400;
    let width = imageObj.width;
    let height = imageObj.height;
    if (width > MAX_DIM || height > MAX_DIM) {
      if (width > height) {
        height = Math.floor(height * (MAX_DIM / width));
        width = MAX_DIM;
      } else {
        width = Math.floor(width * (MAX_DIM / height));
        height = MAX_DIM;
      }
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Apply optional blur/simplification noise-reduction BEFORE math
    if (blurAmount > 0) {
      ctx.filter = `blur(${blurAmount}px)`;
    } else {
      ctx.filter = 'none';
    }

    // Draw original image first
    ctx.drawImage(imageObj, 0, 0, width, height);

    // Get pixel data
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Value chunks map 0-255 to buckets
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Standard Relative Luminance
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      
      let outR, outG, outB;

      if (isNotan) {
        // Strict Black/White threshold
        const val = L >= notanThreshold ? 255 : 0;
        outR = outG = outB = val;
      } else {
        // Determine bucket index (0 is darkest, posterizeLevels-1 is lightest)
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

        // Highlight logic
        if (highlightValue !== null && bucket === highlightValue) {
          outR = 239; outG = 68; outB = 68; // Vivid red override
        } 
      }

      data[i] = outR;
      data[i + 1] = outG;
      data[i + 2] = outB;
    }

    ctx.putImageData(imgData, 0, 0);
  }, [imageObj, isGrayscale, posterizeLevels, highlightValue, blurAmount, isNotan, notanThreshold]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500/30">
      <header className="border-b border-zinc-800/50 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplet className="w-6 h-6 text-purple-400" />
            <h1 className="font-semibold text-lg tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent hidden sm:block">
              Watercolor Value Study Tool
            </h1>
          </div>
          {imageObj && (
            <div className="flex items-center gap-4">
              <button 
                onClick={handleDownload}
                className="text-white bg-purple-600 hover:bg-purple-700 active:scale-95 px-4 py-1.5 rounded-lg transition-all flex items-center gap-2 text-sm font-medium shadow-lg shadow-purple-500/20"
              >
                <Download className="w-4 h-4" /> Export
              </button>
              <button 
                onClick={handleClear}
                className="text-zinc-400 hover:text-red-400 transition-colors flex items-center gap-1 text-sm font-medium"
              >
                <X className="w-4 h-4" /> Clear
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!imageObj ? (
          <div className="h-[60vh] flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-zinc-700 transition-all cursor-pointer relative group">
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
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Controls */}
            <div className="lg:col-span-1 space-y-6 bg-zinc-900/30 p-6 border border-zinc-800/50 rounded-3xl h-fit sticky top-24">
              
              {/* Notan Mode Toggle */}
              <div>
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                    <Contrast className="w-4 h-4" />
                    Notan Mode (B&W)
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors relative ${isNotan ? 'bg-purple-500' : 'bg-zinc-700'}`}>
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isNotan ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <input type="checkbox" className="hidden" checked={isNotan} onChange={() => setIsNotan(!isNotan)} />
                </label>
              </div>

              <hr className="border-t border-zinc-800" />

              {/* Notan Setting vs Grayscale/Values */}
              {isNotan ? (
                <div className="animate-in fade-in slide-in-from-top-2">
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
                  <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                    Shift the threshold to map which parts of the image convert to pure black or pure white. Essential for reading composition masses.
                  </p>
                </div>
              ) : (
                <div className="animate-in fade-in space-y-6">
                  {/* Grayscale Mode */}
                  <div>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                        <Sun className="w-4 h-4" />
                        Grayscale Match
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-colors relative ${isGrayscale ? 'bg-purple-500' : 'bg-zinc-700'}`}>
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isGrayscale ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                      <input type="checkbox" className="hidden" checked={isGrayscale} onChange={() => setIsGrayscale(!isGrayscale)} />
                    </label>
                  </div>

                  <hr className="border-t border-zinc-800" />

                  {/* Posterize Slider */}
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
                      <span>2</span>
                      <span>5</span>
                      <span>9</span>
                    </div>
                  </div>

                  <hr className="border-t border-zinc-800" />

                  {/* Threshold Highlight Selection */}
                  <div>
                    <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center justify-between">
                      <span>Highlight Values</span>
                      {highlightValue !== null && (
                        <button onClick={() => setHighlightValue(null)} className="text-xs text-purple-400 hover:text-purple-300">
                          Clear
                        </button>
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
                            className={`
                              h-10 rounded-lg border-2 transition-all duration-200 shadow-sm
                              hover:scale-105 active:scale-95 flex-grow
                              ${isSelected ? 'border-red-500 ring-2 ring-red-500/50 scale-110 z-10' : 'border-zinc-700/50'}
                            `}
                            style={{ backgroundColor: color }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <hr className="border-t border-zinc-800" />

              {/* Detail Simplification (Blur) */}
              <div>
                <div className="flex items-center gap-2 mb-4 text-sm font-medium text-zinc-300">
                  <CircleDashed className="w-4 h-4" />
                  Simplify Shapes: <span className="text-white ml-auto font-bold">{blurAmount}px</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="20" step="1" 
                  value={blurAmount}
                  onChange={(e) => setBlurAmount(parseInt(e.target.value))}
                  className="w-full mb-2"
                />
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  Increase to smooth out textures and noise, preventing the value map from becoming messy.
                </p>
              </div>

            </div>

            {/* Canvas Output */}
            <div className="lg:col-span-3">
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl overflow-hidden shadow-xl relative min-h-[60vh] w-full flex flex-col group">
                
                {/* Pan & Zoom Wrapper */}
                <div className="absolute top-4 right-4 z-10 opacity-50 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-medium text-white shadow-lg pointer-events-none">
                  <ZoomIn className="w-4 h-4" /> Scroll/Pinch to Zoom, Drag to Pan
                </div>
                
                <TransformWrapper 
                   centerOnInit={true} 
                   initialScale={1} 
                   minScale={0.5} 
                   maxScale={8}
                   wheel={{ step: 0.1 }}
                >
                  <TransformComponent wrapperClass="!w-full !h-[70vh] cursor-grab active:cursor-grabbing">
                    <canvas 
                      ref={canvasRef} 
                      className="max-w-full max-h-full object-contain pointer-events-none"
                    />
                  </TransformComponent>
                </TransformWrapper>

              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
