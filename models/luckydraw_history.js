'use strict';
module.exports = (sequelize, DataTypes) => {
  const luckydraw_history = sequelize.define('luckydraw_history', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true
    },
    draw_id: DataTypes.UUID,
    seq_no: DataTypes.INTEGER,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    date: DataTypes.DATE
  }, { freezeTableName: true });
  luckydraw_history.associate = function (models) {
    // associations can be defined here    
  };
  luckydraw_history.sync({ alter: false })
  return luckydraw_history;
};