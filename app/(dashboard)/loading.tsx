import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="flex items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="text-lg font-medium text-slate-400">Carregando dados...</span>
      </div>
    </div>
  );
}
