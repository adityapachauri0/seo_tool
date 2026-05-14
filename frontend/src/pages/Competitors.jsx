import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, RefreshCw, Eye, Cpu, X,
  Globe, Shield, Code2, BarChart3, Search, Layers,
} from 'lucide-react';
import api from '../api/client';
import ScoreCircle from '../components/ScoreCircle';
import LoadingSpinner from '../components/LoadingSpinner';
import { timeAgo } from '../utils/timeAgo';

const TECH_BADGE_COLORS = {
  cms: { bg: '#dbeafe', color: '#1e40af' },
  framework: { bg: '#ede9fe', color: '#6d28d9' },
  css: { bg: '#d1fae5', color: '#065f46' },
  analytics: { bg: '#fef3c7', color: '#92400e' },
  tagManager: { bg: '#ffedd5', color: '#9a3412' },
  heatmap: { bg: '#fce7f3', color: '#9d174d' },
  cdn: { bg: '#e0e7ff', color: '#3730a3' },
  schema: { bg: '#dcfce7', color: '#15803d' },
  jquery: { bg: '#fef9c3', color: '#854d0e' },
};

function TechBadge({ category, value }) {
  const colors = TECH_BADGE_COLORS[category] || { bg: '#f1f5f9', color: '#475569' };
  const label = value === true ? category : value;
  return (
    <span className="tech-badge" style={{ background: colors.bg, color: colors.color }}>
      {label}
    </span>
  );
}

