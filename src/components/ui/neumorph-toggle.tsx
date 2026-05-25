'use client'

import React from 'react'

interface NeumorphToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function NeumorphToggle({ checked, onChange, label, disabled = false }: NeumorphToggleProps) {
  return (
    <div className="neumorph-container">
      <div className="toggle-neumorph">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <div className="button"></div>
        <div className="label">
          {label || (checked ? 'ON' : 'OFF')}
        </div>
      </div>
    </div>
  )
}