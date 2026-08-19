import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Search, Download, ChevronLeft, ChevronRight, ArrowLeft, BarChart2 } from "lucide-react";
import Topbar          from "../components/Topbar";
import ConfidenceBadge from "../components/ConfidenceBadge";
import RecordDrawer    from "../components/RecordDrawer";
import { getRecords, getStats, exportCsvUrl } from "../api";

const PAGE_SIZE = 25;

export default function Catalog({ reviewOnly = false }) {
  const { sessionId } = useParams();
  const [rows,       setRows]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState("");
  const [category,   setCategory]   = useState("");
  const [categories, setCategories] = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    getStats(sessionId)
      .then((s) => setCategories((s.categoryBreakdown || []).map((c) => c.name)))
      .catch(console.error);
  }, [sessionId]);

  const load = useCallback(() => {
    if (!sessionId) return;
    setLoading(true);
    getRecords(sessionId, {
      search:      search || undefined,
      category:    category || undefined,
      needsReview: reviewOnly ? "true" : undefined,
      page,
      limit:       PAGE_SIZE,
    })
      .then((data) => { setRows(data.items); setTotal(data.total); })
      .finally(() => setLoading(false));
  }, [sessionId, search, category, page, reviewOnly]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => setPage(1), [search, category, reviewOnly]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!sessionId) {
    return (
      <div className="flex-1 min-w-0">
        <Topbar title="Catalog" subtitle="Select an upload session first." />
        <div className="px-8 py-12 text-ink/40 text-sm text-center">
          No session selected.{" "}
          <Link to="/" className="text-accent underline underline-offset-2">Go to My Uploads</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0">
      <Topbar
        title={reviewOnly ? "Review Queue" : "Product Catalog"}
        subtitle={
          reviewOnly
            ? "Rows flagged below the confidence threshold — review and enrich manually."
            : "Every enriched record: brand, classpath, AI-extracted attributes, and generated descriptions."
        }
        actions={
          <Link
            to={`/dashboard/${sessionId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] text-ink/60 hover:bg-paper transition-colors"
          >
            <BarChart2 size={13} />
            Dashboard
          </Link>
        }
      />

      <div className="px-8 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search part number, description, brand, manufacturer…"
              className="w-full pl-9 pr-3 py-2.5 text-[13px] bg-panel border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          {!reviewOnly && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2.5 text-[13px] bg-panel border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <a
            href={exportCsvUrl(sessionId)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-ink text-white rounded-lg text-[12.5px] font-medium hover:bg-teal transition-colors"
          >
            <Download size={14} /> Export CSV
          </a>
        </div>

        <div className="text-[12px] font-mono text-ink/45 mb-2">
          {total.toLocaleString()} row{total !== 1 ? "s" : ""} matched
        </div>

        <div className="bg-panel border border-border rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-paper border-b border-border">
                  {["MPN", "Description", "Manufacturer", "Brand", "Category", "Confidence"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 font-mono text-[10.5px] uppercase tracking-wide text-ink/45 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-ink/40">Loading…</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-ink/40">No matching rows.</td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r._id}
                      onClick={() => setSelected(r)}
                      className="border-b border-border last:border-0 hover:bg-teal-soft/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-ink/70 whitespace-nowrap">{r.mpn}</td>
                      <td className="px-4 py-3 max-w-[280px] truncate text-ink/70 italic">{r.originalDescription}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.manufacturer || "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">{r.brand || "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-ink/60">{r.category}</td>
                      <td className="px-4 py-3"><ConfidenceBadge value={r.confidence} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-paper text-[12px]">
            <span className="text-ink/45">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-md border border-border disabled:opacity-30 hover:bg-ink/5"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-md border border-border disabled:opacity-30 hover:bg-ink/5"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <RecordDrawer record={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
