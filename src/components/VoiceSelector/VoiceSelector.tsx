import { voice } from '../../state/appState';
import voices from './voices';

export function VoiceSelector() {
  return (
    <select
      class="voices"
      id="voices"
      value={voice.value}
      onChange={(e) => voice.value = (e.target as HTMLSelectElement).value}
      style={{ width: '80%', borderRadius: '10px' }}
    >
      {voices.map((v) => (
        <option key={v.fullValue} value={v.fullValue}>
          {v.fullValue}
        </option>
      ))}
    </select>
  );
}
