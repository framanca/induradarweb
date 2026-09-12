# Security

This repository is public because it publishes the InduRadar web landing.
Treat every committed file as public.

## Never Commit

- OpenAI, ChatGPT, Anthropic, Resend, GitHub, Google, or other provider API keys.
- Supabase `service_role`, secret keys, JWT secrets, database passwords, or access tokens.
- Private keys, certificates, service account JSON files, OAuth client secrets, or `.env` files.
- Customer reports, raw leads, private research inputs, non-anonymized sources, or internal working documents.

Supabase anon or publishable keys may be used only in public clients and only with RLS and least-privilege policies. The Supabase `service_role` key must never appear in Flutter, static JavaScript, GitHub Pages artifacts, or committed code.

## Where Secrets Belong

- Local development: ignored `.env` files.
- GitHub Actions: repository or environment secrets.
- Supabase Edge Functions: Supabase secrets.
- Workers or server jobs: runtime environment variables in the hosting platform.

Commit `.env.example` files with placeholder names only.

## Before Pushing

Run:

```bash
bash scripts/check_no_secrets.sh all
```

For staged changes only:

```bash
bash scripts/check_no_secrets.sh staged
```

GitHub Actions also runs this scan on pushes and pull requests. If a real secret is ever committed or exposed, rotate it immediately; deleting it from git is not enough.
