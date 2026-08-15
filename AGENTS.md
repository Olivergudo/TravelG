# Project guidelines

## Internationalization

- Never hardcode user-visible strings in JSX/TSX, including placeholders, tooltips, titles, confirmations, toasts, and accessibility labels.
- Every user-facing string must use the existing `lib/i18n` system.
- Add every new translation key to all supported locales: Spanish, English, French, and German.
- Run `npm run i18n:check` before considering a task complete.
- Use stable IDs for application logic; localized labels are presentation only.
- Never automatically translate user-generated content such as product, category, household, or expense names.
