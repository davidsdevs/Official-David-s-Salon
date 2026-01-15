import React from 'react';

const normalizeHex = (value) => {
  if (typeof value !== 'string') return '#000000';
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return '#000000';
};

const InlineColorPicker = ({
  label,
  value,
  onChange,
  enabled = true,
  className = ''
}) => {
  if (!enabled) {
    return null;
  }

  const hex = normalizeHex(value);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label ? (
        <span className="text-xs font-medium text-gray-700 whitespace-nowrap">{label}</span>
      ) : null}
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-8 w-10 p-0 border border-gray-300 rounded bg-white"
      />
      <span className="text-xs font-mono text-gray-600">{hex.toUpperCase()}</span>
    </div>
  );
};

export default InlineColorPicker;
