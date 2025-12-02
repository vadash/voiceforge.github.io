import { textContent, isLiteMode } from '../state/appState';

export function TextInput() {
  if (isLiteMode.value) return null;

  return (
    <textarea
      class="text-input"
      id="text-area"
      placeholder="Text..."
      value={textContent.value}
      onInput={(e) => textContent.value = (e.target as HTMLTextAreaElement).value}
      style={{
        flex: 1,
        width: '100%',
        minHeight: '200px',
      }}
    />
  );
}
