'use strict';
module.exports = (sequelize, DataTypes) => {
    const summary_test = sequelize.define('summary_test', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true
        },
        location_id:DataTypes.UUID,
        name:DataTypes.STRING

    }, {
        freezeTableName: true,
        timestamps: false,
    });
    summary_test.associate = function (models) {
        // associations can be defined here
    };
    return summary_test;
};
