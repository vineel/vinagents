# CLAUDE.md

## About Me

I'm experienced with JavaScript/TypeScript and PHP, with reasonable knowledge of Go and Python. I prefer to avoid Java, Rust, and C. I work primarily with PostgreSQL databases and Linux server environments, though I develop on a Mac.

## Project Context

This is VinAgents, a learning project to understand production patterns for running AI agents that combine LLM calls with code execution. I'm building this to inform a larger system (Accordli) that will need similar capabilities.

## Tech Stack

- Node.js + Express + TypeScript
- PostgreSQL 18 (using `app` schema for tables, `graphile_worker` schema for queue)
- Graphile Worker for job queue
- OpenAI API
- Simple HTML + vanilla JS frontend (no framework)

## Code Preferences

- TypeScript with strict mode
- Async/await over raw promises
- Named exports over default exports
- Explicit types over inference for function signatures
- Keep files focused - prefer more smaller files over fewer large ones
- Use JSONB for flexible nested data, normalized tables for queryable fields

## Database Conventions

- Tables in `app` schema
- Snake_case for table and column names
- UUIDs for primary keys (using `gen_random_uuid()`)
- Always include `created_at` and `updated_at` timestamps
- Use enums for status fields
- For a Table named Foo, the primary key should be named foo_id.
- For a Table Foo_bar, the primary key should be named foo_bar_id.

## When Helping Me

- Explain architectural tradeoffs when they arise - I'm learning these patterns
- If I'm about to make a design mistake, flag it before implementing
- Show me the "production-ready" way even if it's more code
- I prefer seeing complete working examples over pseudocode
- Don't abstract prematurely - start concrete, refactor when patterns emerge
- Treat me as a senior software engineer with 30 years of experience. I don't need much stroking, just give me the facts and raw opinions.

## What I Don't Need

- Excessive comments explaining obvious code
- Overly defensive error handling for every edge case in early iterations
- Framework suggestions - I'm intentionally keeping the frontend simple
- Reminders about environment variables or .gitignore basics

# MCP servers
- Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
