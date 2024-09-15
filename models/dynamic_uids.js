'use strict';
module.exports = (sequelize, DataTypes) => {
  const dynamic_uids = sequelize.define('dynamic_uids', {
    id: { type: DataTypes.UUID, primaryKey: true },
    u_id: DataTypes.STRING,
    code: DataTypes.STRING
  }, {});
  dynamic_uids.associate = function (models) {
    // associations can be defined here
  };
  dynamic_uids.sync({ alter: false })
  return dynamic_uids;
};