# Loyalty Promo Code Auto-Generation Fix

## Problem Identified

Auto-promo code generation based on loyalty point thresholds was **not working consistently** for customers who qualified for rewards.

### Root Cause Analysis

1. **Existing Implementation (Partial)**:
   - Auto-promo generation code exists in `billing-rpc.sql` (lines 807-896)
   - It **only runs when generating an invoice** via `generate_advanced_invoice()`
   - Awards only **ONE promo code per invoice** (the highest threshold)
   
2. **Critical Gap**:
   - For **dine-in/walk-in orders**, bills are often not generated immediately
   - When you removed the "Generate Bill" button from the success dialog (previous fix), promo codes stopped being awarded
   - Customers earning points through multiple small orders never reached the threshold check
   - Points were inserted into `loyalty_points` table, but no trigger checked for threshold qualification

3. **Why It Failed**:
   ```
   Customer earns points → Inserted into loyalty_points → NO CHECK HAPPENS
                                                        ↓
                                            (Promo codes never generated)
   ```

   **Old flow (only when billing)**:
   ```
   Generate Bill → Check thresholds → Award ONE promo code → Done
   ```

## Solution Implemented

Created a **database trigger** that automatically checks and awards promo codes **whenever points are earned**, not just when bills are generated.

### Files Created

#### 1. `supabase/loyalty-promo-trigger.sql`
New trigger-based auto-promo system that:
- ✅ Fires **AFTER INSERT** on `loyalty_points` table
- ✅ Only processes "earned" type points (not redeemed/adjusted)
- ✅ Calculates customer's total points
- ✅ Checks all configured thresholds from `perks_settings.loyalty_thresholds`
- ✅ Awards **ALL eligible thresholds** the customer qualifies for
- ✅ Prevents duplicate awards using `promo_codes.loyalty_points_required` tracking
- ✅ Generates unique promo codes (format: `ZOIRO-XXXXXXXX`)
- ✅ Configurable expiry from `perks_settings.promo_expiry_days`
- ✅ Gracefully handles errors without breaking point insertion

### How It Works Now

```
Customer completes order → Points earned → Inserted into loyalty_points
                                                      ↓
                                         TRIGGER FIRES AUTOMATICALLY
                                                      ↓
                                         Calculate total customer points
                                                      ↓
                                         Check all thresholds (highest to lowest)
                                                      ↓
                      For each threshold customer qualifies for (that hasn't been awarded):
                                                      ↓
                                    Generate unique promo code (ZOIRO-XXXXXXXX)
                                                      ↓
                                    Insert into promo_codes table
                                                      ↓
                                    Link to customer with loyalty_points_required
                                                      ↓
                                         Continue to next threshold
                                                      ↓
                                              Customer gets ALL rewards!
```

### Current Loyalty Thresholds (from perks_settings)

| Points Required | Reward Type | Value | Max Discount | Promo Name |
|----------------|-------------|-------|--------------|------------|
| 100 | Percentage | 5% | Rs. 100 | Bronze Reward |
| 250 | Percentage | 10% | Rs. 250 | Silver Reward |
| 500 | Percentage | 15% | Rs. 500 | Gold Reward |
| 1000 | Fixed Amount | Rs. 200 | No limit | Platinum Reward |

**Example Scenario**:
- Customer earns 520 points total
- Trigger automatically awards:
  - ✅ Bronze Reward (100 pts) - 5% off up to Rs. 100
  - ✅ Silver Reward (250 pts) - 10% off up to Rs. 250
  - ✅ Gold Reward (500 pts) - 15% off up to Rs. 500
  - ❌ Platinum Reward (1000 pts) - Not qualified yet

### Integration Points

The trigger works seamlessly with existing code:

1. **Order Creation** (`create-order-rpc.sql`):
   - Points inserted into `loyalty_points` → Trigger fires → Promos awarded

2. **Billing** (`billing-rpc.sql`):
   - Points inserted into `loyalty_points` → Trigger fires → Promos awarded
   - **Note**: Billing RPC also has its own promo awarding code (lines 807-896), but trigger provides additional safety net

3. **Customer Portal**:
   - Customer views rewards on loyalty page
   - Promo codes automatically appear when thresholds are reached

### Deployment Instructions

1. **Run the SQL file**:
   ```bash
   # In Supabase SQL Editor, run:
   supabase/loyalty-promo-trigger.sql
   ```

2. **Verify Installation**:
   ```sql
   -- Check trigger exists
   SELECT * FROM pg_trigger WHERE tgname = 'loyalty_points_award_promo_trigger';
   
   -- Check function exists
   SELECT proname FROM pg_proc WHERE proname = 'award_loyalty_promo_on_points_insert';
   ```

