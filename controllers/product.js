const v = require("node-input-validator");
const uuid = require("uuid");
const randomstring = require("randomstring");
const fs = require("fs");
const path = require("path");
const { Client } = require('pg');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

//middleware
const message = require("../i18n/en");
const logger = require('../helpers/logger');
let AddInProgress = false;
let updateInProgress = false;

// models
const db = require('../models');
const Product = require("../models/").products;
const Brand = require("../models/").brands;
const Category = require("../models/").categories;
const Company = require("../models/").companies;
const Varient = require("../models/").varients;
const Size = require("../models/").options;
const Packaging = require("../models/").packagings;
const DynamicUIDModel = require('../models/').dynamic_uids;
const ProductGroup = require("../models/").product_group;
const ProductRange = require("../models/").product_range;
const LocationModel = require("../models/").locations;
const CustomerCareModel = require("../models/").customer_care;
const models = require("./_models");
const DynamicModels = require('../models/dynamic_models')


// controller
const parseValidate = require("../middleware/parseValidate");
const e = require("connect-timeout");
const companies = require("../models/companies");

const imageDir = path.join("uploads/product/");
const labelDir = path.join("uploads/product_label/");

const controllers = require("./_controller");


const productController = {

  search: async function (req, res) {
    try {
      let { search } = req.body;

      // Initialize an empty where clause
      let whereClause = {};

      // Build the where clause based on the starting character of the search term
      if (search && search.length >= 3) {
        const searchTerm = search.trim().toLowerCase(); // Ensure the search term is trimmed and in lowercase

        if (searchTerm.startsWith('c.')) {
          whereClause = {
            content: {
              [Op.iLike]: `%${searchTerm.substring(2).trim()}%`
            }
          };
        } else if (searchTerm.startsWith('s.')) {
          whereClause = {
            salt: {
              [Op.iLike]: `%${searchTerm.substring(2).trim()}%`
            }
          };
        } else if (searchTerm.startsWith('q.')) {
          const qrCode = searchTerm.substring(2).trim();
          console.log("01", qrCode);

          // Find the batch stock with the given QR code
          const stockSchema = await models.stockSchema(req.tableUid);
          const batchStock = await stockSchema.batchStockModels.findOne({
            where: {
              retailer_id: req.retailerId,
              retail_outlet_id: req.retailOutletId,
              qr_code: {
                [Op.iLike]: qrCode  // Use iLike for case-insensitive match
              }
            },
            include: [
              {
                model: models.productsModel,
                as: 'products',
                raw: true,
                nest: true
              },
              {
                model: stockSchema.productStockModels, // Include related batch details
                where: { retailer_id: req?.retailerId ?? null, retail_outlet_id: req?.retailOutletId ?? null },
                required: false,
                as: 'product_stocks',
                raw: true,
                nest: true
              },
              {
                model: stockSchema.retailBatchModels, // Include related batch details
                include: [{
                  model: stockSchema.batchStockModels, // Include related batch details
                  where: { retailer_id: req?.retailerId ?? null, retail_outlet_id: req?.retailOutletId ?? null },
                  required: false,
                  as: 'batch_stocks',
                  raw: true,
                  nest: true
                }],
                as: 'product_batches',
                raw: true,
                nest: true
              }
            ],
            raw: true,
            nest: true
          });

          // If no batch stock is found, return a message
          if (!batchStock) {
            return res.status(200).send({ success: 0, message: "No products found matching your search criteria." });
          }

          // Return the batch stock details along with associated product information
          return res.status(200).send({ success: 1, data: { product: batchStock.products, batch: batchStock.product_batches, product_stocks: batchStock.product_stocks, batchStock: batchStock } });
        } else {
          whereClause = {
            [Op.or]: [
              { name: { [Op.iLike]: `%${searchTerm}%` } }
            ]
          };
        }
      }

      // Fetch products from the database based on the where clause
      const productSchema = await models.productSchema(req.tableUid);

      let filteredProducts = await productSchema.ProductModals.findAll({
        where: whereClause,
        include: [
          {
            model: Category,
            raw: true,
            as: 'categorys'
          },
          {
            model: models.companiesModel,
            raw: true,
          },
          {
            model: productSchema.productStockModels,
            where: { retailer_id: req?.retailerId ?? null, retail_outlet_id: req?.retailOutletId ?? null },
            required: false,
            as: 'product_stocks',
            raw: true,
            nest: true
          },
        ],
        order: [['updatedAt', 'DESC']],
        raw: true,
        nest: true
      });

      // If no products are found, return an appropriate message
      if (filteredProducts.length === 0) {
        return res.status(200).send({ success: 0, message: "No products found matching your search criteria." });
      }

      // Return the filtered list of products
      return res.status(200).send({ success: 1, data: filteredProducts });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.toString()
      });
    }
  },

  list: async function (req, res) {
    try {
      let whereClause = {
        // is_general: false,
      }

      let allProducts = await Product.findAll({
        where: whereClause,
        include: [
          {
            model: Category,
            raw: true,
            as: 'categorys'
          },
          {
            model: models.companiesModel,
            raw: true,
          }
        ],
        order: [['updatedAt', 'DESC']],
        raw: true,
        nest: true
      });

      console.log(">>>>>>>> all products", allProducts);
      return res.status(200).send({ success: 1, data: allProducts })
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  productVerification: async function (req, res) {
    const productList = req.body;
    const Size = 10; // Adjust this size based on your server's capacity

    try {
      let productStatus = [];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      for (let i = 0; i < productList.length; i += Size) {
        const chunk = productList.slice(i, i + Size);
        const chunkNames = chunk.map(x => x.product_name);

        // Fetch products that match the names in the chunk
        const products = await models.productsModel.findAll({
          where: {
            name: { [Op.iLike]: { [Op.any]: chunkNames.map(name => `%${name}%`) } }
          },
          raw: true
        });

        const productIds = products.map(p => p.id);

        const retailOutletDetails = await models.retailerOutletsModels.findOne({
          where: {
            id: req.retailOutletId
          },
          raw: true
        });

        if (!retailOutletDetails) {
          return res.status(400).send({ success: 0, message: "Retail outlet details not found" });
        }

        // Fetch the relevant batch for the products in the chunk
        const dynamicRetailerBatchModel = await models.dynamicModel.getRetailerBatchModel(retailOutletDetails.table_uid);
        const batches = await dynamicRetailerBatchModel.findAll({
          where: {
            retailer_id: req?.retailerId ?? null,
            retail_outlet_id: req?.retailOutletId ?? null,
            product_id: { [Op.in]: productIds },
            exp_date: { [Op.gt]: yesterday }
          },
          order: [['createdAt', 'DESC']],
          raw: true
        });

        console.log("batches:", batches);

        // Process chunk and check batch availability
        const processedChunk = chunk.map(x => {
          const availableProduct = products.find(y => y.name.toLowerCase() === x.product_name.toLowerCase());

          let batchInfo = null;
          if (availableProduct) {
            x.product_id = availableProduct?.id ?? "";
            x.content = availableProduct?.content ?? "";
            x.product_info = availableProduct;

            let packing = `1 ${availableProduct.uom} of ${availableProduct.unit_size}`;
            packing += (availableProduct.uom.toLowerCase() !== "strip" && availableProduct.uom.toLowerCase() !== "strips") ? " Ml" : " Tablet";
            x.packaging = packing;

            // Fetch the matching batch
            batchInfo = batches.find(batch =>
              batch.product_id === availableProduct.id && batch.batch_no === x.batch_no
            );
          }

          return {
            ...x,
            is_available: !!availableProduct,       // True if the product is found
            is_batch_available: !!batchInfo,        // True if a matching batch is found
            batch_id: batchInfo ? batchInfo.id : null,        // Return batch_id if batch is found
            product_batches: batchInfo || null,       // Return the batch data directly, not in an array
          };
        });

        productStatus = productStatus.concat(processedChunk);
      }

      res.status(200).send({ success: 1, data: productStatus, message: "Product verification completed" });
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  createNewtables: async function (tables, lastCode) {
    await createNewtables(tables, lastCode);
    return true;
  },
  assignDynamicUIDs: async function (UID) {
    await assignDynamicUIDs(UID);
    return true;
  },
  // add_older: {
  //   add: async function (req, res) {
  //     try {
  //       let validator = new v(req.body, {
  //         skuId: "required",
  //         skuName: "required",
  //         mrp: "required",
  //         standardUnit: "required",
  //         cautionLogo: "required",
  //       });

  //       let matched = await validator.check();
  //       if (!matched) {
  //         let validatorError = await parseValidate(validator.errors)
  //         return res.status(200).send({ success: 0, message: validatorError });
  //       }

  //       req.body.skuId = req.body.skuId.trim().toUpperCase();
  //       if (req.body.skuId.includes(' ')) {
  //         return res.status(200).send({ success: 0, message: "Space Not allowd in Item Code" })
  //       }
  //       const isExist = await Product.count({
  //         where: {
  //           sku: req.body.skuId,
  //         },
  //       });

  //       if (isExist > 0) {
  //         return res.status(200).send({
  //           success: 0,
  //           message: `Item Id already found!`,
  //         });
  //       }

  //       if (req.body.gtin) {
  //         let isGtinExists = await Product.findOne({
  //           where: {
  //             gtin: req.body.gtin
  //           },
  //           raw: true
  //         })

  //         if (isGtinExists) {
  //           return res.status(200).send({ success: 0, message: "GTIN Already Exists" })
  //         }
  //       }

  //       let lastProduct = await Product.findOne({
  //         where: {},
  //         attributes: ['u_id'],
  //         order: [
  //           ["createdAt", "DESC"]
  //         ]
  //       });

  //       let lastCode = '1AA';

  //       if (lastProduct) {
  //         lastCode = ((parseInt(lastProduct.u_id, 36) + 1).toString(36)).replace(/0/g, 'A').toUpperCase();
  //       }
  //       // console.log(">>>>>>>>>>>req", req.body);
  //       // console.log(">>>>>>>>req.files", req.files);

  //       let productId = uuid();
  //       let imageURL = '';
  //       let labelURL = '';
  //       let leafletURL = '';
  //       if (req.files) {
  //         if (req.files.productImage) {
  //           if (!ValidateFileType(req.files.productImage)) {
  //             return res.status(200).send({ success: "0", message: "Invalid Image" });
  //           }
  //           const fileExtension = path.extname(req.files.productImage.name);
  //           const fileName = productId + fileExtension
  //           //----------AWS s3 Image upload------
  //           let params = {
  //             Bucket: `${global.config.storage.name}/product-image`,
  //             Key: fileName,
  //             Body: req.files.productImage.data,
  //           }
  //           let response = await global.s3.upload(params).promise();
  //           imageURL = response.Location;
  //         }

  //         if (req.files.productLabel) {
  //           if (!ValidateFileTypes(req.files.productLabel)) {
  //             return res.status(200).send({ success: "0", message: "Product label pdf is not valid" });
  //           }
  //           const fileExtension = path.extname(req.files.productLabel.name);
  //           const fileName = productId + fileExtension
  //           //----------AWS s3 Image upload------
  //           let params = {
  //             Bucket: `${global.config.storage.name}/product-label`,
  //             Key: fileName,
  //             Body: req.files.productLabel.data,
  //           }
  //           let response = await global.s3.upload(params).promise();
  //           labelURL = response.Location;
  //         }

  //         if (req.files.productLeaflet) {
  //           if (!ValidateFileTypes(req.files.productLeaflet)) {
  //             return res.status(200).send({ success: "0", message: "Product leaflet pdf is not valid" });
  //           }

  //           const fileExtension = path.extname(req.files.productLeaflet.name);
  //           const fileName = productId + fileExtension
  //           //----------AWS s3 Image upload------
  //           let params = {
  //             Bucket: `${global.config.storage.name}/product-leaflet`,
  //             Key: fileName,
  //             Body: req.files.productLeaflet.data,
  //           }
  //           let response = await global.s3.upload(params).promise();
  //           leafletURL = response.Location;
  //         }
  //       }
  //       console.log(">>>>>>>>>>>>>imageURL", imageURL);
  //       console.log(">>>>>>>>>>>>>lableURL", labelURL);
  //       console.log(">>>>>>>>>>>>>leafletURL", leafletURL);

  //       req.body.is_secondary = req.body.is_secondary == 'true' ? true : false;
  //       req.body.is_tertiary = req.body.is_tertiary == 'true' ? true : false;
  //       req.body.skip_aggregation = req.body.skip_aggregation == 'true' ? true : false;
  //       await Product.create({
  //         id: productId,
  //         sku: req.body.skuId,
  //         name: req.body.skuName,
  //         size: req.body.skuSize,
  //         description: req.body.description,
  //         technical_name: req.body.technicalName,
  //         mrp: req.body.mrp,
  //         packaging_type: req.body.packagingType,
  //         standard_unit: req.body.standardUnit,  // UOM
  //         is_secondary: req.body.is_secondary || false,
  //         is_tertiary: req.body.is_tertiary || false,
  //         secondary_size: req.body.is_secondary ? req.body.secondarySize : null,
  //         tertiary_size: req.body.is_tertiary ? req.body.tertiarySize : null,
  //         outer_size: req.body.outerSize != 'null' ? req.body.outerSize : null,
  //         is_mapp_primary: req.body.isMappPrimary,
  //         is_mapp_secondary: req.body.isMappSecondary,
  //         is_mapp_tertiary: req.body.isMappTertiary,
  //         is_mapp_outer: req.body.isMappOuter,
  //         u_id: lastCode,
  //         is_loose_allowed: req.body.is_loose_allowed,
  //         product_label: labelURL,
  //         product_leaflet: leafletURL,
  //         main_image: imageURL,
  //         caution_logo: req.body.cautionLogo,
  //         gtin: req.body.gtin,
  //         reg_no: req.body.regNo,
  //         created_by: req.userId,
  //         category: req.body.category,
  //         product_group: req.body.productGroup ? req.body.productGroup : null,
  //         product_range: req.body.productRange ? req.body.productRange : null,
  //         location_id: req.body.locationId ? req.body.locationId : null,
  //         marketed_by: req.body.marketedBy ? req.body.marketedBy : null,
  //         skip_aggregation: req.body.skip_aggregation,
  //         antitode_statement: req.body.antitode,
  //         product_info_web_url: req.body?.webURL,
  //         esign_status: req.body.skip_aggregation && global.config.isEsignBased ? 1 : 2,
  //       });

  //       // create new table of QR codes
  //       let tables = [
  //         "primary_qrcodes",
  //         "secondary_qrcodes",
  //         "tertiary_qrcodes",
  //         "outer_qrcodes",
  //       ]
  //       await createNewtables(tables, lastCode.toLowerCase());
  //       await assignDynamicUIDs(lastCode.toUpperCase())
  //       // here write new model for QR codes

  //       return res.status(200).send({
  //         success: 1,
  //         message: "Product added successfully."
  //       });
  //     } catch (ex) {
  //       console.error(ex);
  //       logger.error(req, ex.message);
  //       return res.status(500).send({
  //         success: 0,
  //         message: ex.message
  //       });
  //     }
  //   },
  // },

  add: async function (req, res) {
    try {

      console.log(">>>>>>>>>>>>>>>>.req.body>>>>>>>>>>", req.body);

      let validator = new v({
        itemName: { type: "string", min: 1, max: 125, empty: false },
        hsn: { type: "string", min: 1, max: 125, empty: false },
        salt: { type: "string", min: 1, max: 125, empty: false },
        dosage: { type: "string", min: 1, max: 125, empty: false },
        content: { type: "string", min: 1, max: 125, empty: false },
        packagingSize: { type: "string", min: 1, max: 125, empty: false },
        unitSize: { type: "string", min: 1, max: 125, empty: false },
        uom: { type: "string", min: 1, max: 125, empty: false },
        category: { empty: false },
        description: { type: "string", min: 1, max: 125, empty: false },
        companyName: { empty: false },
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      const isExists = await Product.findOne({
        where: {
          hsn_code: req.body.hsn,
          name: req.body.itemName,
          unit_size: req.body.unitSize
        }
      });
      if (isExists > 0) {
        return res.send({ success: 0, message: "Product already found!" });
      }


      console.log(">>>>>>>>req.files", req.files);


      let imageURL = '';
      let labelURL = '';
      let leafletURL = '';

      let productId = uuid();


      if (req.files) {
        if (req.files.productImage) {
          if (!ValidateFileType(req.files.productImage)) {
            return res.status(200).send({ success: "0", message: "Invalid Image" });
          }
          const fileExtension = path.extname(req.files.productImage.name);
          const fileName = productId + fileExtension
          //----------AWS s3 Image upload------
          let params = {
            Bucket: `${global.config.storage.name}/product-image`,
            Key: fileName,
            Body: req.files.productImage.data,
          }
          let response = await global.s3.upload(params).promise();
          imageURL = response.Location;
        }

        // console.log("req.files.productLabelreq.files.productLabel>>>>", req.files.productLabel);
        // if (req.files.productLabel) {
        //   if (!ValidateFileTypes(req.files.productLabel)) {
        //     return res.status(200).send({ success: "0", message: "Product label pdf is not valid" });
        //   }
        //   const fileExtension = path.extname(req.files.productLabel.name);
        //   const fileName = productId + fileExtension
        //   //----------AWS s3 Image upload------
        //   let params = {
        //     Bucket: `${global.config.storage.name}/product-label`,
        //     Key: fileName,
        //     Body: req.files.productLabel.data,
        //   }
        //   let response = await global.s3.upload(params).promise();
        //   labelURL = response.Location;
        // }

        // console.log("req.files.productLeafletreq.files.productLeaflet", req.files.productLeaflet);
        // if (req.files.productLeaflet) {
        //   if (!ValidateFileTypes(req.files.productLeaflet)) {
        //     return res.status(200).send({ success: "0", message: "Product leaflet pdf is not valid" });
        //   }

        //   const fileExtension = path.extname(req.files.productLeaflet.name);
        //   const fileName = productId + fileExtension
        //   //----------AWS s3 Image upload------
        //   let params = {
        //     Bucket: `${global.config.storage.name}/product-leaflet`,
        //     Key: fileName,
        //     Body: req.files.productLeaflet.data,
        //   }
        //   let response = await global.s3.upload(params).promise();
        //   leafletURL = response.Location;
        // }

      }


      console.log(">>>>>>>>>>>>>>>>req.body.category>>>>>>>", req.body.category);
      // let categoryDetails = await models.categoryModel.findOne({ where: { name: req.body.category, is_deleted: false }, raw: true });
      // if (categoryDetails) {
      //   req.body.category = categoryDetails.id;
      //   console.log(">>>>>>>>>>>>>>>>req.body.category>>>>>>>", req.body.category);
      // }
      // else {

      // }

      console.log(">>>>>>>>>>>>>>>>req.body.companyName>>>>>>>", req.body.companyName);
      // let companyDetails = await models.companiesModel.findOne({ where: { name: req.body.companyName }, raw: true });
      // if (companyDetails) {
      //   req.body.companyName = companyDetails.id;
      //   console.log(">>>>>>>>>>>>>>>>req.body.companyName>>>>>>>", req.body.companyName);
      // }
      // else {

      // }

      console.log(">>>>>>>>>>>>>>>>.req.body>>>>>>>>>>", req.body);

      let productData = {

        id: productId,

        name: req.body.itemName,
        hsn_code: req.body.hsn,
        salt: req.body.salt,
        dosage_type: req.body.dosage,
        content: req.body.content,
        packing_size: req.body.packagingSize,
        unit_size: req.body.unitSize,
        uom: req.body.uom,
        category: req.body.category,
        description: req.body.description,
        company_id: req.body.companyName,
        image: imageURL,
      }

      console.log(">>>>>>>>>>>>>>>>productData>>>>>>>>>", productData);
      await Product.create(productData);

      res.status(200).send({
        success: 1, message: "Product added successfully."
      });
    } catch (ex) {
      console.log(ex);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },

  bulkAdd: async function (req, res) {
    try {

      let validator = new v(req.body, {
        products: "required",
      });
      let matched = await validator.check();
      if (!matched) {
        let validatorError = parseValidate(validator.errors)
        return res
          .status(200)
          .send({ success: "0", message: validatorError });
      }

      let rejectedArray = [];

      let allProducts = JSON.parse(req.body.products);

      for (const item of allProducts) {
        let itemValidator = new v(item, {
          itemCode: "required",
          itemName: "required",
          salt: "required",
          dosage_type: "required",
          content: "required",
          mrp: "required",
          packing_size: "required",
          size: "required",
          manufacturer_name: "required",
          category: "required",
          description: "required",
          companyName: "required",
        });

        let matched = await itemValidator.check();
        if (!matched) {
          let errors = parseValidate(itemValidator.errors);
          // rejectedArray.push({ ...item, reason: errors });
          return res.status(200).send({ success: "0", message: errors });
        }
      }

      let headerName = {
        "itemName": "name",
        "itemCode": "item_code",
        "hsn_code": "hsn_code",
        "image": "image",
        "salt": "salt",
        "dosage_type": "dosage_type",
        "content": "content",
        "mrp": "mrp",
        "packing_size": "packing_size",
        "size": "size",
        "manufacturer_name": "manufacturer_name",
        "category": "category",
        "description": "description",
        "companyName": "company_id",
      };
      for (let element of allProducts) {
        console.log(element);
        let ele = {};
        let keys = Object.keys(element);
        for (let key of keys) {
          ele[headerName[key]] = element[key] != null ? element[key].toString() : "";
        }

        let item_code = await Product.findOne({
          where: {
            item_code: ele.item_code,
          }, raw: true
        });

        let categoryDetails = await models.categoryModel.findOne({ where: { name: ele.category, is_deleted: false }, raw: true });
        if (categoryDetails) {
          ele.category = categoryDetails.id;
        }
        else {
          element.reason = "Please check Category fields";
          rejectedArray.push(element);
        }
        let companyDetails = await models.companiesModel.findOne({ where: { name: ele.company_id }, raw: true });
        if (companyDetails) {
          ele.company_id = companyDetails.id;
        } else {
          element.reason = "Please check company details";
          rejectedArray.push(element);
        }
        if (item_code) {
          element.reason = "Item Code already exists";
          rejectedArray.push(element);
        } else {
          let response = await add(ele, req);
          if (response.success == 0) {
            element.reason = response.message;
            rejectedArray.push(element);
          }
        }
      }
      if (rejectedArray.length > 0) {
        if (rejectedArray.length == allProducts.length) {
          return res.status(200).send({ success: "0", message: `All materials are rejected due to some reasons`, data: rejectedArray });
        } else {
          return res.status(200).send({ success: "0", message: `${allProducts.length - rejectedArray.length} ${allProducts.length - rejectedArray.length > 1 ? 'Materials are' : 'Material is'}  added and ${rejectedArray.length} rejected due to some error.`, data: rejectedArray });
        }
      } else {
        return res.status(200).send({ success: "1", message: "products are added successfully" });
      }
    }
    catch (error) {
      console.log("error", error);
      logger.error(req, error.message);
      return res.status(500).send({ success: 0, message: "Internal Server Error" });
    }
  },
  delete: function (req, res) {
    Product.update({
      is_deleted: true,
    }, {
      where: {
        id: req.params.productId,
      },
    })
      .then((product) => {
        res.status(200).send({
          success: 1,
          message: message.productDelete
        });
      })
      .catch((err) => {
        logger.error(req, err.message);
        return res.status(200).send({
          success: 0,
          message: err
        })
      });
  },

  details: async (req, res) => {
    try {
      // console.log("this.data.batch_detail.product_idthis.data.batch_detail.product_id", req);
      console.log("01");
      let validator = new v(req.params, {
        productId: "required"
      });
      console.log("0102");

      console.log("consol", req.params);

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      console.log("010203");

      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }

      console.log("01020304");

      let productDetails = await Product.findOne({
        where: {
          id: req.params.productId
        },
        raw: true
      })
      console.log(">>>>>> product details", productDetails);
      if (!productDetails) {
        return res.status(200).send({ success: 0, message: "Item Not Found" });
      }

      return res.status(200).send({ success: 1, data: productDetails })
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        success: 0,
        message: error.message
      });
    }
  },

  companyDetails: async (req, res) => {
    try {
      let whereClause = {
      }

      let company = await models.companiesModel.findAll({
        where: whereClause,
        attributes: ["name", "id"],
        raw: true,
        nest: true
      });
      return res.status(200).send({ success: 1, data: company })
    } catch (error) {
      console.error(error);
      logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },


  update: async (req, res) => {
    try {
      let validator = new v({
        name: { type: "string", min: 1, max: 125, empty: false },
        hsn_code: { type: "string", min: 1, max: 125, empty: false },
        salt: { type: "string", min: 1, max: 125, empty: false },
        dosage_type: { type: "string", min: 1, max: 125, empty: false },
        content: { type: "string", min: 1, max: 125, empty: false },
        packing_size: { type: "string", min: 1, max: 125, empty: false },
        unit_size: { type: "string", min: 1, max: 125, empty: false },
        uom: { type: "string", min: 1, max: 125, empty: false },
        category: { empty: false },
        description: { type: "string", min: 1, max: 125, empty: false },
        company_id: { empty: false },
      });

      let matched = await validator.check();
      if (!matched) {
        return res
          .status(200)
          .send({
            success: 0,
            message: validator.errors
          });
      }

      let productId = req.params.productId;
      let fileUID = uuid()
      let imageURL = '';

      if (req.files) {
        if (req.files.productImage) {
          if (!ValidateFileType(req.files.productImage)) {
            return res.status(200).send({ success: "0", message: "Invalid Image" });
          }
          const fileExtension = path.extname(req.files.productImage.name);
          const fileName = fileUID + fileExtension
          //----------AWS s3 Image upload------
          let params = {
            Bucket: `${global.config.storage.name}/product-image`,
            Key: fileName,
            Body: req.files.productImage.data,
          }
          let response = await global.s3.upload(params).promise();
          imageURL = response.Location;
        }

      }

      let updateProduct = {
        name: req.body.name,
        hsn_code: req.body.hsn_code,
        salt: req.body.salt,
        dosage_type: req.body.dosage_type,
        content: req.body.content,
        packing_size: req.body.packing_size,
        unit_size: req.body.unit_size,
        uom: req.body.uom,
        category: req.body.category_id,
        description: req.body.description,
        company_id: req.body.company_id
      }

      if (imageURL) {
        updateProduct.image = imageURL
      }
      console.log('updateProduct>>>>>>>', updateProduct);
      const isUpdated = await Product.update(updateProduct, {
        where: {
          id: req.params.productId,
        },
      });

      if (isUpdated < 1) {
        return res.status(200).send({ success: 0, message: message.productNotUpdate });
      }

      return res.status(200).send({ success: 1, message: message.productUpdate });
    } catch (ex) {
      console.error(ex);
      logger.error(req, ex.message);
      return res.status(500).send({
        success: 0,
        message: ex.message
      });
    }
  },


  getSKUList: async (req, res) => {
    Product.findAll({
      where: {
        is_deleted: false,
        // esign_status: 2
      },
      attributes: ["name", "id", 'sku'],
      order: [['sku', 'ASC']]
    })
      .then((resp) => {
        return res.send({
          success: 1,
          data: resp
        });
      })
      .catch((err) => {
        logger.error(req, err.message);
        return res.status(500).send({
          code: 0,
          message: err
        });
      });
  }
};

function ValidateFileType(files) {
  if (files.name.match(/\.(jpg|jpeg|png|gif|JPG|JPEG|PNG|GIF)$/)) {
    return true;
  }
  return false;
}

function ValidateFileTypes(files) {
  if (files.name.match(/\.(pdf|PDF)$/)) {
    return true;
  }
  return false;
}

async function CraeteSKU(packagingId, mrp) {
  //brandId, catId, varientId, sizeId,
  let SKU = "";

  Brand.hasOne(Packaging, {
    foreignKey: "brand_id"
  });
  Packaging.belongsTo(Brand, {
    foreignKey: "brand_id"
  });

  Category.hasOne(Packaging, {
    foreignKey: "category_id"
  });
  Packaging.belongsTo(Category, {
    foreignKey: "category_id"
  });

  Varient.hasOne(Packaging, {
    foreignKey: "varient_id"
  });
  Packaging.belongsTo(Varient, {
    foreignKey: "varient_id"
  });

  Size.hasOne(Packaging, {
    foreignKey: "size_id"
  });
  Packaging.belongsTo(Size, {
    foreignKey: "size_id"
  });

  try {
    const packaging = await Packaging.findAll({
      include: [{
        model: Brand,
        attributes: [
          ["name", "brand_name"]
        ],
        required: true
      },
      {
        model: Category,
        attributes: [
          ["name", "category_name"]
        ],
        required: true,
      },
      {
        model: Varient,
        attributes: [
          ["name", "varient_name"]
        ],
        required: true,
      },
      {
        model: Size,
        attributes: ["quantity", "unit"],
        required: true
      },
      ],
      where: {
        id: packagingId
      },
      attributes: ["packaging_type"],
      raw: true
    });

    if (packaging) {
      SKU =
        packaging[0]["brand.brand_name"].substr(0, 3) +
        packaging[0]["category.category_name"].substr(0, 3) +
        packaging[0]["varient.varient_name"].substr(0, 3) +
        packaging[0]["option.quantity"] +
        packaging[0]["option.unit"] +
        packaging[0].packaging_type.substr(0, 3) +
        mrp;
    }

    return SKU;
  } catch (ex) {
    logger.error(req, ex.message);
    return SKU;
  }
}

async function createNewtables(tables, lastCode) {
  try {
    console.log('process initiate to create table.')
    // const env = process.env.APP_ENV || 'development';
    // let config = null;
    // if (env == "production")
    //     config = require(__dirname + '/../config/prod-config.json')[env];
    // else
    //     config = require(__dirname + '/../config/config.json')[env];

    // let dbConfig = global.config.db;

    // console.log('dbConfig: ', dbConfig);
    // const client = new Client({
    //   user: dbConfig.username,
    //   host: dbConfig.host,
    //   database: dbConfig.database,
    //   password: dbConfig.password,
    //   port: 5432,
    // });

    // await client.connect();

    for (let tableName of tables) {
      let query = `CREATE TABLE ${tableName}_${lastCode} 
    (
        id uuid PRIMARY KEY,  
        product_id UUID ,
        batch_id UUID,
        po_id UUID,
        qr_code VARCHAR,
        unique_code VARCHAR NOT NULL UNIQUE,
        serial_code VARCHAR,
        parent_id UUID,         
        is_open BOOL DEFAULT FALSE,
        is_general BOOL DEFAULT FALSE,
        parent_level VARCHAR,
        is_mapped BOOL DEFAULT FALSE,
        mapped_to_parent UUID,         
        mapped_at timestamp,
        mapped_by UUID,        
        is_dropped BOOL DEFAULT FALSE,
        is_complete BOOL DEFAULT FALSE,
        completed_at timestamp,
        completed_by UUID,        
        is_scanned BOOL DEFAULT FALSE,
        storage_bin_id INT,
        created_at VARCHAR,
        is_active BOOL DEFAULT FALSE,
        is_replaced BOOL DEFAULT FALSE,
        replaced_with VARCHAR,
        replaced_from VARCHAR,
        replaced_with_type VARCHAR,
        replaced_at timestamp,
        replaced_by UUID,
        mapp_transaction_id UUID,
        transaction_id UUID,
        mapping_po_id UUID,
        assigned_product_id UUID,
        assigned_batch_id UUID,
        is_box_opened BOOL DEFAULT FALSE,
        is_in_consignment BOOL DEFAULT FALSE,
        request_id UUID NULL,
        customer_id UUID,
        dealer_id UUID,
        retailer_id UUID,
        has_parent BOOL DEFAULT FALSE,
        "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP  
        )`;
      console.log('Query: ', query)
      // await client.query(query);
      await db.sequelize.query(query, { type: db.Sequelize.QueryTypes.SELECT, raw: true });
    }

    // await client.end();

    console.log('New tables has created');
  } catch (err) {
    return true;
  }

}

async function assignDynamicUIDs(UID) {
  try {
    console.log("-------called-------------");

    let uIds = [];
    let i = 1;
    do {
      let uniqueId = randomstring.generate({ charset: 'ACDEFGHJKLMNPRTUVWXYZ234679', length: 3, capitalization: 'uppercase' })
      let isExist = await DynamicUIDModel.findOne({
        where: {
          code: uniqueId
        },
        raw: true
      })
      if (!isExist) {
        console.log(i);
        uIds.push(uniqueId)
        await DynamicUIDModel.create({
          id: uuid(),
          u_id: UID,
          code: uniqueId
        })
      }
      else {
        console.log("Rejected", uniqueId);
      }
      i++;

    } while (uIds.length < 5);

    console.log("UID's", uIds);

    // for (let index = 0; index < 10; index++) {
    //     // Excluding: 0,1,5,8,B,I,O,Q,S

    //     if (index == 9) {
    //         console.log("---bulk creating");
    //         let bulkResponse = await DynamicUIDModel.bulkCreate(uIds, {
    //             ignoreDuplicates: true,
    //             returning: true
    //         })
    //     }
    // }
    console.log("----Dynamic UIds created successfully----", new Date());
    return;
  } catch (error) {
    console.log(error);
  }
}

async function add(data, req) {
  try {
    let validate = {
      name: "required",
      item_code: "required",
      salt: "required",
      dosage_type: "required",
      content: "required",
      mrp: "required",
      packing_size: "required",
      size: "required",
      manufacturer_name: "required",
      category: "required",
      description: "required",
      company_id: "required",
    };

    let validator = new v(data, validate);


    let matched = await validator.check();
    if (!matched) {
      let validatorError = await parseValidate(validator.errors)
      return { success: 0, message: validatorError };
    }

    // For Image
    let isVaildMainImageURL = await isValidUrl(data.image);
    console.log("isVaildMainImageURL>>>>>>>>", isVaildMainImageURL);
    if ((data.image != null && data.image != "" && data.image == undefined) && !isVaildMainImageURL) {
      console.log("Invaild Image")
      return { success: 0, message: "Invaild Main Image URL" };
    }
    if (isNaN(data.size)) {
      return { success: 0, message: "Item size should be number" };
    }
    if (isNaN(data.mrp)) {
      return { success: 0, message: "mrp should be number" };
    }
    let productId = uuid();

    await Product.create({
      id: productId,
      // sku: data.skuId,
      name: data.name,
      item_code: data.item_code,
      hsn_code: data.hsn_code,
      image: data.image,
      salt: data.salt,
      dosage_type: data.dosage_type,
      content: data.content,
      mrp: data.mrp,
      packing_size: data.packing_size,
      size: data.size,
      manufacturer_name: data.manufacturer_name,
      category: data.category,
      description: data.description,
      company_id: data.company_id
    });

    return {
      success: 1,
      message: "Product added successfully."
    };
  } catch (ex) {
    console.error(ex);
    logger.error(req, ex.message);
    return {
      success: 0,
      message: ex.message
    };
  }
};

async function isValidUrl(url) {
  // Regular expression to validate URL
  const urlRegex = /^(ftp|http|https):\/\/[^ "]+$/;
  console.log("urlRegex.test(url);", urlRegex.test(url))
  return urlRegex.test(url);
}


async function getItemSize(sizeString) {
  let numericValue = null;
  let unit = null
  // Regular expression pattern to match digits and non-digits separately
  const pattern = /(\d+)([a-zA-Z]+)/;

  // Extracting the numeric value and unit using match() method
  const matches = sizeString.match(pattern);

  if (matches) {
    numericValue = matches[1]; // Extracting the numeric value
    unit = matches[2]; // Extracting the unit
    console.log("Numeric value:", numericValue);
    console.log("Unit:", unit);
  } else {
    console.log("No match found.");
  }

  return { numericValue: numericValue, unit: unit }

}

async function levelcheckup(ele) {
  if (ele.standardUnit.length > 0 || true) {
    let uomDetails = await models.uomModel.findOne({ where: { name: ele.standardUnit }, raw: true });
    if (uomDetails) {
      ele.standardUnit = uomDetails.value;
    } else {
      return { success: 0, message: "uom is not valid" };
    }
  }
  if (!['yes', 'no'].includes(ele.is_loose_allowed.toLowerCase())) {
    return { success: 0, message: "Allow Loose should be 'yes' or 'no'" };
    //pending
  } else {
    ele.is_loose_allowed = ele.is_loose_allowed.toLowerCase() === 'yes' ? true : false;
  }
  if (!['yes', 'no'].includes(ele.isMappPrimary.toLowerCase())) {
    return { success: 0, message: "applicable for Mapping for primary should be 'yes' or 'no'" };
    //pending
  } else {
    ele.isMappPrimary = ele.isMappPrimary.toLowerCase() === 'yes' ? true : false;
  }
  if (ele.secondarySize.length > 0 && (isNaN(ele.secondarySize) || Number(ele.secondarySize) == 0)) {
    return { success: 0, message: "secondary Size should be number and value should be greater then 0." };
  } else {
    //data
    if (ele.secondarySize.length > 0) {
      ele.is_secondary = true;
      if (!['yes', 'no'].includes(ele.isMappSecondary.toLowerCase())) {
        return { success: 0, message: "applicable for Mapping for Secondary should be 'yes' or 'no'" };
        //pending
      } else {
        ele.isMappSecondary = ele.isMappSecondary.toLowerCase() === 'yes' ? true : false;
      }
    } else {
      ele.isMappSecondary = false;
      ele.is_secondary = false;
      ele.secondarySize = null;
    }
  }

  if (ele.tertiarySize.length > 0 && (isNaN(ele.tertiarySize) || Number(ele.tertiarySize) == 0)) {
    return { success: 0, message: "tertiary Size should be number and value should be greater then 0." };
  } else {
    //data
    if (ele.tertiarySize.length > 0) {
      if (!['yes', 'no'].includes(ele.isMappTertiary.toLowerCase())) {
        return { success: 0, message: "applicable for Mapping for Tertiary should be 'yes' or 'no'" };
        //pending
      } else {
        ele.isMappTertiary = ele.isMappTertiary.toLowerCase() === 'yes' ? true : false;
      }
      ele.is_tertiary = true;
    } else {
      ele.isMappTertiary = false;
      ele.is_tertiary = false;
      ele.tertiarySize = null;
    }

  }

  if (ele.outerSize.length > 0 && (isNaN(ele.outerSize) || Number(ele.outerSize) == 0)) {
    return { success: 0, message: "outer Size should be number and value should be greater then 0." };
  } else {
    //data
    if (ele.outerSize.length == 0) {
      ele.outerSize = null;
      return { success: 0, message: "outer size field is mandatory" };
    } else {
      if (!['yes', 'no'].includes(ele.isMappOuter.toLowerCase())) {
        return { success: 0, message: "applicable for Mapping for outer should be 'yes' or 'no'" };
        //pending
      } else {
        ele.isMappOuter = ele.isMappOuter.toLowerCase() === 'yes' ? true : false;
      }
    }
  }
  let mapCount = 0;
  if (ele.isMappOuter == true) {
    mapCount += 1;
  }
  if (ele.isMappSecondary == true) {
    mapCount += 1;
  }
  if (ele.isMappTertiary == true) {
    mapCount += 1;
  }
  if (ele.isMappPrimary == true) {
    mapCount += 1;
  }
  if (mapCount < 2) {
    return { success: 0, message: "Atleast two mapping levels are required" };
  }
  return { success: 1, message: "", data: ele };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isInteger(value) {
  const number = Number(value);
  return !isNaN(number) && Number.isInteger(number);
}

module.exports = productController;