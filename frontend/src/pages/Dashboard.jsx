import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Globe } from 'lucide-react';
import api from '../api/client';
import ProjectCard from '../components/ProjectCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/dashboard');
        setProjects(res.data.projects || res.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <LoadingSpinner message="Loading projects..." />;

  if (error) {
    return (
      <div className="page-container">
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Monitor your SEO performance across all projects</p>
        </div>
        <Link to="/project/new" className="btn btn-primary">
          <Plus size={18} />
          Add Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No projects yet"
          message="Add your first site to start monitoring its SEO health."
          action={
            <Link to="/project/new" className="btn btn-primary" style={{ marginTop: 16 }}>
              <Plus size={18} />
              Add Project
            </Link>
          }
        />
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <ProjectCard key={project._id || project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
