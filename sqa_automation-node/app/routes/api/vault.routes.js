const express = require("express");
const router = express.Router();
const vaultController = require("webservice/vault.controller");
const APIValidation = require("util/roleCheck");

router.all("/vault*", auth.authenticateAPI);

//List All Execution Vaults
router.post( "/vault/list-advance", auth.authenticateAPI, APIValidation.validRole, vaultController.listAdvance);

//Get vault customer provisioning fields list Array
// router.get( "/vault/fields/:org_code/:type", auth.authenticateAPI, APIValidation.validRole, vaultController.getFields);
router.get( "/vault/fields", auth.authenticateAPI, APIValidation.validRole, vaultController.getFields);

//Insert
router.post( "/vault/insert", auth.authenticateAPI, APIValidation.validRole, vaultController.insert);

//List of All Vault Not in USE
//router.get( "api.vault.list", "/vault/list", APIValidation.validRole, vaultController.vaults);

router.get( "/vault/details/:id", auth.authenticateAPI, APIValidation.validRole, vaultController.vaultsDetails);

//Update
router.post( "/vault/update/:id", auth.authenticateAPI, APIValidation.validRole, vaultController.update);

//Delete
router.post(  "/vault/delete/:id", auth.authenticateAPI, vaultController.delete);

//Get All vaults for a particular Project
router.post(  "/vault/list/:project_code", auth.authenticateAPI, vaultController.vaultsByProject);

//Get Safety Rulesset
router.get( "/vault/safety/ruleset", auth.authenticateAPI, vaultController.getSafetyRuleSet);

router.get( "/vault/safety/testcases/:RuleSetID/:vaultID", auth.authenticateAPI, vaultController.getSafetyRuleTestCases);

//Get Safety Ruleset Keys
router.get( "/vault/safety/keys/:RuleSetID", auth.authenticateAPI,  vaultController.getSafetyRuleKeys);

router.get("/vault/safety/rulesettestdata/:vault_id/:RuleSetID/:tag_id", auth.authenticateAPI, vaultController.getSafetyRules );

//Update safty rule
router.post( "/vault/safety/rules/update/:vault_id/:RuleSetID/:tag_id", auth.authenticateAPI, vaultController.updateSafetyRules);

// Export the express.Router() instance
module.exports = router;