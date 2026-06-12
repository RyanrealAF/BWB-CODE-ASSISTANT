import React, { useState, useEffect, useRef } from 'react';
import { Settings, Send, Terminal, FileText, Database, ChevronRight, Sparkles, MessageSquare, Sliders } from 'lucide-react';

const INITIAL_MESSAGES = [
  { id: 1, role: 'system', content: 'BWB Studio: Engine initialized. Ollama context detected at localhost:11434.' },
];

export default function App() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [attributes, setAttributes] = useState({
    provider: 'local',
    model: 'qwen3:1.7b',
    temperature: 0.7,
    tone: 'professional',
    verbosity: 5,
    mythEngine: true,
    systemPrompt: 'You are the BWB coding assistant. Be precise, gritty, and technically accurate.'
  });
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newUserMessage = { id: Date.now(), role: 'user', content: input };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');

    setTimeout(() => {
      const response = { 
        id: Date.now() + 1, 
        role: 'assistant', 
        content: `Acknowledged. Processing with tone: ${attributes.tone}, Myth Engine: ${attributes.mythEngine ? 'Active' : 'Inactive'}.` 
      };
      setMessages(prev => [...prev, response]);
    }, 800);
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-mono overflow-hidden">
      
      {/* Sidebar: Context */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-zinc-900 border-r border-zinc-800 transition-all duration-300 overflow-hidden`}>
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2 font-bold text-zinc-100">
          <FileText size={16} className="text-indigo-500" /> Context
        </div>
        <div className="p-4 space-y-2">
          {['src/engine.ts', 'src/persistence.ts', 'repl.ts'].map(file => (
            <div key={file} className="text-xs text-zinc-500 hover:text-indigo-400 cursor-pointer py-1 truncate border-l border-zinc-800 pl-3">
              {file}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
        <header className="h-14 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-950">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-zinc-800 rounded transition-colors">
            <Terminal size={18} className="text-zinc-400" />
          </button>
          <h1 className="font-bold text-zinc-400 tracking-tighter">BWB_STUDIO_V1</h1>
          <div className="w-8" /> 
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-sm border ${msg.role === 'user' ? 'bg-indigo-950/30 border-indigo-500/50 text-indigo-100' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-zinc-950 border-t border-zinc-800">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-sm p-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              placeholder="Inject command..."
            />
            <button onClick={handleSend} className="bg-indigo-600 hover:bg-indigo-700 p-3 rounded-sm transition-colors">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Attributes Panel: Extended Controls */}
      <div className="w-80 bg-zinc-900 border-l border-zinc-800 p-6 space-y-8 overflow-y-auto">
        <div className="flex items-center gap-2 font-bold text-zinc-100">
          <Settings size={18} className="text-indigo-500" /> Studio Attributes
        </div>

        <div className="space-y-6">
          {/* Provider & Model */}
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Inference Provider</label>
              <select className="w-full bg-zinc-950 border border-zinc-700 p-2 rounded-sm text-xs" value={attributes.provider} onChange={(e) => setAttributes({...attributes, provider: e.target.value})}>
                <option value="local">Local (Ollama)</option>
                <option value="groq">Remote (Groq)</option>
              </select>
            </div>
          </div>

          {/* Tone & Verbosity */}
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-2">
                <MessageSquare size={12}/> Tone
              </label>
              <select className="w-full bg-zinc-950 border border-zinc-700 p-2 rounded-sm text-xs" value={attributes.tone} onChange={(e) => setAttributes({...attributes, tone: e.target.value})}>
                <option value="professional">Professional</option>
                <option value="gritty">Gritty / Technical</option>
                <option value="urban_myth">Urban Myth / Surreal</option>
                <option value="sarcastic">Sarcastic</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex justify-between">
                Verbosity <span>{attributes.verbosity}</span>
              </label>
              <input type="range" min="1" max="10" value={attributes.verbosity} className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-indigo-500" onChange={(e) => setAttributes({...attributes, verbosity: e.target.value})} />
            </div>
          </div>

          {/* Engine Toggles */}
          <div className="pt-4 border-t border-zinc-800 space-y-3">
             <label className="flex items-center gap-3 cursor-pointer">
               <input type="checkbox" checked={attributes.mythEngine} onChange={() => setAttributes({...attributes, mythEngine: !attributes.mythEngine})} className="accent-indigo-500" />
               <span className="text-xs text-zinc-400 flex items-center gap-2"><Sparkles size={12}/> Enable Urban Myth Engine</span>
             </label>
          </div>

          <button className="w-full py-2 bg-indigo-950/30 hover:bg-indigo-900/50 border border-indigo-500/50 text-indigo-400 rounded-sm text-xs font-semibold flex items-center justify-center gap-2 transition-all">
            <Database size={12}/> Sync State
          </button>
        </div>
      </div>
    </div>
  );
}