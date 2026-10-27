"use client";

import React, { useState } from "react";
import {
  Sparkles,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  Info,
} from "lucide-react";

interface InterviewQuestion {
  question: string;
  purpose: string;
}

interface InsightsData {
  summary: string;
  strengths: string[];
  red_flags: string[];
  interview_questions: InterviewQuestion[];
}

interface AiInsightsResponse {
  success: boolean;
  model_used?: string;
  insights?: InsightsData;
  fallback_preview?: InsightsData;
  error_type?: string;
  message?: string;
}

interface AiInsightsCardProps {
  candidateId: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export default function AiInsightsCard({ candidateId }: AiInsightsCardProps) {
  const [data, setData] = useState<AiInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fetchAiInsights = async () => {
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/candidates/${candidateId}/ai-insights/`, {
        method: "POST",
        headers,
      });
      const result: AiInsightsResponse = await res.json();
      setData(result);
    } catch (err: any) {
      console.error("AI Insights request error:", err);
      setData({
        success: false,
        message: "Failed to connect to backend AI endpoint.",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const insights = data?.insights || data?.fallback_preview;

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden transition-all">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 to-purple-50/50 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <span>AI Candidate Briefing & Interview Copilot</span>
              {data?.model_used && (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-100/80 text-indigo-700 rounded-md font-semibold">
                  {data.model_used}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500">
              Local Ollama intelligence analyzing resume fit & interview probes
            </p>
          </div>
        </div>

        <button
          onClick={fetchAiInsights}
          disabled={loading}
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Analyzing..." : insights ? "Re-generate" : "Generate AI Briefing"}</span>
        </button>
      </div>

      {/* Body Content */}
      <div className="p-6">
        {!insights && !loading && (
          <div className="text-center py-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-slate-800">Generate 30-Second AI Briefing</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click the button above to run local LLM inference. The AI will summarize candidate fit,
                highlight strengths and gaps, and suggest 3 tailored interview questions.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="py-10 space-y-4 animate-pulse">
            <div className="h-4 bg-slate-100 rounded-lg w-3/4"></div>
            <div className="h-4 bg-slate-100 rounded-lg w-full"></div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="h-20 bg-slate-50 rounded-xl"></div>
              <div className="h-20 bg-slate-50 rounded-xl"></div>
            </div>
            <div className="text-center text-xs text-indigo-600 font-medium pt-2">
              Analyzing candidate resume against job requirements with local AI...
            </div>
          </div>
        )}

        {insights && !loading && (
          <div className="space-y-6">
            {/* Notice if Ollama is running offline/fallback */}
            {data?.error_type === "OLLAMA_OFFLINE" && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2 text-xs text-amber-800">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Ollama not running locally.</span> Showing rule-based fallback preview.
                  To run live local AI, run <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">ollama run llama3.2:3b</code> on your machine.
                </div>
              </div>
            )}

            {/* 1. Executive Summary */}
            <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 p-4 rounded-xl border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                Executive Assessment
              </span>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {insights.summary}
              </p>
            </div>

            {/* 2. Strengths vs Red Flags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Key Strengths</span>
                </div>
                <ul className="text-xs text-emerald-900 space-y-1.5 pl-4 list-disc">
                  {insights.strengths?.map((s, idx) => (
                    <li key={idx} className="leading-snug">{s}</li>
                  ))}
                </ul>
              </div>

              {/* Red Flags / Gaps */}
              <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Potential Gaps / Focus Areas</span>
                </div>
                <ul className="text-xs text-rose-900 space-y-1.5 pl-4 list-disc">
                  {insights.red_flags?.map((f, idx) => (
                    <li key={idx} className="leading-snug">{f}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 3. Tailored Interview Questions */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Tailored Interview Questions ({insights.interview_questions?.length || 0})
                </h4>
              </div>

              <div className="space-y-2.5">
                {insights.interview_questions?.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-indigo-200 transition-colors space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-900 leading-snug">
                        {idx + 1}. {item.question}
                      </p>
                      <button
                        onClick={() => copyToClipboard(item.question, idx)}
                        className="text-slate-400 hover:text-indigo-600 p-1 flex-shrink-0 transition-colors"
                        title="Copy question to clipboard"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    {item.purpose && (
                      <p className="text-[11px] text-slate-500 italic">
                        <b>Probe:</b> {item.purpose}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
