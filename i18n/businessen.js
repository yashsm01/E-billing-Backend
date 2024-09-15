module.exports = new en();

function en() {
    this.invalidLogin = 'Invalid Login Details';
    this.invalidAccess = 'Invalid Login Access';

    this.receivedNewConsignment = 'You have received new consignment please checkout.';
    this.acceptedNewConsignment = 'I have accepted new consignment.';

    this.customerIdrequired = 'Customer Id is required';
    this.noroletype = "No Role type found for this company";
    this.roleIdrequired = "Role Id is required";
    this.noUserList = "No User is assigned to this role";
    this.consignmentErr = 'Consignment creation getting some error, Please try again later';
    this.shippersuccess = "Product added successfully";
    this.shippererr = "Shipper adding getting some error, Please scan again";
    this.shipperduplicate = "Shipper code is already scaned";
    this.productduplicate = "Product code is already scaned";
    this.shipperLimitExceed = "You have already scanned shipper as much you had define ";
    this.qrcodenotexits = "Sorry Qr code is not belongs to trusttags, Please scan trusttags qr code";
    this.consignmentUpdate = "Consignment Updated Successfully";
    this.consignmentDelete = "Consignment delete successfully"
    this.wrongConsignment = "You have selected worng consignment";
    this.wrongProduct = "You have selected worng Product For this consignment";
    this.consignmentNotFound = "Sorry Consignment not found, Please try again later";
    this.caseDeletedSuccessfully = "Case deleted successfully";
    this.noCaseFound = "No case found!";
    this.NotAllocated = "Shipper Is not belongs to you now";
    this.shipperNotFound = 'Shipper does not found.';
    this.noaccess = "Sorry, You have no access to return the consignment";
    this.freeCodeForRemap = "QRcode is ready for remap now";
    this.showProducts = "Showing products";
    this.scanForReprint = "Successfully sent shipper QRcode for reprint";
    this.stockreconLog = 'Stock Reconciliation Process is not completed';
    this.noProduct = 'Product does not found.';
    this.StockLogsNotUpdate = "Stock Reconciliation log details update failed";
    this.StockLogsUpdate = "Stock Reconciliation log details updated successfully";
    

}