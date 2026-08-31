// Server-side relay to campus.ort.edu.ar.
//
// The embedded widget runs inside the student's own browser, so anything it
// *claims* about who it is can be rewritten from devtools. Instead the widget
// hands us the raw campus session cookie and we re-derive the identity here,
// by making our own authenticated request to campus. The only way to fool this
// is to supply a cookie for a different, genuinely live session — i.e. to
// actually steal someone's session, which is a pre-existing risk on ORT's side
// (neither PHPSESSID cookie is HttpOnly) and not one this adds.

// Hardcoded: the client never gets to influence what we fetch (SSRF).
const CAMPUS_ORIGIN = "https://campus.ort.edu.ar";
const LOGGED_IN_DATA_PATH = "/ajaxactions/GetLoggedInData";

// campus.ort.edu.ar sets two same-named PHPSESSID cookies (one on .ort.edu.ar,
// one host-only) and PHP honours whichever comes last, so we forward every
// PHPSESSID entry in the exact order the browser produced them rather than
// deduplicating. Nothing else from the jar is relayed.
const RELAYED_COOKIE_NAMES = new Set(["PHPSESSID"]);

const MAX_COOKIE_LENGTH = 4096;
const REQUEST_TIMEOUT_MS = 5000;

export type CampusIdentity = {
  givenNames: string;
  surname: string;
  jerarquia: string | null;
  /** Numeric campus user id, or null when the account has no profile photo. */
  campusId: number | null;
};

/**
 * Validate and reduce a raw `document.cookie` string to the entries we relay.
 * Returns null when there is nothing usable — callers should treat that as a
 * client error, not as "not logged in".
 */
export function sanitizeCampusCookie(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > MAX_COOKIE_LENGTH) return null;
  // CR/LF/NUL in a value we are about to put in a request header would let the
  // caller inject headers of their own.
  if (/[\r\n\0]/.test(raw)) return null;

  const relayed = raw
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => {
      const separator = pair.indexOf("=");
      if (separator <= 0) return false;
      return RELAYED_COOKIE_NAMES.has(pair.slice(0, separator));
    });

  return relayed.length > 0 ? relayed.join("; ") : null;
}

// campus generally sends raw UTF-8, but an entity-encoded accent would survive
// into the name comparison and never match, because normalizeName strips
// accents rather than entities. Cheap insurance.
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", ccedil: "ç", Ccedil: "Ç",
};

const decodeEntities = (value: string): string =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, dec: string) =>
      String.fromCodePoint(Number(dec)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      const exact = NAMED_ENTITIES[name];
      if (exact !== undefined) return exact;
      const lower = NAMED_ENTITIES[name.toLowerCase()];
      return lower !== undefined ? lower : match;
    });

/**
 * `imagenURL` is `https://recursos.ort.edu.ar/static/archivos/usuarioperfil/104450`
 * for an account with a photo, and a generic avatar path for one without. Only
 * the former carries the canonical numeric campus user id.
 */
export function campusIdFromImageURL(imagenURL: unknown): number | null {
  if (typeof imagenURL !== "string") return null;
  const tail = imagenURL.split("?")[0]!.split("/").filter(Boolean).pop();
  if (!tail || !/^\d+$/.test(tail)) return null;
  const parsed = Number(tail);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * `nombre` arrives as `"Julian Ariel<br/>Zylber"` — given names, a literal <br>,
 * then the surname. Tolerates `<br>`, `<BR/>` and stray whitespace, all of
 * which the previous client-side `split("<br/>")` did not.
 */
export function splitCampusName(nombre: unknown): {
  givenNames: string;
  surname: string;
} | null {
  if (typeof nombre !== "string") return null;
  const parts = nombre
    .split(/<\s*br\s*\/?\s*>/i)
    .map((part) => decodeEntities(part).replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0);
  if (parts.length < 2) return null;
  return { givenNames: parts[0]!, surname: parts.slice(1).join(" ") };
}

/**
 * Ask campus who owns this session. Returns null when the session is anonymous
 * or campus is unreachable/misbehaving — the caller cannot distinguish, and
 * should not, since both mean "we could not identify this person".
 *
 * The cookie is a live credential: it is never logged, and never leaves this
 * function.
 */
export async function fetchLoggedInData(
  cookieHeader: string,
): Promise<CampusIdentity | null> {
  let payload: unknown;
  try {
    const campusResponse = await fetch(`${CAMPUS_ORIGIN}${LOGGED_IN_DATA_PATH}`, {
      headers: { Cookie: cookieHeader, Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!campusResponse.ok) return null;
    payload = await campusResponse.json();
  } catch {
    // Timeout, network failure, or a non-JSON body (campus serves an HTML
    // login page to anonymous sessions on some endpoints).
    return null;
  }

  if (typeof payload !== "object" || payload === null) return null;
  const { nombre, nombreJerarquia, imagenURL } = payload as Record<
    string,
    unknown
  >;

  // A logged-out session does not get an empty payload — campus answers 200
  // with a placeholder identity:
  //   {"nombre":"Anonimo<br/>Usuario","nombreJerarquia":"Usuarios Anonimos",
  //    "imagenURL":".../static/images/avatar.gif"}
  // Verified live. Without this check that placeholder would be fed to the
  // student matcher as if it were a real name.
  if (typeof nombreJerarquia === "string" && /an[oó]nim/i.test(nombreJerarquia)) {
    return null;
  }

  const name = splitCampusName(nombre);
  if (!name) return null;

  return {
    givenNames: name.givenNames,
    surname: name.surname,
    jerarquia: typeof nombreJerarquia === "string" ? nombreJerarquia : null,
    campusId: campusIdFromImageURL(imagenURL),
  };
}
