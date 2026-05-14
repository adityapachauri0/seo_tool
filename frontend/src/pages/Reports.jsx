import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Bell, BellOff, AlertTriangle, CheckCircle,
  TrendingDown, TrendingUp, RefreshCw, Eye, ChevronDown, ChevronUp,
  Activity, Bug, Radio, ArrowUpDown, X
} from 'lucide-react';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import { timeAgo } from '../utils/timeAgo';

const SEVERITY_COLORS = {
  critical: { bg: '#fef2f2', border: '#dc2626', text: '#dc2626', icon: AlertTriangle },
  warning: { bg: '#fefce8', border: '#eab308', text: '#a16207', icon: AlertTriangle },
  info: { bg: '#eff6ff', border: '#2563eb', text: '#2563eb', icon: Activity },
};

const ALERT_TYPE_CONFIG = {
  score_drop: { icon: TrendingDown, color: '#dc2626', label: 'Score Drop' },
  new_issue: { icon: Bug, color: '#ea580c', label: 'New Issues' },
  crawl_complete: { icon: CheckCircle, color: '#2563eb', label: 'Crawl Complete' },
  rank_change: { icon: ArrowUpDown, color: '#7c3aed', label: 'Rank Change' },
  competitor_change: { icon: Radio, color: '#7c3aed', label: 'Competitor Change' },
};

function ReportCard({ report, onView }) {
  const d = report.data || {};
  const scoreColor = d.overallScore >= 80 ? 'green' : d.overallScore >= 50 ? 'yellow' : 'red';
  const changeSign = d.scoreChange > 0 ? '+' : '';

  return (
    <div className="report-card card" onClick={() => onView(report._id)}>
      <div className="report-card-header">
        <div className="report-card-type">
          <FileText size={16} />
          <span className="report-type-badge">{report.type}</span>
        </div>
        <span className="report-card-date">{new Date(report.generatedAt).toLocaleDateString()}</span>
      </div>
      <div className="report-card-body">
        <div className="report-card-score">
          <span className={`score-badge score-${scoreColor}`}>{d.overallScore || 0}</span>
          {d.scoreChange !== 0 && (
            <span className={`report-score-change ${d.scoreChange > 0 ? 'positive' : 'negative'}`}>
              {d.scoreChange > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {changeSign}{d.scoreChange}
            </span>
          )}
        </div>
        <div className="report-card-stats">
          <span>{d.totalPages || 0} pages</span>
          <span className="report-card-stat-sep">|</span>
          <span className="text-danger">{d.issuesSummary?.critical || 0} critical</span>
          <span className="report-card-stat-sep">|</span>
          <span className="text-warning">{d.issuesSummary?.warning || 0} warnings</span>
        </div>
      </div>
      <div className="report-card-footer">
        <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); onView(report._id); }}>
          <Eye size={14} />
          View Report
        </button>
      </div>
    </div>
  );
}

