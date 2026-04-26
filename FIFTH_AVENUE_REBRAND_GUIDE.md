# Fifth Avenue Landing Rebrand Guide

## Objective
Transform the current Zoiro Broast landing UI into a Fifth Avenue branded experience across all landing pages.

Target outcome:
- Visually distinct yellow/black identity
- More advanced UI polish
- Faster perceived and real performance on mobile and desktop

## Visual DNA From Provided Reference
The reference image communicates:
- Strong yellow canvas
- Black vertical band and high contrast blocks
- Bold handwritten/poster-like energy
- Direct CTA emphasis (Order Now)

This should feel like a premium, modern fast-food campaign, not a generic template.

## Brand System
Use this palette consistently.

- Fifth Avenue Yellow: #F4C400
- Bright Highlight Yellow: #FFD200
- Core Black: #111111
- Soft Black: #1E1E1E
- Warm Cream: #FFF4CC
- CTA Orange Accent: #F28C00
- White: #FFFFFF

Suggested semantic mapping:
- primary: #F4C400
- primary-foreground: #111111
- background: #FFF4CC or #FFFFFF
- foreground: #111111
- accent: #F28C00
- border: #2A2A2A (on light) / #4A4A4A (on dark)

## Pages In Scope
Apply the rebrand to every landing route in app/(landing):
- /
- /book-online
- /cart
- /contact
- /favorites
- /features
- /loyalty
- /menu
- /menu/[slug]
- /offers
- /orders
- /orders/[id]
- /orders/history
- /orders/track
- /payments
- /privacy
- /reviews
- /settings
- /terms

## Shared Components To Update
Primary shared components that control landing look:
- components/custom/Navbar.tsx
- components/custom/Hero.tsx
- components/custom/Footer.tsx
- components/landing/OfferPopup*.tsx
- components/landing/HeroOffersIndicator*.tsx
- app/globals.css
- tailwind.config.ts

## Step-by-Step Implementation Plan

### 1. Theme foundation
- Replace red-centric tokens in app/globals.css with Fifth Avenue yellow-black tokens.
- Keep semantic token names to avoid massive breakage.
- Add reusable utility classes for:
  - poster-like yellow-black backgrounds
  - black stripe accents
  - high-contrast CTA buttons

### 2. Navbar redesign
- Landing top bar should look campaign-style:
  - yellow-black gradient or segmented black/yellow blocks
  - stronger active state and focus ring
  - simplified but premium motion
- Keep all existing auth/cart logic intact.

### 3. Hero redesign
- Replace current red-heavy overlays with yellow-black identity.
- Keep strong headline and direct order CTA.
- Add one visual motif from poster style:
  - diagonal black stripe
  - ring accent around hero offer
  - subtle grain/pattern layer
- Reduce expensive floating animation density on mobile/low-end devices.

### 4. Footer redesign
- Move footer toward black base + yellow highlights.
- Update brand text from Zoiro to Fifth Avenue where shown.
- Keep links, contact structure, and social blocks.

### 5. Landing page consistency pass
For each landing page, ensure:
- section headers use consistent color and typographic style
- card treatments match new brand
- form controls and badges use the new semantic colors
- no leftover red-first branding remains in visible UI

### 6. Metadata and browser theme color
- Update theme-color in app/layout.tsx to a Fifth Avenue yellow value.
- If branding sweep includes SEO copy, update landing-facing brand strings.
- Keep URL/domain behavior unchanged unless explicitly requested.

### 7. Performance and speed pass
- Replace large raw img usage with next/image when practical.
- Remove or throttle expensive always-running effects.
- Keep transitions transform/opacity-based.
- Use reduced motion and low-end device checks already present in code.

## Advanced UI Requirements
- Strong hierarchy with intentional spacing rhythm.
- Distinct section personalities while preserving one system.
- Better CTA prominence without visual chaos.
- Keep microinteractions short and crisp.

## Fast UI Requirements
- No heavy continuous animation loops on every section.
- Avoid unnecessary client-side rendering for static blocks.
- Keep loading states light and clear.
- Preserve responsive behavior from xs through 2xl breakpoints.

## QA Checklist
- All landing routes follow yellow-black identity.
- No broken routes or API interactions.
- Navbar, cart, auth menus, order flows still function.
- Mobile readability and tap targets verified.
- Reduced motion mode remains usable.
- No obvious red/Zoiro visuals left on landing pages.

## Ready-To-Use Copilot Prompt
Use the following prompt to execute the rebrand in one run:

Update this Next.js app to fully rebrand landing pages from Zoiro to Fifth Avenue using a yellow-black fast-food poster style. Apply changes to all routes under app/(landing), shared components in components/custom and components/landing, and theme tokens in app/globals.css plus tailwind.config.ts. Keep logic and APIs unchanged. Preserve mobile responsiveness and improve performance by reducing heavy animations and preferring next/image for major visuals. Replace red-first visual styling with this palette: #F4C400, #FFD200, #111111, #1E1E1E, #FFF4CC, #F28C00, #FFFFFF. Ensure CTA visibility is high and all landing pages have consistent branding.

## Notes
- This guide is intentionally implementation-focused so design and engineering can work in the same pass.
- If a full copy rewrite is needed later, run a separate brand voice pass after visual migration.
