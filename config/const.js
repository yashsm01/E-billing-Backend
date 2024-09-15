module.exports = {
  afterInactivityTokenExpired: 180,
  loginFailed: {
    blockAfterUnit: 1,
    blockUnitType: "h", // h = hours, d = days, m = minutes
    blockAfterAttempt: 3,
    failedMessage: "Your account has been blocked for 1 hour!"
  },
  old_password_trail: 3,
  saltRound: [12, 14, 16],
  orderStatus: {
    1: "Created",
    2: "Outward In-Progress",
    3: "Outward Completed",
    4: "Invoice Generated",
    5: "Inward In-Progress",
    6: "Inward Completed",
    7: "Partial Completed",//"Short Cancelled"
    8: "Cancelled",
    // 9: "Submitted To ERP",
    10: "Invoice Cancelled"
  },

  adjustStatus: {
    1: "Uploaded",
    2: "Created",
    3: "Scan In-Progress",
    4: "Scan Completed",
    5: "Allocation Done",
    6: "Adjusted",
    7: "Allocation In-Progress"
  },
  adjustmentEmail: ['kapiltrusttags@gmail.com'],
  scanTolerance: 0.004,

  pwaUsers: {
    0: "Consumer",
    1: "Distributor",
    2: "Wholesaler",
    3: "Retailer"
  },
  esignStatus: {
    1: "Pending",
    2: "Apperoved",
    3: "Rejected"
  }
}