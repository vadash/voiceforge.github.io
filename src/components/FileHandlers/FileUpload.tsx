import { useRef } from 'preact/hooks';
import { Text } from 'preact-i18n';
import { useData, useLogs } from '../../stores';
import { convertFileToTxt } from '../../services/FileConverter';

export function FileUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const dataStore = useData();
  const logs = useLogs();

  const handleFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    try {
      for (const file of Array.from(files)) {
        const converted = await convertFileToTxt(file);

        for (const { filename, content } of converted) {
          const currentText = dataStore.textContent.value;
          dataStore.setTextContent(currentText + (currentText ? '\n\n' : '') + content);
        }

        if (converted.length === 1) {
          logs.info(`Loaded: ${file.name}`);
        } else {
          logs.info(`Loaded: ${file.name} (${converted.length} files)`);
        }
      }
      dataStore.bookLoaded.value = true;
    } catch (err) {
      logs.error(`Error loading file: ${(err as Error).message}`);
    }

    input.value = '';
  };

  return (
    <label>
      <span style={{ display: 'block', textAlign: 'center', paddingBottom: '0.25rem' }}>
        <Text id="files.upload">File</Text>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.fb2,.epub,.ini,.zip"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        style={{ width: '100%' }}
      >
        📄
      </button>
    </label>
  );
}
