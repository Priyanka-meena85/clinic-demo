const { server } = require("../server");

module.exports = (req, res) => {
  req.url = "/api/health";
  server.emit("request", req, res);
};
