import nextDynamic from "next/dynamic";
import { loadMaterialsPageData } from "@/lib/materials-page-data";

export const dynamic = "force-dynamic";

const MaterialsClient = nextDynamic(() => import("@/components/MaterialsClient"), {
  ssr: false,
  loading: () => (
    <div className="p-8 space-y-8 animate-pulse">
      <div className="h-10 w-72 rounded-lg bg-slate-800" />
      <div className="h-14 rounded-2xl border border-slate-800 bg-slate-900/50" />
      <div className="min-h-[320px] rounded-2xl border border-slate-800 bg-slate-900/50" />
      <p className="text-center text-sm text-slate-500">Carregando materiais…</p>
    </div>
  ),
});

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  ) as T
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { search?: string; category?: string; status?: string; name?: string; reservation_id?: string };
}) {
  let payload: Awaited<ReturnType<typeof loadMaterialsPageData>>;
  try {
    payload = await loadMaterialsPageData(searchParams);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[materials/page] loadMaterialsPageData", e);
    return (
      <div className="p-8 max-w-2xl space-y-4 text-slate-200">
        <h1 className="text-xl font-bold text-red-400">Erro ao carregar materiais</h1>
        <p className="text-sm text-slate-400">
          Detalhe técnico (útil para suporte / logs da Vercel):
        </p>
        <pre className="rounded-lg bg-slate-900 border border-slate-800 p-4 text-xs overflow-auto text-amber-200/90">
          {msg}
        </pre>
      </div>
    );
  }

  const urlQuery = {
    search: searchParams.search,
    name: searchParams.name,
    reservation_id: searchParams.reservation_id,
    category: searchParams.category,
    status: searchParams.status,
  };

  const urlQueryKey = JSON.stringify(urlQuery);

  return (
    <MaterialsClient
      key={urlQueryKey}
      initialMaterials={toJsonSafe(payload.materials)}
      categoryOptions={toJsonSafe(payload.categoryOptions)}
      materialNames={payload.materialNames}
      locations={payload.locations}
      urlQuery={urlQuery}
    />
  );
}
