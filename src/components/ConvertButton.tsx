import { Text } from 'preact-i18n';
import { textContent, isProcessing, book } from '../state/appState';
import { useTTSConversion } from '../hooks/useTTSConversion';

export function ConvertButton() {
  const { startConversion, selectDirectory } = useTTSConversion();

  const handleClick = async () => {
    if (!textContent.value.trim()) {
      return;
    }

    // Try to select directory first
    const canProceed = await selectDirectory();
    if (!canProceed) return;

    // Start conversion
    await startConversion(textContent.value, book.value);
  };

  return (
    <button
      class="convert-btn"
      onClick={handleClick}
      disabled={isProcessing.value}
    >
      {isProcessing.value ? (
        <Text id="status.processing">Обработка...</Text>
      ) : (
        <Text id="convert.button">Сохранить в MP3</Text>
      )}
    </button>
  );
}
