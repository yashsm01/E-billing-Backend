'use strict';
module.exports = (sequelize, DataTypes) => {
  const customer_care = sequelize.define('customer_care', {
    id: { type: DataTypes.UUID, primaryKey: true },
    address: DataTypes.STRING,
    phone_no: DataTypes.STRING,
    email: DataTypes.STRING,
    marketed_by: DataTypes.STRING,
    facebook_link: DataTypes.STRING,
    instagram_link: DataTypes.STRING,
    twitter_link: DataTypes.STRING,
    linkedin_link: DataTypes.STRING,
    youtube_link: DataTypes.STRING,
    company_url: DataTypes.STRING,
    url: DataTypes.STRING,
    code_prefix: DataTypes.STRING,
    serialize_digit: { type: DataTypes.INTEGER, defaultValue: 0 },
    serialize_status: { type: DataTypes.BOOLEAN, defaultValue: false },
    manual_po_status: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    esign_status: { type: DataTypes.INTEGER, defaultValue: 1 },
    reject_error: { type: DataTypes.STRING },
    approved_by: { type: DataTypes.UUID },
    is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_3p: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_3p_logo: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    freezeTableName: true,
  });
  customer_care.associate = function (models) {
    // associations can be defined here
  };
  customer_care.sync({ alter: false })
  return customer_care;
};