import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Tag, Hash, Target, AlignLeft,
  CheckCircle, Save, ExternalLink,
} from 'lucide-react';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

/* ------------------------------------------------------------------ */
/*  Intent badge                                                       */
/* ------------------------------------------------------------------ */
const INTENT_COLORS = {
  informational: { bg: '#dbeafe', color: '#1d4ed8' },
  commercial:    { bg: '#f3e8ff', color: '#7c3aed' },
  transactional: { bg: '#dcfce7', color: '#15803d' },
};

/* ================================================================== */
/*  ContentBriefDetail Page                                            */
/* ================================================================== */
function ContentBriefDetail() {
  const { id: projectId, briefId } = useParams();
  const navigate = useNavigate();
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Editable fields
  const [status, setStatus] = useState('draft');
  const [assignedUrl, setAssignedUrl] = useState('');

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/content/brief/detail/${briefId}`);
        setBrief(res.data);
        setStatus(res.data.status || 'draft');
        setAssignedUrl(res.data.assignedUrl || '');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load brief');
      } finally {
        setLoading(false);
      }
    };
    fetchBrief();
  }, [briefId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setSuccessMsg('');
      const res = await api.put(`/content/brief/${briefId}`, { status, assignedUrl });
      setBrief(res.data);
      setSuccessMsg('Brief updated successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save brief');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading content brief..." />;
  if (error) {
    return (
      <div className="page-container">
        <div className="error-banner">{error}</div>
      </div>
    );
  }
  if (!brief) return null;

  const intentCfg = INTENT_COLORS[brief.targetIntent] || INTENT_COLORS.informational;

  return (
    <div className="page-container">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(`/project/${projectId}/content`)}>
        <ArrowLeft size={18} />
        Back to Content Engine
      </button>

      {successMsg && (
        <div className="ce-success-banner">
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}

      {/* Header */}
      <div className="ce-detail-header">
        <div className="ce-detail-header-left">
          <h1 className="page-title">{brief.title || brief.targetKeyword}</h1>
          <div className="ce-detail-keyword">
            <Tag size={14} />
            <span>{brief.targetKeyword}</span>
          </div>
        </div>
        <div className="ce-detail-header-right">
          <div className="ce-detail-header-stats">
            <div className="ce-detail-stat">
              <span className="ce-detail-stat-value">{brief.suggestedWordCount || '-'}</span>
              <span className="ce-detail-stat-label">Words</span>
            </div>
            <div className="ce-detail-stat">
              <span className="ce-detail-stat-value">{brief.outline?.length || 0}</span>
              <span className="ce-detail-stat-label">Sections</span>
            </div>
            <div className="ce-detail-stat">
              <span
                className="ce-detail-stat-value"
                style={{ color: intentCfg.color, fontSize: 14 }}
              >
                {brief.targetIntent || 'N/A'}
              </span>
              <span className="ce-detail-stat-label">Intent</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status & URL controls */}
      <div className="card ce-detail-controls">
        <div className="ce-detail-controls-row">
          <div className="form-group" style={{ flex: '0 0 200px' }}>
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Assigned URL</label>
            <input
              type="text"
              placeholder="https://example.com/page"
              value={assignedUrl}
              onChange={e => setAssignedUrl(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ alignSelf: 'flex-end' }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="ce-detail-grid">
        {/* Outline */}
        <div className="card">
          <h3 className="section-title">
            <AlignLeft size={16} />
            Content Outline
          </h3>
          {brief.outline?.length > 0 ? (
            <ul className="ce-outline-list">
              {brief.outline.map((item, idx) => (
                <li key={idx} className={`ce-outline-item ce-outline-level-${item.level || 2}`}>
                  <span className="ce-outline-heading-tag">H{item.level || 2}</span>
                  <div className="ce-outline-content">
                    <span className="ce-outline-heading">{item.heading}</span>
                    {item.notes && <span className="ce-outline-notes">{item.notes}</span>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No outline generated.</p>
          )}
        </div>

        {/* Required Topics */}
        <div className="card">
          <h3 className="section-title">
            <Hash size={16} />
            Required Topics
          </h3>
          {brief.requiredTopics?.length > 0 ? (
            <div className="ce-topics-wrap">
              {brief.requiredTopics.map((topic, idx) => (
                <span key={idx} className="ce-topic-tag">{topic}</span>
              ))}
            </div>
          ) : (
            <p className="text-muted">No required topics specified.</p>
          )}
        </div>
      </div>

      {/* Meta Tag Suggestions */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 className="section-title">
          <Target size={16} />
          Meta Tag Suggestions
        </h3>

        <div className="ce-meta-suggestions-grid">
          <div className="ce-meta-suggestions-col">
            <h4 className="ce-meta-suggestions-heading">Title Tags</h4>
            {brief.metaSuggestions?.titles?.length > 0 ? (
              brief.metaSuggestions.titles.map((t, idx) => (
                <div key={idx} className="ce-meta-suggestion-item">
                  <span className="ce-meta-suggestion-number">{idx + 1}</span>
                  <div className="ce-meta-suggestion-text">
                    <p>{t}</p>
                    <span className="ce-meta-suggestion-chars">{t.length} chars</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted">No title suggestions.</p>
            )}
          </div>

          <div className="ce-meta-suggestions-col">
            <h4 className="ce-meta-suggestions-heading">Meta Descriptions</h4>
            {brief.metaSuggestions?.descriptions?.length > 0 ? (
              brief.metaSuggestions.descriptions.map((d, idx) => (
                <div key={idx} className="ce-meta-suggestion-item">
                  <span className="ce-meta-suggestion-number">{idx + 1}</span>
                  <div className="ce-meta-suggestion-text">
                    <p>{d}</p>
                    <span className="ce-meta-suggestion-chars">{d.length} chars</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted">No description suggestions.</p>
            )}
          </div>
        </div>
      </div>

      {/* Competitor Insights */}
      {brief.competitorInsights?.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3 className="section-title">
            <ExternalLink size={16} />
            Competitor Insights
          </h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Title</th>
                  <th>Word Count</th>
                  <th>Headings</th>
                </tr>
              </thead>
              <tbody>
                {brief.competitorInsights.map((c, idx) => (
                  <tr key={idx}>
                    <td className="url-cell">
                      <ExternalLink size={14} />
                      <a href={c.url} target="_blank" rel="noopener noreferrer">{c.url}</a>
                    </td>
                    <td>{c.title || '-'}</td>
                    <td>{c.wordCount?.toLocaleString() || '-'}</td>
                    <td>{c.headings?.length || 0}</td>
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

export default ContentBriefDetail;
