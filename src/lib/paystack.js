/**
 * Paystack inline payment helper.
 * Loads the Paystack popup and returns a promise that resolves
 * with the transaction reference on success.
 */

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY

function loadScript() {
  return new Promise((resolve) => {
    if (window.PaystackPop) return resolve()
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = resolve
    document.head.appendChild(script)
  })
}

/**
 * @param {object} opts
 * @param {string}  opts.email        - customer email (required by Paystack)
 * @param {number}  opts.amount       - amount in GHS (we convert to pesewas)
 * @param {string}  opts.phone        - customer phone
 * @param {string}  opts.bundleLabel  - e.g. "MTN 5GB Bundle"
 * @param {string}  [opts.storeId]    - store UUID (storefront only)
 * @param {Array}   [opts.items]      - cart items for the webhook safety net (storefront only)
 * @returns {Promise<{ reference: string }>}
 */
export async function openPaystackPopup({ email, amount, phone, bundleLabel, storeId = null, items = null }) {
  await loadScript()

  return new Promise((resolve, reject) => {
    const handler = window.PaystackPop.setup({
      key:       PAYSTACK_PUBLIC_KEY,
      email:     email || `${phone.replace(/\s/g, '')}@qwikhub.com`,
      amount:    Math.round(amount * 100), // pesewas
      currency:  'GHS',
      ref:       `QH-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      metadata: {
        custom_fields: [
          { display_name: 'Phone', variable_name: 'phone', value: phone },
          { display_name: 'Bundle', variable_name: 'bundle', value: bundleLabel },
        ],
        // Embedded so the Paystack webhook can complete the order server-side
        // if the customer's browser dies before complete-store-order fires.
        ...(storeId && items ? { qwikhub: { store_id: storeId, items } } : {}),
      },
      callback: (response) => resolve({ reference: response.reference }),
      onClose:  () => reject(new Error('Payment cancelled')),
    })
    handler.openIframe()
  })
}
