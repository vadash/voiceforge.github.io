import { Text } from 'preact-i18n';
import {
  textContent, isProcessing, savePathHandle,
  addStatusLine, clearStatus
} from '../state/appState';

export function ConvertButton() {
  const handleClick = async () => {
    if (!textContent.value.trim()) {
      addStatusLine('No text to convert');
      return;
    }

    // Try to get save directory
    if (!savePathHandle.value && window.showDirectoryPicker) {
      try {
        savePathHandle.value = await window.showDirectoryPicker();
        addStatusLine(`Save directory selected`);
      } catch (err) {
        addStatusLine('Directory selection cancelled');
        return;
      }
    }

    clearStatus();
    isProcessing.value = true;
    addStatusLine('Starting conversion...');

    // TODO: Implement actual TTS conversion
    // This will be wired up when EdgeTTSService is migrated
    addStatusLine('TTS service not yet implemented');
    isProcessing.value = false;
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
