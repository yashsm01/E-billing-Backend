
module.exports = function (args) {
  return function (req, res, next) {
    let roleId = req.roleId;
    console.log("RoleId::", roleId, "::Access TO::", args);

    if (!args.includes(roleId)) {
      console.log("-----------Blocked from middleware---------------");
      res.status(401).send({
        success: 0,
        message: "Not Authorized",
        "status_code": "TTE003"
      });
    }
    else { next(); }
  }
}