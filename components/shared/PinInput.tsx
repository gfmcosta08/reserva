// ========================================
// ARQUIVO: src/components/shared/PinInput.tsx
// ========================================

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (pin: string) => void;
  length?: number;
  error?: string;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
  blockingCountdown?: number | null;
}

export function PinInput({
  value,
  onChange,
  onComplete,
  length = 6,
  error,
  disabled,
  title = "Digite o PIN",
  subtitle,
  blockingCountdown,
}: PinInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (e.key === "Enter" && value.length === length) {
        onComplete?.(value);
      }
    },
    [disabled, value, length, onComplete]
  );

  const handleDigitClick = (digit: string) => {
    if (disabled) return;
    if (value.length < length) {
      const newValue = value + digit;
      onChange(newValue);
      if (newValue.length === length) {
        onComplete?.(newValue);
      }
    }
  };

  const handleClear = () => {
    if (disabled) return;
    onChange("");
  };

  const handleBackspace = () => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted);
    if (pasted.length === length) {
      onComplete?.(pasted);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4">
          <Lock className="h-8 w-8 text-blue-500" />
        </div>
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-slate-400 text-sm mt-2">{subtitle}</p>}
      </div>

      {/* Blocking countdown */}
      {blockingCountdown !== null && blockingCountdown > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-medium">PIN bloqueado</p>
              <p className="text-sm">Tente novamente em {blockingCountdown} minuto(s)</p>
            </div>
          </div>
        </div>
      )}

      {/* PIN Display */}
      <div className="flex justify-center gap-2 mb-6">
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              "h-14 w-11 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all",
              value.length > i
                ? "border-blue-500 bg-blue-500/10 text-white"
                : "border-slate-800 bg-slate-900 text-slate-700",
              disabled && "opacity-40 cursor-not-allowed",
              error && !value.length && "border-red-500 bg-red-500/10"
            )}
          >
            {showPin ? (
              value[i] || ""
            ) : value[i] ? (
              "•"
            ) : (
              ""
            )}
          </div>
        ))}
      </div>

      {/* Toggle visibility */}
      <div className="flex justify-center mb-4">
        <button
          type="button"
          onClick={() => setShowPin(!showPin)}
          disabled={disabled || value.length === 0}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40"
        >
          {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showPin ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 text-center text-sm text-red-400 font-medium bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20">
          {error}
        </div>
      )}

      {/* Keypad */}
      {!disabled && (
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "✓"].map((key) => {
            if (key === "C") {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={handleClear}
                  className="h-14 rounded-xl bg-slate-800 text-sm font-bold text-slate-300 hover:bg-slate-700 active:bg-slate-600 transition-colors"
                >
                  Limpar
                </button>
              );
            }
            if (key === "✓") {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onComplete?.(value)}
                  disabled={value.length !== length}
                  className="h-14 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Check className="h-6 w-6" />
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleDigitClick(key)}
                disabled={value.length >= length}
                className="h-14 rounded-xl bg-slate-800 text-2xl font-bold text-white hover:bg-slate-700 active:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {key}
              </button>
            );
          })}
        </div>
      )}

      {/* Hidden input for paste */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="\d*"
        value={value}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, "").slice(0, length);
          onChange(val);
          if (val.length === length) {
            onComplete?.(val);
          }
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="sr-only"
        autoComplete="one-time-code"
      />
    </div>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default PinInput;
