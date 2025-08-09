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
- Firebase optional: enable Authentication (Email/Password) and Firestore for cloud sync
- Local-only fallback (data stored in browser localStorage)

## How to use (quick)

1. Unzip and upload all files to a GitHub repository (use the web UI "Add file → Upload files").
2. In the repository settings enable **Pages** and serve from the **main branch / root**.
3. Visit the site URL. If you open it on Android, use "Add to Home screen" to install the PWA.

## Enabling Firebase (optional)

1. Create a Firebase project at https://console.firebase.google.com/
2. Add a Web App and copy the config object.
3. Open `firebase-config.js` and set `FIREBASE_CONFIG` to the provided object (replace `null`).
4. In Firebase Console:
   - Enable **Authentication → Sign-in method → Email/Password** (and Google if desired).
   - Create a Firestore database (start in test mode while developing).
5. (Optional) Set Firestore rules to restrict access:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Notes & Limitations

- This is a static, client-side app. Firebase is optional — without config the app runs local-only.
- The app uses the Firebase "compat" SDK via CDN for simplicity.
- If multiple devices use the same Firebase account, the last writer wins on sync. You can export/import JSON for manual merges.
- For production, consider locking down Firestore rules and using proper conflict resolution.

Enjoy — upload the files and let me know the GitHub Pages URL if you want me to test the install flow.
