import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, Activity, CheckCircle, Image,
  Link as LinkIcon, Code, FileText, Globe
} from 'lucide-react';
import api from '../api/client';
import ScoreCircle from '../components/ScoreCircle';
import IssuesList from '../components/IssuesList';
import LoadingSpinner from '../components/LoadingSpinner';

function AuditDetail() {
  const { auditId } = useParams();
  const navigate = useNavigate();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeLinksTab, setActiveLinksTab] = useState('internal');

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const res = await api.get(`/audits/page/${auditId}`);
        setAudit(res.data.audit || res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load audit');
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, [auditId]);

  if (loading) return <LoadingSpinner message="Loading audit details..." />;
  if (error) {
    return (
      <div className="page-container">
        <div className="error-banner">{error}</div>
      </div>
    );
  }
  if (!audit) return null;

  const score = audit.seoScore ?? audit.score ?? 0;
  const meta = audit.meta || {};
  const headings = audit.headings || [];
  const links = audit.links || {};
  const internalLinks = links.internal || [];
  const externalLinks = links.external || [];
  const brokenLinks = links.broken || [];
  const images = audit.images || [];
  const schema = audit.schema || audit.structuredData || null;
  const content = audit.content || {};
  const performance = audit.performance || {};
  const issues = audit.issues || [];

  const linksTabs = [
    { key: 'internal', label: `Internal (${internalLinks.length})` },
    { key: 'external', label: `External (${externalLinks.length})` },
    { key: 'broken', label: `Broken (${brokenLinks.length})` },
  ];

  const activeLinks =
    activeLinksTab === 'internal' ? internalLinks :
    activeLinksTab === 'external' ? externalLinks :
    brokenLinks;

  return (
    <div className="page-container">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} />
        Back
      </button>

      <div className="audit-header">
        <div className="audit-header-left">
          <h1 className="page-title">{audit.url || audit.path || 'Page Audit'}</h1>
          <p className="page-subtitle">
            Crawled {audit.crawledAt ? new Date(audit.crawledAt).toLocaleString() : 'N/A'}
          </p>
        </div>
        <ScoreCircle score={score} size={110} />
      </div>

      {/* Issues */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 className="section-title">
          <AlertTriangle size={18} />
          Issues ({issues.length})
        </h3>
        <IssuesList issues={issues} />
      </div>

      {/* Meta Section */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 className="section-title">
          <FileText size={18} />
          Meta Information
        </h3>
        <div className="meta-grid">
          <div className="meta-item-block">
            <label>Title {meta.title ? `(${meta.title.length} chars)` : ''}</label>
            <p>{meta.title || 'Not set'}</p>
          </div>
          <div className="meta-item-block">
            <label>Description {meta.description ? `(${meta.description.length} chars)` : ''}</label>
            <p>{meta.description || 'Not set'}</p>
          </div>
          <div className="meta-item-block">
            <label>Canonical</label>
            <p>{meta.canonical || 'Not set'}</p>
          </div>
          {meta.ogTitle && (
            <div className="meta-item-block">
              <label>OG Title</label>
              <p>{meta.ogTitle}</p>
            </div>
          )}
          {meta.ogDescription && (
            <div className="meta-item-block">
              <label>OG Description</label>
              <p>{meta.ogDescription}</p>
            </div>
          )}
          {meta.ogImage && (
            <div className="meta-item-block">
              <label>OG Image</label>
              <p>{meta.ogImage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Headings Tree */}
      {headings.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="section-title">
            <FileText size={18} />
            Headings Structure
          </h3>
          <ul className="headings-tree">
            {headings.map((h, i) => {
              const level = h.level || parseInt(h.tag?.replace('h', ''), 10) || 1;
              return (
                <li key={i} className={`heading-item heading-level-${level}`}>
                  <span className="heading-tag">H{level}</span>
                  <span className="heading-text">{h.text || h.content}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Links */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 className="section-title">
          <LinkIcon size={18} />
          Links
        </h3>
        <div className="tabs">
          {linksTabs.map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${activeLinksTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveLinksTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeLinks.length === 0 ? (
          <p className="text-muted" style={{ padding: '16px 0' }}>No {activeLinksTab} links found.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Text</th>
                  {activeLinksTab === 'broken' && <th>Status</th>}
                </tr>
              </thead>
              <tbody>
                {activeLinks.slice(0, 50).map((link, i) => (
                  <tr key={i}>
                    <td className="url-cell">
                      {typeof link === 'string' ? link : link.url || link.href}
                    </td>
                    <td className="text-muted">
                      {typeof link === 'string' ? '' : link.text || link.anchor || ''}
                    </td>
                    {activeLinksTab === 'broken' && (
                      <td>
                        <span className="score-badge score-red">
                          {typeof link === 'string' ? '404' : link.statusCode || link.status || '404'}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {activeLinks.length > 50 && (
              <p className="text-muted" style={{ padding: '8px 0', textAlign: 'center' }}>
                Showing 50 of {activeLinks.length} links
              </p>
            )}
          </div>
        )}
      </div>

      {/* Images */}
      {images.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="section-title">
            <Image size={18} />
            Images ({images.length})
          </h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Alt Text</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {images.slice(0, 50).map((img, i) => {
                  const src = typeof img === 'string' ? img : img.src || img.url;
                  const alt = typeof img === 'string' ? '' : img.alt || '';
                  const hasAlt = Boolean(alt);
                  return (
                    <tr key={i}>
                      <td className="url-cell">{src}</td>
                      <td className="text-muted">{alt || 'Missing'}</td>
                      <td>
                        {hasAlt ? (
                          <span className="score-badge score-green">
                            <CheckCircle size={12} /> OK
                          </span>
                        ) : (
                          <span className="score-badge score-red">
                            <AlertTriangle size={12} /> Missing
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schema / Structured Data */}
      {schema && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="section-title">
            <Code size={18} />
            Structured Data (JSON-LD)
          </h3>
          <pre className="code-block">
            {typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2)}
          </pre>
        </div>
      )}

      {/* Content Stats */}
      {(content.wordCount || content.readability) && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="section-title">
            <FileText size={18} />
            Content Stats
          </h3>
          <div className="stats-grid">
            {content.wordCount != null && (
              <div className="stat-item">
                <span className="stat-value">{content.wordCount.toLocaleString()}</span>
                <span className="stat-label">Words</span>
              </div>
            )}
            {content.readability != null && (
              <div className="stat-item">
                <span className="stat-value">{content.readability}</span>
                <span className="stat-label">Readability Score</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance */}
      {(performance.pageSize || performance.loadTime || performance.resourceCount) && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="section-title">
            <Activity size={18} />
            Performance
          </h3>
          <div className="stats-grid">
            {performance.pageSize != null && (
              <div className="stat-item">
                <span className="stat-value">
                  {performance.pageSize > 1024
                    ? `${(performance.pageSize / 1024).toFixed(1)} MB`
                    : `${performance.pageSize} KB`}
                </span>
                <span className="stat-label">Page Size</span>
              </div>
            )}
            {performance.loadTime != null && (
              <div className="stat-item">
                <span className="stat-value">{performance.loadTime}s</span>
                <span className="stat-label">Load Time</span>
              </div>
            )}
            {performance.resourceCount != null && (
              <div className="stat-item">
                <span className="stat-value">{performance.resourceCount}</span>
                <span className="stat-label">Resources</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditDetail;
