# Security Policy

## Reporting Security Vulnerabilities

We take the security of ServiceDesk seriously. If you believe you have found a security vulnerability, please report it to us as described below.

## Reporting Process

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to **security@servicedesk.com** (replace with actual email).

Include as much of the following information as possible:

- Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability and potential attack scenarios

## Response Timeline

- **Initial Response**: Within 48 hours of report
- **Status Update**: Every 72 hours until resolution
- **Fix Timeline**:
  - Critical vulnerabilities: 7 days
  - High vulnerabilities: 14 days
  - Medium vulnerabilities: 30 days
  - Low vulnerabilities: 90 days

## Disclosure Policy

- We will acknowledge receipt of your vulnerability report
- We will provide an estimated timeline for a fix
- We will notify you when the vulnerability is fixed
- We will credit you in our security advisories (unless you prefer to remain anonymous)

## Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations, data destruction, and service disruption
- Give us reasonable time to address the issue before any public disclosure
- Do not exploit a vulnerability beyond what is necessary to demonstrate it

We will not pursue legal action against security researchers who follow these guidelines.

## Security Updates

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Features

ServiceDesk includes the following security features:

- ✅ JWT-based authentication with secure token management
- ✅ Password hashing with bcrypt
- ✅ Role-based access control (RBAC)
- ✅ SQL injection prevention via parameterized queries
- ✅ XSS prevention with input/output encoding
- ✅ CSRF protection with SameSite cookies
- ✅ Security headers (HSTS, CSP, X-Frame-Options, etc.)
- ✅ Rate limiting to prevent brute force attacks
- ✅ Input validation with Zod schemas
- ✅ Automated dependency scanning
- ✅ Secrets scanning

## Security Testing

We maintain a comprehensive security testing suite including:

- OWASP Top 10 automated tests
- JWT security tests
- Authentication and authorization tests
- Input validation tests
- Security headers validation
- Dependency vulnerability scanning
- Secrets detection

Run security tests with:

```bash
npm run test:security
```

## Bug Bounty

Currently, we do not have a bug bounty program. However, we deeply appreciate responsible disclosure and will publicly acknowledge security researchers who help improve ServiceDesk's security (with their permission).

## Past Security Advisories

No security advisories have been published for this project yet.

## Contact

- **Security Email**: security@servicedesk.com
- **PGP Key**: [Link to PGP key if available]
- **General Support**: support@servicedesk.com

Thank you for helping keep ServiceDesk and our users safe!
