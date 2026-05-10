---
name: routing
description: 'Skill for the Routing area of rinkuzu. 13 symbols across 6 files.'
---

# Routing

13 symbols | 6 files | Cohesion: 87%

## When to Use

- Working with code in `src/`
- Understanding how MainLayoutWrapper, GlobalFooter, BottomNav work
- Modifying routing-related functionality

## Key Files

| File                                             | Symbols                                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `src/lib/routing/pathname.ts`                    | stripLocaleFromPath, matchesPrefix, isAdaptiveExerciseModePath, shouldHideGlobalFooter, normalizePath (+1) |
| `src/components/Navigation/NavigationClient.tsx` | NavigationClient, handleScroll                                                                             |
| `src/proxy.ts`                                   | localizePath, middleware                                                                                   |
| `src/components/MainLayoutWrapper.tsx`           | MainLayoutWrapper                                                                                          |
| `src/components/GlobalFooter.tsx`                | GlobalFooter                                                                                               |
| `src/components/BottomNav.tsx`                   | BottomNav                                                                                                  |

## Entry Points

Start here when exploring this area:

- **`MainLayoutWrapper`** (Function) — `src/components/MainLayoutWrapper.tsx:6`
- **`GlobalFooter`** (Function) — `src/components/GlobalFooter.tsx:6`
- **`BottomNav`** (Function) — `src/components/BottomNav.tsx:39`
- **`stripLocaleFromPath`** (Function) — `src/lib/routing/pathname.ts:31`
- **`matchesPrefix`** (Function) — `src/lib/routing/pathname.ts:63`

## Key Symbols

| Symbol                       | Type     | File                                             | Line |
| ---------------------------- | -------- | ------------------------------------------------ | ---- |
| `MainLayoutWrapper`          | Function | `src/components/MainLayoutWrapper.tsx`           | 6    |
| `GlobalFooter`               | Function | `src/components/GlobalFooter.tsx`                | 6    |
| `BottomNav`                  | Function | `src/components/BottomNav.tsx`                   | 39   |
| `stripLocaleFromPath`        | Function | `src/lib/routing/pathname.ts`                    | 31   |
| `matchesPrefix`              | Function | `src/lib/routing/pathname.ts`                    | 63   |
| `isAdaptiveExerciseModePath` | Function | `src/lib/routing/pathname.ts`                    | 67   |
| `shouldHideGlobalFooter`     | Function | `src/lib/routing/pathname.ts`                    | 72   |
| `NavigationClient`           | Function | `src/components/Navigation/NavigationClient.tsx` | 388  |
| `handleScroll`               | Function | `src/components/Navigation/NavigationClient.tsx` | 406  |
| `middleware`                 | Function | `src/proxy.ts`                                   | 37   |
| `normalizePath`              | Function | `src/lib/routing/pathname.ts`                    | 24   |
| `getLocaleFromPath`          | Function | `src/lib/routing/pathname.ts`                    | 44   |
| `localizePath`               | Function | `src/proxy.ts`                                   | 30   |

## Execution Flows

| Flow                               | Type            | Steps |
| ---------------------------------- | --------------- | ----- |
| `BottomNav → NormalizePath`        | cross_community | 4     |
| `NavigationClient → NormalizePath` | cross_community | 4     |

## How to Explore

1. `gitnexus_context({name: "MainLayoutWrapper"})` — see callers and callees
2. `gitnexus_query({query: "routing"})` — find related execution flows
3. Read key files listed above for implementation details
