'use strict';
module.exports = (sequelize, DataTypes) => {
  const qrcode_shortcode = sequelize.define('qrcode_shortcode', {
    shortcode: DataTypes.STRING,
    longcode: DataTypes.STRING,
    roll_id:DataTypes.STRING,
    pin_no:DataTypes.STRING,
    sub_code:DataTypes.STRING,
    input_code:DataTypes.STRING,
  }, {});
  qrcode_shortcode.associate = function(models) {
    // associations can be defined here
  };
  return qrcode_shortcode;
};