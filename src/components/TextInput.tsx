import { textContent, isLiteMode } from '../state/appState';

export function TextInput() {
  if (isLiteMode.value) return null;

  return (
    <textarea
      class="text-input"
      id="text-area"
      placeholder="Текст..."
      value={textContent.value}
      onInput={(e) => textContent.value = (e.target as HTMLTextAreaElement).value}
      style={{
        minHeight: '55vh',
        flexGrow: 1,
        marginRight: '1rem',
      }}
    />
  );
}
