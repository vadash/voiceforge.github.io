import { useRef, useCallback } from 'preact/hooks';
import { useLogs, useConversion, useSettings } from '../stores';

export function StatusArea() {
  const logs = useLogs();
  const conversion = useConversion();
  const settings = useSettings();

  const statusText = logs.getStatusLines().join('\n');
  const { current, total } = conversion.progress.value;
  const progress = total > 0 ? `${current} / ${total}` : '';

  const isDragging = useRef(false);
  const resizerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    resizerRef.current?.classList.add('dragging');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(250, Math.min(newWidth, window.innerWidth * 0.5));
      settings.setStatusAreaWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      resizerRef.current?.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      settings.save();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [settings]);

  return (
    <div
      class="status-area"
      style={{ width: `${settings.statusAreaWidth.value}px` }}
    >
      <div
        ref={resizerRef}
        class="status-resizer"
        onMouseDown={handleMouseDown}
      />
      {progress && (
        <div style={{
          textAlign: 'center',
          padding: '0.5rem',
          color: 'var(--text-secondary)',
          borderBottom: '1px solid var(--border)'
        }}>
          {progress}
        </div>
      )}
      <textarea
        id="stat-area"
        readOnly
        value={statusText}
        style={{
          flex: 1,
          width: '100%',
          backgroundColor: 'var(--bg-primary)',
          border: 'none',
          fontFamily: 'var(--font-mono)',
          fontSize: '1rem',
          color: 'var(--text-primary)',
          padding: '0.75rem',
          resize: 'none',
          outline: 'none',
          cursor: 'default',
        }}
      />
    </div>
  );
}
