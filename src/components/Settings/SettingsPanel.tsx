import { Text } from 'preact-i18n';
import {
  rate, pitch, maxThreads,
  rateDisplay, pitchDisplay,
  showDopSettings, lexxRegister,
  outputFormat, silenceRemovalEnabled, normalizationEnabled,
  ffmpegError,
  saveSettings, saveLLMSettings
} from '../../state/appState';
import { Slider } from './Slider';
import { PointsSelector } from './PointsSelector';
import { LLMSettingsPanel } from './LLMSettingsPanel';

export function SettingsPanel() {
  return (
    <div class="settings-panel">
      <LLMSettingsPanel />

      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color, #444)' }}>
        <PointsSelector />

      <Slider
        label={<Text id="settings.rate">Speed</Text>}
        value={rate.value}
        min={-50}
        max={100}
        display={rateDisplay.value}
        onChange={(v) => rate.value = v}
      />

      <div
        class="dop-settings-toggle"
        onClick={() => showDopSettings.value = !showDopSettings.value}
        style={{ cursor: 'pointer', textAlign: 'center', marginBottom: '0.5rem' }}
      >
        <label style={{ cursor: 'pointer' }}>
          {showDopSettings.value ? '▲' : '▼'} <Text id="settings.additional">Additional</Text>
        </label>
      </div>

      {showDopSettings.value && (
        <div class="dop-settings">
          <Slider
            label={<Text id="settings.pitch">Pitch</Text>}
            value={pitch.value}
            min={-50}
            max={50}
            display={pitchDisplay.value}
            onChange={(v) => pitch.value = v}
          />

          <Slider
            label={<Text id="settings.threads">Threads</Text>}
            value={maxThreads.value}
            min={1}
            max={30}
            display={`${maxThreads.value}`}
            onChange={(v) => maxThreads.value = v}
          />

          <label class="toggle-wrapper">
            <span><Text id="settings.outputFormat">Output Format</Text></span>
            <select
              value={outputFormat.value}
              onChange={(e) => outputFormat.value = (e.target as HTMLSelectElement).value as 'mp3' | 'opus'}
              style={{ marginLeft: 'auto', padding: '0.25rem' }}
            >
              <option value="opus">Opus</option>
              <option value="mp3">MP3</option>
            </select>
          </label>

          {outputFormat.value === 'opus' && (
            <>
              <label class="toggle-wrapper">
                <span><Text id="settings.silenceRemoval">Remove Silence</Text></span>
                <input
                  type="checkbox"
                  class="toggle"
                  checked={silenceRemovalEnabled.value}
                  onChange={(e) => silenceRemovalEnabled.value = (e.target as HTMLInputElement).checked}
                />
              </label>

              <label class="toggle-wrapper">
                <span><Text id="settings.normalization">Normalize Audio</Text></span>
                <input
                  type="checkbox"
                  class="toggle"
                  checked={normalizationEnabled.value}
                  onChange={(e) => normalizationEnabled.value = (e.target as HTMLInputElement).checked}
                />
              </label>

              {ffmpegError.value && (
                <div style={{ color: 'var(--warning-color, #f90)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  ⚠️ {ffmpegError.value}
                </div>
              )}
            </>
          )}

          <label class="toggle-wrapper">
            <span><Text id="settings.dictionary.caseSensitive">Dictionary case</Text></span>
            <input
              type="checkbox"
              class="toggle"
              checked={lexxRegister.value}
              onChange={(e) => lexxRegister.value = (e.target as HTMLInputElement).checked}
            />
          </label>
        </div>
      )}

      <button
        onClick={() => { saveSettings(); void saveLLMSettings(); }}
        style={{ width: '100%', marginBottom: '1rem' }}
      >
        💾 <Text id="settings.save">Save Settings</Text>
      </button>
      </div>
    </div>
  );
}
