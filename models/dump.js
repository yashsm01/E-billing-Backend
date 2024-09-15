'use strict';
module.exports = (sequelize, DataTypes) => {
  const dump = sequelize.define('dump', {
    api_type: DataTypes.INTEGER,
    data: DataTypes.TEXT
  }, {});
  dump.associate = function(models) {
    // associations can be defined here
  };
  return dump;
};