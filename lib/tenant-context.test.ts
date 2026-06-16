import { describe, expect, it } from "vitest"
import { withTenantScope } from "./tenant-context"

describe("tenant-context", () => {
  it("withTenantScope injeta organization_id e unit_id", () => {
    const out = withTenantScope({ name: "Test" }, {
      organizationId: "org-1",
      unitId: "unit-1",
      reservaId: "res-1",
      role: "operator",
    })
    expect(out).toEqual({
      name: "Test",
      organization_id: "org-1",
      unit_id: "unit-1",
      reserva_id: "res-1",
    })
  })
})
