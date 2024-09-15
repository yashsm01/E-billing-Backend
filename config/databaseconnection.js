const Sequelize = require('sequelize');

module.exports = function(dbpath) {
        return new Sequelize("postgres://Trusttags:tTags-liVe-2021@trusttags.cdvwie5x3rwt.ap-south-1.rds.amazonaws.com:5432/Trusttags");
}
