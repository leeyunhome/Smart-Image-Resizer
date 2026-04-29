import type { AppSettings, AspectRatio } from '../types';
import './SettingsPanel.css';

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  disabled?: boolean;
}

const RATIOS: { label: string; value: AspectRatio }[] = [
  { label: '1:1', value: '1:1' },
  { label: '3:4', value: '3:4' },
  { label: '4:3', value: '4:3' },
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: 'Custom', value: 'custom' },
];

export default function SettingsPanel({ settings, onChange, disabled }: SettingsPanelProps) {
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className={`settings-panel glass-panel animate-fade-in ${disabled ? 'disabled' : ''}`}>
      <div className="settings-section">
        <h3>Canvas Aspect Ratio</h3>
        <div className="ratio-options">
          {RATIOS.map(r => (
            <button
              key={r.value}
              className={`ratio-btn ${settings.aspectRatio === r.value ? 'active' : ''}`}
              onClick={() => updateSetting('aspectRatio', r.value)}
              disabled={disabled}
            >
              {r.label}
            </button>
          ))}
        </div>
        {settings.aspectRatio === 'custom' && (
          <div className="custom-ratio-inputs">
            <input
              type="number"
              placeholder="Width"
              value={settings.customRatio.width || ''}
              onChange={(e) => updateSetting('customRatio', { ...settings.customRatio, width: Number(e.target.value) })}
              disabled={disabled}
              min="1"
            />
            <span>:</span>
            <input
              type="number"
              placeholder="Height"
              value={settings.customRatio.height || ''}
              onChange={(e) => updateSetting('customRatio', { ...settings.customRatio, height: Number(e.target.value) })}
              disabled={disabled}
              min="1"
            />
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Process Mode</h3>
        <div className="mode-options">
          <label className="mode-label">
            <input
              type="radio"
              name="processMode"
              checked={settings.mode === 'padding'}
              onChange={() => updateSetting('mode', 'padding')}
              disabled={disabled}
            />
            <span className="radio-custom"></span>
            Padding (Fit & Add Margins)
          </label>
          <label className="mode-label">
            <input
              type="radio"
              name="processMode"
              checked={settings.mode === 'crop'}
              onChange={() => updateSetting('mode', 'crop')}
              disabled={disabled}
            />
            <span className="radio-custom"></span>
            Crop (Fill Canvas)
          </label>
        </div>
      </div>

      {settings.mode === 'padding' && (
        <div className="settings-section">
          <h3>Padding Color</h3>
          <div className="color-picker-wrapper">
            <input
              type="color"
              value={settings.paddingColor}
              onChange={(e) => updateSetting('paddingColor', e.target.value)}
              disabled={disabled}
              className="color-picker"
            />
            <span className="color-value">{settings.paddingColor}</span>
          </div>
        </div>
      )}
    </div>
  );
}
