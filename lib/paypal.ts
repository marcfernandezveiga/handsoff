// Finance agent: create PayPal sandbox invoices via REST API (plain fetch, no SDK).
// Falls back to a simulated success if PAYPAL_CLIENT_ID / PAYPAL_SECRET are absent.

const PAYPAL_BASE = "https://api-m.sandbox.paypal.com";

const hasPayPal =
  !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_SECRET;

export interface PayPalResult {
  success: boolean;
  invoiceId: string;
  invoiceUrl?: string;
  simulated: boolean;
}

/** Exchange client credentials for an OAuth2 access token. */
async function getAccessToken(): Promise<string> {
  const creds = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
  ).toString("base64");

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal token error ${res.status}: ${text}`);
  }

  const json = await res.json();
  return json.access_token as string;
}

/**
 * Create a PayPal sandbox invoice for a completed job.
 * If PayPal env vars are absent, simulate success (keeps demo running).
 */
export async function createInvoice(params: {
  jobTitle: string;
  feeCents: number;
}): Promise<PayPalResult> {
  if (!hasPayPal) {
    const simulatedId = `SIM-INV-${Date.now()}`;
    console.info(
      "[paypal] No credentials — simulating invoice:",
      simulatedId
    );
    return {
      success: true,
      invoiceId: simulatedId,
      invoiceUrl: undefined,
      simulated: true,
    };
  }

  try {
    const token = await getAccessToken();

    const invoicePayload = {
      detail: {
        invoice_date: new Date().toISOString().split("T")[0],
        currency_code: "USD",
        note: "AI-generated deliverable via Hands Off autonomous agent.",
        payment_term: { term_type: "DUE_ON_RECEIPT" },
      },
      invoicer: {
        name: { given_name: "Hands", surname: "Off" },
        email_address: "handsoff-demo@example.com",
      },
      items: [
        {
          name: params.jobTitle.slice(0, 100),
          quantity: "1",
          unit_amount: {
            currency_code: "USD",
            value: (params.feeCents / 100).toFixed(2),
          },
          unit_of_measure: "AMOUNT",
        },
      ],
    };

    const createRes = await fetch(`${PAYPAL_BASE}/v2/invoicing/invoices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`PayPal create invoice ${createRes.status}: ${errText}`);
    }

    const created = await createRes.json();
    const invoiceId: string = created.id ?? `PP-INV-${Date.now()}`;

    // Optionally send (activates the invoice); ignore failures
    try {
      await fetch(
        `${PAYPAL_BASE}/v2/invoicing/invoices/${invoiceId}/send`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ send_to_invoicer: true }),
        }
      );
    } catch {
      // Sending is best-effort — invoice creation is the important step
    }

    const invoiceUrl = `https://www.sandbox.paypal.com/invoice/p/#${invoiceId}`;

    return { success: true, invoiceId, invoiceUrl, simulated: false };
  } catch (err) {
    console.warn("[paypal] invoice creation failed:", err);
    // Fail-open: simulate so the demo never hard-crashes
    return {
      success: true,
      invoiceId: `SIM-ERR-${Date.now()}`,
      simulated: true,
    };
  }
}
