import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Send,
  Terminal,
  FileText,
  Database,
  Sparkles,
  MessageSquare,
  RefreshCw,
  Layers,
  CheckCircle,
  AlertCircle,
  Eye,
  Trash2,
  Code
} from 'lucide-react';

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: 'system',
    content: 'BWB Studio initialized. Google Gemini & Urban Myth Engine online. Select context files on the left or type a prompt / :myth command below.'
  },
];

export default function App() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Workspace files
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState(['engine/urban-myth-engine.js', 'bwb.js']);
  
  // Archetypes state
  const [archetypes, setArchetypes] = useState([]);
  const [showArchetypesModal, setShowArchetypesModal] = useState(false);
  const [serverHealth, setServerHealth] = useState(null);

  const [attributes, setAttributes] = useState({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    tone: 'gritty',
    verbosity: 5,
    mythEngine: true,
  });

  const chatEndRef = useRef(null);

  // Initial load
  useEffect(() => {
    fetchHealth();
    fetchFiles();
    fetchArchetypes();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setServerHealth(data);
      }
    } catch (_) {}
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data = await res.json();
        setWorkspaceFiles(data.files || []);
      }
    } catch (_) {}
  };

  const fetchArchetypes = async () => {
    try {
      const res = await fetch('/api/myth/archetypes');
      if (res.ok) {
        const data = await res.json();
        setArchetypes(data.archetypes || []);
      }
    } catch (_) {}
  };

  const toggleFile = (file) => {
    setSelectedFiles(prev =>
      prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file]
    );
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    const newUserMessage = { id: Date.now(), role: 'user', content: userText };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: messages.filter(m => m.role !== 'system'),
          tone: attributes.tone,
          verbosity: Number(attributes.verbosity),
          mythEngine: attributes.mythEngine,
          contextFiles: selectedFiles,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const assistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.response,
          mythResult: data.mythResult,
        };
        setMessages(prev => [...prev, assistantMessage]);
        if (data.mythResult) {
          fetchArchetypes();
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            role: 'assistant',
            content: `[Error: ${data.error || 'Failed to process command'}]`,
          },
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: `[Network Error: ${err.message}]`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetArchetypes = async () => {
    try {
      const res = await fetch('/api/myth/reset', { method: 'POST' });
      if (res.ok) {
        fetchArchetypes();
        setMessages(prev => [
          ...prev,
          { id: Date.now(), role: 'system', content: 'SQLite Archetype database reset successfully.' }
        ]);
      }
    } catch (_) {}
  };

  return (
    <div id="bwb-app-root" className="flex h-screen bg-zinc-950 text-zinc-100 font-mono overflow-hidden">
      
      {/* Sidebar: Context Files */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-zinc-900 border-r border-zinc-800 transition-all duration-300 overflow-hidden flex flex-col flex-shrink-0`}>
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between font-bold text-zinc-100">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-indigo-500" />
            <span>Context</span>
          </div>
          <button onClick={fetchFiles} title="Refresh workspace files" className="text-zinc-500 hover:text-zinc-300">
            <RefreshCw size={13} />
          </button>
        </div>
        
        <div className="p-3 text-[11px] text-zinc-400 border-b border-zinc-800/60 bg-zinc-900/60">
          Select files to include in AI reasoning context:
        </div>

        <div className="p-3 space-y-1 overflow-y-auto flex-1">
          {workspaceFiles.length === 0 ? (
            <div className="text-xs text-zinc-600 p-2 italic">Scanning files...</div>
          ) : (
            workspaceFiles.map(file => {
              const isSelected = selectedFiles.includes(file);
              return (
                <div
                  key={file}
                  id={`file-item-${file.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                  onClick={() => toggleFile(file)}
                  className={`text-xs cursor-pointer py-1.5 px-2 rounded transition-all truncate border flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200'
                      : 'border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate">{file}</span>
                  {isSelected && <span className="text-[10px] text-indigo-400 font-semibold ml-1">✓</span>}
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center justify-between">
          <span>{selectedFiles.length} active in context</span>
          {selectedFiles.length > 0 && (
            <button onClick={() => setSelectedFiles([])} className="text-xs text-zinc-400 hover:text-zinc-200">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
        <header className="h-14 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-950">
          <div className="flex items-center gap-3">
            <button
              id="toggle-sidebar-btn"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-zinc-100"
              title="Toggle files context sidebar"
            >
              <Terminal size={18} />
            </button>
            <h1 className="font-bold text-zinc-300 tracking-tighter flex items-center gap-2">
              <span>BWB_STUDIO_V1</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                GEMINI + MYTH
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="view-archetypes-btn"
              onClick={() => setShowArchetypesModal(true)}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-zinc-300 transition-colors"
            >
              <Layers size={13} className="text-indigo-400" />
              <span>Archetypes ({archetypes.length})</span>
            </button>
          </div>
        </header>

        {/* Message feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] p-4 rounded-sm border whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-950/30 border-indigo-500/50 text-indigo-100'
                    : msg.role === 'system'
                    ? 'bg-zinc-900/60 border-zinc-800 text-zinc-400 text-xs italic'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                }`}
              >
                {msg.content}

                {/* Extracted archetypes tag badges if any */}
                {msg.mythResult?.archetypes && msg.mythResult.archetypes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/80 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mr-1">Stored Archetypes:</span>
                    {msg.mythResult.archetypes.map(a => (
                      <span key={a} className="text-xs px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-900 border border-zinc-800 text-indigo-400 p-3 rounded text-xs flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" />
                <span>BWB Engine synthesizing response...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800">
          <div className="flex gap-2">
            <input
              id="command-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-sm p-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm text-zinc-100 placeholder-zinc-500"
              placeholder='Enter prompt, or :myth "seed phrase", :myth archetypes, :help...'
              disabled={loading}
            />
            <button
              id="send-btn"
              onClick={handleSend}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 p-3 rounded-sm transition-colors text-white flex items-center justify-center"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="mt-2 flex gap-3 text-[11px] text-zinc-500">
            <span>Quick: <button onClick={() => setInput(':myth "the midnight subway car that stopped between stations"')} className="text-zinc-400 hover:text-indigo-400 underline decoration-zinc-700">:myth subway</button></span>
            <span>·</span>
            <span><button onClick={() => setInput(':myth archetypes')} className="text-zinc-400 hover:text-indigo-400 underline decoration-zinc-700">:myth archetypes</button></span>
            <span>·</span>
            <span><button onClick={() => setInput('Explain how the Urban Myth distortion engine works.')} className="text-zinc-400 hover:text-indigo-400 underline decoration-zinc-700">architecture</button></span>
          </div>
        </div>
      </div>

      {/* Attributes Panel: Extended Controls */}
      <div className="w-80 bg-zinc-900 border-l border-zinc-800 p-6 space-y-6 overflow-y-auto flex-shrink-0">
        <div className="flex items-center gap-2 font-bold text-zinc-100">
          <Settings size={18} className="text-indigo-500" />
          <span>Studio Attributes</span>
        </div>

        <div className="space-y-6">
          {/* Provider & Model */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Inference Provider</label>
              <select
                id="provider-select"
                className="w-full bg-zinc-950 border border-zinc-700 p-2 rounded-sm text-xs text-zinc-300"
                value={attributes.provider}
                onChange={(e) => setAttributes({...attributes, provider: e.target.value})}
              >
                <option value="gemini">Google Gemini (Server-side)</option>
                <option value="local">Local Mode / Offline</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Model</label>
              <input
                id="model-input"
                className="w-full bg-zinc-950 border border-zinc-700 p-2 rounded-sm text-xs text-zinc-300"
                value={attributes.model}
                onChange={(e) => setAttributes({...attributes, model: e.target.value})}
              />
            </div>
          </div>

          {/* Tone & Verbosity */}
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-2">
                <MessageSquare size={12}/> Tone
              </label>
              <select
                id="tone-select"
                className="w-full bg-zinc-950 border border-zinc-700 p-2 rounded-sm text-xs text-zinc-300"
                value={attributes.tone}
                onChange={(e) => setAttributes({...attributes, tone: e.target.value})}
              >
                <option value="gritty">Gritty / Technical</option>
                <option value="professional">Professional</option>
                <option value="urban_myth">Urban Myth / Surreal</option>
                <option value="sarcastic">Sarcastic</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex justify-between">
                <span>Verbosity</span>
                <span className="text-indigo-400">{attributes.verbosity}/10</span>
              </label>
              <input
                id="verbosity-slider"
                type="range"
                min="1"
                max="10"
                value={attributes.verbosity}
                className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-indigo-500"
                onChange={(e) => setAttributes({...attributes, verbosity: e.target.value})}
              />
            </div>
          </div>

          {/* Engine Toggles */}
          <div className="pt-4 border-t border-zinc-800 space-y-3">
             <label className="flex items-center gap-3 cursor-pointer">
               <input
                 id="myth-engine-toggle"
                 type="checkbox"
                 checked={attributes.mythEngine}
                 onChange={() => setAttributes({...attributes, mythEngine: !attributes.mythEngine})}
                 className="accent-indigo-500"
               />
               <span className="text-xs text-zinc-300 flex items-center gap-2">
                 <Sparkles size={13} className="text-indigo-400" /> Enable Urban Myth Engine
               </span>
             </label>
          </div>

          {/* System Status / Health */}
          <div className="pt-4 border-t border-zinc-800 space-y-2">
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Persistence Engine</div>
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">Database:</span>
                <span className="text-zinc-300">SQLite (sql.js WASM)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Archetypes:</span>
                <span className="text-indigo-400">{archetypes.length} cached</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Server:</span>
                <span className="text-emerald-400">0.0.0.0:3000 (Active)</span>
              </div>
            </div>
          </div>

          <button
            id="sync-state-btn"
            onClick={() => {
              fetchHealth();
              fetchFiles();
              fetchArchetypes();
            }}
            className="w-full py-2.5 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/50 text-indigo-300 rounded-sm text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Database size={13}/> Sync State
          </button>
        </div>
      </div>

      {/* Archetypes Modal */}
      {showArchetypesModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-indigo-400" />
                <h3 className="font-bold text-zinc-100">Cached Myth Archetypes</h3>
              </div>
              <button
                onClick={() => setShowArchetypesModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {archetypes.length === 0 ? (
                <div className="text-sm text-zinc-500 text-center py-6">
                  No archetypes stored yet. Run <code>:myth "seed"</code> to extract and cache archetypes.
                </div>
              ) : (
                archetypes.map(a => (
                  <div key={a.name} className="p-3 bg-zinc-950 border border-zinc-800 rounded flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-indigo-300">{a.name}</div>
                      <div className="text-[11px] text-zinc-500">Last recorded: {a.lastSeen ? a.lastSeen.slice(0, 16) : 'N/A'}</div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-zinc-800 text-zinc-300 rounded font-mono">
                      {a.count}x
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-zinc-800">
              <button
                onClick={handleResetArchetypes}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-1.5 bg-red-950/30 border border-red-800/40 rounded transition-colors"
              >
                <Trash2 size={13} /> Reset DB
              </button>

              <button
                onClick={() => setShowArchetypesModal(false)}
                className="text-xs px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
