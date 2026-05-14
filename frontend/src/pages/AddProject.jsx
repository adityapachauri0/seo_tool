import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Settings } from 'lucide-react';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

function AddProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '',
    domain: '',
    tags: '',
    crawlFrequency: 'manual',
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    const fetchProject = async () => {
      try {
        const res = await api.get(`/projects/${id}`);
        const p = res.data.project || res.data;
        setForm({
          name: p.name || '',
          domain: (p.domain || '').replace(/^https?:\/\//, ''),
          tags: Array.isArray(p.tags) ? p.tags.join(', ') : p.tags || '',
          crawlFrequency: p.crawlFrequency || 'manual',
        });
      } catch (err) {
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [id, isEdit]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Project name is required');
      return;
    }
    if (!form.domain.trim()) {
      setError('Domain is required');
      return;
    }

    const payload = {
      name: form.name.trim(),
      domain: form.domain.trim().replace(/^https?:\/\//, ''),
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      crawlFrequency: form.crawlFrequency,
    };

    try {
      setSaving(true);
      if (isEdit) {
        await api.put(`/projects/${id}`, payload);
        navigate(`/project/${id}`);
      } else {
        const res = await api.post('/projects', payload);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading project..." />;

  return (
    <div className="page-container">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(isEdit ? `/project/${id}` : '/')}>
        <ArrowLeft size={18} />
        {isEdit ? 'Back to Project' : 'Back to Dashboard'}
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isEdit ? (
              <>
                <Settings size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Edit Project
              </>
            ) : (
              <>
                <Plus size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Add Project
              </>
            )}
          </h1>
          <p className="page-subtitle">
            {isEdit ? 'Update your project settings' : 'Start monitoring a new website'}
          </p>
        </div>
      </div>

      <div className="card form-card">
        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="project-form">
          <div className="form-group">
            <label htmlFor="name">Project Name</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="My Website"
              value={form.name}
              onChange={handleChange}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="domain">Domain</label>
            <div className="input-with-prefix">
              <span className="input-prefix">https://</span>
              <input
                id="domain"
                name="domain"
                type="text"
                placeholder="example.com"
                value={form.domain}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="tags">Tags (comma separated)</label>
            <input
              id="tags"
              name="tags"
              type="text"
              placeholder="blog, ecommerce, portfolio"
              value={form.tags}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="crawlFrequency">Crawl Frequency</label>
            <select
              id="crawlFrequency"
              name="crawlFrequency"
              value={form.crawlFrequency}
              onChange={handleChange}
            >
              <option value="manual">Manual</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(isEdit ? `/project/${id}` : '/')}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddProject;
