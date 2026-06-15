"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { logAudit } from "./audit"
import { requireCautelaOperator } from "@/lib/auth-cautela"
import {
  PIN_CHANGE_REQUIRED_MESSAGE,
  personRequiresPinChange,
} from "@/lib/person-pin-policy"
import {
  formatUnavailableMaterialsMessage,
  mergeCautelaItems,
  validateCautelaModifiable,
  type TransferOriginCautela,
  type TransferOriginItem,
} from "@/lib/cautela-helpers"
import {
  createCautelaFaceAuthInputSchema,
  createCautelaInputSchema,
  createCautelaWithTransferInputSchema,
  createCautelaWithTransferFaceAuthInputSchema,
  processBulkDevolutionInputSchema,
  uuidSchema,
} from "@/lib/cautela-schemas"
import { sendCautelaSummary } from "@/lib/whatsapp"
import {
  computeCautelaStatus,
  itemBalance,
  itemIsFullyReturned,
  itemNeedsReturn,
  qtyDelivered,
  qtyReturned,
  resolveItemStatusAfterReturn,
} from "@/lib/cautela-return-status"
import { generateCautelaPDF } from "@/lib/pdf-cautela"
import { extractCaliber } from "@/lib/cautela-caliber"
import {
  packAccessoryAvailabilityFilter,
  pickPackAccessoryForWeapon,
  type PackAccessoryCandidate,
  buildPackAccessoryPool,
  fetchReservablePackAccessories,
} from "@/lib/cautela-pack-accessories"
import { filterReservableMaterials } from "@/lib/cautela-reservable"
import { tagCautelaFlow } from "@/lib/sentry-flow"
import {
  countPoolChargersByStatus,
  isGlock9mmCharger,
  isGlock9mmPistol,
} from "@/lib/glock-9mm-inventory"
import {
  canReserveStock,
  effectiveStock,
  formatInsufficientStockMessage,
  resolveStockUnits,
} from "@/lib/material-stock"
import { sanitizeIlikeFragment } from "@/lib/search-sanitize"
import { Resend } from "resend"
