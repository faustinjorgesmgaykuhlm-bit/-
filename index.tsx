import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Upload, Highlighter, Play, Eye, Keyboard, Check, X, ArrowLeft, Moon, Sun, Image as ImageIcon, Trash2, Globe } from 'lucide-react';

// --- Types ---
interface TextRange {
  id: string;
  start: number;
  end: number;
  text: string;
  translation?: string;
}

type AppStep = 'input' | 'select' | 'play';
type PlayMode = 'hover' | 'quiz';
type Theme = 'light' | 'dark';

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const expandSelectionToWord = (text: string, start: number, end: number): { start: number; end: number } => {
  // Generic word character regex (Latin-1 Supplement for most European langs)
  const isWordChar = (char: string) => /^[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\-'’]$/.test(char);

  let newStart = start;
  let newEnd = end;

  // If clicked without drag, just expand
  // If dragged, we still expand to ensure clean word boundaries
  
  // Expand start backward
  while (newStart > 0 && isWordChar(text[newStart - 1])) {
    newStart--;
  }

  // Expand end forward
  while (newEnd < text.length && isWordChar(text[newEnd])) {
    newEnd++;
  }

  return { start: newStart, end: newEnd };
};

const getSelectionRange = (container: HTMLElement): { start: number; end: number } | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const preSelectionRange = range.cloneRange();
  preSelectionRange.selectNodeContents(container);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);
  
  const start = preSelectionRange.toString().length;
  const rawEnd = start + range.toString().length;

  return { start, end: rawEnd };
};

const splitTextByRanges = (text: string, ranges: TextRange[]) => {
  const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);
  const segments: { type: 'text' | 'highlight'; content: string; range?: TextRange }[] = [];
  
  let currentIndex = 0;

  for (const range of sortedRanges) {
    if (range.start < currentIndex) continue;

    if (range.start > currentIndex) {
      segments.push({
        type: 'text',
        content: text.slice(currentIndex, range.start)
      });
    }
    segments.push({
      type: 'highlight',
      content: text.slice(range.start, range.end),
      range
    });
    currentIndex = range.end;
  }

  if (currentIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(currentIndex)
    });
  }

  return segments;
};

// --- Main Component ---

