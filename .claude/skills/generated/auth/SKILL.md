---
name: auth
description: 'Skill for the Auth area of rinkuzu. 13 symbols across 9 files.'
---

# Auth

13 symbols | 9 files | Cohesion: 88%

## When to Use

- Working with code in `src/`
- Understanding how verifyPassword, signToken, POST work
- Modifying auth-related functionality

## Key Files

| File                                      | Symbols                                           |
| ----------------------------------------- | ------------------------------------------------- |
| `src/services/auth/AuthService.ts`        | login, validateCredentials, register, AuthService |
| `src/lib/utils.ts`                        | validateEmail, validatePassword                   |
| `src/lib/password.ts`                     | verifyPassword                                    |
| `src/lib/jwt.ts`                          | signToken                                         |
| `src/app/api/auth/login/route.ts`         | POST                                              |
| `src/app/api/auth/register/route.ts`      | POST                                              |
| `src/lib/serviceFactory.ts`               | getAuthService                                    |
| `src/services/auth/AuthService.test.ts`   | createService                                     |
| `src/interfaces/services/IAuthService.ts` | IAuthService                                      |

## Entry Points

Start here when exploring this area:

- **`verifyPassword`** (Function) — `src/lib/password.ts:12`
- **`signToken`** (Function) — `src/lib/jwt.ts:11`
- **`POST`** (Function) — `src/app/api/auth/login/route.ts:6`
- **`validateEmail`** (Function) — `src/lib/utils.ts:88`
- **`validatePassword`** (Function) — `src/lib/utils.ts:93`

## Key Symbols

| Symbol                | Type      | File                                      | Line |
| --------------------- | --------- | ----------------------------------------- | ---- |
| `AuthService`         | Class     | `src/services/auth/AuthService.ts`        | 12   |
| `verifyPassword`      | Function  | `src/lib/password.ts`                     | 12   |
| `signToken`           | Function  | `src/lib/jwt.ts`                          | 11   |
| `POST`                | Function  | `src/app/api/auth/login/route.ts`         | 6    |
| `validateEmail`       | Function  | `src/lib/utils.ts`                        | 88   |
| `validatePassword`    | Function  | `src/lib/utils.ts`                        | 93   |
| `POST`                | Function  | `src/app/api/auth/register/route.ts`      | 5    |
| `IAuthService`        | Interface | `src/interfaces/services/IAuthService.ts` | 22   |
| `login`               | Method    | `src/services/auth/AuthService.ts`        | 15   |
| `validateCredentials` | Method    | `src/services/auth/AuthService.ts`        | 86   |
| `register`            | Method    | `src/services/auth/AuthService.ts`        | 51   |
| `getAuthService`      | Method    | `src/lib/serviceFactory.ts`               | 84   |
| `createService`       | Function  | `src/services/auth/AuthService.test.ts`   | 14   |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Quiz       | 1 calls     |
| Components | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "verifyPassword"})` — see callers and callees
2. `gitnexus_query({query: "auth"})` — find related execution flows
3. Read key files listed above for implementation details
