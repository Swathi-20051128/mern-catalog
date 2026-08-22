import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderOpen, UploadCloud, CheckCircle2, Clock, AlertCircle,
  Trash2, BarChart2, Table2, FlagTriangleRight, FileSpreadsheet, FileText,
} from "lucide-react";
import Topbar from "../components/Topbar";
import { getSessions, deleteSession } from "../api";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end) - new Date(start);
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function StatusBadge({ status }) {
  const map = {
    done:       { icon: CheckCircle2,  cls: "bg-good-soft text-good border-good/20",     label: "Done" },
    processing: { icon: Clock,         cls: "bg-mid-soft text-mid border-mid/20",         label: "Processing…" },
    uploading:  { icon: Clock,         cls: "bg-mid-soft text-mid border-mid/20",         label: "Uploading…" },
    error:      { icon: AlertCircle,   cls: "bg-low-soft text-low border-low/20",         label: "Failed" },
  };
  const { icon: Icon, cls, label } = map[status] || map.processing;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${cls}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getSessions()
      .then((data) => {
        // Guard: API may return an error object or non-array on failure
        setSessions(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to load sessions:", err);
        setLoadError("Could not connect to server. Please ensure the backend is running.");
        setSessions([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Auto-refresh while there are in-progress sessions
    const interval = setInterval(() => {
      setSessions((prev) => {
        if (!Array.isArray(prev)) return prev;
        const hasPending = prev.some((s) => s.status === "processing" || s.status === "uploading");
        if (hasPending) load();
        return prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation();
    if (!confirm("Delete this session and all its records?")) return;
    setDeleting(sessionId);
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err) {
      alert("Failed to delete session: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex-1 min-w-0">
      <Topbar
        title="My Uploads"
        subtitle="Each uploaded file is processed independently by GPT AI Agents. Click a session to view its analysis."
        actions={
          <button
            onClick={() => navigate("/upload")}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-[12.5px] font-medium hover:bg-accent/90 transition-colors"
          >
            <UploadCloud size={14} />
            Upload File
          </button>
        }
      />

      <div className="px-8 py-6">
        {loading && (
          <div className="text-ink/40 text-sm py-20 text-center">Loading sessions…</div>
        )}

        {!loading && loadError && (
          <div className="flex items-start gap-3 bg-low-soft border border-low/20 text-low rounded-xl px-5 py-4 text-[13px] mt-4">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-medium mb-1">Failed to load sessions</div>
              <div className="text-low/80">{loadError}</div>
            </div>
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="h-20 w-20 rounded-2xl bg-accent/10 flex items-center justify-center">
              <FolderOpen size={36} className="text-accent/60" />
            </div>
            <div className="text-center">
              <h2 className="font-display font-semibold text-[18px] mb-2">No uploads yet</h2>
              <p className="text-ink/50 text-[13px] max-w-sm">
                Upload a CSV or Excel file to start AI-powered product catalog enrichment.
              </p>
            </div>
            <button
              onClick={() => navigate("/upload")}
              className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl text-[13.5px] font-medium hover:bg-accent/90 transition-colors shadow-lg"
            >
              <UploadCloud size={16} />
              Upload Your First File
            </button>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isProcessing = session.status === "processing" || session.status === "uploading";
              const isDone = session.status === "done";
              const isError = session.status === "error";
              const FileIcon = session.fileType === "csv" ? FileText : FileSpreadsheet;

              return (
                <div
                  key={session.sessionId}
                  onClick={() => isDone && navigate(`/dashboard/${session.sessionId}`)}
                  className={`bg-panel border border-border rounded-xl p-5 transition-all ${
                    isDone
                      ? "hover:border-accent/40 hover:shadow-md cursor-pointer"
                      : isProcessing
                      ? "opacity-80"
                      : "opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: File info */}
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="h-11 w-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                        <FileIcon size={20} className="text-accent" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] truncate max-w-md">{session.filename}</div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <StatusBadge status={session.status} />
                          <span className="text-[12px] text-ink/45 font-mono">
                            {session.rowCount?.toLocaleString()} rows
                          </span>
                          <span className="text-[12px] text-ink/40">
                            {formatDate(session.uploadedAt)}
                          </span>
                          {isDone && session.completedAt && (
                            <span className="text-[11.5px] text-ink/35 font-mono">
                              ⏱ {formatDuration(session.uploadedAt, session.completedAt)}
                            </span>
                          )}
                        </div>
                        {isError && session.errorMessage && (
                          <div className="mt-2 text-[12px] text-low bg-low-soft border border-low/20 rounded-lg px-3 py-2">
                            {session.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Stats + Actions */}
                    <div className="flex items-center gap-4 shrink-0">
                      {isDone && session.stats && (
                        <div className="hidden lg:flex items-center gap-5 text-center">
                          <div>
                            <div className="font-semibold text-[15px] text-accent">
                              {session.stats.avgConfidence ?? "—"}%
                            </div>
                            <div className="text-[10.5px] text-ink/40 font-mono">Avg Confidence</div>
                          </div>
                          <div>
                            <div className="font-semibold text-[15px]">
                              {session.stats.categorized ?? "—"}
                            </div>
                            <div className="text-[10.5px] text-ink/40 font-mono">Classified</div>
                          </div>
                          <div>
                            <div className="font-semibold text-[15px] text-low">
                              {session.stats.needsReview ?? "—"}
                            </div>
                            <div className="text-[10.5px] text-ink/40 font-mono">Need Review</div>
                          </div>
                        </div>
                      )}

                      {isDone && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/${session.sessionId}`); }}
                            className="p-2 rounded-lg border border-border hover:bg-accent/5 hover:border-accent/30 transition-colors"
                            title="View Dashboard"
                          >
                            <BarChart2 size={15} className="text-accent" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/catalog/${session.sessionId}`); }}
                            className="p-2 rounded-lg border border-border hover:bg-accent/5 hover:border-accent/30 transition-colors"
                            title="View Catalog"
                          >
                            <Table2 size={15} className="text-ink/60" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/review/${session.sessionId}`); }}
                            className="p-2 rounded-lg border border-border hover:bg-low-soft hover:border-low/30 transition-colors"
                            title="Review Queue"
                          >
                            <FlagTriangleRight size={15} className="text-low" />
                          </button>
                        </div>
                      )}

                      <button
                        onClick={(e) => handleDelete(e, session.sessionId)}
                        disabled={deleting === session.sessionId || isProcessing}
                        className="p-2 rounded-lg border border-border hover:bg-low-soft hover:border-low/30 transition-colors disabled:opacity-30"
                        title="Delete session"
                      >
                        <Trash2 size={15} className="text-ink/40 hover:text-low" />
                      </button>
                    </div>
                  </div>

                  {/* Processing progress bar */}
                  {isProcessing && (
                    <div className="mt-4">
                      <div className="h-1 bg-paper rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full animate-pulse w-2/3" />
                      </div>
                      <div className="text-[11px] text-ink/40 font-mono mt-1.5">
                        AI agents are processing your file… this may take a few minutes
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
