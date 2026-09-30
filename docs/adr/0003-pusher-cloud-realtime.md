# ADR-0003: Pusher.com Cloud for Real-Time (no Soketi)

- **Status**: Accepted
- **Date**: 2026-09-28

## Context

The original architecture proposed **Soketi** (self-hosted Pusher-compatible server) for real-time. Soketi requires:

- A separate Node.js process (long-running WebSocket server)
- Redis for horizontal scaling (Redis adapter)
- An open port (other than 80/443) for WebSocket connections

**None of these are possible on shared hosting.**

The stakeholder also requested shared hosting compatibility, which made Soketi unsuitable.

## Decision

Use **Pusher.com cloud** as the real-time backend. This eliminates:

- The need for a WebSocket server process
- The need for Redis pub/sub adapter
- The need to expose non-80/443 ports
- The need to manage WebSocket connection scaling

### How Pusher.com Works for Our Use Case

1. **Server-side**: NestJS uses `pusher` (Node.js SDK) to publish events via HTTPS to Pusher.
2. **Client-side**: Next.js PWA uses `pusher-js` to subscribe to private/presence channels via WSS.
3. **Channel auth**: When a client subscribes to a private/presence channel, pusher-js makes an HTTPS POST to our `/api/v1/broadcasting/auth` endpoint, which:
   - Verifies the JWT
   - Checks that the user has access to the channel (e.g., owns the request)
   - Signs the auth response with the Pusher secret
4. **Pusher routes the event** to all subscribers of that channel in real-time.

### Channel Naming Convention

| Channel                 | Visibility                                      | Auth              |
| ----------------------- | ----------------------------------------------- | ----------------- |
| `private-request.{id}`  | Customer of request + assigned operator + admin | Server-side check |
| `presence-request.{id}` | Same + presence (online status)                 | Same              |
| `private-user.{id}`     | Self only                                       | Self only         |
| `private-admin`         | Admins only                                     | Admin only        |

## Consequences

### Positive

- ✅ Real-time works on **shared hosting** (no WebSocket server needed)
- ✅ Auto-scaling handled by Pusher
- ✅ Mature, reliable, well-documented
- ✅ No infrastructure to manage for real-time
- ✅ Same code works on both profiles (Pusher is always external)

### Negative

- ⚠️ Cost: Pusher Sandbox is free (100 connections, 200K messages/day); paid plans start at $49/month
- ⚠️ Vendor lock-in for real-time (mitigated by `RealtimeService` abstraction layer)
- ⚠️ Pusher requires HTTPS for private channels (already required for PWA)
- ⚠️ Pusher webhooks (for client_disconnected events) need a public HTTPS endpoint

### Mitigations

- `RealtimeService` wraps all Pusher calls — switching to Soketi (VPS) is a one-line driver change
- Start with Sandbox plan (free) — sufficient for early launch
- Pusher webhooks are optional; we can poll channel existence via Pusher admin API

### Capacity Planning (10.1.9) — plan limits vs. expected load

| Plan             | Simultaneous connections | Messages/day | Channels  | Notes                       |
| ---------------- | ------------------------ | ------------ | --------- | --------------------------- |
| Sandbox (free)   | 100                      | 200,000      | Unlimited | Dev + early launch          |
| Starter ($49/mo) | 500                      | 30M          | Unlimited | Up to ~250 concurrent chats |
| Pro ($199/mo)    | 2,000                    | ∞ (fair use) | Unlimited | ~1,000 concurrent chats     |

Sizing rules of thumb for Caffenet chat:

- **1 connection per open browser tab** (customer + operator + admin). A user keeps one connection across all rooms — channels multiplex over the same socket.
- **~6–10 messages per active chat exchange** (message + read receipts + typing + notifications ≈ counted as messages by Pusher).
- **Channel count is bounded** by concurrent request chats (`private-request.{id}` + `presence-request.{id}` per open chat), not by total requests — idle channels cost nothing.
- Sandbox supports ~50 concurrently-open chats; upgrade to Starter beyond ~250.
- TLS: all traffic is WSS/HTTPS (`forceTLS`, `enabledTransports: ['ws','wss']` only); Pusher certificates are pinned and verified client-side — no `rejectUnauthorized` bypass needed on the server SDK (`useTLS: true`).

## References

- ADR-0001: Dual Deployment Profile
- TASKS.md Phase 10.1: Pusher.com Integration
