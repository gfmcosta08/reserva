/** Pendências de cadastro exibidas em Pessoas e Nova Cautela. */

export type PersonRegistrationFields = {
  rg_front_url?: string | null
  rg_back_url?: string | null
  face_descriptor?: number[] | null
}

export function personMissingRgPhotos(person: PersonRegistrationFields): boolean {
  return !person.rg_front_url || !person.rg_back_url
}

export function personMissingFace(person: PersonRegistrationFields): boolean {
  return !person.face_descriptor || !Array.isArray(person.face_descriptor) || person.face_descriptor.length === 0
}

export function personHasRegistrationPending(person: PersonRegistrationFields): boolean {
  return personMissingRgPhotos(person) || personMissingFace(person)
}

export function personRegistrationComplete(person: PersonRegistrationFields): boolean {
  return !personHasRegistrationPending(person)
}
