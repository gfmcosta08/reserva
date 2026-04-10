import MaterialsPageLoader from "@/components/MaterialsPageLoader";

export const dynamic = "force-dynamic";

type RawSearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined> | undefined>
  | undefined;

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams?: RawSearchParams;
}) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};

  const urlQuery = {
    search: firstParam(resolvedSearchParams.search),
    name: firstParam(resolvedSearchParams.name),
    reservation_id: firstParam(resolvedSearchParams.reservation_id),
    category: firstParam(resolvedSearchParams.category),
    status: firstParam(resolvedSearchParams.status),
  };

  const urlQueryKey = JSON.stringify(urlQuery);

  return <MaterialsPageLoader urlQuery={urlQuery} urlQueryKey={urlQueryKey} />;
}
