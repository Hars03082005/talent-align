// frontend/src/components/CopilotDrawer.tsx

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, CheckCircle2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import { AIChatOutput } from '../types';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  sessionId?: string;
  currentRoleId?: string;
}

interface ChatMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  activeAgent?: string;
  toolsUsed?: string[];
  citations?: string[];
  validationPassed?: boolean;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  userId,
  sessionId,
  currentRoleId,
}) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Hello! I am your AI Career Copilot. I analyze verified ML demand forecasts, SHAP drivers, and your skill profile with zero hallucinations. How can I help you navigate your career path today?",
      activeAgent: 'Career Advisor Agent',
      toolsUsed: ['RoleMatcher', 'LightGBM', 'Hybrid RAG'],
      validationPassed: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const starterPrompts = [
    "Find Bengaluru jobs matching my top role",
    "Compare my top 2 roles",
    "Am I ready for Generative AI Engineer?",
    "Give me a project idea for my missing skills",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!messageText) setInput('');
    setLoading(true);

    try {
      const resp: AIChatOutput = await api.sendAIChat({
        message: textToSend,
        user_id: userId,
        session_id: sessionId,
        role_id: currentRoleId,
      });

      const assistantMsg: ChatMessageItem = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: resp.answer || resp.reply || 'No response generated.',
        activeAgent: resp.active_agent,
        toolsUsed: resp.tools_used,
        citations: resp.citations,
        validationPassed: resp.validation_passed,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `Error connecting to AI Copilot: ${err.message || 'Please check if backend is running.'}`,
          validationPassed: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Career Copilot</h3>
                <p className="text-xs text-slate-500">Verified Grounded Intelligence</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 text-sm ${
                    m.sender === 'user'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                </div>

                {/* Grounding & Verification Metadata */}
                {m.sender === 'assistant' && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1">
                    {m.activeAgent && (
                      <span className="inline-flex items-center text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                        <Bot className="w-3 h-3 mr-1 text-indigo-600" /> {m.activeAgent}
                      </span>
                    )}
                    {m.validationPassed && (
                      <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Verified
                      </span>
                    )}
                    {m.toolsUsed && m.toolsUsed.map((tool, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center space-x-2 text-slate-400 text-xs py-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Consulting ML pipelines and verifying ground truth...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Starter Prompts */}
          <div className="px-4 py-2 border-t border-slate-100 bg-white">
            <p className="text-[11px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
              Suggested queries
            </p>
            <div className="flex flex-wrap gap-1.5">
              {starterPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className="text-xs text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-md px-2.5 py-1 text-left transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Input Box */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about roles, skill roadmaps, or forecasts..."
                disabled={loading}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
