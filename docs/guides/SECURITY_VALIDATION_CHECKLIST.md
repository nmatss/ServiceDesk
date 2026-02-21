# Security Validation Checklist

## Pré-Deployment

### Environment Configuration
- [ ] JWT_SECRET configurado com mínimo 64 caracteres
- [ ] JWT_SECRET não contém padrões fracos (secret, password, admin, etc.)
- [ ] NODE_ENV=production configurado
- [ ] HTTPS habilitado (obrigatório para cookies seguros)
- [ ] CORS whitelist configurada com origens permitidas

### Database
- [ ] Tabela `refresh_tokens` criada com sucesso
- [ ] Índices criados: `idx_refresh_tokens_hash`, `idx_refresh_tokens_user`, `idx_refresh_tokens_expires`
- [ ] Tabela `rate_limits` existente e funcional

## Testes Funcionais

### Authentication Flow

#### Login
```bash
# Teste 1: Login com credenciais válidas
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","password":"senha123","tenant_slug":"empresa-demo"}' \
  -c cookies.txt -v

# Verificar:
- [ ] Status 200
- [ ] Cookies `auth_token` e `refresh_token` setados
- [ ] Flags: httpOnly=true, secure=true (prod), SameSite=Strict
- [ ] Response NÃO contém tokens no body (apenas user data)
```

#### Token Refresh
```bash
# Teste 2: Refresh token
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt -c cookies_new.txt -v

# Verificar:
- [ ] Status 200
- [ ] Novos cookies auth_token e refresh_token
- [ ] Tokens anteriores revogados no banco
- [ ] Response contém user data atualizado
```

#### Logout
```bash
# Teste 3: Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt -v

# Verificar:
- [ ] Status 200
- [ ] Cookies limpos (maxAge=0)
- [ ] Todos refresh tokens revogados no banco
```

### Security Headers Validation

```bash
# Teste 4: Verificar security headers
curl -I http://localhost:3000/

# Verificar presença de headers:
- [ ] Content-Security-Policy
- [ ] Strict-Transport-Security (prod only)
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy
- [ ] X-XSS-Protection: 1; mode=block
- [ ] X-DNS-Prefetch-Control: on
- [ ] Sem header X-Powered-By
```

### CSRF Protection

```bash
# Teste 5: CSRF token rotation
curl http://localhost:3000/ -c csrf1.txt -v
curl http://localhost:3000/ -c csrf2.txt -v

# Verificar:
- [ ] Cookie csrf_token presente
- [ ] Token diferente em cada request
- [ ] Header X-CSRF-Token presente em responses
```

```bash
# Teste 6: CSRF validation on POST
curl -X POST http://localhost:3000/api/some-endpoint \
  -H "Content-Type: application/json" \
  -d '{"data":"test"}' \
  -v

# Verificar:
- [ ] Status 403 (CSRF validation failed)
- [ ] Error message sobre CSRF token
```

### Rate Limiting

```bash
# Teste 7: Rate limiting - Login
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -v
done

# Verificar:
- [ ] Primeiras 5 tentativas: 401 (credenciais inválidas)
- [ ] 6ª tentativa: 429 (rate limit exceeded)
- [ ] Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
```

### Device Fingerprinting

```bash
# Teste 8: Device fingerprint validation
# Login em um dispositivo
curl -X POST http://localhost:3000/api/auth/login \
  -H "User-Agent: Device1" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"password"}' \
  -c device1.txt

# Tentar usar token em outro dispositivo
curl http://localhost:3000/api/auth/verify \
  -H "User-Agent: Device2" \
  -b device1.txt

# Verificar:
- [ ] Segunda request falha (device fingerprint mismatch)
```

## Browser Testing

### LocalStorage Check
```javascript
// Abrir Console do Browser
localStorage.getItem('auth_token')
// Resultado esperado: null

document.cookie
// Resultado esperado: NÃO deve mostrar auth_token ou refresh_token (httpOnly)
```

