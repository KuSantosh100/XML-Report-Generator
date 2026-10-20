const express = require('express');
const router = express.Router();

const test_caseController = require('webservice/test_case.controller');
const APIValidation = require("util/roleCheck");

router.all("/test_case*", auth.authenticateAPI);

//Only superAdmin and orgAdmin can access this.
/**
 * @api {get} /test_case/list-advance Advance List
 */
router.post( '/test_case/list-advance', APIValidation.validRole, test_caseController.test_caseDataAdvance);

/**
 * @api {post} /test_case/insert create
*/
router.post( '/test_case/insert', APIValidation.validRole, test_caseController.insert);

/**
 * @api {post} /test_case/update/:id Update
*/
router.post( '/test_case/update/:id', APIValidation.validRole, test_caseController.update);

/**
 * @api {get} /test_case/details/:id Details
 */
router.get( '/test_case/details/:id', APIValidation.validRole, test_caseController.test_caseDetails);

/**
 * @api {post} /test_suite/delete Delete
 */
router.post( '/test_case/delete', APIValidation.validRole, test_caseController.delete);

/**
 * @api {get} '/test_case/listOne/:test_suite_code List By test_suite_code
 */
router.get( '/test_case/listOne/:test_suite_code', test_caseController.listOne);

module.exports = router;