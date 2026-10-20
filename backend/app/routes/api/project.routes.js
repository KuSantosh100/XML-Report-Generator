const express = require('express');
const router = express.Router();
const projectController = require('webservice/project.controller');
const APIValidation = require("util/roleCheck")

router.all("/project*", auth.authenticateAPI);

/**
 * @api {get} /project/list Project List
 * @apiVersion 1.0.0
 * @apiGroup Project
 * @apiHeader x-access-token User's Access Token
 */
router.get( '/project/list', APIValidation.validRole, projectController.projectData);

/**
 * @api {post} /project/list-advance Advance Listing
 * @apiVersion 1.0.0
 * @apiGroup Project
 * @apiParam {string} page Page No
 * @apiParam {string} query For Search
 * @apiParam {string} sort_field For Sort
 * @apiParam {string} sort_order [desc / asc]
 * @apiParam {string} status [ Active / Inactive ]
 * @apiHeader x-access-token User's Access Token
  */
router.post('/project/list-advance', APIValidation.superAdmin, projectController.projectDataAdvance);

/**
 * @api {get} /project/details/:id Project Details
 * @apiVersion 1.0.0
 * @apiGroup Project
 * @apiHeader x-access-token User's Access Token
*/
router.get('/project/details/:id', APIValidation.superAdmin, projectController.projectDetails);

/**
 * @api {get} /project/list-by-org/:org_code Project List By Organization
 * @apiVersion 1.0.0
 * @apiGroup Project
 * @apiParam {string} org_code Organization Id in Params(required)
 * @apiHeader x-access-token User's Access Token
 */
router.get('/project/list-by-org/:org_code', APIValidation.validOrg, projectController.listOne);

/**
 * @api {post} /project/insert create
 * @apiVersion 1.0.0
 * @apiGroup Project
 * @apiParam {string} project_name Project Name(required)
 * @apiParam {ObjectId} org_code Organisation Id(required)
 * @apiParam {string} image Image (required)
 * @apiParam {string} type Type(required)
 * @apiHeader x-access-token User's Access Token
*/
router.post('/project/insert', APIValidation.superAdmin, projectController.insert);

/**
 * @api {post} /project/update/:id update
 * @apiVersion 1.0.0
 * @apiGroup Project
 * @apiParam {ObjectId} id project Id in Param(required)
 * @apiParam {string} project_name Project Name
 * @apiParam {ObjectId} org_code Organisation Id
 * @apiParam {string} image Image
 * @apiParam {string} type Type
 * @apiParam {string} page Page No
 * @apiParam {string} status [ Active / Inactive ]
 * @apiHeader x-access-token User's Access Token
*/
router.post('/project/update/:id', APIValidation.superAdmin, projectController.update);

/**
 * @api {post} /project/delete Project Delete
 * @apiVersion 1.0.0
 * @apiGroup Project
 * @apiParam {string} id Project Id(required)
 * @apiParam {string} page Page No
 * @apiHeader x-access-token User's Access Token
 */
router.post('/project/delete', APIValidation.superAdmin, projectController.delete);

router.get( '/project/project-types', APIValidation.superAdmin, projectController.getProjectTypes);

// Export the express.Router() instance
module.exports = router;