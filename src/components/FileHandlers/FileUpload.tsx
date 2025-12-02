import { useRef } from 'preact/hooks';
import { Text } from 'preact-i18n';
import { textContent, bookLoaded, addStatusLine } from '../../state/appState';

export function FileUpload() {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    try {
      for (const file of Array.from(files)) {
        const text = await file.text();
        textContent.value += (textContent.value ? '\n\n' : '') + text;
        addStatusLine(`Loaded: ${file.name}`);
      }
      bookLoaded.value = true;
    } catch (err) {
      addStatusLine(`Error loading file: ${err}`);
    }

    input.value = '';
  };

  return (
    <div style={{ width: '48%' }}>
      <label style={{ display: 'block', textAlign: 'center', paddingBottom: '0.5rem' }}>
        <Text id="files.upload">Файл</Text>
      </label>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.fb2,.epub,.ini,.zip"
        multiple
        onChange={handleFileChange}
      />
      <button
        onClick={() => inputRef.current?.click()}
        style={{ width: '100%' }}
      >
        📄
      </button>
    </div>
  );
}