const App = () => {
  const [step, setStep] = useState<AppStep>('input');
  const [text, setText] = useState<string>('');
  const [ranges, setRanges] = useState<TextRange[]>([]);
  const [playMode, setPlayMode] = useState<PlayMode>('hover');
  
  // Customization State
  const [theme, setTheme] = useState<Theme>('light');
  const [bgImage, setBgImage] = useState<string | null>(null);

  const textContainerRef = useRef<HTMLDivElement>(null);

  // --- Theme Classes & Logic ---
  const isCustomBg = !!bgImage;

  const appClasses = {
    container: isCustomBg 
      ? "min-h-screen transition-colors duration-300 bg-cover bg-center bg-fixed bg-no-repeat"
      : `min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-[#1a1a1a] text-[#bfbfbf]' : 'bg-slate-50 text-slate-900'}`,
    
    card: isCustomBg
      ? `backdrop-blur-xl border transition-all duration-300 ${theme === 'dark' ? 'bg-black/70 border-white/10 text-gray-200' : 'bg-white/80 border-white/40 text-slate-900'} shadow-2xl`
      : `transition-all duration-300 ${theme === 'dark' ? 'bg-[#252525] border border-[#333] text-[#bfbfbf]' : 'bg-white border border-slate-100 text-slate-800'} shadow-xl`,
    
    header: isCustomBg
      ? `backdrop-blur-md border-b transition-colors duration-300 ${theme === 'dark' ? 'bg-black/60 border-white/10' : 'bg-white/60 border-white/20'}`
      : `border-b transition-colors duration-300 ${theme === 'dark' ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-slate-200'}`,

    input: isCustomBg
      ? `w-full h-64 p-6 rounded-xl border outline-none transition-all resize-none text-lg leading-relaxed placeholder-opacity-50 ${theme === 'dark' ? 'bg-black/40 border-white/10 text-white placeholder-gray-400 focus:bg-black/60' : 'bg-white/50 border-white/30 text-slate-900 placeholder-slate-500 focus:bg-white/70'}`
      : `w-full h-64 p-6 rounded-xl border outline-none transition-all resize-none text-lg leading-relaxed shadow-inner ${theme === 'dark' ? 'bg-[#1e1e1e] border-[#333] text-gray-200 placeholder-gray-600 focus:bg-[#252525] focus:border-gray-500' : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:bg-white focus:border-blue-400'}`,

    highlight: theme === 'dark' 
      ? "bg-yellow-900/60 text-yellow-100 border-yellow-700 hover:bg-yellow-900/80" 
      : "bg-yellow-200 text-slate-900 border-yellow-400 hover:bg-yellow-300",

    textPrimary: theme === 'dark' ? 'text-gray-200' : 'text-slate-800',
    textSecondary: theme === 'dark' ? 'text-gray-500' : 'text-slate-500',
    
    buttonPrimary: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all",
    buttonGhost: theme === 'dark' ? "text-gray-400 hover:text-gray-200" : "text-slate-400 hover:text-slate-700",
  };

  const rootStyle = isCustomBg ? { backgroundImage: `url(${bgImage})` } : {};

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setText(event.target?.result as string || '');
    reader.readAsText(file);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setBgImage(event.target?.result as string || null);
    reader.readAsDataURL(file);
  };

  const removeRange = (id: string) => {
    setRanges(prev => prev.filter(r => r.id !== id));
  };

  const handleSelection = () => {
    if (!textContainerRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const rangeInfo = getSelectionRange(textContainerRef.current);
    if (!rangeInfo) return;

    // 1. Expand selection to word boundaries
    const { start, end } = expandSelectionToWord(text, rangeInfo.start, rangeInfo.end);
    if (start >= end) return;

    // Check for overlaps
    const hasOverlap = ranges.some(r => 
      (start >= r.start && start < r.end) || 
      (end > r.start && end <= r.end) ||
      (start <= r.start && end >= r.end)
    );

    if (hasOverlap) {
      selection.removeAllRanges();
      return;
    }

    const selectedText = text.slice(start, end);
    const newId = generateId();

    // Prompt for translation since AI is removed
    // A simple timeout helps ensure the selection UI clears before prompt appears, 
    // though in React synthetic events it's usually fine.
    // Using simple prompt for "No AI" version as requested.
    const note = window.prompt(`Add a translation or note for:\n"${selectedText}"\n(Leave empty to just mask)`);

    const newRange: TextRange = { 
      id: newId, 
      start, 
      end, 
      text: selectedText,
      translation: note || ""
    };

    setRanges([...ranges, newRange]);
    selection.removeAllRanges();
  };

  // --- Common Header Controls ---
  const HeaderControls = () => (
    <div className="flex items-center space-x-2">
      <label className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer transition-colors" title="Set Background Image">
        <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
        <ImageIcon size={20} className={theme === 'dark' || isCustomBg ? 'text-gray-300' : 'text-slate-500'} />
      </label>
      {bgImage && (
        <button onClick={() => setBgImage(null)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors" title="Remove Background">
          <Trash2 size={20} className={theme === 'dark' || isCustomBg ? 'text-gray-300' : 'text-slate-500'} />
        </button>
      )}
      <button 
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
        className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        title="Toggle Night Mode"
      >
        {theme === 'light' 
          ? <Moon size={20} className={isCustomBg ? 'text-gray-800' : 'text-slate-500'} /> 
          : <Sun size={20} className="text-gray-300" />
        }
      </button>
    </div>
  );

  // --- Views ---

  if (step === 'input') {
    return (
      <div className={appClasses.container} style={rootStyle}>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className={`max-w-3xl w-full p-8 space-y-6 rounded-2xl ${appClasses.card}`}>
            <div className="flex justify-between items-start">
               <div className="space-y-2">
                 <div className="flex items-center space-x-2 text-blue-500 mb-1">
                    <Globe size={24} />
                 </div>
                 <h1 className={`text-3xl font-bold ${isCustomBg || theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>Cloze Master</h1>
                 <p className={appClasses.textSecondary}>Master vocabulary in context. Manual Mode.</p>
               </div>
               <HeaderControls />
            </div>

            <div className="space-y-4">
               <textarea
                className={appClasses.input}
                placeholder="Paste your text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              
              <div className="flex items-center justify-between">
                <label className={`flex items-center space-x-2 text-sm cursor-pointer transition-colors ${appClasses.textSecondary} hover:text-blue-500`}>
                  <Upload size={18} />
                  <span>Upload .txt file</span>
                  <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
                </label>
                
                <button
                  disabled={!text.trim()}
                  onClick={() => setStep('select')}
                  className={`flex items-center space-x-2 px-8 py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed ${appClasses.buttonPrimary}`}
                >
                  <Highlighter size={20} />
                  <span>Start Selecting</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'select') {
    const segments = splitTextByRanges(text, ranges);

    return (
      <div className={`${appClasses.container} flex flex-col`} style={rootStyle}>
        <div className={`${appClasses.header} sticky top-0 z-20`}>
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <button onClick={() => setStep('input')} className={`${appClasses.buttonGhost} transition-colors`}>
                  <ArrowLeft size={24} />
                </button>
                <HeaderControls />
             </div>
             
             <div className="flex items-center space-x-3">
                <span className={`text-sm font-medium ${appClasses.textSecondary} hidden sm:block`}>
                  {ranges.length} selected
                </span>

                <button
                  onClick={() => setStep('play')}
                  disabled={ranges.length === 0}
                  className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium disabled:opacity-50 ${appClasses.buttonPrimary}`}
                >
                  <Play size={18} fill="currentColor" />
                  <span>Learn</span>
                </button>
             </div>
          </div>
        </div>

        <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8">
           <div 
            ref={textContainerRef}
            onMouseUp={handleSelection}
            className={`rounded-2xl p-8 md:p-12 text-xl leading-loose select-text cursor-text min-h-[60vh] whitespace-pre-wrap ${appClasses.card} ${appClasses.textPrimary}`}
           >
             {segments.map((segment, idx) => {
               if (segment.type === 'highlight' && segment.range) {
                 return (
                   <span key={segment.range.id} className="inline-flex flex-col mx-1 align-middle group relative">
                      <span className={`px-1 rounded cursor-pointer border-b-2 transition-colors relative ${appClasses.highlight}`}>
                        {segment.content}
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeRange(segment.range!.id); }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                        >
                          <X size={12} />
                        </button>
                      </span>
                      {segment.range.translation && (
                         <span className={`text-xs font-medium mt-1 select-none ${appClasses.textSecondary}`}>
                            {segment.range.translation}
                         </span>
                      )}
                   </span>
                 );
               }
               return <span key={idx}>{segment.content}</span>;
             })}
           </div>
           <div className={`mt-4 text-center text-sm ${appClasses.textSecondary}`}>
              Tip: Select text to highlight it. You can add a translation or note.
           </div>
        </div>
      </div>
    );
  }

  // --- Play/Learning Mode ---
  if (step === 'play') {
    const segments = splitTextByRanges(text, ranges);

    return (
      <div className={`${appClasses.container} flex flex-col`} style={rootStyle}>
        <div className={`${appClasses.header} sticky top-0 z-20`}>
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <button onClick={() => setStep('select')} className={`${appClasses.buttonGhost} transition-colors flex items-center gap-1`}>
                  <ArrowLeft size={20} /> <span>Edit</span>
                </button>
                <HeaderControls />
             </div>
             
             <div className="flex items-center space-x-3">
               <div className={`p-1 rounded-lg flex space-x-1 ${theme === 'dark' ? 'bg-[#333]' : 'bg-slate-100'}`}>
                 <button
                   onClick={() => setPlayMode('hover')}
                   className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                     playMode === 'hover' 
                       ? (theme === 'dark' ? 'bg-[#444] text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm') 
                       : (theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-slate-500 hover:text-slate-700')
                   }`}
                 >
                   <Eye size={16} /> <span className="hidden sm:inline">Hover</span>
                 </button>
                 <button
                   onClick={() => setPlayMode('quiz')}
                   className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                     playMode === 'quiz' 
                       ? (theme === 'dark' ? 'bg-[#444] text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm') 
                       : (theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-slate-500 hover:text-slate-700')
                   }`}
                 >
                   <Keyboard size={16} /> <span className="hidden sm:inline">Quiz</span>
                 </button>
               </div>
             </div>
          </div>
        </div>

        <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8">
           <div className={`rounded-2xl p-8 md:p-12 text-xl leading-loose min-h-[60vh] whitespace-pre-wrap ${appClasses.card}`}>
             {segments.map((segment, idx) => {
               if (segment.type === 'highlight' && segment.range) {
                 return (
                   <InteractiveWord 
                     key={segment.range.id} 
                     range={segment.range} 
                     mode={playMode}
                     theme={theme}
                     isCustomBg={isCustomBg}
                   />
                 );
               }
               return <span key={idx} className={appClasses.textPrimary}>{segment.content}</span>;
             })}
           </div>
        </div>
      </div>
    );
  }

  return null;
};

