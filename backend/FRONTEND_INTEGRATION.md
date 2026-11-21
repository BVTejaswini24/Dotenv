# Frontend Integration Guide (Member 1)

How to connect the existing Next.js 14 frontend to this backend **without**
rebuilding it. The Redux slices, components and pages stay; only the data source
changes (static imports → API calls) plus real auth/cart/checkout wiring.

---

## 0. Run both apps

```bash
# terminal 1
cd backend && npm run dev        # http://localhost:4000

# terminal 2 (repo root)
npm run dev                      # http://localhost:3000
```

Backend `.env` must have `CORS_ORIGIN=http://localhost:3000` (default) so
cookie-authenticated requests work.

Frontend env (`.env.local` at the repo root):

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## 1. One fetch helper with cookies

Auth and carts are cookie-based, so every request must include credentials:

```ts
// src/lib/api/client.ts
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const error = body?.error ?? { code: "UNKNOWN", message: "Request failed" };
    throw Object.assign(new Error(error.message), { code: error.code, details: error.details, status: res.status });
  }
  return body as T;
}
```

Never send `credentials: "include"` only on some calls — auth, cart and orders
all depend on it. No token is stored in localStorage; the cookie is HttpOnly.

## 2. Products: replace the static import

Today: `import { products } from "@/lib/data/products"` (38 items, IDs 1–8, 12–41).

```ts
// src/lib/api/products.ts
import { api } from "./client";
import type { Product } from "@/types/product.types";

export type ProductListResponse = {
  data: Product[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
};

export const getProducts = (params: Record<string, string | number | undefined> = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && qs.set(k, String(v)));
  const query = qs.toString();
  return api<ProductListResponse>(`/products${query ? `?${query}` : ""}`);
};

export const getProduct = (idOrSlug: string | number) =>
  api<{ data: Product }>(`/products/${idOrSlug}`).then((r) => r.data);

export const getCategories = () =>
  api<{ data: Array<{ id: number; name: string; slug: string; productCount: number }> }>("/categories").then((r) => r.data);
```

The product JSON is a **superset** of `Product` (see API_DOCUMENTATION.md), so
existing components keep working. Notes:

- `id` is still the numeric catalogue id, so `/shop/product/[id]/[slug]` links
  and Redux keys do not change.
- `category` is still the slug; `categoryName` is new and optional.
- `discount` keeps `{ amount, percentage }` in major units, so price rendering
  (`$${price - discount.amount}`) is unchanged.
- `variants[]` now has real entries. `variants[].id` (UUID) is what the cart API
  expects. `variants[].stock` is the per-variant truth; `product.stock` is the
  maximum, which fits the current UI cap.

Because the backend paginates (default 12), pages that currently render all 38
products should either pass `limit=100` or add pagination/`useInfiniteQuery`.

Search: keep the existing client-side filtering for now. `GET /api/products?q=`
is a temporary server-side `ILIKE` fallback; OpenSearch will replace it via
`GET /api/search` later (do not build it yourself).

## 3. Auth: replace the localStorage/Redux-only flow

The current `authSlice` keeps `registeredUsers` + `passwordHash` in Redux
Persist. That must not be the source of truth.

- On register: `POST /auth/register` with `{ firstName, lastName, email, password, phone? }`.
- On login: `POST /auth/login` with `{ email, password }`.
- On app load: `GET /auth/me`; if 200, hydrate `state.auth.user` and
  `isAuthenticated: true`; if 401, dispatch `logout`.
- On logout: `POST /auth/logout` (clears the cookie), then dispatch `logout`.

```ts
const { data } = await api<{ data: { user: User } }>("/auth/me", { method: "GET" });
dispatch(setUser(data.user));
```

Suggested changes to `authSlice`: remove `registeredUsers` and `passwordHash`
from state, add `setUser`/`clearUser`. Do **not** persist the user across reloads
as proof of auth — call `/auth/me` instead.

## 4. Cart: sync Redux with the server

`cartsSlice` currently stores `CartItem[]` with `id` (product id) + `attributes: string[]`.
The API returns items with the same `id`/`attributes` conventions, plus
`variantId`, `unitPrice` and a server-calculated `totals` object.

Mapping (`src/lib/api/cart.ts`):

