import { useEffect } from 'preact/hooks';
import { Text } from 'preact-i18n';
import { isLiteMode, loadSettings } from './state/appState';
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
      <main class="main-content">
        {!isLiteMode.value && <TextInput />}

        <div class="controls">
          <div class="top-row">
            <VoiceSelector />
            <button
              class="settings-toggle"
              onClick={() => isLiteMode.value = !isLiteMode.value}
            >
              <Text id="settings.toggle">Настройки</Text>
            </button>
          </div>

          <SettingsPanel />

          <div class="file-handlers">
            <DictionaryUpload />
            <FileUpload />
          </div>

          <ConvertButton />
        </div>
      </main>

      <StatusArea />
    </div>
  );
}
