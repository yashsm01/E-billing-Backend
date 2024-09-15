'use strict';
module.exports = (sequelize, DataTypes) => {
  const system_access = sequelize.define('system_access', {
    secret_key: DataTypes.STRING,
    is_active: DataTypes.BOOLEAN,
    location_id: DataTypes.UUID,
    u_id: DataTypes.STRING,
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: new Date()
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: new Date()
    },
    last_sync_at: {
      type: DataTypes.DATE,
    },
    local_last_sync_at: {
      type: DataTypes.DATE
    }
  }, {
    freezeTableName: true,
    timestamps: true
  });
  system_access.associate = function (models) {
    // associations can be defined here
  };

  system_access.sync({ alter: false })

  return system_access;
};
