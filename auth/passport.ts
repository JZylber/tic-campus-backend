import passport from "passport";
import googleStrategy from "./google.ts";
import jwtStrategy from "./jwt.ts";
import studentJwtStrategy from "./studentJwt.ts";

// initialize passport with Google and JWT strategies. "jwtStudent" is a
// separate strategy because student tokens carry no googleId/jwtSecureCode —
// see auth/studentJwt.ts.
passport.use("google", googleStrategy);
passport.use("jwtAuth", jwtStrategy);
passport.use("jwtStudent", studentJwtStrategy);

export default passport;
