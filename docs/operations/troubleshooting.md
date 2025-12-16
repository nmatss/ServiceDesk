# Troubleshooting Guide

Common issues and their solutions.

## Application Won't Start

### Symptoms
- App crashes on startup
- Port already in use error

### Solutions

```bash
# Check port usage
lsof -i :3000

# Kill process
kill -9 <PID>

# Check logs
npm run dev 2>&1 | tee debug.log
```

## Database Connection Issues

### Symptoms
- "Connection refused" errors
- Timeout errors

### Solutions

```bash
# Test connection
psql -h localhost -U servicedesk -d servicedesk

# Check PostgreSQL status
systemctl status postgresql

# Verify credentials
echo $DATABASE_URL
```

## Performance Issues

### Slow Response Times

1. Check database query performance
2. Verify Redis cache is working
3. Review application logs
4. Check server resources

### High Memory Usage

```bash
# Check memory usage
free -m

# Restart application
systemctl restart servicedesk

# Review logs for memory leaks
journalctl -u servicedesk -n 100
```

## Authentication Issues

### Can't Login

1. Verify credentials
2. Check account status (not locked)
3. Review rate limiting
4. Check JWT configuration

### Session Expires Too Quickly

Check environment variables:
```bash
JWT_EXPIRES_IN=28800  # 8 hours
SESSION_DURATION=28800
```

## Email Not Sending

### Check Configuration

```bash
# Verify SMTP settings
echo $SMTP_HOST
echo $SMTP_PORT
echo $SMTP_USER

# Test email
npm run test:email
```

## Common Error Messages

### "JWT must be provided"

- User not logged in
- Token expired
- Token invalid

Solution: Re-authenticate

### "Database query timeout"

- Slow query
- Database overloaded
- Connection pool exhausted

Solution: Optimize query or increase pool size

### "File upload failed"

- File too large
- Storage quota exceeded
- Invalid file type

Solution: Check file size and type

## Getting Help

If issues persist:

1. Check logs: `journalctl -u servicedesk`
2. Review [GitHub Issues](https://github.com/your-org/ServiceDesk/issues)
3. Contact: support@servicedesk.com
