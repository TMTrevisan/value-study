import { useState, useRef, useEffect } from 'react';
import { Upload, Droplet, Sun, Layers, X } from 'lucide-react';

export default function App() {
  const [imageObj, setImageObj] = useState(null);
  const [isGrayscale, setIsGrayscale] = useState(true);
  const [posterizeLevels, setPosterizeLevels] = useState(5);
  const [highlightValue, setHighlightValue] = useState(null);
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
  }

  useEffect(() => {
    if (!imageObj || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Scale down image if too large to ensure good performance
    const MAX_DIM = 2000;
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
      
      // Standard Relative Luminance formula
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Determine bucket index (0 is darkest, posterizeLevels-1 is lightest)
      const bucket = Math.min(posterizeLevels - 1, Math.floor((L / 256) * posterizeLevels));
      const step = 255 / (posterizeLevels - 1);
      
      // Target brightness value for this block
      const quantizedL = Math.round(bucket * step);
      
      let outR, outG, outB;

      if (isGrayscale) {
        outR = outG = outB = quantizedL;
      } else {
        // Posterize color channels based on step
        outR = Math.round(Math.min(posterizeLevels - 1, Math.floor((r / 256) * posterizeLevels)) * step);
        outG = Math.round(Math.min(posterizeLevels - 1, Math.floor((g / 256) * posterizeLevels)) * step);
        outB = Math.round(Math.min(posterizeLevels - 1, Math.floor((b / 256) * posterizeLevels)) * step);
      }

      // Highlight logic
      if (highlightValue !== null && bucket === highlightValue) {
        // High contrast highlight - vivid red overlay
        outR = 239; outG = 68; outB = 68; // Tailwind red-500
      } 

      data[i] = outR;
      data[i + 1] = outG;
      data[i + 2] = outB;
    }

    ctx.putImageData(imgData, 0, 0);
  }, [imageObj, isGrayscale, posterizeLevels, highlightValue]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500/30">
      <header className="border-b border-zinc-800/50 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplet className="w-6 h-6 text-purple-400" />
            <h1 className="font-semibold text-lg tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Watercolor Value Study Tool
            </h1>
          </div>
          {imageObj && (
            <button 
              onClick={handleClear}
              className="text-zinc-400 hover:text-red-400 transition-colors flex items-center gap-1 text-sm font-medium"
            >
              <X className="w-4 h-4" /> Clear Image
            </button>
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
            <h2 className="text-xl font-medium mb-2">Upload Reference Photo</h2>
            <p className="text-zinc-500 text-sm">Drag and drop or click to browse (JPG, PNG)</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Controls */}
            <div className="lg:col-span-1 space-y-6 bg-zinc-900/30 p-6 border border-zinc-800/50 rounded-3xl h-fit sticky top-24">
              
              {/* Grayscale Toggle */}
              <div>
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                    <Sun className="w-4 h-4" />
                    Grayscale Mode
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
                    // Create a visual lightness from dark to light
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
                <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
                  Click a value swatch above to isolate and map those specific shapes in <span className="text-red-400 font-medium">red</span>. Look for big connected shapes!
                </p>
              </div>
            </div>

            {/* Canvas Output */}
            <div className="lg:col-span-3">
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-4 md:p-8 flex items-center justify-center shadow-xl overflow-hidden relative">
                <canvas 
                  ref={canvasRef} 
                  className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
