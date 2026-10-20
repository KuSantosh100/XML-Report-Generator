const express = require("express");
const router = express.Router();
const executionController = require("webservice/execution.controller");

router.all("/execution*", auth.authenticateAPI);

/**
 * @api {post} /execution/test_case
 * @description api to execute the test case and invoke JENKINS API to get que number
**/
router.post('/execution/test_case', executionController.test_case);

/**
 * @api {post} /execution/test_case
 * @description api to execute the test case and invoke JENKINS API to get que number
**/
router.post('/execution/dry_run', executionController.dry_run);

/**
 * @api {post} /execution/exe_history
 * @description api to retrieve execution history
**/
router.post('/execution/exe_history', executionController.exe_history);

/**
 * @api {post} /execution/queno_execution
 * @description API used to invoke the JENKINS API to get build number,building status and result status
**/
router.post('/execution/execution_details', executionController.execution_details);

/**
 * @api {post} /execution/stop_execution 
 * @description API used to call the JENKINS API to stop the execution
**/
router.post( '/execution/stop_execution', executionController.stop_execution);

/**
 * @api {post} /execution/download_report 
 * @description API used to call the JENKINS API to download report and upload to s3 
**/
router.post('/execution/download_report', executionController.download_reports);

/**
 * @api {post} /execution/download_report 
 * @description API used to push the test steps to Validation Vault 
**/
router.post('/execution/raise_connector_request', executionController.raise_connector_request);

module.exports = router;
