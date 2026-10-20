class DataColumns {
  constructor() {}

  async history(req,res) {
        return res.status(200).send( {status: 200, data: [
          { "value": "test_case_id", "label": "Test Case Id", "inputType" : "text", "groupBy": "test_case", "isDefault": true },
          { "value": "test_case_name", "label": "Test Case Name", "inputType" : "text", "groupBy": "test_case", "isDefault": false },
          { "value": "vault_name", "label": "Vault", "inputType" : "text", "groupBy": "vault", "isDefault": false },
          { "value": "build_no", "label": "Build No", "inputType" : "number", "groupBy": null, "isDefault": true },
          { "value": "ccInfo", "label": "CC Info", "inputType" : "text", "groupBy": null, "isDefault": false },
          { "value": "runNo", "label": "Run No", "inputType" : "text", "groupBy": "ccInfo", "isDefault": false },
          { "value": "result_status", "label": "Status", "inputType" : "text", "groupBy": null, "isDefault": true },
          { "value": "execution_date", "label": "Execution Date", "inputType" : "dateTimeRange", "groupBy": null, "isDefault": true }
        ], message: "Data fetched successfully." });
  }

}

module.exports = new DataColumns();
