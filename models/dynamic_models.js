const { truncate } = require('fs');
const db = require('./index');
var DataTypes = require('sequelize/lib/data-types');
const { findLastKey } = require('lodash');
const { type } = require('os');
let sequelize = db.sequelize;
let controller = {
  //=================E-billing models===================================
  getProductStockModel: async (uId, sync = false) => {
    try {
      console.log("----Dynamic Model--UID----");
      let collectionName = `retailer_product_stock_${uId}`;//uId = MM_YYYY
      const model = sequelize.define(collectionName, {
        //group 1 basic details
        id: { type: DataTypes.UUID, primaryKey: true },
        retailer_id: DataTypes.UUID,
        retail_outlet_id: DataTypes.UUID,
        product_id: DataTypes.UUID,
        rack_no: { type: DataTypes.STRING, defaultValue: null },
        hsn_code: { type: DataTypes.STRING, defaultValue: null },
        free_stock: { type: DataTypes.INTEGER, defaultValue: 0 },
        //group 2 inventory details
        qty: { type: DataTypes.NUMERIC, defaultValue: 0 },//currnt available qty
        unit_qty: { type: DataTypes.NUMERIC, defaultValue: 0 },//product unit qty
        min_stock: { type: DataTypes.INTEGER, defaultValue: 0 },
        max_stock: { type: DataTypes.INTEGER, defaultValue: 0 },
        lock_discount: { type: DataTypes.BOOLEAN, defaultValue: false },
        qr_code: { type: DataTypes.STRING, defaultValue: null },
        serial_code: { type: DataTypes.STRING, defaultValue: null },
      }, {
        freezeTableName: true, timestamps: true,
        indexes: sync ? [
          // {
          //   name: `idx_${collectionName}_retailer_id`,
          //   fields: ['retailer_id']
          // },
          {
            name: `idx_${collectionName}_retail_outlet_id`,
            fields: ['retail_outlet_id']
          }
        ] : []
      });

      model.associate = function (models) {
        model.hasOne(models.retailer_outlets, {
          foreignKey: 'id',
          sourceKey: 'retail_outlet_id',
          as: 'retailer_outlets'
        });
        model.hasOne(models.retailers, {
          foreignKey: 'id',
          sourceKey: 'retailer_id',
          as: 'retailers'
        });
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'product_id',
          as: 'products'
        });
      };
      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },

  getBatchStockModel: async (uId, sync = false) => {
    try {
      console.log("----Dynamic Model--UID----");
      let collectionName = `retailer_batch_stock_${uId}`;//uId = MM_YYYY
      const model = sequelize.define(collectionName, {
        //group 1 basic details
        id: { type: DataTypes.UUID, primaryKey: true },
        product_stock_id: DataTypes.UUID,
        retailer_id: DataTypes.UUID,
        retail_outlet_id: DataTypes.UUID,
        product_id: DataTypes.UUID,
        batch_id: DataTypes.UUID,
        rack_no: { type: DataTypes.STRING, defaultValue: null },
        hsn_code: { type: DataTypes.STRING, defaultValue: null },
        qr_code: { type: DataTypes.STRING, defaultValue: null },
        serial_code: { type: DataTypes.STRING, defaultValue: null },
        //group 2 inventory details
        qty: { type: DataTypes.NUMERIC, defaultValue: 0 },//currnt available qty
        unit_qty: { type: DataTypes.NUMERIC, defaultValue: 0 },
        min_stock: { type: DataTypes.INTEGER, defaultValue: 0 },
        max_stock: { type: DataTypes.INTEGER, defaultValue: 0 },
        lock_discount: { type: DataTypes.BOOLEAN, defaultValue: false },
        free_stock: { type: DataTypes.INTEGER, defaultValue: 0 },
        //group 3 calcutations
        total_base_amount: { type: DataTypes.DECIMAL, defaultValue: 0 },
        discount_percentage: { type: DataTypes.DECIMAL, defaultValue: 0 },
        margin_percentage: { type: DataTypes.NUMERIC, defaultValue: 0 },
        mrp: { type: DataTypes.NUMERIC, defaultValue: 0 },
        ptr: { type: DataTypes.NUMERIC, defaultValue: 0 },
        sale_rate: { type: DataTypes.NUMERIC, defaultValue: 0 },
      }, {
        freezeTableName: true, timestamps: true,
        indexes: sync ? [
          // {
          //   name: `idx_${collectionName}_retailer_id`,
          //   fields: ['retailer_id']
          // },
          {
            name: `idx_${collectionName}_retail_outlet_id`,
            fields: ['retail_outlet_id']
          }
        ] : []
      });

      model.associate = function (models) {

        model.hasOne(models.retailers, {
          foreignKey: 'id',
          sourceKey: 'retailer_id',
          as: 'retailers'
        });
        model.hasOne(models.retailer_outlets, {
          foreignKey: 'id',
          sourceKey: 'retail_outlet_id',
          as: 'retailer_outlets'
        });
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'product_id',
          as: 'products'
        });
        // model.hasOne(models.product_batches, {
        //   foreignKey: 'id',
        //   sourceKey: 'batch_id',
        //   as: 'product_batches'
        // });

      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },

  //>>>>>>>>>>>>>>>>>>>Purches order<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  getPurchaseOrderModel: async (uId, sync = false) => {
    try {
      console.log("----Dynamic Model--UID----");
      let collectionName = `purchase_order_${uId}`;//uId = MM_YYYY
      const model = sequelize.define(collectionName, {
        //group 1 -- basic details
        id: { type: DataTypes.UUID, primaryKey: true },
        retailer_id: { type: DataTypes.UUID },
        retail_outlet_id: { type: DataTypes.UUID },
        po_no: { type: DataTypes.STRING, defaultValue: null },
        po_date: { type: DataTypes.DATE, defaultValue: new Date() },
        invoice_no: { type: DataTypes.STRING, defaultValue: null },
        bill_date: { type: DataTypes.DATE, defaultValue: new Date() },
        due_date: { type: DataTypes.DATE, defaultValue: new Date() },
        distributor_id: { type: DataTypes.UUID },
        created_by: { type: DataTypes.UUID },
        //group 2 -- calculations
        total_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        total_base_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        total_gst_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        total_products: { type: DataTypes.INTEGER, defaultValue: 0 },
        margin_percentage: { type: DataTypes.NUMERIC, defaultValue: 0 },
        total_qty: { type: DataTypes.NUMERIC, defaultValue: 0 },
        //group 3 -- payement
        payment_type: { type: DataTypes.INTEGER, defaultValue: 0 },
        payment_status: { type: DataTypes.INTEGER, defaultValue: 0 },
        //group 4 -- order status
        save_as_draft: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_return: { type: DataTypes.BOOLEAN, defaultValue: false },
        qr_code: { type: DataTypes.STRING, defaultValue: null },


        bank_id: { type: DataTypes.UUID, defaultValue: null },
        validation_no: { type: DataTypes.STRING, defaultValue: null },
      }, {
        freezeTableName: true, timestamps: true,
        indexes: sync ? [
          // {
          //   name: `idx_${collectionName}_retailer_id`,
          //   fields: ['retailer_id']
          // },
          {
            name: `idx_${collectionName}_retail_outlet_id`,
            fields: ['retail_outlet_id']
          }
        ] : []
      });

      model.associate = function (models) {
        model.hasOne(models.retailers, {
          foreignKey: 'id',
          sourceKey: 'retailer_id',
          as: 'retailers'
        });
        model.hasOne(models.retailer_outlets, {
          foreignKey: 'id',
          sourceKey: 'retail_outlet_id',
          as: 'retailer_outlets'
        });

        model.hasOne(models.distributors, {
          foreignKey: 'id',
          sourceKey: 'distributor_id',
          as: 'distributors'
        });


      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  getPurchaseOrderDetailsModel: async (uId, sync = false) => {
    try {
      console.log("----Dynamic Model--UID----");
      let collectionName = `purchase_order_details_${uId}`;//uId = MM_YYYY
      const model = sequelize.define(collectionName, {
        //group 1 -- basic details
        id: { type: DataTypes.UUID, primaryKey: true },
        po_id: { type: DataTypes.UUID },
        retailer_id: { type: DataTypes.UUID },
        retail_outlet_id: { type: DataTypes.UUID },
        product_id: { type: DataTypes.UUID },
        batch_id: { type: DataTypes.UUID },
        exp_date: { type: DataTypes.DATE, defaultValue: null },
        distributor_id: { type: DataTypes.UUID },
        //group 2 -- calculations
        mrp: { type: DataTypes.NUMERIC, defaultValue: null },
        ptr: { type: DataTypes.NUMERIC, defaultValue: null },
        qty: { type: DataTypes.INTEGER, defaultValue: null },
        unit_qty: { type: DataTypes.NUMERIC, defaultValue: 0 },
        free_qty: { type: DataTypes.NUMERIC, defaultValue: null },// extra free qty 
        discount_percentage: { type: DataTypes.NUMERIC, defaultValue: null },
        scheme_amount: { type: DataTypes.NUMERIC, defaultValue: null },
        base_amount: { type: DataTypes.NUMERIC, defaultValue: null },
        gst_percentage: { type: DataTypes.NUMERIC, defaultValue: null },
        final_amount: { type: DataTypes.NUMERIC, defaultValue: null },
        //group 3 -- order status
        save_as_draft: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_return: { type: DataTypes.BOOLEAN, defaultValue: false },
      }, {
        freezeTableName: true, timestamps: true,
        indexes: sync ? [
          {
            name: `idx_${collectionName}_retail_outlet_id`,
            fields: ['retail_outlet_id']
          }
        ] : []
      });

      model.associate = function (models) {
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'product_id',
          as: 'products'
        });
        model.hasOne(models.retailers, {
          foreignKey: 'id',
          sourceKey: 'retailer_id',
          as: 'retailers'
        });
        model.hasOne(models.retailer_outlets, {
          foreignKey: 'id',
          sourceKey: 'retail_outlet_id',
          as: 'retailer_outlets'
        });

        model.hasOne(models.distributors, {
          foreignKey: 'id',
          sourceKey: 'distributor_id',
          as: 'distributors'
        });

      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  //===================================================================================
  //>>>>>>>>>>>>>>>>>>>Sales Model<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
  getSalesModel: async (uId, sync = false) => {
    try {
      console.log("----Dynamic Model--UID----");
      let collectionName = `sales_order_${uId}`;//uId = MM_YYYY
      const model = sequelize.define(collectionName, {
        //group 1 -- basic details
        id: { type: DataTypes.UUID, primaryKey: true },
        retailer_id: { type: DataTypes.UUID },
        retail_outlet_id: { type: DataTypes.UUID },
        customer_id: { type: DataTypes.UUID },
        doctor_id: { type: DataTypes.UUID },
        bill_date: { type: DataTypes.DATE },
        bill_number: { type: DataTypes.STRING, defaultValue: null },
        created_by: { type: DataTypes.UUID },
        serial_code: { type: DataTypes.STRING, defaultValue: null },
        //group 2 -- calculations
        total_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        total_gst_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        total_qty: { type: DataTypes.NUMERIC, defaultValue: 0 },
        total_mrp: { type: DataTypes.NUMERIC, defaultValue: 0 },
        total_margin: { type: DataTypes.NUMERIC, defaultValue: 0 },
        total_base_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        total_discount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        //group 3 -- payement
        payment_type: { type: DataTypes.INTEGER, defaultValue: 0 },
        payment_status: { type: DataTypes.INTEGER, defaultValue: 0 },
        //group 4 -- order status
        save_as_draft: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_return: { type: DataTypes.BOOLEAN, defaultValue: false },
        qr_code: { type: DataTypes.STRING, defaultValue: null },
      }, {
        freezeTableName: true, timestamps: true,
        indexes: sync ? [
          // {
          //   name: `idx_${collectionName}_retailer_id`,
          //   fields: ['retailer_id']
          // },
          {
            name: `idx_${collectionName}_retail_outlet_id`,
            fields: ['retail_outlet_id']
          }
        ] : []
      });

      model.associate = function (models) {
        model.hasOne(models.retailers, {
          foreignKey: 'id',
          sourceKey: 'retailer_id',
          as: 'retailers'
        });
        model.hasOne(models.retailer_outlets, {
          foreignKey: 'id',
          sourceKey: 'retail_outlet_id',
          as: 'retailer_outlets'
        });
        model.hasOne(models.consumers, {
          foreignKey: 'id',
          sourceKey: 'customer_id',
          as: 'consumers'
        });
        model.hasOne(models.doctors, {
          foreignKey: 'id',
          sourceKey: 'doctor_id',
          as: 'doctors'
        });
      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  getSalesDetailsModel: async (uId, sync = false) => {
    try {
      console.log("----Dynamic Model--UID----");
      let collectionName = `sales_order_details_${uId}`;//uId = MM_YYYY
      const model = sequelize.define(collectionName, {
        //group 1 -- basic details
        id: { type: DataTypes.UUID, primaryKey: true },
        sales_id: { type: DataTypes.UUID },
        product_id: { type: DataTypes.UUID },
        batch_id: { type: DataTypes.UUID },
        retailer_id: { type: DataTypes.UUID },
        retail_outlet_id: { type: DataTypes.UUID },
        customer_id: { type: DataTypes.UUID },
        doctor_id: { type: DataTypes.UUID },
        item_name: { type: DataTypes.STRING, defaultValue: null },
        exp_date: { type: DataTypes.DATE, defaultValue: new Date() },
        unit_pack: { type: DataTypes.STRING, defaultValue: null },
        created_by: { type: DataTypes.UUID },
        location: { type: DataTypes.STRING, defaultValue: null },

        //group 2 -- calculations
        mrp: { type: DataTypes.NUMERIC },
        qty: { type: DataTypes.STRING },
        margin_percentage: { type: DataTypes.NUMERIC, defaultValue: 0 },
        discount_percentage: { type: DataTypes.NUMERIC, defaultValue: 0 },
        base_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        final_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        gst_percentage: { type: DataTypes.NUMERIC, defaultValue: 0 },
        //group 3 -- payement
        payment_type: { type: DataTypes.INTEGER, defaultValue: 0 },
        payment_status: { type: DataTypes.BOOLEAN, defaultValue: false },
        //group 4 -- order status
        save_as_draft: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_return: { type: DataTypes.BOOLEAN, defaultValue: false }
      }, {
        freezeTableName: true, timestamps: true,
        indexes: sync ? [
          {
            name: `idx_${collectionName}_retail_outlet_id`,
            fields: ['retail_outlet_id']
          }
        ] : []
      });

      model.associate = function (models) {
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'product_id',
          as: 'products'
        });
        model.hasOne(models.retailers, {
          foreignKey: 'id',
          sourceKey: 'retailer_id',
          as: 'retailers'
        });
        model.hasOne(models.retailer_outlets, {
          foreignKey: 'id',
          sourceKey: 'retail_outlet_id',
          as: 'retailer_outlets'
        });
        model.hasOne(models.consumers, {
          foreignKey: 'id',
          sourceKey: 'customer_id',
          as: 'consumers'
        });
        model.hasOne(models.doctors, {
          foreignKey: 'id',
          sourceKey: 'doctor_id',
          as: 'doctors'
        });

      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  //===================================================================================

  //============================= Batch ===============================================

  getRetailerBatchModel: async (uId, sync = false) => {
    try {
      console.log("----Dynamic Model--UID----");
      let collectionName = `retailer_batch_${uId}`;//uId = MM_YYYY
      const model = sequelize.define(collectionName, {
        //group 1 basic details
        id: { type: DataTypes.UUID, primaryKey: true },
        retailer_id: DataTypes.UUID,
        retail_outlet_id: DataTypes.UUID,
        batch_no: DataTypes.STRING,
        product_id: DataTypes.UUID,
        mfg_date: DataTypes.DATE,
        exp_date: DataTypes.DATE,
        mrp: DataTypes.NUMERIC,
        ptr: DataTypes.NUMERIC,
        discount_percentage: DataTypes.NUMERIC,
        // rack_no: { type: DataTypes.STRING, defaultValue: null }
      }, {
        freezeTableName: true, timestamps: true,
        indexes: sync ? [
          // {
          //   name: `idx_${collectionName}_retailer_id`,
          //   fields: ['retailer_id']
          // },
          {
            name: `idx_${collectionName}_retail_outlet_id`,
            fields: ['retail_outlet_id']
          }
        ] : []
      });

      model.associate = function (models) {

        model.hasOne(models.retailers, {
          foreignKey: 'id',
          sourceKey: 'retailer_id',
          as: 'retailers'
        });
        model.hasOne(models.retailer_outlets, {
          foreignKey: 'id',
          sourceKey: 'retail_outlet_id',
          as: 'retailer_outlets'
        });
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'product_id',
          as: 'products'
        });
      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  //>>>>>>>>>>>>>>>>>>cash management<<<<<<<<<<<<<<<<<
  getRetailDistributorMasterModel: async (uId, sync = false) => {
    try {
      console.log("----Dynamic Model--UID----");
      let collectionName = `retail_distributor_master_${uId}`;//uId = MM_YYYY
      const model = sequelize.define(collectionName, {
        //group 1 -- basic details
        id: { type: DataTypes.UUID, primaryKey: true },
        retailer_id: { type: DataTypes.UUID },
        retail_outlet_id: { type: DataTypes.UUID },
        distributor_id: { type: DataTypes.UUID },
        //group 2 -- payement
        order_count: { type: DataTypes.INTEGER, defaultValue: 0 },
        pending_count: { type: DataTypes.INTEGER, defaultValue: 0 },
        payment_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        pending_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        //group 3 -- Return payement
        order_return_count: { type: DataTypes.INTEGER, defaultValue: 0 },
        return_pending_count: { type: DataTypes.INTEGER, defaultValue: 0 },
        return_payment_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        return_pending_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
      }, {
        freezeTableName: true, timestamps: true,
        indexes: sync ? [
          // {
          //   name: `idx_${collectionName}_retailer_id`,
          //   fields: ['retailer_id']
          // },
          {
            name: `idx_${collectionName}_retail_outlet_id`,
            fields: ['retail_outlet_id']
          }
        ] : []
      });

      model.associate = function (models) {
        model.hasOne(models.retailers, {
          foreignKey: 'id',
          sourceKey: 'retailer_id',
          as: 'retailers'
        });
        model.hasOne(models.retailer_outlets, {
          foreignKey: 'id',
          sourceKey: 'retail_outlet_id',
          as: 'retailer_outlets'
        });

        model.hasOne(models.distributors, {
          foreignKey: 'id',
          sourceKey: 'distributor_id',
          as: 'distributors'
        });
      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  getRetailCustomerMasterModel: async (uId, sync = false) => {
    try {
      console.log("----Dynamic Model--UID----");
      let collectionName = `retail_customer_master_${uId}`;//uId = MM_YYYY
      const model = sequelize.define(collectionName, {
        //group 1 -- basic details
        id: { type: DataTypes.UUID, primaryKey: true },
        retailer_id: { type: DataTypes.UUID },
        retail_outlet_id: { type: DataTypes.UUID },
        consumer_id: { type: DataTypes.UUID },
        //group 2 -- payement
        order_count: { type: DataTypes.INTEGER, defaultValue: 0 },
        pending_count: { type: DataTypes.INTEGER, defaultValue: 0 },
        payment_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        pending_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        //group 3 -- Return payement
        order_return_count: { type: DataTypes.INTEGER, defaultValue: 0 },
        return_pending_count: { type: DataTypes.INTEGER, defaultValue: 0 },
        return_payment_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
        return_pending_amount: { type: DataTypes.NUMERIC, defaultValue: 0 },
      }, {
        freezeTableName: true, timestamps: true,
        indexes: sync ? [
          // {
          //   name: `idx_${collectionName}_retailer_id`,
          //   fields: ['retailer_id']
          // },
          {
            name: `idx_${collectionName}_retail_outlet_id`,
            fields: ['retail_outlet_id']
          }
        ] : []
      });

      model.associate = function (models) {
        model.hasOne(models.retailers, {
          foreignKey: 'id',
          sourceKey: 'retailer_id',
          as: 'retailers'
        });
        model.hasOne(models.retailer_outlets, {
          foreignKey: 'id',
          sourceKey: 'retail_outlet_id',
          as: 'retailer_outlets'
        });

        model.hasOne(models.consumers, {
          foreignKey: 'id',
          sourceKey: 'consumer_id',
          as: 'consumers'
        });
      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  //==================================================================================
  getRetailCustomerModel: async (uId, sync = false) => {
    // getRetailConsumerModel: async (uId, sync = true) => {
    try {
      console.log("----Dynamic Model--UID----");
      let collectionName = `retail_consumer_${uId}`;//uId = MM_YYYY
      const model = sequelize.define(collectionName, {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        retailer_id: {
          type: DataTypes.UUID
        },
        retail_outlet_id: {
          type: DataTypes.UUID
        },
        consumer_id: {
          type: DataTypes.UUID
        }

      }, {
        freezeTableName: true,
        timestamps: true,
      });

      model.associate = function (models) {
        model.hasOne(models.retailers, {
          foreignKey: 'id',
          sourceKey: 'retailer_id',
          as: 'retailers'
        });
        model.hasOne(models.retailer_outlets, {
          foreignKey: 'id',
          sourceKey: 'retail_outlet_id',
          as: 'retailer_outlets'
        });
        model.hasOne(models.consumers, {
          foreignKey: 'id',
          sourceKey: 'consumer_id',
          as: 'consumers'
        });
      };
      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },

  getBankDetailsModel: async (uId, sync = false) => {
    try {
      console.log("----Dynamic Model--UID----");
      let collectionName = `bank_details_${uId}`;//uId = MM_YYYY
      const model = sequelize.define(collectionName, {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUID,
          primaryKey: true,
        },
        retailer_id: {
          type: DataTypes.UUID
        },
        retail_outlet_id: {
          type: DataTypes.UUID
        },
        bank_name: {
          type: DataTypes.STRING
        },
        ifsc_code: {
          type: DataTypes.STRING
        },
        account_no: {
          type: DataTypes.STRING
        }

      }, {
        freezeTableName: true,
        timestamps: true,
      });

      model.associate = function (models) {
        model.hasOne(models.retailers, {
          foreignKey: 'id',
          sourceKey: 'retailer_id',
          as: 'retailers'
        });
        model.hasOne(models.retailer_outlets, {
          foreignKey: 'id',
          sourceKey: 'retail_outlet_id',
          as: 'retailer_outlets'
        });
      };
      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },


  //================================E-Billing Ends here=========================================
  //===================================================================
  getPrimaryQRCodesModel: async (uId, sync = false) => {
    try {
      console.log("----Dynamic Model--UID----");
      let collectionName = `primary_qrcodes_${uId}`;
      const model = sequelize.define(collectionName, {
        id: { primaryKey: true, type: DataTypes.UUID },
        product_id: DataTypes.UUID,
        batch_id: DataTypes.UUID,
        po_id: DataTypes.UUID,
        qr_code: DataTypes.STRING,
        unique_code: { type: DataTypes.STRING },
        serial_code: DataTypes.STRING,
        parent_id: DataTypes.UUID,  //trusted QR code parent Id

        is_open: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_general: { type: DataTypes.BOOLEAN, defaultValue: false },
        parent_level: DataTypes.STRING,
        is_mapped: { type: DataTypes.BOOLEAN, defaultValue: false },
        mapped_to_parent: DataTypes.UUID,
        mapped_at: DataTypes.DATE,
        mapped_by: DataTypes.UUID,
        is_dropped: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_complete: { type: DataTypes.BOOLEAN, defaultValue: false },
        completed_at: DataTypes.DATE,
        completed_by: DataTypes.UUID,
        is_scanned: { type: DataTypes.BOOLEAN, defaultValue: false },
        storage_bin_id: DataTypes.INTEGER,
        created_at: DataTypes.STRING,

        is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_replaced: { type: DataTypes.BOOLEAN, defaultValue: false },
        replaced_with: DataTypes.STRING,
        replaced_from: DataTypes.STRING,
        replaced_with_type: DataTypes.STRING,
        replaced_at: DataTypes.DATE,
        replaced_by: DataTypes.UUID,
        mapp_transaction_id: DataTypes.UUID,
        transaction_id: DataTypes.UUID,
        mapping_po_id: DataTypes.UUID,
        assigned_product_id: DataTypes.UUID,
        assigned_batch_id: DataTypes.UUID,
        is_box_opened: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_in_consignment: { type: DataTypes.BOOLEAN, defaultValue: false },
        request_id: { type: DataTypes.UUID },
        customer_id: DataTypes.UUID,
        dealer_id: DataTypes.UUID,
        retailer_id: DataTypes.UUID,
        has_parent: { type: DataTypes.BOOLEAN, defaultValue: true },
        createdAt: { type: DataTypes.DATE, defaultValue: sequelize.literal('NOW()') },
        updatedAt: { type: DataTypes.DATE, defaultValue: sequelize.literal('NOW()') },
      }, { freezeTableName: true });

      model.associate = function (models) {
        model.hasOne(models.product_batches, {
          foreignKey: 'id',
          sourceKey: 'batch_id',
          as: 'product_batch'
        })
        model.hasOne(models.product_batches, {
          foreignKey: 'id',
          sourceKey: 'assigned_batch_id',
          as: 'assigned_batch'
        })
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'product_id',
          as: 'product'
        })
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'assigned_product_id',
          as: 'assigned_product'
        })
        model.hasOne(models.storage_bins, {
          foreignKey: 'id',
          sourceKey: 'storage_bin_id',
        })
      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  getSecondaryQRCodesModel: async (uId, sync = false) => {
    try {
      let collectionName = `secondary_qrcodes_${uId}`;
      const model = sequelize.define(collectionName, {
        id: { primaryKey: true, type: DataTypes.UUID },
        product_id: DataTypes.UUID,
        batch_id: DataTypes.UUID,
        po_id: DataTypes.UUID,
        qr_code: DataTypes.STRING,
        unique_code: { type: DataTypes.STRING },
        serial_code: DataTypes.STRING,
        parent_id: DataTypes.UUID,

        is_open: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_general: { type: DataTypes.BOOLEAN, defaultValue: false },
        parent_level: DataTypes.STRING,
        is_mapped: { type: DataTypes.BOOLEAN, defaultValue: false },
        mapped_to_parent: DataTypes.UUID,
        mapped_at: DataTypes.DATE,
        mapped_by: DataTypes.UUID,
        is_dropped: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_complete: { type: DataTypes.BOOLEAN, defaultValue: false },
        completed_at: DataTypes.DATE,
        completed_by: DataTypes.UUID,
        is_scanned: { type: DataTypes.BOOLEAN, defaultValue: false },
        storage_bin_id: DataTypes.INTEGER,
        created_at: DataTypes.STRING,

        is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_replaced: { type: DataTypes.BOOLEAN, defaultValue: false },
        replaced_with: DataTypes.STRING,
        replaced_from: DataTypes.STRING,
        replaced_with_type: DataTypes.STRING,
        replaced_at: DataTypes.DATE,
        replaced_by: DataTypes.UUID,
        mapp_transaction_id: DataTypes.UUID,
        transaction_id: DataTypes.UUID,
        mapping_po_id: DataTypes.UUID,
        assigned_product_id: DataTypes.UUID,
        assigned_batch_id: DataTypes.UUID,
        is_box_opened: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_in_consignment: { type: DataTypes.BOOLEAN, defaultValue: false },
        request_id: { type: DataTypes.UUID },
        customer_id: DataTypes.UUID,
        dealer_id: DataTypes.UUID,
        retailer_id: DataTypes.UUID,
        has_parent: { type: DataTypes.BOOLEAN, defaultValue: true },
        createdAt: { type: DataTypes.DATE, defaultValue: sequelize.literal('NOW()') },
        updatedAt: { type: DataTypes.DATE, defaultValue: sequelize.literal('NOW()') },
      }, { freezeTableName: true });

      model.associate = function (models) {
        model.hasOne(models.product_batches, {
          foreignKey: 'id',
          sourceKey: 'batch_id',
          as: 'product_batch'
        })
        model.hasOne(models.product_batches, {
          foreignKey: 'id',
          sourceKey: 'assigned_batch_id',
          as: 'assigned_batch'
        })
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'product_id',
          as: 'product'
        })
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'assigned_product_id',
          as: 'assigned_product'
        })
        model.hasOne(models.storage_bins, {
          foreignKey: 'id',
          sourceKey: 'storage_bin_id',
        })
      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  getTertiaryQRCodesModel: async (uId, sync = false) => {
    try {
      let collectionName = `tertiary_qrcodes_${uId}`;
      const model = sequelize.define(collectionName, {
        id: { primaryKey: true, type: DataTypes.UUID },
        product_id: DataTypes.UUID,
        batch_id: DataTypes.UUID,
        po_id: DataTypes.UUID,
        qr_code: DataTypes.STRING,
        unique_code: { type: DataTypes.STRING },
        serial_code: DataTypes.STRING,
        parent_id: DataTypes.UUID,

        is_open: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_general: { type: DataTypes.BOOLEAN, defaultValue: false },
        parent_level: DataTypes.STRING,
        is_mapped: { type: DataTypes.BOOLEAN, defaultValue: false },
        mapped_to_parent: DataTypes.UUID,
        mapped_at: DataTypes.DATE,
        mapped_by: DataTypes.UUID,
        is_dropped: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_complete: { type: DataTypes.BOOLEAN, defaultValue: false },
        completed_at: DataTypes.DATE,
        completed_by: DataTypes.UUID,
        is_scanned: { type: DataTypes.BOOLEAN, defaultValue: false },
        storage_bin_id: DataTypes.INTEGER,
        created_at: DataTypes.STRING,

        is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_replaced: { type: DataTypes.BOOLEAN, defaultValue: false },
        replaced_with: DataTypes.STRING,
        replaced_from: DataTypes.STRING,
        replaced_with_type: DataTypes.STRING,
        replaced_at: DataTypes.DATE,
        replaced_by: DataTypes.UUID,
        mapp_transaction_id: DataTypes.UUID,
        transaction_id: DataTypes.UUID,
        mapping_po_id: DataTypes.UUID,
        assigned_product_id: DataTypes.UUID,
        assigned_batch_id: DataTypes.UUID,
        is_box_opened: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_in_consignment: { type: DataTypes.BOOLEAN, defaultValue: false },
        request_id: { type: DataTypes.UUID },
        customer_id: DataTypes.UUID,
        dealer_id: DataTypes.UUID,
        retailer_id: DataTypes.UUID,
        has_parent: { type: DataTypes.BOOLEAN, defaultValue: true },
        createdAt: { type: DataTypes.DATE, defaultValue: sequelize.literal('NOW()') },
        updatedAt: { type: DataTypes.DATE, defaultValue: sequelize.literal('NOW()') },
      }, { freezeTableName: true });

      model.associate = function (models) {
        model.hasOne(models.product_batches, {
          foreignKey: 'id',
          sourceKey: 'batch_id',
          as: 'product_batch'
        })
        model.hasOne(models.product_batches, {
          foreignKey: 'id',
          sourceKey: 'assigned_batch_id',
          as: 'assigned_batch'
        })
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'product_id',
          as: 'product'
        })
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'assigned_product_id',
          as: 'assigned_product'
        })
        model.hasOne(models.storage_bins, {
          foreignKey: 'id',
          sourceKey: 'storage_bin_id',
        })
      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  getOuterQRCodesModel: async (uId, sync = false) => {
    try {
      let collectionName = `outer_qrcodes_${uId}`;
      const model = sequelize.define(collectionName, {
        id: { primaryKey: true, type: DataTypes.UUID },
        product_id: DataTypes.UUID,
        batch_id: DataTypes.UUID,
        po_id: DataTypes.UUID,
        qr_code: DataTypes.STRING,
        unique_code: { type: DataTypes.STRING },
        serial_code: DataTypes.STRING,
        parent_id: DataTypes.UUID,

        is_open: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_general: { type: DataTypes.BOOLEAN, defaultValue: false },
        parent_level: DataTypes.STRING,
        is_mapped: { type: DataTypes.BOOLEAN, defaultValue: false },
        mapped_to_parent: DataTypes.UUID,
        mapped_at: DataTypes.DATE,
        mapped_by: DataTypes.UUID,
        is_dropped: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_complete: { type: DataTypes.BOOLEAN, defaultValue: false },
        completed_at: DataTypes.DATE,
        completed_by: DataTypes.UUID,
        is_scanned: { type: DataTypes.BOOLEAN, defaultValue: false },
        storage_bin_id: DataTypes.INTEGER,
        created_at: DataTypes.STRING,

        is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_replaced: { type: DataTypes.BOOLEAN, defaultValue: false },
        replaced_with: DataTypes.STRING,
        replaced_from: DataTypes.STRING,
        replaced_with_type: DataTypes.STRING,
        replaced_at: DataTypes.DATE,
        replaced_by: DataTypes.UUID,
        mapp_transaction_id: DataTypes.UUID,
        transaction_id: DataTypes.UUID,
        mapping_po_id: DataTypes.UUID,
        assigned_product_id: DataTypes.UUID,
        assigned_batch_id: DataTypes.UUID,
        is_box_opened: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_in_consignment: { type: DataTypes.BOOLEAN, defaultValue: false },
        request_id: { type: DataTypes.UUID },
        customer_id: DataTypes.UUID,
        dealer_id: DataTypes.UUID,
        retailer_id: DataTypes.UUID,
        has_parent: { type: DataTypes.BOOLEAN, defaultValue: true },
        createdAt: { type: DataTypes.DATE, defaultValue: sequelize.literal('NOW()') },
        updatedAt: { type: DataTypes.DATE, defaultValue: sequelize.literal('NOW()') },
      }, { freezeTableName: true });

      model.associate = function (models) {
        model.hasOne(models.product_batches, {
          foreignKey: 'id',
          sourceKey: 'batch_id',
          as: 'product_batch'
        })
        model.hasOne(models.product_batches, {
          foreignKey: 'id',
          sourceKey: 'assigned_batch_id',
          as: 'assigned_batch'
        })
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'product_id',
          as: 'product'
        })
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'assigned_product_id',
          as: 'assigned_product'
        })
        model.hasOne(models.storage_bins, {
          foreignKey: 'id',
          sourceKey: 'storage_bin_id',
        })
      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  getOrderDetailsModel: async (o_uid, sync = false) => {
    try {
      let collectionName = `order_details_${o_uid}`;
      const model = sequelize.define(collectionName, {
        id: { primaryKey: true, type: DataTypes.UUID },
        product_id: DataTypes.UUID,
        batch_id: DataTypes.UUID,
        order_id: DataTypes.UUID,
        qty: DataTypes.NUMERIC,
        line_item_no: DataTypes.NUMERIC,
        p_factor: DataTypes.NUMERIC,
        s_factor: DataTypes.NUMERIC,
        t_factor: DataTypes.NUMERIC,
        o_factor: DataTypes.NUMERIC,
        o_uid: DataTypes.STRING,
        o_scan_qty: { type: DataTypes.NUMERIC, defaultValue: 0 },
        i_scan_qty: { type: DataTypes.NUMERIC, defaultValue: 0 },
        i_excess_qty: { type: DataTypes.NUMERIC, defaultValue: 0 },
        is_changed: { type: DataTypes.BOOLEAN, defaultValue: false },

        o_p_qty: { type: DataTypes.INTEGER, defaultValue: 0 },
        o_s_qty: { type: DataTypes.INTEGER, defaultValue: 0 },
        o_t_qty: { type: DataTypes.INTEGER, defaultValue: 0 },
        o_o_qty: { type: DataTypes.INTEGER, defaultValue: 0 },

        i_p_qty: { type: DataTypes.INTEGER, defaultValue: 0 },
        i_s_qty: { type: DataTypes.INTEGER, defaultValue: 0 },
        i_t_qty: { type: DataTypes.INTEGER, defaultValue: 0 },
        i_o_qty: { type: DataTypes.INTEGER, defaultValue: 0 },

        excess_p_qty: { type: DataTypes.INTEGER, defaultValue: 0 },
        excess_s_qty: { type: DataTypes.INTEGER, defaultValue: 0 },
        excess_t_qty: { type: DataTypes.INTEGER, defaultValue: 0 },
        excess_o_qty: { type: DataTypes.INTEGER, defaultValue: 0 },

      }, { freezeTableName: true });
      model.associate = function (models) {
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'product_id',
        })
      };
      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  getOutwardCodeModel: async (o_uid, sync = false) => {
    try {
      // let collectionName = `${level}_outward_codes_${o_uid}`;
      let collectionName = `outward_codes_${o_uid}`;
      const model = sequelize.define(collectionName, {
        id: { primaryKey: true, type: DataTypes.UUID },
        order_id: DataTypes.UUID,
        order_details_id: DataTypes.UUID,
        unique_code: DataTypes.STRING,
        code_id: DataTypes.UUID,
        level: DataTypes.STRING,
        u_id: DataTypes.STRING,
        storage_bin_id: DataTypes.INTEGER,
        is_loose: { type: DataTypes.BOOLEAN, defaultValue: false }
      }, { freezeTableName: true });

      model.associate = function (models) {
      };

      db[collectionName] = model;
      db[collectionName].associate(db);
      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  getInwardCodeModel: async (o_uid, sync = false) => {
    try {
      // let collectionName = `${level}_inward_codes_${o_uid}`;
      let collectionName = `inward_codes_${o_uid}`;
      const model = sequelize.define(collectionName, {
        id: { primaryKey: true, type: DataTypes.UUID },
        order_id: DataTypes.UUID,
        order_details_id: DataTypes.UUID,
        unique_code: DataTypes.STRING,
        code_id: DataTypes.UUID,
        level: DataTypes.STRING,
        u_id: DataTypes.STRING,
        storage_bin_id: DataTypes.INTEGER,
        is_loose: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_sent_to_erp: { type: DataTypes.BOOLEAN, defaultValue: false },

      }, { freezeTableName: true });

      model.associate = function (models) {
      };

      db[collectionName] = model;
      db[collectionName].associate(db);

      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  // Dynamic model for 
  getCustomerProductsModel: async (uid, sync = false) => {
    try {
      let collectionName = `customer_products_${uid}`;
      const model = sequelize.define(collectionName, {
        id: { type: DataTypes.UUID, primaryKey: true },
        customer_id: DataTypes.UUID,
        role_id: DataTypes.INTEGER,
        category_id: DataTypes.INTEGER,
        product_id: DataTypes.UUID,
        batch_id: DataTypes.UUID,
        code_id: DataTypes.UUID,
        unique_code: DataTypes.STRING,
        level: DataTypes.STRING,  // P S T O,
        points: { type: DataTypes.INTEGER, defaultValue: 0 },
        is_reward_claimed: { type: DataTypes.BOOLEAN, defaultValue: false },
        scheme_id: DataTypes.ARRAY(DataTypes.UUID),
        lucky_draw_id: DataTypes.UUID,
        city_id: DataTypes.INTEGER,
        latitude: DataTypes.STRING,
        longitude: DataTypes.STRING,
        is_expired: { type: DataTypes.BOOLEAN, defaultValue: false },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      }, { freezeTableName: true });
      model.associate = function (models) {
        model.hasOne(models.products, {
          foreignKey: 'id',
          sourceKey: 'product_id',
        })
      };

      db[collectionName] = model;
      db[collectionName].associate(db);

      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  scratchCardsModel: async (uid, sync = false) => {
    try {
      let collectionName = `scratch_cards_${uid}`;
      const model = sequelize.define(collectionName, {
        id: { type: DataTypes.UUID, primaryKey: true },
        card_type: DataTypes.INTEGER, // 1 Loyalty Points 2 Lucky Draw
        customer_id: DataTypes.UUID,
        unique_code: DataTypes.STRING,
        // draw_id: DataTypes.UUID,
        scheme_id: DataTypes.UUID,   // Loyalty/Lucky Draw Id
        scheme_id_milestone: { type: DataTypes.NUMERIC },
        points: { type: DataTypes.INTEGER, defaultValue: 0 },
        is_scratched: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_discarded: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_locked: { type: DataTypes.BOOLEAN, defaultValue: false },
        reward_id: DataTypes.UUID,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      }, { freezeTableName: true });
      model.associate = function (models) {
      };

      db[collectionName] = model;
      db[collectionName].associate(db);

      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  luckyDrawUsersModel: async (uid, sync = false) => {
    try {
      let collectionName = `lucky_draw_users_${uid}`;
      const model = sequelize.define(collectionName, {
        id: { type: DataTypes.UUID, primaryKey: true },
        customer_id: DataTypes.UUID,
        // draw_id: DataTypes.UUID,
        scheme_id: DataTypes.UUID,   // Loyalty/Lucky Draw Id
        reward_id: DataTypes.UUID,
        is_discarded: { type: DataTypes.BOOLEAN, defaultValue: false },
        is_allotted: { type: DataTypes.BOOLEAN, defaultValue: false },
        uid: DataTypes.STRING,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      }, { freezeTableName: true });
      model.associate = function (models) {
      };

      db[collectionName] = model;
      db[collectionName].associate(db);

      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },
  rewardHistoryModel: async (uid, sync = false) => {
    try {
      let collectionName = `reward_history_${uid}`;
      console.log("called");
      console.log("c", collectionName);
      const model = sequelize.define(collectionName, {
        id: { type: DataTypes.UUID, primaryKey: true },
        random_id: DataTypes.STRING,
        // address: DataTypes.STRING,
        address: { type: DataTypes.ARRAY(DataTypes.STRING) },
        customer_name: DataTypes.STRING,
        phone: DataTypes.STRING,
        email: DataTypes.STRING,
        voucher_image: DataTypes.STRING,
        pin_code: DataTypes.STRING,
        points: DataTypes.INTEGER,
        brand_id: DataTypes.BIGINT,
        reward_id: DataTypes.UUID,
        consumer_id: DataTypes.UUID,
        verify_by: DataTypes.UUID,
        verify_comments: DataTypes.TEXT,
        created_by: DataTypes.UUID,
        updated_by: DataTypes.UUID,
        is_verified: DataTypes.INTEGER,
        partner_name: DataTypes.STRING,
        role_id: DataTypes.INTEGER,
        city_id: DataTypes.INTEGER,
        state_id: DataTypes.INTEGER,
        transaction_id: DataTypes.STRING,
        is_delivered: DataTypes.BOOLEAN,
        is_luckydraw_reward: DataTypes.BOOLEAN,
        scheme_id: DataTypes.UUID,

      }, { freezeTableName: true });
      model.associate = function (models) {
      };

      db[collectionName] = model;
      db[collectionName].associate(db);

      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }

  },
  pointsTransactionModel: async (uid, sync = false) => {
    try {
      let collectionName = `point_transaction_${uid}`;
      console.log("collectionName>>>>", collectionName);
      const model = sequelize.define(collectionName, {
        id: { type: DataTypes.UUID, primaryKey: true },
        name: DataTypes.STRING, //onsignup, onpurchase, onlucydraw
        type: DataTypes.INTEGER, // D/C => 0,1
        status: DataTypes.INTEGER, // success,failed,rejected,pending
        reward_id: DataTypes.UUID,
        history_id: DataTypes.UUID,
        customer_id: DataTypes.UUID,
        role_id: DataTypes.INTEGER,
        points: DataTypes.INTEGER,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      }, { freezeTableName: true });
      model.associate = function (models) {
      };

      db[collectionName] = model;
      db[collectionName].associate(db);

      await db[collectionName].sync({ alter: sync });
      return db[collectionName];
    } catch (error) {
      console.log(error);
    }
  },


  //==================================================================================
};
module.exports = controller;