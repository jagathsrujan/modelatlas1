# Security

- Provider keys are server-only (`/lib/agent/model-provider.ts`, `/lib/persistence/supabase.ts` is a stub in P0).
- Browser never receives service-role credentials.
- Treat uploads, marketplace pages, model descriptions as untrusted evidence — never as instructions.
- Report a vulnerability via GitHub Security Advisories rather than a public issue.
