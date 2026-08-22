import { useCallback, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud, FileSpreadsheet, FileText, CheckCircle2,
  AlertCircle, Clock, Loader2, Bot, Sparkles,
} from "lucide-react";
import Topbar from "../components/Topbar";
import { uploadFile, getUploadStatus } from "../api";

const ACCEPTED = ".csv,.xlsx,.xls";

function ProgressStep({ label, done, active }) {
  return (
    <div className={`flex items-center gap-3 text-[13px] transition-opacity ${!done && !active ? "opacity-40" : ""}`}>
      <div
        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
          done ? "bg-good text-white" : active ? "bg-accent text-white" : "bg-paper border border-border text-ink/40"
        }`}
      >
        {done ? <CheckCircle2 size={13} /> : active ? <Loader2 size={13} className="animate-spin" /> : <span className="text-[10px]">·</span>}
      </div>
      <span className={done ? "text-good" : active ? "text-accent font-medium" : "text-ink/50"}>
        {label}
      </span>
    </div>
  );
}

export default function Upload() {
  const [dragOver, setDragOver]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [phase, setPhase]         = useState(null); // "uploading"|"processing"|"done"|"error"
  const [sessionId, setSessionId] = useState(null);
  const [error, setError]         = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const handleFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext)) {
      setError("Unsupported file type. Please upload a CSV or Excel (.xlsx, .xls) file.");
      return;
    }
    setError(null);
    setSelectedFile(file);
    setPhase("uploading");
    setUploading(true);
    setProgress(0);

    uploadFile(file, (pct) => setProgress(pct))
      .then((data) => {
        setSessionId(data.sessionId);
        setPhase("processing");
      })
      .catch((e) => {
        // Always store a plain string — rendering a non-string object as a
        // React child throws Minified React Error #31.
        const msg =
          (typeof e.response?.data?.error === "string" && e.response.data.error) ||
          (typeof e.message === "string" && e.message) ||
          "Upload failed. Please try again.";
        setError(msg);
        setPhase("error");
      })
      .finally(() => setUploading(false));
  }, []);

  // Poll for processing completion
  useEffect(() => {
    if (!sessionId || phase !== "processing") return;

    const interval = setInterval(async () => {
      try {
        const status = await getUploadStatus(sessionId);
        if (status.status === "done") {
          setPhase("done");
          clearInterval(interval);
          // Auto-navigate to dashboard after 1.5s
          setTimeout(() => navigate(`/dashboard/${sessionId}`), 1500);
        } else if (status.status === "error") {
          setError(status.errorMessage || "Processing failed.");
          setPhase("error");
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Status poll error:", err.message);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [sessionId, phase, navigate]);

  const reset = () => {
    setDragOver(false);
    setUploading(false);
    setProgress(0);
    setPhase(null);
    setSessionId(null);
    setError(null);
    setSelectedFile(null);
  };

  return (
    <div className="flex-1 min-w-0">
      <Topbar
        title="Upload File"
        subtitle="Upload a CSV or Excel file to enrich with GPT AI Agents. Analysis is shown only for your uploaded data."
      />

      <div className="px-8 py-8 max-w-3xl">
        {/* Drop zone */}
        {!phase && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-accent bg-accent/5 scale-[1.01]"
                : "border-border bg-panel hover:border-accent/50 hover:bg-accent/3"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <UploadCloud size={40} className="mx-auto mb-4 text-accent/60" />
            <div className="font-display font-semibold text-[16px] mb-2">
              Drop a file here, or click to browse
            </div>
            <div className="text-[13px] text-ink/45 mb-4">
              Supports CSV and Excel files (.xlsx, .xls)
            </div>

            {/* Accepted formats */}
            <div className="flex items-center justify-center gap-3">
              {[
                { icon: FileText,        label: ".csv",  color: "text-teal" },
                { icon: FileSpreadsheet, label: ".xlsx", color: "text-good" },
                { icon: FileSpreadsheet, label: ".xls",  color: "text-good" },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 bg-paper border border-border rounded-lg text-[12px]">
                  <Icon size={13} className={color} />
                  <span className="font-mono text-ink/60">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expected columns hint */}
        {!phase && (
          <div className="mt-5 bg-panel border border-border rounded-xl p-5">
            <div className="font-medium text-[13.5px] mb-3">Expected column names</div>
            <div className="flex flex-wrap gap-2">
              {["Mfg_Part_Num", "Part_Desc", "Part_Manuf", "E1_Brand", "Unilog_Brand", "DIB_Brand"].map((col) => (
                <span key={col} className="px-2.5 py-1 bg-paper border border-border rounded-md font-mono text-[11.5px] text-ink/65">
                  {col}
                </span>
              ))}
            </div>
            <p className="text-[12px] text-ink/40 mt-3">
              Only <span className="font-mono text-ink/60">Mfg_Part_Num</span> and{" "}
              <span className="font-mono text-ink/60">Part_Desc</span> are required. Other columns improve enrichment accuracy.
            </p>
          </div>
        )}

        {/* Processing status */}
        {phase && phase !== "error" && (
          <div className="bg-panel border border-border rounded-2xl p-7 space-y-6">
            {/* File info */}
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <FileText size={18} className="text-accent" />
              </div>
              <div>
                <div className="font-medium text-[14px]">{selectedFile?.name}</div>
                <div className="text-[12px] text-ink/45 font-mono">
                  {selectedFile ? (selectedFile.size / 1024).toFixed(1) + " KB" : ""}
                </div>
              </div>
            </div>

            {/* Pipeline steps */}
            <div className="space-y-3">
              <ProgressStep
                label="Uploading file to server"
                done={["processing", "done"].includes(phase)}
                active={phase === "uploading"}
              />
              <ProgressStep
                label="Classifier Agent — categorizing products"
                done={phase === "done"}
                active={phase === "processing"}
              />
              <ProgressStep
                label="Brand Agent — resolving brand names"
                done={phase === "done"}
                active={phase === "processing"}
              />
              <ProgressStep
                label="Attribute Agent — extracting specifications"
                done={phase === "done"}
                active={phase === "processing"}
              />
              <ProgressStep
                label="Description Agent — generating catalog copy"
                done={phase === "done"}
                active={phase === "processing"}
              />
              <ProgressStep
                label="Confidence scoring & saving to MongoDB"
                done={phase === "done"}
                active={phase === "processing"}
              />
            </div>

            {/* Upload progress bar */}
            {phase === "uploading" && (
              <div>
                <div className="flex justify-between text-[11px] text-ink/45 font-mono mb-1.5">
                  <span>Upload progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-paper rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Processing spinner */}
            {phase === "processing" && (
              <div className="flex items-center gap-2.5 text-[12.5px] text-ink/50 font-mono">
                <Loader2 size={14} className="animate-spin text-accent" />
                <span>GPT AI Agents are processing your file. This may take 1–3 minutes…</span>
              </div>
            )}

            {/* Done! */}
            {phase === "done" && (
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 text-good font-medium text-[13.5px]">
                  <CheckCircle2 size={18} />
                  Processing complete! Redirecting to dashboard…
                </div>
              </div>
            )}

            {phase !== "done" && (
              <button onClick={reset} className="text-[12px] text-ink/40 hover:text-ink/70 transition-colors underline underline-offset-2">
                Cancel and start over
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-low-soft border border-low/20 text-low rounded-xl px-5 py-4 text-[13px]">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-medium mb-1">Processing failed</div>
                <div className="text-low/80">{error}</div>
              </div>
            </div>
            <button
              onClick={reset}
              className="px-4 py-2 border border-border rounded-lg text-[12.5px] font-medium hover:bg-paper transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Error without phase */}
        {!phase && error && (
          <div className="mt-4 flex items-start gap-2.5 bg-low-soft border border-low/20 text-low rounded-lg px-4 py-3 text-[13px]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* AI Agent info */}
        {!phase && (
          <div className="mt-5 bg-accent/5 border border-accent/15 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bot size={16} className="text-accent" />
              <span className="font-semibold text-[13.5px]">AI Agent Pipeline</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "🏷️ Classifier Agent", desc: "GPT-4o-mini • Category + classpath" },
                { label: "🔍 Brand Agent",       desc: "GPT-4o-mini • Brand resolution" },
                { label: "📐 Attribute Agent",   desc: "GPT-4o-mini • Specs extraction" },
                { label: "✍️ Description Agent", desc: "GPT-4o-mini • 4 copy formats" },
              ].map(({ label, desc }) => (
                <div key={label} className="bg-white/60 rounded-lg px-3 py-2.5 border border-accent/10">
                  <div className="text-[12.5px] font-medium">{label}</div>
                  <div className="text-[11px] text-ink/45 mt-0.5">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
