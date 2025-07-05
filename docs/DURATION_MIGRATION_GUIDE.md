# Duration Migration Guide: String to ISO 8601

## Overview

This guide covers the migration from legacy string-based duration format to standardized ISO 8601 duration format for subscription plans.

## Problem with Legacy Format

### Before (Legacy String Format)
```javascript
{
  duration: "1 tháng"    // Inconsistent
  duration: "3 months"   // Multiple languages
  duration: "lifetime"   // Ad-hoc values
}
```

### Issues:
- ❌ **Not standardized** - Multiple languages and formats
- ❌ **Hard to calculate** - Requires string parsing
- ❌ **Not machine-readable** - No international standard
- ❌ **Difficult to extend** - Adding new durations is complex
- ❌ **Query inefficient** - Database operations are slow

## Solution: ISO 8601 Duration Format

### After (ISO 8601 Standard)
```javascript
{
  duration: "P1M"    // 1 month
  duration: "P3M"    // 3 months  
  duration: "P1Y"    // 1 year
  duration: "PT0S"   // lifetime (special case)
}
```

### Benefits:
- ✅ **International standard** - ISO 8601 globally recognized
- ✅ **Machine readable** - Easy parsing and calculation
- ✅ **Type safe** - Proper validation
- ✅ **Database efficient** - Better indexing and querying
- ✅ **Future proof** - Easy to extend with new durations

## ISO 8601 Duration Format

### Structure
```
P[n]Y[n]M[n]DT[n]H[n]M[n]S
│ │   │   │  │ │   │   │
│ │   │   │  │ │   │   └─ Seconds
│ │   │   │  │ │   └───── Minutes  
│ │   │   │  │ └───────── Hours
│ │   │   │  └─────────── Time separator
│ │   │   └──────────── Days
│ │   └──────────────── Months
│ └──────────────────── Years
└────────────────────── Period indicator (required)
```

### Our Usage
```typescript
enum SubscriptionDurationType {
  MONTHLY = 'P1M',      // 1 month
  QUARTERLY = 'P3M',    // 3 months
  SEMI_ANNUAL = 'P6M',  // 6 months
  ANNUAL = 'P1Y',       // 1 year
  LIFETIME = 'PT0S'     // Special: infinite duration
}
```

## Migration Strategy

### 1. Backward Compatibility
The system supports both old and new formats during transition:

```typescript
// Plan model includes migration logic
PlanSchema.pre('save', function(this: IPlan) {
  if (!DurationUtils.isValidISO8601Duration(this.duration)) {
    try {
      this.duration = DurationUtils.fromLegacyDuration(this.duration)
    } catch (error) {
      console.warn(`Could not migrate duration`)
    }
  }
})
```

### 2. Virtual Properties
Plans expose both formats for compatibility:

```typescript
plan.duration        // "P1M" (ISO 8601)
plan.durationInfo    // { iso8601: "P1M", displayName: "1 Month", months: 1 }
plan.isLifetime      // false
```

### 3. Legacy Mapping
```typescript
const LEGACY_DURATION_MAP = {
  '1 tháng': 'P1M',
  '3 tháng': 'P3M', 
  '6 tháng': 'P6M',
  '12 tháng': 'P1Y',
  'lifetime': 'PT0S'
}
```

## Migration Process

### Step 1: Dry Run
Preview what changes will be made:
```bash
node src/scripts/migratePlanDurations.js dry-run
```

### Step 2: Execute Migration
Apply the changes:
```bash
node src/scripts/migratePlanDurations.js migrate
```

### Step 3: Seed New Plans
Create plans with proper ISO 8601 format:
```bash
node src/scripts/seedPlansWithISO8601.js seed
```

### Step 4: Validate
Ensure all plans use correct format:
```bash
node src/scripts/seedPlansWithISO8601.js validate
```

## Updated Code Examples

### Duration Calculation
```typescript
// Before (Legacy)
const durationText = plan.duration.toLowerCase();
if (durationText.includes('tháng')) {
  const months = parseInt(durationText.match(/\d+/)?.[0] || '0');
  endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);
}

// After (ISO 8601)
const endDate = DurationUtils.calculateEndDate(startDate, plan.duration);
```

