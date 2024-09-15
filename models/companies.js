'use strict';
module.exports = (sequelize, DataTypes) => {
  const companies = sequelize.define('companies', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true
    },
    name: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,

  }, {});
  companies.associate = function (models) {
    // associations can be defined here
  };
  companies.sync({ alter: false })
  return companies;
};


