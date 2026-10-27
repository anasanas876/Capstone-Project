"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Users,
  Award,
  UploadCloud,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ChevronRight,
  FileText,
  Filter,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
  Edit3,
  RefreshCw,
  FolderUp,
  LayoutGrid,
  List,
  ArrowRight,
  LogOut,
} from "lucide-react";
import AiInsightsCard from "./components/AiInsightsCard";
import { useAuth } from "./context/AuthContext";

interface Job {
  id: number;
  title: string;
  company_name: string;
  description: string;
  required_experience_years: number;
  target_skills: string[];
  must_have_skills: string[];
  candidate_count: number;
  top_score: number;
  avg_score: number;
  created_at: string;
}

interface Candidate {
  id: number;
  job: number;
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
  warnings: string[];
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export default function RecruiterDashboard() {
  const router = useRouter();
  const { user, loading: authLoading, logout, authFetch } = useAuth();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // View Mode: 'table' vs 'kanban'
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [minScoreFilter, setMinScoreFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("-total_score");
  const [qualifiedOnly, setQualifiedOnly] = useState(false);
  const [meetsMinExp, setMeetsMinExp] = useState(false);

  // Modals
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [showEditJobModal, setShowEditJobModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [aiCandidateModal, setAiCandidateModal] = useState<Candidate | null>(null);

  // Job Form states
  const [jobTitle, setJobTitle] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobReqYears, setJobReqYears] = useState("3");
  const [jobMustHave, setJobMustHave] = useState("python, django");
  const [jobSkills, setJobSkills] = useState("react, sql, git, rest api, aws");

  // Batch upload staged files
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check authentication
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Fetch Jobs
  const fetchJobs = async () => {
    try {
      const res = await authFetch(`${API_BASE}/jobs/`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
        if (data.length > 0 && !selectedJob) {
          setSelectedJob(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load jobs", err);
    }
  };

  // Fetch Candidates with active filters
  const fetchCandidates = async (jobId: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (minScoreFilter) params.append("min_score", minScoreFilter);
      if (skillFilter) params.append("has_skill", skillFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (sortBy) params.append("ordering", sortBy);
      if (qualifiedOnly) params.append("qualified_only", "true");
      if (meetsMinExp) params.append("meets_required_exp", "true");

      const res = await authFetch(`${API_BASE}/jobs/${jobId}/candidates/?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);
      }
    } catch (err) {
      console.error("Failed to load candidates", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchJobs();
    }
  }, [user]);

  useEffect(() => {
    if (selectedJob) {
      fetchCandidates(selectedJob.id);
    }
  }, [selectedJob, searchQuery, minScoreFilter, skillFilter, statusFilter, sortBy, qualifiedOnly, meetsMinExp]);

  // Update candidate status directly from Kanban / Table
  const handleUpdateCandidateStatus = async (candidateId: number, newStatus: string) => {
    try {
      const res = await authFetch(`${API_BASE}/candidates/${candidateId}/update-status/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setCandidates((prev) =>
          prev.map((c) => (c.id === candidateId ? { ...c, status: newStatus as any } : c))
        );
      }
    } catch (err) {
      alert("Failed to update status: " + err);
    }
  };

  // Batch Upload Handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setStagedFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setStagedFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const executeBatchUpload = async () => {
    if (!selectedJob || stagedFiles.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    stagedFiles.forEach((file) => formData.append("resumes", file));

    try {
      const res = await authFetch(`${API_BASE}/jobs/${selectedJob.id}/upload-resumes/`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      alert(data.message || `Processed ${data.processed_count} resumes.`);
      setShowBatchModal(false);
      setStagedFiles([]);
      fetchCandidates(selectedJob.id);
      fetchJobs();
    } catch (err) {
      alert("Batch upload error: " + err);
    } finally {
      setUploading(false);
    }
  };

  // Edit Job
  const openEditModal = () => {
    if (!selectedJob) return;
    setJobTitle(selectedJob.title);
    setJobCompany(selectedJob.company_name || "");
    setJobDescription(selectedJob.description);
    setJobReqYears(selectedJob.required_experience_years.toString());
    setJobMustHave((selectedJob.must_have_skills || []).join(", "));
    setJobSkills((selectedJob.target_skills || []).join(", "));
    setShowEditJobModal(true);
  };

  const handleSaveJobEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    const payload = {
      title: jobTitle,
      company_name: jobCompany,
      description: jobDescription,
      required_experience_years: parseFloat(jobReqYears) || 0,
      must_have_skills: jobMustHave.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
      target_skills: jobSkills.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    };

    try {
      const res = await authFetch(`${API_BASE}/jobs/${selectedJob.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowEditJobModal(false);
        if (confirm("Job criteria updated! Re-score all existing candidates to reflect new criteria?")) {
          await handleRescoreCandidates();
        } else {
          fetchJobs();
        }
      }
    } catch (err) {
      alert("Error updating job: " + err);
    }
  };

  const handleRescoreCandidates = async () => {
    if (!selectedJob) return;
    try {
      const res = await authFetch(`${API_BASE}/jobs/${selectedJob.id}/rescore/`, { method: "POST" });
      const data = await res.json();
      alert(data.message || "Re-scoring completed!");
      fetchJobs();
      fetchCandidates(selectedJob.id);
    } catch (err) {
      alert("Rescore error: " + err);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: jobTitle,
      company_name: jobCompany,
      description: jobDescription,
      required_experience_years: parseFloat(jobReqYears) || 0,
      must_have_skills: jobMustHave.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
      target_skills: jobSkills.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    };

    try {
      const res = await authFetch(`${API_BASE}/jobs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const createdJob = await res.json();
        setJobs([createdJob, ...jobs]);
        setSelectedJob(createdJob);
        setShowCreateJobModal(false);
      }
    } catch (err) {
      alert("Error creating job: " + err);
    }
  };

  // Kanban Columns Definition
  const kanbanStages = [
    { key: "APPLIED", label: "Applied", color: "border-slate-300 bg-slate-50", badge: "bg-slate-200 text-slate-700" },
    { key: "IN_PROGRESS", label: "In Progress", color: "border-indigo-300 bg-indigo-50/30", badge: "bg-indigo-100 text-indigo-700" },
    { key: "HIRED", label: "Hired", color: "border-emerald-300 bg-emerald-50/30", badge: "bg-emerald-100 text-emerald-700" },
    { key: "REJECTED", label: "Rejected", color: "border-rose-300 bg-rose-50/30", badge: "bg-rose-100 text-rose-700" },
  ];

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-slate-500 text-sm">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Verifying recruiter credentials...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans text-slate-800 antialiased overflow-hidden">
      {/* SIDEBAR: Job Openings */}
      <aside className="w-80 border-r border-slate-200/80 bg-white flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-900 leading-tight">ScreenAI Pro</h1>
              <p className="text-[11px] text-slate-400 font-medium">Recruitment Platform</p>
            </div>
          </div>
          <button
            onClick={() => {
              setJobTitle("");
              setJobCompany("");
              setJobDescription("");
              setShowCreateJobModal(true);
            }}
            className="p-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
            title="Create New Job"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Jobs List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div className="px-2 pt-2 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Job Openings ({jobs.length})
          </div>

          {jobs.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              No jobs posted yet.<br />Click the <b>+</b> button to post one!
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  selectedJob?.id === job.id
                    ? "bg-indigo-50/70 border-indigo-200 shadow-sm"
                    : "bg-white border-transparent hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-xs text-slate-900 truncate">{job.title}</h3>
                  <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-100">
                    {job.candidate_count}
                  </span>
                </div>
                <div className="flex items-center text-[11px] text-slate-500 space-x-1.5">
                  <span>{job.company_name || "Internal"}</span>
                  <span>•</span>
                  <span>{job.required_experience_years}+ yrs</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recruiter Profile Footer & Logout */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {user?.username ? user.username.slice(0, 2).toUpperCase() : "RC"}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">{user?.username}</div>
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded">
                {user?.role === "REVIEWER" ? "Reviewer" : "Lead Recruiter"}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {selectedJob ? (
          <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Active Job Header with Edit and Rescore */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-bold text-slate-900">{selectedJob.title}</h2>
                  <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200">
                    Active
                  </span>
                  <span className="bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-indigo-200/80 flex items-center space-x-1 shadow-sm">
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    <span>AI Insights Ready</span>
                  </span>
                  <button
                    onClick={openEditModal}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg border border-slate-200 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit Job</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {selectedJob.company_name || "Internal"} • {selectedJob.required_experience_years}+ Years Experience •{" "}
                  {selectedJob.must_have_skills?.length || 0} Must-Have Skills
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedJob.must_have_skills?.map((s) => (
                    <span key={s} className="px-2.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-md">
                      Must-Have: {s}
                    </span>
                  ))}
                  {selectedJob.target_skills?.map((s) => (
                    <span key={s} className="px-2.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 rounded-md">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={handleRescoreCandidates}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors"
                  title="Recalculate rankings"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-score</span>
                </button>
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold text-xs shadow-sm shadow-indigo-100 transition-all"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Batch Upload (200+)</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Total Screened</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{candidates.length}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Top Match Score</div>
                <div className="text-2xl font-bold text-emerald-600 mt-1">
                  {candidates.length > 0 ? `${candidates[0].total_score}%` : "0%"}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Must-Have Qualified</div>
                <div className="text-2xl font-bold text-indigo-600 mt-1">
                  {candidates.filter((c) => c.missing_must_have?.length === 0).length}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Average Score</div>
                <div className="text-2xl font-bold text-slate-700 mt-1">
                  {candidates.length > 0
                    ? `${(candidates.reduce((a, b) => a + b.total_score, 0) / candidates.length).toFixed(1)}%`
                    : "0%"}
                </div>
              </div>
            </div>

            {/* VIEW MODE SWITCHER + FILTER TOOLBAR */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
                    <button
                      onClick={() => setViewMode("table")}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                        viewMode === "table" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>Leaderboard Table</span>
                    </button>
                    <button
                      onClick={() => setViewMode("kanban")}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                        viewMode === "kanban" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Kanban Pipeline</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setMinScoreFilter("");
                      setSkillFilter("");
                      setStatusFilter("");
                      setSortBy("-total_score");
                      setQualifiedOnly(false);
                      setMeetsMinExp(false);
                    }}
                    className="text-xs text-slate-500 hover:text-indigo-600 font-medium"
                  >
                    Clear All Filters
                  </button>
                </div>

                {/* Filter Controls */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <select
                      value={minScoreFilter}
                      onChange={(e) => setMinScoreFilter(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">Score: All Matches</option>
                      <option value="80">Top Tier (80%+)</option>
                      <option value="70">Strong (70%+)</option>
                      <option value="60">Good (60%+)</option>
                      <option value="50">Average (50%+)</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={skillFilter}
                      onChange={(e) => setSkillFilter(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">Skill: All Skills</option>
                      {Array.from(new Set([...(selectedJob.must_have_skills || []), ...(selectedJob.target_skills || [])])).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="-total_score">Sort: Total Score</option>
                      <option value="-skills_score">Sort: Skills Score</option>
                      <option value="-experience_score">Sort: Experience Score</option>
                      <option value="-years_of_experience">Sort: Tenure</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-3 text-xs font-semibold text-slate-700">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qualifiedOnly}
                        onChange={(e) => setQualifiedOnly(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 h-3.5 w-3.5"
                      />
                      <span>Must-Haves Met</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={meetsMinExp}
                        onChange={(e) => setMeetsMinExp(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 h-3.5 w-3.5"
                      />
                      <span>Min Exp Met</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* VIEW 1: TABLE VIEW */}
              {viewMode === "table" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-200/80">
                      <tr>
                        <th className="py-3 px-4">Rank</th>
                        <th className="py-3 px-4">Candidate</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Total Score</th>
                        <th className="py-3 px-4 text-center">Skills (40)</th>
                        <th className="py-3 px-4 text-center">Experience (30)</th>
                        <th className="py-3 px-4">Missing Skills & Flags</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {candidates.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                            {loading ? "Loading candidate rankings..." : "No candidates found for this criteria."}
                          </td>
                        </tr>
                      ) : (
                        candidates.map((c, idx) => (
                          <tr
                            key={c.id}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-bold text-slate-400">
                              {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : idx === 2 ? "🥉 #3" : `#${idx + 1}`}
                            </td>
                            <td className="py-3.5 px-4">
                              <Link
                                href={`/candidates/${c.id}`}
                                className="font-bold text-slate-900 hover:text-indigo-600 transition-colors block"
                              >
                                {c.name}
                              </Link>
                              <div className="text-[11px] text-slate-400">{c.email || "No email detected"}</div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <select
                                value={c.status}
                                onChange={(e) => handleUpdateCandidateStatus(c.id, e.target.value)}
                                className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-white focus:outline-none cursor-pointer"
                              >
                                <option value="APPLIED">Applied</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="HIRED">Hired</option>
                                <option value="REJECTED">Rejected</option>
                              </select>
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-indigo-700 bg-indigo-50/40">
                              {c.total_score}%
                            </td>
                            <td className="py-3.5 px-4 text-center font-medium">{c.skills_score}</td>
                            <td className="py-3.5 px-4 text-center font-medium">
                              {c.experience_score}
                              <span className="block text-[10px] text-slate-400">
                                {c.years_of_experience} yrs
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {c.missing_must_have?.length > 0 ? (
                                <span className="inline-flex items-center text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-semibold">
                                  Missing: {c.missing_must_have.join(", ")}
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                                  ✓ Must-Haves Met
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setAiCandidateModal(c)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm shadow-indigo-100 transition-all cursor-pointer"
                                  title="Open AI Candidate Briefing & Interview Copilot"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>AI Insights</span>
                                </button>
                                <Link
                                  href={`/candidates/${c.id}`}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                                >
                                  <span>Profile</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* VIEW 2: KANBAN PIPELINE VIEW */
                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-100/60 min-h-[500px]">
                  {kanbanStages.map((stage) => {
                    const stageCandidates = candidates.filter((c) => c.status === stage.key);
                    return (
                      <div
                        key={stage.key}
                        className={`rounded-2xl p-3 border ${stage.color} flex flex-col space-y-3`}
                      >
                        <div className="flex items-center justify-between px-1">
                          <span className="font-bold text-xs text-slate-800">{stage.label}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stage.badge}`}>
                            {stageCandidates.length}
                          </span>
                        </div>

                        <div className="space-y-2.5 flex-1 overflow-y-auto">
                          {stageCandidates.length === 0 ? (
                            <div className="text-center py-10 text-xs text-slate-400">
                              No candidates in {stage.label.toLowerCase()}
                            </div>
                          ) : (
                            stageCandidates.map((c) => (
                              <div
                                key={c.id}
                                className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2 hover:border-indigo-300 transition-all"
                              >
                                <div className="flex justify-between items-start">
                                  <Link
                                    href={`/candidates/${c.id}`}
                                    className="font-bold text-xs text-slate-900 hover:text-indigo-600 transition-colors"
                                  >
                                    {c.name}
                                  </Link>
                                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                    {c.total_score}%
                                  </span>
                                </div>

                                <div className="text-[11px] text-slate-400">
                                  Experience: {c.years_of_experience} yrs
                                </div>

                                {c.missing_must_have?.length > 0 && (
                                  <div className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                    Missing: {c.missing_must_have.join(", ")}
                                  </div>
                                )}

                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                                  <select
                                    value={c.status}
                                    onChange={(e) => handleUpdateCandidateStatus(c.id, e.target.value)}
                                    className="text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none"
                                  >
                                    <option value="APPLIED">Applied</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="HIRED">Hired</option>
                                    <option value="REJECTED">Rejected</option>
                                  </select>

                                  <div className="flex items-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => setAiCandidateModal(c)}
                                      className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-bold text-[11px] cursor-pointer"
                                    >
                                      <Sparkles className="w-3 h-3 text-purple-600" />
                                      <span>AI Insights</span>
                                    </button>
                                    <Link
                                      href={`/candidates/${c.id}`}
                                      className="text-slate-400 hover:text-slate-700 font-medium text-[11px]"
                                    >
                                      Profile →
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Select or create a job opening to view the ranking dashboard.
          </div>
        )}
      </main>

      {/* BATCH UPLOAD MODAL (DRAG & DROP + MULTI-FILE + ZIP SUPPORT) */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Batch Resume Processing</h3>
                <p className="text-xs text-slate-500">Upload 10, 50, or 200+ resumes at once</p>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-indigo-50/30"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <FolderUp className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-slate-800">Drag & Drop Resumes Here</h4>
              <p className="text-xs text-slate-500 mt-1">Select multiple PDF / DOCX files, or drop a single <b>.zip</b> archive</p>
              <div className="mt-4 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Browse Files (Multi-Select)</span>
              </div>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.zip"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {stagedFiles.length > 0 && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs font-semibold text-indigo-900">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>
                    {stagedFiles.some((f) => f.name.toLowerCase().endsWith(".zip"))
                      ? `${stagedFiles.length} file(s) selected (Includes ZIP Archive)`
                      : `${stagedFiles.length} resume file(s) ready to screen`}
                  </span>
                </div>
                <button onClick={() => setStagedFiles([])} className="text-indigo-600 hover:underline">
                  Clear
                </button>
              </div>
            )}

            {uploading && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-indigo-700 animate-pulse">
                  Extracting, parsing & scoring {stagedFiles.length} resumes...
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full animate-pulse w-full"></div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeBatchUpload}
                disabled={stagedFiles.length === 0 || uploading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-semibold text-xs shadow-md shadow-indigo-100"
              >
                {uploading ? "Processing Batch..." : "Start Batch Screening"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT JOB MODAL */}
      {showEditJobModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-bold text-base text-slate-900">Edit Job Opening</h3>
                <p className="text-xs text-slate-500">Update requirements or skills</p>
              </div>
              <button onClick={() => setShowEditJobModal(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleSaveJobEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Department</label>
                <input
                  type="text"
                  value={jobCompany}
                  onChange={(e) => setJobCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Job Description (JD)</label>
                <textarea
                  rows={4}
                  required
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Required Exp (Years)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={jobReqYears}
                    onChange={(e) => setJobReqYears(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Must-Have Skills</label>
                  <input
                    type="text"
                    value={jobMustHave}
                    onChange={(e) => setJobMustHave(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Skills / Keywords</label>
                <input
                  type="text"
                  value={jobSkills}
                  onChange={(e) => setJobSkills(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditJobModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-md shadow-indigo-100"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE JOB MODAL */}
      {showCreateJobModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-base text-slate-900">Post New Job Opening</h3>
              <button onClick={() => setShowCreateJobModal(false)} className="text-slate-400">✕</button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Backend Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Department</label>
                <input
                  type="text"
                  placeholder="e.g. Engineering"
                  value={jobCompany}
                  onChange={(e) => setJobCompany(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Job Description (JD)</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Paste JD text here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Required Exp (Years)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={jobReqYears}
                    onChange={(e) => setJobReqYears(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Must-Have Skills</label>
                  <input
                    type="text"
                    value={jobMustHave}
                    onChange={(e) => setJobMustHave(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Skills / Keywords</label>
                <input
                  type="text"
                  value={jobSkills}
                  onChange={(e) => setJobSkills(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateJobModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-md shadow-indigo-100"
                >
                  Create Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: AI Insights Quick Drawer / Modal */}
      {aiCandidateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 to-purple-50/70">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center space-x-2">
                    <span>{aiCandidateModal.name}</span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      Score: {aiCandidateModal.total_score}%
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    AI Candidate Analysis for: <b className="text-slate-700">{selectedJob?.title}</b>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Link
                  href={`/candidates/${aiCandidateModal.id}`}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
                >
                  <span>Full Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => setAiCandidateModal(null)}
                  className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center border border-slate-200 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <AiInsightsCard candidateId={aiCandidateModal.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
