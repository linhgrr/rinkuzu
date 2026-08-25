import type { PipelineStage } from 'mongoose';

/**
 * Present the canonical entitlement-account projection through the existing
 * user/profile DTO shape. No field from users.subscription participates.
 */
export function buildEntitlementAccountProjection(): PipelineStage[] {
  return [
    {
      $lookup: {
        from: 'entitlementaccounts',
        localField: '_id',
        foreignField: 'user',
        as: 'entitlementAccount',
      },
    },
    { $set: { entitlementAccount: { $first: '$entitlementAccount' } } },
    {
      $set: {
        subscription: {
          $cond: [
            {
              $and: [
                { $eq: [{ $type: '$entitlementAccount.planId' }, 'string'] },
                { $eq: [{ $type: '$entitlementAccount.planName' }, 'string'] },
                { $eq: [{ $type: '$entitlementAccount.currentStartAt' }, 'date'] },
              ],
            },
            {
              planId: '$entitlementAccount.planId',
              planName: '$entitlementAccount.planName',
              startDate: '$entitlementAccount.currentStartAt',
              endDate: '$entitlementAccount.currentEndAt',
              isActive: {
                $and: [
                  { $lte: ['$entitlementAccount.currentStartAt', '$$NOW'] },
                  {
                    $or: [
                      { $eq: ['$entitlementAccount.perpetual', true] },
                      { $gt: ['$entitlementAccount.currentEndAt', '$$NOW'] },
                    ],
                  },
                ],
              },
            },
            '$$REMOVE',
          ],
        },
      },
    },
    { $unset: 'entitlementAccount' },
  ];
}
