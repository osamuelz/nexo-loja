---
name: Cupertino Retail System
colors:
  surface: '#fcf8fb'
  surface-dim: '#dcd9dc'
  surface-bright: '#fcf8fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f5'
  surface-container: '#f0edef'
  surface-container-high: '#eae7ea'
  surface-container-highest: '#e4e2e4'
  on-surface: '#1b1b1d'
  on-surface-variant: '#414753'
  inverse-surface: '#303032'
  inverse-on-surface: '#f3f0f2'
  outline: '#717785'
  outline-variant: '#c1c6d6'
  surface-tint: '#005cbb'
  primary: '#0059b5'
  on-primary: '#ffffff'
  primary-container: '#0071e3'
  on-primary-container: '#fcfbff'
  inverse-primary: '#abc7ff'
  secondary: '#5e5e63'
  on-secondary: '#ffffff'
  secondary-container: '#e0dfe4'
  on-secondary-container: '#626267'
  tertiary: '#9b3f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c25100'
  on-tertiary-container: '#fffaf9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#abc7ff'
  on-primary-fixed: '#001b3f'
  on-primary-fixed-variant: '#00458f'
  secondary-fixed: '#e3e2e7'
  secondary-fixed-dim: '#c7c6cb'
  on-secondary-fixed: '#1a1b1f'
  on-secondary-fixed-variant: '#46464b'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb693'
  on-tertiary-fixed: '#341000'
  on-tertiary-fixed-variant: '#7a3000'
  background: '#fcf8fb'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e4'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  numeral-tabular:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.5rem
  space-sm: 1rem
  space-md: 1.5rem
  space-lg: 2rem
  space-xl: 3rem
---

## Brand & Style

This design system delivers an understated, utilitarian retail and inventory platform engineered for boutique merchants and small store operators. The visual personality balances extreme restraint, effortless legibility, and refined desktop-grade utility. It removes decoration to foreground inventory data, sales registers, and transaction tallies.

The design movement is strict Corporate / Modern Minimalism inspired by classic Cupertino Human Interface Guidelines. Interfaces prioritize high contrast ratios, generous structured negative space, predictable spatial logic, and natural materials—specifically opaque white structural cards arranged over a calm, warm-neutral canvas with microscopic borders.

## Colors

The palette is anchored by the authentic `#0071E3` primary blue, deployed selectively for focal actions and active selection states. The canvas rests on `#F5F5F7` to prevent visual fatigue, while functional elevations use clean `#FFFFFF`.

### Functional Application
- **Primary Text (`#1D1D1F`)**: High-contrast, sharp dark neutral for headlines, labels, and stock counts.
- **Secondary / Muted Text (`#6E6E73`)**: Subdued neutral for metadata, SKUs, and field hints.
- **Hairline Dividers (`#D2D2D7`)**: Crisp 1px structural partitions with no gradient treatment.
- **Action State**: Active links and primary CTA buttons hover to `#0077ED`.
- **Status Indicators**: Muted semantic pairs guarantee accessibility without harsh saturation:
  - Positive/Stocked: `#34C759` paired with `#EBF9EE` background.
  - Low Stock/Attention: `#FF9500` paired with `#FFF6E5` background.
  - Out of Stock/Alert: `#FF3B30` paired with `#FFECEB` background.

## Typography

The typographic hierarchy prioritizes scan-density and typographic cleanliness. The type stack leverages `Inter` with platform fallback to `-apple-system, SF Pro Text, SF Pro Display`. 

All currency values (R$), unit measurements, inventory quantities, and ledger timestamps must enforce `font-feature-settings: "tnum" 1` (tabular numerals) to maintain vertical alignment down table columns and summary sheets. Letter-spacing tightens slightly on larger headlines to replicate classic modern system typography.

## Layout & Spacing

Layout geometry follows an 8-point rhythmic grid (8px, 16px, 24px, 32px, 48px).

