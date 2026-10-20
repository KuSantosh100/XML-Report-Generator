const express = require('express');
const router = express.Router();

const connectorController = require('webservice/connector.controller');                                         
const apiKeyAuth = require("../../apiKeyAuth");

router.all("/connector*", apiKeyAuth);

/**
 * @api {post} /connector/test_case 
 * Request to do upsert of the test case and test case steps
 */
router.post( '/connector/test_case', connectorController.handleTestCase);

/**
 * @api {post} /connector/test_case_execute 
 * Request to handle connector request for test case execution
 */
router.post( '/connector/test_case_execute', connectorController.handleExecution);

/**
 * @api {post} /connector/pre_execution_report 
 * Request to handle connector request for test case execution
 */
router.post( '/connector/pre_execution_report', connectorController.preExecutionReport);

/**
 * @api {post} /connector/execution_details 
 * Request to get test case execution details
 */
router.post('/connector/execution_details', connectorController.getExecutionDetails);

/**
 * @api {post} /connector/close_request 
 * Request to close the request
 */
router.post('/connector/close_request', connectorController.closeRequest);

/**
 * @route POST /connector/checkUser
 * @description Check if emaildID exists or is valid
 */
router.post('/connector/check_user', connectorController.checkEmail);

module.exports = router;