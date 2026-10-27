"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Star,
  User,
  Briefcase,
  Linkedin,
  Github,
  Globe,
  Calendar,
  Award,
  FileText,
  Send,
  MessageSquare,
  ChevronDown,
  Sparkles,
  Phone,
  ShieldCheck,
  Building,
} from "lucide-react";
import AiInsightsCard from "@/app/components/AiInsightsCard";
import { useAuth } from "@/app/context/AuthContext";

interface CandidateNote {
  id: number;
  author: string;
  content: string;
  rating?: number | null;
  created_at: string;
}

interface CandidateDetail {
  id: number;
  job: number;
  job_title: string;
  job_required_experience?: number;
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio_url: string;
  status: "APPLIED" | "IN_PROGRESS" | "HIRED" | "REJECTED";
  total_score: number;
  skills_score: number;
  experience_score: number;
  keywords_score: number;
  years_of_experience: number;
  matched_skills: string[];
  missing_skills: string[];
  missing_must_have: string[];
  matched_keywords: string[];
  missing_keywords: string[];
  entries: Array<{
    job_title: string | null;
    company_name: string | null;
    location: string | null;
    date: string;
    responsibilities: string[];
  }>;
  warnings: string[];
  notes: CandidateNote[];
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export default function CandidateProfilePage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.id as string;
  const { user, loading: authLoading, authFetch } = useAuth();

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Review Form state
  const [noteAuthor, setNoteAuthor] = useState("Lead Recruiter");
  const [noteContent, setNoteContent] = useState("");
  const [noteRating, setNoteRating] = useState<number>(5);
  const [submittingNote, setSubmittingNote] = useState(false);

  // Email Dialog state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState("interview");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState("");

  // Redirect if logged out
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const fetchCandidate = async () => {
    try {
      const res = await authFetch(`${API_BASE}/candidates/${candidateId}/`);
      if (!res.ok) throw new Error("Candidate not found");
      const data: CandidateDetail = await res.json();
      setCandidate(data);
      // Pre-fill email defaults
      prepareEmailTemplate("interview", data);
    } catch (err: any) {
      setError(err.message || "Failed to load candidate details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (candidateId && user) {
      fetchCandidate();
    }
  }, [candidateId, user]);

