---
name: Clerk React theme API
description: Version-specific Clerk React appearance typing used by the Morocco Now web artifact.
---

The installed Clerk React package expects the Clerk Themes object under `appearance.theme`; older examples using `appearance.baseTheme` do not typecheck with this package version.

**Why:** The package's current `ClerkAppearanceTheme` type rejects the older property name even though both patterns appear in public Clerk examples.

**How to apply:** When adding or updating Clerk components in this workspace, use the installed package types as the source of truth and run the web typecheck before restarting the workflow.