import { useState } from 'react'
import { PROGRAMMES, PROGRAMME_GROUPS } from '../data/mock'

const OTHER = '__other__'

interface ProgrammeSelectProps {
  value: string
  onChange: (value: string) => void
  /** Set to submit the value through an uncontrolled <form> (Settings). */
  name?: string
  /** Styling for both the select and the free-text input. */
  className?: string
}

/**
 * Programme picker: the full grouped catalogue plus a free-text "Other"
 * escape hatch, so no student is ever blocked by a missing option. A value
 * that isn't in the catalogue (saved earlier via "Other") reopens in
 * free-text mode with the text intact.
 */
export function ProgrammeSelect({ value, onChange, name, className }: ProgrammeSelectProps) {
  const [isOther, setIsOther] = useState(() => value !== '' && !PROGRAMMES.includes(value))

  return (
    <div className="space-y-2">
      <select
        value={isOther ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setIsOther(true)
            onChange('')
          } else {
            setIsOther(false)
            onChange(e.target.value)
          }
        }}
        className={className}
      >
        <option value="">Select a programme…</option>
        {PROGRAMME_GROUPS.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER}>Other — my programme isn&apos;t listed</option>
      </select>
      {isOther && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your programme, e.g. BSc Meteorology"
          className={className}
          autoFocus
        />
      )}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  )
}
