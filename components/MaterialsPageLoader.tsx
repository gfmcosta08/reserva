"use client";

import { useEffect, useState } from "react";
import MaterialsClient, { type MaterialsUrlQuery } from "@/components/MaterialsClient";

type ApiPayload = {
  initialMaterials: unknown[];
  categoryOptions: { name: string }[];
  materialNames: string[];
  locations: string[];
  listTruncated: boolean;
  materialsTotalCount: number;
};

function LoadingSkeleton() {
  return (
    <div className="p-8 space-y-8 animate-pulse">
      <div className="h-10 w-72 rounded-lg bg-slate-800" />
      <div className="h-14 rounded-2xl border border-slate-800 bg-slate-900/50" />
      <div className="min-h-[320px] rounded-2xl border border-slate-800 bg-slate-900/50" />
      <p className="text-center text-sm text-slate-500">Carregando materiais…</p>
    </div>
  );
}

export default function MaterialsPageLoader({
  urlQuery,
  urlQueryKey,
}: {
  urlQuery: MaterialsUrlQuery;
  urlQueryKey: string;
}) {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [data, setData] = useState<ApiPayload | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setState("loading");
    setErrorMsg("");
    setData(null);

    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(urlQuery)) {
      if (v != null && String(v).length > 0) sp.set(k, String(v));
    }

    fetch(`/api/materials-page?${sp.toString()}`, {
      credentials: "same-origin",
      signal: ctrl.signal,
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { error?: string } & Partial<ApiPayload>;
        if (!r.ok) {
          throw new Error(j.error || `Falha ao carregar (${r.status})`);
        }
        setData({
          initialMaterials: j.initialMaterials ?? [],
          categoryOptions: j.categoryOptions ?? [],
          materialNames: j.materialNames ?? [],
          locations: j.locations ?? [],
          listTruncated: j.listTruncated ?? false,
          materialsTotalCount: j.materialsTotalCount ?? 0,
        });
        setState("ready");
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        console.error("[materials-page] client fetch", e);
        setErrorMsg(e.message || "Erro desconhecido");
        setState("error");
      });

    return () => ctrl.abort();
  }, [urlQueryKey]);

  if (state === "loading" || (state === "ready" && !data)) {
    return <LoadingSkeleton />;
  }

  if (state === "error") {
    return (
      <div className="p-8 max-w-2xl space-y-4 text-slate-200">
        <h1 className="text-xl font-bold text-red-400">Erro ao carregar materiais</h1>
        <p className="text-xs text-slate-500">
          Verifique os Runtime Logs da Vercel com o prefixo{" "}
          <code className="text-amber-200/90">[materials-page]</code> no mesmo horário do acesso.
        </p>
        <pre className="rounded-lg bg-slate-900 border border-slate-800 p-4 text-xs overflow-auto text-amber-200/90 whitespace-pre-wrap">
          {errorMsg}
        </pre>
      </div>
    );
  }

  return (
    <MaterialsClient
      key={urlQueryKey}
      initialMaterials={data!.initialMaterials as any[]}
      categoryOptions={data!.categoryOptions}
      materialNames={data!.materialNames}
      locations={data!.locations}
      urlQuery={urlQuery}
      listTruncated={data!.listTruncated}
      materialsTotalCount={data!.materialsTotalCount}
    />
  );
}
