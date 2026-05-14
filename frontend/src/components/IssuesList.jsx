import { AlertTriangle, CheckCircle, Activity } from 'lucide-react';

const severityConfig = {
  critical: { icon: AlertTriangle, className: 'severity-critical', label: 'Critical' },
  warning: { icon: AlertTriangle, className: 'severity-warning', label: 'Warning' },
  info: { icon: Activity, className: 'severity-info', label: 'Info' },
};

function IssuesList({ issues = [] }) {
  if (issues.length === 0) {
    return (
      <div className="issues-empty">
        <CheckCircle size={20} />
        <span>No issues found</span>
      </div>
    );
  }

  return (
    <ul className="issues-list">
      {issues.map((issue, index) => {
        const config = severityConfig[issue.severity] || severityConfig.info;
        const Icon = config.icon;
        return (
          <li key={index} className={`issue-item ${config.className}`}>
            <div className="issue-header">
              <Icon size={16} />
              <span className="issue-severity-badge">{config.label}</span>
              <span className="issue-title">{issue.message || issue.title}</span>
            </div>
            {issue.recommendation && (
              <p className="issue-recommendation">{issue.recommendation}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default IssuesList;
