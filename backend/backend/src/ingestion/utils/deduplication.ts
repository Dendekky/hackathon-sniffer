import { createHash } from 'crypto';
import { NormalizedHackathon } from '../types/ingestion';

export class DeduplicationService {
  
  /**
   * Generate a content hash for a hackathon event
   * Used to detect duplicate content from different sources
   */
  static generateContentHash(hackathon: NormalizedHackathon): string {
    // Create a normalized string for hashing
    const normalizedContent = [
      hackathon.title.toLowerCase().trim(),
      hackathon.start_date,
      hackathon.end_date,
      hackathon.location.toLowerCase().trim(),
      hackathon.is_online.toString(),
    ].join('|');

    return createHash('sha256').update(normalizedContent).digest('hex');
  }

  /**
   * Canonicalize URLs by removing tracking parameters and normalizing format
   */
  static canonicalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // Remove common tracking parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'ref', 'source', 'campaign',
      ];
      
      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });

      // Normalize host (remove www prefix)
      urlObj.hostname = urlObj.hostname.replace(/^www\./, '');
      
      // Remove trailing slash
      urlObj.pathname = urlObj.pathname.replace(/\/$/, '');
      
      return urlObj.toString();
    } catch (error) {
      // If URL parsing fails, return original
      return url;
    }
  }

  /**
   * Calculate similarity score between two hackathons (0-1, where 1 is identical)
   */
  static calculateSimilarity(h1: NormalizedHackathon, h2: NormalizedHackathon): number {
    let score = 0;
    let factors = 0;

    // Title similarity (weighted heavily)
    const titleSimilarity = this.stringSimilarity(h1.title, h2.title);
    score += titleSimilarity * 0.4;
    factors += 0.4;

    // Date similarity
    if (h1.start_date === h2.start_date) {
      score += 0.3;
    } else {
      // Partial credit for dates within a few days
      const date1 = new Date(h1.start_date);
      const date2 = new Date(h2.start_date);
      const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 3) {
        score += 0.15;
      }
    }
    factors += 0.3;

    // Location similarity
    const locationSimilarity = this.stringSimilarity(h1.location, h2.location);
    score += locationSimilarity * 0.2;
    factors += 0.2;

    // Online/offline match
    if (h1.is_online === h2.is_online) {
      score += 0.1;
    }
    factors += 0.1;

    return score / factors;
  }

  /**
   * Simple string similarity using Levenshtein distance
   */
  private static stringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= s2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const maxLength = Math.max(s1.length, s2.length);
    return (maxLength - matrix[s2.length][s1.length]) / maxLength;
  }

  /**
   * Determine if two hackathons are likely duplicates
   */
  static isDuplicate(h1: NormalizedHackathon, h2: NormalizedHackathon, threshold = 0.85): boolean {
    return this.calculateSimilarity(h1, h2) >= threshold;
  }

  /**
   * Find duplicates in a list of hackathons
   */
  static findDuplicates(hackathons: NormalizedHackathon[], threshold = 0.85): Array<{
    original: NormalizedHackathon;
    duplicates: NormalizedHackathon[];
  }> {
    const duplicateGroups: Array<{
      original: NormalizedHackathon;
      duplicates: NormalizedHackathon[];
    }> = [];

    const processed = new Set<number>();

    for (let i = 0; i < hackathons.length; i++) {
      if (processed.has(i)) continue;

      const duplicates: NormalizedHackathon[] = [];
      
      for (let j = i + 1; j < hackathons.length; j++) {
        if (processed.has(j)) continue;

        if (this.isDuplicate(hackathons[i], hackathons[j], threshold)) {
          duplicates.push(hackathons[j]);
          processed.add(j);
        }
      }

      if (duplicates.length > 0) {
        duplicateGroups.push({
          original: hackathons[i],
          duplicates,
        });
      }

      processed.add(i);
    }

    return duplicateGroups;
  }

  /**
   * Merge duplicate hackathons, preferring data from primary sources
   */
  static mergeDuplicates(original: NormalizedHackathon, duplicates: NormalizedHackathon[]): NormalizedHackathon {
    const sourcePriority = ['mlh', 'devpost', 'eventbrite']; // MLH is most authoritative
    
    let best = original;
    
    for (const duplicate of duplicates) {
      const originalPriority = sourcePriority.indexOf(best.source);
      const duplicatePriority = sourcePriority.indexOf(duplicate.source);
      
      // If duplicate has higher priority source, use it as base
      if (duplicatePriority < originalPriority && duplicatePriority !== -1) {
        best = duplicate;
      }
    }

    // Merge additional data from all sources
    const allEvents = [original, ...duplicates];
    
    return {
      ...best,
      // Use the most complete description
      description: allEvents.find(e => e.description && e.description.length > (best.description?.length || 0))?.description || best.description,
      // Use the earliest registration deadline if available
      registration_deadline: allEvents
        .map(e => e.registration_deadline)
        .filter(Boolean)
        .sort()[0] || best.registration_deadline,
      // Prefer registration URL if available
      registration_url: allEvents.find(e => e.registration_url)?.registration_url || best.registration_url,
      // Prefer website URL from primary source
      website_url: best.website_url || allEvents.find(e => e.website_url)?.website_url,
    };
  }
}
