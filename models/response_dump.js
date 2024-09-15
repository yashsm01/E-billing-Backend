'use strict';
module.exports = (sequelize, DataTypes) => {
  const response_dump = sequelize.define('response_dump', {
    api_type: DataTypes.INTEGER,
    data: DataTypes.TEXT
  }, {});
  response_dump.associate = function(models) {
    // associations can be defined here
  };
  return response_dump;
};