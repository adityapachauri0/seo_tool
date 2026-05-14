function ScoreCircle({ score, size = 80 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const remaining = circumference - progress;

  const getColor = (s) => {
    if (s >= 80) return '#16a34a';
    if (s >= 50) return '#eab308';
    return '#dc2626';
  };

  const color = getColor(score);
  const fontSize = size < 60 ? 14 : size < 100 ? 20 : 28;

  return (
    <div className="score-circle" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${progress} ${remaining}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight="700"
          fill={color}
        >
          {score}
        </text>
      </svg>
    </div>
  );
}

export default ScoreCircle;
