export enum SubscriptionDurationType {
  MONTHLY = 'P1M',
  SIX_MONTHS = 'P6M',
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
  [SubscriptionDurationType.SIX_MONTHS]: {
    iso8601: 'P6M',
    displayName: '6 Months',
    months: 6,
  },
};

export class DurationUtils {
  /**
   * Parse ISO 8601 duration string to get months
   * @param iso8601Duration ISO 8601 duration (P1M, P3M, P1Y, etc.)
   * @returns number of months
   */
  static parseToMonths(iso8601Duration: string): number {
    const duration = Object.values(PREDEFINED_DURATIONS).find(
      (candidate) => candidate.iso8601 === iso8601Duration,
    );

    if (!duration) {
      throw new Error(`Unsupported ISO 8601 duration format: ${iso8601Duration}`);
    }

    return duration.months;
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
    const originalDay = endDate.getUTCDate();

    // Move from day one so dates such as August 31 do not overflow into March.
    endDate.setUTCDate(1);
    endDate.setUTCMonth(endDate.getUTCMonth() + months);
    const lastDayOfTargetMonth = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0),
    ).getUTCDate();
    endDate.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));

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
    return Object.values(PREDEFINED_DURATIONS).some((candidate) => candidate.iso8601 === duration);
  }
}
