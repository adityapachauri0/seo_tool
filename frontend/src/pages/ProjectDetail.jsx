import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Settings, AlertTriangle, Activity,
  Globe, FileText, Search, Key, Shield, BarChart3, Target
} from 'lucide-react';
import api from '../api/client';
import ScoreCircle from '../components/ScoreCircle';
import LoadingSpinner from '../components/LoadingSpinner';
import { timeAgo } from '../utils/timeAgo';

function ScoreTrendChart({ scores = [] }) {
  if (scores.length < 2) return null;

  const width = 400;
  const height = 120;
  const padding = 20;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const min = Math.min(...scores.map(s => s.score));
  const max = Math.max(...scores.map(s => s.score));
  const range = max - min || 1;

  const points = scores.map((s, i) => {
    const x = padding + (i / (scores.length - 1)) * chartW;
    const y = padding + chartH - ((s.score - min) / range) * chartH;
    return `${x},${y}`;
  });

  const polyline = points.join(' ');

  return (
    <div className="trend-chart">
      <h3 className="section-title">Score Trend</h3>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline
          points={polyline}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {scores.map((s, i) => {
          const x = padding + (i / (scores.length - 1)) * chartW;
          const y = padding + chartH - ((s.score - min) / range) * chartH;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#2563eb" />
              <text x={x} y={y - 10} textAnchor="middle" fontSize="11" fill="#64748b">
                {s.score}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [issueCounts, setIssueCounts] = useState({ critical: 0, warning: 0, info: 0 });
  const [scoreTrend, setScoreTrend] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projRes, auditRes, trendRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/audits/${id}`, { params: { page, limit: 10 } }),
        api.get(`/dashboard/${id}/trend`),
      ]);
      setProject(projRes.data.project || projRes.data);
      const auditData = auditRes.data;
      const auditsList = auditData.audits || [];
      setAudits(auditsList);
      setTotalPages(auditData.pagination?.totalPages || 1);

      // Compute issue counts from audits
      const counts = { critical: 0, warning: 0, info: 0 };
      auditsList.forEach(audit => {
        (audit.issues || []).forEach(issue => {
          if (counts[issue.severity] !== undefined) {
            counts[issue.severity]++;
          }
        });
      });
      setIssueCounts(counts);

      // Map score trend data
      const trendData = trendRes.data?.trend || trendRes.data || [];
      const chartData = Array.isArray(trendData) ? trendData.map(s => ({ date: s.date || s.crawledAt, score: s.score || s.avgScore })) : [];
      setScoreTrend(chartData);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, page]);

  const handleRunAudit = async () => {
    try {
      setRunning(true);
      setError(null);
      const res = await api.post(`/audits/run/${id}`);
      const jobId = res.data?.job?.jobId;

      if (!jobId) {
        await fetchData();
        setRunning(false);
        return;
      }

      // Poll crawler for job status every 3 seconds
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await api.get(`/audits/run/${id}/status`).catch(() => null);
          // Fallback: check if new audits appeared
          const auditRes = await api.get(`/audits/${id}?limit=1`);
          const latestAudit = auditRes.data?.audits?.[0];
          const latestTime = latestAudit ? new Date(latestAudit.crawledAt).getTime() : 0;
          const now = Date.now();

          // If audit data arrived in the last 2 minutes, crawl is done
          if (latestTime > now - 120000) {
            clearInterval(pollInterval);
            await fetchData();
            setRunning(false);
          }
        } catch (e) {
          // keep polling
        }
      }, 5000);

      // Safety timeout: stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        fetchData();
        setRunning(false);
      }, 300000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start audit');
      setRunning(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading project..." />;
  if (error) {
    return (
      <div className="page-container">
        <div className="error-banner">{error}</div>
      </div>
    );
  }
  if (!project) return null;

  const score = project.lastScore ?? project.score ?? 0;

  return (
    <div className="page-container">
      <button className="btn btn-ghost back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      <div className="project-header">
        <div className="project-header-left">
          <h1 className="page-title">{project.name}</h1>
          <p className="page-subtitle">
            <Globe size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {project.domain}
          </p>
        </div>
        <div className="project-header-right">
          <ScoreCircle score={score} size={96} />
          <div className="project-actions">
            <button
              className="btn btn-primary"
              onClick={handleRunAudit}
              disabled={running}
            >
              <RefreshCw size={16} className={running ? 'spin' : ''} />
              {running ? 'Running...' : 'Run Audit'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/project/${id}/competitors`)}
            >
              <Search size={16} />
              Competitors
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/project/${id}/keywords`)}
            >
              <Key size={16} />
              Keywords
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/project/${id}/opportunities`)}
            >
              <Target size={16} />
              Opportunities
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/project/${id}/content`)}
            >
              <FileText size={16} />
              Content
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/project/${id}/technical`)}
            >
              <Shield size={16} />
              Technical
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/project/${id}/reports`)}
            >
              <BarChart3 size={16} />
              Reports
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/project/${id}/edit`)}
            >
              <Settings size={16} />
              Edit
            </button>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="issues-summary card">
          <h3 className="section-title">Issues Summary</h3>
          <div className="issues-counts">
            <div className="issue-count-item severity-critical">
              <AlertTriangle size={20} />
              <span className="issue-count-number">{issueCounts.critical}</span>
              <span className="issue-count-label">Critical</span>
            </div>
            <div className="issue-count-item severity-warning">
              <AlertTriangle size={20} />
              <span className="issue-count-number">{issueCounts.warning}</span>
              <span className="issue-count-label">Warning</span>
            </div>
            <div className="issue-count-item severity-info">
              <Activity size={20} />
              <span className="issue-count-number">{issueCounts.info}</span>
              <span className="issue-count-label">Info</span>
            </div>
          </div>
        </div>

        {scoreTrend.length >= 2 && (
          <div className="card">
            <ScoreTrendChart scores={scoreTrend} />
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 className="section-title">Audited Pages</h3>
        {audits.length === 0 ? (
          <p className="text-muted" style={{ padding: '24px 0', textAlign: 'center' }}>
            No audits yet. Click "Run Audit" to crawl this site.
          </p>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Score</th>
                    <th>Issues</th>
                    <th>Crawled</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((audit) => {
                    const auditScore = audit.seoScore ?? audit.score ?? 0;
                    const auditId = audit._id || audit.id;
                    const issueCount =
                      audit.issueCount ??
                      (audit.issues ? audit.issues.length : 0);
                    return (
                      <tr
                        key={auditId}
                        className="table-row-clickable"
                        onClick={() => navigate(`/audit/${auditId}`)}
                      >
                        <td className="url-cell">
                          <FileText size={14} />
                          {audit.url || audit.path || '/'}
                        </td>
                        <td>
                          <span className={`score-badge score-${auditScore >= 80 ? 'green' : auditScore >= 50 ? 'yellow' : 'red'}`}>
                            {auditScore}
                          </span>
                        </td>
                        <td>{issueCount}</td>
                        <td className="text-muted">{timeAgo(audit.crawledAt || audit.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ProjectDetail;