// --- Sub-components ---

interface InteractiveWordProps {
  range: TextRange;
  mode: PlayMode;
  theme: Theme;
  isCustomBg: boolean;
}

const InteractiveWord: React.FC<InteractiveWordProps> = ({ range, mode, theme, isCustomBg }) => {
  const [input, setInput] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const checkAnswer = () => {
    const cleanInput = input.trim().toLowerCase();
    const cleanTarget = range.text.trim().toLowerCase();
    setIsCorrect(cleanInput === cleanTarget);
  };

  if (mode === 'hover') {
    // Hidden state: Text color matches bg color so it's invisible but takes up space.
    // Dark mode: bg-[#333], text-[#333]
    // Light mode: bg-slate-900, text-slate-900
    
    // Hover state: Reveal.
    const baseClass = theme === 'dark' 
      ? "bg-[#333] text-[#333] hover:bg-yellow-800 hover:text-yellow-100" 
      : "bg-slate-900 text-slate-900 hover:bg-yellow-300 hover:text-slate-900";

    return (
      <span className="relative inline-block group mx-1 align-middle">
        <span className={`${baseClass} rounded px-1.5 py-0.5 cursor-help transition-all duration-200 select-none`}>
          {range.text}
        </span>
        
        {/* Tooltip - Only show if translation exists */}
        {range.translation && (
          <span className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 text-sm p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30 pointer-events-none text-center ${theme === 'dark' ? 'bg-gray-800 text-gray-100 border border-gray-700' : 'bg-slate-800 text-white'}`}>
            <div className={`font-semibold mb-1 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-300'}`}>{range.text}</div>
            <div className="opacity-80 text-xs">{range.translation}</div>
          </span>
        )}
      </span>
    );
  }

  // Quiz Mode
  return (
    <span className="inline-block mx-1 relative">
      {!isCorrect && !showAnswer ? (
        <div className="inline-flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setIsCorrect(null); }}
            onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
            onBlur={checkAnswer}
            style={{ width: `${Math.max(range.text.length, 4)}ch` }}
            className={`border-b-2 text-center outline-none px-1 py-0.5 rounded-t transition-colors ${
              theme === 'dark' ? 'bg-gray-800 text-gray-100' : 'bg-slate-100 text-slate-900'
            } ${
              isCorrect === false 
                ? 'border-red-500 bg-red-900/20' 
                : (theme === 'dark' ? 'border-gray-600 focus:border-blue-400' : 'border-blue-300 focus:border-blue-600')
            }`}
            autoComplete="off"
          />
        </div>
      ) : (
        <span 
          className={`px-1.5 py-0.5 rounded font-medium cursor-pointer ${
            isCorrect 
              ? (theme === 'dark' ? 'text-green-400 bg-green-900/30' : 'text-green-600 bg-green-50') 
              : (theme === 'dark' ? 'text-gray-100 bg-yellow-900/60' : 'text-slate-800 bg-yellow-200')
          }`}
          onClick={() => { setIsCorrect(null); setShowAnswer(false); setInput(''); }}
        >
          {range.text}
          {isCorrect && <Check size={14} className="inline ml-1" />}
        </span>
      )}
      
      {isCorrect === false && !showAnswer && (
        <button 
          onClick={() => setShowAnswer(true)}
          className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs bg-black text-white px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap z-20"
        >
          Show Answer
        </button>
      )}
    </span>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}