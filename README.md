# Lunch menu

A minimal, desktop-focused school lunch menu for `lunch.truongson.me`.

## Local development

```bash
npm ci
npm run dev
```

Without credentials, the site uses the checked-in sample menu. For live data,
set `VIN_TOKEN`, `VIN_STUDENT_CODE`, and `VIN_API_URL` in a local `.env` file or as protected
hosting environment variables.

The server endpoint calls one fixed upstream menu endpoint, sanitizes its
response, and returns weekdays through the same day next week. Credentials and the
student code are never sent to visitors.
