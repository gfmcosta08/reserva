import { describe, expect, it } from "vitest"
import bcrypt from "bcryptjs"
import { personRequiresPinChange } from "./person-pin-policy"

describe("personRequiresPinChange", () => {
  it("bloqueia quando must_change_pin é true", async () => {
    const pin_hash = await bcrypt.hash("5678", 10)
    expect(await personRequiresPinChange({ pin_hash, must_change_pin: true })).toBe(true)
  })

  it("bloqueia quando PIN ainda é 0000", async () => {
    const pin_hash = await bcrypt.hash("0000", 10)
    expect(await personRequiresPinChange({ pin_hash, must_change_pin: false })).toBe(true)
  })

  it("permite quando PIN personalizado e flag false", async () => {
    const pin_hash = await bcrypt.hash("5678", 10)
    expect(await personRequiresPinChange({ pin_hash, must_change_pin: false })).toBe(false)
  })
})
