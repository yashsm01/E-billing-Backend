const v = require("node-input-validator");
const uuid = require("uuid");
const randomstring = require("randomstring");
const fs = require("fs");
const path = require("path");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const db = require('../models');
const moment = require('moment');

//middleware
const message = require("../i18n/en");

// models
let models = require("./_models");
// controller
const controllers = require("./_controller");
const doctor = require("./doctor");

/**
 * @owner Yash Modi
 * @description Sales master
 */
const salesReturnController = {
  list: async (req, res) => {
    try {
      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }
      let whereClause = {
        retailer_id: req.retailerId,
        retail_outlet_id: req.retailOutletId,
        is_return: true
      };
      let dateFilter = [];
      if (req.query.startDate) {
        dateFilter.push({ createdAt: { [Op.gte]: moment(req.query.startDate).format("YYYY-MM-DD") + " 00:00:00" } });
      }
      if (req.query.endDate) {
        dateFilter.push({ createdAt: { [Op.lte]: moment(req.query.endDate).format("YYYY-MM-DD") + " 23:59:59" } });
      }
      if (dateFilter.length > 0) {
        whereClause[Op.and] = dateFilter;
      }

      let salesModel = await models.dynamicModel.getSalesModel(req.tableUid);
      console.log(salesModel, "sales...............")

      let salesList = await salesModel.findAll({
        where: whereClause,
        include: [
          {
            model: models.RetailerModel,
            attributes: ['id', 'name'],
            as: 'retailers',
          },
          {
            model: models.retailerOutletsModels,
            attributes: ['id', 'name'],
            as: 'retailer_outlets',
          },
          {
            model: models.ConsumersModel,
            attributes: ['id', 'first_name', 'last_name'],
            as: 'consumers',
            raw: true,
            nest: true
          },
          {
            model: models.doctorsModel,
            attributes: ['id', 'first_name', 'last_name'],
            as: 'doctors',
            raw: true,
            nest: true
          },

        ],
        nest: true,
        raw: true
      })

      //--------------if saleslist array is empaty--------------------------------

      if (salesList.length == 0) {

        return res.status(200).send({
          success: 0,
          message: "No data Available"

        })


      }
      return res.status(200).send({
        success: 1,
        data: salesList,
      })

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  details: async (req, res) => {
    try {

      let validator = new v(req.params, {
        id: "required"
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }

      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }
      let salesModel = await models.salesSchema(req.tableUid);

      let salesData = await salesModel.salesModels.findAll({
        where: {
          id: req.params.id,
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId,
          is_return: true,
        },
        include: [
          {
            model: models.ConsumersModel,
            attributes: ['id', 'first_name', 'last_name', 'phone', 'address'],
            as: 'consumers',
            raw: true,
            nest: true
          },
          {
            model: models.doctorsModel,
            attributes: ['id', 'first_name', 'last_name'],
            as: 'doctors',
            raw: true,
            nest: true
          },
          {
            model: salesModel.retailCustomerMasterModels,
            where: { retailer_id: req?.retailerId ?? null, retail_outlet_id: req?.retailOutletId ?? null },
            // attributes: ['order_count', 'pending_count', 'payment_amount', 'pending_amount'],
            as: 'retail_customer',
            required: false,
            raw: true,
            nest: true
          }
        ],
        raw: true,
        nest: true
      });

      let salesDetails = await salesModel.salesDetailModels.findAll({
        where: {
          sales_id: req.params.id,
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId
        },
        include: [
          {
            model: models.productsModel,
            attributes: ['id', 'name', 'category', 'uom', 'unit_size', 'content'],
            as: 'products',
            raw: true,
            nest: true
          },
          {
            model: salesModel.retailBatchModels,
            attributes: ['id', 'batch_no', 'mrp', 'exp_date'],
            as: 'product_batches',
            include: [
              {
                model: salesModel.batchStockModels,
                where: { retailer_id: req?.retailerId ?? null, retail_outlet_id: req?.retailOutletId ?? null },
                required: false,
                attributes: ['rack_no', 'discount_percentage', 'mrp', 'margin_percentage', 'qty'],
                as: 'batchStock',
                raw: true,
                nest: true
              }
            ],
            raw: true,
            nest: true
          },
          {
            model: models.ConsumersModel,
            attributes: ['id', 'first_name', 'last_name', 'phone', 'address'],
            as: 'consumers',
            raw: true,
            nest: true
          },
          {
            model: models.RetailerModel,
            attributes: ['id', 'name'],
            as: 'retailers',
            raw: true,
            nest: true
          },
          {
            model: models.doctorsModel,
            attributes: ['id', 'first_name', 'last_name'],
            as: 'doctors',
            raw: true,
            nest: true
          },

        ],
        nest: true,
        raw: true
      });
      return res.status(200).send({
        success: 1,
        data: { salesDetails, salesData },
      })

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  add: async (req, res) => {
    try {
      let validator = new v(req.body, {
        bill_date: "required",
        customer: "required",
        doctor_id: "required",
        items: "required|array",
        payment_type: "required",
        save_as_draft: "required"
      });
      console.log("req body", req.body);
      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }

      //Dynamic Models
      let salesSchema = await models.dynamicModel.getSalesModel(req.tableUid);
      let salesDetailSchema = await models.dynamicModel.getSalesDetailsModel(req.tableUid);
      let productStockSchema = await models.dynamicModel.getProductStockModel(req.tableUid);
      let retailCustomerMasterSchema = await models.dynamicModel.getRetailCustomerMasterModel(req.tableUid);

      let batchStockSchema = await models.dynamicModel.getBatchStockModel(req.tableUid);
      let getCode = await controllers.commonController.getEncodeQrCodes(req.tableUid);
      console.log("qr_code", getCode);
      //-----------------------------validations 

      console.log(salesSchema, "sales schemaaaaaaaaaaaaa")
      //some Sales validation-----------------------------------------------
      let salesInfo = await salesSchema.findOne(
        {
          where: {
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId
          },
          attributes: ['serial_code'],
          order: [
            ["serial_code", "DESC"]
          ],
          raw: true
        });

      //-----------------------------generate custom bill number
      let billNumber = "10001";
      if (salesInfo?.serial_code) {
        let serialCode = salesInfo.serial_code;
        billNumber = ((parseInt(serialCode, 36) + 1).toString(36)).toUpperCase();
      }

      //-----------------------------add Sales and Details

      let totalDetails = req.body.total;
      let salesId = uuid();
      let salesList = [];
      for (const element of req.body.items) {
        let salesDetailId = uuid();
        let data = {
          //group 1 -- basic details
          id: salesDetailId,
          sales_id: salesId,
          product_id: element.product_id,
          batch_id: element.batch_id,
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId,
          customer_id: req.body.customer,
          doctor_id: req.body.doctor_id,
          item_name: element.item_name,
          exp_date: element.exp_date,
          unit_pack: element.pack,
          created_by: req.userId,
          location: element.location,
          //group 2 -- calculation
          mrp: element.mrp,
          qty: element.qty,
          margin_percentage: element.margin_percentage,
          discount_percentage: element.disc_percentage,
          base_amount: element.base_price,
          gst_percentage: element.gst_percentage,
          final_amount: element.total,
          //group 4 -- order status
          save_as_draft: req.body.save_as_draft,
          is_return: true
        }
        salesList.push(data);
      }

      await salesSchema.create({
        //group 1 -- basic details
        id: salesId,
        retailer_id: req.retailerId,
        retail_outlet_id: req.retailOutletId,
        customer_id: req.body.customer,
        doctor_id: req.body.doctor_id,
        created_by: req.userId,
        bill_date: req.body.bill_date,
        bill_number: `B${billNumber}`,
        serial_code: billNumber,
        qr_code: `${getCode}`,
        //group 2 -- calculations
        total_amount: totalDetails.total_amount,
        total_gst_amount: totalDetails.total_gst,
        total_qty: totalDetails.total_qty,
        total_mrp: totalDetails.total_mrp,
        total_margin: totalDetails.total_margin,
        //group 3 -- payement 
        payment_type: req.body.payment_type,
        payment_status: [0, 2, 3].includes(req.body.payment_type) ? 2 : 0,
        //group 4 -- order status
        save_as_draft: req.body.save_as_draft,
        is_return: true
      });
      await salesDetailSchema.bulkCreate(salesList);
      //-------------------------------update stock
      await req.body.items.forEach(async (element) => {
        let productDetails = {
          product_id: element.product_id,
          qty: element.strip_qty * (+1),
          unit_qty: element.qty * (+1)
        };
        element.unit_qty = element.qty * (+1);
        element.qty = element.strip_qty * (+1);
        await controllers.commonController.addOrUpdateProductStockSummary(productStockSchema, req.retailerId, req.retailOutletId, productDetails);
        await controllers.commonController.addOrUpdateBatchStockSummary(batchStockSchema, req.retailerId, req.retailOutletId, element);

      });
      //----------------------------------------------------------
      //-------------------------------add disributor paymant details
      let data = {
        consumer_id: req.body.customer,
        payment_amount: totalDetails.total_amount,
        payment_status: req.body?.payment_type ?? 1 == 1 ? false : true,
        order_count: 1,
        action: req.body?.payment_type ?? 1 == 1 ? 1 : 0
      }
      await controllers.commonController.addOrUpdateRetailCustomerReturnPayment(retailCustomerMasterSchema, req.retailerId, req.retailOutletId, data, req.tableUid);
      //-----------------------------------------------------------
      return res.status(200).send({ success: 1, message: "Sales Return Received successfully", salesId: salesId });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  update: async (req, res) => {
    try {
      console.log(req.body, "bodyyyyyyyyyyyyyyy");
      let totalDetails = req.body.total;

      //------------------------- validation ------------------------
      let validator = new v(req.body, {
        bill_date: "required",
        payment_type: "required",
        save_as_draft: "required"// if true only purchase details update not stock / payment amount
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      //--------------- Dynamic Model --------------------------------------------------------
      //Dynamic Models
      let salesSchema = await models.dynamicModel.getSalesModel(req.tableUid);
      let salesDetailSchema = await models.dynamicModel.getSalesDetailsModel(req.tableUid);
      let productStockSchema = await models.dynamicModel.getProductStockModel(req.tableUid);
      let batchStockSchema = await models.dynamicModel.getBatchStockModel(req.tableUid);
      let retailCustomerMasterSchema = await models.dynamicModel.getRetailCustomerMasterModel(req.tableUid);

      //--------------------------------steps start for add po details-------------------------------------------------------------------//
      let salseOrderInfo = await salesSchema.findOne({
        where: {
          id: req.body.sales_id,
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId
        },
        raw: true
      });

      if (req.body.save_as_draft == false) {
        //------------------Check Old save as Draft details--------------------
        let draftedSalesOrder = await salesSchema.findOne({
          where: {
            id: req.body.sales_id,
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            save_as_draft: true,
          },
          raw: true
        });

        let draftedSalesDetail = await salesDetailSchema.findAll({
          where: {
            sales_id: req.body.sales_id,
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            save_as_draft: true,
          },
          raw: true
        });

        if (draftedSalesDetail.length > 0) {
          for (const element of draftedSalesDetail) {
            let productDetails = {
              product_id: element.product_id,
              qty: (-1) * (element.qty),
              free_stock: 0,
            };
            await controllers.commonController.addOrUpdateProductStockSummary(productStockSchema, req.retailerId, req.retailOutletId, productDetails, req.tableUid);
            await controllers.commonController.addOrUpdateBatchStockSummary(batchStockSchema, req.retailerId, req.retailOutletId, element, req.tableUid);
          }
        }
        //-------------------------------add disributor paymant details
        if (draftedSalesOrder) {
          await retailCustomerMasterSchema.update(// 1 : credit // 0 : cash
            {
              return_payment_amount: Sequelize.literal(`return_payment_amount + ${draftedSalesOrder.total_amount}`),
              return_pending_amount: Sequelize.literal(`return_pending_amount + ${[0, 2, 3].includes(salseOrderInfo.payment_type) ? 0 : (draftedSalesOrder.total_amount)}`),
              return_pending_count: Sequelize.literal(`return_pending_count + ${[0, 2, 3].includes(salseOrderInfo.payment_type) ? 0 : 1}`),
              order_return_count: Sequelize.literal(`order_return_count + ${1}`),
            },
            { where: { consumer_id: req.body.customer, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
          );
        }
        //-----------------------------------------------------------
      }

      //----------------- Check if sales details already exist, if not, then add new sales details -----------------------
      const SalesId = uuid();
      let salesList = [];

      if (req.body.items.length > 0) {


        // Filter out null or undefined items
        const validItems = req.body.items.filter(element => element !== null && element !== undefined);

        // Only proceed if there are valid items
        if (validItems.length > 0) {

          for (let element of req.body.items) {

            if (!element.id) {
              console.error('Element ID is missing for:', element);
              // let batchId = '55744c76-d330-47a4-a664-510eff9c7563'
              let salesDetailsId = uuid();
              let data = {
                //group 1 -- basic details
                id: salesDetailsId,
                sales_id: req.body.sales[0].id,
                product_id: element.product_id,
                batch_id: element.batch_id,
                retailer_id: req.retailerId,
                retail_outlet_id: req.retailOutletId,
                customer_id: req.body.customer,
                doctor_id: req.body.doctor_id,
                item_name: element.product_name,
                exp_date: element.exp_date,
                unit_pack: element.pack,
                created_by: req.userId,
                location: element.location,
                //group 2 -- calculation
                mrp: element.mrp,
                qty: element.qty,
                discount_percentage: element.disc_percentage,
                base_amount: element.base_price,
                gst_percentage: element.gst_percentage,
                final_amount: element.final_amount,

                //group 3 -- payment
                save_as_draft: req.body.save_as_draft,
                is_return: true,
              }
              salesList.push(data);
              await salesDetailSchema.bulkCreate(salesList);


              //----------- after add so details also update in so--------------------------/

              let salesUpdate = {
                // Group 1 -- Basic
                bill_date: req.body.bill_date,

                // Group 2 -- calculations
                total_amount: totalDetails.total_amount,
                total_gst_amount: totalDetails.total_gst,
                margin_percentage: totalDetails.total_margin,
                total_qty: totalDetails.total_qty,
                total_base_amount: totalDetails.total_base_amount,
                //group 3 -- payement 
                payment_type: req.body.payment_type,
                payment_status: [0, 2, 3].includes(req.body.payment_type) ? 2 : 0,
                //group 4 -- order status
                save_as_draft: req.body.save_as_draft
              }
              await salesSchema.update(
                salesUpdate,
                {
                  where: {
                    id: req.body.sales[0].id,
                    retailer_id: req.retailerId,
                    retail_outlet_id: req.retailOutletId,
                  }
                }
              );
              //-------------------------------update stock
              await req.body.items.forEach(async (element) => {
                let productDetails = {
                  product_id: element.product_id,
                  qty: element.strip_qty * (+1),
                  unit_qty: element.qty * (+1)
                };
                element.unit_qty = element.qty * (+1);
                element.qty = element.strip_qty * (+1);
                await controllers.commonController.addOrUpdateProductStockSummary(productStockSchema, req.retailerId, req.retailOutletId, productDetails);
                await controllers.commonController.addOrUpdateBatchStockSummary(batchStockSchema, req.retailerId, req.retailOutletId, element);

              });
              //--------------------------------------------------------------------------------------------


            }

            //--------------------------------steps end for add so details-------------------------------------------------------------------//

            //---------------  steps start for Update sales-order-details --------------------------------------------------------------//

            else if (element.is_updated == true) {

              //**********for po  update*************** */
              console.log("update")


              //**********for so details  update*************** */


              let updatedDetailsData = {
                //group 1 
                sales_id: element.sales_id,
                product_id: element.product_id,
                batch_id: element.batch_id,
                customer_id: req.body.customer,
                doctor_id: req.body.doctor_id,
                item_name: element.item_name,
                exp_date: element.exp_date,
                unit_pack: element.pack,
                created_by: req.userId,
                location: element.location,
                //group 2 -- calculation
                mrp: element.mrp,
                qty: element.qty,
                margin_percentage: element.margin_percentage,
                discount_percentage: element.disc_percentage,
                base_amount: element.base_price,
                gst_percentage: element.gst_percentage,
                final_amount: element.final_amount,

              };

              let existingSalesOrderDetails = await salesDetailSchema.findOne({
                where: {
                  id: element.id,
                  sales_id: element.sales_id,
                  retailer_id: req.retailerId,
                  retail_outlet_id: req.retailOutletId,
                }
              });

              await salesDetailSchema.update(
                updatedDetailsData, // Data to update
                {
                  where: {
                    id: element.id,
                    sales_id: element.sales_id,
                    retailer_id: req.retailerId,
                    retail_outlet_id: req.retailOutletId,
                  }
                }
              );

              //------------------------------- Update stock ----------------------------------------------------------//
              if (req.body.save_as_draft == false) {
                let unitPack = String(element.pack);
                let unit = parseFloat(unitPack.split("/")[0]);
                let qtyChange = (Number(element.qty) - Number(existingSalesOrderDetails.qty)); // Assuming existingPurchaseOrderDetails.qty was fetched earlier
                let unitQtyChange = (unit * qtyChange);
                //----------------- Handle quantity decrease------------------------------------------------
                // Update Product Stock 
                await productStockSchema.update(
                  {
                    qty: Sequelize.literal(`qty + ${qtyChange}`),
                    unit_qty: Sequelize.literal(`unit_qty + ${unitQtyChange}`)
                  },
                  { where: { product_id: element.product_id, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
                );

                // Update Batch Stock (decrease)
                await batchStockSchema.update(
                  {
                    qty: Sequelize.literal(`qty + ${qtyChange}`),
                    unit_qty: Sequelize.literal(`unit_qty + ${unitQtyChange}`)
                  },
                  { where: { product_id: element.product_id, batch_id: element.batch_id, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
                );

                //----------------------------- Handle no change in quantity--------------------------------------------
                if (element.qty === 0) {
                  console.log('No change in quantity.');
                  // No update to stock needed
                }
              }
            }

          };
          let updateSalesData = {
            // Group 1 -- Basic
            bill_date: req.body.bill_date,

            // Group 2 -- calculations
            total_amount: totalDetails.total_amount,
            total_gst_amount: req.body.items.reduce((sum, item) => sum + parseFloat(item.gst_value), 0),
            total_base_amount: req.body.items.reduce((sum, item) => sum + parseFloat(item.base_price), 0),
            margin_percentage: totalDetails.total_margin,
            total_qty: totalDetails.total_qty,
          };

          await salesSchema.update(
            updateSalesData,  // Data to update
            {
              where: {
                id: req.body.sales[0].id,
                retailer_id: req.retailerId,
                retail_outlet_id: req.retailOutletId,
              }
            }
          );
        }
        //---------------  steps end for Update sales details --------------------------------------------------------------//



      }

      //---------------  steps start for delete sales details --------------------------------------------------------------//


      if (req.body.deleteItems.length > 0) {
        for (let item of req.body.deleteItems) {

          //------------------------------ delete sales order details -----------------------------------------

          let deleteData = await salesDetailSchema.destroy({
            where: {
              id: item.id,
              retailer_id: req.retailerId,
              retail_outlet_id: req.retailOutletId,
            }
          })

          if (req.body.save_as_draft == false) {
            let unitPack = String(item.pack);
            let unit = parseFloat(unitPack.split("/")[0]);
            let qtyChange = Number(item.qty); // Assuming existingPurchaseOrderDetails.qty was fetched earlier
            let unitQtyChange = (unit * qtyChange);
            //--------------------------------- update product stock ---------------------------------------

            // Update Product Stock (decrease)
            await productStockSchema.update(
              {
                qty: Sequelize.literal(`qty - ${qtyChange}`),
                unit_qty: Sequelize.literal(`unit_qty - ${unitQtyChange}`)
              },
              { where: { product_id: item.product_id, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
            );
            //--------------------------------- update batch stock -----------------------------------------
            // Update Batch Stock (decrease)
            await batchStockSchema.update(
              {
                qty: Sequelize.literal(`qty - ${qtyChange}`),
                unit_qty: Sequelize.literal(`unit_qty - ${unitQtyChange}`)
              },
              { where: { product_id: item.product_id, batch_id: item.batch_id, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
            );
          }

        }
        //------------------------------ update purchase order -----------------------------------------

        let updatedData = {
          // Group 1 -- Basic
          total_base_amount: totalDetails.total_base_amount,
          // Group 2 -- calculations
          total_amount: totalDetails.total_amount,
          total_gst_amount: totalDetails.total_gst,
          total_products: totalDetails.total_items,
          margin_percentage: totalDetails.total_margin,
          total_qty: totalDetails.total_qty,
        };

        await salesSchema.update(
          updatedData,  // Data to update
          {             // Options
            where: {
              id: req.body.sales[0].id,
              retailer_id: req.retailerId,
              retail_outlet_id: req.retailOutletId,
            }
          }
        );
        //---------------  steps end for delete purchase-order-details --------------------------------------------------------------//


      }


      if (req.body.save_as_draft == false) {

        let updatedTotalAmount = Number(totalDetails.total_amount || 0) - Number(salseOrderInfo.total_amount || 0);
        if ([0, 2, 3].includes(req.body.payment_type)) {
          await retailCustomerMasterSchema.update(// 1 : credit // 0 : cash
            {
              return_payment_amount: Sequelize.literal(`return_payment_amount + ${[0, 2, 3].includes(salseOrderInfo.payment_type) ? updatedTotalAmount : updatedTotalAmount}`),
              return_pending_amount: Sequelize.literal(`return_pending_amount + ${[0, 2, 3].includes(salseOrderInfo.payment_type) ? 0 : (-1) * (salseOrderInfo.total_amount)}`),
              return_pending_count: Sequelize.literal(`return_pending_count + ${[0, 2, 3].includes(salseOrderInfo.payment_type) ? 0 : -1}`),
            },
            { where: { consumer_id: req.body.customer, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
          );
        } else {
          await retailCustomerMasterSchema.update(// 1 : credit // 0 : cash
            {
              return_payment_amount: Sequelize.literal(`return_payment_amount + ${[0, 2, 3].includes(salseOrderInfo.payment_type) ? updatedTotalAmount : updatedTotalAmount}`),
              return_pending_amount: Sequelize.literal(`return_pending_amount + ${[0, 2, 3].includes(salseOrderInfo.payment_type) ? totalDetails.total_amount : updatedTotalAmount}`),
              return_pending_count: Sequelize.literal(`return_pending_count + ${[0, 2, 3].includes(salseOrderInfo.payment_type) ? 1 : 0}`),
            },
            { where: { consumer_id: req.body.customer, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
          );
        }
      }

      //update save as draft ------------------------------
      if (req.body.save_as_draft == false) {
        await salesSchema.update({ save_as_draft: req.body.save_as_draft, payment_type: req.body.payment_type }, {
          where: {
            id: req.body.sales[0].id,
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            [Op.or]: {
              save_as_draft: req.body.save_as_draft,
              payment_type: req.body.payment_type
            }
          }
        });

        await salesDetailSchema.update({ save_as_draft: req.body.save_as_draft }, {
          where: {
            sales_id: req.body.sales[0].id,
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            save_as_draft: true
          }
        });
      }
      //---------------------------------

      return res.status(200).send({ success: 1, message: "Sales Return Updated Successfully", salesId: req.body.sales_id });




    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
};

module.exports = salesReturnController;
