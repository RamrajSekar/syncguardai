# SyncGuard AI - Project Instructions

## Tech Stack
- Frontend/Backend: Next.js 15+ (App Router, TypeScript, Tailwind CSS)
- Hosting: Vercel Serverless
- AI: Anthropic Node SDK (Claude 3.5 Sonnet) / OpenAI Responses API
- Edge Security: Upstash Redis (for rate limiting)

## Architecture Principles
1. **Strictly Stateless:** Never introduce a database. Data processing must happen via memory pass-through in serverless edge functions.
2. **Client-Side First:** All raw CSV, JSON, TXT, and XML uploads must be run through `src/utils/piiScrubber.ts` to sanitize PII (emails, keys, names) *before* hitting the API backend.
3. **Clean Code Style:** Use clean, explicit TypeScript types. Prefer modular component structures inside `src/components/`. Every complex validation or mapping function must include brief inline JSDoc comments.
4. **Identity-Ready Design:** Design all API routes with clean boundaries so that anonymous IP-tracking tokens can easily transition to user-identity tokens (e.g., Clerk Auth) in a future release.

## Budget & Security Guardrails
1. **Payload Caps:** Enforce a hard stop at **1 MB maximum combined payload size** in both the frontend drop-zone component and the backend API route check to prevent token abuse.
2. **Concise Tokens:** System prompts must instruct the LLM to skip conversational fluff and output direct, structured markdown to optimize response token usage.
3. **Secrets Management:** Hardcoding API keys is strictly prohibited. Fall back to `process.env` constants exclusively.

## Core Features to Implement
1. Multi-file Drag & Drop Zone (`src/components/DropZone.tsx`) supporting `.csv`, `.json`, `.txt`, and `.xml`.
2. Interactive Action Button ("Run SyncGuard Audit") that handles loading states and toggles disabled states based on queue contents.
3. Backend API route for processing logic mapping (`src/app/api/audit/route.ts`) wrapped with token caps and payload length checks.
4. Markdown report presentation tier with dynamic, color-coded risk summary blocks parsing live AI keywords.