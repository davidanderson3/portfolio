# Dashboard

An app for tracking goals and tasks.

## Recent updates

- New goal wizard creates subgoals instead of subtasks.
- Goals can now be scheduled directly on your calendar during creation.
- Goals can span a date range on the calendar view.
- Tasks can be edited inline without pop-up prompts.
- Decisions can be edited inline without pop-up prompts.
- Lists can be sorted by clicking column headers.
- Tabs can be temporarily hidden via Settings.

👉 **Live App:** [https://davidanderson3.github.io/dashboard/](https://davidanderson3.github.io/dashboard/)

## Importing travel data

Two node scripts help load travel places into Firestore:

1. `npm run import:travel` – Clears all existing travel documents for the default user and imports `assets/travel/doc.kml`.
2. `npm run append:travel` – Reads `assets/travel/extra.kml` and appends those places to the same user without removing existing ones.

Both scripts expect `serviceAccountKey.json` in the project root and support the Firestore emulator if `FIRESTORE_EMULATOR_HOST` is set.



