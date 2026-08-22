import Fuse from "fuse.js";
import prisma from "../../prisma/prisma.ts";
import { Role } from "../../generated/prisma/enums.ts";

// Mirrors the frontend's courseRegex (src/scripts/alpine/stores/course.ts).
const COURSE_REGEX = /^NR\d[A-Z0-9]$/;

// Same NFD + combining-mark strip already used for search/sort on the frontend
// (studentsPage.ts, MarksTable.astro, csv.ts). Names arriving from campus and
// names typed into our DB differ in accents, casing and spacing far more often
// than they differ in substance.
export const normalizeName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const tokens = (value: string): string[] =>
  normalizeName(value).split(" ").filter(Boolean);

/** True when one token list is a leading run of the other, in either direction. */
const isPrefixCompatible = (a: string[], b: string[]): boolean => {
  if (a.length === 0 || b.length === 0) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.every((token, index) => token === longer[index]);
};

type Candidate = {
  id: number;
  name: string;
  surname: string;
  dni: string | null;
  campusId: number | null;
  courses: string[];
};

export type MatchTier = "campusId" | "exact" | "givenNamePrefix" | "fuzzy";

export type ResolvedStudent = {
  id: number;
  name: string;
  surname: string;
  dni: string | null;
  course: string;
};

export type ResolveResult =
  | { status: "resolved"; student: ResolvedStudent; tier: MatchTier }
  | { status: "notFound" }
  | { status: "ambiguous"; tier: MatchTier; candidateIds: number[] };

// Fuzzy matching is the last resort and is deliberately far tighter than the
// threshold 0.4 / first-hit-wins search it replaces: a near-miss that silently
// resolves to the wrong classmate shows one student another's marks.
const FUZZY_THRESHOLD = 0.2;
const FUZZY_MIN_SCORE_GAP = 0.15;

async function loadYearPool(year: number): Promise<Candidate[]> {
  const students = await prisma.user.findMany({
    where: {
      role: Role.STUDENT,
      studentCourses: { some: { course: { year } } },
    },
    select: {
      id: true,
      name: true,
      surname: true,
      dni: true,
      campusId: true,
      studentCourses: {
        where: { course: { year } },
        select: { course: { select: { name: true } } },
      },
    },
  });

  return students
    .filter((student) => student.name && student.surname)
    .map((student) => ({
      id: student.id,
      name: student.name!,
      surname: student.surname!,
      dni: student.dni,
      campusId: student.campusId,
      courses: student.studentCourses.map(
        (studentCourse) => studentCourse.course.name,
      ),
    }));
}

const toResolved = (candidate: Candidate, course?: string): ResolvedStudent => ({
  id: candidate.id,
  name: candidate.name,
  surname: candidate.surname,
  dni: candidate.dni,
  course:
    course && candidate.courses.includes(course)
      ? course
      : (candidate.courses[0] ?? ""),
});

/**
 * Walk the match tiers over one candidate pool. Returns null when no tier
 * produced any hit at all, so the caller can retry against a wider pool; a
 * tier that produces several hits stops the ladder and reports ambiguity
 * rather than falling through to a looser tier that might pick arbitrarily.
 */
