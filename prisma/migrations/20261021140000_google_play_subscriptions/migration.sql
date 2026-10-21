-- Google Play Billing becomes the third store that can bill a plan.
ALTER TYPE "SubscriptionProvider" ADD VALUE 'GOOGLE' BEFORE 'GRANT';