```ts
export type ApiCartItem = {
  id: string;               // cart item UUID (use for PATCH/DELETE)
  productId: number;        // frontend product id
  variantId: string;        // use for POST /cart/items
  name: string;
  srcUrl: string;
  price: number;            // base price (same as Product.price)
  discount: { amount: number; percentage: number };
  quantity: number;
  attributes: string[];     // [size, color]
  size: string;
  color: string;
  stock: number;
  unitPrice: number;        // price actually charged
  lineTotal: number;
};

export type ApiCart = {
  cartId: string;
  currency: string;
  items: ApiCartItem[];
  totals: { subtotal: number; discount: number; total: number; itemCount: number; totalQuantity: number };
};
```

Replace the Redux-only `addToCart`/`remove` with API calls and hydrate the slice
from the response:

```ts
// add
const { data } = await api<{ data: ApiCart }>("/cart/items", {
  method: "POST",
  body: JSON.stringify({ variantId, quantity }),
});

// change quantity (itemId is ApiCartItem.id)
await api(`/cart/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ quantity }) });

// remove
await api(`/cart/items/${itemId}`, { method: "DELETE" });

// load
const { data } = await api<{ data: ApiCart }>("/cart");
```

Keep the Redux slice as the UI cache, but recompute `totalPrice` from
`totals` — never from locally recomputed prices. A `409 INSUFFICIENT_STOCK`
should show the `details.available` value in the toast and refresh the cart.

Guest carts work automatically: the backend sets a `shopsphere_cart` cookie on
the first add. Note that a guest cart is **not** merged into the account cart on
login yet (known gap); re-add items or merge client-side for now.

## 5. Checkout: real order placement

The `CheckoutForm` shape in `src/components/checkout-page/checkout.types.ts`
maps almost 1:1:

```ts
const orderBody = {
  shippingAddress: form.shipping,               // firstName, lastName, address, apartment, city, state, pinCode, country
  contact: form.contact,                        // email, phone
  deliveryMethod: form.delivery,                // "standard" | "express"
  paymentMethod: form.paymentMethod,            // "card" | "upi" | "cod"
  notes: form.shipping.apartment ? `Apt: ${form.shipping.apartment}` : undefined,
};

const res = await api<{ data: OrderResponse; meta: { idempotentReplay: boolean } }>("/orders", {
  method: "POST",
  headers: { "Idempotency-Key": crypto.randomUUID() },  // required, one per checkout attempt
  body: JSON.stringify(orderBody),
});
```

Important behaviour differences from today's client-side checkout:

- The **server** prices the order from the database. Signup/promo discounts
  (`calculateOrderTotal`) are not applied server-side yet, so the confirmation
  total may differ from the locally previewed total. Move promo rules to the
  backend before the demo, or display "discount calculated at checkout".
- `express` adds $15 server-side (mirrors `DELIVERY_OPTIONS`).
- Stock is reserved atomically; on `409 INSUFFICIENT_STOCK` show the message and
  refresh the cart — the order was not created.
- Generate the `Idempotency-Key` once when the user clicks "Place order" and
  reuse it if the request is retried (prevents double orders on flaky networks).
- After success: dispatch `clearCart()`, then add the returned order to
  `ordersSlice`.

## 6. Order history

`ordersSlice` currently stores client-created orders. Replace `addOrder` usage on
page load with:

```ts
const { data } = await api<{ data: OrderResponse[] }>("/orders?page=1&limit=20");
```

`OrderResponse` (see API_DOCUMENTATION.md) contains `orderNumber`, `items`,
`subtotal`, `discount`, `deliveryFee`, `total`, `deliveryMethod`, `paymentMethod`,
`createdAt`, `status`, `shippingAddress`, `contact`. Map `status` to the existing
`OrderStatus` union (`confirmed` → confirmed, etc.); the backend can later emit
`processing`/`shipped`/`delivered`.

## 7. Things to keep out of the frontend

- No password hashes, no `registeredUsers` in Redux Persist.
- No JWT/token in localStorage — the cookie handles it.
- No price/discount/total math trusted by the backend; displays are fine, but
  the server recalculates everything on cart/order.
- No direct Kafka/OpenSearch calls; those live behind Member 3's endpoints.

## 8. Suggested order of work

1. `api()` helper + `NEXT_PUBLIC_API_URL` + CORS check.
2. `/shop` and product detail pages → `getProducts` / `getProduct` (keep filters client-side, pass `limit=100`).
3. Categories → `getCategories`.
4. Auth pages → register/login/me/logout; remove passwordHash from Redux.
5. Product detail "Add to cart" → `variantId` from `variants[]`; cart page → API.
6. Checkout → `POST /orders` with `Idempotency-Key`; clear cart on success.
7. Order history page → `GET /orders`.
