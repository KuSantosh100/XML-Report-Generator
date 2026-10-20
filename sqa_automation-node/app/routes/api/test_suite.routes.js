const express = require('express');
const router = express.Router();
const test_suiteController = require('webservice/test_suite.controller');
const APIValidation = require("util/roleCheck");

router.all("/test_suite*", auth.authenticateAPI);

router.get('/test_suite/listOne/:project_code', test_suiteController.listOne);


//Only superAdmin and orgAdmin can access this.
router.post('/test_suite/list-advance', APIValidation.validRole, test_suiteController.test_suiteList);

router.post('/test_suite/insert', APIValidation.validRole, test_suiteController.insert);

router.get('/test_suite/details/:id', APIValidation.validRole, test_suiteController.test_suiteDetails);

router.post('/test_suite/update/:id', APIValidation.validRole, test_suiteController.update);

router.post('/test_suite/delete', APIValidation.validRole, test_suiteController.delete);

router.get( '/test_suite/list', APIValidation.validRole, test_suiteController.test_suiteData);


// Export the express.Router() instance
module.exports = router;