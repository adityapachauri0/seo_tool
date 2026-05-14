import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Tag, BarChart3, TrendingDown,
  Plus, X, RefreshCw, Trash2, ExternalLink, Sparkles,
} from 'lucide-react';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

/* ------------------------------------------------------------------ */
/*  Score bar component                                                */
/* ------------------------------------------------------------------ */
function ScoreBar({ value = 0, label, maxWidth = 120 }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#eab308' : '#dc2626';
  return (
    <div className="ce-score-bar-wrap">
      {label && <span className="ce-score-bar-label">{label}</span>}
      <div className="ce-score-bar-track" style={{ width: maxWidth }}>
        <div className="ce-score-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="ce-score-bar-value" style={{ color }}>{pct}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Intent badge                                                       */
/* ------------------------------------------------------------------ */
const INTENT_COLORS = {
  informational: { bg: '#dbeafe', color: '#1d4ed8' },
  commercial:    { bg: '#f3e8ff', color: '#7c3aed' },
  transactional: { bg: '#dcfce7', color: '#15803d' },
};

function IntentBadge({ intent }) {
  const cfg = INTENT_COLORS[intent] || INTENT_COLORS.informational;
  return (
    <span
      className="ce-intent-badge"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {intent}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */
const TABS = [
  { key: 'briefs', label: 'Content Briefs', icon: FileText },
  { key: 'meta', label: 'Meta Tags', icon: Tag },
  { key: 'scores', label: 'Content Scores', icon: BarChart3 },
  { key: 'decay', label: 'Content Decay', icon: TrendingDown },
];

/* ================================================================== */
/*  Main ContentEngine Page                                            */
/* ================================================================== */
function ContentEngine() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('briefs');

  return (
    <div className="page-container">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(`/project/${id}`)}>
        <ArrowLeft size={18} />
        Back to Project
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">Content Engine</h1>
          <p className="page-subtitle">AI-powered content briefs, meta tags, scoring and decay detection</p>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab-btn${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <t.icon size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'briefs' && <BriefsTab projectId={id} navigate={navigate} />}
      {tab === 'meta' && <MetaTagsTab projectId={id} />}
      {tab === 'scores' && <ScoresTab projectId={id} />}
      {tab === 'decay' && <DecayTab projectId={id} />}
    </div>
  );
}

/* ================================================================== */
/*  Content Briefs Tab                                                 */
/* ================================================================== */
function BriefsTab({ projectId, navigate }) {
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [generating, setGenerating] = useState(false);

  const fetchBriefs = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/content/briefs/${projectId}`);
      setBriefs(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load briefs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBriefs(); }, [projectId]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    try {
      setGenerating(true);
      await api.post(`/content/brief/${projectId}`, { keyword: keyword.trim() });
      setKeyword('');
      setShowModal(false);
      await fetchBriefs();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate brief');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (briefId) => {
    try {
      await api.delete(`/content/brief/${briefId}`);
      setBriefs(prev => prev.filter(b => b._id !== briefId));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete brief');
    }
  };

  if (loading) return <LoadingSpinner message="Loading content briefs..." />;

  return (
    <>
      {error && <div className="error-banner">{error}</div>}

      <div className="ce-toolbar">
        <span className="text-muted">{briefs.length} brief{briefs.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          Generate Brief
        </button>
      </div>

      {briefs.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>No Content Briefs Yet</h3>
          <p>Generate your first AI content brief by clicking the button above.</p>
        </div>
      ) : (
        <div className="ce-briefs-grid">
          {briefs.map(brief => (
            <div
              key={brief._id}
              className="card ce-brief-card"
              onClick={() => navigate(`/project/${projectId}/content/brief/${brief._id}`)}
            >
              <div className="ce-brief-card-header">
                <h4 className="ce-brief-card-title">{brief.title || brief.targetKeyword}</h4>
                <span className={`status-badge status-${brief.status === 'published' ? 'active' : 'paused'}`}>
                  {brief.status}
                </span>
              </div>
              <div className="ce-brief-card-keyword">
                <Tag size={12} />
                {brief.targetKeyword}
              </div>
              <div className="ce-brief-card-meta">
                {brief.targetIntent && <IntentBadge intent={brief.targetIntent} />}
                {brief.suggestedWordCount && (
                  <span className="text-muted">{brief.suggestedWordCount} words</span>
                )}
                <span className="text-muted">{brief.outline?.length || 0} sections</span>
              </div>
              <div className="ce-brief-card-footer">
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {new Date(brief.createdAt).toLocaleDateString()}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.stopPropagation(); handleDelete(brief._id); }}
                  title="Delete brief"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Generate Content Brief</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleGenerate}>
              <div className="form-group">
                <label>Target Keyword</label>
                <input
                  type="text"
                  placeholder="e.g. best project management tools"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={generating || !keyword.trim()}>
                  <Sparkles size={16} className={generating ? 'spin' : ''} />
                  {generating ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/* ================================================================== */
/*  Meta Tags Tab                                                      */
/* ================================================================== */
function MetaTagsTab({ projectId }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const handleBulkGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post(`/content/meta-tags/bulk/${projectId}`);
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate meta tags');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (url) => {
    setExpanded(prev => ({ ...prev, [url]: !prev[url] }));
  };

  return (
    <>
      {error && <div className="error-banner">{error}</div>}

      <div className="ce-toolbar">
        <p className="text-muted">Generate AI meta tag suggestions for pages with weak tags.</p>
        <button className="btn btn-primary" onClick={handleBulkGenerate} disabled={loading}>
          <Sparkles size={16} className={loading ? 'spin' : ''} />
          {loading ? 'Generating...' : 'Bulk Generate'}
        </button>
      </div>

      {loading && <LoadingSpinner message="Analyzing pages and generating meta tags..." />}

      {results && !loading && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="ce-meta-summary">
            <span>{results.pagesAnalyzed} pages analyzed</span>
            <span>{results.suggestionsGenerated} suggestions generated</span>
          </div>

          {results.results.length === 0 ? (
            <p className="text-muted" style={{ padding: 24, textAlign: 'center' }}>
              All pages have strong meta tags (score 80+). No suggestions needed.
            </p>
          ) : (
            <div className="ce-meta-list">
              {results.results.map((item, idx) => (
                <div key={idx} className="ce-meta-item">
                  <div
                    className="ce-meta-item-header"
                    onClick={() => toggleExpand(item.url)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="ce-meta-item-url">
                      <ExternalLink size={14} />
                      <span>{item.url}</span>
                    </div>
                    <div className="ce-meta-item-scores">
                      <span className={`score-badge score-${(item.current?.title?.score || 0) >= 80 ? 'green' : (item.current?.title?.score || 0) >= 50 ? 'yellow' : 'red'}`}>
                        Title: {item.current?.title?.score || 0}
                      </span>
                      <span className={`score-badge score-${(item.current?.description?.score || 0) >= 80 ? 'green' : (item.current?.description?.score || 0) >= 50 ? 'yellow' : 'red'}`}>
                        Desc: {item.current?.description?.score || 0}
                      </span>
                    </div>
                  </div>

                  {expanded[item.url] && (
                    <div className="ce-meta-item-body">
                      <div className="ce-meta-section">
                        <h5>Current Title</h5>
                        <p className="ce-meta-current">{item.current?.title?.value || '(none)'}</p>
                      </div>
                      <div className="ce-meta-section">
                        <h5>Suggested Titles</h5>
                        {item.suggestions.titles?.map((t, i) => (
                          <p key={i} className="ce-meta-suggestion">{t}</p>
                        ))}
                      </div>
                      <div className="ce-meta-section">
                        <h5>Current Description</h5>
                        <p className="ce-meta-current">{item.current?.description?.value || '(none)'}</p>
                      </div>
                      <div className="ce-meta-section">
                        <h5>Suggested Descriptions</h5>
                        {item.suggestions.descriptions?.map((d, i) => (
                          <p key={i} className="ce-meta-suggestion">{d}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ================================================================== */
/*  Content Scores Tab                                                 */
/* ================================================================== */
function ScoresTab({ projectId }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/content/scores/${projectId}`);
        setScores(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load content scores');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [projectId]);

  if (loading) return <LoadingSpinner message="Scoring content..." />;
  if (error) return <div className="error-banner">{error}</div>;

  if (scores.length === 0) {
    return (
      <div className="empty-state">
        <BarChart3 size={48} />
        <h3>No Audit Data</h3>
        <p>Run an audit first to see content scores for your pages.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Content Score</th>
              <th>SEO Score</th>
              <th>Title</th>
              <th>Headings</th>
              <th>Depth</th>
              <th>Readability</th>
              <th>Links</th>
              <th>Words</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, idx) => (
              <tr key={idx}>
                <td className="url-cell">
                  <FileText size={14} />
                  <span title={s.url}>{s.url}</span>
                </td>
                <td>
                  <span className={`score-badge score-${s.contentScore >= 80 ? 'green' : s.contentScore >= 50 ? 'yellow' : 'red'}`}>
                    {s.contentScore}
                  </span>
                </td>
                <td>
                  <span className={`score-badge score-${s.seoScore >= 80 ? 'green' : s.seoScore >= 50 ? 'yellow' : 'red'}`}>
                    {s.seoScore}
                  </span>
                </td>
                <td><ScoreBar value={s.breakdown?.titleScore} maxWidth={80} /></td>
                <td><ScoreBar value={s.breakdown?.headingStructure} maxWidth={80} /></td>
                <td><ScoreBar value={s.breakdown?.contentDepth} maxWidth={80} /></td>
                <td><ScoreBar value={s.breakdown?.readability} maxWidth={80} /></td>
                <td><ScoreBar value={s.breakdown?.internalLinking} maxWidth={80} /></td>
                <td className="text-muted">{s.wordCount?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Content Decay Tab                                                  */
/* ================================================================== */
function DecayTab({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/content/decay/${projectId}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load decay data');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [projectId]);

  if (loading) return <LoadingSpinner message="Detecting content decay..." />;
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return null;

  return (
    <>
      <div className="ce-decay-summary">
        <div className="ce-decay-stat">
          <span className="ce-decay-stat-value">{data.totalPages}</span>
          <span className="ce-decay-stat-label">Total Pages</span>
        </div>
        <div className="ce-decay-stat ce-decay-stat-alert">
          <span className="ce-decay-stat-value">{data.decayingPages}</span>
          <span className="ce-decay-stat-label">Decaying Pages</span>
        </div>
      </div>

      {data.pages.length === 0 ? (
        <div className="empty-state">
          <TrendingDown size={48} />
          <h3>No Content Decay Detected</h3>
          <p>All pages are maintaining or improving their scores. Run multiple audits over time to track changes.</p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Current Score</th>
                  <th>Previous Score</th>
                  <th>Drop</th>
                  <th>Words</th>
                  <th>Last Crawled</th>
                </tr>
              </thead>
              <tbody>
                {data.pages.map((p, idx) => (
                  <tr key={idx} className="ce-decay-row">
                    <td className="url-cell">
                      <FileText size={14} />
                      <span title={p.url}>{p.url}</span>
                    </td>
                    <td>
                      <span className={`score-badge score-${p.currentScore >= 80 ? 'green' : p.currentScore >= 50 ? 'yellow' : 'red'}`}>
                        {p.currentScore}
                      </span>
                    </td>
                    <td>
                      <span className="score-badge score-green">{p.previousScore}</span>
                    </td>
                    <td>
                      <span className="ce-decay-drop">-{p.scoreDrop}</span>
                    </td>
                    <td className="text-muted">{p.wordCount?.toLocaleString() || '-'}</td>
                    <td className="text-muted">
                      {p.lastCrawled ? new Date(p.lastCrawled).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default ContentEngine;
