# Fifth Avenue Landing Rebrand Instructions

## Mission
Rebrand the entire landing experience from Zoiro Broast styling into a Fifth Avenue identity inspired by the provided poster reference.

Keep business logic, data flow, APIs, auth behavior, and portal functionality unchanged.
Only redesign UI, visual tokens, and user-facing landing copy where branding text appears.

## Brand Direction (Reference Image)
Use a bold, high-contrast fast-food poster style:
- Dominant yellow background
- Black structural blocks/bands
- Strong headline typography
- High visibility CTA treatment (Order Now style)
- Minimal visual clutter, clear hierarchy, quick scanability

## Brand Palette
Use these values as the new design system baseline.
- --fa-yellow: #F4C400
- --fa-yellow-bright: #FFD200
- --fa-black: #111111
- --fa-black-soft: #1E1E1E
- --fa-cream: #FFF4CC
- --fa-orange: #F28C00
- --fa-white: #FFFFFF

## Required Scope
Apply this rebrand to all landing pages under app/(landing):
- app/(landing)/page.tsx
- app/(landing)/book-online/page.tsx
- app/(landing)/cart/page.tsx
- app/(landing)/contact/page.tsx
- app/(landing)/favorites/page.tsx
- app/(landing)/features/page.tsx
- app/(landing)/loyalty/page.tsx
- app/(landing)/menu/page.tsx
- app/(landing)/menu/[slug]/page.tsx
- app/(landing)/offers/page.tsx
- app/(landing)/orders/page.tsx
- app/(landing)/orders/[id]/page.tsx
- app/(landing)/orders/history/page.tsx
- app/(landing)/orders/track/page.tsx
- app/(landing)/payments/page.tsx
- app/(landing)/privacy/page.tsx
- app/(landing)/reviews/page.tsx
- app/(landing)/settings/page.tsx
- app/(landing)/terms/page.tsx

And shared components used by landing routes:
- components/custom/Navbar.tsx
- components/custom/Hero.tsx
- components/custom/Footer.tsx
- components/landing/*
- app/globals.css
- tailwind.config.ts
- app/layout.tsx (theme-color and brand metadata only if requested)

Do not restyle app/portal pages unless explicitly requested.

## Token and Theme Rules
1. Update root CSS variables in app/globals.css from red-first branding to yellow-black branding.
2. Keep semantic token names stable where practical (primary, foreground, accent, muted, border) so existing components continue working.
3. Keep dark mode supported and aligned with Fifth Avenue brand.
4. Replace Zoiro-named visual utility classes with neutral or Fifth Avenue names when touching a file.
5. Avoid introducing purple or unrelated gradients in landing surfaces.

## Visual System Rules
- Primary actions: yellow background with black text, bold and high contrast.
- Secondary actions: black background with yellow or white text.
- Surfaces: use cream/yellow-tinted light backgrounds and black separators.
- Headings: bold, condensed style (existing Bebas Neue may stay).
- Cards: sharper, cleaner contrast with subtle depth, not soft pastel style.
- Add subtle striped, radial, or poster-like background accents where helpful.

## Motion Rules
Use purposeful motion only:
- Entrance stagger for key sections
- CTA hover response
- Gentle background movement where meaningful

Do not use heavy always-on animation loops that hurt performance.
Respect reduced motion preferences.

## Performance Rules (Advanced + Fast)
- Prefer next/image over raw img for large visual assets.
- Keep hero effects GPU-friendly (transform/opacity only when possible).
- Remove or reduce expensive particle loops on low-end devices.
- Avoid unnecessary client components for static sections.
- Preserve or improve current lighthouse performance and mobile responsiveness.

## Accessibility Rules
- Maintain WCAG-friendly contrast in every state.
- Ensure focus visibility on yellow and black surfaces.
- Keep text readable on image overlays.
- Ensure touch targets remain usable on small screens.

## Branding and Copy Rules
When touching landing UI copy:
- Replace Zoiro-facing brand mentions with Fifth Avenue where appropriate.
- Keep location/contact data accurate unless explicitly changed.
- Keep legal and policy meaning unchanged.

## Delivery Expectations
For each rebrand task:
1. Make direct code edits, not only recommendations.
2. Keep changes scoped to requested files.
3. Avoid regressions in booking, cart, offers, orders, payments, auth navigation.
4. Summarize files changed and any remaining manual assets needed.

## Definition of Done
The rebrand is done when:
- All landing pages visually follow Fifth Avenue yellow-black system.
- Shared landing components are consistent.
- Mobile and desktop look intentional and modern.
- Motion is meaningful and not heavy.
- Performance and accessibility remain solid.