function AddCompetitorModal({ onClose, onAdd }) {
  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!domain.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      await onAdd(domain.trim(), name.trim());
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add competitor');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Competitor</h3>
          <button className="btn btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit} className="project-form">
          <div className="form-group">
            <label>Domain</label>
            <div className="input-with-prefix">
              <span className="input-prefix">https://</span>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                required
                autoFocus
              />
            </div>
          </div>
          <div className="form-group">
            <label>Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Competitor name"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !domain.trim()}>
              <Plus size={16} />
              {submitting ? 'Adding...' : 'Add Competitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PagesModal({ competitor, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-wide card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Crawled Pages — {competitor.name || competitor.domain}</h3>
          <button className="btn btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {(!competitor.pages || competitor.pages.length === 0) ? (
          <p className="text-muted" style={{ padding: '24px 0', textAlign: 'center' }}>
            No pages crawled yet. Run an audit first.
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Title</th>
                  <th>Score</th>
                  <th>Crawled</th>
                </tr>
              </thead>
              <tbody>
                {competitor.pages.map((page, idx) => (
                  <tr key={idx}>
                    <td className="url-cell">
                      <Globe size={14} />
                      <a href={page.url} target="_blank" rel="noopener noreferrer">
                        {page.url}
                      </a>
                    </td>
                    <td>{page.title || '-'}</td>
                    <td>
                      {page.score != null ? (
                        <span className={`score-badge score-${page.score >= 80 ? 'green' : page.score >= 50 ? 'yellow' : 'red'}`}>
                          {page.score}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="text-muted">
                      {page.crawledAt ? timeAgo(page.crawledAt) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonTable({ yourSite, competitors }) {
  if (competitors.length === 0) return null;

  const allSites = [
    { ...yourSite, isOwner: true },
    ...competitors,
  ];

  const rows = [
    {
      label: 'SEO Score',
      render: (site) => (
        <ScoreCircle score={site.score || 0} size={48} />
      ),
    },
    {
      label: 'Pages Crawled',
      render: (site) => site.pagesCount ?? '-',
    },
    {
      label: 'Framework',
      render: (site) => site.techStack?.framework || site.techStack?.cms || '-',
    },
    {
      label: 'CSS',
      render: (site) => site.techStack?.css || '-',
    },
    {
      label: 'Schema Markup',
      render: (site) => {
        const has = site.techStack?.schema;
        return has ? (
          <span className="score-badge score-green">Yes</span>
        ) : (
          <span className="score-badge score-red">No</span>
        );
      },
    },
    {
      label: 'CDN',
      render: (site) => site.techStack?.cdn || '-',
    },
    {
      label: 'Analytics',
      render: (site) => site.techStack?.analytics || '-',
    },
    {
      label: 'Tag Manager',
      render: (site) => site.techStack?.tagManager || '-',
    },
  ];

  return (
    <div className="card competitor-comparison" style={{ marginTop: 24 }}>
      <h3 className="section-title">
        <BarChart3 size={18} />
        Side-by-Side Comparison
      </h3>
      <div className="table-wrapper">
        <table className="data-table comparison-table">
          <thead>
            <tr>
              <th>Metric</th>
              {allSites.map((site, idx) => (
                <th key={idx} className={site.isOwner ? 'comparison-owner-col' : ''}>
                  {site.isOwner ? (
                    <span className="comparison-owner-label">Your Site</span>
                  ) : null}
                  {site.name || site.domain}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td className="comparison-label">{row.label}</td>
                {allSites.map((site, sIdx) => (
                  <td key={sIdx} className={site.isOwner ? 'comparison-owner-col' : ''}>
                    {row.render(site)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Competitors() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPagesModal, setShowPagesModal] = useState(null);
  const [auditingId, setAuditingId] = useState(null);
  const [detectingId, setDetectingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [projRes, compRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/competitors/${projectId}`),
      ]);
      setProject(projRes.data.project || projRes.data);
      setCompetitors(compRes.data.competitors || []);

      // Fetch comparison if there are competitors
      if ((compRes.data.competitors || []).length > 0) {
        try {
          const compareRes = await api.get(`/competitors/compare/${projectId}`);
          setComparison(compareRes.data);
        } catch {
          // comparison is optional — don't block on failure
        }
      } else {
        setComparison(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCompetitor = async (domain, name) => {
    await api.post(`/competitors/${projectId}`, { domain, name });
    await fetchData();
  };

  const handleRemove = async (competitorId) => {
    if (!window.confirm('Remove this competitor?')) return;
    try {
      setRemovingId(competitorId);
      await api.delete(`/competitors/remove/${competitorId}`);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove competitor');
    } finally {
      setRemovingId(null);
    }
  };

  const handleAudit = async (competitorId) => {
    try {
      setAuditingId(competitorId);
      setError(null);
      await api.post(`/competitors/audit/${competitorId}`);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Audit failed');
    } finally {
      setAuditingId(null);
    }
  };

  const handleDetectTech = async (competitorId) => {
    try {
      setDetectingId(competitorId);
      setError(null);
      await api.post(`/competitors/detect-tech/${competitorId}`);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Tech detection failed');
    } finally {
      setDetectingId(null);
    }
  };

  if (loading) return <LoadingSpinner message="Loading competitors..." />;

  return (
    <div className="page-container">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(`/project/${projectId}`)}>
        <ArrowLeft size={18} />
        Back to Project
      </button>

      {error && <div className="error-banner">{error}</div>}

      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Search size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Competitor Intelligence
          </h1>
          <p className="page-subtitle">
            {project?.name} — {project?.domain}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Add Competitor
        </button>
      </div>

      {competitors.length === 0 ? (
        <div className="empty-state">
          <Layers size={48} />
          <h3>No competitors tracked yet</h3>
          <p>Add competitor domains to compare their SEO performance, tech stack, and more.</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            Add Your First Competitor
          </button>
        </div>
      ) : (
        <>
          <div className="competitors-grid">
            {competitors.map((comp) => {
              const techEntries = Object.entries(comp.techStack || {});
              const isAuditing = auditingId === comp._id;
              const isDetecting = detectingId === comp._id;
              const isRemoving = removingId === comp._id;

              return (
                <div key={comp._id} className="competitor-card card">
                  <div className="competitor-card-header">
                    <div className="competitor-card-info">
                      <h3 className="competitor-card-name">
                        <Globe size={16} className="card-icon" />
                        {comp.name || comp.domain}
                      </h3>
                      <p className="competitor-card-domain">{comp.domain}</p>
                    </div>
                    <div className="competitor-card-score">
                      {comp.lastAuditScore != null ? (
                        <ScoreCircle score={comp.lastAuditScore} size={64} />
                      ) : (
                        <div className="score-placeholder">N/A</div>
                      )}
                    </div>
                  </div>

                  {comp.lastAuditAt && (
                    <p className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      Last audited {timeAgo(comp.lastAuditAt)}
                    </p>
                  )}

                  {techEntries.length > 0 && (
                    <div className="tech-badges">
                      {techEntries.map(([key, value]) => (
                        <TechBadge key={key} category={key} value={value} />
                      ))}
                    </div>
                  )}

                  <div className="competitor-card-actions">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleAudit(comp._id)}
                      disabled={isAuditing}
                    >
                      <RefreshCw size={14} className={isAuditing ? 'spin' : ''} />
                      {isAuditing ? 'Auditing...' : 'Audit'}
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleDetectTech(comp._id)}
                      disabled={isDetecting}
                    >
                      <Cpu size={14} className={isDetecting ? 'spin' : ''} />
                      {isDetecting ? 'Detecting...' : 'Detect Tech'}
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setShowPagesModal(comp)}
                    >
                      <Eye size={14} />
                      Pages
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleRemove(comp._id)}
                      disabled={isRemoving}
                      style={{ color: '#dc2626' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {comparison && comparison.competitors.length > 0 && (
            <ComparisonTable
              yourSite={comparison.yourSite}
              competitors={comparison.competitors}
            />
          )}
        </>
      )}

      {showAddModal && (
        <AddCompetitorModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddCompetitor}
        />
      )}

      {showPagesModal && (
        <PagesModal
          competitor={showPagesModal}
          onClose={() => setShowPagesModal(null)}
        />
      )}
    </div>
  );
}

export default Competitors;
