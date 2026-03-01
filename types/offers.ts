// Special Offers Types

export type OfferDiscountType = 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bundle_price';
export type OfferStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'expired';
export type OfferTargetType = 'storewide' | 'menu_items' | 'deals' | 'both';

export interface SpecialOffer {
  id: string;
  name: string;
  slug: string;
  description?: string;
  event_type?: string;
  
  // Visual Assets
  banner_image?: string;
  popup_image?: string;
  thumbnail_image?: string;
  background_color?: string;
  theme_colors?: {
    primary?: string;
    secondary?: string;
  };
  pakistani_flags?: boolean;
  confetti_enabled?: boolean;
  custom_css?: string;
  
  // Discount Settings
  discount_type: OfferDiscountType;
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  
  // Target - menu items or deals
  target_type?: OfferTargetType;
  
  // Timing
  start_date: string;
  end_date: string;
  show_popup: boolean;
  popup_auto_close_seconds: number;
  
  // Visibility
  status: OfferStatus;
  is_visible: boolean;
  show_on_landing: boolean;
  show_in_menu: boolean;
  priority: number;
  
  // Notification Settings
  notify_via_email: boolean;
  notify_via_push: boolean;
  notification_sent_at?: string;
  notification_scheduled_at?: string;
  auto_notify_on_start: boolean;
  
  // Stats (optional - not actively displayed)
  view_count?: number;
  click_count?: number;
  conversion_count?: number;
  
  // Items
  items_count?: number;
  items?: SpecialOfferItem[];
  
  // Deals
  deals?: SpecialOfferDeal[];
  
  // Audit
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SpecialOfferItem {
  id: string;
  menu_item_id: string;
  menu_item?: {
    id?: string;
    name: string;
    slug: string;
    images?: string[];
    description?: string;
    price?: number;
  };
  original_price: number;
  offer_price: number;
  discount_percentage: number;
  size_variant?: string;
  max_quantity_per_order?: number;
  total_available_quantity?: number;
  quantity_sold?: number;
  sort_order?: number;
}

export interface SpecialOfferDeal {
  id: string;
  deal_id: string;
  deal?: {
    id?: string;
    name: string;
    slug?: string;
    image?: string;
    original_price?: number;
  };
  original_price: number;
  offer_price: number;
  discount_percentage: number;
}

export interface OfferFormData {
  name: string;
  description: string;
  event_type: string;
  discount_type: OfferDiscountType;
  discount_value: string; // String for better input handling
  start_date: string;
  end_date: string;
  banner_image?: string;
  popup_image?: string;
  theme_colors: {
    primary: string;
    secondary: string;
  };
  pakistani_flags: boolean;
  confetti_enabled: boolean;
  show_popup: boolean;
  popup_auto_close_seconds: number;
  min_order_amount: string; // String for better input handling
  max_discount_amount?: string;
  notify_via_email: boolean;
  notify_via_push: boolean;
  auto_notify_on_start: boolean;
  target_type: OfferTargetType;
}

// Default offer name suggestions
export const OFFER_NAME_SUGGESTIONS = [
  '🌙 Eid Special Discount',
  '🌙 Eid ul-Fitr Feast',
  '🐑 Eid ul-Adha BBQ Bonanza',
  '☪️ Ramadan Iftar Deal',
  '☪️ Sehri Special Bundle',
  '🇵🇰 Pakistan Day Celebration',
  '🇵🇰 Independence Day Sale',
  '🇵🇰 Azadi Mubarak Offer',
  '⭐ Quaid Day Special',
  '🎆 New Year Blast',
  '❤️ Valentine\'s Couple Deal',
  '💐 Mother\'s Day Treat',
  '👔 Father\'s Day Feast',
  '🎉 Weekend Special',
  '⚡ Flash Sale - Limited Time',
  '🎂 Anniversary Special',
  '🎊 Grand Opening Offer',
  '🍗 Family Bucket Deal',
  '🔥 Hot & Spicy Special',
  '🥤 Combo Meal Discount',
  '🎁 Buy 1 Get 1 Free',
  '💰 Student Discount',
  '🏢 Office Lunch Deal',
  '🌃 Late Night Special',
  '☀️ Summer Sizzler',
  '❄️ Winter Warmer',
] as const;

// Event types for Pakistani/Muslim events
export const OFFER_EVENT_TYPES = [
  { value: 'eid_ul_fitr', label: '🌙 Eid ul-Fitr', emoji: '🌙' },
  { value: 'eid_ul_adha', label: '🐑 Eid ul-Adha', emoji: '🐑' },
  { value: 'ramadan', label: '☪️ Ramadan', emoji: '☪️' },
  { value: 'pakistan_day', label: '🇵🇰 Pakistan Day (23 March)', emoji: '🇵🇰' },
  { value: 'independence_day', label: '🇵🇰 Independence Day (14 Aug)', emoji: '🇵🇰' },
  { value: 'quaid_day', label: '⭐ Quaid Day (25 Dec)', emoji: '⭐' },
  { value: 'iqbal_day', label: '📚 Iqbal Day (9 Nov)', emoji: '📚' },
  { value: 'kashmir_day', label: '🖤 Kashmir Day (5 Feb)', emoji: '🖤' },
  { value: 'labour_day', label: '👷 Labour Day (1 May)', emoji: '👷' },
  { value: 'new_year', label: '🎆 New Year', emoji: '🎆' },
  { value: 'valentines', label: '❤️ Valentine\'s Day', emoji: '❤️' },
  { value: 'mothers_day', label: '💐 Mother\'s Day', emoji: '💐' },
  { value: 'fathers_day', label: '👔 Father\'s Day', emoji: '👔' },
  { value: 'weekend_special', label: '🎉 Weekend Special', emoji: '🎉' },
  { value: 'flash_sale', label: '⚡ Flash Sale', emoji: '⚡' },
  { value: 'anniversary', label: '🎂 Anniversary', emoji: '🎂' },
  { value: 'grand_opening', label: '🎊 Grand Opening', emoji: '🎊' },
  { value: 'custom', label: '✨ Custom Event', emoji: '✨' },
] as const;

// Simplified theme - just animated red Zoiro brand
export const OFFER_THEME_PRESET = {
  name: 'Zoiro Red',
  primary: '#dc2626',
  secondary: '#fef2f2',
  gradient: 'from-red-500 via-red-600 to-red-700',
} as const;
