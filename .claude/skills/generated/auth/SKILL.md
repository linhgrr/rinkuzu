---
name: auth
description: 'Skill for the Auth area of rinkuzu. 14 symbols across 9 files.'
---

# Auth

14 symbols | 9 files | Cohesion: 89%

## When to Use

- Working with code in `src/`
- Understanding how validateEmail, validatePassword, hashPassword work
- Modifying auth-related functionality

## Key Files

| File                                      | Symbols                                           |
| ----------------------------------------- | ------------------------------------------------- |
| `src/services/auth/AuthService.ts`        | register, login, validateCredentials, AuthService |
| `src/lib/utils.ts`                        | validateEmail, validatePassword                   |
| `src/lib/password.ts`                     | hashPassword, verifyPassword                      |
| `src/app/api/user/password/route.ts`      | PUT                                               |
| `src/app/api/auth/register/route.ts`      | POST                                              |
| `src/lib/jwt.ts`                          | signToken                                         |
| `src/app/api/auth/login/route.ts`         | POST                                              |
| `src/lib/serviceFactory.ts`               | getAuthService                                    |
| `src/interfaces/services/IAuthService.ts` | IAuthService                                      |

## Entry Points

Start here when exploring this area:

- **`validateEmail`** (Function) — `src/lib/utils.ts:73`
- **`validatePassword`** (Function) — `src/lib/utils.ts:78`
- **`hashPassword`** (Function) — `src/lib/password.ts:3`
- **`PUT`** (Function) — `src/app/api/user/password/route.ts:7`
- **`POST`** (Function) — `src/app/api/auth/register/route.ts:5`

## Key Symbols

| Symbol                | Type      | File                                      | Line |
| --------------------- | --------- | ----------------------------------------- | ---- |
| `AuthService`         | Class     | `src/services/auth/AuthService.ts`        | 12   |
| `validateEmail`       | Function  | `src/lib/utils.ts`                        | 73   |
| `validatePassword`    | Function  | `src/lib/utils.ts`                        | 78   |
| `hashPassword`        | Function  | `src/lib/password.ts`                     | 3    |
| `PUT`                 | Function  | `src/app/api/user/password/route.ts`      | 7    |
| `POST`                | Function  | `src/app/api/auth/register/route.ts`      | 5    |
| `verifyPassword`      | Function  | `src/lib/password.ts`                     | 12   |
| `signToken`           | Function  | `src/lib/jwt.ts`                          | 11   |
| `POST`                | Function  | `src/app/api/auth/login/route.ts`         | 5    |
| `IAuthService`        | Interface | `src/interfaces/services/IAuthService.ts` | 22   |
| `register`            | Method    | `src/services/auth/AuthService.ts`        | 51   |
| `login`               | Method    | `src/services/auth/AuthService.ts`        | 15   |
| `validateCredentials` | Method    | `src/services/auth/AuthService.ts`        | 86   |
| `getAuthService`      | Method    | `src/lib/serviceFactory.ts`               | 79   |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Repositories | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "validateEmail"})` — see callers and callees
2. `gitnexus_query({query: "auth"})` — find related execution flows
3. Read key files listed above for implementation details
