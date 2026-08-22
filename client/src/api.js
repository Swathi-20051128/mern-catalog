import axios from "axios";

// In production (Vercel), set VITE_API_URL in the Vercel dashboard to your
// deployed backend, e.g. https://your-backend.onrender.com/api
// In local dev, Vite proxy handles "/api" -> http://localhost:5000
const BASE_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({ baseURL: BASE_URL });

// -- Sessions -----------------------------------------------------------------
export const getSessions = () => api.get("/sessions").then((r) => r.data);

export const getSession = (sessionId) =>
  api.get(`/sessions/${sessionId}`).then((r) => r.data);

export const deleteSession = (sessionId) =>
  api.delete(`/sessions/${sessionId}`).then((r) => r.data);

// -- Stats (session-scoped) ---------------------------------------------------
export const getStats = (sessionId) =>
  api.get(`/stats/${sessionId}`).then((r) => r.data);

export const getGlobalStats = () => api.get("/stats").then((r) => r.data);

// -- Records (session-scoped) -------------------------------------------------
export const getRecords = (sessionId, params) =>
  api.get("/records", { params: { sessionId, ...params } }).then((r) => r.data);

export const getRecord = (id) =>
  api.get(`/records/${id}`).then((r) => r.data);

export const exportCsvUrl = (sessionId) =>
  `${BASE_URL}/records/export/csv?sessionId=${sessionId}`;

export const downloadEnrichedCsv = (sessionId, filename = "enriched") => {
  const a = document.createElement("a");
  a.href = exportCsvUrl(sessionId);
  a.download = `${filename}_enriched.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// -- Upload -------------------------------------------------------------------
export const uploadFile = (file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post("/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total)
          onProgress(Math.round((evt.loaded / evt.total) * 100));
      },
    })
    .then((r) => r.data);
};

export const getUploadStatus = (sessionId) =>
  api.get(`/upload/status/${sessionId}`).then((r) => r.data);

export default api;
