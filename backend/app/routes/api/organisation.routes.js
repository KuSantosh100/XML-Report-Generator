const express = require("express");
const router = express.Router();
const APIValidation = require("util/roleCheck")

const organisationController = require("webservice/organisation.controller");

/**
 * @api {post} /organisation/list/pagination 
 * @description Advance Listing with pagination for Admin Org item landing page.
 */
router.post( '/organisation/list/pagination', auth.authenticateAPI, APIValidation.superAdmin, organisationController.orgDataPagi);
//router.post("api.organisation.list.pagination", '/organisation/list/pagination', organisationController.orgDataPagi);

/**
 * @api {get} /organisation/details/:id Organisation Detail
 * @description get a particular organisation detail which passed as param
 */
router.get('/organisation/details/:id', auth.authenticateAPI, APIValidation.superAdmin, organisationController.orgDetails);

/**
 * @api {post} /organisation/insert Organisation create
 * @description Inserts into organisations table.
 */
router.post('/organisation/insert', auth.authenticateAPI, APIValidation.superAdmin, organisationController.insert);

/**
 * @api {post} /organisation/update/:id Organisation update
 * @description updates the specific organisation which passed as param
*/
router.post( '/organisation/update/:id', APIValidation.superAdmin, organisationController.update);

/**
 * @api {post} /organisation/delete Organisation Delete
 * @description delete the organisation
 */
router.post('/organisation/delete', auth.authenticateAPI, APIValidation.superAdmin, organisationController.delete);

/**
 * @api {get} /organisation/list Organisation List
 */
router.get('/organisation/list', auth.authenticateAPI, APIValidation.orgList, organisationController.orgData);

module.exports = router;
