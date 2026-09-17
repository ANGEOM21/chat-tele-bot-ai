require("dotenv").config();
const googleWorkspace = require("../services/googleWorkspace");

module.exports = (req, res) => {
  const authUrl = googleWorkspace.getAuthUrl();
  return res.redirect(authUrl);
};
