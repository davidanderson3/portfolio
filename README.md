# Dashboard

 An app for tracking projects and tasks.

## Recent updates

- New project wizard creates subprojects instead of subtasks.
- Projects can now be scheduled directly on your calendar during creation.
- Projects can span a date range on the calendar view.
- Tasks can be edited inline without pop-up prompts.
- Decisions can be edited inline without pop-up prompts.
- Lists can be sorted by clicking column headers.
- Tabs can be temporarily hidden via Settings.
- Planning tab includes an Annual Savings field.
- Planning tab records total assets history with timestamps whenever the balance changes.
- Record total assets daily at a given time to keep track of changes over time.
- Travel map shows green markers for visited places and red for others.
- Double-click the travel map to add a new place.

👉 **Live App:** [https://davidanderson3.github.io/dashboard/](https://davidanderson3.github.io/dashboard/)

## Importing travel data

Two node scripts help load travel places into Firestore:

1. `npm run import:travel` – Clears all existing travel documents for the default user and imports `assets/travel/doc.kml`.
2. `npm run append:travel` – Reads `assets/travel/extra.kml` and appends those places to the same user without removing existing ones.

Both scripts expect `serviceAccountKey.json` in the project root and support the Firestore emulator if `FIRESTORE_EMULATOR_HOST` is set.

## Running E2E tests

End-to-end tests are written with [Playwright](https://playwright.dev/). Install
the browsers once and then run the `e2e` script:

```bash
npm install
npx playwright install
npm run e2e
```

This starts the local server, launches a browser, and exercises basic UI flows.

## Android location snippet

The `android/WeatherLocationHelper.kt` file demonstrates how to obtain the user's current
location with the Fused Location Provider API. It first checks the last known
location and, if unavailable, requests a single high accuracy update.
