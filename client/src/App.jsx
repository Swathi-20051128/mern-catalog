import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar   from "./components/Sidebar";
import Sessions  from "./pages/Sessions";
import Dashboard from "./pages/Dashboard";
import Catalog   from "./pages/Catalog";
import Upload    from "./pages/Upload";

export default function App() {
  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <Routes>
        {/* Default: My Uploads (sessions list) */}
        <Route path="/"         element={<Sessions />} />

        {/* Upload new file */}
        <Route path="/upload"   element={<Upload />} />

        {/* Session-scoped views */}
        <Route path="/dashboard/:sessionId" element={<Dashboard />} />
        <Route path="/catalog/:sessionId"   element={<Catalog />} />
        <Route path="/review/:sessionId"    element={<Catalog reviewOnly />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