function runLadder(
  pool: Candidate[],
  givenNames: string,
  surname: string,
  campusId: number | null,
  course?: string,
): ResolveResult | null {
  if (pool.length === 0) return null;

  const wantedGiven = normalizeName(givenNames);
  const wantedSurname = normalizeName(surname);
  const wantedGivenTokens = tokens(givenNames);

  const settle = (
    tier: MatchTier,
    hits: Candidate[],
  ): ResolveResult | null => {
    if (hits.length === 0) return null;
    if (hits.length === 1) {
      return { status: "resolved", student: toResolved(hits[0]!, course), tier };
    }
    return {
      status: "ambiguous",
      tier,
      candidateIds: hits.map((hit) => hit.id),
    };
  };

  // Tier 0 — the canonical campus id. Exact by construction.
  if (campusId !== null) {
    const byCampusId = settle(
      "campusId",
      pool.filter((candidate) => candidate.campusId === campusId),
    );
    if (byCampusId) return byCampusId;
  }

  const surnameMatches = pool.filter(
    (candidate) => normalizeName(candidate.surname) === wantedSurname,
  );

  // Tier 1 — surname and full given names both exact.
  const exact = settle(
    "exact",
    surnameMatches.filter(
      (candidate) => normalizeName(candidate.name) === wantedGiven,
    ),
  );
  if (exact) return exact;

  // Tier 2 — surname exact, given names a leading run of one another. Absorbs
  // the common case where campus knows a second name our DB does not (or the
  // other way round).
  const byPrefix = settle(
    "givenNamePrefix",
    surnameMatches.filter((candidate) =>
      isPrefixCompatible(tokens(candidate.name), wantedGivenTokens),
    ),
  );
  if (byPrefix) return byPrefix;

  // Tier 3 — tight fuzzy, and only when the winner is clearly ahead.
  const fuse = new Fuse(pool, {
    keys: ["name", "surname"],
    threshold: FUZZY_THRESHOLD,
    includeScore: true,
  });
  const fuzzyHits = fuse.search({ name: givenNames, surname: surname });
  if (fuzzyHits.length === 0) return null;
  if (fuzzyHits.length === 1) {
    return {
      status: "resolved",
      student: toResolved(fuzzyHits[0]!.item, course),
      tier: "fuzzy",
    };
  }
  const best = fuzzyHits[0]!;
  const runnerUp = fuzzyHits[1]!;
  const gap = (runnerUp.score ?? 1) - (best.score ?? 0);
  if (gap > FUZZY_MIN_SCORE_GAP) {
    return {
      status: "resolved",
      student: toResolved(best.item, course),
      tier: "fuzzy",
    };
  }
  return {
    status: "ambiguous",
    tier: "fuzzy",
    candidateIds: fuzzyHits
      .filter((hit) => (hit.score ?? 1) - (best.score ?? 0) <= FUZZY_MIN_SCORE_GAP)
      .map((hit) => hit.item.id),
  };
}

/**
 * Resolve a campus identity to one of our students. Tries the course the widget
 * is embedded in first — a ~30 person pool where collisions are rare — and only
 * widens to the whole year if that pool yields nothing, so a student browsing a
 * course page that is not theirs is still identified.
 */
export async function resolveStudent({
  campusId,
  givenNames,
  surname,
  course,
  year,
}: {
  campusId: number | null;
  givenNames: string;
  surname: string;
  course?: string | undefined;
  year: number;
}): Promise<ResolveResult> {
  const pool = await loadYearPool(year);
  const scopedCourse =
    course && COURSE_REGEX.test(course) ? course : undefined;

  if (scopedCourse) {
    const scoped = runLadder(
      pool.filter((candidate) => candidate.courses.includes(scopedCourse)),
      givenNames,
      surname,
      campusId,
      scopedCourse,
    );
    if (scoped) return scoped;
  }

  return (
    runLadder(pool, givenNames, surname, campusId, scopedCourse) ?? {
      status: "notFound",
    }
  );
}

/**
 * Record the campus id on a student we matched by name, so future verifications
 * short-circuit on tier 0. Best-effort: a losing race on the unique constraint
 * (same campus id already claimed) must never fail the student's login.
 */
export async function backfillCampusId(
  studentId: number,
  campusId: number | null,
  tier: MatchTier,
): Promise<void> {
  if (campusId === null || tier === "campusId") return;
  try {
    await prisma.user.updateMany({
      where: { id: studentId, campusId: null },
      data: { campusId },
    });
  } catch {
    // Another student already holds this campusId, or the write lost a race.
    // Neither is worth failing identification over.
  }
}
