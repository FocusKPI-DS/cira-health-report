'use client'

import { useState } from 'react'
import { ISO_MODULES } from '@/lib/iso-checklist'

interface IsoChecklistPanelProps {
  onSubmit: (answers: Record<string, string>) => void
  isLoading: boolean
  disabled?: boolean
  styles?: Record<string, string>
}

export default function IsoChecklistPanel({ onSubmit, isLoading, disabled, styles }: IsoChecklistPanelProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    for (const mod of ISO_MODULES) {
      for (const q of mod.questions) {
        defaults[`${mod.module}-${q.index}`] = q.options[0]
      }
    }
    return defaults
  })

  const totalQuestions = ISO_MODULES.reduce((sum, m) => sum + m.questions.length, 0)
  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === totalQuestions

  const setAnswer = (module: number, questionIndex: number, value: string) => {
    setAnswers(prev => ({ ...prev, [`${module}-${questionIndex}`]: value }))
  }

  const handleSubmit = () => {
    if (isLoading || disabled) return
    onSubmit(answers)
  }

  return (
    <div style={{ marginTop: 12 }}>
      {ISO_MODULES.map(mod => (
        <div
          key={mod.module}
          style={{
            marginBottom: 20,
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {/* Module header */}
          <div style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e5e7eb',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{
              background: '#3b82f6',
              color: '#fff',
              borderRadius: 4,
              padding: '1px 7px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.3,
            }}>
              {mod.module}
            </span>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
              {mod.name}
            </span>
          </div>

          {/* Questions */}
          <div style={{ padding: '4px 0' }}>
            {mod.questions.map((q, qi) => {
              const key = `${mod.module}-${q.index}`
              const selected = answers[key]
              return (
                <div
                  key={key}
                  style={{
                    padding: '10px 14px',
                    borderBottom: qi < mod.questions.length - 1 ? '1px solid #f3f4f6' : 'none',
                    background: selected ? '#fafffe' : undefined,
                  }}
                >
                  <div style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.5 }}>
                    <span style={{ color: '#9ca3af', marginRight: 6, fontSize: 11 }}>Q{q.index}</span>
                    {q.question}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {q.options.map(opt => {
                      const isSelected = selected === opt
                      return (
                        <button
                          key={opt}
                          onClick={() => !disabled && setAnswer(mod.module, q.index, opt)}
                          disabled={disabled || isLoading}
                          style={{
                            padding: '4px 12px',
                            borderRadius: 5,
                            border: isSelected ? '2px solid #3b82f6' : '1px solid #d1d5db',
                            background: isSelected ? '#eff6ff' : '#fff',
                            color: isSelected ? '#1d4ed8' : '#374151',
                            fontWeight: isSelected ? 600 : 400,
                            fontSize: 12,
                            cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.1s',
                          }}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Submit bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
        <button
          onClick={handleSubmit}
          disabled={isLoading || disabled || !allAnswered}
          className={styles?.generateButton}
        >
          {isLoading ? 'Generating…' : 'Generate Report'}
        </button>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          {answeredCount} / {totalQuestions} answered
        </span>
      </div>
    </div>
  )
}
