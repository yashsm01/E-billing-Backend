
module.exports = function (arg) {
  for (let i in arg) {
    return arg[i].message;
  }
};