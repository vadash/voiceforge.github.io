import { statusLines, processedCount, totalCount } from '../state/appState';

export function StatusArea() {
  const statusText = statusLines.value.join('\n');
  const progress = totalCount.value > 0
    ? `${processedCount.value} / ${totalCount.value}`
    : '';

  return (
    <div class="status-area" style={{ marginTop: '1rem' }}>
      {progress && (
        <div style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
          {progress}
        </div>
      )}
      <textarea
        id="stat-area"
        readOnly
        value={statusText}
        style={{
          width: '100%',
          backgroundColor: 'var(--bg-primary)',
          border: 'none',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.9rem',
          color: 'var(--text-muted)',
          minHeight: '20vh',
          resize: 'vertical',
          outline: 'none',
          cursor: 'default',
        }}
      />
    </div>
  );
}
