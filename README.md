# TIC Campus Backend

REST API backend for the TIC Campus platform. Built with Express, TypeScript, Prisma, and Google Sheets as a data source for subject content.

## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express 5
- **Database:** PostgreSQL via Prisma
- **External data:** Google Sheets API (subject content, marks, materials, calendar)
- **Auth:** Google OAuth 2.0 + JWT (httpOnly cookie)
- **Package manager:** pnpm

## Project structure

```
.
├── index.ts                  # App entry point — middleware and route mounts
├── loadEnv.ts                # Loads environment variables
├── routes/
│   ├── authRoute.ts          # Google OAuth flow
│   ├── student/
│   │   ├── mockUser.ts       # Authenticated user info
│   │   ├── students.ts       # Student list
│   │   ├── student.ts        # Student lookup by name
│   │   └── marks.ts          # Student and subject marks
│   ├── subject/
│   │   ├── subjects.ts       # Subject catalogue
│   │   ├── articles.ts       # Subject articles/units
│   │   ├── material.ts       # Subject materials
│   │   └── links.ts          # Subject links
│   ├── revision/
│   │   ├── revisionRequests.ts  # Read revision requests
│   │   └── revisionRequest.ts   # Create revision request
│   └── project/
│       └── calendar.ts       # Subject calendar
├── controllers/
│   ├── students/
│   │   ├── allStudents.ts
│   │   ├── auth.ts
│   │   └── marks.ts
│   ├── subjects/
│   │   ├── allSubjects.ts
│   │   ├── articles.ts
│   │   ├── links.ts
│   │   ├── material.ts
│   │   └── revision.ts
│   ├── project/
│   │   └── calendar.ts
│   └── shared.ts             # Shared utilities (cache headers, sheet parsing)
├── middlewares/              # JWT and auth middleware
├── connectors/               # Google Sheets and DB connectors
└── prisma/                   # Prisma schema and migrations
```

## Running locally

```bash
pnpm dev        # starts nodemon with prisma generate
pnpm build      # compiles TypeScript to dist/
pnpm start      # runs compiled output
```

## Environment variables

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on |
| `DATABASE_URL` | PostgreSQL connection string |
| `FE_BASE_URL` | Frontend base URL (used for CORS and OAuth redirect validation) |
| `FE_EMBED_URL` | Embedded frontend URL (used for CORS) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `JWT_SECRET` | Secret for signing JWT tokens |

## Endpoints

### Auth — `/auth`

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/google` | Initiates the Google OAuth flow. Accepts an optional `returnTo` query param to redirect after login. |
| `GET` | `/auth/google/callback` | OAuth callback. On success, signs a JWT and sets it as an httpOnly cookie (`ticCampusAccessToken`), then redirects to the frontend. |

### User — `/user`

| Method | Path | Description |
|---|---|---|
| `GET` | `/user` | Returns the authenticated user's info (`id`, `googleId`, `role`). Requires a valid JWT cookie. |

### Students — `/students`

| Method | Path | Description |
|---|---|---|
| `GET` | `/students` | Returns all students with their course information. Response is cached for 1 hour. |
| `GET` | `/students/:subject/:course/:year` | Returns all students enrolled in a specific subject, course, and year with their personal details. |

### Student — `/student`

| Method | Path | Description |
|---|---|---|
| `POST` | `/student` | Searches for a student by `name` and `surname` for a given `year` using fuzzy matching. Returns the student ID and course information. |

### Marks — `/marks`

| Method | Path | Description |
|---|---|---|
| `GET` | `/marks/:subject/:course/:year/:id` | Returns marks, activities, and redos for a specific student in a subject. Filters by visibility and includes fixed marks and criteria. |
| `GET` | `/marks/:subject/:course/:year` | Returns all students' activities, marked activities, and redos for a subject, organized by student ID with criteria information. |

### Subjects — `/subjects`

| Method | Path | Description |
|---|---|---|
| `GET` | `/subjects` | Returns all subjects with their course information, ordered by year (desc), name, and course. |
| `GET` | `/subjects/teacher/:teacherId` | Returns all subjects taught by a specific teacher along with their spreadsheet IDs. |
| `GET` | `/subjects/:templateId` | Returns subjects that match a specific template ID, ordered by year (desc), name, and course. |

### Articles — `/articles`

| Method | Path | Description |
|---|---|---|
| `GET` | `/articles/:subject/:course/:year` | Retrieves course content (units and articles) from Google Sheets for a subject, filtered by visibility and course, organized by unit. |

### Material — `/material`

| Method | Path | Description |
|---|---|---|
| `GET` | `/material/:subject/:course/:year` | Returns visible teaching materials for a subject from Google Sheets (name, link, image, description, type). |

### Links — `/links`

| Method | Path | Description |
|---|---|---|
| `GET` | `/links/:subject/:course/:year` | Returns presentation and group links for a subject. Handles both single-course and multi-course spreadsheet layouts. |

### Revision requests — `/revisionRequests`

| Method | Path | Description |
|---|---|---|
| `GET` | `/revisionRequests/:subject/:course/:year/:id` | Returns all unreviewed revision requests for a student in a specific subject/course/year. |
| `GET` | `/revisionRequests/teacher/:year/:teacherId` | Returns all unreviewed revision requests across all subjects taught by a teacher in a given year. |

### Revision request — `/revisionRequest`

| Method | Path | Description |
|---|---|---|
| `POST` | `/revisionRequest` | Creates revision requests for one or more students on an activity. Validates dates and checks for existing unreviewed requests before creating. |

### Calendar — `/calendar`

| Method | Path | Description |
|---|---|---|
| `GET` | `/calendar/:subject/:course/:year` | Returns schedule and event data from Google Sheets for a subject, grouped by course with event details and schedule information. |
