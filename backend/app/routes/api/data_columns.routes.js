const express = require("express");
const router = express.Router();
const DataColumns = require("webservice/data_columns.controller");

// search columns for history
router.get( "/data_columns/history", DataColumns.history);


// Export the express.Router() instance
module.exports = router;