3. **Test the System**:
   ```sql
   -- Insert test points for a customer
   INSERT INTO loyalty_points (customer_id, points, type, description)
   VALUES ('your-customer-uuid', 100, 'earned', 'Test points');
   
   -- Check if promo was auto-generated
   SELECT * FROM promo_codes 
   WHERE customer_id = 'your-customer-uuid' 
   ORDER BY created_at DESC;
   ```

### Benefits of This Approach

✅ **Automatic**: No manual intervention needed
✅ **Real-time**: Promos awarded instantly when points are earned
✅ **Comprehensive**: Awards ALL thresholds customer qualifies for
✅ **Safe**: Prevents duplicate awards for same threshold
✅ **Resilient**: Errors don't break point insertion
✅ **Flexible**: Uses perks_settings configuration (can be updated via UI)
✅ **Auditable**: Logs notices in database logs
✅ **Compatible**: Works with existing billing and order creation flows

### Configuration

Thresholds can be updated via the Perks & Loyalty page in the portal:
- Navigate to `/portal/perks`
- Edit "Loyalty Thresholds" section
- Changes apply immediately to new point insertions

### Monitoring

Check auto-awarded promos:
```sql
-- Recently auto-awarded promo codes
SELECT 
    pc.code,
    pc.name,
    pc.loyalty_points_required,
    c.name as customer_name,
    pc.created_at
FROM promo_codes pc
JOIN customers c ON c.id = pc.customer_id
WHERE pc.loyalty_points_required IS NOT NULL
ORDER BY pc.created_at DESC
LIMIT 50;

-- Customer points vs promo awards
SELECT 
    c.name,
    COALESCE(SUM(lp.points), 0) as total_points,
    COUNT(DISTINCT pc.id) as promo_codes_received
FROM customers c
LEFT JOIN loyalty_points lp ON lp.customer_id = c.id
LEFT JOIN promo_codes pc ON pc.customer_id = c.id 
    AND pc.loyalty_points_required IS NOT NULL
GROUP BY c.id, c.name
ORDER BY total_points DESC;
```

## What Changed

| Before | After |
|--------|-------|
| Promos only awarded during billing | Promos awarded whenever points are earned |
| Only ONE promo per invoice | ALL eligible promos awarded immediately |
| Dine-in orders without bills = No promos | Dine-in orders get promos automatically |
| Manual intervention needed | Fully automatic |
| Customers missed rewards | Every qualified customer gets their rewards |

## Next Steps

1. ✅ Run `loyalty-promo-trigger.sql` in Supabase SQL Editor
2. ✅ Test with a few customers to verify promo generation
3. ✅ Monitor database logs for any trigger errors
4. ✅ Update customers who missed past rewards (optional backfill)

### Optional: Backfill Past Rewards

To award promos to customers who already qualified but didn't receive them:

```sql
-- This will check all customers and award missing thresholds
DO $$
DECLARE
    customer_record RECORD;
BEGIN
    FOR customer_record IN 
        SELECT DISTINCT customer_id 
        FROM loyalty_points 
        WHERE customer_id IS NOT NULL
    LOOP
        -- Insert a dummy point entry to trigger the promo check
        -- Then immediately remove it
        INSERT INTO loyalty_points (customer_id, points, type, description)
        VALUES (customer_record.customer_id, 0, 'earned', 'Backfill check');
        
        DELETE FROM loyalty_points 
        WHERE customer_id = customer_record.customer_id 
        AND points = 0 
        AND description = 'Backfill check';
    END LOOP;
END $$;
```

## Troubleshooting

### Promos not generating?

1. **Check perks_settings**:
   ```sql
   SELECT * FROM perks_settings WHERE setting_key = 'loyalty_thresholds';
   ```

2. **Check trigger is enabled**:
   ```sql
   SELECT tgname, tgenabled FROM pg_trigger 
   WHERE tgname = 'loyalty_points_award_promo_trigger';
   ```

3. **Check customer's total points**:
   ```sql
   SELECT customer_id, SUM(points) as total
   FROM loyalty_points
   WHERE customer_id = 'your-customer-uuid'
   GROUP BY customer_id;
   ```

4. **Check already awarded thresholds**:
   ```sql
   SELECT DISTINCT loyalty_points_required
   FROM promo_codes
   WHERE customer_id = 'your-customer-uuid'
   AND loyalty_points_required IS NOT NULL;
   ```

### Database Logs

Check PostgreSQL logs in Supabase dashboard for:
- `Auto-awarded promo code ZOIRO-XXXXXXXX to customer...` (success)
- `Failed to award loyalty promo: ...` (errors)

---

**Status**: ✅ Ready to deploy
**Impact**: High - Fixes critical loyalty reward system
**Risk**: Low - Trigger has error handling, won't break existing flows
**Testing**: Recommended before production deployment
