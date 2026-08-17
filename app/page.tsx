'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Send, FileText, CheckCircle, Award, BrainCircuit, Loader2, ArrowRight, Mic, MicOff, Volume2, VolumeX, Download, Lock, SkipForward, Clock, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ViewState = 'auth' | 'setup' | 'interview' | 'evaluating' | 'evaluation';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

interface EvaluationData {
  grade: string;
  recommendation: string;
  metrics: {
    clarity: number;
    relevance: number;
    completeness: number;
  };
  feedback: {
    question: string;
    userAnswer: string;
    aiCritique: string;
    idealAnswer: string;
  }[];
}

export default function MockInterviewApp() {
  const [view, setView] = useState<ViewState>('auth');
  
  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Hardcoded Credentials
  const APP_EMAIL = 'salvana775@gmail.com';
  const APP_PASSWORD = 'Salvana';

  // Setup State
  const [jobTitle, setJobTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [persona, setPersona] = useState('Standard Interviewer');
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Interview State
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [turnCount, setTurnCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio/Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [isTTS, setIsTTS] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Timer State
  const QUESTION_TIME = 120; // 2 minutes
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);

  // Evaluation State
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);

  // Speech Recognition Setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setCurrentInput(prev => prev + ' ' + finalTranscript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
        };
      }
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
    setIsRecording(!isRecording);
  };

  const speakText = (text: string) => {
    if (!isTTS || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // clear previous
    const utterance = new SpeechSynthesisUtterance(text);
    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const goodVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Natural')));
    if (goodVoice) utterance.voice = goodVoice;
    
    if (persona === 'Encouraging Coach') {
      utterance.rate = 1.1;
      utterance.pitch = 1.2;
    } else if (persona === 'Ruthless Examiner') {
      utterance.rate = 0.9;
      utterance.pitch = 0.8;
    }

    window.speechSynthesis.speak(utterance);
  };

  // Timer Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (view === 'interview' && !isLoading && !isInterviewComplete) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [view, isLoading, isInterviewComplete]);

  // Auto-scroll chat
  useEffect(() => {
    if (view === 'interview') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, view, currentInput]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim().toLowerCase() === APP_EMAIL && password === APP_PASSWORD) {
      setView('setup');
    } else {
      alert('Incorrect email or password');
      setPassword('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const startInterview = async () => {
    if (!jobTitle || !file) return alert('Please provide a topic/title and upload a file.');
    setIsLoading(true);
    
    const formData = new FormData();
    formData.append('action', 'start');
    formData.append('jobTitle', jobTitle);
    formData.append('persona', persona);
    formData.append('file', file);

    try {
      const res = await fetch('/api/chat', { method: 'POST', body: formData });
      const data = await res.json();
      
      setMessages([{ role: 'ai', content: data.reply }]);
      speakText(data.reply);
      setView('interview');
      setTimeLeft(QUESTION_TIME);
      setIsInterviewComplete(data.isComplete);
    } catch (err) {
      console.error(err);
      alert('Failed to start interview.');
    } finally {
      setIsLoading(false);
    }
  };

  const sendAnswer = async (overrideInput?: string) => {
    if (isInterviewComplete) {
      setIsLoading(true);
      setView('evaluating');
      const formData = new FormData();
      formData.append('action', 'evaluate');
      formData.append('history', JSON.stringify(messages));
      formData.append('jobTitle', jobTitle);
      try {
        const res = await fetch('/api/chat', { method: 'POST', body: formData });
        const data = await res.json();
        setEvaluation(data.evaluation);
        setView('evaluation');
      } catch (err) {
        console.error(err);
        alert('Failed to evaluate.');
        setView('interview');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const inputToSend = overrideInput || currentInput;
    if (!inputToSend.trim()) return;
    
    if (isRecording) toggleRecording();
    window.speechSynthesis.cancel();

    const newMessages: Message[] = [...messages, { role: 'user', content: inputToSend }];
    setMessages(newMessages);
    setCurrentInput('');
    setIsLoading(true);

    const formData = new FormData();
    formData.append('action', 'chat');
    formData.append('history', JSON.stringify(newMessages));
    formData.append('persona', persona);

    try {
      const res = await fetch('/api/chat', { method: 'POST', body: formData });
      const data = await res.json();
      
      setMessages([...newMessages, { role: 'ai', content: data.reply }]);
      speakText(data.reply);
      setTurnCount((prev) => prev + 1);
      setTimeLeft(QUESTION_TIME);
      setIsInterviewComplete(data.isComplete);
    } catch (err) {
      console.error(err);
      alert('Failed to send answer.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadReport = () => {
    if (!evaluation) return;
    let report = `AI INTERVIEW EVALUATION REPORT\n`;
    report += `Role: ${jobTitle}\n`;
    report += `Overall Grade: ${evaluation.grade}\n`;
    report += `Metrics: Clarity (${evaluation.metrics.clarity}), Relevance (${evaluation.metrics.relevance}), Completeness (${evaluation.metrics.completeness})\n\n`;
    report += `Recommendation: ${evaluation.recommendation}\n\n`;
    report += `-------------------------------------------------\n\n`;
    
    evaluation.feedback.forEach((f, idx) => {
      report += `QUESTION ${idx + 1}:\n${f.question}\n\n`;
      report += `YOUR ANSWER:\n${f.userAnswer}\n\n`;
      report += `AI CRITIQUE:\n${f.aiCritique}\n\n`;
      report += `IDEAL ANSWER APPROACH:\n${f.idealAnswer}\n\n`;
      report += `-------------------------------------------------\n\n`;
    });

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Interview_Report_${jobTitle.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -20 }
  };

  return (
    <AnimatePresence mode="wait">
      {view === 'auth' && (
        <motion.div 
          key="auth"
          initial="initial" animate="in" exit="out" variants={pageVariants}
          className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950 to-zinc-950 pointer-events-none"></div>
          <div className="max-w-md w-full bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-zinc-800/50 z-10 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 mb-6">
              <Lock className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-extrabold text-zinc-100 mb-2 tracking-tight">Access Required</h1>
            <p className="text-zinc-400 mb-8">Please log in to access the AI Defense Coach.</p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address..." 
                className="w-full px-5 py-4 bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none text-center tracking-widest"
              />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password..." 
                className="w-full px-5 py-4 bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none text-center tracking-widest"
              />
              <button 
                type="submit"
                disabled={!email || !password}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-500 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                Unlock Application
              </button>
            </form>
          </div>
        </motion.div>
      )}

      {view === 'setup' && (
        <motion.div 
          key="setup"
          initial="initial" animate="in" exit="out" variants={pageVariants}
          className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950 to-zinc-950 pointer-events-none"></div>
          
          {isLoading ? (
            <div className="z-10 flex flex-col items-center">
              <div className="inline-flex p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800 mb-8 shadow-2xl">
                <BrainCircuit className="w-16 h-16 text-emerald-400 animate-pulse" />
              </div>
              <h2 className="text-3xl font-extrabold text-zinc-100 mb-3 tracking-tight">Analyzing Context...</h2>
              <p className="text-lg text-zinc-400 text-center max-w-md">Extracting key information from your document and crafting your first personalized question.</p>
              <Loader2 className="animate-spin w-8 h-8 text-emerald-500 mt-8" />
            </div>
          ) : (
            <div className="max-w-2xl w-full bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-zinc-800/50 z-10">
              <div className="bg-zinc-800/40 p-8 text-center border-b border-zinc-800/50">
                <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 mb-4">
                  <BrainCircuit className="w-10 h-10 text-emerald-400" />
                </div>
                <h1 className="text-3xl font-extrabold text-zinc-100 mb-2 tracking-tight">AI Defense Coach</h1>
                <p className="text-zinc-400">Prepare for your next big role or thesis defense.</p>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">Target Role or Thesis Topic</label>
                  <input 
                    type="text" 
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Staff Engineer" 
                    className="w-full px-4 py-3 bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-zinc-600 outline-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">Interviewer Persona</label>
                    <select 
                      value={persona}
                      onChange={(e) => setPersona(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-100 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none appearance-none"
                    >
                      <option>Standard Interviewer</option>
                      <option>Encouraging Coach</option>
                      <option>Ruthless Examiner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">Interview Length</label>
                    <div className="w-full px-4 py-3 bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-500 text-sm">
                      Dynamic (AI decides based on context)
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">Context Document (PDF/TXT)</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-800 rounded-2xl p-8 text-center cursor-pointer hover:bg-zinc-800/30 hover:border-emerald-500/50 transition-all flex flex-col items-center justify-center group"
                  >
                    <Upload className="w-10 h-10 text-zinc-600 group-hover:text-emerald-400 transition-colors mb-3" />
                    <p className="text-zinc-300 font-medium text-md">Click to upload or drag and drop</p>
                    <p className="text-zinc-500 text-sm mt-1">{file ? file.name : "Resume, Job Description, or Thesis Abstract"}</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.txt" className="hidden" />
                  </div>
                </div>

                <button 
                  onClick={startInterview}
                  disabled={!jobTitle || !file}
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:hover:bg-emerald-600 flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                >
                  Start Interview <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {view === 'interview' && (
        <motion.div 
          key="interview"
          initial="initial" animate="in" exit="out" variants={pageVariants}
          className="min-h-screen bg-zinc-950 flex flex-col"
        >
          <header className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                <BrainCircuit className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-100">AI Interviewer <span className="text-zinc-500 text-xs ml-2 font-normal">({persona})</span></h2>
                <p className="text-xs text-zinc-400 font-medium">{jobTitle}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${timeLeft < 30 ? 'bg-rose-500/10 border-rose-500/50 text-rose-400 animate-pulse' : 'bg-zinc-800/50 border-zinc-700 text-zinc-300'}`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono text-sm font-bold">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
              </div>
              
              <button onClick={() => setIsTTS(!isTTS)} className={`p-2 rounded-full border transition-all ${isTTS ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`} title="Toggle Voice">
                {isTTS ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              
              <div className="bg-zinc-800 px-4 py-2 rounded-full text-sm font-semibold text-zinc-300 border border-zinc-700">
                Q <span className="text-emerald-400">{turnCount + 1}</span>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6 space-y-8 max-w-4xl w-full mx-auto">
            {messages.map((msg, i) => (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-6 shadow-sm text-[15px] ${msg.role === 'user' ? 'bg-emerald-600 text-emerald-50 rounded-tr-sm shadow-[0_4px_20px_rgba(16,185,129,0.15)]' : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-sm leading-relaxed'}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm p-6 flex items-center gap-4 shadow-md">
                  <Loader2 className="animate-spin w-5 h-5 text-emerald-500" />
                  <span className="text-zinc-300 font-medium animate-pulse">Formulating next question...</span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </main>

          <footer className="bg-zinc-900/80 backdrop-blur-md border-t border-zinc-800 p-6">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex gap-3">
                <button 
                  onClick={toggleRecording}
                  disabled={isLoading}
                  className={`p-4 rounded-xl transition-all border flex items-center justify-center ${isRecording ? 'bg-rose-500/20 border-rose-500 text-rose-500 animate-pulse' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'} disabled:opacity-50`}
                  title={isRecording ? "Stop Recording" : "Start Voice Answer"}
                >
                  {isRecording ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </button>
                <textarea 
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  placeholder="Type your answer here or click the mic to speak..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none h-16 outline-none placeholder:text-zinc-600"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendAnswer();
                    }
                  }}
                />
                <button 
                  onClick={() => sendAnswer()}
                  disabled={isLoading || (!isInterviewComplete && !currentInput.trim())}
                  className={`px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all disabled:opacity-50 text-white ${isInterviewComplete ? 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]'}`}
                >
                  {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : (isInterviewComplete ? 'Evaluate' : 'Submit')}
                  {!isLoading && (isInterviewComplete ? <CheckCircle className="w-5 h-5" /> : <Send className="w-5 h-5" />)}
                </button>
              </div>
              <div className="flex justify-between items-center text-xs text-zinc-500">
                <p>Press <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 mx-1">Enter</kbd> to submit</p>
                <button 
                  onClick={() => sendAnswer("I don't know the answer to this question, please move on to the next one.")}
                  disabled={isLoading || isInterviewComplete}
                  className="flex items-center gap-1 hover:text-zinc-300 transition-colors disabled:opacity-50 disabled:hover:text-zinc-500"
                >
                  <SkipForward className="w-3 h-3" /> Skip Question
                </button>
              </div>
            </div>
          </footer>
        </motion.div>
      )}

      {view === 'evaluating' && (
        <motion.div 
          key="evaluating"
          initial="initial" animate="in" exit="out" variants={pageVariants}
          className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950 to-zinc-950 pointer-events-none"></div>
          <div className="z-10 flex flex-col items-center text-center max-w-lg">
            <div className="inline-flex p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800 mb-8 shadow-2xl">
              <Award className="w-16 h-16 text-emerald-400 animate-bounce" />
            </div>
            <h2 className="text-3xl font-extrabold text-zinc-100 mb-3 tracking-tight">Evaluating Transcript...</h2>
            <p className="text-lg text-zinc-400">The AI is thoroughly analyzing your entire interview performance and generating personalized feedback.</p>
            <Loader2 className="animate-spin w-8 h-8 text-emerald-500 mt-8" />
          </div>
        </motion.div>
      )}

      {view === 'evaluation' && evaluation && (
        <motion.div 
          key="evaluation"
          initial="initial" animate="in" exit="out" variants={pageVariants}
          className="min-h-screen bg-zinc-950 p-6 md:p-12 overflow-y-auto"
        >
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-16">
              <div className="flex items-center gap-6">
                <div className="inline-flex p-4 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-xl">
                  <Award className="w-10 h-10 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-4xl font-extrabold text-zinc-100 tracking-tight">Defense Results</h1>
                  <p className="text-zinc-400 mt-1">{jobTitle}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 no-print">
                <button onClick={() => window.print()} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 px-6 py-3 rounded-xl font-semibold text-zinc-200 transition-all shadow-md">
                  <Printer className="w-4 h-4" /> Print PDF
                </button>
                <button onClick={downloadReport} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-xl font-semibold text-emerald-50 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <Download className="w-4 h-4" /> Download Report
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-1 bg-zinc-900 rounded-3xl p-8 border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 no-print"></div>
                <h3 className="text-zinc-400 font-bold uppercase tracking-widest text-sm mb-4">Overall Grade</h3>
                <div className="text-9xl font-black text-emerald-500 drop-shadow-sm">{evaluation.grade}</div>
              </div>

              <div className="md:col-span-2 bg-zinc-900 rounded-3xl p-8 border border-zinc-800 space-y-8 shadow-xl">
                <h3 className="text-xl font-bold text-zinc-100 border-b border-zinc-800 pb-5">Performance Metrics</h3>
                {[
                  { label: 'Clarity', value: evaluation.metrics.clarity },
                  { label: 'Relevance', value: evaluation.metrics.relevance },
                  { label: 'Completeness', value: evaluation.metrics.completeness }
                ].map((metric) => (
                  <div key={metric.label}>
                    <div className="flex justify-between mb-3">
                      <span className="font-semibold text-zinc-300">{metric.label}</span>
                      <span className="font-bold text-emerald-400">{metric.value}<span className="text-zinc-600">/100</span></span>
                    </div>
                    <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden border border-zinc-800">
                      <div className="bg-emerald-500 h-3 rounded-full transition-all duration-1000 ease-out" style={{ width: `${metric.value}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-emerald-950/20 rounded-3xl p-8 border border-emerald-900/30 shadow-xl">
              <h3 className="text-xl font-bold text-zinc-100 border-b border-emerald-900/30 pb-5 mb-6 flex items-center gap-3">
                <BrainCircuit className="w-6 h-6 text-emerald-400" /> AI Recommendation
              </h3>
              <p className="text-emerald-50/90 leading-relaxed text-lg">{evaluation.recommendation}</p>
            </div>

            <div className="bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
              <div className="bg-zinc-950/50 p-8 border-b border-zinc-800">
                <h3 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
                  <FileText className="w-6 h-6 text-emerald-500" /> Detailed Feedback
                </h3>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {evaluation.feedback.map((item, idx) => (
                  <div key={idx} className="p-8 space-y-6 hover:bg-zinc-800/20 transition-colors">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="bg-zinc-950 border border-zinc-800 text-emerald-500 font-black text-xl w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                        Q{idx + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-zinc-200 text-lg mb-6 leading-relaxed">{item.question}</h4>
                        
                        <div className="space-y-6">
                          <div className="bg-zinc-950/80 rounded-2xl p-6 border border-zinc-800/80">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Your Answer</span>
                            <p className="text-zinc-300 leading-relaxed">{item.userAnswer}</p>
                          </div>
                          
                          <div className="bg-rose-950/20 rounded-2xl p-6 border border-rose-900/30">
                            <span className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-2 block">AI Critique</span>
                            <p className="text-rose-200/90 leading-relaxed">{item.aiCritique}</p>
                          </div>
                          
                          <div className="bg-emerald-950/20 rounded-2xl p-6 border border-emerald-900/30">
                            <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2 block">Ideal Answer Approach</span>
                            <p className="text-emerald-200/90 leading-relaxed">{item.idealAnswer}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="text-center pt-8 pb-16 no-print">
               <button onClick={() => window.location.reload()} className="bg-emerald-600 text-emerald-50 px-10 py-5 rounded-2xl font-bold hover:bg-emerald-500 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                 Start New Interview
               </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
