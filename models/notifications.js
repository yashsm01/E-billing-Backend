'use strict';
module.exports = (sequelize, DataTypes) => {
  const notifications = sequelize.define('notifications', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true
    },
    consumer_id: DataTypes.UUID,
    title: DataTypes.STRING,
    desc: DataTypes.STRING,
    type: DataTypes.INTEGER,
    status: DataTypes.INTEGER,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {});
  notifications.associate = function (models) {
    // associations can be defined here    
  };
  notifications.sync({ alter: false })
  return notifications;
};