function ReportDetail({ reportId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/reports/detail/${reportId}`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to load report:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reportId]);

  if (loading) return <LoadingSpinner message="Loading report..." />;
  if (!data) return <div className="error-banner">Failed to load report.</div>;

  const { report, plainText } = data;
  const d = report.data || {};

  return (
    <div className="report-detail">
      <div className="report-detail-header">
        <h2>
          <FileText size={20} />
          SEO Report — {report.type.charAt(0).toUpperCase() + report.type.slice(1)}
        </h2>
        <button className="btn btn-ghost" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="report-detail-meta">
        <span>Generated: {new Date(report.generatedAt).toLocaleDateString()}</span>
        {report.period?.start && (
          <span>
            Period: {new Date(report.period.start).toLocaleDateString()} &ndash; {new Date(report.period.end).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="report-overview-grid">
        <div className="report-overview-card">
          <div className="report-overview-label">Overall Score</div>
          <div className="report-overview-value">{d.overallScore}/100</div>
          {d.scoreChange !== 0 && (
            <div className={`report-score-change ${d.scoreChange > 0 ? 'positive' : 'negative'}`}>
              {d.scoreChange > 0 ? '+' : ''}{d.scoreChange} pts
            </div>
          )}
        </div>
        <div className="report-overview-card">
          <div className="report-overview-label">Pages Audited</div>
          <div className="report-overview-value">{d.totalPages}</div>
        </div>
        <div className="report-overview-card">
          <div className="report-overview-label">Critical Issues</div>
          <div className="report-overview-value text-danger">{d.issuesSummary?.critical || 0}</div>
        </div>
        <div className="report-overview-card">
          <div className="report-overview-label">Warnings</div>
          <div className="report-overview-value text-warning">{d.issuesSummary?.warning || 0}</div>
        </div>
      </div>

      {d.topIssues && d.topIssues.length > 0 && (
        <div className="report-section">
          <h3 className="section-title">Top Issues</h3>
          <div className="report-issues-list">
            {d.topIssues.slice(0, 5).map((issue, i) => {
              const sevConfig = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.info;
              return (
                <div key={i} className="report-issue-row" style={{ borderLeftColor: sevConfig.border }}>
                  <span className="report-issue-type">{issue.type.replace(/_/g, ' ')}</span>
                  <span className="report-issue-count">{issue.count} occurrence(s)</span>
                  <span className="report-issue-severity" style={{ color: sevConfig.text }}>{issue.severity}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="report-pages-grid">
        {d.bestPages && d.bestPages.length > 0 && (
          <div className="report-section">
            <h3 className="section-title">
              <TrendingUp size={16} />
              Best Pages
            </h3>
            <ul className="report-pages-list">
              {d.bestPages.map((p, i) => (
                <li key={i}>
                  <span className={`score-badge score-${p.score >= 80 ? 'green' : p.score >= 50 ? 'yellow' : 'red'}`}>{p.score}</span>
                  <span className="report-page-url">{p.url}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {d.worstPages && d.worstPages.length > 0 && (
          <div className="report-section">
            <h3 className="section-title">
              <TrendingDown size={16} />
              Pages Needing Attention
            </h3>
            <ul className="report-pages-list">
              {d.worstPages.map((p, i) => (
                <li key={i}>
                  <span className={`score-badge score-${p.score >= 80 ? 'green' : p.score >= 50 ? 'yellow' : 'red'}`}>{p.score}</span>
                  <span className="report-page-url">{p.url}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {d.contentStats && (
        <div className="report-section">
          <h3 className="section-title">Content Statistics</h3>
          <div className="report-content-stats">
            <div className="report-content-stat">
              <span className="report-content-stat-label">Avg Word Count</span>
              <span className="report-content-stat-value">{d.contentStats.avgWordCount}</span>
            </div>
            <div className="report-content-stat">
              <span className="report-content-stat-label">Total Words</span>
              <span className="report-content-stat-value">{d.contentStats.totalWords?.toLocaleString()}</span>
            </div>
            <div className="report-content-stat">
              <span className="report-content-stat-label">Thin Pages (&lt;300 words)</span>
              <span className="report-content-stat-value">{d.contentStats.pagesBelow300}</span>
            </div>
          </div>
        </div>
      )}

      {d.recommendations && d.recommendations.length > 0 && (
        <div className="report-section">
          <h3 className="section-title">Recommendations</h3>
          <ul className="report-recommendations">
            {d.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="report-plaintext-toggle">
        <summary>View Plain Text Report</summary>
        <pre className="code-block">{plainText}</pre>
      </details>
    </div>
  );
}

function AlertItem({ alert, onMarkRead }) {
  const config = ALERT_TYPE_CONFIG[alert.type] || ALERT_TYPE_CONFIG.crawl_complete;
  const Icon = config.icon;
  const sevConfig = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info;

  return (
    <div
      className={`alert-item ${alert.read ? 'alert-read' : 'alert-unread'}`}
      style={{ borderLeftColor: sevConfig.border, background: alert.read ? 'var(--card)' : sevConfig.bg }}
    >
      <div className="alert-item-icon" style={{ color: config.color }}>
        <Icon size={20} />
      </div>
      <div className="alert-item-content">
        <div className="alert-item-header">
          <span className="alert-item-title">{alert.title}</span>
          <span className="alert-item-time">{timeAgo(alert.createdAt)}</span>
        </div>
        <p className="alert-item-message">{alert.message}</p>
        <div className="alert-item-meta">
          <span className="alert-type-label" style={{ color: config.color }}>{config.label}</span>
          <span className="alert-severity-label" style={{ color: sevConfig.text }}>{alert.severity}</span>
        </div>
      </div>
      {!alert.read && (
        <button
          className="btn btn-ghost btn-sm alert-mark-read"
          onClick={() => onMarkRead(alert._id)}
          title="Mark as read"
        >
          <CheckCircle size={16} />
        </button>
      )}
    </div>
  );
}

function Reports() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [viewingReportId, setViewingReportId] = useState(null);
  const [project, setProject] = useState(null);

  const fetchReports = async () => {
    try {
      const res = await api.get(`/reports/${id}`);
      setReports(res.data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await api.get(`/reports/alerts/${id}`);
      setAlerts(res.data.alerts || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      setProject(res.data.project || res.data);
    } catch (err) {
      console.error('Failed to fetch project:', err);
    }
  };

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([fetchProject(), fetchReports(), fetchAlerts()]);
      setLoading(false);
    }
    loadAll();
  }, [id]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      await api.post(`/reports/generate/${id}`, { type: 'custom' });
      await fetchReports();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to generate report';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkRead = async (alertId) => {
    try {
      await api.put(`/reports/alerts/read/${alertId}`);
      setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, read: true } : a));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put(`/reports/alerts/read-all/${id}`);
      setAlerts(prev => prev.map(a => ({ ...a, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all alerts as read:', err);
    }
  };

  if (loading) return <LoadingSpinner message="Loading reports..." />;

  if (viewingReportId) {
    return (
      <div className="page-container">
        <button className="btn btn-ghost back-btn" onClick={() => setViewingReportId(null)}>
          <ArrowLeft size={18} />
          Back to Reports
        </button>
        <ReportDetail reportId={viewingReportId} onClose={() => setViewingReportId(null)} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(`/project/${id}`)}>
        <ArrowLeft size={18} />
        Back to Project
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Alerts</h1>
          <p className="page-subtitle">{project?.name || project?.domain || ''}</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Reports
        </button>
        <button
          className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          <Bell size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Alerts
          {unreadCount > 0 && (
            <span className="alert-badge-tab">{unreadCount}</span>
          )}
        </button>
      </div>

      {activeTab === 'reports' && (
        <div className="reports-tab-content">
          <div className="reports-toolbar">
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={generating}
            >
              <RefreshCw size={16} className={generating ? 'spin' : ''} />
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>

          {reports.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <h3>No Reports Yet</h3>
              <p>Generate your first SEO report to see an overview of your site's performance.</p>
            </div>
          ) : (
            <div className="reports-grid">
              {reports.map(report => (
                <ReportCard
                  key={report._id}
                  report={report}
                  onView={setViewingReportId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="alerts-tab-content">
          {alerts.length > 0 && unreadCount > 0 && (
            <div className="alerts-toolbar">
              <button className="btn btn-sm btn-secondary" onClick={handleMarkAllRead}>
                <BellOff size={14} />
                Mark All Read ({unreadCount})
              </button>
            </div>
          )}

          {alerts.length === 0 ? (
            <div className="empty-state">
              <Bell size={48} />
              <h3>No Alerts</h3>
              <p>Alerts will appear here when score changes, new issues, or crawl completions are detected.</p>
            </div>
          ) : (
            <div className="alerts-list">
              {alerts.map(alert => (
                <AlertItem
                  key={alert._id}
                  alert={alert}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Reports;
