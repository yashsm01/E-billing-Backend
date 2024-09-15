'use strict';
module.exports = (sequelize, DataTypes) => {
    const fifo_configuration = sequelize.define('fifo_configuration', {
        id:{
            type:DataTypes.UUID,
            primaryKey:true
          },
        month: DataTypes.INTEGER,
        created_by: DataTypes.UUID,
        createdAt: DataTypes.DATE,
    }, {
        freezeTableName: true,
        timestamps: false,
    });
    fifo_configuration.associate = function (models) {
        // associations can be defined here
    };
    return fifo_configuration;
};