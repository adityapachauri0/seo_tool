import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, ExternalLink,
  BarChart3, MousePointerClick, Eye, Target, Crosshair,
} from 'lucide-react';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

const INTENT_COLORS = {
  informational: { bg: '#dbeafe', color: '#1d4ed8', label: 'Informational' },
  commercial:    { bg: '#f3e8ff', color: '#7c3aed', label: 'Commercial' },
  transactional: { bg: '#dcfce7', color: '#15803d', label: 'Transactional' },
  navigational:  { bg: '#ffedd5', color: '#c2410c', label: 'Navigational' },
};

/* ------------------------------------------------------------------ */
/*  Rank History Chart (SVG line chart)                                */
/* ------------------------------------------------------------------ */
function RankHistoryChart({ history = [] }) {
  if (history.length < 2) {
    return <p className="text-muted" style={{ padding: '24px 0', textAlign: 'center' }}>Not enough data points for a chart.</p>;
  }

  const width = 600;
  const height = 200;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Reverse so oldest is first
  const sorted = [...history].reverse();
  const positions = sorted.map(h => h.position || 100);
  const maxPos = Math.max(...positions, 10);
  const minPos = Math.min(...positions, 1);
  const range = maxPos - minPos || 1;

  const points = sorted.map((h, i) => {
    const x = padding.left + (i / (sorted.length - 1)) * chartW;
    // Invert: lower position = higher on chart
    const y = padding.top + ((h.position - minPos) / range) * chartH;
    return { x, y, ...h };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  // Y-axis labels (rank positions, note: lower is better)
  const yLabels = [];
  const step = Math.max(1, Math.ceil(range / 5));
  for (let val = minPos; val <= maxPos; val += step) {
    const y = padding.top + ((val - minPos) / range) * chartH;
    yLabels.push({ val: Math.round(val), y });
  }

  // X-axis labels (dates)
  const xLabels = [];
  const labelInterval = Math.max(1, Math.floor(sorted.length / 6));
  for (let i = 0; i < sorted.length; i += labelInterval) {
    const x = padding.left + (i / (sorted.length - 1)) * chartW;
    const date = new Date(sorted[i].date);
    xLabels.push({ label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), x });
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="kw-rank-chart">
      {/* Grid lines */}
      {yLabels.map((l, i) => (
        <line key={i} x1={padding.left} y1={l.y} x2={width - padding.right} y2={l.y} stroke="#e2e8f0" strokeWidth="1" />
      ))}

      {/* Y-axis labels */}
      {yLabels.map((l, i) => (
        <text key={i} x={padding.left - 8} y={l.y + 4} textAnchor="end" fontSize="11" fill="#64748b">{l.val}</text>
      ))}

      {/* X-axis labels */}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={height - 8} textAnchor="middle" fontSize="10" fill="#64748b">{l.label}</text>
      ))}

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="#2563eb"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#2563eb" />
          <title>Rank {p.position} on {new Date(p.date).toLocaleDateString()}</title>
        </g>
      ))}

      {/* Axis label */}
      <text x={12} y={height / 2} textAnchor="middle" fontSize="11" fill="#94a3b8" transform={`rotate(-90, 12, ${height / 2})`}>
        Rank Position
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Opportunity Score Breakdown                                        */
/* ------------------------------------------------------------------ */
function OpportunityBreakdown({ keyword }) {
  const volume = keyword.volume || 0;
  const difficulty = keyword.difficulty || 50;
  const cpc = keyword.cpc || 0;
  const currentRank = keyword.currentRank || 100;

  let positionBonus = 0;
  let positionLabel = 'No position data';
  if (currentRank >= 4 && currentRank <= 10) { positionBonus = 20; positionLabel = 'Page 1 (4-10)'; }
  else if (currentRank >= 11 && currentRank <= 20) { positionBonus = 40; positionLabel = 'Striking distance (11-20)'; }
  else if (currentRank >= 21 && currentRank <= 50) { positionBonus = 10; positionLabel = 'Page 3-5 (21-50)'; }
  else if (currentRank <= 3) { positionLabel = 'Top 3'; }
  else { positionLabel = 'Beyond page 5'; }

  const volumeScore = Math.min(volume / 1000, 30);
  const difficultyScore = Math.max(0, 30 - (difficulty * 0.3));
  const cpcScore = Math.min(cpc * 3, 20);
  const totalScore = Math.round(Math.min(100, volumeScore + difficultyScore + positionBonus + cpcScore));

  const factors = [
    { label: 'Volume Score', value: Math.round(volumeScore), max: 30, detail: `${volume.toLocaleString()} monthly searches` },
    { label: 'Difficulty Score', value: Math.round(difficultyScore), max: 30, detail: `Difficulty: ${difficulty}/100` },
    { label: 'Position Bonus', value: positionBonus, max: 40, detail: positionLabel },
    { label: 'CPC Value', value: Math.round(cpcScore), max: 20, detail: `$${cpc.toFixed(2)} per click` },
  ];

  return (
    <div className="kwd-opportunity">
      <div className="kwd-opp-total">
        <span className={`score-badge score-${totalScore >= 60 ? 'green' : totalScore >= 30 ? 'yellow' : 'red'}`} style={{ fontSize: 20, padding: '6px 16px' }}>
          {totalScore}
        </span>
        <span className="kwd-opp-total-label">/ 100</span>
      </div>
      <div className="kwd-opp-factors">
        {factors.map(f => (
          <div key={f.label} className="kwd-opp-factor">
            <div className="kwd-opp-factor-header">
              <span className="kwd-opp-factor-label">{f.label}</span>
              <span className="kwd-opp-factor-value">{f.value}/{f.max}</span>
            </div>
            <div className="kwd-opp-factor-bar-track">
              <div
                className="kwd-opp-factor-bar-fill"
                style={{ width: `${(f.value / f.max) * 100}%` }}
              />
            </div>
            <span className="kwd-opp-factor-detail">{f.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main KeywordDetail component                                       */
/* ------------------------------------------------------------------ */
function KeywordDetail() {
  const { id: projectId, keyword: keywordParam } = useParams();
  const navigate = useNavigate();
  const keywordStr = decodeURIComponent(keywordParam);

  const [keyword, setKeyword] = useState(null);
  const [history, setHistory] = useState([]);
  const [relatedKeywords, setRelatedKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch keyword data from the list
        const kwRes = await api.get(`/keywords/${projectId}`, {
          params: { search: keywordStr, limit: 100 },
        });
        const kws = kwRes.data.keywords || [];
        const exact = kws.find(k => k.keyword === keywordStr.toLowerCase()) || kws[0];
        if (!exact) {
          setError('Keyword not found');
          setLoading(false);
          return;
        }
        setKeyword(exact);

        // Fetch rank history and related keywords in parallel
        const [historyRes, relatedRes] = await Promise.all([
          api.get(`/keywords/${projectId}/rank-history/${encodeURIComponent(keywordStr)}`).catch(() => ({ data: [] })),
          exact.clusterName || exact.cluster
            ? api.get(`/keywords/${projectId}`, {
                params: { cluster: exact.clusterName || exact.cluster, limit: 10 },
              }).catch(() => ({ data: { keywords: [] } }))
            : Promise.resolve({ data: { keywords: [] } }),
        ]);

        setHistory(historyRes.data || []);
        setRelatedKeywords((relatedRes.data.keywords || []).filter(k => k.keyword !== keywordStr.toLowerCase()));
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load keyword data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId, keywordStr]);

  if (loading) return <LoadingSpinner message="Loading keyword details..." />;
  if (error) {
    return (
      <div className="page-container">
        <button className="btn btn-ghost back-btn" onClick={() => navigate(`/project/${projectId}/keywords`)}>
          <ArrowLeft size={18} /> Back to Keywords
        </button>
        <div className="error-banner">{error}</div>
      </div>
    );
  }
  if (!keyword) return null;

  const intentCfg = INTENT_COLORS[keyword.intent] || INTENT_COLORS.informational;
  const rankChange = keyword.rankChange;

  return (
    <div className="page-container">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(`/project/${projectId}/keywords`)}>
        <ArrowLeft size={18} /> Back to Keywords
      </button>

      {/* Header */}
      <div className="kwd-header">
        <div className="kwd-header-left">
          <h1 className="page-title">{keyword.keyword}</h1>
          <div className="kwd-badges">
            <span className="kw-intent-badge" style={{ background: intentCfg.bg, color: intentCfg.color }}>
              {intentCfg.label}
            </span>
            {keyword.competition && (
              <span className={`kw-comp-badge kw-comp-${keyword.competition}`}>{keyword.competition}</span>
            )}
            {keyword.source && keyword.source !== 'manual' && (
              <span className="kwd-source-badge">{keyword.source.replace('_', ' ')}</span>
            )}
          </div>
        </div>
        {keyword.url && (
          <a href={keyword.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            <ExternalLink size={14} /> View Ranking URL
          </a>
        )}
      </div>

      {/* Stats Cards */}
      <div className="kwd-stats-grid">
        <div className="kwd-stat-card">
          <BarChart3 size={20} className="kwd-stat-icon" />
          <span className="kwd-stat-value">{(keyword.volume || 0).toLocaleString()}</span>
          <span className="kwd-stat-label">Monthly Volume</span>
        </div>
        <div className="kwd-stat-card">
          <span className="kwd-stat-value">${(keyword.cpc || 0).toFixed(2)}</span>
          <span className="kwd-stat-label">CPC</span>
        </div>
        <div className="kwd-stat-card">
          <Target size={20} className="kwd-stat-icon" />
          <span className="kwd-stat-value">{keyword.difficulty || '-'}</span>
          <span className="kwd-stat-label">Difficulty</span>
        </div>
        <div className="kwd-stat-card">
          <Crosshair size={20} className="kwd-stat-icon" />
          <div className="kwd-rank-display">
            <span className="kwd-stat-value">{keyword.currentRank || '-'}</span>
            {rankChange != null && rankChange !== 0 && (
              <span className={rankChange > 0 ? 'kw-rank-up' : 'kw-rank-down'}>
                {rankChange > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {Math.abs(rankChange)}
              </span>
            )}
          </div>
          <span className="kwd-stat-label">Current Rank</span>
        </div>
        <div className="kwd-stat-card">
          <MousePointerClick size={20} className="kwd-stat-icon" />
          <span className="kwd-stat-value">{(keyword.clicks || 0).toLocaleString()}</span>
          <span className="kwd-stat-label">Clicks</span>
        </div>
        <div className="kwd-stat-card">
          <Eye size={20} className="kwd-stat-icon" />
          <span className="kwd-stat-value">{(keyword.impressions || 0).toLocaleString()}</span>
          <span className="kwd-stat-label">Impressions</span>
        </div>
        <div className="kwd-stat-card">
          <span className="kwd-stat-value">{keyword.ctr != null ? `${keyword.ctr}%` : '-'}</span>
          <span className="kwd-stat-label">CTR</span>
        </div>
        <div className="kwd-stat-card">
          <span className="kwd-stat-value">{keyword.avgPosition != null ? keyword.avgPosition : '-'}</span>
          <span className="kwd-stat-label">Avg Position</span>
        </div>
      </div>

      {/* Main content grid */}
      <div className="kwd-content-grid">
        {/* Rank History Chart */}
        <div className="card">
          <h3 className="section-title"><TrendingUp size={16} /> Rank History</h3>
          <RankHistoryChart history={history} />
        </div>

        {/* Opportunity Score Breakdown */}
        <div className="card">
          <h3 className="section-title"><Target size={16} /> Opportunity Score</h3>
          <OpportunityBreakdown keyword={keyword} />
        </div>
      </div>

      {/* Related Keywords */}
      {relatedKeywords.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3 className="section-title"><Crosshair size={16} /> Related Keywords in Cluster: {keyword.clusterName || keyword.cluster}</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Volume</th>
                  <th>Rank</th>
                  <th>Difficulty</th>
                  <th>Opportunity</th>
                </tr>
              </thead>
              <tbody>
                {relatedKeywords.map(rk => (
                  <tr
                    key={rk._id}
                    className="table-row-clickable"
                    onClick={() => navigate(`/project/${projectId}/keywords/${encodeURIComponent(rk.keyword)}`)}
                  >
                    <td style={{ fontWeight: 500 }}>{rk.keyword}</td>
                    <td>{(rk.volume || 0).toLocaleString()}</td>
                    <td>{rk.currentRank || '-'}</td>
                    <td>{rk.difficulty || '-'}</td>
                    <td>
                      <span className={`score-badge ${(rk.opportunityScore || 0) >= 60 ? 'score-green' : (rk.opportunityScore || 0) >= 30 ? 'score-yellow' : 'score-red'}`}>
                        {rk.opportunityScore || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default KeywordDetail;
