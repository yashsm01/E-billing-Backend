'use strict';
module.exports = (sequelize, DataTypes) => {
  const dynamic_level_codes = sequelize.define('dynamic_level_codes', {
    level: DataTypes.STRING,
    code: DataTypes.STRING
  }, {});
  dynamic_level_codes.associate = function (models) {
    // associations can be defined here
  };
  // dynamic_level_codes.sync({ alter: false })
  return dynamic_level_codes;
};