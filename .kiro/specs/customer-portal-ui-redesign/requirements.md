# Requirements Document

## Introduction

This feature updates all customer portal UI pages to match the Fifth Avenue brand design system currently implemented on the home page. The redesign applies consistent typography, color schemes, brutalist/urban design patterns, and mobile-responsive layouts across all customer-facing pages while maintaining existing functionality and backend integration.

## Glossary

- **Fifth_Avenue_Design_System**: The brand design system featuring Fifth Avenue Yellow (#FFD200), Fifth Avenue Green (#008A45), Fifth Avenue Red (#ED1C24), brutalist/urban aesthetic with bold borders, box shadows, and blocky components
- **Customer_Portal**: The collection of authenticated customer-facing pages including loyalty, orders, settings, favorites, cart, payments, reviews, menu, book-online, offers, and contact
- **UI_Component**: A visual interface element such as buttons, cards, headers, forms, or navigation elements
- **Mobile_Responsive**: UI that adapts to mobile screen sizes with touch-friendly targets (min 44px), safe area insets, and optimized layouts
- **Brutalist_Pattern**: Design pattern featuring thick borders (border-4), box shadows (shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]), blocky angular components, and high contrast
- **Typography_System**: Font hierarchy using font-bebas for headings (uppercase, tracking-wide), font-source-sans for body text, and font-caveat for taglines (italic, accent color)
- **Backend_Integration**: Existing API routes, data fetching logic, and server-side functionality that must remain unchanged
- **Street_Themed_Language**: Brand-specific terminology like "SQUAD", "STREETS", "STREET CRED" used throughout the UI

## Requirements

### Requirement 1: Apply Fifth Avenue Color Scheme

**User Story:** As a customer, I want all portal pages to use consistent Fifth Avenue brand colors, so that I have a cohesive visual experience across the entire application.

#### Acceptance Criteria

