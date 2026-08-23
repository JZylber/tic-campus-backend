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
│   │   ├── userInfo.ts       # Authenticated user info
│   │   ├── students.ts       # Student list and mutations
│   │   ├── student.ts        # Student lookup by name
│   │   └── marks.ts          # Student and subject marks
│   ├── course/
│   │   └── courses.ts        # Course list
│   ├── teacher/
│   │   └── teachers.ts       # Teacher list
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
│   │   ├── studentMutations.ts
│   │   ├── auth.ts
│   │   └── marks.ts
│   ├── courses/
│   │   └── allCourses.ts
│   ├── teachers/
│   │   └── allTeachers.ts
│   ├── subjects/
│   │   ├── allSubjects.ts
│   │   ├── articles.ts
│   │   ├── links.ts
│   │   ├── material.ts
│   │   └── revision.ts
│   ├── project/
│   │   └── calendar.ts
│   └── shared.ts             # Shared utilities (cache headers, sheet parsing)
├── middlewares/              # Auth (JWT / service key) and role middleware
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
| `SERVICE_API_KEY` | Shared secret for the service account. Sent as the `X-API-Key` header; grants TEACHER-level access to guarded routes. Leave unset to disable service-account auth. |

## Endpoints

Guarded routes accept either credential:

- **User** — `Authorization: Bearer <jwt>`, using the token issued by the Google OAuth callback.
- **Service account** — `X-API-Key: <SERVICE_API_KEY>`, for server-to-server callers. It is treated as a
  `TEACHER`, so `ADMIN`-only routes remain closed to it.

Requests without a valid credential return `401`; requests with an insufficient role return `403`.

| Symbol | Meaning |
|---|---|
| `JWT` | Valid credential required (any authenticated user, or the service account) |
| `ADMIN` | Admin role required |
| `ADMIN / TEACHER` | Admin or teacher role required |

### Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/google` | — | Initiates the Google OAuth flow. Accepts an optional `returnTo` query param to redirect after login. |
| `GET` | `/auth/google/callback` | — | OAuth callback. On success, signs a JWT and returns it to the frontend in the redirect URL fragment (`#token=<jwt>`). |

### User — `/user`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/user/info` | `JWT` | Returns the authenticated user's `id`, `name`, `surname`, and `role`. |

### Courses — `/courses`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/courses` | — | Returns all courses (`id`, `name`, `specialty`, `year`). Response is cached for 1 hour. |

### Students — `/students`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/students` | `ADMIN / TEACHER` | Returns all students (one entry per student). Each object includes the student's `id`, personal fields, `courses` (`courseId`/`course`/`year` per enrollment), and `subjects` (`subject`/`id_subject`/`id_course` for all subjects across all enrollments). Response is cached for 1 hour. |
| `GET` | `/students/:subject/:course/:year` | — | Returns all students enrolled in a specific subject, course, and year with their personal details. |
| `PATCH` | `/students/:studentId` | `ADMIN` | Updates a student's personal data. Accepts any subset of `name`, `surname`, `email`, `dni` in the request body. Returns the updated student. |
| `POST` | `/students/:studentId/course` | `ADMIN` | Enrolls a student in a course. Body: `{ "courseId": number }`. Returns `409` if the student is already enrolled in that course. |
| `PATCH` | `/students/:studentId/course` | `ADMIN` | Moves a student from one course to another. Body: `{ "oldCourseId": number, "newCourseId": number }`. Returns `404` if the enrollment does not exist. |

### Student — `/student`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/student` | — | Searches for a student by `name` and `surname` for a given `year` using fuzzy matching. Returns the student ID and course information. |

### Teachers — `/teachers`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/teachers` | `ADMIN` | Returns all teachers (`id`, `name`, `surname`), sorted by surname. Response is cached for 1 hour. |

### Marks — `/marks`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/marks/:subject/:course/:year/:id` | — | Returns marks, activities, and redos for a specific student in a subject. Filters by visibility and includes fixed marks and criteria. |
| `GET` | `/marks/:subject/:course/:year` | `ADMIN / TEACHER` | Returns all students' activities, marked activities, and redos for a subject, organized by student ID with criteria information. |

### Subjects — `/subjects`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/subjects` | — | Returns all subjects with their course information, ordered by year (desc), name, and course. |
| `GET` | `/subjects/teacher/:teacherId` | `ADMIN / TEACHER` | Returns all subjects taught by a specific teacher along with their spreadsheet IDs. |
| `GET` | `/subjects/:templateId` | — | Returns subjects that match a specific template ID, ordered by year (desc), name, and course. |

### Articles — `/articles`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/articles/:subject/:course/:year` | — | Retrieves course content (units and articles) from Google Sheets for a subject, filtered by visibility and course, organized by unit. |

### Material — `/material`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/material/:subject/:course/:year` | — | Returns visible teaching materials for a subject from Google Sheets (name, link, image, description, type). |

### Links — `/links`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/links/:subject/:course/:year` | — | Returns presentation and group links for a subject. Handles both single-course and multi-course spreadsheet layouts. |

### Revision requests — `/revisionRequests`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/revisionRequests/:subject/:course/:year/:id` | — | Returns the activity IDs of all pending (unreviewed) revision requests for a student in a specific subject/course/year. |
| `GET` | `/revisionRequests/teacher/:year/:teacherId` | `ADMIN / TEACHER` | Returns all revision requests (both reviewed and unreviewed) across all subjects taught by a teacher in a given year. |
| `PATCH` | `/revisionRequests/:id/reviewed` | `ADMIN / TEACHER` | Marks a revision request as reviewed or unreviewed. |

#### `PATCH /revisionRequests/:id/reviewed` — toggle reviewed status

Use this endpoint to mark a specific revision request as reviewed or revert it to unreviewed.

**URL param:** `:id` — the `revisionRequestId` returned by the teacher GET endpoint.

**Request body:**
```json
{ "reviewed": true }
```
or
```json
{ "reviewed": false }
```

**Response `200`:**
```json
{ "id": 5, "reviewed": true }
```

**Response `404`** — revision request not found:
```json
{ "message": "Solicitud de reentrega no encontrada." }
```

**Frontend usage:** After a teacher views a revision request, call this endpoint with `{ "reviewed": true }` to mark it done. To revert it, call again with `{ "reviewed": false }`. The teacher list endpoint (`GET /revisionRequests/teacher/:year/:teacherId`) now returns all requests regardless of `reviewed` status, so the frontend should use the `reviewed` field on each item to drive any "pending / done" visual distinction.

### Revision request — `/revisionRequest`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/revisionRequest` | — | Creates revision requests for one or more students on an activity. Validates dates and checks for existing unreviewed requests before creating. |

### Calendar — `/calendar`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/calendar/:subject/:course/:year` | — | Returns schedule and event data from Google Sheets for a subject, grouped by course with event details and schedule information. |
