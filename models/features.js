'use strict';
module.exports = (sequelize, DataTypes) => {
  const features = sequelize.define('features', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING
    }
  }, {
    freezeTableName: true,
    timestamps: true
  });

  features.associate = function (models) {
    // Define associations if necessary
  };
  features.sync({ alter: false })
  return features;
};
