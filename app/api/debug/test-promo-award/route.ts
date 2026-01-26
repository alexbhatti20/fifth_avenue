import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// Test endpoint to debug promo code generation
export async function POST(request: NextRequest) {
  const supabase = createClient();
  
  try {
    const { customerId } = await request.json();
    
    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    const results: any = {
      customerId,
      steps: [],
    };

    // Step 1: Get customer total points from loyalty_points table
    const { data: pointsData, error: pointsError } = await supabase
      .from('loyalty_points')
      .select('points')
      .eq('customer_id', customerId);
    
    const totalPoints = pointsData?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;
    results.steps.push({
      step: 1,
      name: 'Get customer loyalty points',
      totalPoints,
      pointsRecords: pointsData?.length || 0,
      error: pointsError?.message,
    });

    // Step 2: Check perks_settings table for loyalty_thresholds
    const { data: thresholdSettings, error: thresholdError } = await supabase
      .from('perks_settings')
      .select('setting_value, is_active')
      .eq('setting_key', 'loyalty_thresholds')
      .eq('is_active', true)
      .single();
    
    results.steps.push({
      step: 2,
      name: 'Get loyalty thresholds from perks_settings',
      thresholds: thresholdSettings?.setting_value,
      isActive: thresholdSettings?.is_active,
      error: thresholdError?.message,
    });

    // Step 3: Get already awarded promo codes for this customer
    const { data: awardedPromos, error: awardedError } = await supabase
      .from('customer_promo_codes')
      .select('loyalty_points_required, code, is_used')
      .eq('customer_id', customerId);
    
    const alreadyAwardedThresholds = awardedPromos?.map(p => p.loyalty_points_required) || [];
    results.steps.push({
      step: 3,
      name: 'Get already awarded promo codes',
      awardedPromos,
      alreadyAwardedThresholds,
      error: awardedError?.message,
    });

    // Step 4: Determine which threshold the customer qualifies for
    const thresholds = thresholdSettings?.setting_value || [];
    let eligibleThreshold = null;
    
    if (Array.isArray(thresholds)) {
      // Sort by points DESC to get highest first
      const sortedThresholds = [...thresholds].sort((a: any, b: any) => b.points - a.points);
      
      for (const threshold of sortedThresholds) {
        const thresholdPoints = threshold.points;
        if (totalPoints >= thresholdPoints && !alreadyAwardedThresholds.includes(thresholdPoints)) {
          eligibleThreshold = threshold;
          break;
        }
      }
    }
    
    results.steps.push({
      step: 4,
      name: 'Determine eligible threshold',
      customerPoints: totalPoints,
      eligibleThreshold,
      wouldGeneratePromo: !!eligibleThreshold,
    });

    // Step 5: Summary
    results.summary = {
      customerTotalPoints: totalPoints,
      thresholdsConfigured: Array.isArray(thresholds) ? thresholds.length : 0,
      alreadyAwardedCount: alreadyAwardedThresholds.length,
      eligibleForNewPromo: !!eligibleThreshold,
      eligibleThresholdPoints: eligibleThreshold?.points || null,
      eligiblePromoName: eligibleThreshold?.promo_name || null,
      eligiblePromoValue: eligibleThreshold?.promo_value || null,
    };

    // Check if there are any issues
    results.issues = [];
    
    if (thresholdError) {
      results.issues.push('Cannot read perks_settings table - RLS or table missing');
    }
    if (!thresholdSettings?.setting_value) {
      results.issues.push('No loyalty_thresholds configured in perks_settings');
    }
    if (awardedError) {
      results.issues.push('Cannot read customer_promo_codes table - RLS or table missing');
    }
    if (totalPoints === 0) {
      results.issues.push('Customer has 0 loyalty points');
    }
    if (totalPoints > 0 && !eligibleThreshold && alreadyAwardedThresholds.length > 0) {
      results.issues.push('Customer already received promo for all eligible thresholds');
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

