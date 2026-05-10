---
name: payment
description: 'Skill for the Payment area of rinkuzu. 12 symbols across 3 files.'
---

# Payment

12 symbols | 3 files | Cohesion: 83%

## When to Use

- Working with code in `src/`
- Understanding how GET, PayOSService, generateSignature work
- Modifying payment-related functionality

## Key Files

| File                                           | Symbols                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/services/payment/PayOSService.ts`         | PayOSService, generateSignature, generatePaymentSignature, testConnection, ensureConfigured (+5) |
| `src/interfaces/services/IPayOSService.ts`     | IPayOSService                                                                                    |
| `src/app/api/subscription/test-payos/route.ts` | GET                                                                                              |

## Entry Points

Start here when exploring this area:

- **`GET`** (Function) — `src/app/api/subscription/test-payos/route.ts:7`
- **`PayOSService`** (Class) — `src/services/payment/PayOSService.ts:8`
- **`generateSignature`** (Method) — `src/services/payment/PayOSService.ts:32`
- **`generatePaymentSignature`** (Method) — `src/services/payment/PayOSService.ts:36`
- **`testConnection`** (Method) — `src/services/payment/PayOSService.ts:168`

## Key Symbols

| Symbol                     | Type      | File                                           | Line |
| -------------------------- | --------- | ---------------------------------------------- | ---- |
| `PayOSService`             | Class     | `src/services/payment/PayOSService.ts`         | 8    |
| `GET`                      | Function  | `src/app/api/subscription/test-payos/route.ts` | 7    |
| `IPayOSService`            | Interface | `src/interfaces/services/IPayOSService.ts`     | 62   |
| `generateSignature`        | Method    | `src/services/payment/PayOSService.ts`         | 32   |
| `generatePaymentSignature` | Method    | `src/services/payment/PayOSService.ts`         | 36   |
| `testConnection`           | Method    | `src/services/payment/PayOSService.ts`         | 168  |
| `ensureConfigured`         | Method    | `src/services/payment/PayOSService.ts`         | 21   |
| `redactRequestBody`        | Method    | `src/services/payment/PayOSService.ts`         | 48   |
| `makeRequest`              | Method    | `src/services/payment/PayOSService.ts`         | 58   |
| `createPayment`            | Method    | `src/services/payment/PayOSService.ts`         | 119  |
| `verifyPayment`            | Method    | `src/services/payment/PayOSService.ts`         | 158  |
| `getPaymentInfo`           | Method    | `src/services/payment/PayOSService.ts`         | 163  |

## Execution Flows

| Flow                  | Type            | Steps |
| --------------------- | --------------- | ----- |
| `GET → PayOSService`  | cross_community | 5     |
| `POST → PayOSService` | cross_community | 5     |
| `POST → PayOSService` | cross_community | 5     |
| `POST → PayOSService` | cross_community | 5     |
| `POST → PayOSService` | cross_community | 5     |
| `GET → PayOSService`  | cross_community | 5     |
| `GET → PayOSService`  | cross_community | 5     |
| `GET → PayOSService`  | cross_community | 5     |
| `POST → PayOSService` | cross_community | 5     |
| `GET → PayOSService`  | cross_community | 5     |

## How to Explore

1. `gitnexus_context({name: "GET"})` — see callers and callees
2. `gitnexus_query({query: "payment"})` — find related execution flows
3. Read key files listed above for implementation details
