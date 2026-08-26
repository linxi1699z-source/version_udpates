---
name: app-version-admin-prototype
description: "Create and iterate interactive app-version or backend management prototypes, especially configuration list pages with filters, sample data, and detail forms."
---

# App Version Admin Prototype

Use this skill for interactive management-backend prototypes where users configure, filter, review, or edit version records. Keep the existing product language and user-requested fields authoritative.

## Paginated lists

When a prototype shows a management list, add working pagination unless the user explicitly asks for a static or complete list.

- Put the pagination control directly below the table and align it to the right.
- Default to 10 records per page. Provide a per-page selector, previous/next controls, numbered page buttons, an ellipsis for longer page ranges, and a page-jump input.
- Use compact, square light-gray page buttons; use the product primary blue for the current page; render disabled previous/next controls in a muted state.
- Recalculate pagination against the active site/data partition and active filters. Changing a filter, resetting filters, or switching a site returns to page 1.

## Sample-data baseline

For each independently selectable site or data partition, seed at least 10 realistic sample records so that the default pagination state is demonstrable. When two selections explicitly share data, one common dataset is sufficient. Include enough variation to demonstrate relevant filters and status/update-method states.

## Source control and Pages publishing

Treat implementation, verification, and publication as separate actions.

- Default to local edits and local verification only. Do not commit, push, or publish after ordinary prototype changes.
- Commit and push only when the user explicitly asks to sync to Git. Do not infer Git authorization from a request to change the prototype.
- When the user explicitly asks to sync, publish the static prototype through GitHub Pages and provide the resulting Pages URL after verifying it is live.
