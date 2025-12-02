import { useEffect } from 'preact/hooks';
import { Text } from 'preact-i18n';
import { isLiteMode, isProcessing, loadSettings } from './state/appState';
import { TextInput } from './components/TextInput';
import { VoiceSelector } from './components/VoiceSelector/VoiceSelector';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { FileUpload } from './components/FileHandlers/FileUpload';
import { DictionaryUpload } from './components/FileHandlers/DictionaryUpload';
import { StatusArea } from './components/StatusArea';
import { ConvertButton } from './components/ConvertButton';

export function App() {
  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <div class={`app ${isLiteMode.value ? 'lite' : ''}`}>
      <aside class="sidebar">
        <div class="top-row">
          <VoiceSelector />
          <button
            class="settings-toggle"
            onClick={() => isLiteMode.value = !isLiteMode.value}
          >
            <Text id="settings.toggle">Settings</Text>
          </button>
        </div>

        <SettingsPanel />

        <div class="file-handlers">
          <DictionaryUpload />
          <FileUpload />
        </div>

        <ConvertButton />
      </aside>

      <main class="main-content">
        {!isLiteMode.value && <TextInput />}
      </main>

      {!isLiteMode.value && <StatusArea />}
    </div>
  );
}
