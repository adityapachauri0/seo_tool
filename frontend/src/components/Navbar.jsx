import { useState, useEffect } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { BarChart3, Bell } from 'lucide-react';
import api from '../api/client';

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  // Extract projectId from URL if viewing a project page
  const projectIdMatch = location.pathname.match(/\/project\/([a-f0-9]{24})/);
  const projectId = projectIdMatch ? projectIdMatch[1] : null;

  useEffect(() => {
    if (!projectId) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await api.get(`/reports/alerts/count/${projectId}`);
        if (!cancelled) setUnreadCount(res.data.unreadCount || 0);
      } catch {
        // Silently ignore — alerts may not exist yet
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId]);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <BarChart3 size={24} />
          <span>SEO Command Center</span>
        </Link>
        <div className="navbar-links">
          <Link
            to="/"
            className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Dashboard
          </Link>
          {projectId && (
            <button
              className="navbar-bell-btn"
              onClick={() => navigate(`/project/${projectId}/reports`)}
              title="Reports & Alerts"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="navbar-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
