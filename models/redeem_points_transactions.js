'use strict';
module.exports = (sequelize, DataTypes) => {
  const redeem_points_transactions = sequelize.define('redeem_points_transactions', {
    id: { type: DataTypes.UUID, primaryKey: true },
    reward_id: DataTypes.UUID,
    history_id: DataTypes.UUID,
    pri_consumer_id: DataTypes.UUID,
    sec_consumer_id: DataTypes.UUID,
    points: DataTypes.INTEGER,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, { freezeTableName: true });
  redeem_points_transactions.associate = function (models) {
    // associations can be defined here
  };
  redeem_points_transactions.sync({ alter: false })
  return redeem_points_transactions;
};