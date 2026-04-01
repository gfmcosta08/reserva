// ========================================
// ARQUIVO: src/components/pessoa/AlertaFotoRG.tsx
// ========================================

"use client";

import { AlertTriangle, Upload, ImageOff } from "lucide-react";
import { clsx } from "clsx";

interface AlertaFotoRGProps {
  foto_rg_frente: string | null;
  foto_rg_verso: string | null;
  tamanho?: "sm" | "md" | "lg";
  showUploadButton?: boolean;
  onUploadClick?: () => void;
  className?: string;
}

export function AlertaFotoRG({
  foto_rg_frente,
  foto_rg_verso,
  tamanho = "md",
  showUploadButton = false,
  onUploadClick,
  className,
}: AlertaFotoRGProps) {
  const pendente = !foto_rg_frente || !foto_rg_verso;

  if (!pendente) {
    return null;
  }

  const sizeClasses = {
    sm: "text-xs px-2 py-1 gap-1",
    md: "text-sm px-3 py-1.5 gap-1.5",
    lg: "text-base px-4 py-2 gap-2",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <div
      className={clsx(
        "inline-flex items-center rounded-lg font-medium",
        "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        sizeClasses[tamanho],
        className
      )}
    >
      <AlertTriangle className={iconSizes[tamanho]} />
      <span>Foto do RG pendente</span>
      
      {showUploadButton && onUploadClick && (
        <button
          type="button"
          onClick={onUploadClick}
          className={clsx(
            "ml-1 inline-flex items-center rounded bg-amber-500/20 hover:bg-amber-500/30 transition-colors",
            tamanho === "sm" && "px-1.5 py-0.5 text-xs",
            tamanho === "md" && "px-2 py-1 text-xs",
            tamanho === "lg" && "px-2 py-1 text-sm"
          )}
        >
          <Upload className={clsx(iconSizes[tamanho], "mr-1")} />
          {tamanho === "sm" ? "Add" : "Adicionar"}
        </button>
      )}
    </div>
  );
}

interface BadgeFotoRGProps {
  foto_rg_frente: string | null;
  foto_rg_verso: string | null;
  className?: string;
}

export function BadgeFotoRG({ foto_rg_frente, foto_rg_verso, className }: BadgeFotoRGProps) {
  return (
    <AlertaFotoRG
      foto_rg_frente={foto_rg_frente}
      foto_rg_verso={foto_rg_verso}
      tamanho="sm"
      className={className}
    />
  );
}

interface CardAlertaFotoRGProps {
  foto_rg_frente: string | null;
  foto_rg_verso: string | null;
  onUploadClick: () => void;
  className?: string;
}

export function CardAlertaFotoRG({
  foto_rg_frente,
  foto_rg_verso,
  onUploadClick,
  className,
}: CardAlertaFotoRGProps) {
  const pendente = !foto_rg_frente || !foto_rg_verso;

  if (!pendente) {
    return null;
  }

  return (
    <div
      className={clsx(
        "rounded-xl border border-amber-500/20 bg-amber-500/5 p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-2 rounded-lg bg-amber-500/10">
          <ImageOff className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-amber-400">Fotos do RG pendentes</h4>
          <p className="text-sm text-slate-400 mt-1">
            Adicione as fotos do RG (frente e verso) para completar o cadastro da pessoa.
          </p>
          <button
            type="button"
            onClick={onUploadClick}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-medium transition-colors"
          >
            <Upload className="h-4 w-4" />
            Adicionar fotos do RG
          </button>
        </div>
      </div>
    </div>
  );
}

export default AlertaFotoRG;
