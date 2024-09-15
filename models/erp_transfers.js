'use strict';
module.exports = (sequelize, DataTypes) => {
  const erp_transfers = sequelize.define('erp_transfers', {
    id: { type: DataTypes.UUID, primaryKey: true },
    transfer_id: DataTypes.STRING,
    transaction_id: DataTypes.UUID,
    erp_sync_status: DataTypes.INTEGER,
    user_id: DataTypes.UUID,
    reason: DataTypes.STRING
  }, {
    freezeTableName: true,
  });
  erp_transfers.associate = function (models) {
    // associations can be defined here
  };
  erp_transfers.sync({ alter: false })
  return erp_transfers;
};