// ISO 8601 Duration format support
export enum SubscriptionDurationType {
  MONTHLY = 'P1M',
  QUARTERLY = 'P3M',
  SEMI_ANNUAL = 'P6M',
  ANNUAL = 'P1Y',
  LIFETIME = 'PT0S' // Special case for unlimited duration
}

export interface Duration {
  iso8601: string; // ISO 8601 format (P1M, P3M, P1Y, etc.)
  displayName: string; // Human readable (1 Month, 3 Months, etc.)
  months?: number; // For calculation purposes (null for lifetime)
}

export const PREDEFINED_DURATIONS: Record<SubscriptionDurationType, Duration> = {
  [SubscriptionDurationType.MONTHLY]: {
    iso8601: 'P1M',
    displayName: '1 Month',
    months: 1
  },
  [SubscriptionDurationType.QUARTERLY]: {
    iso8601: 'P3M',
    displayName: '3 Months',
    months: 3
  },
  [SubscriptionDurationType.SEMI_ANNUAL]: {
    iso8601: 'P6M',
    displayName: '6 Months',
    months: 6
  },
  [SubscriptionDurationType.ANNUAL]: {
    iso8601: 'P1Y',
    displayName: '1 Year',
    months: 12
  },
  [SubscriptionDurationType.LIFETIME]: {
    iso8601: 'PT0S',
    displayName: 'Lifetime',
    months: undefined // Infinite
  }
};

// Legacy string mapping for backward compatibility
export const LEGACY_DURATION_MAP: Record<string, SubscriptionDurationType> = {
  '1 tháng': SubscriptionDurationType.MONTHLY,
  '3 tháng': SubscriptionDurationType.QUARTERLY,
  '6 tháng': SubscriptionDurationType.SEMI_ANNUAL,
  '12 tháng': SubscriptionDurationType.ANNUAL,
  'lifetime': SubscriptionDurationType.LIFETIME,
  // English variants
  '1 month': SubscriptionDurationType.MONTHLY,
  '3 months': SubscriptionDurationType.QUARTERLY,
  '6 months': SubscriptionDurationType.SEMI_ANNUAL,
  '12 months': SubscriptionDurationType.ANNUAL
};

// Utility class for duration operations
export class DurationUtils {
  /**
   * Parse ISO 8601 duration string to get months
   * @param iso8601Duration ISO 8601 duration (P1M, P3M, P1Y, etc.)
   * @returns number of months or undefined for lifetime
   */
  static parseToMonths(iso8601Duration: string): number | undefined {
    if (iso8601Duration === 'PT0S') return undefined; // Lifetime
    
    // Match patterns like P1M, P3M, P1Y, etc.
    const monthMatch = iso8601Duration.match(/P(\d+)M/);
    if (monthMatch) {
      return parseInt(monthMatch[1]);
    }
    
    const yearMatch = iso8601Duration.match(/P(\d+)Y/);
    if (yearMatch) {
      return parseInt(yearMatch[1]) * 12;
    }
    
    throw new Error(`Unsupported ISO 8601 duration format: ${iso8601Duration}`);
  }

  /**
   * Calculate end date from start date and duration
   * @param startDate Start date
   * @param iso8601Duration ISO 8601 duration
   * @returns End date or undefined for lifetime
   */
  static calculateEndDate(startDate: Date, iso8601Duration: string): Date | undefined {
    const months = this.parseToMonths(iso8601Duration);
    if (months === undefined) return undefined; // Lifetime
    
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);
    return endDate;
  }

  /**
   * Get duration info from ISO 8601 string
   * @param iso8601Duration ISO 8601 duration
   * @returns Duration object
   */
  static getDurationInfo(iso8601Duration: string): Duration {
    const predefined = Object.values(PREDEFINED_DURATIONS)
      .find(d => d.iso8601 === iso8601Duration);
    
    if (predefined) return predefined;
    
    // Custom duration
    const months = this.parseToMonths(iso8601Duration);
    return {
      iso8601: iso8601Duration,
      displayName: months ? `${months} Month${months > 1 ? 's' : ''}` : 'Custom Duration',
      months
    };
  }

  /**
   * Convert legacy string duration to ISO 8601
   * @param legacyDuration Legacy string duration
   * @returns ISO 8601 duration
   */
  static fromLegacyDuration(legacyDuration: string): string {
    const normalized = legacyDuration.toLowerCase().trim();
    const durationType = LEGACY_DURATION_MAP[normalized];
    
    if (durationType) {
      return PREDEFINED_DURATIONS[durationType].iso8601;
    }
    
    throw new Error(`Unknown legacy duration format: ${legacyDuration}`);
  }

  /**
   * Validate ISO 8601 duration format
   * @param duration Duration string to validate
   * @returns boolean
   */
  static isValidISO8601Duration(duration: string): boolean {
    try {
      // Basic validation for our supported formats
      if (duration === 'PT0S') return true; // Lifetime
      
      const monthPattern = /^P\d+M$/;
      const yearPattern = /^P\d+Y$/;
      
      return monthPattern.test(duration) || yearPattern.test(duration);
    } catch {
      return false;
    }
  }
}

// Export types for use in models and services
export { SubscriptionDurationType as DurationType }; 