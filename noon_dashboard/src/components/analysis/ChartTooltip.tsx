export const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { color: string; name: string; value: string | number }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: 'rgba(15, 17, 26, 0.9)',
          border: '1px solid var(--border-strong)',
          padding: '12px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
        }}
      >
        {label && (
          <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#f8fafc' }}>{label}</p>
        )}
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: 0, color: entry.color, fontSize: '0.875rem' }}>
            {entry.name}:{' '}
            <span style={{ fontWeight: 600 }}>
              {typeof entry.value === 'number' && !Number.isInteger(entry.value)
                ? Number(entry.value).toFixed(2)
                : entry.value}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};
