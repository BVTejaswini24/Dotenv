# ShopSphere API Documentation

Base URL (local): `http://localhost:4000/api`

All responses are JSON. Successful responses use `{ "data": … }` (plus
`pagination` for lists). Errors always use:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for one or more items",
    "details": { "items": [{ "variantId": "…", "requested": 2, "available": 1 }] }
  }
}
```

## Conventions

- **Money:** all `price`, `total`, `discount.amount` fields are major units
  (e.g. `120` = `$120`). The database stores integer minor units.
- **Auth:** session cookie `shopsphere_session` (HttpOnly, SameSite=Lax). Send
  requests with `credentials: "include"` from the browser. `Authorization: Bearer <token>`
  is also accepted for tools/tests.
- **Guest carts:** `shopsphere_cart` cookie; set automatically on the first cart write.
- **Product id:** `id` is the frontend's numeric catalogue id (1–8, 12–41).
  `variants[].id` is the UUID used for cart/order calls.
- **Status codes:** 200 OK, 201 Created, 204 No Content, 400 validation,
  401 not signed in, 404 not found/not yours, 409 conflict (stock/duplicate),
  429 rate limited, 500 unexpected.

---

## GET /api/health

```json
{
  "status": "ok",
  "service": "shopsphere-backend",
  "database": "connected",
  "databaseLatencyMs": 3,
  "uptimeSeconds": 42,
  "timestamp": "2026-11-21T12:00:00.000Z"
}
```

Returns `503` with `"database": "unavailable"` when PostgreSQL cannot be reached.

---

## GET /api/products

Query parameters (all optional):

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | int ≥ 1 | 1 | |
| `limit` | int 1–100 | 12 | |
| `category` | string | – | category **slug** (`t-shirts`, `jeans`, …) |
| `gender` | `men\|women\|kids\|unisex` | – | |
| `minPrice` / `maxPrice` | number | – | major units, inclusive |
| `sort` | `relevance\|price_asc\|price_desc\|rating\|newest\|title` | `relevance` | |
| `q` | string (≤100) | – | temporary `ILIKE` search fallback |
| `featured` | `true` | – | only featured products |
| `onSale` | `true` | – | only products on sale |

```json
{
  "data": [
    {
      "id": 1,
      "slug": "t-shirt-with-tape-details",
      "title": "T-shirt with Tape Details",
      "description": "This graphic t-shirt …",
      "brand": "LUXE",
      "category": "t-shirts",
      "categoryName": "T-Shirts",
      "subcategory": "casual",
      "gender": "unisex",
      "srcUrl": "/images/product-1.jpg",
      "thumbnail": "/images/product-1.jpg",
      "gallery": ["/images/product-1.jpg"],
      "price": 120,
      "originalPrice": 120,
      "discount": { "amount": 0, "percentage": 0 },
      "rating": 4.5,
      "reviewCount": 45,
      "sizes": [{ "id": "s", "name": "Small", "label": "S" }],
      "colors": [{ "id": "brown", "name": "Brown", "code": "bg-[#4F4631]", "hex": "#4F4631" }],
      "variants": [
        {
          "id": "6f1c1f43-…",
          "sku": "LX-TS-001-S-BROWN",
          "size": "S",
          "color": "Brown",
          "colorCode": "#4F4631",
          "price": 120,
          "stock": 20,
          "image": "/images/product-1.jpg"
        }
      ],
      "material": "100% Cotton",
      "careInstructions": "Machine wash warm, tumble dry",
      "fit": "Classic Fit",
      "pattern": "Solid",
      "style": "Casual",
      "tags": ["t-shirt", "tape details", "casual"],
      "isNew": true,
      "isFeatured": true,
      "isBestSeller": false,
      "isOnSale": false,
      "stock": 20,
      "sku": "LX-TS-001",
      "createdAt": "2023-08-14T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1, "limit": 12, "total": 38,
    "totalPages": 4, "hasNextPage": true, "hasPrevPage": false
  }
}
```

Notes:

- This object is a superset of the frontend `Product` type. `category` is the
  slug (same as today's static data); `categoryName` is new.
- `stock` = largest per-variant stock (what the UI caps quantity at).
  Per-variant truth is `variants[].stock`.
- Missing optional fields are omitted, matching the frontend's optional props.

Errors: `400 VALIDATION_ERROR` with `details.issues[]`.

---

## GET /api/products/:idOrSlug

`idOrSlug` accepts the numeric legacy id (`1`), the UUID, or the slug
(`t-shirt-with-tape-details`).

```json
{ "data": { "id": 2, "slug": "skinny-fit-jeans", "...": "same shape as above" } }
```

`404 PRODUCT_NOT_FOUND` when it does not exist.

---

## GET /api/categories

```json
{
  "data": [
    { "id": 1, "name": "T-Shirts", "slug": "t-shirts", "productCount": 6 },
    { "id": 2, "name": "Shirts", "slug": "shirts", "productCount": 4 }
  ]
}
```

Compatible with the frontend `Category` type plus `productCount`.

---

## POST /api/auth/register

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "email": "ada@example.com",
  "password": "Sup3rSecret!",
  "phone": "+91 9000000000"
}
```

`password` min 8 chars, `phone` optional. Response `201` and a
`shopsphere_session` cookie:

```json
{ "data": { "user": { "id": "uuid", "firstName": "Ada", "lastName": "Lovelace", "email": "ada@example.com", "phone": "+91 9000000000", "createdAt": "…" } } }
```

Errors: `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_REGISTERED`,
`429 RATE_LIMITED`.

---

## POST /api/auth/login

```json
{ "email": "ada@example.com", "password": "Sup3rSecret!" }
```

`200` with `{ "data": { "user": … } }` and the session cookie.
`401 INVALID_CREDENTIALS` for either a missing account or a wrong password.

---

## POST /api/auth/logout

`204 No Content`, clears the cookie.

---

## GET /api/auth/me

`200` → `{ "data": { "user": { … } } }`; `401 UNAUTHORIZED` when not signed in.
Use this on app load instead of trusting persisted client state.

---

## Cart

The cart is server-side. Totals are always calculated by the server from
current database prices. Guest carts are keyed by the `shopsphere_cart` cookie.

### GET /api/cart

```json
{
  "data": {
    "cartId": "uuid",
    "currency": "USD",
    "items": [
      {
        "id": "cart-item-uuid",
        "productId": 1,
        "variantId": "variant-uuid",
        "name": "T-shirt with Tape Details",
        "slug": "t-shirt-with-tape-details",
        "srcUrl": "/images/product-1.jpg",
        "price": 120,
        "discount": { "amount": 0, "percentage": 0 },
        "quantity": 2,
        "attributes": ["S", "Brown"],
        "size": "S",
        "color": "Brown",
        "sku": "LX-TS-001-S-BROWN",
        "stock": 20,
        "unitPrice": 120,
        "lineTotal": 240
      }
    ],
    "totals": {
      "subtotal": 240,
      "discount": 0,
      "total": 240,
      "itemCount": 1,
      "totalQuantity": 2
    }
  }
}
```

### POST /api/cart/items

```json
{ "variantId": "variant-uuid", "quantity": 2 }
```

or, when the UI only knows product + selected options:

```json
{ "productId": 1, "size": "S", "color": "Brown", "quantity": 2 }
```

`201` with the full cart shape above. Errors: `409 INSUFFICIENT_STOCK`
(`details.available`), `404 VARIANT_NOT_FOUND`, `400 VARIANT_AMBIGUOUS`
(product has several variants and no size/color was given).

### PATCH /api/cart/items/:itemId

```json
{ "quantity": 3 }
```

`200` with the updated cart. `409` if quantity exceeds stock.

### DELETE /api/cart/items/:itemId

`200` with the updated cart.

---

## POST /api/orders

Headers:

```
Idempotency-Key: <unique string, ≥ 8 chars, e.g. crypto.randomUUID()>
Content-Type: application/json
```

Body:

```json
{
  "shippingAddress": {
    "firstName": "Ada",
    "lastName": "Lovelace",
    "address": "1 Test Street",
    "apartment": "",
    "city": "Hyderabad",
    "state": "Telangana",
    "pinCode": "500001",
    "country": "India"
  },
  "contact": { "email": "ada@example.com", "phone": "+91 9000000000" },
  "deliveryMethod": "standard",
  "paymentMethod": "cod",
  "notes": "Leave at reception",
  "items": [{ "variantId": "variant-uuid", "quantity": 2 }]
}
```

- `items` is optional; when omitted the signed-in user's cart (or the guest
  cart cookie) is used. The cart is marked `checked_out` after success.
