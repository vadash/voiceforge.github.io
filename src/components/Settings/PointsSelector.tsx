import { Text } from 'preact-i18n';
import { pointsSelect, pointsType } from '../../state/appState';

const POINTS_OPTIONS = [
  'Don\'t replace periods',
  'Replace periods with ,',
  'Replace periods with ;',
  'Replace periods with :',
];

export function PointsSelector() {
  const cyclePointsType = () => {
    const types: Array<'V1' | 'V2' | 'V3'> = ['V1', 'V2', 'V3'];
    const currentIndex = types.indexOf(pointsType.value);
    pointsType.value = types[(currentIndex + 1) % 3];
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.5rem' }}>
      <select
        class="pointsselect"
        value={pointsSelect.value}
        onChange={(e) => pointsSelect.value = (e.target as HTMLSelectElement).value}
        style={{ width: '80%', borderRadius: '10px' }}
      >
        {POINTS_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <button
        onClick={cyclePointsType}
        style={{ width: '16%', minWidth: '40px' }}
      >
        {pointsType.value}
      </button>
    </div>
  );
}
