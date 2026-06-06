"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"

export type PackQtyInputHandle = {
  /** Aplica o texto digitado ao valor numérico (chamar antes de submit do pacote). */
  commit: () => number
}

type Props = {
  value: number
  onChange: (n: number) => void
  max?: number
  min?: number
  className?: string
}

function parseDraft(digits: string, min: number, max: number): number {
  if (digits === "") return min
  const n = parseInt(digits, 10)
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

/** Quantidade editável: não altera o valor sozinho enquanto digita; limita máximo só ao sair do campo. */
export const PackQtyInput = forwardRef<PackQtyInputHandle, Props>(function PackQtyInput(
  { value, onChange, max = 9999, min = 0, className },
  ref
) {
  const [draft, setDraft] = useState(() => (value === 0 ? "" : String(value)))
  const focusedRef = useRef(false)

  const commitDraft = useCallback(() => {
    const n = parseDraft(draft, min, max)
    onChange(n)
    setDraft(n === 0 ? "" : String(n))
    return n
  }, [draft, min, max, onChange])

  useImperativeHandle(ref, () => ({ commit: commitDraft }), [commitDraft])

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value === 0 ? "" : String(value))
    }
  }, [value])

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
      value={draft}
      onFocus={() => {
        focusedRef.current = true
      }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "")
        setDraft(digits)
      }}
      onBlur={() => {
        focusedRef.current = false
        commitDraft()
      }}
      className={className}
    />
  )
})
