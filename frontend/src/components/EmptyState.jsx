import { Globe } from 'lucide-react';

function EmptyState({ icon: Icon = Globe, title, message, action }) {
  return (
    <div className="empty-state">
      <Icon size={48} strokeWidth={1.5} />
      <h3>{title}</h3>
      <p>{message}</p>
      {action && action}
    </div>
  );
}

export default EmptyState;
