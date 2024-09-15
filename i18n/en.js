module.exports = new en();

function en() {

    this.invalidLogin = 'Please enter correct credentials.';

    this.internalError = "Ops! someting went wrong!",
    this.userAlreadyExists = "User is already exists!"
    this.userPasswordExpired = "You cannot login as your password is expired, please update by forgot password!"
    
    this.unauthorizedAccess = 'Unauthorized Access!'
    this.emailNotVerified = "Email address is not verified!"

    //Company Messages
    this.noCompany = 'Company does not found.';
    this.companyupdate = "Company details updated successfully.";
    this.companyNotUpdate = "Company details update failed.";
    this.companydelete = "Company deleted successfully.";
    this.companyrequired = "Company ID is required.";
    this.companyImageNotValid = "Company image is not valid.";
    this.companyImageRequired = "Company image is required.";
    this.companyExist = 'Email is already exist.';

    //Production Unit Messages
    this.puNotCreated = "Product Unit creation getting some error please try again later";
    this.noProductionUnit =  'No Production Unit Data Found';
    this.purequired = "Production Unit ID Is Required";
    this.pudelete = "Production Unit Deleted Successfully";
    this.puNotUpdate = "Production Not Update Successfuly";
    this.pupdate = "Production Unit Update Successfully";

    //Brand Messages
    this.noBrand = 'Brand does not found.';
    this.brandupdate = "Brand details updated successfully.";
    this.brandNotUpdate = "Brand details update failed.";
    this.branddelete = "Brand deleted successfully.";
    this.brandrequired = "Brand ID is required.";
    this.brandImageNotValid = "Brand image is not valid.";
    this.brandNotDelete = "Brand delete failed.";
    this.brandImageRequired = "Brand image is required.";
    this.brandExist = 'Brand is already exist.';

    //Production Line Messages
    this.productionLineDelete = "Production-Line deleted successfully.";
    this.noproductionLine = "Production-Line does not found.";
    this.productionLineRequired = "Production-Line ID is required.";
    this.productionLineNotUpdate = 'Production-Line details update failed.';
    this.productionLineUpdate = 'Production-Line details updated successfully.';

    //Master Category Messages
    this.noCategory = "Category does not found.";
    this.categoryDelete = "Category deleted successfully.";
    this.categoryNotUpdate = "Category details update failed.";
    this.categoryUpdate = "Category details updated successfully.";
    this.categoryExist = 'Category is already exist.';

    /*Variants Messages*/
    this.variantAdd = 'Variant added successfully.';
    this.noVariant = 'Variant does not found.';
    this.deleteVariant = "Variant deleted successfully.";
    this.variantUpdate = "Variant details updated successfully.";
    this.variantExist = 'Variant is already exist.';

    /*Generic messages*/
    this.sometingWentWrong = "Something went wrong!";

    /*Duration messages*/
    this.durationAdd = "Duration added successfully.";
    this.noDuration = "Duration does not found.";
    this.deleteDuration = "Duration deleted successfully.";
    this.durationUpdate = "Duration details updated successfully.";
    
    
    /*Product Batch message*/
    this.productBatchAdd = "Product Batch added successfully.";
    this.noProductBatch = "Product Batch does not found.";
    this.deleteProductBatchMsg = "Product Batch deleted successfully.";
    this.productBatchUpdate = "Product Batch details updated successfully.";
    this.noQrcodeFound = "QR code does not found.";
    this.prodyctBatchRequired = "Category ID is required.";
    this.productBatchRequired = "Product Batch ID is required.";
    this.batchNoGenerateFailed = "Generate batch-no failed.";
    this.batchMappingFailed = "Batch mapping failed.";
    this.noBatchFound = "No Batch Found";

    /*eWarranty Message*/
    this.noewarranty = "eWarranty does not found.";
    this.ewarrantyAccepted = "eWarranty accepted successfully.";
    this.ewarrantyRejected = "eWarranty rejected successfully.";

    //Reward Messages
    this.noReward = 'Reward does not found.';
    this.rewardUpdate = "Reward details updated successfully.";
    this.rewardNotUpdate = "Reward details update failed.";
    this.rewardDelete = "Reward deleted successfully.";
    this.rewardNotDelete = "Reward delete failed.";
    this.rewardRequired = "Reward ID is required.";
    this.rewardImageNotValid = "Reward image is not valid.";
    this.rewardImageRequired = "Reward image is required.";

    //Reward History Messages
    this.noRewardHistory = 'Reward History does not found.';
    this.rewardHistoryDelete = "Reward History deleted successfully.";
    this.rewardHistoryNotDelete = "Reward History delete failed.";
    this.rewardHistoryRequired = "Reward History ID is required.";

    //Category Messages
    this.noCategory = 'Category does not found.';
    this.categoryUpdate = "Category details updated successfully.";
    this.categoryNotUpdate = "Category details update failed.";
    this.categoryDelete = "Category deleted successfully.";
    this.categoryNotDelete = "Category delete failed.";
    this.categoryRequired = "Category ID is required.";

    //Varient Messages
    this.noVarient = 'Varient does not found.';
    this.varientUpdate = "Varient details updated successfully.";
    this.varientNotUpdate = "Varient details update failed.";
    this.varientDelete = "Varient deleted successfully.";
    this.varientNotDelete = "Varient delete failed.";
    this.varientRequired = "Varient ID is required.";

    /*Size messages*/
    this.optionAdd = "Size added successfully.";
    this.noOption = "Size does not found.";
    this.deleteOption = "Size deleted successfully.";
    this.optionUpdate = "Size details updated successfully.";
    this.optionRequired = "Size ID is required.";
    this.optionNotUpdate = "Size details update failed.";
    this.optionNotDelete = "Size delete failed.";
    this.optionExist = 'Size is already exist.';

    //Plant Messages
    this.plantNotCreated = "Plant does not created.";
    this.noPlant = 'Plant does not found.';
    this.plantRequired = "Plant ID is required.";
    this.plantDelete = "Plant deleted successfully.";
    this.plantNotUpdate = "Plant details update failed.";
    this.plantUpdate = "Plant details updated successfully.";
    this.plantNotDelete = "Plant delete failed.";
    this.plantExist = 'Plant is already exist.';

    //Line Messages
    this.lineNotCreated = "Line does not created.";
    this.noLine = 'Line does not found.';
    this.lineRequired = "Line ID is required.";
    this.lineDelete = "Line deleted successfully.";
    this.lineNotUpdate = "Line details update failed.";
    this.lineUpdate = "Line details updated successfully.";
    this.lineExist = 'Line is already exist.';
    
    //Packaging Messages
    this.noPackaging = 'Packaging does not found.';
    this.packagingUpdate = "Packaging details updated successfully.";
    this.packagingNotUpdate = "Packaging details update failed.";
    this.packagingDelete = "Packaging deleted successfully.";
    this.packagingNotDelete = "Packaging delete failed.";
    this.packagingRequired = "Packaging ID is required.";
    this.packagingExist = 'Packaging is already exist.';

    /*Product-SKU message*/
    this.noProduct = 'Product does not found.';
    this.productUpdate = "Product details updated successfully.";
    this.productNotUpdate = "Product details update failed.";
    this.productDelete = "Product deleted successfully.";
    this.productRequired = "Product ID is required.";
    this.productImageNotValid = "Product image is not valid.";
    this.productNotDelete = "Product delete failed.";
    this.productImageRequired = "Product image is required.";
    this.skuGenerateFailed = 'Generate SKU failed.';
    this.skuidNotfound = "sku not found";

    /*Qrcode role message*/
    this.qrcodeperRoleError = "Total Qrcode should be multiple of Qrcode per role";
    this.qrcodeRoleCreated = "Qrcode Roles created successfully.";
    this.qrcodeRoleFailed = "Qrcode Roles generation failed.";
    this.qrcodeFailed = "Qrcode generation failed.";

    //ShipperQrCode Messages
    this.noShipperQrCode = 'Shipper QR Code does not found.';
    this.shipperQrCodeUpdate = "Shipper QR Code details updated successfully.";
    this.shipperQrCodeNotUpdate = "Shipper QR Code details update failed.";
    this.shipperQrCodeDelete = "Shipper QR Code deleted successfully.";
    this.shipperQrCodeNotDelete = "Shipper QR Code delete failed.";
    this.shipperQrCodeRequired = "Shipper QR Code ID is required.";

    //Employee Messages
    this.noEmployee = 'Employee does not found.';
    this.employeeLoginSuccessful = 'Employee loginn successfully.'
    this.employeeUpdate = "Employee details updated successfully.";
    this.employeeNotUpdate = "Employee details update failed.";
    this.employeeDelete = "Employee deleted successfully.";
    this.employeeRequired = "Employee ID is required.";
    this.employeeNotDelete = "Employee delete failed.";
    this.employeeExist = 'Employee is already exist.';

    //Company Role Messages
    this.noCompanyRole = 'Company user role does not found.';
    this.companyRoleUpdate = "Company user role details updated successfully.";
    this.companyRoleNotUpdate = "Company user role details update failed.";
    this.companyRoleDelete = "Company user role deleted successfully.";
    this.companyRoleNotDelete = "Company user role delete failed.";
    this.companyRoleRequired = "Company user role ID is required.";
    this.companyRoleExist = 'Company user role is already exist.';

    //Company User Messages
    this.noCompanyUser = 'Company User does not found.';
    this.companyUserUpdate = "Company User details updated successfully.";
    this.companyUserNotUpdate = "Company User details update failed.";
    this.companyUserDelete = "Company User deleted successfully.";
    this.companyUserNotDelete = "Company User delete failed.";
    this.companyUserRequired = "Company User ID is required.";
    this.companyUserExist = 'Company User is already exist.';

    //Packages Scan Logs Messages
    this.noPackagesLogs = 'Packages Log does not found.';
    this.packagesLogsCreateFailed = "Packages Log does not created.";
    this.packagesLogsUpdate = "Packages Log details updated successfully.";
    this.packagesLogsNotUpdate = "Packages Log details update failed.";
    this.packagesLogsIncompleteShipper = "Shipper is incomplete.";
    this.packagesLogsExist = 'Packages Log is already exist.';

    //Master Product Detail Messages
    this.noProductDetail = "Product Detail does not found.";
    this.productDetailDelete = "Product Detail deleted successfully.";
    this.productDetailNotDelete = "Product Detail delete failed.";
    this.productDetailNotUpdate = "Product Detail details update failed.";
    this.productDetailUpdate = "Product Detail details updated successfully.";
    this.productDetailExist = 'Product Detail is already exist.';
    this.productDetailRequired = 'Product Detail ID is required.';

    //Business Role Messages
    this.noBusinessRole = 'User role does not found.';
    this.businessRoleUpdate = "User role details updated successfully.";
    this.businessRoleNotUpdate = "User role details update failed.";
    this.businessRoleDelete = "User role deleted successfully.";
    this.businessRoleNotDelete = "User role delete failed.";
    this.businessRoleRequired = "User role ID is required.";
    this.businessRoleExist = 'User role is already exist.';

    //User Messages
    this.noBusinessUser = 'User does not found.';
    this.businessUserUpdate = "User details updated successfully.";
    this.businessUserNotUpdate = "User details update failed.";
    this.businessUserDelete = "User deleted successfully.";
    this.businessUserNotDelete = "User delete failed.";
    this.businessUserRequired = "User ID is required.";
    this.businessUserExist = 'User is already exist.';

    //scaning Packaging QrCode Messages
    this.qrCodeNotExist = 'This Qr Code does not belongs to TrustTags.';
    this.packagingBatchAllocate = 'Packaging Batch Allocated';
    this.selectedbatchNotDefine = 'The Scanned sleeve code is not allocated to this batch';
    this.packagingBatchNotAllocate = 'Packaging Batch Not Allocated';
    this.packagingBatchAlreadyAllocated = 'Packaging Batch Already Allocated';
    this.packagingBatchAllocationRemove = 'Packaging Batch Allocation Removed';
    this.packagingBatchAllocationNotRemove = 'Packaging Batch Allocation Not Removed';
    this.packagingBatchAllocationCantBeRemove = 'Packaging Batch Allocation Can not Be Remove Because shipper is already allocated';
    this.packagingShipperNotAllocate = 'Packaging Shipper Not Allocated';
    this.packagingQrCodeAlreadyScan = 'Packaging QrCode Already Scanned';
    this.packagingQrCodeScanned = 'Packaging QrCode Scanned';
    this.packagingQrCodeNotScanned = 'Packaging QrCode Not Scanned';
    this.packagingQrCodeUnScanned = 'Packaging QrCode UnScanned';
    this.packagingQrCodeNotUnScanned = 'Packaging QrCode Not UnScanned';

    //scaning Shipper QrCode Messages
    this.shipperBatchAllocate = 'Shipper Batch Allocated';
    this.shipperBatchNotAllocate = 'Shipper Batch Not Allocated';
    this.shipperBatchAlreadyAllocated = 'Shipper Batch Already Allocated';
    this.shipperNotFound = 'Shipper does not found.';
    this.shipperIncomplete = 'Not enough packages added into shipper.';
    this.shipperOverflow = 'Shipper overflow.';
    this.noShipperIncomplete = 'Incomplete shipper does not found.';

    this.shipperAlreadyScan = 'Shipper QrCode already scanned.';
    this.shipperQrCodeScanned = 'Shipper QrCode scanned.';
    this.shipperQrCodeNotScanned = 'Shipper QrCode scanning failed.';
    this.shipperNotScanned = 'Shipper QrCode Not scanned.';

    //Trusted Qrcode Parent Messages
    this.noTrustedQrcodeParent = 'Trusted Qrcode Parent does not found.';
    this.trustedQrcodeParentRequired = 'Trusted Qrcode Parent ID is required.';

    //adminRoll Messages
    this.rollDelete = 'Admin Roll deleted successfully';
    this.moduleDelete = 'Admin Module deleted successfully';
    this.permissionDelete = 'Permission deleted successfully';
    this.adminUserDelete = 'Admin User deleted successfully';

    this.rollRequired = 'Admin Roll is required';
    this.ModuleRequired = 'Admin Module is required';
    this.permissionRequired = 'Admin permission is required';
    this.adminUserRequired = 'Admin User is required';

    this.noRoll = 'roll does not found';
    this.noModule = 'module dose not found';
    this.noPermission = 'permission dose not found';
    this.noUser = 'Admin User dose not found';

    this.rollUpdate = 'Roll Detail updated successfully';
    this.moduleUpdate = 'Module detail updated successfully';
    this.permissionUpdate = 'permission detail updated successfully';
    this.userUpdate = 'User detail updated successfully'

    this.rollNotUpdate = 'Roll Detail update failed';
    this.moduleNotUpdate = 'Module Detail update failed';
    this.permissionNotUpdate = 'Permission detail not update';
    this.userNotUpdate = 'User detail not update'

    this.rollExist = 'Roll is already exist.';
    this.moduleExist ='Module is already exist';
    this.permissionExist = 'Permission is already exist';
    this.AdminUserExist = 'Admin user is already exist';

    this.invocieUpdate = "Invocie No. Update successfully";
    this.invoiceAdded = "Invoice added successfully";
    this.invoiceError = "Invoice Have some missing data,Please try again";

    this.requiredExcelFile = 'File must be excel file.';
    this.noRowsInExcel = 'Data not available in excel';


    // mapping qa panel messages

    this.changeBatch = 'Successfully batch changed.';
    this.batchNotUpdated = 'Batch not updated.';


    this.optionValueInvalid = 'Option value is not valid';
    this.shortQrCodeNotFound = 'Short QR code not found!'
    this.longQrCodeNotFound = 'Long QR code not found!';
    this.batchNotFound = 'Batch not found!';
    this.shipperNotFound = 'Shipper not found!';
    this.consignmentNotFound = 'Consignment not found!';

    this.stockNotFound = 'Stock not found!';
    this.stockRecalled = 'Product has been recalled by VLCC please return to store from where you purchased!'

    this.CFANotFound = 'CFA not found!'

    this.unauthorizedAccess = 'Unauthorized Access!'
}