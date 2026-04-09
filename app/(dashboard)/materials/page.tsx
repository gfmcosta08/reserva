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

function errorBlock(title: string, msg: string, code?: string) {
  console.error("[materials-page]", code ?? "fatal", msg);
  return (
    <div className="p-8 max-w-2xl space-y-4 text-slate-200">
      <h1 className="text-xl font-bold text-red-400">{title}</h1>
      <p className="text-xs text-slate-500">
        Busque por <code className="text-amber-200/90">[materials-page]</code> nos Runtime Logs da Vercel no mesmo horário do acesso.
      </p>
      <pre className="rounded-lg bg-slate-900 border border-slate-800 p-4 text-xs overflow-auto text-amber-200/90 whitespace-pre-wrap">
        {msg}
      </pre>
    </div>
  );
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
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[materials-page] loadMaterialsPageData threw", { message: msg, stack });
    return errorBlock("Erro ao carregar materiais", stack ? `${msg}\n\n${stack}` : msg, "loadMaterialsPageData");
  }

  const urlQuery = {
    search: searchParams.search,
    name: searchParams.name,
    reservation_id: searchParams.reservation_id,
    category: searchParams.category,
    status: searchParams.status,
  };

  const urlQueryKey = JSON.stringify(urlQuery);

  let safeMaterials: typeof payload.materials;
  let safeCategoryOptions: typeof payload.categoryOptions;
  try {
    safeMaterials = toJsonSafe(payload.materials);
    safeCategoryOptions = toJsonSafe(payload.categoryOptions);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[materials-page] toJsonSafe failed (serialize props)", {
      message: msg,
      stack,
      materialsLength: payload.materials?.length,
    });
    return errorBlock(
      "Erro ao preparar a lista de materiais",
      `Falha ao serializar dados para o navegador (JSON). Isso costuma indicar dado inesperado vindo do banco ou payload muito grande.\n\n${msg}${stack ? `\n\n${stack}` : ""}`,
      "toJsonSafe"
    );
  }

  return (
    <MaterialsClient
      key={urlQueryKey}
      initialMaterials={safeMaterials}
      categoryOptions={safeCategoryOptions}
      materialNames={payload.materialNames}
      locations={payload.locations}
      urlQuery={urlQuery}
      listTruncated={payload.listTruncated}
      materialsTotalCount={payload.materialsTotalCount}
    />
  );
}
