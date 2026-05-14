import { useNavigate } from 'react-router-dom';
import { Globe, Clock, ExternalLink } from 'lucide-react';
import ScoreCircle from './ScoreCircle';
import { timeAgo } from '../utils/timeAgo';

function ProjectCard({ project }) {
  const navigate = useNavigate();
  const score = project.lastScore ?? project.score ?? 0;
  const status = project.status || 'active';

  return (
    <div className="project-card" onClick={() => navigate(`/project/${project._id || project.id}`)}>
      <div className="card-header">
        <div className="card-title-row">
          <Globe size={18} className="card-icon" />
          <h3 className="card-title">{project.name}</h3>
        </div>
        <span className={`status-badge status-${status}`}>
          {status}
        </span>
      </div>

      <p className="card-domain">{project.domain}</p>

      <div className="card-body">
        <ScoreCircle score={score} size={72} />
        <div className="card-meta">
          <div className="meta-item">
            <Clock size={14} />
            <span>{timeAgo(project.lastCrawlAt)}</span>
          </div>
        </div>
      </div>

      <div className="card-footer">
        <button
          className="btn btn-sm btn-primary"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/project/${project._id || project.id}`);
          }}
        >
          View
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
}

export default ProjectCard;
