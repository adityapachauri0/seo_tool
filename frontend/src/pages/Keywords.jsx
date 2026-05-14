import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Plus, Upload, Sparkles, Trash2,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Tag, Layers,
  BarChart3, Filter, X, RefreshCw, Minus,
} from 'lucide-react';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

/* ------------------------------------------------------------------ */
/*  Intent badge colours                                               */
/* ------------------------------------------------------------------ */
const INTENT_COLORS = {
  informational: { bg: '#dbeafe', color: '#1d4ed8', label: 'Informational' },
  commercial:    { bg: '#f3e8ff', color: '#7c3aed', label: 'Commercial' },
  transactional: { bg: '#dcfce7', color: '#15803d', label: 'Transactional' },
  navigational:  { bg: '#ffedd5', color: '#c2410c', label: 'Navigational' },
};

function IntentBadge({ intent }) {
  const cfg = INTENT_COLORS[intent] || INTENT_COLORS.informational;
  return (
    <span className="kw-intent-badge" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Difficulty bar                                                     */
/* ------------------------------------------------------------------ */
function DifficultyBar({ value = 0 }) {
  const pct = Math.min(100, Math.max(0, value));
  const barColor = pct >= 70 ? '#dc2626' : pct >= 40 ? '#eab308' : '#16a34a';
  return (
    <div className="kw-difficulty-bar-wrap">
      <div className="kw-difficulty-bar" style={{ width: `${pct}%`, background: barColor }} />
      <span className="kw-difficulty-label">{pct}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rank change indicator                                              */
/* ------------------------------------------------------------------ */
function RankChange({ change, previousRank }) {
  const delta = change != null ? change : (previousRank != null ? 0 : null);
  if (delta == null || delta === 0) return <Minus size={14} className="text-muted" />;
  if (delta > 0) {
    return (
      <span className="kw-rank-up">
        <TrendingUp size={13} />
        {delta}
      </span>
    );
  }
  return (
    <span className="kw-rank-down">
      <TrendingDown size={13} />
      {Math.abs(delta)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini trend chart (SVG sparkline)                                   */
/* ------------------------------------------------------------------ */
function TrendMiniChart({ trend = [] }) {
  if (!trend.length) return <span className="text-muted">No trend data</span>;
  const w = 200, h = 50, pad = 4;
  const volumes = trend.map((t) => t.volume);
  const min = Math.min(...volumes);
  const max = Math.max(...volumes);
  const range = max - min || 1;
  const points = volumes.map((v, i) => {
    const x = pad + (i / (volumes.length - 1)) * (w - pad * 2);
    const y = pad + (h - pad * 2) - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="kw-trend-chart">
      <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Research Modal                                                     */
/* ------------------------------------------------------------------ */
function ResearchModal({ projectId, onClose, onAdded }) {
  const [seed, setSeed] = useState('');
  const [count, setCount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);

  const handleResearch = async () => {
    if (!seed.trim()) return;
    setLoading(true);
    try {
      const res = await api.post(`/keywords/${projectId}/research`, { seed: seed.trim(), count });
      setResults(res.data.suggestions);
      setSelected(new Set(res.data.suggestions.map((_, i) => i)));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((_, i) => i)));
    }
  };

  const handleAdd = async () => {
    const toAdd = results.filter((_, i) => selected.has(i));
    if (!toAdd.length) return;
    setAdding(true);
    try {
      await api.post(`/keywords/${projectId}`, { keywords: toAdd });
      onAdded();
      onClose();
    } catch {
      /* ignore */
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="kw-modal-overlay" onClick={onClose}>
      <div className="kw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kw-modal-header">
          <h2>Keyword Research</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="kw-modal-body">
          <div className="kw-research-form">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Seed Keyword</label>
              <input
                type="text"
                placeholder="e.g. pcp claim"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
              />
            </div>
            <div className="form-group" style={{ width: 100 }}>
              <label>Count</label>
              <input
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10) || 50)}
              />
            </div>
            <button className="btn btn-primary" onClick={handleResearch} disabled={loading || !seed.trim()} style={{ alignSelf: 'flex-end' }}>
              <Sparkles size={16} />
              {loading ? 'Researching...' : 'Research'}
            </button>
          </div>

          {results && (
            <>
              <div className="kw-research-actions">
                <button className="btn btn-sm btn-ghost" onClick={toggleAll}>
                  {selected.size === results.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-muted" style={{ fontSize: 13 }}>{selected.size} of {results.length} selected</span>
              </div>
              <div className="kw-research-results">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th>Keyword</th>
                      <th>Volume</th>
                      <th>CPC</th>
                      <th>Difficulty</th>
                      <th>Intent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((kw, idx) => (
                      <tr key={idx} className="table-row-clickable" onClick={() => toggleSelect(idx)}>
                        <td>
                          <input type="checkbox" checked={selected.has(idx)} readOnly />
                        </td>
                        <td>{kw.keyword}</td>
                        <td>{(kw.volume || 0).toLocaleString()}</td>
                        <td>${kw.cpc}</td>
                        <td><DifficultyBar value={kw.difficulty} /></td>
                        <td><IntentBadge intent={kw.intent} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {results && (
          <div className="kw-modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={adding || selected.size === 0}>
              <Plus size={16} />
              {adding ? 'Adding...' : `Add ${selected.size} Keywords`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Import Modal                                                       */
/* ------------------------------------------------------------------ */
function ImportModal({ projectId, onClose, onImported }) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    setError('');
    let parsed;
    try {
      parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }
    } catch {
      const lines = text.trim().split('\n').filter(Boolean);
      parsed = lines.map((line) => {
        const parts = line.split(',').map((s) => s.trim());
        return {
          keyword: parts[0],
          volume: parts[1] ? parseInt(parts[1], 10) : undefined,
          cpc: parts[2] ? parseFloat(parts[2]) : undefined,
        };
      });
    }

    if (!parsed.length || !parsed[0].keyword) {
      setError('Could not parse input. Use JSON array or CSV (keyword,volume,cpc per line).');
      return;
    }

    setImporting(true);
    try {
      await api.post(`/keywords/${projectId}/import`, { keywords: parsed });
      onImported();
      onClose();
    } catch {
      setError('Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="kw-modal-overlay" onClick={onClose}>
      <div className="kw-modal kw-modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="kw-modal-header">
          <h2>Import Keywords</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="kw-modal-body">
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Paste JSON array or CSV (one keyword per line: keyword,volume,cpc)
          </p>
          <textarea
            className="kw-import-textarea"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'keyword1,1000,1.5\nkeyword2,500,0.8\n\nor JSON:\n[{"keyword":"example","volume":1000}]'}
          />
          {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}
        </div>
        <div className="kw-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={importing || !text.trim()}>
            <Upload size={16} />
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cluster View                                                       */
/* ------------------------------------------------------------------ */
function ClusterView({ projectId }) {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [expanded, setExpanded] = useState(new Set());

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/keywords/${projectId}/clusters`);
      setClusters(res.data.clusters || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchClusters(); }, [fetchClusters]);

  const handleCluster = async () => {
    setClustering(true);
    try {
      await api.post(`/keywords/${projectId}/cluster`);
      await fetchClusters();
    } catch {
      /* ignore */
    } finally {
      setClustering(false);
    }
  };

  const toggleExpand = (name) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  if (loading) return <LoadingSpinner message="Loading clusters..." />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 0 }}>
          <Layers size={18} /> Keyword Clusters ({clusters.length})
        </h3>
        <button className="btn btn-primary btn-sm" onClick={handleCluster} disabled={clustering}>
          <Sparkles size={14} />
          {clustering ? 'Clustering...' : 'Auto-Cluster'}
        </button>
      </div>

      {clusters.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: 32 }}>
          No clusters yet. Add keywords then click Auto-Cluster.
        </p>
      ) : (
        <div className="kw-clusters-list">
          {clusters.map((cluster) => (
            <div key={cluster.name} className="kw-cluster-card card">
              <div className="kw-cluster-header" onClick={() => toggleExpand(cluster.name)}>
                <div className="kw-cluster-info">
                  <span className="kw-cluster-name">{cluster.name}</span>
                  <IntentBadge intent={cluster.intent} />
                  <span className="kw-cluster-meta">{cluster.keywords.length} keywords</span>
                  <span className="kw-cluster-meta">Vol: {(cluster.totalVolume || 0).toLocaleString()}</span>
                  <span className="kw-cluster-meta">Diff: {cluster.avgDifficulty}</span>
                  <span className={`kw-cluster-status kw-cluster-status--${cluster.status}`}>{cluster.status}</span>
                </div>
                {expanded.has(cluster.name) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
              {expanded.has(cluster.name) && (
                <div className="kw-cluster-keywords">
                  {cluster.keywords.map((kw) => (
                    <span key={kw} className="kw-cluster-kw-tag"><Tag size={12} /> {kw}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Keywords Page                                                 */
/* ------------------------------------------------------------------ */
function Keywords() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('opportunityScore');
  const [order, setOrder] = useState('desc');
  const [search, setSearch] = useState('');
  const [intentFilter, setIntentFilter] = useState('');
  const [clusterFilter, setClusterFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [showResearch, setShowResearch] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [projectName, setProjectName] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [clusterNames, setClusterNames] = useState([]);

  const fetchKeywords = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25, sort, order };
      if (search) params.search = search;
      if (intentFilter) params.intent = intentFilter;
      if (clusterFilter) params.cluster = clusterFilter;

      const [kwRes, statsRes, clusterRes] = await Promise.all([
        api.get(`/keywords/${projectId}`, { params }),
        api.get(`/keywords/${projectId}/stats`).catch(() => ({ data: null })),
        api.get(`/keywords/${projectId}/clusters`).catch(() => ({ data: { clusters: [] } })),
      ]);

      setKeywords(kwRes.data.keywords || []);
      setTotalPages(kwRes.data.pagination?.totalPages || 1);
      setTotal(kwRes.data.pagination?.total || 0);
      if (statsRes.data) setStats(statsRes.data);
      setClusterNames((clusterRes.data.clusters || []).map(c => c.name).filter(Boolean));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [projectId, page, sort, order, search, intentFilter, clusterFilter]);

  useEffect(() => { fetchKeywords(); }, [fetchKeywords]);

  // Fetch project name once
  useEffect(() => {
    api.get(`/projects/${projectId}`).then((res) => {
      const p = res.data.project || res.data;
      setProjectName(p.name || p.domain || '');
    }).catch(() => {});
  }, [projectId]);

  const handleDelete = async (kwId) => {
    if (!window.confirm('Delete this keyword?')) return;
    try {
      await api.delete(`/keywords/${projectId}/${kwId}`);
      fetchKeywords();
    } catch {
      /* ignore */
    }
  };

  const handleSort = (field) => {
    if (sort === field) {
      setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    } else {
      setSort(field);
      setOrder('desc');
    }
    setPage(1);
  };

  const handleSyncGsc = async () => {
    setSyncing(true);
    try {
      const res = await api.post(`/keywords/${projectId}/sync-gsc`);
      alert(`Synced ${res.data.synced} keywords from Search Console`);
      fetchKeywords();
    } catch (err) {
      alert(err.response?.data?.error || 'GSC sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const SortIcon = ({ field }) => {
    if (sort !== field) return null;
    return order === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />;
  };

  const intentDist = stats?.intentDistribution || {};
  const intentTotal = Object.values(intentDist).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="page-container">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(`/project/${projectId}`)}>
        <ArrowLeft size={18} /> Back to Project
      </button>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Keywords {projectName && `- ${projectName}`}</h1>
          <p className="page-subtitle">Research, track, and cluster your target keywords &mdash; {total} tracked</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleSyncGsc} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync GSC'}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={16} /> Import
          </button>
          <button className="btn btn-primary" onClick={() => setShowResearch(true)}>
            <Sparkles size={16} /> Research Keywords
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="kw-stats-bar">
          <div className="kw-stat-card">
            <span className="kw-stat-value">{(stats.totalKeywords || 0).toLocaleString()}</span>
            <span className="kw-stat-label">Total Keywords</span>
          </div>
          <div className="kw-stat-card">
            <span className="kw-stat-value">{(stats.avgVolume || 0).toLocaleString()}</span>
            <span className="kw-stat-label">Avg Volume</span>
          </div>
          <div className="kw-stat-card">
            <span className="kw-stat-value">${stats.avgCpc || 0}</span>
            <span className="kw-stat-label">Avg CPC</span>
          </div>
          <div className="kw-stat-card">
            <span className="kw-stat-value">{stats.avgDifficulty || 0}</span>
            <span className="kw-stat-label">Avg Difficulty</span>
          </div>
          <div className="kw-stat-card">
            <span className="kw-stat-value">{stats.avgOpportunity || 0}</span>
            <span className="kw-stat-label">Avg Opportunity</span>
          </div>
          <div className="kw-stat-card kw-stat-intent">
            <span className="kw-stat-label" style={{ marginBottom: 6 }}>Intent Distribution</span>
            <div className="kw-intent-bars">
              {Object.entries(intentDist).map(([intent, cnt]) => {
                const cfg = INTENT_COLORS[intent] || INTENT_COLORS.informational;
                const pct = Math.round((cnt / intentTotal) * 100);
                return (
                  <div key={intent} className="kw-intent-bar-row">
                    <span className="kw-intent-bar-label" style={{ color: cfg.color }}>{cfg.label}</span>
                    <div className="kw-intent-bar-track">
                      <div className="kw-intent-bar-fill" style={{ width: `${pct}%`, background: cfg.color }} />
                    </div>
                    <span className="kw-intent-bar-pct">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginTop: 24 }}>
        <button className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
          <BarChart3 size={14} style={{ marginRight: 4 }} /> Keyword List
        </button>
        <button className={`tab-btn ${activeTab === 'clusters' ? 'active' : ''}`} onClick={() => setActiveTab('clusters')}>
          <Layers size={14} style={{ marginRight: 4 }} /> Clusters
        </button>
      </div>

      {activeTab === 'clusters' ? (
        <ClusterView projectId={projectId} />
      ) : (
        <>
          {/* Search / Filter Bar */}
          <div className="kw-filter-bar">
            <div className="kw-search-input">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search keywords..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="kw-filter-group">
              <Filter size={14} />
              <select value={intentFilter} onChange={(e) => { setIntentFilter(e.target.value); setPage(1); }}>
                <option value="">All Intents</option>
                <option value="informational">Informational</option>
                <option value="commercial">Commercial</option>
                <option value="transactional">Transactional</option>
                <option value="navigational">Navigational</option>
              </select>
            </div>
            <div className="kw-filter-group">
              <Layers size={14} />
              <select value={clusterFilter} onChange={(e) => { setClusterFilter(e.target.value); setPage(1); }}>
                <option value="">All Clusters</option>
                {clusterNames.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Keywords Table */}
          {loading ? (
            <LoadingSpinner message="Loading keywords..." />
          ) : keywords.length === 0 ? (
            <div className="empty-state">
              <Search size={48} />
              <h3>No keywords yet</h3>
              <p>Click "Research Keywords" to discover keyword opportunities, import your own list, or sync from Google Search Console.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrapper">
                <table className="data-table kw-table">
                  <thead>
                    <tr>
                      <th className="kw-th-sortable" onClick={() => handleSort('keyword')}>Keyword <SortIcon field="keyword" /></th>
                      <th className="kw-th-sortable" onClick={() => handleSort('volume')}>Volume <SortIcon field="volume" /></th>
                      <th className="kw-th-sortable" onClick={() => handleSort('cpc')}>CPC <SortIcon field="cpc" /></th>
                      <th>Competition</th>
                      <th>Intent</th>
                      <th className="kw-th-sortable" onClick={() => handleSort('difficulty')}>Difficulty <SortIcon field="difficulty" /></th>
                      <th className="kw-th-sortable" onClick={() => handleSort('currentRank')}>Rank <SortIcon field="currentRank" /></th>
                      <th className="kw-th-sortable" onClick={() => handleSort('opportunityScore')}>Opportunity <SortIcon field="opportunityScore" /></th>
                      <th className="kw-th-sortable" onClick={() => handleSort('clicks')}>Clicks <SortIcon field="clicks" /></th>
                      <th className="kw-th-sortable" onClick={() => handleSort('impressions')}>Impr. <SortIcon field="impressions" /></th>
                      <th style={{ width: 50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.map((kw) => {
                      const isExpanded = expandedRow === kw._id;
                      return (
                        <Fragment key={kw._id}>
                          <tr
                            className="table-row-clickable"
                            onClick={() => setExpandedRow(isExpanded ? null : kw._id)}
                          >
                            <td className="kw-keyword-cell">
                              <span
                                className="kw-keyword-link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/project/${projectId}/keywords/${encodeURIComponent(kw.keyword)}`);
                                }}
                              >
                                {kw.keyword}
                              </span>
                            </td>
                            <td>{(kw.volume || 0).toLocaleString()}</td>
                            <td>{kw.cpc != null ? `$${kw.cpc}` : '-'}</td>
                            <td>
                              {kw.competition ? (
                                <span className={`kw-comp-badge kw-comp-${kw.competition}`}>{kw.competition}</span>
                              ) : '-'}
                            </td>
                            <td>{kw.intent ? <IntentBadge intent={kw.intent} /> : '-'}</td>
                            <td><DifficultyBar value={kw.difficulty} /></td>
                            <td>
                              <div className="kw-rank-cell">
                                <span>{kw.currentRank || '-'}</span>
                                <RankChange change={kw.rankChange} previousRank={kw.previousRank} />
                              </div>
                            </td>
                            <td>
                              <span className={`score-badge ${(kw.opportunityScore || 0) >= 60 ? 'score-green' : (kw.opportunityScore || 0) >= 30 ? 'score-yellow' : 'score-red'}`}>
                                {kw.opportunityScore || 0}
                              </span>
                            </td>
                            <td>{kw.clicks != null ? kw.clicks.toLocaleString() : '-'}</td>
                            <td>{kw.impressions != null ? kw.impressions.toLocaleString() : '-'}</td>
                            <td>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={(e) => { e.stopPropagation(); handleDelete(kw._id); }}
                                title="Delete keyword"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="kw-expanded-row">
                              <td colSpan={11}>
                                <div className="kw-expanded-content">
                                  <div className="kw-expanded-section">
                                    <h4><TrendingUp size={14} /> 12-Month Trend</h4>
                                    <TrendMiniChart trend={kw.trend} />
                                  </div>
                                  <div className="kw-expanded-section">
                                    <h4><Tag size={14} /> Details</h4>
                                    <div className="kw-expanded-details">
                                      {(kw.clusterName || kw.cluster) && <p><strong>Cluster:</strong> {kw.clusterName || kw.cluster}</p>}
                                      {kw.url && <p><strong>URL:</strong> {kw.url}</p>}
                                      {kw.avgPosition != null && <p><strong>Avg Position:</strong> {kw.avgPosition}</p>}
                                      {kw.ctr != null && <p><strong>CTR:</strong> {kw.ctr}%</p>}
                                      {kw.previousRank != null && <p><strong>Previous Rank:</strong> {kw.previousRank}</p>}
                                      <p><strong>Source:</strong> {kw.source || 'manual'}</p>
                                      <p><strong>Competition Index:</strong> {kw.competitionIndex ?? '-'}</p>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {page} of {totalPages} ({total} keywords)
                  </span>
                  <button className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showResearch && (
        <ResearchModal
          projectId={projectId}
          onClose={() => setShowResearch(false)}
          onAdded={() => fetchKeywords()}
        />
      )}
      {showImport && (
        <ImportModal
          projectId={projectId}
          onClose={() => setShowImport(false)}
          onImported={() => fetchKeywords()}
        />
      )}
    </div>
  );
}

export default Keywords;
