import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import AddProject from './pages/AddProject';
import AuditDetail from './pages/AuditDetail';
import Competitors from './pages/Competitors';
import Keywords from './pages/Keywords';
import KeywordDetail from './pages/KeywordDetail';
import TechnicalSeo from './pages/TechnicalSeo';
import ContentEngine from './pages/ContentEngine';
import ContentBriefDetail from './pages/ContentBriefDetail';
import Reports from './pages/Reports';

function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/project/:id" element={<ProjectDetail />} />
          <Route path="/project/:id/edit" element={<AddProject />} />
          <Route path="/project/new" element={<AddProject />} />
          <Route path="/project/:id/competitors" element={<Competitors />} />
          <Route path="/project/:id/keywords" element={<Keywords />} />
          <Route path="/project/:id/keywords/:keyword" element={<KeywordDetail />} />
          <Route path="/project/:id/technical" element={<TechnicalSeo />} />
          <Route path="/project/:id/content" element={<ContentEngine />} />
          <Route path="/project/:id/content/brief/:briefId" element={<ContentBriefDetail />} />
          <Route path="/project/:id/reports" element={<Reports />} />
          <Route path="/audit/:auditId" element={<AuditDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
