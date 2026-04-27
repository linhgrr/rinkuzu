# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue.
2. Email the maintainers at the contact address listed in the repository.
3. Include a detailed description of the vulnerability and steps to reproduce.
4. Allow reasonable time for the issue to be addressed before public disclosure.

We will acknowledge receipt within 48 hours and provide an estimated timeline for a fix.

## Security Best Practices

- All environment variables containing secrets must be stored in `.env.local` (never committed).
- API routes are protected with authentication where required.
- Security headers (CSP, HSTS, X-Frame-Options, etc.) are configured in `next.config.js`.
- Dependencies are regularly audited with `npm audit`.
