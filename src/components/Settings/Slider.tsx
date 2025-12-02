import { JSX, ComponentChildren } from 'preact';

interface SliderProps {
  label: ComponentChildren;
  value: number;
  min: number;
  max: number;
  display: string;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, display, onChange }: SliderProps) {
  return (
    <div class="slider-container" style={{ marginBottom: '0.75rem' }}>
      <label style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <output>{display}</output>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onInput={(e) => onChange(parseInt((e.target as HTMLInputElement).value, 10))}
        style={{ width: '100%' }}
      />
    </div>
  );
}
