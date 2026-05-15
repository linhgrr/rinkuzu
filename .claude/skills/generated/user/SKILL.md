---
name: user
description: 'Skill for the User area of rinkuzu. 12 symbols across 8 files.'
---

# User

12 symbols | 8 files | Cohesion: 83%

## When to Use

- Working with code in `src/`
- Understanding how GET, UserProfileLink, getUserDisplayName work
- Modifying user-related functionality

## Key Files

| File                                             | Symbols                                        |
| ------------------------------------------------ | ---------------------------------------------- |
| `src/components/user/UserAvatar.tsx`             | getUserDisplayName, getUserInitial, UserAvatar |
| `src/services/user/UserService.ts`               | UserService, getAttemptDetails                 |
| `src/app/[locale]/(app)/users/[userId]/page.tsx` | getCategoryBadgeVariant, PublicUserProfilePage |
| `src/lib/serviceFactory.ts`                      | getUserService                                 |
| `src/services/user/UserService.test.ts`          | createService                                  |
| `src/interfaces/services/IUserService.ts`        | IUserService                                   |
| `src/app/api/attempts/[id]/route.ts`             | GET                                            |
| `src/components/user/UserProfileLink.tsx`        | UserProfileLink                                |

## Entry Points

Start here when exploring this area:

- **`GET`** (Function) — `src/app/api/attempts/[id]/route.ts:7`
- **`UserProfileLink`** (Function) — `src/components/user/UserProfileLink.tsx:12`
- **`getUserDisplayName`** (Function) — `src/components/user/UserAvatar.tsx:11`
- **`UserAvatar`** (Function) — `src/components/user/UserAvatar.tsx:35`
- **`PublicUserProfilePage`** (Function) — `src/app/[locale]/(app)/users/[userId]/page.tsx:89`

## Key Symbols

| Symbol                    | Type      | File                                             | Line |
| ------------------------- | --------- | ------------------------------------------------ | ---- |
| `UserService`             | Class     | `src/services/user/UserService.ts`               | 6    |
| `GET`                     | Function  | `src/app/api/attempts/[id]/route.ts`             | 7    |
| `UserProfileLink`         | Function  | `src/components/user/UserProfileLink.tsx`        | 12   |
| `getUserDisplayName`      | Function  | `src/components/user/UserAvatar.tsx`             | 11   |
| `UserAvatar`              | Function  | `src/components/user/UserAvatar.tsx`             | 35   |
| `PublicUserProfilePage`   | Function  | `src/app/[locale]/(app)/users/[userId]/page.tsx` | 89   |
| `IUserService`            | Interface | `src/interfaces/services/IUserService.ts`        | 38   |
| `getUserService`          | Method    | `src/lib/serviceFactory.ts`                      | 77   |
| `getAttemptDetails`       | Method    | `src/services/user/UserService.ts`               | 105  |
| `createService`           | Function  | `src/services/user/UserService.test.ts`          | 3    |
| `getUserInitial`          | Function  | `src/components/user/UserAvatar.tsx`             | 25   |
| `getCategoryBadgeVariant` | Function  | `src/app/[locale]/(app)/users/[userId]/page.tsx` | 63   |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Ui           | 2 calls     |
| Quiz         | 1 calls     |
| Repositories | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "GET"})` — see callers and callees
2. `gitnexus_query({query: "user"})` — find related execution flows
3. Read key files listed above for implementation details
