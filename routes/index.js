const fileUpload = require("express-fileupload");
const salesOrderRoute = require("./v1/sales-return.route");
const salesReturnRoute = require("./v1/sales-return.route");

module.exports = (app) => {
  app.use(
    fileUpload({
      limits: 5000000,
    })
  );

  //
  const login = require("../controllers/login");
  const common = require("../controllers/common");
  const ScannerDevice = require('../controllers/scanner');
  const { Sequelize, DataTypes } = require('sequelize');


  const locationRoute = require("./v1/location.route");
  const companyRoute = require("./v1/company.route");

  const deviceRoute = require("./v1/device.route");
  const commonRoute = require("./v1/common.route");
  const businessuserRoute = require('./v1/businessuser.route');
  const productRoute = require('./v1/product.route');
  const productionOrderRoute = require('./v1/production-order-route')
  const desktopRoute = require("./v1/desktop.route");
  const reportRoute = require("./v1/reports.route");
  const productBatchRoute = require("./v1/product-batch.route");
  const pwaRoutes = require("./v1/pwa.route");
  const customerRoute = require("./v1/customer.route");
  const syncRoute = require("./v1/sync.route");
  const ProductRangeRoute = require("./v1/product-range.route");
  const ProductGroupRoute = require("./v1/product-group.route");
  const ProductCategoryRoute = require("./v1/product-category.route");
  const webRoute = require("./v1/web.route");
  const RewardRoute = require("./v1/reward.route");
  const DashboardRoute = require("./v1/dashboard.route");
  const DistributorRoute = require("./v1/distributor.route");
  const scanRoute = require("./v1/scan.route");
  const paymentRoute = require("./v1/payment.route");


  //E-belling Routes
  const retailersRoute = require("./v1/retailers.route");
  const retailerOutletRoute = require("./v1/retailer-outlets.route");
  const plansRoute = require("./v1/plans.route");
  const featuresRoute = require("./v1/features.route");
  const retailCustomerRoute = require("./v1/retail_customer.route");
  const doctorRoute = require("./v1/doctor.route")
  const rackLocationRoute = require("./v1/rack-location-discount.route");
  const qrCodesRoutes = require('./v1/qr-codes-route');
  const migrationRoute = require("./v1/migrration.route");


  const consumer = require("../controllers/consumerapi/consumer");
  const industry = require("../controllers/industryapi/industry")
  const location = require("../controllers/locations")
  const retailerStockRoute = require("./v1/retailer-stock.route");
  const purchaseOrderRoute = require("./v1/purchase-order.route");
  const salesManagementRoute = require("./v1/sales-management.route");

  const bankRoute = require("./v1/bank-details.route")

  const rateLimit = require("express-rate-limit");
  const loginRateLimiter = rateLimit({
    max: 5
    , windowMS: 1000 * 60 * 10
    , handler: (req, res, next, options) => {
      return res.send({
        success: 0
        , message: options.message
      })
    }
  });

  //Portal Route Registrations
  let companyUrl = "company";
  let desktopURL = "d";
  let trustTrackURL = "trusttrack";
  let pwaURL = 'pwa';
  let scanningURL = 'scan';

  // Logins
  app.post("/signup/", login.signup);
  app.post("/companyLogin/", login.companyLogin);
  app.post("/mappingLogin/", login.mappingAppLogin);
  app.post("/scaninglogin/", login.scanningLogin);
  app.post("/trusttrackLogin/", login.trustTrackLogin);
  app.get('/getUserLocationInfo', login.getUserocationInfo);
  app.get('/check/customer/exists', login.checkCustomerExists);
  app.post('/send-otp', login.sendOtp);
  app.post("/verify/signup", login.verifySignupDetails);
  app.post("/verify-otp", login.verifyOtp);
  // app.get("/getCustomerDetail", login.getCustomerDetail);
  app.put("/update-customer", login.updateCustomerDetails);
  app.get(`/user-email-verification`, login.emailVerification)
  app.post(`/send-reset-password-link`, loginRateLimiter, login.verifyUserForForgetPassword);
  app.post(`/save-new-password`, login.saveNewPassword);


  //migration
  // Request Validators :: Auth Middlewares - This will check if the token is valid
  app.all('/company/*', [require('./../middleware/validateRequest')]);
  app.all('/mapp/*', [require('./../middleware/validateMappingRequest')])
  app.all('/MLAPI/*', [require('./../middleware/validateERPRequest')]);
  app.all('/erp/*', [require('./../middleware/validateERPRequest')]);
  app.all("/trusttrack/*", [require("./../middleware/validateTrustTrackRequest")]);
  app.all("/sync/*", [require("./../middleware/validateSyncRequest")]);
  app.all('/user/*', [require('./../middleware/consumerRequestValidate')]);
  app.all('/pwa/*', [require('./../middleware/consumerRequestValidate')]);
  app.all(`/${scanningURL}/*`, [require('../middleware/validateMappingRequest')])
  // ===============================================================================

  // app.post("/addCompany", industry.addCompany);
  // app.get("/getListOfCompany", industry.getCompanyList);
  // app.post("/addLocation", location.add);
  // app.get("/getListOfLocation", location.getLocations);


  app.get("/company/consumer-list", consumer.getConsumers);
  app.post("/company/register-consumer", consumer.registerConsumer);
  app.get("/company/consumer-details", consumer.getConsumerById);
  app.post("/company/add-secondary-firm", consumer.addSecondaryFirmsById);
  app.post("/company/add-secondary-mobile", consumer.addSecondaryNumbersById);
  app.delete("/company/delete-secondary-firm", consumer.deleteSecondaryFirm);
  app.delete("/company/delete-secondary-mobile", consumer.deleteSecondaryMobile);
  app.post("/company/bulk-add-cp/excel", consumer.bulkChannelPartnerAdd);
  app.post("/company/bulk-add-farmer/excel", consumer.bulkFarmerAdd);
  app.put("/company/update-consumer", consumer.editConsumer);
  app.delete("/company/delete-consumer", consumer.deleteConsumer);
  app.get("/company/get-consumer-scanned-history", consumer.getScannedHistory)

  app.use(`/${companyUrl}/device`, deviceRoute);
  app.use(`/${companyUrl}/common`, commonRoute);
  app.use(`/${companyUrl}/businessuser`, businessuserRoute);
  app.use(`/${companyUrl}/product`, productRoute);
  app.use(`/${companyUrl}/production-order`, productionOrderRoute);
  app.use(`/${companyUrl}/stockReport/`, reportRoute);
  app.use(`/${companyUrl}/product-batch/`, productBatchRoute);
  app.use(`/${companyUrl}/transaction-report/`, reportRoute);
  app.use(`/${companyUrl}/customer`, customerRoute);
  app.use(`/${companyUrl}/erp-sync-report/`, reportRoute);
  app.use(`/${companyUrl}/inventory-report`, reportRoute);
  app.use(`/${companyUrl}/range`, ProductRangeRoute);
  app.use(`/${companyUrl}/group`, ProductGroupRoute);
  app.use(`/${companyUrl}/category`, ProductCategoryRoute);
  app.use(`/${companyUrl}/reward`, RewardRoute);
  app.use(`/${companyUrl}/dashboard`, DashboardRoute);
  // =================================================================================
  // ====================E-billing====================================================
  app.use(`/${companyUrl}/distributor`, DistributorRoute);
  app.use(`/${companyUrl}/retailers`, retailersRoute);
  app.use(`/${companyUrl}/retailer-outlets`, retailerOutletRoute);
  app.use(`/${companyUrl}/retailer-stock`, retailerStockRoute);
  app.use(`/${companyUrl}/location`, locationRoute);
  app.use(`/${companyUrl}`, companyRoute);
  app.use(`/qr-code`, qrCodesRoutes);

  app.use(`/${companyUrl}/plans`, plansRoute);
  app.use(`/${companyUrl}/features`, featuresRoute);
  app.use(`/${companyUrl}/retail-customer`, retailCustomerRoute);
  app.use(`/${companyUrl}/purchase-order`, purchaseOrderRoute);
  app.use(`/${companyUrl}/purchase-return`, purchaseOrderRoute);
  app.use(`/${companyUrl}/doctor`, doctorRoute);
  app.use(`/${companyUrl}/rack`, rackLocationRoute);
  app.use(`/${companyUrl}/sales-return`, salesReturnRoute);
  app.use(`/${companyUrl}/sales`, salesManagementRoute);
  app.use(`/${companyUrl}/payment`, paymentRoute);
  app.use(`/migration`, migrationRoute);
  app.use(`/${companyUrl}/bank-details`, bankRoute);

  // =================================================================================  

  app.use(`/common/`, commonRoute);
  // =================================================================================
  app.use(`/${desktopURL}`, desktopRoute);
  app.use(`/${pwaURL}`, pwaRoutes);
  app.use(`/${scanningURL}`, scanRoute);
  // =================================================================================
  app.use(`/sync`, syncRoute);

  //==================================================================================
  app.use(`/web`, webRoute)


};
