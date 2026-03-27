'use client'

import { useState } from 'react'

const ALL_HAZARDS = [
  'Biological Hazards',
  'Chemical Hazards',
  'Critical Failure Mode Hazards',
  'High-Severity Failure Hazards',
  'Electrical Energy Hazards',
  'Mechanical Energy Hazards',
  'Thermal Energy Hazards',
  'Radiation / Acoustic Energy Hazards',
  'Chemical Energy Hazards',
  'Biological Contamination Hazards',
  'Sterility Breach Hazards',
  'Chemical Substance Hazards',
  'Chronic Biological Hazards',
  'Implant Corrosion / Carcinogenicity Hazards',
  'Software / Information Hazards',
  'Cybersecurity Hazards',
  'Data Privacy & Integrity Hazards',
  'Software Update Hazards',
  'AI/ML Algorithmic Bias Hazards',
  'AI/ML Model Drift Hazards',
  'Autonomous Decision Hazards',
  'Electromagnetic Interference (EMC) Hazards',
  'Use Error / Misuse Hazards',
  'Disposal / Contamination Hazards',
]

interface IntendedUseHazardPanelProps {
  onSubmit: (intendedUse: string, selectedHazards: string[]) => void
  isLoading: boolean
  disabled?: boolean
  styles?: Record<string, string>
}

export default function IntendedUseHazardPanel({
  onSubmit,
  isLoading,
  disabled,
  styles,
}: IntendedUseHazardPanelProps) {
  const [intendedUse, setIntendedUse] = useState('')
  const [selectedHazards, setSelectedHazards] = useState<Set<string>>(new Set())
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDone, setAiDone] = useState(false)

  const handleAnalyze = async () => {
    if (!intendedUse.trim() || aiLoading) return
    setAiLoading(true)
    setAiDone(false)
    try {
      const res = await fetch('/api/suggest-hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intended_use: intendedUse.trim(), hazards: ALL_HAZARDS }),
      })
      if (res.ok) {
        const data = await res.json()
        setSelectedHazards(new Set(data.suggested_hazards ?? []))
      }
    } finally {
      setAiLoading(false)
      setAiDone(true)
    }
  }

  const toggleHazard = (h: string) => {
    if (disabled || isLoading) return
    setSelectedHazards(prev => {
      const next = new Set(prev)
      next.has(h) ? next.delete(h) : next.add(h)
      return next
    })
  }

  const handleSubmit = () => {
    if (isLoading || disabled || selectedHazards.size === 0) return
    onSubmit(intendedUse.trim(), Array.from(selectedHazards))
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* Intended Use input */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 6, fontWeight: 500 }}>
          Describe the intended use of your device:
        </div>
        <textarea
          value={intendedUse}
          onChange={e => setIntendedUse(e.target.value)}
          disabled={disabled || isLoading || aiLoading}
          placeholder="e.g. A centrifugal blood pump used to provide extracorporeal circulatory support in patients with cardiac failure..."
          rows={3}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            color: '#1e293b',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleAnalyze}
          disabled={!intendedUse.trim() || aiLoading || disabled || isLoading}
          style={{
            marginTop: 8,
            padding: '6px 16px',
            borderRadius: 5,
            border: '1px solid #3b82f6',
            background: '#3b82f6',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: (!intendedUse.trim() || aiLoading || disabled || isLoading) ? 'not-allowed' : 'pointer',
            opacity: (!intendedUse.trim() || aiLoading || disabled || isLoading) ? 0.6 : 1,
          }}
        >
          {aiLoading ? 'Analyzing…' : 'Suggest Hazards'}
        </button>
      </div>

      {/* Hazard checklist */}
      {(aiDone || selectedHazards.size > 0) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 8, fontWeight: 500 }}>
            Review and adjust applicable hazard categories:
            <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8, fontWeight: 400 }}>
              ({selectedHazards.size} selected)
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ALL_HAZARDS.map(h => {
              const checked = selectedHazards.has(h)
              return (
                <label
                  key={h}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 5,
                    border: checked ? '1.5px solid #3b82f6' : '1px solid #e5e7eb',
                    background: checked ? '#eff6ff' : '#fff',
                    cursor: (disabled || isLoading) ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: checked ? '#1d4ed8' : '#374151',
                    fontWeight: checked ? 600 : 400,
                    transition: 'all 0.1s',
                  }}
                  onClick={() => toggleHazard(h)}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleHazard(h)}
                    disabled={disabled || isLoading}
                    style={{ accentColor: '#3b82f6', width: 14, height: 14 }}
                  />
                  {h}
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Submit */}
      {(aiDone || selectedHazards.size > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
          <button
            onClick={handleSubmit}
            disabled={isLoading || disabled || selectedHazards.size === 0}
            className={styles?.generateButton}
          >
            {isLoading ? 'Generating…' : 'Generate Report'}
          </button>
          {selectedHazards.size === 0 && (
            <span style={{ fontSize: 12, color: '#f59e0b' }}>Select at least one hazard</span>
          )}
        </div>
      )}
    </div>
  )
}
