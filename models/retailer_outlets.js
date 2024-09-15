'use strict';
module.exports = (sequelize, DataTypes) => {
  const retailer_outlets = sequelize.define('retailer_outlets', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true
    },
    retailer_id: { type: DataTypes.UUID, defaultValue: null },
    //group 1
    name: { type: DataTypes.STRING, defaultValue: null },
    pharmacist_name: { type: DataTypes.STRING, defaultValue: null },
    contact: { type: DataTypes.NUMERIC, defaultValue: null },
    email: { type: DataTypes.STRING, defaultValue: null },
    gstin: { type: DataTypes.STRING, defaultValue: null },
    lic_no: { type: DataTypes.STRING, defaultValue: null },
    //group 2
    address: { type: DataTypes.STRING, defaultValue: null },
    area: { type: DataTypes.STRING, defaultValue: null },
    city: { type: DataTypes.STRING, defaultValue: null },
    pincode: { type: DataTypes.STRING, defaultValue: null },
    //group 3
    country_id: { type: DataTypes.INTEGER, defaultValue: null },
    state_id: { type: DataTypes.INTEGER, defaultValue: null },
    city_id: { type: DataTypes.INTEGER, defaultValue: null },
    table_uid: { type: DataTypes.STRING, defaultValue: null },//(MM_YYYY)
    image: { type: DataTypes.STRING, defaultValue: null },

  }, {
    freezeTableName: true,
    timestamps: true
  });
  retailer_outlets.associate = function (models) {
    retailer_outlets.hasOne(models.retailers, {
      foreignKey: 'id',
      sourceKey: 'retailer_id',
      as: 'retailers'
    });
  };
  retailer_outlets.sync({ alter: false })
  return retailer_outlets;
};
