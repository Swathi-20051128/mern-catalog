import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Boxes, Gauge, ShieldCheck, FlagTriangleRight, Tags,
  Table2, Bot, ArrowLeft, BarChart2,
  AlertCircle, Loader2, Download,
} from "lucide-react";
import Topbar    from "../components/Topbar";
import StatCard  from "../components/StatCard";
import CategoryChart   from "../components/CategoryChart";
import ConfidenceChart from "../components/ConfidenceChart";
import { getStats, getUploadStatus, exportCsvUrl } from "../api";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function Dashboard() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [stats,  setStats]  = useState(null);
  const [status, setStatus] = useState(null); // "processing" | "done" | "error"
  const [error,  setError]  = useState(null);

  useEffect(() => {
    if (!sessionId) return;

    const load = async () => {
      try {
        // First check session status
        const sess = await getUploadStatus(sessionId);
        setStatus(sess.status);

        if (sess.status === "done") {
          const s = await getStats(sessionId);
          setStats(s);
        }
      } catch (e) {
        setError(e.response?.data?.error || e.message);
      }
    };

    load();

    // Poll if still processing
    const interval = setInterval(async () => {
      if (status === "done" || status === "error") return;
      try {
        const sess = await getUploadStatus(sessionId);
        setStatus(sess.status);
        if (sess.status === "done") {
          const s = await getStats(sessionId);
          setStats(s);
        }
      } catch (_) {}
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId]);

  // Empty state — no sessionId
  if (!sessionId) {
    return (
      <div className="flex-1 min-w-0">
        <Topbar title="Dashboard" subtitle="Select an upload session to view its analysis." />
        <div className="flex flex-col items-center justify-center py-28 gap-5 px-8">
          <div className="h-20 w-20 rounded-2xl bg-accent/10 flex items-center justify-center">
            <BarChart2 size={36} className="text-accent/60" />
          </div>
          <div className="text-center">
            <h2 className="font-display font-semibold text-[18px] mb-2">No session selected</h2>
            <p className="text-ink/50 text-[13px] max-w-sm">
              Upload a CSV or Excel file to start enrichment analysis.
            </p>
          </div>
          <button
            onClick={() => navigate("/upload")}
            className="px-6 py-3 bg-accent text-white rounded-xl text-[13.5px] font-medium hover:bg-accent/90 transition-colors"
          >
            Upload a File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0">
      <Topbar
        title={stats?.filename || "Enrichment Dashboard"}
        subtitle={
          stats
            ? `Uploaded ${formatDate(stats.uploadedAt)} · ${stats.rowCount?.toLocaleString()} rows · Processed by GPT AI Agents`
            : "Loading session data…"
        }
        badge={stats ? "MongoDB" : undefined}
        actions={
          <div className="flex items-center gap-2">
            {stats && (
              <a
                href={exportCsvUrl(sessionId)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-[12px] font-medium hover:bg-accent/90 transition-colors"
              >
                <Download size={13} />
                Export CSV
              </a>
            )}
            <Link
              to="/"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] text-ink/60 hover:bg-paper transition-colors"
            >
              <ArrowLeft size={13} />
              All Uploads
            </Link>
          </div>
        }
      />

      <div className="px-8 py-6 max-w-7xl">
        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center gap-2.5 bg-low-soft border border-low/20 text-low text-[13px] rounded-lg px-4 py-3">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Processing state */}
        {(status === "processing" || status === "uploading") && (
          <div className="flex items-center gap-3 mb-6 bg-accent/5 border border-accent/15 rounded-xl px-5 py-4 text-[13px]">
            <Loader2 size={16} className="animate-spin text-accent" />
            <span className="text-accent font-medium">GPT AI Agents are processing your file…</span>
            <span className="text-ink/50">This page will update automatically when complete.</span>
          </div>
        )}

        {/* Stats */}
        {!stats ? (
          <div className="text-ink/40 text-sm py-20 text-center">
            {status === "processing" ? "Processing in progress…" : "Loading metrics…"}
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <StatCard label="Total records"     value={stats.total}            icon={Boxes} />
              <StatCard
                label="Avg. confidence"
                value={`${stats.avgConfidence}%`}
                icon={Gauge}
                tone={stats.avgConfidence >= 60 ? "good" : "mid"}
              />
              <StatCard
                label="Classified"
                value={`${stats.categorizedPct}%`}
                sub={`${stats.categorized} of ${stats.total} rows`}
                icon={Tags}
                tone="accent"
              />
              <StatCard
                label="Attributes extracted"
                value={`${stats.withAttrsPct}%`}
                sub={`${stats.withAttrs} of ${stats.total} rows`}
                icon={ShieldCheck}
                tone="teal"
              />
              <StatCard
                label="Needs review"
                value={`${stats.needsReviewPct}%`}
                sub={`${stats.needsReview} rows flagged`}
                icon={FlagTriangleRight}
                tone="low"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3 bg-panel border border-border rounded-xl shadow-card p-5">
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="font-display font-semibold text-[14.5px]">Category breakdown</h3>
                  <span className="text-[11px] text-ink/40 font-mono">
                    top {Math.min(7, stats.categoryBreakdown?.length || 0)}
                  </span>
                </div>
                <p className="text-[12px] text-ink/45 mb-2">
                  Rows classified per top-level category by the GPT Classifier Agent.
                </p>
                <CategoryChart data={stats.categoryBreakdown || []} />
              </div>

              <div className="lg:col-span-2 bg-panel border border-border rounded-xl shadow-card p-5">
                <h3 className="font-display font-semibold text-[14.5px] mb-1">Confidence distribution</h3>
                <p className="text-[12px] text-ink/45 mb-2">
                  Confidence score from manufacturer, brand, classification, and attribute signals.
                </p>
                <ConfidenceChart data={stats.confidenceBuckets || []} />
              </div>
            </div>

            {/* AI Agent pipeline stages */}
            <div className="mt-5 bg-panel border border-border rounded-xl shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Bot size={16} className="text-accent" />
                <h3 className="font-display font-semibold text-[14.5px]">AI Agent Pipeline Stages</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ["🏷️ Classifier",   "GPT-4o-mini",  "Category + classpath assignment"],
                  ["🔍 Brand",        "GPT-4o-mini",  "Manufacturer & brand resolution"],
                  ["📐 Attributes",   "GPT-4o-mini",  "Spec extraction (size, grit, voltage…)"],
                  ["✍️ Descriptions", "GPT-4o-mini",  "4 catalog copy formats generated"],
                  ["📊 Confidence",   "Algorithmic",  "Quality scoring + review flagging"],
                ].map(([step, model, desc]) => (
                  <div key={step} className="border border-border rounded-lg px-3 py-3 bg-paper">
                    <div className="text-[12.5px] font-semibold text-accent mb-0.5">{step}</div>
                    <div className="text-[10.5px] font-mono text-ink/40 mb-1">{model}</div>
                    <div className="text-[11.5px] text-ink/55 leading-snug">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                to={`/catalog/${sessionId}`}
                className="flex items-center gap-2 px-4 py-2.5 bg-ink text-white rounded-lg text-[12.5px] font-medium hover:bg-teal transition-colors"
              >
                <Table2 size={14} />
                View Catalog
              </Link>
              <Link
                to={`/review/${sessionId}`}
                className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-[12.5px] font-medium hover:bg-paper transition-colors"
              >
                <FlagTriangleRight size={14} className="text-low" />
                Review Queue ({stats.needsReview})
              </Link>
              <a
                href={exportCsvUrl(sessionId)}
                className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-[12.5px] font-medium hover:bg-accent/90 transition-colors shadow-sm"
              >
                <Download size={14} />
                Download Enriched CSV
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
