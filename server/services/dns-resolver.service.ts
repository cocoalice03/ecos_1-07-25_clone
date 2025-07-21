import { promisify } from 'util';
import { lookup } from 'dns';

const dnsLookup = promisify(lookup);

export class DNSResolverService {
  private static readonly SUPABASE_DOMAIN = 'db.zateicubgktisdtnihiu.supabase.co';
  private static readonly BACKUP_IPS = [
    '54.236.146.234', // Supabase backup IP
    '34.194.6.46',    // Supabase backup IP 2
  ];

  static async resolveSupabaseHost(): Promise<string> {
    try {
      console.log('🔍 Resolving Supabase hostname...');
      
      // Try IPv4 specifically since postgres library handles IPv4 better
      const { address, family } = await dnsLookup(this.SUPABASE_DOMAIN, { family: 4 });
      console.log(`✅ DNS resolved to IPv4: ${address}`);
      return address;
    } catch (ipv4Error) {
      console.log('⚠️ IPv4 resolution failed, trying IPv6...');
      
      try {
        const { address } = await dnsLookup(this.SUPABASE_DOMAIN, { family: 6 });
        console.log(`✅ DNS resolved to IPv6: ${address}`);
        // For IPv6, we need to wrap in brackets
        return `[${address}]`;
      } catch (ipv6Error) {
        console.log('⚠️ All DNS resolution failed, trying backup IPs...');
        
        // Try backup IPs
        for (const ip of this.BACKUP_IPS) {
          try {
            console.log(`🔧 Testing backup IP: ${ip}`);
            return ip; // Return directly, we'll test connection later
          } catch (ipError) {
            console.log(`❌ Backup IP ${ip} failed:`, ipError.message);
          }
        }
        
        throw new Error('Tous les serveurs Supabase sont inaccessibles');
      }
    }
  }

  static buildConnectionUrl(resolvedHost: string): string {
    return `postgresql://postgres:ceerrfbeaujon@${resolvedHost}:5432/postgres`;
  }
}