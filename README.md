# FarmFLAX website

A fast, low-cost online store. Static pages hosted free on Cloudflare Pages, with a small order service
(Cloudflare Pages Functions) that checks prices, saves orders and alerts the team on WhatsApp.

```
farmflax-site/
├── public/                     ← everything visitors see
│   ├── index.html              home and shop
│   ├── product.html            one product (product.html?p=almond)
│   ├── cart.html, checkout.html, order-status.html
│   ├── policies/               shipping, refunds, privacy, terms, contact
│   ├── assets/js/config.js     ← WhatsApp number, shipping rules, on/off switches
│   ├── assets/img/logo.svg     ← replace with the final logo (same file name)
│   └── products/
│       ├── products.csv        ← names, prices, stock, descriptions
│       └── images/<product-id>/1.jpg, 2.jpg …
└── functions/                  ← order service (runs on Cloudflare, not in the browser)
```

## Everyday changes

**Change a product photo:** put the new photo in `public/products/images/<product-id>/` with the same
file name (for example `1.jpg`) and upload it. The site shows it within about 5 minutes.
Use square photos, about 1200 × 1200 px, under 300 KB.

**Add a photo:** add `3.jpg` to the folder and add it to the `images` column in `products.csv`: `1.jpg|2.jpg|3.jpg`.

**Change a price, name or stock:** edit `public/products/products.csv` (it opens in Excel; save as CSV).
Set `in_stock` to `no` to show "Out of stock".

**Add a product:** add a row to `products.csv` with a new `id` (lowercase, dashes, no spaces) and create
`public/products/images/<that-id>/` with its photos.

You can do all of this in the browser on GitHub: open the folder, click **Add file → Upload files**, then **Commit changes**.
Cloudflare publishes the change automatically.

## Before going live

1. In `public/assets/js/config.js`, fill in email, legal name, address, GSTIN and FSSAI number, and set `preview: false`.
2. Replace the sample prices in `products.csv` and the placeholder photos.
3. Have your CA review the pages in `public/policies/` and fill in the `[ ]` placeholders.
4. Replace `public/assets/img/logo.svg` with the final logo.

## Hosting on Cloudflare Pages (one-time)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → choose this repository.
2. Build settings: Framework preset **None**, build command **empty**, build output directory **`public`**.
3. Deploy. Then **Custom domains** → add your domain.
4. Optional but recommended: **Storage → KV → Create namespace** `farmflax-orders`, then in the Pages project
   **Settings → Bindings → KV namespace**, variable name **`ORDERS`**. Every order is then saved.

## WhatsApp order alerts

How it works today, with no setup: after checkout the customer taps **Send order on WhatsApp** and the full
order arrives on the company number as a ready-made message.

Automatic alerts to the team (sent by the server the moment an order is placed) need the WhatsApp Cloud API:

1. Create a Meta Business account and a WhatsApp Business app at developers.facebook.com.
2. Add the company number. Check Meta's current rules for using the same number in the WhatsApp Business app and the API.
3. Create a message template named `new_order_alert`, category **Utility**, language **English**, with this body:
   `New FarmFLAX order {{1}}. Amount {{2}}. Items: {{3}}. Customer: {{4}}. Deliver to: {{5}}. Payment: {{6}}.`
4. In the Pages project → **Settings → Variables and Secrets**, add:
   - `WA_TOKEN` (secret) — permanent access token
   - `WA_PHONE_NUMBER_ID` — from the WhatsApp app settings
   - `ALERT_NUMBERS` — team numbers with country code, comma separated, e.g. `91XXXXXXXXXX,91YYYYYYYYYY`

Meta charges a small fee per template message; check current WhatsApp pricing for India.

## Online payment (HDFC)

The checkout is ready for online payment, but the HDFC integration is not written yet because it needs HDFC's
integration kit. When HDFC shares the API keys, test credentials and documentation:

1. Fill in `functions/_lib/payment.js` (`createPaymentSession` and `verifyPayment`) following HDFC's document.
2. Add `PAYMENT_PROVIDER` and `PAYMENT_API_KEY` (and any other keys HDFC gives) as Cloudflare secrets.
3. Set `onlinePayment: true` in `config.js`.

HDFC will usually ask to see the live website with the policy pages before activating the gateway.

## Cash on delivery

Off by default. To turn it on: set `cod: true` in `config.js` and add the variable `COD_ENABLED` = `true` in Cloudflare.

## Run it on your computer

Needs Node.js. From this folder: `npx wrangler pages dev public` then open http://localhost:8788
