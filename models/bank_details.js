'use strict';
module.exports = (sequelize, DataTypes) => {
  const bank_details = sequelize.define('bank_details', {
    id: { type: DataTypes.UUID, primaryKey: true },
    retailer_id: DataTypes.UUID,
    retail_outlet_id: DataTypes.UUID,
    bank_name: DataTypes.STRING,
    ifsc_code: DataTypes.STRING,
    account_no: DataTypes.STRING,

  }, {
    freezeTableName: true,
    timestamps: true
  });
  bank_details.associate = function (models) {
    // associations can be defined here
  };
  bank_details.sync({ alter: false });
  return bank_details;
};