1. THE UI_Component SHALL use Fifth Avenue Yellow (#FFD200) as the primary color for buttons, highlights, and interactive elements
2. THE UI_Component SHALL use Fifth Avenue Green (#008A45) as the secondary color for success states and secondary actions
3. THE UI_Component SHALL use Fifth Avenue Red (#ED1C24) as the accent color for important alerts, badges, and emphasis elements
4. THE UI_Component SHALL use Black (#1A1A1A) as the foreground color for text and borders
5. THE UI_Component SHALL use Light Cream (#F8F8F8) as the background color for page backgrounds
6. WHEN a page uses the landing theme, THE UI_Component SHALL apply the fa-landing-theme class with background color hsl(44 100% 90%)

### Requirement 2: Implement Typography System

**User Story:** As a customer, I want all portal pages to use consistent typography, so that the text is readable and matches the brand identity.

#### Acceptance Criteria

1. THE UI_Component SHALL use font-bebas for all heading elements (h1, h2, h3, h4, h5, h6) with uppercase transformation and tracking-wide spacing
2. THE UI_Component SHALL use font-source-sans for all body text, labels, and paragraph content
3. THE UI_Component SHALL use font-caveat with italic styling and accent color for tagline elements
4. WHEN displaying headings on mobile, THE UI_Component SHALL reduce font sizes appropriately (h1: text-2xl, h2: text-xl, h3: text-lg)
5. THE UI_Component SHALL apply letter-spacing of 0.01em to body text for improved readability

### Requirement 3: Apply Brutalist Design Patterns

**User Story:** As a customer, I want the portal pages to have a distinctive urban/brutalist aesthetic, so that the brand identity is consistent and memorable.

#### Acceptance Criteria

1. THE UI_Component SHALL apply border-4 or border-6 with border-black to all card components and containers
2. THE UI_Component SHALL apply box shadow shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] to elevated card components
3. THE UI_Component SHALL use rounded-none (no border radius) for buttons and primary interactive elements
4. THE UI_Component SHALL apply blocky, angular design patterns avoiding soft curves and gradients except for brand-approved gradient overlays
5. WHEN a user hovers over interactive elements, THE UI_Component SHALL translate the element by [2px, 2px] and remove the shadow for a pressed effect
6. THE UI_Component SHALL use high contrast color combinations (black on yellow, white on black, yellow on black)

### Requirement 4: Implement Mobile-Responsive Layouts

**User Story:** As a mobile customer, I want all portal pages to be fully responsive and touch-friendly, so that I can easily navigate and interact on my smartphone.

#### Acceptance Criteria

1. THE UI_Component SHALL ensure all interactive elements have a minimum touch target size of 44px height
2. THE UI_Component SHALL apply safe area insets using env(safe-area-inset-*) for notched devices
3. WHEN the viewport width is less than 768px, THE UI_Component SHALL stack horizontal layouts vertically using flex-col
4. WHEN the viewport width is less than 768px, THE UI_Component SHALL reduce padding from p-8 to p-3 or p-4
5. THE UI_Component SHALL prevent iOS zoom on input focus by setting font-size to 16px minimum
6. THE UI_Component SHALL disable heavy animations on mobile (max-width: 768px) for better performance
7. THE UI_Component SHALL use -webkit-overflow-scrolling: touch for smooth scroll momentum on mobile
8. THE UI_Component SHALL apply backdrop-blur effects sparingly on mobile to maintain performance

### Requirement 5: Update Favorites Page UI

**User Story:** As a customer, I want the favorites page to match the Fifth Avenue design system, so that my saved items are displayed in a visually consistent manner.

#### Acceptance Criteria

1. THE Favorites_Page SHALL display a brutalist-style page header with font-bebas heading "MY FAVORITES" or "STREET FAVORITES"
2. THE Favorites_Page SHALL render favorite items in cards with border-4 border-black and box shadows
3. THE Favorites_Page SHALL use Fifth Avenue Yellow for primary action buttons (Add to Cart)
4. WHEN the favorites list is empty, THE Favorites_Page SHALL display an empty state with street-themed messaging
5. THE Favorites_Page SHALL be mobile-responsive with stacked card layouts on screens less than 768px wide

### Requirement 6: Update Cart Page UI

**User Story:** As a customer, I want the cart page to match the Fifth Avenue design system, so that my shopping experience is cohesive and visually appealing.

#### Acceptance Criteria

1. THE Cart_Page SHALL display a brutalist-style page header with font-bebas heading "MY CART" or "STREET CART"
2. THE Cart_Page SHALL render cart items in blocky cards with thick black borders and box shadows
3. THE Cart_Page SHALL display the total price in large font-bebas typography with Fifth Avenue Yellow background
4. THE Cart_Page SHALL use brutalist-style buttons for checkout actions with border-4 and shadow effects
5. WHEN the cart is empty, THE Cart_Page SHALL display an empty state with street-themed messaging and a CTA to browse menu
6. THE Cart_Page SHALL be mobile-responsive with full-width item cards and sticky checkout button on mobile

### Requirement 7: Update Payments Page UI

**User Story:** As a customer, I want the payments page to match the Fifth Avenue design system, so that managing my payment methods feels secure and on-brand.

#### Acceptance Criteria

1. THE Payments_Page SHALL display a brutalist-style page header with font-bebas heading "PAYMENT METHODS" or "STREET WALLET"
2. THE Payments_Page SHALL render payment method cards with border-4 border-black and urban-style card design
3. THE Payments_Page SHALL use Fifth Avenue Yellow for add payment method buttons
4. THE Payments_Page SHALL display card icons and labels using font-bebas typography
5. THE Payments_Page SHALL be mobile-responsive with stacked payment cards on screens less than 768px wide

### Requirement 8: Update Reviews Page UI

**User Story:** As a customer, I want the reviews page to match the Fifth Avenue design system, so that reading and writing reviews feels integrated with the brand experience.

#### Acceptance Criteria

1. THE Reviews_Page SHALL display a brutalist-style page header with font-bebas heading "STREET REVIEWS" or "DROP A REVIEW"
2. THE Reviews_Page SHALL render review cards with border-4 border-black and box shadows
3. THE Reviews_Page SHALL use Fifth Avenue Yellow stars for rating displays
4. THE Reviews_Page SHALL use brutalist-style buttons for submitting reviews with border-4 and shadow effects
5. THE Reviews_Page SHALL display reviewer names and dates using font-bebas and font-source-sans respectively
6. THE Reviews_Page SHALL be mobile-responsive with full-width review cards on mobile

### Requirement 9: Update Menu Page UI

**User Story:** As a customer, I want the menu page to match the Fifth Avenue design system, so that browsing food items is visually consistent with the rest of the portal.

#### Acceptance Criteria

1. THE Menu_Page SHALL display a brutalist-style page header with font-bebas heading "STREET MENU" or "THE MENU"
2. THE Menu_Page SHALL render menu item cards with border-4 border-black and urban-image class for food photos
3. THE Menu_Page SHALL use Fifth Avenue Yellow for add to cart buttons
4. THE Menu_Page SHALL display category filters as brutalist-style tabs with border-4 and active state styling
5. THE Menu_Page SHALL display prices using font-bebas typography with Fifth Avenue Red accent
6. THE Menu_Page SHALL be mobile-responsive with 1-column grid on mobile, 2-column on tablet, 3-column on desktop

### Requirement 10: Update Book Online Page UI

**User Story:** As a customer, I want the online booking page to match the Fifth Avenue design system, so that making reservations feels integrated with the brand.

#### Acceptance Criteria

1. THE Book_Online_Page SHALL display a brutalist-style page header with font-bebas heading "BOOK A TABLE" or "RESERVE YOUR SPOT"
2. THE Book_Online_Page SHALL render the booking form with brutalist-style inputs (border-4 border-black, rounded-none)
3. THE Book_Online_Page SHALL use Fifth Avenue Yellow for the submit booking button
4. THE Book_Online_Page SHALL display date/time pickers with urban styling and black borders
5. THE Book_Online_Page SHALL be mobile-responsive with full-width form fields and min-h-[44px] touch targets

### Requirement 11: Update Offers Page UI

**User Story:** As a customer, I want the offers page to match the Fifth Avenue design system, so that promotional content is visually engaging and on-brand.

#### Acceptance Criteria

1. THE Offers_Page SHALL display a brutalist-style page header with font-bebas heading "STREET DEALS" or "OFFERS"
2. THE Offers_Page SHALL render offer cards with border-4 border-black and ticket-style notch designs
3. THE Offers_Page SHALL use Fifth Avenue Yellow and Fifth Avenue Red for discount badges and highlights
4. THE Offers_Page SHALL display offer codes in font-bebas with copy-to-clipboard functionality
5. THE Offers_Page SHALL show expiration dates using font-source-sans with Clock icon
6. THE Offers_Page SHALL be mobile-responsive with stacked offer cards on mobile

### Requirement 12: Update Contact Page UI

**User Story:** As a customer, I want the contact page to match the Fifth Avenue design system, so that reaching out to support feels consistent with the brand experience.

#### Acceptance Criteria

1. THE Contact_Page SHALL display a brutalist-style page header with font-bebas heading "CONTACT US" or "REACH THE STREETS"
2. THE Contact_Page SHALL render the contact form with brutalist-style inputs (border-4 border-black, rounded-none)
3. THE Contact_Page SHALL use Fifth Avenue Yellow for the submit button with shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]
4. THE Contact_Page SHALL display contact information (phone, email, address) in cards with urban styling
5. THE Contact_Page SHALL include map integration with border-4 border-black frame
6. THE Contact_Page SHALL be mobile-responsive with stacked layout and full-width form fields

### Requirement 13: Apply Street-Themed Language

**User Story:** As a customer, I want the portal to use engaging street-themed language, so that the brand personality is consistent and memorable.

#### Acceptance Criteria

1. THE UI_Component SHALL use street-themed terminology where appropriate (e.g., "SQUAD" for members, "STREETS" for locations, "STREET CRED" for loyalty points)
2. THE UI_Component SHALL use action-oriented language in buttons (e.g., "GRAB IT", "DROP A REVIEW", "HIT THE STREETS")
3. THE UI_Component SHALL use font-caveat for taglines with street-themed phrases (e.g., "Level up your street cred", "Track your hunger in real-time")
4. THE UI_Component SHALL maintain professional clarity while incorporating brand personality
5. THE UI_Component SHALL use uppercase transformation for headings and labels to match brutalist aesthetic

### Requirement 14: Maintain Backend Integration

**User Story:** As a developer, I want all existing backend functionality to remain unchanged, so that the UI update does not break any data fetching or API integration.

#### Acceptance Criteria

1. THE Customer_Portal SHALL maintain all existing API route calls without modification
2. THE Customer_Portal SHALL preserve all data fetching logic including server-side and client-side queries
3. THE Customer_Portal SHALL keep all form submission handlers and validation logic unchanged
4. THE Customer_Portal SHALL maintain all authentication and authorization checks
5. THE Customer_Portal SHALL preserve all real-time subscription logic (e.g., order updates)
6. THE Customer_Portal SHALL keep all state management patterns unchanged

### Requirement 15: Implement Consistent Navigation

**User Story:** As a customer, I want consistent navigation elements across all portal pages, so that I can easily move between different sections.

#### Acceptance Criteria

1. THE Customer_Portal SHALL display a "BACK TO STREETS" button on all pages using brutalist button styling
2. THE Customer_Portal SHALL use ArrowLeft icon with font-bebas text for back buttons
3. THE Customer_Portal SHALL apply consistent hover effects (translate and shadow removal) to navigation elements
4. THE Customer_Portal SHALL display breadcrumb navigation where appropriate using street-themed labels
5. THE Customer_Portal SHALL maintain mobile-friendly navigation with hamburger menu on screens less than 768px wide

### Requirement 16: Optimize Performance

**User Story:** As a mobile customer, I want the portal pages to load quickly and perform smoothly, so that I have a responsive experience on my device.

#### Acceptance Criteria

1. WHEN the viewport width is less than 768px, THE Customer_Portal SHALL disable continuous animations (gradient shifts, floating, pulsing)
2. THE Customer_Portal SHALL use CSS transitions with duration of 0.15s or less on mobile for better performance
3. THE Customer_Portal SHALL lazy-load images using Next.js Image component with appropriate sizes
4. THE Customer_Portal SHALL minimize use of backdrop-blur on mobile devices
5. THE Customer_Portal SHALL use will-change CSS property sparingly to avoid performance issues
6. WHEN prefers-reduced-motion is enabled, THE Customer_Portal SHALL disable all animations

### Requirement 17: Ensure Accessibility Compliance

**User Story:** As a customer using assistive technology, I want the portal to be accessible, so that I can navigate and interact with all features.

#### Acceptance Criteria

1. THE UI_Component SHALL maintain proper heading hierarchy (h1, h2, h3) for screen readers
2. THE UI_Component SHALL include aria-labels for icon-only buttons
3. THE UI_Component SHALL ensure color contrast ratios meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
4. THE UI_Component SHALL provide focus-visible styles with 2px solid outline in primary color
5. THE UI_Component SHALL ensure all interactive elements are keyboard accessible
6. THE UI_Component SHALL include alt text for all decorative and informational images

### Requirement 18: Implement Loading States

**User Story:** As a customer, I want to see appropriate loading indicators, so that I know when the application is processing my requests.

#### Acceptance Criteria

1. WHEN data is being fetched, THE Customer_Portal SHALL display a loading spinner using RefreshCw icon with animate-spin
2. THE Customer_Portal SHALL use skeleton loaders with skeleton-mobile class for card placeholders on mobile
3. THE Customer_Portal SHALL display loading states in Fifth Avenue Yellow or Black to match brand colors
4. THE Customer_Portal SHALL center loading indicators vertically and horizontally in their containers
5. THE Customer_Portal SHALL disable interactive elements during loading states to prevent duplicate submissions

### Requirement 19: Implement Error States

**User Story:** As a customer, I want to see clear error messages, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN an error occurs, THE Customer_Portal SHALL display error messages using Fifth Avenue Red background or text color
2. THE Customer_Portal SHALL use AlertCircle or XCircle icons for error indicators
3. THE Customer_Portal SHALL display error messages in brutalist-style alert boxes with border-4 border-black
4. THE Customer_Portal SHALL provide actionable error messages with clear next steps
5. THE Customer_Portal SHALL use toast notifications for non-blocking errors with appropriate styling

### Requirement 20: Implement Empty States

**User Story:** As a customer, I want to see helpful empty state messages, so that I understand when there is no data and what actions I can take.

#### Acceptance Criteria

1. WHEN a list or collection is empty, THE Customer_Portal SHALL display an empty state message using font-caveat italic text
2. THE Customer_Portal SHALL include relevant icons (Package, Star, Gift) in empty states with opacity-10 styling
3. THE Customer_Portal SHALL provide a call-to-action button in empty states using brutalist button styling
4. THE Customer_Portal SHALL use street-themed language in empty state messages (e.g., "Your order history is a ghost town...")
5. THE Customer_Portal SHALL center empty state content vertically and horizontally in the container
