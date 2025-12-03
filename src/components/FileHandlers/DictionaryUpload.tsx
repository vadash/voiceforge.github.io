import { useRef } from 'preact/hooks';
import { Text } from 'preact-i18n';
import { useData, useLogs } from '../../stores';

export function DictionaryUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const dataStore = useData();
  const logs = useLogs();

  const handleFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      dataStore.setDictionaryRaw(lines);
      logs.info(`Dictionary loaded: ${lines.length} rules`);
    } catch (err) {
      logs.error(`Error loading dictionary: ${err}`);
    }

    input.value = '';
  };

  return (
    <label>
      <span style={{ display: 'block', textAlign: 'center', paddingBottom: '0.25rem' }}>
        <Text id="files.dictionary">Dictionary</Text>
        {dataStore.dictionaryRaw.value.length > 0 && (
          <span style={{ color: 'var(--accent)' }}> ({dataStore.dictionaryRaw.value.length})</span>
        )}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".lexx,.txt"
        onChange={handleFileChange}
      />
      <button
        onClick={() => inputRef.current?.click()}
        style={{ width: '100%' }}
      >
        📖
      </button>
    </label>
  );
}