### Breakpoints & Fluid Adaptation
- **Mobile (<768px)**: Single-column flow with `16px` outer screen margins. Tables collapse into structured stacked cards.
- **Tablet (768px - 1024px)**: 8-column layout with `24px` margins; drawer navigations replace full-bleed sidebars.
- **Desktop (1024px+)**: 12-column workspace layout with fixed `240px` navigation rail, `32px` canvas margins, and `24px` gutter gaps between metric widgets and inventory panels.

The app header utilizes sticky positioning with `backdrop-filter: blur(20px)` and an 80% opacity fill over `#FFFFFF` to provide spatial context during continuous table scrolling.

## Elevation & Depth

Depth is established via structural tonal layering and imperceptible ambient diffusion. Heavy dropshadows are forbidden.

- **Level 0 (Canvas)**: `#F5F5F7` flat background base.
- **Level 1 (Cards, Modules, Tables)**: `#FFFFFF` surface container with a crisp `1px solid #D2D2D7` hairline border and an ambient shadow of `0 1px 2px rgba(0, 0, 0, 0.04)`.
- **Level 2 (Popovers, Dropdowns, Flyouts)**: `#FFFFFF` surface paired with `1px solid rgba(0, 0, 0, 0.08)` and `0 4px 12px rgba(0, 0, 0, 0.06)`.
- **Level 3 (Modals, Checkout Drawers)**: `#FFFFFF` with `0 12px 32px rgba(0, 0, 0, 0.08)` bordered by `1px solid rgba(0, 0, 0, 0.1)`. Modals sit atop a dimmed translucent overlay (`rgba(0, 0, 0, 0.25)`).

## Shapes

The design system implements a strict, multi-tiered corner radius structure (`roundedness: 2` base):

- **Micro Elements (`8px / 0.5rem`)**: Applied to interactive form controls—buttons, text input fields, status chips, segmented toggles, and dropdown triggers.
- **Structural Containers (`12px / 0.75rem`)**: Applied to metric dashboard cards, tabular frames, modal sheets, and sub-panels.
- **Outer Shells (`16px / 1rem`)**: Reserved for root canvas containers, checkout summaries, and point-of-sale split registers.

## Components

### Buttons
- **Primary**: Solid `#0071E3` fill with white text, `8px` corner radius, `0 10px` or `0 16px` padding (height 36px or 40px). Hover shifts background to `#0077ED`. Active state scales subtly to `0.98`.
- **Secondary**: `#FFFFFF` background with `1px solid #D2D2D7`, text `#1D1D1F`. Hover darkens border to `#86868B`.
- **Tertiary / Destructive**: Flat transparent button with `#FF3B30` text. Hover uses `#FFECEB` background.

### Input Fields & Selectors
- Standard height: 38px. Background: `#FFFFFF`. Border: `1px solid #D2D2D7` with `8px` radius.
- Padding: `0 12px`. Font: 15px `Inter`.
- Focus ring: `0 0 0 3px rgba(0, 113, 227, 0.25)` and border transitions to `#0071E3`.
- Placeholder: `#6E6E73`.

### Status Badges & Chips
- Compact `8px` rounded pill/badge.
- Padding: `2px 8px`. Font size: `12px`, weight: `500`.
- Visual styling strictly follows semantic pairs:
  - Low Stock: `#FF9500` text on `#FFF6E5` fill.
  - Normal / Complete: `#34C759` text on `#EBF9EE` fill.
  - Critical / Void: `#FF3B30` text on `#FFECEB` fill.

### Cards & Tables
- **Cards**: `#FFFFFF` background, `12px` radius, `1px solid #D2D2D7`, `20px` internal padding.
- **Tables**: Contained in a `12px` rounded bordered frame. Table headers (`#F5F5F7` or `#FAFAFC`) with uppercase/muted `11px` labels. Rows are `44px` high with `1px solid #E5E5EA` bottom separators and hover state of `#FBFBFD`.
- Numeric columns must use right alignment and tabular numbers.

### Selection Controls (Checkboxes & Radios)
- Checkboxes: 16x16px, `4px` radius, bordered in `#D2D2D7`. Checked state: `#0071E3` with crisp white check mark icon.
- Radios: 16x16px circular elements. Checked state: `#0071E3` outer ring with white center inset.