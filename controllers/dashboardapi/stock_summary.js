
/**********************************************************
 * --------------------------This Component is not in use
 */


const Locations = require("../../models").locations;
const StockSummary = require("../../models").stock_summary;
const ProductBatches = require("../../models").product_batches;
const Products = require("../../models").products;
const ParentQRCodes = require("../../models").parent_qrcodes;
const StorageBins = require("../../models").storage_bins;
const logger = require("../../helpers/logger");
const path = require("path");
const uuid = require('uuid');

const env = process.env.APP_ENV || 'development';

let config;

if (env == "production")
  config = require(path.resolve(global.rootPath + '/config/prod-config.json'))[env];
else
  config = require(path.resolve(global.rootPath + '/config/config.json'))[env];


const {
  Client
} = require('pg');

let stock_summary = {
  //For initial stock count
  async stock_count() {
    try {
      let allLocations = await Locations.findAll({
        where: {
          is_deleted: false
        },
        attributes: ['id', 'unique_name'],
        raw: true
      });

      let allProducts = await Products.findAll({
        raw: true,
        attributes: ['id', 'u_id']
      });

      let allBatches = await ProductBatches.findAll({
        raw: true,
        attributes: ['id', 'expiry_date', 'product_id']
      });
      let storageBins = await StorageBins.findAll({
        where: { is_deleted: false },
        raw: true,
        attributes: ['id', 'location_id']
      });
      for (locationItem of allLocations) {
        //Create Table For Each Location
        const client = new Client({
          user: config.username,
          host: config.host,
          database: config.database,
          password: config.password,
          port: 5432,
        });
        await client.connect();
        let tname = locationItem.id.toString();
        console.log("tname", tname);
        let query = `CREATE TABLE public."` + tname + `" PARTITION OF public.stock_summary FOR VALUES IN('${locationItem.id}')`;
        console.log('Query: ', query);
        await client.query(query);
        await client.end();
        console.log('New Summary Table Has Created');


        for (let productItem of allProducts) {
          for (let batchItem of allBatches) {
            let countProduct = 0;
            if (productItem.id.toString() == batchItem.product_id.toString()) {
              for (let bin of storageBins) {
                if (bin.location_id.toString() == locationItem.id.toString()) {
                  let table_id = "trusted_qrcodes_" + productItem.u_id.toLowerCase();
                  console.log("table_id", table_id);
                  let trusted_qrcode = require("../../models/")[table_id];
                  countProduct = countProduct + await trusted_qrcode.count({
                    where: {
                      batch_id: batchItem.id,
                      is_scan_on_production_line: true,
                      is_deleted: false
                    }
                  });
                }
              }
            }

            await StockSummary.create({
              id: uuid(),
              product_id: productItem.id,
              batch_id: batchItem.id,
              location_id: locationItem.id,
              total_stock: countProduct,
              sellable_stock: countProduct,
              expiry_date: batchItem.expiry_date
            });
          }
        }
      }
      return res.status(200).send({ success: '1' });
    }
    catch (error) {
      return res.status(500).send({ success: '0', message: error.message });
    }
  },
  //when user add new location create new partition and set intial 0 data to all batches
  async add_new_location_summary(tableName, partitionExp) {
    try {
      const client = new Client({
        user: config.username,
        host: config.host,
        database: config.database,
        password: config.password,
        port: 5432,
      });
      await client.connect();
      let query = `CREATE TABLE public."` + tableName + `" PARTITION OF public.stock_summary FOR VALUES IN('${partitionExp}')`;
      console.log('Query: ', query);
      await client.query(query);
      await client.end();
      console.log('New Summary Table Has Created');

      let allProducts = await Products.findAll({
        raw: true,
        attributes: ['id']
      });

      let allBatches = await ProductBatches.findAll({
        raw: true,
        attributes: ['id', 'product_id', 'expiry_date']
      });

      for (let productItem of allProducts) {
        for (let batchItem of allBatches) {
          if (batchItem.product_id.toString() == productItem.id.toString()) {
            await StockSummary.create({
              id: uuid(),
              product_id: productItem.id,
              batch_id: batchItem.id,
              location_id: tableName,
              sellable_stock: 0,
              total_stock: 0,
              expiry_date: batchItem.expiry_date
            });
          }
        }
      }
    }
    catch (error) {
      logger.error("summary table generation error", error.message);
      console.log("error in table creation ", error.message);
    }
  },
  //when user create new batch add batch stock 0 to all location
  async add_new_batch_summary(batchId) {
    try {
      let batchDetails = await ProductBatches.findOne({
        where: {
          id: batchId
        },
        raw: true,
        attributes: ['id', 'product_id', 'expiry_date']
      });
      if (batchDetails) {
        let allLocations = await Locations.findAll({
          raw: true,
          attributes: ['id']
        });

        for (let locationItem of allLocations) {
          await StockSummary.create({
            id: uuid(),
            product_id: batchDetails.product_id,
            batch_id: batchDetails.id,
            location_id: locationItem.id,
            expiry_date: batchDetails.expiry_date,
            sellable_stock: 0,
            total_stock: 0
          });
        }
      }
    }
    catch (error) {
      logger.error("error in add new batch summary", error.message);
      console.log("error", error.message);
    }
  }
};

module.exports = stock_summary;
