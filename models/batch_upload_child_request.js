'use strict';
module.exports = (sequelize, DataTypes) => {
  const batch_upload_child_request = sequelize.define('batch_upload_child_request', {
    id: { type: DataTypes.UUID, primaryKey: true },
    product_id: { type: DataTypes.UUID },
    batch_id: { type: DataTypes.UUID },
    request_id: { type: DataTypes.UUID },
    child_request_id: { type: DataTypes.UUID },
    level: { type: DataTypes.STRING },
    inserted_counts: { type: DataTypes.INTEGER, defaultValue: 0 },
    updated_countes: { type: DataTypes.INTEGER, defaultValue: 0 },
    uploaded_codes: { type: DataTypes.INTEGER, defaultValue: 0 },
    location_id: { type: DataTypes.UUID },
    error_msg: { type: DataTypes.STRING },
  }, { freezeTableName: true, timestamp: true });
  batch_upload_child_request.associate = function (models) {
    // associations can be defined here
  };
  batch_upload_child_request.sync({ alter: false })
  return batch_upload_child_request;
};

//| status |   name     |
//|    1   | pending    |
//|    2   | requested  |
//|    3   | in process |
//|    4   | uploaded   |
//|    5   |   failed   |