  // Update Status in Kanban model
  const handleStatusChange = async (newStatus: string) => {
    if (!candidate) return;
    try {
      const res = await authFetch(`${API_BASE}/candidates/${candidate.id}/update-status/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCandidate((prev) => (prev ? { ...prev, status: updated.status, notes: updated.notes } : null));
      }
    } catch (err) {
      alert("Failed to update candidate status: " + err);
    }
  };

  // Add Recruiter Review / Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() || !candidate) return;
    setSubmittingNote(true);

    try {
      const res = await authFetch(`${API_BASE}/candidates/${candidate.id}/add-note/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: user?.username || noteAuthor.trim() || "Recruiter",
          content: noteContent.trim(),
          rating: noteRating,
        }),
      });

      if (res.ok) {
        const newNote = await res.json();
        setCandidate((prev) => (prev ? { ...prev, notes: [newNote, ...(prev.notes || [])] } : null));
        setNoteContent("");
      }
    } catch (err) {
      alert("Error adding review: " + err);
    } finally {
      setSubmittingNote(false);
    }
  };

  // Prepare Email Templates
  const prepareEmailTemplate = (type: string, cand: CandidateDetail) => {
    setEmailTemplate(type);
    const role = cand.job_title || "the position";
    if (type === "interview") {
      setEmailSubject(`Invitation for Interview: ${role}`);
      setEmailBody(
        `Dear ${cand.name},\n\nThank you for applying for the ${role} position. We were very impressed by your qualifications and resume evaluation score.\n\nWe would like to invite you for an interview with our engineering team. Please reply to this email with your availability over the next few days.\n\nWe look forward to speaking with you!\n\nBest regards,\nRecruiting Team`
      );
    } else if (type === "offer") {
      setEmailSubject(`Job Offer: ${role}`);
      setEmailBody(
        `Dear ${cand.name},\n\nWe are thrilled to extend an offer for the position of ${role}! Your screening evaluation and background demonstrated a fantastic fit for our team.\n\nPlease find the attached offer details and let us know if you have any questions.\n\nWarm regards,\nRecruiting Team`
      );
    } else if (type === "rejection") {
      setEmailSubject(`Update regarding your application for ${role}`);
      setEmailBody(
        `Dear ${cand.name},\n\nThank you for your interest in the ${role} role and for taking the time to share your background with us.\n\nWhile your skills and experience are commendable, we have decided to proceed with other candidates whose qualifications more closely align with our current requirements.\n\nWe wish you the very best in your job search and professional endeavors.\n\nSincerely,\nRecruiting Team`
      );
    } else {
      setEmailSubject(`Update regarding your application`);
      setEmailBody(`Hi ${cand.name},\n\n`);
    }
  };

  // Dispatch Live SMTP Email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate || !emailSubject.trim() || !emailBody.trim()) return;
    setSendingEmail(true);
    setEmailStatusMsg("");

    try {
      const res = await authFetch(`${API_BASE}/candidates/${candidate.id}/send-email/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: emailSubject.trim(),
          body: emailBody.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setEmailStatusMsg("✓ Email delivered to candidate inbox successfully!");
        fetchCandidate(); // Refresh notes to include the logged email
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailStatusMsg("");
        }, 1800);
      } else {
        setEmailStatusMsg(`✕ Error: ${data.error || "Failed to send email."}`);
      }
    } catch (err: any) {
      setEmailStatusMsg(`✕ Network or SMTP error: ${err.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-slate-500 text-sm">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading candidate profile...</span>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans space-y-4">
        <div className="text-rose-600 font-semibold text-lg">{error || "Candidate not found"}</div>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Recruiter Hub</span>
        </Link>
      </div>
    );
  }

  const statusColors = {
    APPLIED: "bg-slate-100 text-slate-700 border-slate-300",
    IN_PROGRESS: "bg-indigo-50 text-indigo-700 border-indigo-200",
    HIRED: "bg-emerald-50 text-emerald-700 border-emerald-300",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-300",
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 antialiased pb-16">
      {/* TOP NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Leaderboard</span>
          </Link>
          <div className="h-4 w-px bg-slate-200"></div>
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <span>{candidate.name}</span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusColors[candidate.status]}`}>
                {candidate.status.replace("_", " ")}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Applied for: <span className="font-medium text-slate-600">{candidate.job_title}</span>
            </p>
          </div>
        </div>

        {/* STATUS SELECTOR & EMAIL ACTION */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium">Stage:</span>
            <select
              value={candidate.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm cursor-pointer"
            >
              <option value="APPLIED">📥 Applied</option>
              <option value="IN_PROGRESS">⏳ In Progress</option>
              <option value="HIRED">🎉 Hired</option>
              <option value="REJECTED">✕ Rejected</option>
            </select>
          </div>

          <button
            onClick={() => setShowEmailModal(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-indigo-100 transition-all cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Send Email</span>
          </button>

          {user && (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 text-xs">
              <span className="font-bold text-slate-800">{user.username}</span>
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                {user.role}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-8 pt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Evaluation & Experience (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top Score Matrix Banner */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Evaluation Score</span>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className="text-4xl font-extrabold text-slate-900">{candidate.total_score}%</span>
                  <span className="text-xs text-slate-400 font-medium">overall match</span>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-semibold text-slate-500">Detected Experience:</span>
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-bold border border-indigo-100">
                  {candidate.years_of_experience} Years
                </span>
                {candidate.job_required_experience && (
                  <span className="text-slate-400">
                    ({candidate.job_required_experience}+ yrs required)
                  </span>
                )}
              </div>
            </div>

            {/* Score Component Bars */}
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500">Skills Section Score</div>
                <div className="text-lg font-bold text-slate-800 mt-0.5">
                  {candidate.skills_score} <span className="text-xs font-normal text-slate-400">/ 40</span>
                </div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500">Experience TF-IDF Match</div>
                <div className="text-lg font-bold text-slate-800 mt-0.5">
                  {candidate.experience_score} <span className="text-xs font-normal text-slate-400">/ 30</span>
                </div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500">Keyword Coverage</div>
                <div className="text-lg font-bold text-slate-800 mt-0.5">
                  {candidate.keywords_score} <span className="text-xs font-normal text-slate-400">/ 30</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Candidate Briefing & Interview Copilot */}
          <AiInsightsCard candidateId={candidate.id} />

          {/* Missing Must-Have Warning Alert Banner */}
          {candidate.missing_must_have?.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200/80 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs text-rose-800">Missing Mandatory / Must-Have Skills</h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  Candidate does not mention the following required skill(s):{" "}
                  <b className="font-semibold">{candidate.missing_must_have.join(", ")}</b>
                </p>
              </div>
            </div>
          )}

          {/* Skills Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Skills & Competencies Breakdown</span>
            </h3>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Matched Skills ({candidate.matched_skills?.length || 0})
              </span>
              <div className="flex flex-wrap gap-2">
                {candidate.matched_skills?.length > 0 ? (
                  candidate.matched_skills.map((s) => (
                    <span
                      key={s}
                      className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg border border-emerald-200/80 flex items-center space-x-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{s}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No target skills detected in skills section.</span>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Missing Target Skills ({candidate.missing_skills?.length || 0})
              </span>
              <div className="flex flex-wrap gap-2">
                {candidate.missing_skills?.length > 0 ? (
                  candidate.missing_skills.map((s) => (
                    <span
                      key={s}
                      className="px-3 py-1 bg-rose-50 text-rose-700 text-xs font-medium rounded-lg border border-rose-200/80"
                    >
                      ✕ {s}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-emerald-600 font-medium">All target skills fulfilled!</span>
                )}
              </div>
            </div>
          </div>

          {/* Parsed Work History Timeline */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              <span>Parsed Work History & Experience Timeline</span>
            </h3>

            {candidate.entries?.length > 0 ? (
              <div className="space-y-4 pt-1">
                {candidate.entries.map((entry, idx) => (
                  <div key={idx} className="relative pl-6 border-l-2 border-indigo-100 pb-2 last:pb-0">
                    <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white shadow-sm"></div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">{entry.job_title || "Position / Role"}</span>
                      <span className="text-xs font-mono font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {entry.date}
                      </span>
                    </div>
                    {entry.company_name && (
                      <div className="text-xs text-indigo-600 font-medium mt-0.5">{entry.company_name}</div>
                    )}
                    <ul className="mt-2 text-xs text-slate-600 space-y-1 list-disc pl-4">
                      {entry.responsibilities?.map((r, rIdx) => (
                        <li key={rIdx} className="leading-relaxed">{r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3">No individual job entries were detected in the resume text.</p>
            )}
          </div>

          {/* Parsing Flags / Warnings */}
          {candidate.warnings?.length > 0 && (
            <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200/80 space-y-2">
              <h4 className="font-bold text-xs text-amber-900 flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Screening Flags</span>
              </h4>
              <ul className="text-xs text-amber-800 space-y-1 pl-5 list-disc">
                {candidate.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Contact Details & Recruiter Review Thread (1 Col) */}
        <div className="space-y-6">
          {/* Contact Details Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Candidate Contact</h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center space-x-2.5 text-slate-700">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="font-medium truncate">{candidate.email || "No email detected"}</span>
              </div>
              {candidate.phone && (
                <div className="flex items-center space-x-2.5 text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{candidate.phone}</span>
                </div>
              )}
              {candidate.linkedin && (
                <div className="flex items-center space-x-2.5 text-slate-700">
                  <Linkedin className="w-4 h-4 text-blue-600" />
                  <a
                    href={candidate.linkedin.startsWith("http") ? candidate.linkedin : `https://${candidate.linkedin}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline text-indigo-600 truncate"
                  >
                    LinkedIn Profile
                  </a>
                </div>
              )}
              {candidate.github && (
                <div className="flex items-center space-x-2.5 text-slate-700">
                  <Github className="w-4 h-4 text-slate-800" />
                  <a
                    href={candidate.github.startsWith("http") ? candidate.github : `https://${candidate.github}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline text-indigo-600 truncate"
                  >
                    GitHub Profile
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Recruiter Reviews & Notes Thread */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <span>Recruiter Reviews & Notes</span>
              </h3>
              <span className="text-xs font-semibold text-slate-400">
                {candidate.notes?.length || 0} entries
              </span>
            </div>

            {/* Add Review Form */}
            <form onSubmit={handleAddNote} className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  placeholder="Your Name / Role"
                  value={noteAuthor}
                  onChange={(e) => setNoteAuthor(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-40 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNoteRating(star)}
                      className={`p-0.5 ${star <= noteRating ? "text-amber-400" : "text-slate-200"}`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                required
                rows={3}
                placeholder="Write an internal review, interview feedback, or evaluation note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingNote || !noteContent.trim()}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                >
                  {submittingNote ? "Saving..." : "Post Note"}
                </button>
              </div>
            </form>

            {/* Thread of Past Notes */}
            <div className="space-y-3 pt-3 border-t border-slate-100 max-h-96 overflow-y-auto">
              {candidate.notes?.length > 0 ? (
                candidate.notes.map((note) => (
                  <div key={note.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{note.author}</span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {note.rating && (
                      <div className="flex text-amber-400">
                        {Array.from({ length: note.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-current" />
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  No notes yet. Add your first candidate assessment above.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* EMAIL COMPOSER MODAL (LIVE SMTP DELIVERY) */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-indigo-600" />
                  <span>Send Candidate Email</span>
                </h3>
                <p className="text-xs text-slate-500">Delivered directly to candidate's inbox</p>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            {/* Quick Template Selector */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-500 font-semibold">Template:</span>
              <div className="flex space-x-1.5">
                {[
                  { key: "interview", label: "Interview Invitation" },
                  { key: "offer", label: "Job Offer" },
                  { key: "rejection", label: "Rejection Notice" },
                  { key: "custom", label: "Custom" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => prepareEmailTemplate(t.key, candidate)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      emailTemplate === t.key
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">To</label>
                <input
                  type="email"
                  disabled
                  value={candidate.email}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Message Body</label>
                <textarea
                  required
                  rows={7}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {emailStatusMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    emailStatusMsg.startsWith("✓")
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {emailStatusMsg}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold shadow-md shadow-indigo-100 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingEmail ? "Sending..." : "Send Email"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
