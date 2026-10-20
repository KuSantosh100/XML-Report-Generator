const express = require("express");
const router = express.Router();
const settingsController = require("webservice/project_setting.controller");
const APIValidation = require("util/roleCheck")

router.all("/project_settings*", auth.authenticateAPI);

/**
 * @api {post} /project_settings/list-advance Advance Listing
*/
router.post( "/project_settings/list-advance", APIValidation.superAdmin, settingsController.listAdvance);

/**
 * @api {get} /project_settings/details/:id Details
*/
router.get( "/project_settings/details/:id", APIValidation.superAdmin, settingsController.settingsDetails);

/**
 * @api {post} /project_settings/insert Insert
*/
router.post( "/project_settings/insert", APIValidation.superAdmin, settingsController.insert);

/**
 * @api {post} /project_settings/update/:id Update
*/
router.post( "/project_settings/update/:id", APIValidation.superAdmin, settingsController.update);

/**
 * @api {post} /project_settings/delete/:id Delete
*/
router.post("/project_settings/delete/:id", APIValidation.superAdmin, settingsController.delete);

// Export the express.Router() instance
module.exports = router;