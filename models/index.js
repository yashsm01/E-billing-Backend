'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.APP_ENV || 'dev';

// if (env == "production")
//   config = require(__dirname + '/../config/prod-config.json')[env];
// else
//   config = require(__dirname + '/../config/config.json')[env];

let config = require(`${__dirname}/../config/${env}-config.json`);

let dbConfig = config.db;

console.log("Database Connecting::", env, "::", dbConfig);
const db = {};
// console.log("Connecting db", dbConfig);

let sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);

// if (config.use_env_variable) {
//   sequelize = new Sequelize(process.env[config.use_env_variable], config);
// } else {
//   sequelize = new Sequelize(config.database, config.username, config.password, config);
// }
sequelize.options.logging = false

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    if (file != 'dynamic_models.js') {
      const model = sequelize['import'](path.join(__dirname, file));
      db[model.name] = model;
    }
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;