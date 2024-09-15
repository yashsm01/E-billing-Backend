const v = require("node-input-validator");
const logger = require("../../helpers/logger");
const uuid = require("uuid");
const { Op } = require("sequelize");
const sequelize = require("sequelize");

const storageBins = require("../../models/").storage_bins;
const product = require("../../models/").products;


//total inventory for trusttrack app
const location_inventory = {
  getInventoryCount: async (req, res) => {
    try {
      let locationId = req.headers["locationId"];
      //get all storage bins from location id
      let storage_bins = await storageBins.findAll({
        where: { location_id: locationId },
        raw: true,
        attributes: ['id']
      });
      let storage_bin_id = storage_bins.map(bin => { return bin.id });
      let stock = [];
      let all_products = await product.findAll(
        { raw: true, attributes: ['id', 'sku', 'u_id'] });
      for (let product_item of all_products) {
        let product_uid = product_item.u_id;
        let table_id = "trusted_qrcodes_" + product_uid.toLowerCase();
        let trusted_qrcode = require("../../models/")[table_id];

        trusted_qrcode.belongsTo(storageBins, { foreignKey: "storagebin_id" });
        storageBins.hasMany(trusted_qrcode, { foreignKey: "storagebin_id" });
        let product_stock = await trusted_qrcode.findAll({
          where: {
            storagebin_id: { [Op.in]: storage_bin_id },
            is_deleted: false
          },
          attributes: [
            [sequelize.fn("COUNT", "id"), "count"],
          ],
          raw: true,
          nest: true
        });
        for (let data of product_stock) {
          if (data.count > 0) {
            let obj = {
              sku: product_item.sku,
              units: data.count,
            }
            stock.push(obj);
          }
        }
      }
      return res.status(200).send({ success: '1', data: stock })
    }
    catch (error) {
      logger.error(req, error.message);
      return res.status(500).send({ success: '0', message: error.message });
    }
  }
}

module.exports = location_inventory;