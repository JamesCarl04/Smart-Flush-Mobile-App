# Supervisor Export Screen Mobile UI Implementation Plan

> **Status:** Implementation complete in code; physical-device validation and
> delivery remain pending.

## Goal

Make the supervisor export screen readable and usable on narrow mobile
devices, remove the redundant top title text while preserving navigation, and
keep both export actions accessible without changing report-generation
behavior.

## Scope and analysis

- The native supervisor stack currently owns the `Operations Audit Log` title
  in `navigation/MainNavigator.tsx`.
- `SupervisorReportsScreen` already supplies the body hierarchy through
  `Export Reports`, `Executive Compliance & Audit Exports`, and the completed
  task section. There is no second `Operations Audit Log` string in the
  current screen component, so title ownership must be made explicit to avoid
  a duplicate in the deployed UI.
- The export actions are placed in a horizontal row in
  `screens/SupervisorScreens.tsx`, but `KlirButton` renders its `Pressable`
  inside an `Animated.View`. The caller’s `flex` style reaches the inner
  pressable, not the row child that is measured, which explains the clipped
  CSV button in the screenshot.
- The availability bar in the second supplied image is
  `SquadCapacityPillBar` on the supervisor dashboard. It is outside the export
  screen and should remain unchanged unless a regression check finds that a
  shared layout change affects it.

## Proposed decisions

- [x] Keep the native back affordance for `SupervisorReports`, but suppress
      its visible title text so the body’s `Export Reports` heading is the
      single visible context label.
- [x] Treat the report filters, KPI cards, export card, and completed-task
      feed as one vertical mobile flow; do not add a second page heading to
      replace the removed title.
- [x] Preserve the existing PDF/CSV handlers, timeframe filtering, disabled
      empty-state behavior, loading state, and export data contract.
- [x] Keep the dashboard `SquadCapacityPillBar` out of scope for UI changes;
      validate it only as a shared-component regression check.

## Feature checklist

### 1. Remove duplicate supervisor export title

- [x] Confirm all title sources in the navigator and reports screen before
      editing so the fix removes only the redundant visual title.
- [x] Configure the `SupervisorReports` route to hide the native title text
      while retaining the native back button and its accessibility label.
- [x] Ensure `Export Reports` remains the only visible section-level context
      heading on the screen and is exposed clearly to assistive technology.
- [ ] Verify the title change does not affect the dashboard, task-review, or
      completed-review route headers.

### 2. Make export actions responsive on mobile

- [x] Give `KlirButton` a layout/container style path, or wrap each export
      button in a flexing container, so width constraints apply to the
      `Animated.View` row child as well as the pressable surface.
- [x] Render the two export actions in a compact-width-safe layout: stack them
      vertically when side-by-side labels cannot fit, and use equal-width
      columns only when the available content width is sufficient.
- [x] Allow button labels and icons to shrink or wrap without clipping, while
      preserving readable text, icon spacing, and a minimum 52dp touch target.
- [x] Keep the export card subtitle wrapping within the card and prevent any
      horizontal page overflow at common phone widths.
- [x] Preserve the existing primary/outline variants, disabled styling for
      zero completed tasks, and per-action loading indicator.

### 3. Preserve visual hierarchy and design-system consistency

- [x] Keep the existing KPI values, timeframe pills, export copy, empty state,
      and completed-task list unchanged unless a layout-only adjustment is
      required for wrapping.
- [x] Move any new spacing, breakpoint, button, or text styles into named
      `StyleSheet` entries and reuse existing Klir spacing, typography, color,
      and elevation tokens where available.
- [ ] Check that the export card remains visually grouped under `Export
      Reports` after the top title is removed, without introducing another
      redundant label.

### 4. Regression coverage

- [x] Extend supervisor reports integration coverage to assert the single
      visible export context heading and both export controls.
- [x] Add a layout-focused test for the compact-width action arrangement (or
      the container style contract) so a future `KlirButton` refactor cannot
      reintroduce intrinsic-width overflow.
- [x] Cover zero-record disabled actions without changing the existing
      no-record alert or export callbacks; preserve the existing loading
      behavior in the implementation.
- [x] Confirm the dashboard `SquadCapacityPillBar` still renders the available,
      on-task, and offline counts shown in the second supplied image.

### 5. Manual mobile and accessibility validation

- [ ] Check the screen on narrow Android and iOS widths, including the width
      represented by the supplied screenshot, and verify that no CTA or text
      is clipped horizontally.
- [ ] Check a wider phone/tablet width to confirm the responsive layout does
      not create excessive empty space or reduce touch targets.
- [ ] Verify the native back button remains reachable, the body heading gives
      the screen sufficient context after the title removal, and both export
      buttons retain clear accessibility names and disabled/busy states.
- [ ] Check increased system font scale so KPI labels, export copy, and button
      labels wrap without overlap.

### 6. Automated verification and delivery

- [x] Run the focused supervisor screen tests after implementation.
- [x] Run the mobile TypeScript check and relevant Jest suite with an exit
      code of zero.
- [ ] Run a project lint command once one is configured; this repository does
      not currently expose a lint script.
- [x] Review the final diff to confirm the change is limited to the supervisor
      export UI, shared button layout support if needed, tests, and this plan.
- [ ] Commit the approved implementation only after the user reviews and
      accepts this checklist.
