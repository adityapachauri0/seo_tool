import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, CheckCircle, Link2, Code2,
  Map, Shuffle, FileX, Copy, Download, ExternalLink,
  ChevronDown, ChevronUp, RefreshCw, Eye, Shield,
} from 'lucide-react';
import api from '../api/client';
import ScoreCircle from '../components/ScoreCircle';
import LoadingSpinner from '../components/LoadingSpinner';

/* ------------------------------------------------------------------ */
/*  Tab constants                                                      */
/* ------------------------------------------------------------------ */
const TABS = [
  { key: 'overview', label: 'Overview', icon: Shield },
  { key: 'broken-links', label: 'Broken Links', icon: Link2 },
  { key: 'schema', label: 'Schema', icon: Code2 },
  { key: 'redirects', label: 'Redirects', icon: Shuffle },
  { key: 'duplicates', label: 'Duplicates', icon: Copy },
  { key: 'orphans', label: 'Orphan Pages', icon: FileX },
  { key: 'sitemap', label: 'Sitemap', icon: Map },
];

/* ------------------------------------------------------------------ */
/*  Status badge helper                                                */
/* ------------------------------------------------------------------ */
function StatusBadge({ status }) {
  if (status >= 200 && status < 300) {
    return <span className="ts-status-badge ts-status-ok">{status}</span>;
  }
  if (status >= 300 && status < 400) {
    return <span className="ts-status-badge ts-status-redirect">{status}</span>;
  }
  if (status >= 400 && status < 500) {
    return <span className="ts-status-badge ts-status-client-err">{status}</span>;
  }
  if (status >= 500) {
    return <span className="ts-status-badge ts-status-server-err">{status}</span>;
  }
  return <span className="ts-status-badge ts-status-err">ERR</span>;
}

