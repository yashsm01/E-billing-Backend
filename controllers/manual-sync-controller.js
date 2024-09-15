const Sequelize = require('sequelize');
let Op = Sequelize.Op;
const { Client } = require('pg');
const path = require('path')
const commonController = require('./common')
const fs = require('fs')
const csvParser = require('csv-parser');
const copyFrom = require('pg-copy-streams').from;
// Models::
const ProductBatchModel = require('../models').product_batches
const ProductModel = require('../models').products;
const DynamicModels = require('../models/dynamic_models');
const qrcodeCodeController = require('./qr-codes-controller');
const StorageBinModel = require('../models').storage_bins
const LocationModel = require('../models').locations
const OrderModel = require('../models').orders;

var controller = {
  async updateFactorVariables() {
    let allBatches = await ProductBatchModel.findAll({
      where: {},
      // limit: 1,
      raw: true
    })

    console.log("All Batches::", allBatches.length);

    for (let [index, element] of allBatches.entries()) {
      // let productInfo = await ProductModel.findOne({
      //     where: {
      //         id: element.product_id
      //     },
      //     raw: true,
      // })
      let factorInfo = await commonController.calculateMFactor(element);
      console.log("Facto Info", factorInfo);
      await ProductBatchModel.update({
        // size: productInfo.size,
        // shelf_life: productInfo.shelf_life,
        // standard_unit: productInfo.standard_unit,
        // is_secondary: productInfo.is_secondary,
        // is_tertiary: productInfo.is_tertiary,
        // packaging_type: productInfo.packaging_type,
        // secondary_size: productInfo.secondary_size,
        // tertiary_size: productInfo.tertiary_size,
        // outer_size: productInfo.outer_size,
        // is_mapp_primary: productInfo.is_mapp_primary,
        // is_mapp_secondary: productInfo.is_mapp_secondary,
        // is_mapp_tertiary: productInfo.is_mapp_tertiary,
        // is_mapp_outer: productInfo.is_mapp_outer,
        // is_loose_allowed: productInfo.is_loose_allowed,
        p_factor: factorInfo.pFactor,
        s_factor: factorInfo.sFactor,
        t_factor: factorInfo.tFactor,
        o_factor: factorInfo.oFactor,
      }, {
        where: {
          id: element.id
        }
      })
      console.log("Completed::", index + 1, "/", allBatches.length);
    }
    console.log("All Updated");
  },


  async updateOrdeDetailsTables() {
    let orders = await OrderModel.findAll({
      where: {},
      // limit: 1,
      attributes: ['id', 'o_uid'],
    })
    let updated = []
    for (let [index, element] of orders.entries()) {
      let UID = element.o_uid;
      if (!updated.includes(UID)) {
        await DynamicModels.getOrderDetailsModel(UID.toLowerCase()); // Sending Sync at the time of code generation only
        updated.push(UID)
      }
      console.log(index + 1, ">>>>>>>>", UID);
    }
  },

  async updateTablesVariables() {

    let products = await ProductModel.findAll({
      where: {},
      attributes: ['id', 'u_id'],
      order: [["u_id", "ASC"]],
    })

    for (let [index, element] of products.entries()) {
      let UID = element.u_id
      console.log(UID);
      let CustomModel1 = await DynamicModels.getPrimaryQRCodesModel(UID.toLowerCase(), true); // Sending Sync at the time of code generation only
      let CustomModel2 = await DynamicModels.getSecondaryQRCodesModel(UID.toLowerCase(), true);
      let CustomModel3 = await DynamicModels.getTertiaryQRCodesModel(UID.toLowerCase(), true);
      let CustomModel4 = await DynamicModels.getOuterQRCodesModel(UID.toLowerCase(), true);

      console.log(index + 1, "/", products.length, "Primary", CustomModel1);
      console.log(index + 1, "/", products.length, "S", CustomModel2);
      console.log(index + 1, "/", products.length, "T", CustomModel3);
      console.log(index + 1, "/", products.length, "O", CustomModel4);
    }
  },

  async updateStorageBins() {
    try {
      console.log("Update Storage Bin Called::");
      let locations = await LocationModel.findAll({})

      let bins = ['OK', 'Missing', 'In Transit', 'Damage']

      for (let [index, element] of locations.entries()) {
        for (let bin of bins) {
          let exists = await StorageBinModel.findOne({
            where: {
              location_id: element.id,
              name: bin
            },
            raw: true
          })
          if (!exists) {
            await StorageBinModel.create({
              name: bin,
              location_id: element.id,
            });
          }
        }
        console.log(">>>>>>>>>>Bins Updated::", index + 1 + "/" + locations.length);
      }


      // await StorageBinModel.update({
      //     is_default_bin: true,
      //     status: true
      // }, {
      //     where: {
      //         // name: {
      //         //     [Op.ne]: 'OK'
      //         // }
      //         name: 'OK'
      //     }
      // })

    } catch (error) {
      console.log(error);
    }
  },

  async importPreviousCodes() {
    return qrcodeCodeController.importPreviousCodes({}, {})
  },

  async updateLabelAndLeaflet() {
    try {
      let allPorducts = await ProductModel.findAll({
        where: {
          is_general: false
        },
        raw: true
      })

      let udapted = 0;
      for (const itm of allPorducts) {
        let fileName = itm.id
        let labelURL = `${global.config.storage.url}/product-label/${fileName}.pdf`
        let leafletURL = `${global.config.storage.url}/product-leaflet/${fileName}.pdf`;
        await ProductModel.update({
          product_label: labelURL,
          product_leaflet: leafletURL,
        }, {
          where: {
            id: itm.id
          }
        })
        udapted++
        console.log(">>>>>>>>>>>Updated", udapted, "/", allPorducts.length);
      }


    } catch (error) {
      console.log(error);
      return;
    }
  },
  async manualImportCodes() {
    try {

      let dbConfig = global.config.db;
      // path: path.join(__dirname, 'logs', 'info')

      console.log('dbConfig: ', dbConfig, __dirname);
      const client = new Client({
        user: dbConfig.username,
        host: dbConfig.host,
        database: dbConfig.database,
        password: dbConfig.password,
        port: 5432,
      });
      await client.connect();

      let folderPath = path.join(__dirname, 'csvs',);

      getCSVFileNames(folderPath)
        .then(async csvFiles => {
          console.log('CSV files in the folder:', csvFiles);

          for (const [index, fileName] of csvFiles.entries()) {
            console.log(">>>>>>>>>>>Processing", index + 1 + "/", csvFiles.length);

            let filePath = path.join(__dirname, 'csvs', fileName)
            console.log(">>>>>>>filePath", filePath);
            // let tableName = 'test_1aq_outer_2';
            let tableName = path.basename(fileName, '.csv');
            console.log(">>>>>>>>>>>>>>tableName", tableName);

            let csvHeaders = [];
            csvHeaders = await readCsvHeaders(filePath);

            const fileStream = fs.createReadStream(filePath);
            console.log(">>>>>>>>>>>>Generating Query");
            const query = `COPY ${tableName} (${csvHeaders.join(',')}) FROM STDIN DELIMITER ',' CSV HEADER`;

            const copyStream = client.query(copyFrom(query));


            copyStream.on('error', async (error) => {
              console.error('Error copying data', error);
              const newFileName = "rejected_" + fileName;
              const newFilePath = await renameFile(filePath, 'rejected', newFileName);
              console.log('File renamed successfully:', newFilePath);
            });
            copyStream.on('end', async () => {
              console.log('Data import completed successfully');
              const newFileName = "accepted_" + fileName;
              const newFilePath = await renameFile(filePath, 'accepted', newFileName);
              console.log('File renamed successfully:', newFilePath);
            });

            fileStream.on('error', async (error) => {
              console.error('Error reading file', error);
              const newFileName = "rejected_" + fileName;
              const newFilePath = await renameFile(filePath, 'rejected', newFileName);
              console.log('File renamed successfully:', newFilePath);
            });

            fileStream.pipe(copyStream);
            // console.log("File is Rejected", isFileRejected);
            // if (!isFileRejected) {
            //     console.log(">>>>>>>>>>>>>File Imported Successfully");

            //     const newFileName = "accepted_" + fileName;
            //     const newFilePath = await renameFile(filePath, '', fileName);
            //     console.log('File renamed successfully:', newFilePath);
            // }
          }

        })
        .catch(error => {
          console.error('Error reading folder:', error);
        });
      return;
    } catch (error) {
      console.log(error);
    }
  },

  async manualUpdateBatchLabelLeaflet() {
    try {

      let allBatches = await ProductBatchModel.findAll({
        where: {},
        include: [
          {
            model: ProductModel,
            attributes: ['main_image', 'product_label', 'product_leaflet'],
            raw: true,
          }
        ],
        attributes: ['id', 'main_image', 'product_label', 'product_leaflet'],
        raw: true,
        nest: true

      });

      let udapted = 0;
      console.log(">>>>>>>>>>>batch", allBatches[0]);
      for (const itm of allBatches) {

        let updateClause = {}
        if (!itm.main_image) {
          updateClause.main_image = itm.product.main_image
        }
        if (!itm.product_label) {
          updateClause.product_label = itm.product.product_label
        }
        if (!itm.product_leaflet) {
          updateClause.product_leaflet = itm.product.product_leaflet
        }

        console.log(">>>>>>>>updateClause", updateClause);

        await ProductBatchModel.update(
          updateClause,
          {
            where: {
              id: itm.id
            }
          })
        udapted++
        console.log(">>>>>>>>>>>Updated", udapted, "/", allBatches.length);
      }


    } catch (error) {
      console.log(error);
      return;
    }
  },



  async generateStorageBins() {
    let allLocations = await LocationModel.findAll({
      where: {
        is_uploaded: true
      },
      attributes: ['id'],
      raw: true
    })
    let count = 0;
    for (let [index, element] of allLocations.entries()) {
      console.log(">>>>>>>>>>>>>>>", index + 1, "/", allLocations.length);

      let storageBin = await StorageBinModel.findOne({
        where: {
          location_id: element.id
        }
      })

      if (!storageBin) {
        count++;
        console.log(">>>>>>>>>>>>>>>>>>> Done", count);
        await StorageBinModel.create({
          name: "In Transit",
          location_id: element.id,
        });
        await StorageBinModel.create({
          name: "OK",
          location_id: element.id,
          is_default_bin: true
        });
        await StorageBinModel.create({
          name: "Damage",
          location_id: element.id,
        });
        // await StorageBinModel.create({
        //     name: "Missing",
        //     location_id: element.id,
        // });
      }
    }

  }

}

async function readCsvHeaders(filePath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);
    fileStream
      .pipe(csvParser())
      .on('headers', (headers) => {
        resolve(headers);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}


function getCSVFileNames(folderPath) {
  return new Promise((resolve, reject) => {
    fs.readdir(folderPath, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      const csvFiles = files.filter(file => path.extname(file).toLowerCase() === '.csv');
      resolve(csvFiles);
    });
  });
}

async function renameFile(filePath, newPath, newFileName,) {
  const directory = path.dirname(filePath);
  const newFilePath = path.join(directory, newPath, newFileName);
  try {
    await fs.promises.rename(filePath, newFilePath);
    return newFilePath;
  } catch (err) {
    throw err;
  }
}

module.exports = controller;