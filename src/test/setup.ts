import { beforeEach, vi } from 'vitest'

// Hermetic by default: any test that forgets to mock `fetch` fails loudly instead of
// silently hitting a live API (flaky, slow, rate-limited, and against the free-tier-only rule).
// Tests opt in with mockFetch() from ./helpers, which replaces this stub.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    throw new Error(`Unmocked network call in test: ${String(input)}`)
  }))
})