/* ------------------------------------------------------------------ */
/*  Issue count card                                                   */
/* ------------------------------------------------------------------ */
function IssueCard({ label, count, severity }) {
  const cls =
    severity === 'danger'
      ? 'ts-issue-card ts-issue-danger'
      : severity === 'warning'
        ? 'ts-issue-card ts-issue-warning'
        : 'ts-issue-card ts-issue-info';
  return (
    <div className={cls}>
      <span className="ts-issue-count">{count}</span>
      <span className="ts-issue-label">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview Tab                                                       */
/* ------------------------------------------------------------------ */
function OverviewTab({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/technical/overview/${projectId}`)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <LoadingSpinner message="Analyzing technical SEO..." />;
  if (!data) return <p className="text-muted">No data available. Run an audit first.</p>;

  const { techScore, totalPages, issues, summary } = data;

  return (
    <div className="ts-overview">
      <div className="ts-overview-top">
        <div className="ts-score-block card">
          <h3 className="section-title">Technical Health Score</h3>
          <div className="ts-score-center">
            <ScoreCircle score={techScore} size={120} />
          </div>
          <p className="text-muted" style={{ textAlign: 'center', marginTop: 12, fontSize: 13 }}>
            Based on {totalPages} crawled pages
          </p>
        </div>

        <div className="ts-summary-block card">
          <h3 className="section-title">Summary</h3>
          <div className="ts-summary-grid">
            <div className="ts-summary-item">
              <span className="ts-summary-value">{summary.schemaAdoption}</span>
              <span className="ts-summary-label">Schema Adoption</span>
            </div>
            <div className="ts-summary-item">
              <span className="ts-summary-value">{summary.orphanPages}</span>
              <span className="ts-summary-label">Orphan Pages</span>
            </div>
            <div className="ts-summary-item">
              <span className="ts-summary-value">{summary.duplicateTitles}</span>
              <span className="ts-summary-label">Duplicate Titles</span>
            </div>
            <div className="ts-summary-item">
              <span className="ts-summary-value">{summary.duplicateDescriptions}</span>
              <span className="ts-summary-label">Duplicate Descriptions</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 className="section-title">Issue Breakdown</h3>
        <div className="ts-issues-grid">
          <IssueCard label="Orphan Pages" count={issues.orphanPages} severity={issues.orphanPages > 0 ? 'warning' : 'info'} />
          <IssueCard label="Duplicate Titles" count={issues.duplicateTitles} severity={issues.duplicateTitles > 0 ? 'warning' : 'info'} />
          <IssueCard label="Duplicate Descriptions" count={issues.duplicateDescriptions} severity={issues.duplicateDescriptions > 0 ? 'warning' : 'info'} />
          <IssueCard label="Missing Schema" count={issues.missingSchema} severity={issues.missingSchema > 0 ? 'danger' : 'info'} />
          <IssueCard label="Missing Meta" count={issues.missingMeta} severity={issues.missingMeta > 0 ? 'danger' : 'info'} />
          <IssueCard label="Missing H1" count={issues.missingH1} severity={issues.missingH1 > 0 ? 'danger' : 'info'} />
          <IssueCard label="Missing Canonical" count={issues.missingCanonical} severity={issues.missingCanonical > 0 ? 'warning' : 'info'} />
          <IssueCard label="Missing OG Tags" count={issues.missingOg} severity={issues.missingOg > 0 ? 'warning' : 'info'} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Broken Links Tab                                                   */
/* ------------------------------------------------------------------ */
function BrokenLinksTab({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/technical/broken-links/${projectId}`);
      setData(res.data);
      setChecked(true);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="ts-action-bar">
        <div>
          <h3 className="section-title" style={{ marginBottom: 4 }}>Broken Link Checker</h3>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Checks up to 200 unique links found across your crawled pages.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleCheck} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          {loading ? 'Checking...' : 'Check Links'}
        </button>
      </div>

      {loading && <LoadingSpinner message="Checking links... This may take a minute." />}

      {checked && data && !loading && (
        <>
          <div className="ts-link-stats">
            <div className="ts-link-stat">
              <span className="ts-link-stat-value">{data.totalChecked}</span>
              <span className="ts-link-stat-label">Checked</span>
            </div>
            <div className="ts-link-stat ts-link-stat-ok">
              <CheckCircle size={18} />
              <span className="ts-link-stat-value">{data.ok}</span>
              <span className="ts-link-stat-label">OK</span>
            </div>
            <div className="ts-link-stat ts-link-stat-broken">
              <AlertTriangle size={18} />
              <span className="ts-link-stat-value">{data.broken}</span>
              <span className="ts-link-stat-label">Broken</span>
            </div>
          </div>

          {data.brokenLinks.length > 0 ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>URL</th>
                      <th>Status</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.brokenLinks.map((link, i) => (
                      <tr key={i}>
                        <td className="url-cell">
                          <Link2 size={14} />
                          <a href={link.url} target="_blank" rel="noopener noreferrer">
                            {link.url}
                          </a>
                        </td>
                        <td>
                          <StatusBadge status={link.status} />
                        </td>
                        <td className="text-muted" style={{ fontSize: 13 }}>
                          {link.error || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="ts-success-msg">
              <CheckCircle size={20} />
              No broken links found.
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Schema Tab                                                         */
/* ------------------------------------------------------------------ */
function SchemaTab({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedPage, setExpandedPage] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/technical/schema/${projectId}`)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleCopy = (schema, pageIdx, schemaIdx) => {
    const text = JSON.stringify(schema, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(`${pageIdx}-${schemaIdx}`);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  if (loading) return <LoadingSpinner message="Analyzing schema markup..." />;
  if (!data) return <p className="text-muted">No data available.</p>;

  return (
    <div>
      <div className="ts-link-stats" style={{ marginBottom: 20 }}>
        <div className="ts-link-stat">
          <span className="ts-link-stat-value">{data.totalPages}</span>
          <span className="ts-link-stat-label">Pages Analyzed</span>
        </div>
        <div className="ts-link-stat ts-link-stat-ok">
          <CheckCircle size={18} />
          <span className="ts-link-stat-value">{data.withSchema}</span>
          <span className="ts-link-stat-label">With Schema</span>
        </div>
        <div className="ts-link-stat ts-link-stat-broken">
          <AlertTriangle size={18} />
          <span className="ts-link-stat-value">{data.withoutSchema}</span>
          <span className="ts-link-stat-label">Missing Schema</span>
        </div>
      </div>

      <div className="ts-schema-list">
        {data.pages.map((page, pageIdx) => {
          const isExpanded = expandedPage === pageIdx;
          return (
            <div key={pageIdx} className="card ts-schema-card">
              <div
                className="ts-schema-header"
                onClick={() => setExpandedPage(isExpanded ? null : pageIdx)}
              >
                <div className="ts-schema-header-left">
                  {page.hasSchema ? (
                    <CheckCircle size={16} className="ts-icon-ok" />
                  ) : (
                    <AlertTriangle size={16} className="ts-icon-warn" />
                  )}
                  <div>
                    <div className="ts-schema-url">{page.url}</div>
                    <div className="ts-schema-title">{page.title || 'No title'}</div>
                  </div>
                </div>
                <div className="ts-schema-header-right">
                  <span className="ts-schema-count">
                    {page.suggestions.length} suggestion{page.suggestions.length !== 1 ? 's' : ''}
                  </span>
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {isExpanded && (
                <div className="ts-schema-body">
                  {page.suggestions.map((suggestion, sIdx) => (
                    <div key={sIdx} className="ts-schema-suggestion">
                      <div className="ts-schema-suggestion-header">
                        <span className="ts-schema-type-badge">{suggestion.type}</span>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleCopy(suggestion.schema, pageIdx, sIdx)}
                        >
                          <Copy size={14} />
                          {copiedIdx === `${pageIdx}-${sIdx}` ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre className="code-block">
                        {JSON.stringify(suggestion.schema, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Redirects Tab                                                      */
/* ------------------------------------------------------------------ */
function RedirectsTab({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/technical/redirects/${projectId}`);
      setData(res.data);
      setChecked(true);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="ts-action-bar">
        <div>
          <h3 className="section-title" style={{ marginBottom: 4 }}>Redirect Chain Detector</h3>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Detects redirect chains (3+ hops) that slow down crawling and dilute link equity.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleCheck} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          {loading ? 'Checking...' : 'Check Redirects'}
        </button>
      </div>

      {loading && <LoadingSpinner message="Checking redirects..." />}

      {checked && data && !loading && (
        <>
          <div className="ts-link-stats">
            <div className="ts-link-stat">
              <span className="ts-link-stat-value">{data.totalChecked}</span>
              <span className="ts-link-stat-label">URLs Checked</span>
            </div>
            <div className="ts-link-stat ts-link-stat-broken">
              <AlertTriangle size={18} />
              <span className="ts-link-stat-value">{data.chains}</span>
              <span className="ts-link-stat-label">Chains (3+ hops)</span>
            </div>
            <div className="ts-link-stat">
              <Shuffle size={18} />
              <span className="ts-link-stat-value">{data.redirects}</span>
              <span className="ts-link-stat-label">Single Redirects</span>
            </div>
          </div>

          {data.issues.length > 0 ? (
            <div className="ts-redirect-list">
              {data.issues.map((item, i) => (
                <div key={i} className="card ts-redirect-card">
                  <div className="ts-redirect-header">
                    <span className={`ts-redirect-badge ${item.issue === 'redirect_chain' ? 'ts-redirect-badge-chain' : item.issue === 'error' ? 'ts-redirect-badge-error' : 'ts-redirect-badge-single'}`}>
                      {item.issue === 'redirect_chain' ? 'Chain' : item.issue === 'error' ? 'Error' : 'Redirect'}
                    </span>
                    <span className="ts-redirect-url">{item.originalUrl}</span>
                    {item.hops && <span className="text-muted" style={{ fontSize: 12 }}>{item.hops} hop{item.hops !== 1 ? 's' : ''}</span>}
                  </div>
                  {item.chain && (
                    <div className="ts-redirect-chain">
                      {item.chain.map((hop, j) => (
                        <div key={j} className="ts-redirect-hop">
                          <StatusBadge status={hop.status} />
                          <span className="ts-redirect-hop-url">{hop.url}</span>
                          {j < item.chain.length - 1 && (
                            <span className="ts-redirect-arrow">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {item.error && (
                    <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>
                      Error: {item.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="ts-success-msg">
              <CheckCircle size={20} />
              No redirect chains detected.
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Duplicates Tab                                                     */
/* ------------------------------------------------------------------ */
function DuplicatesTab({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedTitle, setExpandedTitle] = useState(null);
  const [expandedDesc, setExpandedDesc] = useState(null);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/technical/duplicates/${projectId}`)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <LoadingSpinner message="Scanning for duplicates..." />;
  if (!data) return <p className="text-muted">No data available.</p>;

  return (
    <div>
      <div className="ts-link-stats" style={{ marginBottom: 20 }}>
        <div className="ts-link-stat ts-link-stat-broken">
          <Copy size={18} />
          <span className="ts-link-stat-value">{data.totalDupTitles}</span>
          <span className="ts-link-stat-label">Duplicate Title Groups</span>
        </div>
        <div className="ts-link-stat ts-link-stat-broken">
          <Copy size={18} />
          <span className="ts-link-stat-value">{data.totalDupDescriptions}</span>
          <span className="ts-link-stat-label">Duplicate Desc Groups</span>
        </div>
      </div>

      {/* Duplicate Titles */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Duplicate Title Tags</h3>
        {data.duplicateTitles.length === 0 ? (
          <div className="ts-success-msg">
            <CheckCircle size={20} />
            No duplicate titles found.
          </div>
        ) : (
          <div className="ts-dup-list">
            {data.duplicateTitles.map((group, i) => {
              const isExpanded = expandedTitle === i;
              return (
                <div key={i} className="ts-dup-group">
                  <div
                    className="ts-dup-group-header"
                    onClick={() => setExpandedTitle(isExpanded ? null : i)}
                  >
                    <div className="ts-dup-group-info">
                      <span className="ts-dup-count-badge">{group.count} pages</span>
                      <span className="ts-dup-title">{group.title}</span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  {isExpanded && (
                    <div className="ts-dup-urls">
                      {group.urls.map((url, j) => (
                        <div key={j} className="ts-dup-url">
                          <ExternalLink size={12} />
                          <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Duplicate Descriptions */}
      <div className="card">
        <h3 className="section-title">Duplicate Meta Descriptions</h3>
        {data.duplicateDescriptions.length === 0 ? (
          <div className="ts-success-msg">
            <CheckCircle size={20} />
            No duplicate descriptions found.
          </div>
        ) : (
          <div className="ts-dup-list">
            {data.duplicateDescriptions.map((group, i) => {
              const isExpanded = expandedDesc === i;
              return (
                <div key={i} className="ts-dup-group">
                  <div
                    className="ts-dup-group-header"
                    onClick={() => setExpandedDesc(isExpanded ? null : i)}
                  >
                    <div className="ts-dup-group-info">
                      <span className="ts-dup-count-badge">{group.count} pages</span>
                      <span className="ts-dup-title">{group.description}</span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  {isExpanded && (
                    <div className="ts-dup-urls">
                      {group.urls.map((url, j) => (
                        <div key={j} className="ts-dup-url">
                          <ExternalLink size={12} />
                          <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Orphan Pages Tab                                                   */
/* ------------------------------------------------------------------ */
function OrphansTab({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/technical/orphans/${projectId}`)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <LoadingSpinner message="Finding orphan pages..." />;
  if (!data) return <p className="text-muted">No data available.</p>;

  return (
    <div>
      <div className="ts-link-stats" style={{ marginBottom: 20 }}>
        <div className="ts-link-stat">
          <span className="ts-link-stat-value">{data.totalPages}</span>
          <span className="ts-link-stat-label">Total Pages</span>
        </div>
        <div className={`ts-link-stat ${data.orphanPages > 0 ? 'ts-link-stat-broken' : 'ts-link-stat-ok'}`}>
          <FileX size={18} />
          <span className="ts-link-stat-value">{data.orphanPages}</span>
          <span className="ts-link-stat-label">Orphan Pages</span>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">
          <FileX size={18} /> Orphan Pages
        </h3>
        <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Pages with no internal links pointing to them. These pages may be difficult for search engines to discover.
        </p>

        {data.orphans.length === 0 ? (
          <div className="ts-success-msg">
            <CheckCircle size={20} />
            No orphan pages detected. All pages have at least one internal link.
          </div>
        ) : (
          <div className="ts-orphan-list">
            {data.orphans.map((url, i) => (
              <div key={i} className="ts-orphan-item">
                <FileX size={14} className="ts-icon-warn" />
                <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sitemap Tab                                                        */
/* ------------------------------------------------------------------ */
function SitemapTab({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/technical/sitemap/${projectId}`, { params: { format: 'json' } })
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleDownload = () => {
    if (!data?.sitemap) return;
    const blob = new Blob([data.sitemap], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sitemap.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!data?.sitemap) return;
    navigator.clipboard.writeText(data.sitemap);
  };

  if (loading) return <LoadingSpinner message="Generating sitemap..." />;
  if (!data) return <p className="text-muted">No data available. Run an audit first.</p>;

  return (
    <div>
      <div className="ts-action-bar">
        <div>
          <h3 className="section-title" style={{ marginBottom: 4 }}>Generated XML Sitemap</h3>
          <p className="text-muted" style={{ fontSize: 13 }}>
            {data.pages} URL{data.pages !== 1 ? 's' : ''} included based on crawled pages.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleCopy}>
            <Copy size={16} />
            Copy XML
          </button>
          <button className="btn btn-primary" onClick={handleDownload}>
            <Download size={16} />
            Download XML
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <pre className="code-block ts-sitemap-preview">{data.sitemap}</pre>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Technical SEO Page                                            */
/* ------------------------------------------------------------------ */
function TechnicalSeo() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    api
      .get(`/projects/${projectId}`)
      .then(res => {
        const p = res.data.project || res.data;
        setProjectName(p.name || p.domain || '');
      })
      .catch(() => {});
  }, [projectId]);

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab projectId={projectId} />;
      case 'broken-links':
        return <BrokenLinksTab projectId={projectId} />;
      case 'schema':
        return <SchemaTab projectId={projectId} />;
      case 'redirects':
        return <RedirectsTab projectId={projectId} />;
      case 'duplicates':
        return <DuplicatesTab projectId={projectId} />;
      case 'orphans':
        return <OrphansTab projectId={projectId} />;
      case 'sitemap':
        return <SitemapTab projectId={projectId} />;
      default:
        return null;
    }
  };

  return (
    <div className="page-container">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(`/project/${projectId}`)}>
        <ArrowLeft size={18} /> Back to Project
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">Technical SEO {projectName && `- ${projectName}`}</h1>
          <p className="page-subtitle">
            Audit technical health, broken links, schema markup, redirects, and more
          </p>
        </div>
      </div>

      <div className="tabs ts-tabs">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={14} style={{ marginRight: 4 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="ts-tab-content">{renderTab()}</div>
    </div>
  );
}

export default TechnicalSeo;