### Dashboard Access
- [ ] Acessar /dashboard sem login redireciona para /auth/login
- [ ] Login bem-sucedido permite acesso ao dashboard
- [ ] User data carregado via API (/api/auth/verify)
- [ ] Nenhum token visível no localStorage ou sessionStorage
- [ ] Network tab mostra cookies enviados automaticamente

### Token Expiry
- [ ] Após 15 minutos, access token expira
- [ ] Request automático para /api/auth/refresh
- [ ] Novos tokens recebidos via cookies
- [ ] Usuário permanece logado (seamless)

## Database Validation

```sql
-- Verificar refresh tokens armazenados
SELECT * FROM refresh_tokens WHERE revoked_at IS NULL;

-- Verificar estrutura da tabela
PRAGMA table_info(refresh_tokens);

-- Verificar índices
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='refresh_tokens';

-- Verificar rate limits ativos
SELECT * FROM rate_limits WHERE reset_time > datetime('now');
```

Checklist:
- [ ] Tokens armazenados como hash (não plaintext)
- [ ] Device fingerprint presente
- [ ] Timestamps corretos
- [ ] Todos índices criados

## Performance Testing

### Token Generation Speed
```bash
# Medir tempo de geração de tokens
time curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"password"}'

# Expectativa: < 500ms
```

### Concurrent Logins
```bash
# Teste de carga com Apache Bench
ab -n 100 -c 10 -p login.json -T application/json \
  http://localhost:3000/api/auth/login

# Verificar:
- [ ] Todas requests completadas
- [ ] Rate limiting funcionando
- [ ] Sem erros de concorrência no banco
```

## Security Audit

### JWT Secret Strength
```bash
# Verificar no servidor
node -e "console.log('Length:', process.env.JWT_SECRET.length)"
# Expectativa: >= 64

# Verificar padrões fracos
grep -i "secret\|password\|admin\|test" .env
# Expectativa: Nenhum match no JWT_SECRET
```

### Crypto Functions
- [ ] Todas operações crypto usam crypto.randomBytes
- [ ] CSRF tokens gerados com crypto seguro
- [ ] Device fingerprints usando hashing SHA-256
- [ ] Token hashes usando SHA-256

### Cookie Security
- [ ] httpOnly: true (access + refresh tokens)
- [ ] secure: true em produção
- [ ] sameSite: 'strict'
- [ ] Expiry correto (15min access, 7d refresh)

## Compliance Checks

### OWASP Top 10
- [ ] A02: Cryptographic Failures - ✅ (httpOnly cookies, strong JWT)
- [ ] A05: Security Misconfiguration - ✅ (Helmet headers, HTTPS)
- [ ] A07: Identification and Authentication - ✅ (Token rotation, rate limiting)

### LGPD
- [ ] Tokens não contêm PII desnecessário
- [ ] Logs não expõem dados sensíveis
- [ ] Refresh tokens podem ser revogados (direito ao esquecimento)

## Monitoring & Alerting

### Logs para Monitorar
```bash
# Authentication failures
grep "Authentication failed" logs/app.log | wc -l

# Rate limit violations
grep "Rate limit exceeded" logs/app.log

# CSRF violations
grep "CSRF Violation" logs/security.log

# Token refresh errors
grep "Failed to refresh tokens" logs/app.log
```

### Metrics
- [ ] Failed login attempts / hour
- [ ] Rate limit hits / hour
- [ ] Token refresh rate
- [ ] Average token lifetime
- [ ] CSRF mismatches

## Rollback Plan

Se problemas forem detectados:

1. **Reverter código:**
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Limpar tokens ativos:**
   ```sql
   DELETE FROM refresh_tokens;
   ```

3. **Notificar usuários:**
   - Forçar re-login de todos usuários
   - Enviar email sobre mudanças de segurança

## Sign-off

- [ ] Todos testes funcionais passaram
- [ ] Todos testes de segurança passaram
- [ ] Performance aceitável (< 500ms login)
- [ ] Database migrations aplicadas
- [ ] Environment variables configuradas
- [ ] HTTPS configurado
- [ ] Monitoring configurado
- [ ] Rollback plan documentado

**Aprovado por:** _________________ **Data:** _________

**Notas:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
