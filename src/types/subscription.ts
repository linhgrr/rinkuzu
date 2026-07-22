// Rinkuzu currently sells one renewable monthly Premium plan.
export enum SubscriptionDurationType {
  MONTHLY = 'P1M',
}

interface Duration {
  iso8601: string; // ISO 8601 format (P1M, P3M, P1Y, etc.)
  displayName: string; // Human readable (1 Month, 3 Months, etc.)
  months: number;
}

export const PREDEFINED_DURATIONS: Record<SubscriptionDurationType, Duration> = {
  [SubscriptionDurationType.MONTHLY]: {
    iso8601: 'P1M',
    displayName: '1 Month',
    months: 1,
  },
};

export class DurationUtils {
  /**
   * Parse ISO 8601 duration string to get months
   * @param iso8601Duration ISO 8601 duration (P1M, P3M, P1Y, etc.)
   * @returns number of months
   */
  static parseToMonths(iso8601Duration: string): number {
    if (iso8601Duration === SubscriptionDurationType.MONTHLY) return 1;
    throw new Error(`Unsupported ISO 8601 duration format: ${iso8601Duration}`);
  }

  /**
   * Calculate end date from start date and duration
   * @param startDate Start date
   * @param iso8601Duration ISO 8601 duration
   * @returns End date
   */
  static calculateEndDate(startDate: Date, iso8601Duration: string): Date {
    const months = this.parseToMonths(iso8601Duration);
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
    const predefined = Object.values(PREDEFINED_DURATIONS).find(
      (d) => d.iso8601 === iso8601Duration,
    );

    if (predefined) return predefined;

    throw new Error(`Unsupported subscription duration: ${iso8601Duration}`);
  }

  /**
   * Validate ISO 8601 duration format
   * @param duration Duration string to validate
   * @returns boolean
   */
  static isValidISO8601Duration(duration: string): boolean {
    try {
      return duration === SubscriptionDurationType.MONTHLY;
    } catch {
      return false;
    }
  }
}
