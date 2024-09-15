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

/**
 * @owner Yash Modi
 * @description Purchase order master
 */
const purchaseOrderController = {
  addPurchaseReturn: async (req, res) => {
    try {
      let validator = new v(req.body, {
        bill_date: "required",
        due_date: "required",
        items: "required|array",
        po_date: "required",
        po_no: "required",
        distributor_id: "required",
        payment_type: "required",
        save_as_draft: "required"// if true only purchase details update not stock / payment amount
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors)
        return res.status(200).send({ success: 0, message: validatorError });
      }
      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }

      //Dynamic Models
      let purchaseOrderSchema = await models.dynamicModel.getPurchaseOrderModel(req.tableUid);
      let purchaseOrderDetailSchema = await models.dynamicModel.getPurchaseOrderDetailsModel(req.tableUid);
      let productStockSchema = await models.dynamicModel.getProductStockModel(req.tableUid);
      let batchStockSchema = await models.dynamicModel.getBatchStockModel(req.tableUid);
      let retailDistributorSchema = await models.dynamicModel.getRetailDistributorMasterModel(req.tableUid);

      //-----------------------------validations 
      let getCode = await controllers.commonController.getEncodeQrCodes(req.tableUid);

      //same po number validation-----------------------------------------------
      let PurchaseInfo = await purchaseOrderSchema.findOne(
        {
          where: {
            po_no: req.body.po_no,
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            is_return: true
          },
          attributes: ['id', 'po_no'],
          raw: true
        });

      if (PurchaseInfo) {
        return res.status(200).send({ success: 0, message: "Purchase no already exist" });
      }


      //-----------------------------add PO and Details

      let totalDetails = req.body.total;
      const poId = uuid();
      const paymentId = uuid();
      let poList = [];
      await req.body.items.forEach(async (element) => {
        let poDetailsId = uuid();
        let data = {
          //group 1 -- basic details
          id: poDetailsId,
          po_id: poId,
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId,
          product_id: element.product_id,
          batch_id: element.batch_id,
          exp_date: element.exp_date,
          //group 2 -- calculation
          mrp: element.mrp,
          ptr: element.ptr,
          qty: element.qty,
          unit_qty: element.unit_qty,
          free_qty: element.free,
          discount_percentage: element.disc_percentage,
          scheme_amount: element.sch_amount,
          base_amount: element.base_price,
          gst_percentage: element.gst_percentage,
          final_amount: element.total,
          //group 4 -- order status
          save_as_draft: req.body.save_as_draft,
          is_return: true
        }
        poList.push(data);
      });
      await purchaseOrderSchema.create({
        //group 1 -- basic details
        id: poId,
        retailer_id: req.retailerId,
        retail_outlet_id: req.retailOutletId,
        po_no: req.body.po_no,
        po_date: req.body.po_date,
        bill_date: req.body.bill_date,
        due_date: req.body.due_date,
        distributor_id: req.body.distributor_id,
        created_by: req.userId,
        qr_code: `${getCode}`,
        //group 2 -- calculations
        total_amount: totalDetails.total_amount,
        total_gst_amount: totalDetails.total_gst,
        total_products: totalDetails.total_items,
        margin_percentage: totalDetails.total_margin,
        total_qty: totalDetails.total_qty,
        //group 3 -- payement 
        payment_type: req.body.payment_type,
        payment_status: [0, 2, 3].includes(req.body.payment_type) ? 2 : 0,
        //group 4 -- order status
        save_as_draft: req.body.save_as_draft,
        is_return: true
      });
      await purchaseOrderDetailSchema.bulkCreate(poList);

      if (req.body.save_as_draft == false) { // If True stock details and payment does not update
        //-------------------------------update stock
        for (const element of req.body.items) {
          let productDetails = {
            product_id: element.product_id,
            qty: -element.qty,  // - Decreasing the qty
            unit_qty: -element.unit_qty,// - Decreasing the tablet qty
            free_stock: element.free,
          };
          element.qty = -element.qty;       // - Decreasing the qty
          element.unit_qty = -element.unit_qty;       // - Decreasing the qty
          await controllers.commonController.addOrUpdateProductStockSummary(productStockSchema, req.retailerId, req.retailOutletId, productDetails, req.tableUid);
          await controllers.commonController.addOrUpdateBatchStockSummary(batchStockSchema, req.retailerId, req.retailOutletId, element, req.tableUid);
        }
        //-------------------------------add disributor paymant details
        let data = {
          distributor_id: req.body.distributor_id,
          payment_amount: totalDetails.total_amount,
          payment_status: req.body.payment_type == 1 ? false : true,
          order_count: 1,
          action: req.body.payment_type == 1 ? 1 : 0
        }
        await controllers.commonController.addOrUpdateRetailDistributorReturnPayment(retailDistributorSchema, req.retailerId, req.retailOutletId, data, req.tableUid);
        //-----------------------------------------------------------
        //----------------------------------------------------------
      }
      return res.status(200).send({ success: 1, message: "Purchase Return Received Successfully", poId: poId });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  listPurchaseReturn: async (req, res) => {
    try {
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


      if (!req.tableUid) {
        return res.status(200).send({ success: 0, message: "Table uid Not Available" });
      }

      let purchaseOrderModel = await models.dynamicModel.getPurchaseOrderModel(req.tableUid);
      console.log(purchaseOrderModel, "purchaseOrderModel...............")
      console.log("Purchase return whereClause", whereClause)

      let purchaseOrderlist = await purchaseOrderModel.findAll({
        where: whereClause,
        include: [
          {
            model: models.RetailerModel,
            attributes: ['id', 'name'],
            as: 'retailers',
            raw: true,
            nest: true
          },
          {
            model: models.retailerOutletsModels,
            attributes: ['id', 'name'],
            as: 'retailer_outlets',
            raw: true,
            nest: true
          },
          {
            model: models.DistributorsModel,
            attributes: ['id', 'name'],
            as: 'distributors',
            raw: true,
            nest: true
          }

        ],
        nest: true,
        raw: true
      })
      console.log(purchaseOrderlist, ".............................")
      return res.status(200).send({
        success: 1,
        data: purchaseOrderlist,
      })

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },

  updateReturn: async (req, res) => {
    try {
      console.log(req.body, "bodyyyyyyyyyyyyyyy");
      let totalDetails = req.body.total;

      //------------------------- validation ------------------------
      let validator = new v(req.body, {
        po_id: "required",
        bill_date: "required",
        due_date: "required",
        po_date: "required",
        po_no: "required",
        payment_type: "required",
        save_as_draft: "required"// if true only purchase details update not stock / payment amount
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }

      //--------------- Dynamic Model --------------------------------------------------------
      let purchaseOrderSchema = await models.dynamicModel.getPurchaseOrderModel(req.tableUid);
      let purchaseOrderDetailSchema = await models.dynamicModel.getPurchaseOrderDetailsModel(req.tableUid);
      let productStockSchema = await models.dynamicModel.getProductStockModel(req.tableUid);
      let batchStockSchema = await models.dynamicModel.getBatchStockModel(req.tableUid);
      let retailDistributorSchema = await models.dynamicModel.getRetailDistributorMasterModel(req.tableUid);
      //--------------------------------steps start for add po details-------------------------------------------------------------------//
      let PurchaseOrderInfo = await purchaseOrderSchema.findOne({
        where: {
          id: req.body.po_id,
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId
        },
        raw: true
      });

      if (req.body.save_as_draft == false) {
        //------------------Check Old save as Draft details--------------------
        let draftedPurchaseOrder = await purchaseOrderSchema.findOne({
          where: {
            id: req.body.po_id,
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            save_as_draft: true,
          },
          raw: true
        });

        let draftedPurchaseOrderDetail = await purchaseOrderDetailSchema.findAll({
          where: {
            po_id: req.body.po_id,
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            save_as_draft: true,
          },
          raw: true
        });

        if (draftedPurchaseOrderDetail.length > 0) {
          for (const element of draftedPurchaseOrderDetail) {
            let productDetails = {
              product_id: element.product_id,
              qty: -element.qty,
              unit_qty: -element.unit_qty,
              free_stock: element.free,
            };
            await controllers.commonController.addOrUpdateProductStockSummary(productStockSchema, req.retailerId, req.retailOutletId, productDetails, req.tableUid);
            await controllers.commonController.addOrUpdateBatchStockSummary(batchStockSchema, req.retailerId, req.retailOutletId, element, req.tableUid);
          }
        }
        //-------------------------------add disributor paymant details
        if (draftedPurchaseOrder) {
          await retailDistributorSchema.update(// 1 : credit // 0 : cash
            {
              return_payment_amount: Sequelize.literal(`return_payment_amount + ${draftedPurchaseOrder.total_amount}`),
              return_pending_amount: Sequelize.literal(`return_pending_amount + ${[0, 2, 3].includes(PurchaseOrderInfo.payment_type) ? 0 : (draftedPurchaseOrder.total_amount)}`),
              return_pending_count: Sequelize.literal(`return_pending_count + ${[0, 2, 3].includes(PurchaseOrderInfo.payment_type) ? 0 : 1}`),
              order_return_count: Sequelize.literal(`order_return_count + ${1}`),
            },
            { where: { distributor_id: req.body.distributor_id, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
          );
        }
        //-----------------------------------------------------------
      }
      //----------------------------------------------------
      //----------------- Check if PO details already exist, if not, then add new PO details -----------------------
      const poId = uuid();
      let poList = [];

      if (req.body.items.length > 0) {
        // Filter out null or undefined items
        const validItems = req.body.items.filter(element => element !== null && element !== undefined);

        // Only proceed if there are valid items
        if (validItems.length > 0) {
          let total_base_amount = 0;
          let total_gst_amount = 0;
          for (let element of req.body.items) {

            if (!element.id) {
              console.error('Element ID is missing for:', element);
              console.log(req.body.purchase[0].id, "purchase.......................................")
              let poDetailsId = uuid();
              let data = {
                //group 1 -- basic details
                id: poDetailsId,
                po_id: req.body.purchase[0].id,
                retailer_id: req.retailerId,
                retail_outlet_id: req.retailOutletId,
                product_id: element.product_id,
                batch_id: element.batch_id,
                exp_date: element.exp_date,
                //group 2 -- calculation
                mrp: element.mrp,
                ptr: element.ptr,
                qty: element.qty,
                unit_qty: element.unit_qty,
                free_qty: element.free,
                discount_percentage: element.disc_percentage,
                scheme_amount: element.sch_amount,
                base_amount: element.base_price,
                gst_percentage: element.gst_percentage,
                final_amount: element.final_amount,
                //group 3 -- order status
                save_as_draft: req.body.save_as_draft,
                is_return: true
              }
              poList.push(data);
              await purchaseOrderDetailSchema.bulkCreate(poList);


              //----------- after add po details also update in po--------------------------/

              let purchaseUpdate = {
                // Group 1 -- Basic
                po_no: req.body.po_no,
                po_date: req.body.po_date,
                bill_date: req.body.bill_date,
                due_date: req.body.due_date,
                distributor_id: element.distributor_id,
                total_base_amount: totalDetails.total_base_amount,
                // Group 2 -- calculations
                total_amount: totalDetails.total_amount,
                total_gst_amount: totalDetails.total_gst,
                total_products: totalDetails.total_items,
                margin_percentage: totalDetails.total_margin,
                total_qty: totalDetails.total_qty,
                //group 3 -- payement 
                payment_type: req.body.payment_type,
                payment_status: [0, 2, 3].includes(req.body.payment_type) ? 2 : 0,
                //group 4 -- order status
                save_as_draft: req.body.save_as_draft
              }
              await purchaseOrderSchema.update(
                purchaseUpdate,
                {
                  where: {
                    id: req.body.purchase[0].id,
                    retailer_id: req.retailerId,
                    retail_outlet_id: req.retailOutletId,
                  }
                }
              );
              // ------------------------------- Update stock -------------------------------------------------
              if (req.body.save_as_draft == false) {
                for (const element of req.body.items) {
                  let productDetails = {
                    product_id: element.product_id,
                    qty: -element.qty,
                    unit_qty: -element.unit_qty,
                    free_stock: element.free,
                  };
                  element.qty = -element.qty;
                  element.unit_qty = -element.unit_qty;
                  await controllers.commonController.addOrUpdateProductStockSummary(productStockSchema, req.retailerId, req.retailOutletId, productDetails, req.tableUid);
                  await controllers.commonController.addOrUpdateBatchStockSummary(batchStockSchema, req.retailerId, req.retailOutletId, element, req.tableUid);
                }
              }

            }

            //---------------  steps start for Update purchase-order-details --------------------------------------------------------------//
            //>>>>>>>>>>>>>>>>NEW ADDED/UPDATED Purchase Details <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<//
            else if (element.is_updated == true) {

              //**********for po details  update*************** */

              let updatedDetailsData = {
                product_id: element.product_id,
                batch_id: element.batch_id,
                exp_date: element.exp_date,
                mrp: element.mrp,
                ptr: element.ptr,
                qty: element.qty,
                unit_qty: element.unit_qty,
                free_qty: element.free,
                discount_percentage: element.disc_percentage,
                scheme_amount: element.sch_amount,
                gst_percentage: element.gst_percentage,
                base_amount: element.base_price,
                final_amount: element.final_amount,
                // createdAt: element.createdAt,
                // updatedAt: element.updatedAt
              };

              let existingPurchaseOrderDetails = await purchaseOrderDetailSchema.findOne({
                where: {
                  id: element.id,
                  po_id: element.po_id,
                  retailer_id: req.retailerId,
                  retail_outlet_id: req.retailOutletId,
                }
              });

              await purchaseOrderDetailSchema.update(
                updatedDetailsData, // Data to update
                {
                  where: {
                    id: element.id,
                    po_id: element.po_id,
                    retailer_id: req.retailerId,
                    retail_outlet_id: req.retailOutletId,
                  }
                }
              );

              //------------------------------- Update stock ----------------------------------------------------------//
              if (req.body.save_as_draft == false) {
                console.log(existingPurchaseOrderDetails.qty);
                let qtyChange = (-1) * (Number(element.qty) - Number(existingPurchaseOrderDetails.qty)); // Assuming existingPurchaseOrderDetails.qty was fetched earlier
                let unitQtyChange = (-1) * (Number(element.unit_qty) - Number(existingPurchaseOrderDetails.unit_qty));
                //------------------------------ Handle quantity increase---------------------------------
                if (qtyChange > 0) {
                  console.log('Quantity increased by:', qtyChange);

                  // Update Product Stock (increase)
                  await productStockSchema.update(
                    {
                      qty: Sequelize.literal(`qty + ${qtyChange}`),
                      unit_qty: Sequelize.literal(`unit_qty + ${unitQtyChange}`),
                    },
                    { where: { product_id: element.product_id, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
                  );

                  // Update Batch Stock (increase)
                  await batchStockSchema.update(
                    {
                      qty: Sequelize.literal(`qty + ${qtyChange}`),
                      unit_qty: Sequelize.literal(`unit_qty + ${unitQtyChange}`)
                    },
                    { where: { product_id: element.product_id, batch_id: element.batch_id, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
                  );
                }

                //----------------- Handle quantity decrease------------------------------------------------
                if (qtyChange < 0) {
                  console.log('Quantity decreased by:', Math.abs(qtyChange));

                  // Update Product Stock (decrease)
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

                }

                //----------------------------- Handle no change in quantity--------------------------------------------
                if (qtyChange === 0) {
                  console.log('No change in quantity.');
                  // No update to stock needed
                }
                // ------------------------------ Update Stock----------------------------------

              }
            }

          };
          //**********for po  update*************** */
          console.log("update")
          let updatedPoData = {
            // Group 1 -- Basic
            po_no: req.body.po_no,
            po_date: req.body.po_date,
            bill_date: req.body.bill_date,
            due_date: req.body.due_date,
            distributor_id: req.body.distributor_id,
            total_base_amount: req.body.items.reduce((sum, item) => sum + parseFloat(item.base_price), 0),
            // Group 2 -- calculations
            total_amount: totalDetails.total_amount,
            total_gst_amount: req.body.items.reduce((sum, item) => sum + parseFloat(item.gst_value), 0),
            total_products: totalDetails.total_items,
            margin_percentage: totalDetails.total_margin,
            total_qty: totalDetails.total_qty,
          };

          await purchaseOrderSchema.update(
            updatedPoData,  // Data to update
            {
              where: {
                id: req.body.po_id,
                retailer_id: req.retailerId,
                retail_outlet_id: req.retailOutletId,
              }
            }
          );
          //--------------------------------steps end for add po details-------------------------------------------------------------------//

        }
        //---------------  steps end for Update purchase-order-details --------------------------------------------------------------//
      }
      //>>>>>>>>>DELETE Purchase Details <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<//
      //---------------  steps start for delete purchase-order-details --------------------------------------------------------------//
      if (req.body.deleteItems.length > 0) {
        for (let item of req.body.deleteItems) {

          //------------------------------ delete purchase order details -----------------------------------------

          let deleteData = await purchaseOrderDetailSchema.destroy({
            where: {
              id: item.id,
              retailer_id: req.retailerId,
              retail_outlet_id: req.retailOutletId,
            }
          })

          if (req.body.save_as_draft == false) {
            //--------------------------------- update product stock ---------------------------------------

            // Update Product Stock (decrease)
            await productStockSchema.update(
              {
                qty: Sequelize.literal(`qty + ${Math.abs(item.qty)}`),
                unit_qty: Sequelize.literal(`unit_qty + ${Math.abs(item.unit_qty)}`)
              },
              { where: { product_id: item.product_id, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
            );

            //--------------------------------- update batch stock -----------------------------------------
            // Update Batch Stock (decrease)
            await batchStockSchema.update(
              {
                qty: Sequelize.literal(`qty + ${Math.abs(item.qty)}`),
                unit_qty: Sequelize.literal(`unit_qty + ${Math.abs(item.unit_qty)}`)
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

        await purchaseOrderSchema.update(
          updatedData,  // Data to update
          {             // Options
            where: {
              id: req.body.po_id,
              retailer_id: req.retailerId,
              retail_outlet_id: req.retailOutletId,
            }
          }
        );

        if (req.body.save_as_draft == false) {

        }
        //---------------  steps end for delete purchase-order-details --------------------------------------------------------------//


      }


      if (req.body.save_as_draft == false) {

        let updatedTotalAmount = Number(totalDetails.total_amount || 0) - Number(PurchaseOrderInfo.total_amount || 0);
        if ([0, 2, 3].includes(req.body.payment_type)) {
          await retailDistributorSchema.update(// 1 : credit // 0 : cash
            {
              return_payment_amount: Sequelize.literal(`return_payment_amount + ${[0, 2, 3].includes(PurchaseOrderInfo.payment_type) ? updatedTotalAmount : updatedTotalAmount}`),
              return_pending_amount: Sequelize.literal(`return_pending_amount + ${[0, 2, 3].includes(PurchaseOrderInfo.payment_type) ? 0 : (-1) * (PurchaseOrderInfo.total_amount)}`),
              return_pending_count: Sequelize.literal(`return_pending_count + ${[0, 2, 3].includes(PurchaseOrderInfo.payment_type) ? 0 : -1}`),
            },
            { where: { distributor_id: req.body.distributor_id, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
          );
        } else {
          await retailDistributorSchema.update(// 1 : credit // 0 : cash
            {
              return_payment_amount: Sequelize.literal(`return_payment_amount + ${[0, 2, 3].includes(PurchaseOrderInfo.payment_type) ? updatedTotalAmount : updatedTotalAmount}`),
              return_pending_amount: Sequelize.literal(`return_pending_amount + ${[0, 2, 3].includes(PurchaseOrderInfo.payment_type) ? totalDetails.total_amount : updatedTotalAmount}`),
              return_pending_count: Sequelize.literal(`return_pending_count + ${[0, 2, 3].includes(PurchaseOrderInfo.payment_type) ? 1 : 0}`),
            },
            { where: { distributor_id: req.body.distributor_id, retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId } }
          );
        }
      }


      //update save as draft ------------------------------
      if (req.body.save_as_draft == false) {
        await purchaseOrderSchema.update({ save_as_draft: req.body.save_as_draft, payment_type: req.body.payment_type }, {
          where: {
            id: req.body.po_id,
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            [Op.or]: {
              save_as_draft: req.body.save_as_draft,
              payment_type: req.body.payment_type
            }
          }
        });

        await purchaseOrderDetailSchema.update({ save_as_draft: req.body.save_as_draft }, {
          where: {
            po_id: req.body.po_id,
            retailer_id: req.retailerId,
            retail_outlet_id: req.retailOutletId,
            save_as_draft: true
          }
        });
      }
      //---------------------------------
      return res.status(200).send({ success: 1, message: "Purchase Return Updated Successfully" });
    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  returnDetails: async (req, res) => {
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
      let purchaseModel = await models.puchaseSchema(req.tableUid);

      let purchaseOrder = await purchaseModel.purchaseOrderModels.findAll({
        where: {
          id: req.params.id,
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId
        },
        include: [
          {
            model: models.DistributorsModel,
            attributes: ['id', 'name', 'address', 'phone'],
            as: 'distributors',
            raw: true,
            nest: true
          },
          {
            model: purchaseModel.retailDistributorModels,
            where: { retailer_id: req.retailerId, retail_outlet_id: req.retailOutletId },
            // attributes: ['order_count', 'pending_count', 'payment_amount', 'pending_amount'],
            as: 'retail_distributor',
            required: false,
            raw: true,
            nest: true
          }
        ],
        raw: true,
        nest: true
      })
      let purchaseOrderDetails = await purchaseModel.purchaseOrderDetailModels.findAll({

        where: {
          po_id: req.params.id,
          retailer_id: req.retailerId,
          retail_outlet_id: req.retailOutletId
        },
        include: [
          {
            model: models.productsModel,
            attributes: ['id', 'name', 'category', 'uom', 'content', 'unit_size'],
            as: 'products',
            raw: true,
            nest: true
          },
          {
            model: purchaseModel.retailBatchModels,
            attributes: ['id', 'batch_no', 'mrp', 'exp_date'],
            as: 'product_batches',
            include: [
              {
                model: purchaseModel.batchStockModels,
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
          // {
          //   model: purchaseModel.purchaseOrderModels,
          //   attributes: ['id', 'margin_percentage', 'total_amount', 'total_qty'],
          //   as: 'purchase_order',
          //   raw: true,
          //   nest: true
          // },
          {
            model: models.DistributorsModel,
            attributes: ['id', 'name'],
            as: 'distributors',
            raw: true,
            nest: true
          },

        ],
        nest: true,
        raw: true
      });

      console.log(purchaseOrderDetails, "detailssssssssssssssssssssss")
      return res.status(200).send({
        success: 1,
        data: {
          purchaseOrder: purchaseOrder,
          puchaseOrderDetails: purchaseOrderDetails
        }
      })

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  },
  QrCodeDetail: async (req, res) => {
    try {
      //------------------------- validation ------------------------
      let validator = new v(req.params, {
        qrCode: "required",
      });

      let matched = await validator.check();
      if (!matched) {
        let validatorError = await controllers.parseValidate(validator.errors);
        return res.status(200).send({ success: 0, message: validatorError });
      }
      //gte decode code
      let { TUID, code, qrCode } = await controllers.commonController.getDecodeQrCodes(req.params.qrCode);
      let purchaseModel = await models.puchaseSchema(TUID);

      let purchaseOrder = await purchaseModel.purchaseOrderModels.findOne({
        where: {
          qr_code: qrCode
        },
        include: [
          {
            model: models.DistributorsModel,
            attributes: ['id', 'name'],
            as: 'distributors',
            raw: true,
            nest: true
          }
        ],
        raw: true,
        nest: true
      })
      let purchaseOrderDetails = await purchaseModel.purchaseOrderDetailModels.findAll({
        where: {
          po_id: purchaseOrder.id,
          retailer_id: purchaseOrder.retailer_id,
          retail_outlet_id: purchaseOrder.retail_outlet_id
        },
        include: [
          {
            model: models.productsModel,
            attributes: ['id', 'name', 'category', 'uom', 'content', 'unit_size', 'image'],
            as: 'products',
            raw: true,
            nest: true
          },
          {
            model: purchaseModel.retailBatchModels,
            attributes: ['id', 'batch_no', 'mrp', 'exp_date'],
            as: 'product_batches',
            raw: true,
            nest: true
          },
          // {
          //   model: purchaseModel.purchaseOrderModels,
          //   attributes: ['id', 'margin_percentage', 'total_amount', 'total_qty'],
          //   as: 'purchase_order',
          //   raw: true,
          //   nest: true
          // },
          {
            model: models.DistributorsModel,
            attributes: ['id', 'name'],
            as: 'distributors',
            raw: true,
            nest: true
          },

        ],
        nest: true,
        raw: true
      });

      console.log(purchaseOrderDetails, "detailssssssssssssssssssssss")
      return res.status(200).send({
        success: 1,
        data: {
          purchaseOrder: purchaseOrder,
          puchaseOrderDetails: purchaseOrderDetails
        }
      })

    } catch (error) {
      console.error(error);
      controllers.logger.error(req, error.message);
      return res.status(500).send({
        message: error.toString()
      });
    }
  }
};

module.exports = purchaseOrderController;