- `deliveryMethod`: `standard` (free) or `express` ($15, added server-side).
- `paymentMethod`: `card` | `upi` | `cod` (recorded only; no gateway).

`201 Created`:

```json
{
  "data": {
    "id": "order-uuid",
    "orderNumber": "SS-20261121-A1B2C3",
    "status": "confirmed",
    "currency": "USD",
    "subtotal": 240,
    "discount": 0,
    "deliveryFee": 0,
    "total": 240,
    "items": [
      {
        "id": "order-item-uuid",
        "variantId": "variant-uuid",
        "productUuid": "product-uuid",
        "productId": 1,
        "slug": "t-shirt-with-tape-details",
        "name": "T-shirt with Tape Details",
        "sku": "LX-TS-001-S-BROWN",
        "size": "S",
        "color": "Brown",
        "quantity": 2,
        "unitPrice": 120,
        "lineTotal": 240
      }
    ],
    "contact": { "email": "ada@example.com", "phone": "+91 9000000000" },
    "shippingAddress": { "firstName": "Ada", "…": "…" },
    "deliveryMethod": "standard",
    "paymentMethod": "cod",
    "notes": null,
    "createdAt": "2026-11-21T12:00:00.000Z",
    "updatedAt": "2026-11-21T12:00:00.000Z"
  },
  "meta": { "idempotentReplay": false }
}
```

Error codes:

| Code | Status | Meaning |
| --- | --- | --- |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Header missing |
| `EMPTY_CART` | 400 | No items and no cart contents |
| `INSUFFICIENT_STOCK` | 409 | `details.items[]` lists requested vs available |
| `VARIANT_NOT_FOUND` | 400 | An explicit item no longer exists |

Replaying the same `Idempotency-Key` returns `200` with the original order and
`meta.idempotentReplay: true`; no second order or event is created.

---

## GET /api/orders

Requires a session. Query: `page` (default 1), `limit` (default 20, max 50).

```json
{
  "data": [ { "id": "order-uuid", "orderNumber": "…", "items": [] } ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false }
}
```

## GET /api/orders/:id

Requires a session and ownership. `404 ORDER_NOT_FOUND` if the order belongs to
someone else (no information leak).
