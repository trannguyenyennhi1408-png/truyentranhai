import React, { useState, useCallback, useRef } from 'react';
import { 
  Send, Layout, Image as ImageIcon, Type, Download, Loader2, 
  ArrowRight, BookOpen, RefreshCw, Sparkles, Columns, Smartphone, 
  CheckCircle2, History, Trash2, Home, User, Edit3, Save, Zap, FileImage, 
  Monitor, Smartphone as PhoneIcon, X, Info, Clock, ChevronLeft,
  GraduationCap, School, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateComicScript, generatePanelImage, updateApiKey, getApiKey, type ComicData, type ComicScene, type EducationLevel } from './services/aiService';

type Step = 'input' | 'script' | 'images' | 'final' | 'history' | 'settings';

export default function App() {
  const [step, setStep] = useState<Step>('input');
  const [mode, setMode] = useState<'creative' | 'education'>('creative');
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('general');
  const [userInput, setUserInput] = useState('');
  const [panelCount, setPanelCount] = useState(4);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  
  const [comicData, setComicData] = useState<ComicData>({ title: '', characterDesign: '', scenes: [] });
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [generatingStatus, setGeneratingStatus] = useState<Record<number, 'loading' | 'success' | 'error'>>({});
  const [savedComics, setSavedComics] = useState<any[]>([]); // Fallback for Firebase
  const [tempApiKey, setTempApiKey] = useState(getApiKey());

  const handleSaveApiKey = () => {
    updateApiKey(tempApiKey);
    setStep('input');
  };

  const handleGenerateScript = async (customPrompt?: string | React.MouseEvent | React.KeyboardEvent) => {
    if (!getApiKey()) {
      alert("Vui lòng cấu hình API Key trong mục API Settings trước khi sử dụng AI!");
      setStep('settings');
      return;
    }
    const promptToUse = (typeof customPrompt === 'string' ? customPrompt : userInput) || '';
    if (!promptToUse.trim()) return;
    setLoading(true);
    try {
      const data = await generateComicScript(promptToUse, panelCount, educationLevel);
      setComicData(data);
      setStep('script');
    } catch (err: any) {
      console.error("Script generation failed:", err);
      alert("Lỗi khi tạo kịch bản: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleContinueStory = () => {
    const continuationPrompt = `Tiếp tục phần tiếp theo của câu chuyện: "${comicData.title}". Dựa trên bối cảnh: ${userInput}`;
    handleGenerateScript(continuationPrompt);
  };

  const handleSimilarJourney = () => {
    const similarPrompt = `Tạo một hành trình tương tự nhưng với góc nhìn khác hoặc diễn biến khác cho ý tưởng: ${userInput}`;
    handleGenerateScript(similarPrompt);
  };

  const drawImageTask = useCallback(async (scene: ComicScene) => {
    setGeneratingStatus(prev => ({ ...prev, [scene.id]: 'loading' }));
    try {
      const url = await generatePanelImage(scene.imagePrompt, comicData.characterDesign);
      setGeneratedImages(prev => ({ ...prev, [scene.id]: url }));
      setGeneratingStatus(prev => ({ ...prev, [scene.id]: 'success' }));
      return true;
    } catch (err) {
      console.error(`Image generation for scene ${scene.id} failed:`, err);
      setGeneratingStatus(prev => ({ ...prev, [scene.id]: 'error' }));
      return false;
    }
  }, [comicData.characterDesign]);

  const startTurboGeneration = async () => {
    setStep('images');
    setGeneratedImages({});
    setGeneratingStatus({});

    // Process all images concurrently but with a 1.2s stagger to avoid rate limit (burst) and keep speed fast
    await Promise.all(comicData.scenes.map((scene, idx) => 
      new Promise(resolve => setTimeout(resolve, idx * 1200)).then(() => drawImageTask(scene))
    ));
  };

  const updateSceneData = (id: number, field: keyof ComicScene, value: string) => {
    setComicData(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === id ? { ...s, [field]: value } as ComicScene : s)
    }));
  };

  const exportAsPoster = async () => {
    setExporting(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const pSize = 1024;
      const gap = 60;
      const head = 350;
      const n = comicData.scenes.length;

      if (aspectRatio === '9:16') {
        canvas.width = pSize + (gap * 2);
        canvas.height = head + (pSize * n) + (gap * (n + 1));
      } else {
        canvas.width = (pSize * 2) + (gap * 3);
        canvas.height = head + (Math.ceil(n / 2) * (pSize + gap)) + gap;
      }

      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Accent Bar
      ctx.fillStyle = '#6366F1';
      ctx.fillRect(0, 0, canvas.width, 10);

      // Title - Bold Typography style
      ctx.fillStyle = '#FACC15';
      ctx.font = 'bold 120px Impact, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(comicData.title.toUpperCase(), gap, 180);

      // Meta Info
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText("PROJECT_ENGINE: GEMINI_3.0_TURBO", gap, 230);

      for (let i = 0; i < n; i++) {
        const s = comicData.scenes[i];
        const url = generatedImages[s.id];
        if (!url) continue;

        let x, y;
        if (aspectRatio === '9:16') {
          x = gap; 
          y = head + gap + i * (pSize + gap);
        } else {
          x = gap + (i % 2) * (pSize + gap); 
          y = head + gap + Math.floor(i / 2) * (pSize + gap);
        }

        const img = new Image();
        img.src = url;
        await new Promise(r => img.onload = r);

        // Shadow - Match "comic-shadow" utility
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x + 10, y + 10, pSize, pSize);

        // Panel Background/Border (bg-white border-[4px] border-white)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 4, y - 4, pSize + 8, pSize + 8);

        // Draw Image with Theme Filter (contrast(1.1) brightness(0.9))
        ctx.save();
        ctx.filter = 'contrast(1.1) brightness(0.9)';
        ctx.drawImage(img, x, y, pSize, pSize);
        ctx.restore();

        // Dialogue Bubble (Inside panel, relative to x, y)
        if (s.dialogue) {
          ctx.save();
          const padding = 60;
          const bubbleW = pSize - padding * 2;
          const bubbleH = 140;
          const bx = x + padding;
          const by = y + pSize - bubbleH - 40;

          // Draw polygon "dialogue-clip"
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + bubbleW, by);
          ctx.lineTo(bx + bubbleW, by + bubbleH * 0.85);
          ctx.lineTo(bx + bubbleW * 0.6, by + bubbleH * 0.85);
          ctx.lineTo(bx + bubbleW * 0.5, by + bubbleH); // The tail
          ctx.lineTo(bx + bubbleW * 0.4, by + bubbleH * 0.85);
          ctx.lineTo(bx, by + bubbleH * 0.85);
          ctx.closePath();

          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 6;
          ctx.stroke();

          // Text Layout
          ctx.fillStyle = '#000000';
          ctx.font = 'italic bold 28px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const words = s.dialogue.toUpperCase().split(' ');
          let line = '';
          let lines = [];
          const maxWidth = bubbleW - 60;
          
          for(let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            if (ctx.measureText(testLine).width > maxWidth && n > 0) {
              lines.push(line);
              line = words[n] + ' ';
            } else {
              line = testLine;
            }
          }
          lines.push(line);

          const lineHeight = 35;
          const startY = by + (bubbleH * 0.85) / 2 - ((lines.length - 1) * lineHeight) / 2;
          
          lines.forEach((l, idx) => {
            ctx.fillText(l.trim(), bx + bubbleW / 2, startY + idx * lineHeight);
          });
          ctx.restore();
        }

        // Panel Number (Top-Left, Match UI style)
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 15, y + 15, 60, 60);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeRect(x + 15, y + 15, 60, 60);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.id.toString(), x + 45, y + 45);
      }

      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setExportUrl(url);
        const a = document.createElement('a');
        a.download = `Comic_${comicData.title.replace(/\s+/g, '_')}_${Date.now()}.png`; 
        a.href = url; 
        a.click();
      });
    } catch (e) { 
      console.error("Export failed:", e); 
    } finally { 
      setExporting(false); 
    }
  };

  const successCount = Object.values(generatingStatus).filter(s => s === 'success').length;
  const progress = Math.round((successCount / (comicData.scenes.length || 1)) * 100);

  return (
    <div className="min-h-screen bg-bg text-ink selection:bg-accent/30 flex">
      {/* Sidebar - Theme specified layout */}
      <aside className="w-[280px] bg-black border-r border-white/10 p-10 flex flex-col gap-12 hidden lg:flex shrink-0">
        <div className="flex items-center gap-2.5 rotate-[-2deg]">
          <div className="w-8 h-8 bg-highlight text-black rounded flex items-center justify-center font-black">Z</div>
          <div className="font-display text-2xl tracking-tighter uppercase">Turbo Comic</div>
        </div>

        <ul className="space-y-6">
          {[
            { id: '01', label: 'Concept & Script', active: step === 'input' || step === 'script' },
            { id: '02', label: 'Char Design', active: step === 'script' },
            { id: '03', label: 'Turbo Render', active: step === 'images' },
            { id: '04', label: 'Final Assembly', active: step === 'final' }
          ].map((item) => (
            <li key={item.id} className={`flex items-center gap-4 transition-opacity ${item.active ? 'opacity-100' : 'opacity-40'}`}>
              <span className="font-display text-3xl leading-none">{item.id}</span>
              <span className="font-bold text-[10px] uppercase tracking-widest">{item.label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto space-y-4">
          <button 
            onClick={() => setStep('settings')}
            className={`w-full flex items-center gap-4 transition-all p-3 rounded-xl border border-white/5 hover:bg-white/5 ${step === 'settings' ? 'bg-white/10 opacity-100' : 'opacity-40'}`}
          >
            <Monitor size={20} className="text-highlight" />
            <span className="font-bold text-[10px] uppercase tracking-widest text-left">API Settings</span>
          </button>

          <div>
            <div className="text-[10px] font-extrabold uppercase text-white/40 mb-1">Engine status</div>
            <div className="font-mono text-sm text-highlight">GEMINI 3.0 TURBO</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-[radial-gradient(circle_at_top_right,#1a1a2e_0%,#0a0a0a_100%)] flex flex-col overflow-y-auto">
        <header className="h-20 border-b border-white/5 flex items-center justify-end px-10 sticky top-0 bg-[#050505]/80 backdrop-blur-xl z-50 lg:hidden">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setStep('input')}>
            <div className="p-2 bg-accent rounded-xl group-hover:scale-110 transition-transform">
              <Zap className="text-white fill-white" size={24} />
            </div>
          </div>
        </header>

        <div className="p-10 flex-1 flex flex-col gap-10">
          <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div 
              key="step-input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto space-y-12 py-12"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
                <motion.h2 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="font-display text-[84px] leading-[0.85] tracking-tighter uppercase text-highlight [text-shadow:4px_4px_0px_var(--color-accent)]"
                >
                  Create<br/>Your<br/>Comic
                </motion.h2>
                <div className="text-right">
                  <div className="text-[10px] font-extrabold uppercase text-white/40 mb-1">Project status</div>
                  <div className="font-mono text-sm text-white">READY_FOR_CONCEPT</div>
                </div>
              </div>

              <div className="bg-neutral-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-8 backdrop-blur-sm shadow-2xl relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
                
                {/* Mode Selector */}
                <div className="flex p-1.5 bg-black/40 rounded-2xl border border-white/5 max-w-sm mx-auto">
                  <button 
                    onClick={() => setMode('creative')}
                    className={`flex-1 py-3 rounded-xl font-bold text-[10px] tracking-widest transition-all gap-2 flex items-center justify-center ${mode === 'creative' ? 'bg-accent text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <Sparkles size={14} /> TỰ DO
                  </button>
                  <button 
                    onClick={() => setMode('education')}
                    className={`flex-1 py-3 rounded-xl font-bold text-[10px] tracking-widest transition-all gap-2 flex items-center justify-center ${mode === 'education' ? 'bg-accent text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <GraduationCap size={14} /> GIÁO DỤC
                  </button>
                </div>

                {mode === 'education' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest px-1">Cấp học</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { id: 'preschool', label: 'Mầm non' },
                        { id: 'elementary', label: 'Tiểu học' },
                        { id: 'middle', label: 'CS (6-9)' },
                        { id: 'high', label: 'PT (10-12)' }
                      ].map((lvl) => (
                        <button 
                          key={lvl.id}
                          onClick={() => setEducationLevel(lvl.id as EducationLevel)}
                          className={`py-3 rounded-xl font-bold text-[10px] border transition-all ${educationLevel === lvl.id ? 'bg-highlight border-highlight text-black' : 'border-white/5 text-neutral-500 hover:border-white/20'}`}
                        >
                          {lvl.label.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                <div className="space-y-4">
                  <div className="flex justify-between items-end px-1">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                      {mode === 'education' ? 'Nội dung bài giảng / File bài học' : 'Ý tưởng của bạn là gì?'}
                    </label>
                    {mode === 'education' && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 text-[10px] font-bold text-accent hover:text-white transition-colors"
                      >
                        <Upload size={14}/> TẢI FILE BÀI GIẢNG
                        <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.pdf,.doc,.docx" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Simple simulation of reading text
                            const reader = new FileReader();
                            reader.onload = (ev) => setUserInput(ev.target?.result as string);
                            reader.readAsText(file);
                          }
                        }}/>
                      </button>
                    )}
                  </div>
                  <textarea 
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder={mode === 'education' ? "Dán nội dung bài học hoặc kiến thức bạn muốn truyền đạt vào đây để AI chuyển thể thành truyện tranh..." : "Ví dụ: Một chú mèo phi hành gia khám phá hành tinh làm từ phô mai..."}
                    className="w-full h-44 bg-black/40 border border-white/10 p-6 rounded-3xl outline-none focus:border-accent/50 focus:ring-4 focus:ring-accent/10 transition-all text-xl resize-none placeholder:text-neutral-700"
                  />
                  {mode === 'education' && (
                    <p className="text-[10px] text-neutral-500 italic">AI sẽ phân tích nội dung bài giảng để tạo ra cốt truyện giáo dục hấp dẫn cho học sinh.</p>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-black/30 p-4 rounded-2xl border border-white/5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Số lượng khung hình</span>
                      <span className="text-xl font-black text-indigo-400">{panelCount} <span className="text-xs text-neutral-500">PHÂN CẢNH</span></span>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 4, 6].map(num => (
                        <button 
                          key={num}
                          onClick={() => setPanelCount(num)}
                          className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${panelCount === num ? 'bg-indigo-600 text-white' : 'bg-white/5 text-neutral-500 hover:bg-white/10'}`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="6" 
                    step="1"
                    value={panelCount} 
                    onChange={(e) => setPanelCount(Number(e.target.value))} 
                    className="w-full accent-indigo-600 bg-white/5 rounded-lg h-1.5 appearance-none cursor-pointer" 
                  />
                </div>

                <button 
                  onClick={handleGenerateScript} 
                  disabled={loading || !userInput.trim()} 
                  className="group w-full bg-white text-black font-black py-6 rounded-3xl flex items-center justify-center gap-3 hover:bg-neutral-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-xl shadow-white/5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={24} />
                      ĐANG LÊN KỊCH BẢN...
                    </>
                  ) : (
                    <>
                      TIẾP TỤC <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              <div className="flex justify-center gap-8 opacity-40">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><Sparkles size={14}/> Gemini AI</div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><ImageIcon size={14}/> Imagen Pro</div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><Zap size={14}/> Turbo Engine</div>
              </div>
            </motion.div>
          )}

          {step === 'script' && (
            <motion.div 
              key="step-script"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-5xl uppercase text-highlight [text-shadow:2px_2px_0px_var(--color-accent)]">{comicData.title}</h3>
                  <p className="text-neutral-500 font-bold uppercase text-[10px] tracking-widest mt-2">{panelCount} PANEL SCRIPT GENERATED</p>
                </div>
                <button onClick={() => setStep('input')} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors font-bold uppercase text-xs tracking-widest">
                  <ChevronLeft size={20}/> BACK
                </button>
              </div>

              <div className="bg-neutral-900/50 p-6 rounded-3xl border border-indigo-500/10 flex items-center gap-6 backdrop-blur-sm">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                  <User size={32}/>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Mô tả nhân vật (Consistency)</label>
                  <input 
                    value={comicData.characterDesign} 
                    onChange={(e) => setComicData({...comicData, characterDesign: e.target.value})} 
                    className="w-full bg-transparent font-bold text-xl outline-none text-white border-b border-white/5 focus:border-indigo-500 pb-1 transition-colors" 
                  />
                  <p className="text-[10px] text-neutral-600 mt-1">Dùng để giữ nhân vật giống nhau ở mọi khung hình</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {comicData.scenes.map((scene) => (
                  <motion.div 
                    key={scene.id} 
                    layout
                    className="bg-neutral-900/40 p-6 rounded-[2rem] border border-white/5 space-y-5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-xs font-black text-indigo-500 ring-1 ring-indigo-500/20">{scene.id}</span>
                        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">MÔ TẢ CẢNH</span>
                      </div>
                      <Edit3 size={16} className="text-neutral-700" />
                    </div>
                    <textarea 
                      value={scene.description} 
                      onChange={(e) => updateSceneData(scene.id, 'description', e.target.value)} 
                      className="w-full bg-transparent text-neutral-300 outline-none resize-none font-medium leading-relaxed" 
                      rows={3} 
                    />
                    <div className="bg-black/50 p-4 rounded-2xl flex items-start gap-3 border border-indigo-500/5 group focus-within:border-indigo-500/30 transition-all">
                      <div className="mt-1"><Type size={16} className="text-indigo-400" /></div>
                      <div className="flex-1">
                        <span className="text-[8px] font-bold text-neutral-600 uppercase block mb-1">Lời thoại / Chữ trong khung</span>
                        <input 
                          value={scene.dialogue} 
                          onChange={(e) => updateSceneData(scene.id, 'dialogue', e.target.value)} 
                          className="w-full bg-transparent text-sm font-bold outline-none text-white placeholder:text-neutral-700" 
                          placeholder="Nhập lời thoại..."
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <button 
                onClick={startTurboGeneration} 
                className="w-full bg-indigo-600 text-white font-black py-8 rounded-[2.5rem] shadow-2xl flex items-center justify-center gap-4 hover:bg-indigo-700 active:scale-[0.98] transition-all text-xl group"
              >
                <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform">
                  <Zap size={24} className="fill-white" />
                </div>
                BẮT ĐẦU VẼ SONG SONG SIÊU TỐC
              </button>
            </motion.div>
          )}

          {step === 'images' && (
            <motion.div 
              key="step-images"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="bg-neutral-900/60 p-12 rounded-[3.5rem] text-center space-y-6 max-w-2xl mx-auto border border-white/5 backdrop-blur-md shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
                
                <div className="space-y-2 relative pt-4">
                  <div className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">Processing Engine</div>
                  <div className="font-display text-7xl tabular-nums tracking-tighter italic text-white">{progress}%</div>
                </div>

                <div className="px-4">
                  <div className="w-full bg-black/60 h-4 rounded-full overflow-hidden p-1 border border-white/5 ring-4 ring-accent/5">
                    <motion.div 
                      className="h-full bg-highlight rounded-full shadow-[0_0_20px_rgba(250,204,21,0.5)]" 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ type: 'spring', damping: 20, stiffness: 60 }}
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-center gap-3 text-neutral-400 font-bold text-sm">
                  <Loader2 className="animate-spin" size={18} />
                  RENDERING PANELS ({successCount}/{panelCount})
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {comicData.scenes.map((scene) => (
                  <motion.div 
                    key={scene.id} 
                    layout
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="aspect-square bg-neutral-900 rounded-3xl border border-white/5 overflow-hidden relative group shadow-lg"
                  >
                    <AnimatePresence mode="wait">
                      {generatedImages[scene.id] ? (
                        <motion.img 
                          key={`img-${scene.id}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          src={generatedImages[scene.id]} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <motion.div 
                          key={`loading-${scene.id}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="w-full h-full flex flex-col items-center justify-center p-6 space-y-4"
                        >
                          {generatingStatus[scene.id] === 'error' ? (
                            <button 
                              onClick={() => drawImageTask(scene)} 
                              className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90"
                            >
                              <RefreshCw size={24}/>
                            </button>
                          ) : (
                            <div className="relative">
                              <Loader2 className="animate-spin text-indigo-500" size={32} />
                              <div className="absolute inset-0 blur-lg bg-indigo-500/20 animate-pulse" />
                            </div>
                          )}
                          <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">KHUNG {scene.id}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {generatingStatus[scene.id] === 'success' && (
                      <div className="absolute top-4 right-4 bg-green-500 text-white rounded-xl p-1.5 shadow-lg">
                        <CheckCircle2 size={14}/>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {progress === 100 && (
                <motion.button 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setStep('final')} 
                  className="w-full bg-white text-black font-black py-8 rounded-[2.5rem] shadow-2xl flex items-center justify-center gap-4 text-2xl hover:scale-[1.02] active:scale-95 transition-all animate-bounce-slow"
                >
                  <Layout size={28} /> HOÀN THÀNH TRANG TRUYỆN
                </motion.button>
              )}
            </motion.div>
          )}

          {step === 'final' && (
            <motion.div 
              key="step-final"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="flex flex-wrap items-center justify-between gap-6 bg-neutral-900/60 p-6 rounded-[2.5rem] border border-white/5 sticky top-24 z-40 backdrop-blur-xl shadow-xl">
                <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5">
                  <button 
                    onClick={() => setAspectRatio('9:16')} 
                    className={`px-6 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all ${aspectRatio === '9:16' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <Smartphone className="inline-block mr-2" size={14}/> 9:16 DỌC
                  </button>
                  <button 
                    onClick={() => setAspectRatio('16:9')} 
                    className={`px-6 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all ${aspectRatio === '16:9' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <Monitor className="inline-block mr-2" size={14}/> 16:9 NGANG
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={exportAsPoster} 
                    disabled={exporting} 
                    className="group bg-white text-black px-10 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition-all shadow-xl shadow-white/5"
                  >
                    {exporting ? <Loader2 className="animate-spin" size={20} /> : <FileImage size={20} />} 
                    {exporting ? "ĐANG XUẤT..." : "TẢI VỀ PNG (4K)"}
                  </button>
                  <button 
                    onClick={() => {
                      setSavedComics(prev => [...prev, { ...comicData, images: generatedImages, id: Date.now().toString(), createdAt: new Date().toISOString() }]);
                      setStep('history');
                    }} 
                    className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 active:scale-95 transition-all shadow-xl shadow-indigo-500/20"
                  >
                    <Save size={24}/>
                  </button>
                </div>
              </div>

              <div className={`mx-auto bg-black p-4 md:p-16 rounded-[4rem] transition-all duration-700 relative overflow-hidden ring-1 ring-white/10 ${aspectRatio === '9:16' ? 'max-w-2xl' : 'max-w-6xl'}`}>
                {/* Decorative Elements for the Poster */}
                <div className="absolute top-0 left-0 w-full h-2 bg-accent" />
                <div className="absolute bottom-0 right-0 p-8 opacity-10 font-black text-2xl tracking-tighter">TURBO.AI</div>

                <div className="flex justify-between items-end mb-20">
                  <motion.h3 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="font-display text-[84px] leading-[0.85] tracking-tighter uppercase text-highlight [text-shadow:4px_4px_0px_var(--color-accent)]"
                  >
                    {comicData.title.split(' ').map((word, i) => (
                      <span key={i} className="block">{word}</span>
                    ))}
                  </motion.h3>
                  
                  <div className="text-right">
                    <div className="text-[10px] font-extrabold uppercase text-white/40 mb-1">Assembly v1.02</div>
                    <div className="font-mono text-sm text-white">4K_RENDER_QUAL</div>
                  </div>
                </div>

                <div className={`${aspectRatio === '9:16' ? 'flex flex-col gap-16' : 'grid grid-cols-2 gap-12'}`}>
                  {comicData.scenes.map((scene, idx) => (
                    <motion.div 
                      key={scene.id} 
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="relative bg-white border-[4px] border-white group comic-shadow"
                    >
                      <img src={generatedImages[scene.id]} className="w-full h-auto block filter contrast-[1.1] brightness-[0.9]" />
                      
                      {scene.dialogue && (
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="bg-white p-2.5 pb-4 border-[3px] border-black dialogue-clip">
                            <p className="font-extrabold font-sans text-xs md:text-sm text-black text-center uppercase tracking-tight leading-none italic">
                              {scene.dialogue}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Scene Number Indicator */}
                      <div className="absolute top-2.5 left-2.5 w-6 h-6 bg-black text-white flex items-center justify-center font-display text-sm border-2 border-white">
                        {scene.id}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center flex-col items-center gap-6 py-12">
                <p className="text-neutral-500 font-bold text-sm tracking-widest uppercase">Bạn muốn phát triển thêm câu chuyện?</p>
                <div className="flex flex-wrap justify-center gap-4">
                  <button onClick={() => setStep('input')} className="text-white bg-white/5 px-8 py-3 rounded-xl font-bold hover:bg-white/10 transition-all border border-white/10">BẮT ĐẦU MỚI</button>
                  <button onClick={handleContinueStory} className="text-white bg-accent px-8 py-3 rounded-xl font-black hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2">
                    <BookOpen size={18}/> VIẾT TIẾP CÂU CHUYỆN
                  </button>
                  <button onClick={handleSimilarJourney} className="text-highlight font-bold px-8 py-3 rounded-xl border border-highlight/20 hover:bg-highlight/5 transition-all flex items-center gap-2">
                    <RefreshCw size={18}/> HÀNH TRÌNH TƯƠNG TỰ
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'settings' && (
            <motion.div 
              key="step-settings"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto py-12 space-y-12"
            >
              <div className="flex flex-col gap-2">
                <h2 className="font-display text-[64px] leading-none tracking-tighter uppercase text-highlight [text-shadow:4px_4px_0px_var(--color-accent)]">
                  Engine<br/>Config
                </h2>
                <p className="text-neutral-500 font-bold text-xs uppercase tracking-widest">Cấu hình API Key để sử dụng các tính năng AI mở rộng.</p>
              </div>

              <div className="bg-neutral-900/50 p-10 rounded-[3rem] border border-white/10 space-y-10 shadow-2xl backdrop-blur-md">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Gemini API Key</label>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-accent font-bold hover:underline">Lấy Key tại đây</a>
                  </div>
                  <input 
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="Dán AI Studio API Key của bạn..."
                    className="w-full bg-black/60 border border-white/10 p-5 rounded-2xl outline-none focus:border-accent font-mono text-sm tracking-widest"
                  />
                  <p className="text-[10px] text-white/20 italic font-medium leading-relaxed">
                    * Lưu ý: API Key của bạn sẽ được lưu an toàn trong trình duyệt (LocalStorage). Chúng tôi không lưu trữ Key này trên máy chủ.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setStep('input')}
                    className="py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-white/5 text-neutral-400 hover:bg-white/10 transition-all"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    onClick={handleSaveApiKey}
                    className="py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-accent text-white hover:bg-indigo-700 shadow-xl shadow-accent/10 transition-all"
                  >
                    Lưu cấu hình
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'history' && (
            <motion.div 
              key="step-history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-4xl font-black flex items-center gap-4 italic uppercase">
                  <div className="p-2 bg-indigo-600/20 rounded-2xl">
                    <Clock className="text-indigo-400" size={32}/> 
                  </div>
                  THƯ VIỆN TRUYỆN TRANH
                </h2>
                <button onClick={() => setStep('input')} className="text-indigo-400 font-bold">XEM THÊM CÔNG CỤ</button>
              </div>

              {savedComics.length === 0 ? (
                <div className="py-32 text-center space-y-4">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8">
                    <History className="text-neutral-700" size={40}/>
                  </div>
                  <h3 className="text-xl font-bold text-neutral-400">Chưa có truyện nào được lưu.</h3>
                  <button onClick={() => setStep('input')} className="text-indigo-500 font-black tracking-widest uppercase text-xs hover:underline decoration-2 underline-offset-8">Bắt đầu sáng tạo ngay</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {savedComics.map((comic) => (
                    <motion.div 
                      key={comic.id} 
                      whileHover={{ y: -8 }}
                      className="bg-neutral-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 group relative transition-all"
                    >
                      <div className="aspect-[4/3] bg-black relative overflow-hidden">
                        {comic.images && (
                          <img 
                            src={Object.values(comic.images)[0] as string} 
                            className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700" 
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                        <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-500 backdrop-blur-[2px]">
                          <button 
                            onClick={() => { 
                              setComicData(comic); 
                              setGeneratedImages(comic.images); 
                              setStep('final'); 
                            }} 
                            className="bg-white text-black w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform"
                          >
                            <BookOpen size={24}/>
                          </button>
                        </div>
                      </div>
                      <div className="p-8 flex justify-between items-center">
                        <div>
                          <h4 className="font-black truncate uppercase text-lg italic text-white group-hover:text-indigo-400 transition-colors">{comic.title}</h4>
                          <p className="text-[10px] font-bold text-neutral-500 mt-1 uppercase tracking-widest">{comic.scenes.length} KHUNG HÌNH • {new Date(comic.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button 
                          onClick={() => setSavedComics(prev => prev.filter(c => c.id !== comic.id))} 
                          className="w-10 h-10 rounded-xl bg-white/5 text-neutral-600 hover:bg-red-500/10 hover:text-red-500 transition-all flex items-center justify-center"
                        >
                          <Trash2 size={18}/>
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Export Preview Modal */}
      <AnimatePresence>
        {exportUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/98 flex flex-col items-center justify-center p-6 backdrop-blur-3xl"
          >
            <button 
              onClick={() => { 
                URL.revokeObjectURL(exportUrl); 
                setExportUrl(null); 
              }} 
              className="absolute top-8 right-8 text-white bg-white/10 p-3 rounded-full hover:bg-indigo-600 transition-colors"
            >
              <X size={32}/>
            </button>
            
            <div className="text-white mb-10 text-center space-y-2">
              <div className="bg-indigo-500/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-indigo-400" />
              </div>
              <h4 className="text-2xl font-black italic uppercase italic">Sẵn sàng khám phá</h4>
              <p className="text-neutral-500 text-sm font-medium">Nếu file không tự tải, hãy ấn giữ vào ảnh rồi chọn "Lưu hình ảnh"</p>
            </div>

            <div className="max-w-4xl w-full max-h-[60vh] overflow-y-auto rounded-[2rem] border-4 border-white/10 shadow-[0_0_80px_rgba(99,102,241,0.2)] scrollbar-hide">
              <img src={exportUrl} className="w-full h-auto block" />
            </div>

            <button 
              onClick={() => { 
                URL.revokeObjectURL(exportUrl); 
                setExportUrl(null); 
              }} 
              className="mt-12 bg-white text-black px-16 py-5 rounded-[2rem] font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-2xl"
            >
              HOÀN TẤT
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="py-12 px-6 border-t border-white/5 opacity-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-indigo-500" />
            <span className="text-[10px] font-black tracking-[0.2em] uppercase">Built with Turbo Comic AI Engine</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest">© 2026 AI Studio Build • All Rights Reserved</p>
        </div>
      </footer>
    </main>
  </div>
  );
}

