import bcrypt from "bcryptjs"

/** PIN temporário usado no import de cautelados (trocar no balcão). */
export const DEFAULT_TEMP_PIN = "0000"

export const PIN_CHANGE_REQUIRED_MESSAGE =
  "Esta pessoa precisa trocar o PIN no balcão antes de receber material. Use Regularizar cadastro."

export async function personRequiresPinChange(person: {
  pin_hash: string
  must_change_pin?: boolean | null
}): Promise<boolean> {
  if (person.must_change_pin === true) return true
  return bcrypt.compare(DEFAULT_TEMP_PIN, person.pin_hash)
}
