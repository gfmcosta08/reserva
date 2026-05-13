/**
 * WhatsApp integration via uazapi.dev
 * Graceful: if UAZAPI_URL is not configured, logs a warning and returns without throwing.
 */

function formatPhone(raw: string): string {
  // Strip all non-digit characters
  const digits = raw.replace(/\D/g, '')

  // If it doesn't already start with 55 (Brazil country code), prepend it
  if (!digits.startsWith('55')) {
    return `55${digits}`
  }

  return digits
}

/**
 * Sends a WhatsApp text message via uazapi.dev.
 * Returns true on success, false on any failure — never throws.
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const baseUrl = process.env.UAZAPI_URL
  const token = process.env.UAZAPI_TOKEN

  if (!baseUrl) {
    console.warn('[whatsapp] UAZAPI_URL is not set — skipping WhatsApp message.')
    return false
  }

  if (!token) {
    console.warn('[whatsapp] UAZAPI_TOKEN is not set — skipping WhatsApp message.')
    return false
  }

  const formattedPhone = formatPhone(phone)

  try {
    const url = `${baseUrl.replace(/\/$/, '')}/message/sendText`

    const body: Record<string, string> = {
      phone: formattedPhone,
      message,
    }

    // Some uazapi configurations require an instance/session field
    const instance = process.env.UAZAPI_INSTANCE
    if (instance) {
      body.instance = instance
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error(`[whatsapp] API error ${response.status}: ${text}`)
      return false
    }

    return true
  } catch (err) {
    console.error('[whatsapp] Failed to send message:', err)
    return false
  }
}

export interface CautelaSummaryParams {
  phone: string
  personName: string
  type: string
  date: string
  items: Array<{ name: string; quantity_delivered: number }>
  operatorName: string
}

/**
 * Sends a cautela summary message via WhatsApp to the person's phone.
 */
export async function sendCautelaSummary(params: CautelaSummaryParams): Promise<void> {
  const { phone, personName, type, date, items, operatorName } = params

  const typeLabel = type === 'permanent' ? 'Permanente' : 'Diária'

  const itemsList = items
    .map((item) => `  • ${item.name} (x${item.quantity_delivered})`)
    .join('\n')

  const message =
    `✅ *Cautela Registrada*\n\n` +
    `👤 *${personName}*\n` +
    `📋 Tipo: ${typeLabel}\n` +
    `📅 Data: ${date}\n\n` +
    `*Materiais:*\n${itemsList}\n\n` +
    `🔐 Operador: ${operatorName}`

  await sendWhatsAppMessage(phone, message)
}

/**
 * Sends a simple alert message via WhatsApp.
 */
export async function sendAlertMessage(phone: string, alertText: string): Promise<void> {
  await sendWhatsAppMessage(phone, alertText)
}
