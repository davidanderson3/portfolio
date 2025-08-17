# Dashboard

Dashboard is a personal productivity and planning app that groups tools into a set of tabs.

## Tabs

### Routine
The Routine tab helps keep track of recurring tasks throughout the day. Tasks are organized by time slots (First Thing, Morning, Afternoon, Evening, End of Day) and can also repeat weekly or monthly. You can check items off, skip them for predefined intervals, or quickly add new tasks without leaving the page. Completed items feed into a daily report to show progress at a glance.

### Projects
Projects capture larger goals and their subtasks. Tasks can be nested under parent goals and rearranged with drag-and-drop. A project wizard walks through creating new projects and subprojects, and projects may be scheduled on the calendar as single dates or ranges. Inline editing and progress indicators make it easy to monitor completion.

### Calendar
The Calendar tab displays scheduled projects and tasks in either a daily or hourly view. Items can be added directly to the schedule and sent to Google Calendar. A separate schedule panel summarizes what's happening today, making it a central hub for time management.

### Metrics
Metrics offers flexible tracking for anything that can be measured. Users define their own metrics (such as mood or counts) and record values for each day. The tab renders charts and value history, lets you browse previous days, and postpones entries when needed. It doubles as a lightweight journaling tool for data-driven habits.

### Lists
Lists builds custom tables with user-defined columns and types. Columns may be text, number, date, checkbox, link, or list, and each list supports sorting and pagination. It's useful for anything from simple checklists to structured reference tables.

### Places
Places logs travel destinations on an interactive map. Entries can be searched by name or coordinates, filtered by tags, and toggled to show only unvisited spots. Markers turn green once visited and red otherwise. A table lists distance from your current location, ratings, visit dates, and actions for each place, and you can double-click the map to add new locations.

### Finances
The Finances tab models long-term finances. Enter current savings, income, annual contributions, and assumptions like investment return or inflation to project account balances through retirement and beyond. The tab records total assets with timestamps so you can track wealth over time, and an annual savings field helps plan future contributions.

### Budget
Budget breaks down monthly income into recurring expenses and subscriptions. It estimates federal taxes, calculates net pay, and shows what remains after bills. Categories are customizable so the plan can reflect your real spending.

### Live Music
The Live Music tab lists upcoming concerts using the Ticketmaster Discovery API. Enter a search keyword (such as an artist or event name) and your Ticketmaster API key, then press **Load Shows** to fetch events. The tab requests `https://app.ticketmaster.com/discovery/v2/events.json?apikey={your-api-key}&keyword={keyword}` and displays the returned events with links. See the [Ticketmaster Discovery API documentation](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) for more details.

### Contacts
Contacts is a lightweight list of people you want to stay in touch with. Each person stores desired frequencies (in days) for reaching out, having a meaningful conversation, or meeting in person. Logging an interaction records the date and optional notes.

### Backups
Backups scans local storage for saved snapshots of your data. Each backup can be restored with a single click, making it easy to recover from mistakes or sync between devices.

## Development

Install dependencies and run the test suite with:

```bash
npm install
npm test
```
