const csurf = require("csurf");

// Uses signed cookie to store CSRF secret — requires cookie-parser in server.js
module.exports = csurf({ cookie: { httpOnly: true, sameSite: "lax" } });
