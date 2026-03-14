// requireJwt.ts
import passport from "../auth/passport.ts";

// requireJwt middleware to authenticate the request using JWT
const requireJwt = passport.authenticate("jwtAuth", { session: false });

export default requireJwt;
