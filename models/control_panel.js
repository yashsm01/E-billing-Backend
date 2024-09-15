'use strict';
module.exports = (sequelize, DataTypes) => {
  const control_panel = sequelize.define('control_panel', {
    feature: DataTypes.STRING,
    status: DataTypes.BOOLEAN
  }, { freezeTableName: true });
  control_panel.associate = function (models) {
    // associations can be defined here
  };
  control_panel.sync({ alter: false })
  return control_panel;
};