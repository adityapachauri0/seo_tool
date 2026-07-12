import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Target, MousePointerClick, Sparkles, RefreshCw, Link2, ExternalLink, Check, X } from 'lucide-react';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export default function Opportunities() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [opps, setOpps] = useState(null);
  const [days, setDays] = useState(90);
  const [busyKeyword, setBusyKeyword] = useState(null);
  const [ctrResults, setCtrResults] = useState({}); // keyword -> fix result
  const [linkOpps, setLinkOpps] = useState([]);
  const [sweeping, setSweeping] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRes, oppsRes, linkRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/opportunities/${id}?days=${days}`),
        api.get(`/link-opportunities/${id}`),
      ]);
      setProjectName(projectRes.data.name);
      setOpps(oppsRes.data);
      setLinkOpps(linkRes.data);
    } catch (err) {
      console.error('Failed to load opportunities:', err);
    } finally {
      setLoading(false);
    }
  }, [id, days]);

  useEffect(() => { load(); }, [load]);

  const handleBrief = async (keyword) => {
    setBusyKeyword(keyword);
    try {
      const res = await api.post(`/content/brief/${id}`, { keyword });
      navigate(`/project/${id}/content/brief/${res.data._id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Brief generation failed');
    } finally {
      setBusyKeyword(null);
    }
  };

  const handleCtrFix = async (keyword) => {
    setBusyKeyword(keyword);
    try {
      const res = await api.post(`/opportunities/${id}/ctr-fix`, { keyword });
      setCtrResults((prev) => ({ ...prev, [keyword]: res.data }));
    } catch (err) {
      alert(err.response?.data?.error || 'Rewrite failed');
    } finally {
      setBusyKeyword(null);
    }
  };

  const handleSweep = async () => {
    setSweeping(true);
    try {
      await api.post(`/link-opportunities/${id}/sweep`);
      const res = await api.get(`/link-opportunities/${id}`);
      setLinkOpps(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Sweep failed');
    } finally {
      setSweeping(false);
    }
  };

  const setLinkStatus = async (oppId, status) => {
    try {
      await api.put(`/link-opportunities/item/${oppId}`, { status });
      setLinkOpps((prev) => prev
        .map((o) => (o._id === oppId ? { ...o, status } : o))
        .filter((o) => o.status !== 'ignored'));
    } catch (err) {
      alert('Update failed');
    }
  };

  if (loading) return <LoadingSpinner />;

  const sd = opps?.strikingDistance || [];
  const cf = opps?.ctrFixes || [];

  return (
    <div className="page-container">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(`/project/${id}`)}>
        <ArrowLeft size={18} /> Back to Project
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">Opportunities {projectName && `- ${projectName}`}</h1>
          <p className="page-subtitle">
            Queries where a small push earns real traffic &mdash; computed from Search Console history
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={28}>Last 28 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
          </select>
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Striking distance */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Target size={18} /> Striking Distance
        </h2>
        <p className="text-muted" style={{ marginBottom: 12 }}>
          Ranking 4&ndash;15 with real impressions &mdash; push these to page 1 / top 3 with a content refresh or internal links.
        </p>
        {sd.length === 0 ? (
          <EmptyState title="Nothing in striking distance" message="No queries in positions 4-15 with enough impressions in this window." />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Position</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>Extra clicks if top 3</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sd.map((o) => (
                  <tr key={o.keyword}>
                    <td>{o.keyword}</td>
                    <td>{o.position}</td>
                    <td>{o.impressions.toLocaleString()}</td>
                    <td>{o.clicks.toLocaleString()}</td>
                    <td><strong>+{o.potentialClicks.toLocaleString()}</strong></td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busyKeyword === o.keyword}
                        onClick={() => handleBrief(o.keyword)}
                      >
                        <Sparkles size={14} className={busyKeyword === o.keyword ? 'spin' : ''} />
                        {busyKeyword === o.keyword ? 'Generating...' : 'Generate Brief'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Link opportunities (off-page) */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Link2 size={18} /> Link Opportunities
            </h2>
            <p className="text-muted" style={{ marginBottom: 12 }}>
              Unlinked brand mentions to reclaim, and journalists actively covering your topics &mdash; swept weekly.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={handleSweep} disabled={sweeping}>
            <RefreshCw size={16} className={sweeping ? 'spin' : ''} />
            {sweeping ? 'Sweeping...' : 'Sweep Now'}
          </button>
        </div>
        {linkOpps.length === 0 ? (
          <EmptyState title="No link opportunities yet" message="Run a sweep, or wait for the Monday morning sweep to populate this list." />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Page</th>
                  <th>Found via</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {linkOpps.map((o) => (
                  <tr key={o._id}>
                    <td>
                      <span className="kw-intent-badge" style={o.type === 'unlinked_mention'
                        ? { background: '#dcfce7', color: '#15803d' }
                        : { background: '#dbeafe', color: '#1d4ed8' }}>
                        {o.type === 'unlinked_mention' ? 'Unlinked mention' : 'Journalist activity'}
                      </span>
                    </td>
                    <td>
                      <a href={o.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {(o.title || o.url).slice(0, 70)} <ExternalLink size={12} />
                      </a>
                    </td>
                    <td className="text-muted">{o.query}</td>
                    <td>{o.status}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {o.status === 'new' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setLinkStatus(o._id, 'contacted')}>
                          <Check size={14} /> Contacted
                        </button>
                      )}{' '}
                      <button className="btn btn-ghost btn-sm" onClick={() => setLinkStatus(o._id, 'ignored')}>
                        <X size={14} /> Ignore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CTR fixes */}
      <div className="card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <MousePointerClick size={18} /> Title &amp; Meta Rewrites
        </h2>
        <p className="text-muted" style={{ marginBottom: 12 }}>
          Already visible, but earning far fewer clicks than the position should &mdash; a better title/description recovers them without ranking changes.
        </p>
        {cf.length === 0 ? (
          <EmptyState title="No CTR problems found" message="No page-1 queries are underperforming their expected click-through rate." />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Position</th>
                  <th>Impressions</th>
                  <th>CTR</th>
                  <th>Expected</th>
                  <th>Clicks missed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cf.map((o) => (
                  <Fragment key={o.keyword}>
                    <tr>
                      <td>{o.keyword}</td>
                      <td>{o.position}</td>
                      <td>{o.impressions.toLocaleString()}</td>
                      <td>{o.ctr}%</td>
                      <td>~{o.expectedCtr}%</td>
                      <td><strong>{o.missedClicks.toLocaleString()}</strong></td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={busyKeyword === o.keyword}
                          onClick={() => handleCtrFix(o.keyword)}
                        >
                          <Sparkles size={14} className={busyKeyword === o.keyword ? 'spin' : ''} />
                          {busyKeyword === o.keyword ? 'Rewriting...' : 'Rewrite Title & Meta'}
                        </button>
                      </td>
                    </tr>
                    {ctrResults[o.keyword] && (
                      <tr>
                        <td colSpan={7} style={{ background: 'var(--bg-secondary, #f8fafc)' }}>
                          <div style={{ padding: '8px 4px' }}>
                            <p style={{ marginBottom: 6 }}>
                              <strong>Page:</strong>{' '}
                              <a href={ctrResults[o.keyword].page} target="_blank" rel="noreferrer">
                                {ctrResults[o.keyword].page}
                              </a>
                            </p>
                            {ctrResults[o.keyword].current?.title?.value && (
                              <p className="text-muted" style={{ marginBottom: 6 }}>
                                <strong>Current title:</strong> {ctrResults[o.keyword].current.title.value}
                              </p>
                            )}
                            <p style={{ marginBottom: 4 }}><strong>Suggested titles:</strong></p>
                            <ul style={{ margin: '0 0 8px 18px' }}>
                              {(ctrResults[o.keyword].suggestions?.titles || []).map((t, i) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ul>
                            <p style={{ marginBottom: 4 }}><strong>Suggested descriptions:</strong></p>
                            <ul style={{ margin: '0 0 0 18px' }}>
                              {(ctrResults[o.keyword].suggestions?.descriptions || []).map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
