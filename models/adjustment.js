'use strict';
module.exports = (sequelize, DataTypes) => {
  const adjustments = sequelize.define('adjustments', {
    id: { type: DataTypes.UUID, primaryKey: true },
    session_id: { type: DataTypes.STRING },
    type: { type: DataTypes.NUMERIC },
    location_id: {
      type: DataTypes.UUID,
    },
    remark: { type: DataTypes.STRING },
    qty: { type: DataTypes.NUMERIC },
    status: { type: DataTypes.INTEGER },
    is_from_device: { type: DataTypes.BOOLEAN },
    ss_code: { type: DataTypes.STRING },
    inward_qty: { type: DataTypes.NUMERIC, defaultValue: 0 },
    is_started: { type: DataTypes.BOOLEAN, defaultValue: false },
    scanned_user_id: DataTypes.UUID,
    created_by: DataTypes.UUID
  }, {
    freezeTableName: true,
  });
  adjustments.associate = function (models) {

    adjustments.hasOne(models.company_users, {
      foreignKey: 'id',
      sourceKey: 'scanned_user_id',
      as: 'scanned_by'
    })
  };
  adjustments.sync({ alter: false })
  return adjustments;
};