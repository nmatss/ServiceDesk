/**
 * IP Validation Tests
 * Tests for IP validation, normalization, and trusted proxy configuration
 */

import { describe, it, expect } from 'vitest';
import {
  isValidIP,
  isValidIPv4,
  isValidIPv6,
  isPrivateIP,
  normalizeIP,
  isIPInCIDR,
} from '../ip-validation';

describe('IP Validation', () => {
  describe('isValidIPv4', () => {
    it('should validate correct IPv4 addresses', () => {
      expect(isValidIPv4('192.168.1.1')).toBe(true);
      expect(isValidIPv4('10.0.0.1')).toBe(true);
      expect(isValidIPv4('8.8.8.8')).toBe(true);
      expect(isValidIPv4('255.255.255.255')).toBe(true);
      expect(isValidIPv4('0.0.0.0')).toBe(true);
      expect(isValidIPv4('127.0.0.1')).toBe(true);
      expect(isValidIPv4('172.16.0.1')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(isValidIPv4('256.1.1.1')).toBe(false); // Out of range
      expect(isValidIPv4('192.168.1')).toBe(false); // Too few octets
      expect(isValidIPv4('192.168.1.1.1')).toBe(false); // Too many octets
      expect(isValidIPv4('abc.def.ghi.jkl')).toBe(false); // Non-numeric
      expect(isValidIPv4('192.168.-1.1')).toBe(false); // Negative number
      expect(isValidIPv4('192.168.1.256')).toBe(false); // Out of range
      expect(isValidIPv4('')).toBe(false); // Empty string
      expect(isValidIPv4('192.168.1.1.1')).toBe(false); // Too many parts
    });
  });

  describe('isValidIPv6', () => {
    it('should validate correct IPv6 addresses', () => {
      expect(isValidIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
      expect(isValidIPv6('2001:db8::1')).toBe(true);
      expect(isValidIPv6('::1')).toBe(true);
      expect(isValidIPv6('fe80::1')).toBe(true);
      expect(isValidIPv6('2001:db8:85a3::8a2e:370:7334')).toBe(true);
      expect(isValidIPv6('::')).toBe(true); // All zeros
      expect(isValidIPv6('::ffff:192.0.2.1')).toBe(true); // IPv6-mapped IPv4
    });

    it('should reject invalid IPv6 addresses', () => {
      expect(isValidIPv6('192.168.1.1')).toBe(false); // IPv4
      expect(isValidIPv6('gggg::1')).toBe(false); // Invalid hex
      expect(isValidIPv6('::1::')).toBe(false); // Double compression
      expect(isValidIPv6('2001:db8:::1')).toBe(false); // Triple colon
      expect(isValidIPv6('')).toBe(false); // Empty string
    });
  });

  describe('isValidIP', () => {
    it('should validate both IPv4 and IPv6', () => {
      // IPv4
      expect(isValidIP('192.168.1.1')).toBe(true);
      expect(isValidIP('8.8.8.8')).toBe(true);

      // IPv6
      expect(isValidIP('2001:db8::1')).toBe(true);
      expect(isValidIP('::1')).toBe(true);

      // Invalid
      expect(isValidIP('invalid')).toBe(false);
      expect(isValidIP('')).toBe(false);
      expect(isValidIP('256.256.256.256')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidIP(null as any)).toBe(false);
      expect(isValidIP(undefined as any)).toBe(false);
      expect(isValidIP(123 as any)).toBe(false);
      expect(isValidIP({} as any)).toBe(false);
    });
  });

  describe('isPrivateIP', () => {
    it('should identify private IPv4 addresses', () => {
      // 10.0.0.0/8
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('10.255.255.255')).toBe(true);

      // 192.168.0.0/16
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('192.168.255.255')).toBe(true);

      // 172.16.0.0/12
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);

      // 127.0.0.0/8 (localhost)
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('127.255.255.255')).toBe(true);

      // 169.254.0.0/16 (link-local)
      expect(isPrivateIP('169.254.0.1')).toBe(true);
      expect(isPrivateIP('169.254.255.255')).toBe(true);
    });

    it('should identify public IPv4 addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false); // Google DNS
      expect(isPrivateIP('1.1.1.1')).toBe(false); // Cloudflare DNS
      expect(isPrivateIP('208.67.222.222')).toBe(false); // OpenDNS
      expect(isPrivateIP('172.15.255.255')).toBe(false); // Just outside 172.16/12
      expect(isPrivateIP('172.32.0.0')).toBe(false); // Just outside 172.16/12
      expect(isPrivateIP('11.0.0.1')).toBe(false); // Not in 10/8
    });

    it('should identify private IPv6 addresses', () => {
      // ::1 (localhost)
      expect(isPrivateIP('::1')).toBe(true);

      // fc00::/7 (unique local address)
      expect(isPrivateIP('fc00::1')).toBe(true);
      expect(isPrivateIP('fd00::1')).toBe(true);

      // fe80::/10 (link-local)
      expect(isPrivateIP('fe80::1')).toBe(true);
    });

    it('should identify public IPv6 addresses', () => {
      expect(isPrivateIP('2001:db8::1')).toBe(false);
      expect(isPrivateIP('2606:4700:4700::1111')).toBe(false); // Cloudflare
    });
  });

  describe('normalizeIP', () => {
    it('should normalize IPv6-mapped IPv4 addresses', () => {
      expect(normalizeIP('::ffff:192.0.2.1')).toBe('192.0.2.1');
      expect(normalizeIP('::FFFF:192.0.2.1')).toBe('192.0.2.1');
      expect(normalizeIP('::ffff:10.0.0.1')).toBe('10.0.0.1');
    });

    it('should not change regular IPs', () => {
      expect(normalizeIP('192.168.1.1')).toBe('192.168.1.1');
      expect(normalizeIP('2001:db8::1')).toBe('2001:db8::1');
      expect(normalizeIP('::1')).toBe('::1');
      expect(normalizeIP('8.8.8.8')).toBe('8.8.8.8');
    });
  });

  describe('isIPInCIDR', () => {
    it('should correctly check IPv4 CIDR ranges', () => {
      // 192.168.1.0/24
      expect(isIPInCIDR('192.168.1.1', '192.168.1.0/24')).toBe(true);
      expect(isIPInCIDR('192.168.1.255', '192.168.1.0/24')).toBe(true);
      expect(isIPInCIDR('192.168.2.1', '192.168.1.0/24')).toBe(false);

      // 10.0.0.0/8
      expect(isIPInCIDR('10.0.0.1', '10.0.0.0/8')).toBe(true);
      expect(isIPInCIDR('10.255.255.255', '10.0.0.0/8')).toBe(true);
      expect(isIPInCIDR('11.0.0.1', '10.0.0.0/8')).toBe(false);

      // 172.16.0.0/12
      expect(isIPInCIDR('172.16.0.1', '172.16.0.0/12')).toBe(true);
      expect(isIPInCIDR('172.31.255.255', '172.16.0.0/12')).toBe(true);
      expect(isIPInCIDR('172.32.0.0', '172.16.0.0/12')).toBe(false);

      // 192.168.0.0/16
      expect(isIPInCIDR('192.168.1.1', '192.168.0.0/16')).toBe(true);
      expect(isIPInCIDR('192.168.255.255', '192.168.0.0/16')).toBe(true);
      expect(isIPInCIDR('192.169.0.0', '192.168.0.0/16')).toBe(false);
    });

    it('should handle /32 CIDR (single IP)', () => {
      expect(isIPInCIDR('192.168.1.1', '192.168.1.1/32')).toBe(true);
      expect(isIPInCIDR('192.168.1.2', '192.168.1.1/32')).toBe(false);
    });

    it('should handle /0 CIDR (all IPs)', () => {
      expect(isIPInCIDR('192.168.1.1', '0.0.0.0/0')).toBe(true);
      expect(isIPInCIDR('8.8.8.8', '0.0.0.0/0')).toBe(true);
      expect(isIPInCIDR('255.255.255.255', '0.0.0.0/0')).toBe(true);
    });

    it('should reject invalid inputs', () => {
      expect(isIPInCIDR('invalid', '192.168.1.0/24')).toBe(false);
      expect(isIPInCIDR('192.168.1.1', 'invalid')).toBe(false);
      expect(isIPInCIDR('2001:db8::1', '192.168.1.0/24')).toBe(false); // IPv6 not supported yet
    });

    it('should handle Cloudflare IP ranges', () => {
      // Sample Cloudflare ranges
      expect(isIPInCIDR('173.245.48.1', '173.245.48.0/20')).toBe(true);
      expect(isIPInCIDR('103.21.244.1', '103.21.244.0/22')).toBe(true);
      expect(isIPInCIDR('141.101.64.1', '141.101.64.0/18')).toBe(true);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle malformed IPs safely', () => {
      const malformed = [
        '....',
        '1.2.3.4.5.6',
        '-1.-1.-1.-1',
        '999.999.999.999',
        'SELECT * FROM users',
        '<script>alert(1)</script>',
        '../../../etc/passwd',
      ];

      malformed.forEach(ip => {
        expect(isValidIP(ip)).toBe(false);
      });
    });

    it('should not confuse private and public ranges', () => {
      // Edge of private ranges
      expect(isPrivateIP('9.255.255.255')).toBe(false);
      expect(isPrivateIP('11.0.0.0')).toBe(false);
      expect(isPrivateIP('172.15.255.255')).toBe(false);
      expect(isPrivateIP('172.32.0.0')).toBe(false);
      expect(isPrivateIP('192.167.255.255')).toBe(false);
      expect(isPrivateIP('192.169.0.0')).toBe(false);
    });
  });
});
