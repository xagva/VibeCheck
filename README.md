# Habit Tracker — BIC PWA (Firebase)

This is a static Progressive Web App (vanilla JS) implementing:

- Multiple habits per user
- Add entries for any date (backfill)
- Charts (Chart.js) for last 30 days per habit
- Aggregated BIC score across all habits:
  ```
  Clean Day Weight = 1
  Penalty per indulgence = 1 - (C / TotalDays)
  BIC Score = C * 1 - I * (1 - (C / TotalDays))
  ```
-

## Notes & Limitations

- This is a static, client-side app. Firebase is optional — without config the app runs local-only.
- The app uses the Firebase "compat" SDK via CDN for simplicity.
- If multiple devices use the same Firebase account, the last writer wins on sync. You can export/import JSON for manual merges.
- For production, consider locking down Firestore rules and using proper conflict resolution.