### Plan Creation
```typescript
// Before
const plan = {
  duration: "3 tháng"
}

// After  
const plan = {
  duration: SubscriptionDurationType.QUARTERLY // "P3M"
}
```

### API Response
```typescript
// Before
{
  "duration": "1 tháng"
}

// After
{
  "duration": "P1M",
  "durationInfo": {
    "iso8601": "P1M",
    "displayName": "1 Month", 
    "months": 1
  },
  "isLifetime": false
}
```

## Frontend Updates

### Display Duration
```typescript
// Use the displayName for user-facing text
const durationText = plan.durationInfo.displayName; // "1 Month"

// Use months for calculations
const monthlyPrice = plan.price / (plan.durationInfo.months || 1);
```

### Duration Selection
```typescript
const durations = [
  { value: 'P1M', label: '1 Month', months: 1 },
  { value: 'P3M', label: '3 Months', months: 3 },
  { value: 'P6M', label: '6 Months', months: 6 },
  { value: 'P1Y', label: '1 Year', months: 12 },
  { value: 'PT0S', label: 'Lifetime', months: null }
];
```

## Database Schema Changes

### Plan Model
```typescript
interface IPlan {
  duration: string // ISO 8601 format
  
  // Virtual fields
  readonly durationInfo: Duration
  readonly isLifetime: boolean
}
```

### Validation
```typescript
duration: {
  type: String,
  required: true,
  validate: {
    validator: function(value: string) {
      return DurationUtils.isValidISO8601Duration(value) || 
             canConvertFromLegacy(value);
    }
  }
}
```

## Testing

### Unit Tests
```typescript
describe('DurationUtils', () => {
  it('should parse ISO 8601 durations correctly', () => {
    expect(DurationUtils.parseToMonths('P1M')).toBe(1);
    expect(DurationUtils.parseToMonths('P3M')).toBe(3);
    expect(DurationUtils.parseToMonths('P1Y')).toBe(12);
    expect(DurationUtils.parseToMonths('PT0S')).toBeUndefined();
  });
  
  it('should convert legacy formats', () => {
    expect(DurationUtils.fromLegacyDuration('1 tháng')).toBe('P1M');
    expect(DurationUtils.fromLegacyDuration('lifetime')).toBe('PT0S');
  });
});
```

### Integration Tests
```typescript
describe('Plan Model', () => {
  it('should migrate legacy duration on save', async () => {
    const plan = new Plan({
      duration: '1 tháng',
      name: 'Test Plan'
    });
    
    await plan.save();
    expect(plan.duration).toBe('P1M');
  });
});
```

## Rollback Plan

If issues arise, revert by:

1. **Database Rollback**: Restore from backup before migration
2. **Code Rollback**: Remove ISO 8601 validation temporarily
3. **Manual Fix**: Update individual plans via admin interface

## Best Practices

### 1. Always Use Enums
```typescript
// Good
duration: SubscriptionDurationType.MONTHLY

// Bad  
duration: "P1M"
```

### 2. Use Utility Functions
```typescript
// Good
const endDate = DurationUtils.calculateEndDate(startDate, duration);

// Bad
const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
```

### 3. Handle Lifetime Subscriptions
```typescript
if (plan.isLifetime) {
  // No expiration date
  endDate = undefined;
} else {
  endDate = DurationUtils.calculateEndDate(startDate, plan.duration);
}
```

### 4. Validate Input
```typescript
if (!DurationUtils.isValidISO8601Duration(duration)) {
  throw new Error('Invalid duration format');
}
```

## Production Checklist

- [ ] Run dry-run migration in staging
- [ ] Backup production database
- [ ] Execute migration during low traffic period
- [ ] Validate all plans after migration
- [ ] Monitor for errors in logs
- [ ] Update frontend components if needed
- [ ] Test payment flow end-to-end
- [ ] Document any issues encountered

## Support

For questions or issues:
1. Check migration logs for errors
2. Validate specific plans using utility functions
3. Use admin panel to manually fix problematic plans
4. Refer to ISO 8601 documentation for complex durations

## References

- [ISO 8601 Duration Format](https://en.wikipedia.org/wiki/ISO_8601#Durations)
- [PostgreSQL Interval Types](https://www.postgresql.org/docs/current/datatype-datetime.html)
- [JavaScript Date Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) 