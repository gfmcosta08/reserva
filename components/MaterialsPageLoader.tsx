"use client";

import { useEffect, useState } from "react";
import { getMaterialsPagePayload } from "@/app/actions/materials-page";
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
    let cancelled = false;
    setState("loading");
    setErrorMsg("");
    setData(null);

    const filters = {
      search: urlQuery.search,
      name: urlQuery.name,
      reservation_id: urlQuery.reservation_id,
      category: urlQuery.category,
      status: urlQuery.status,
      marca: urlQuery.marca,
      modelo: urlQuery.modelo,
      calibre: urlQuery.calibre,
    };

    getMaterialsPagePayload(filters)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setData(result.data);
          setState("ready");
        } else {
          setErrorMsg("error" in result ? result.error : "Erro ao carregar materiais");
          setState("error");
        }
      })
      .catch((e: Error) => {
        if (cancelled) return;
        console.error("[materials-page] getMaterialsPagePayload", e);
        setErrorMsg(e.message || "Erro desconhecido");
        setState("error");
      });

    return () => {
      cancelled = true;
    };
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
