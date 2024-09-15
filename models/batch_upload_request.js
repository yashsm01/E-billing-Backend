'use strict';
module.exports = (sequelize, DataTypes) => {
  const batch_upload_request = sequelize.define('batch_upload_request', {
    id: { type: DataTypes.UUID, primaryKey: true },
    batch_id: { type: DataTypes.UUID },
    error_msg: { type: DataTypes.STRING },
  }, { freezeTableName: true, timestamp: true });
  batch_upload_request.associate = function (models) {
    // associations can be defined here
    // batch_upload_request.hasOne(models.mapping_transactions, {
    //   foreignKey: 'id',
    //   sourceKey: "transaction_id"
    // })
  };
  batch_upload_request.sync({ alter: false })
  return batch_upload_request;
};
//| status |   name     |
//|    1   | pending    |
//|    2   | requested  |
//|    3   | in process |
//|    4   | uploaded   |
//|    5   |   failed   |