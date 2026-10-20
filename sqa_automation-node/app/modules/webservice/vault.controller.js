const vaultRepo = require("vault/repositories/vault.repository");
const projectRepo = require("project/repositories/project.repository");
const testDataRepo = require("test_case_data/repositories/test_case_data.repository");
const srsDataRepo = require("safety_vault/repositories/safety_vault.repository");
const stdRepo = require("safety_test_data/repositories/safety_test_data.repository");
const userRepo = require('user/repositories/user.repository');

const mongoose = require("mongoose");

class VaultController {
  constructor() {}

  async listAdvance(req,res) {
    try {
      let vault = await vaultRepo.getAll(req);
			if (!_.isEmpty(vault)) {
				res.status(200).send({ status: 200, data: vault, message: 'Vault data fetched successfully' });
			}
			else {
				res.status(201).send({ status: 201, data: [], message: 'Vault not available' });
			}
		}
		catch (error) {
			res.status(500).send({ status: 500, message: error.message });
		}
  }
  
  //No need of Org check.
	async getFields(req, res) {
		try {
			let vaultData = [];
			let data = null;
			if (!req.query.vault_id) {
				data = await testDataRepo.getCustomerTestKeys({
					project_type: req.query.project_type,
					org_code: new mongoose.Types.ObjectId(req.query.org_code)
				});
				vaultData = data.cust_keys
			} else {
				data = await vaultRepo.getVaultFields(new mongoose.Types.ObjectId(req.query.vault_id));
				vaultData = await formatAdditionalFields(data);
			}

			let addData = await testDataRepo.getAdditionalKeys({
				project_type: req.query.project_type,
				org_code: new mongoose.Types.ObjectId(req.query.org_code)
			});
			let formttedData = await formatAdditionalFields(addData);
			if (data) {
				res.status(200).send({ status: 200, data: vaultData, additionalFields: formttedData, message: "Data fetched successfully." });
			} else {
				res.status(201).send({ status: 201, data: [], message: 'Vault not available' });
			}
		} catch (e) {
			console.log("Error in VaultController.getFields: " + e);
			res.status(500).send({ status: 500, message: e.message });
		}
	}

  async insert(req, res) {
    try {
   //   console.log("req.body.project_code :" + req.body.project_code);
      if (!req.body.project_code || !req.body.vault_name) {
        res.status(201).send( { status: 201, data: {}, message: "project_code, vault_name is required." });
      } else if( req.user.role.role == "orgAdmin" && JSON.stringify(req.body.org_code) != JSON.stringify(req.user.org_code._id) ){
				res.status(201).send({ status: 201, data: "", message: 'Not Authorized' });
			} else {
        req.body.project_code = new mongoose.Types.ObjectId(req.body.project_code);
        req.body.org_code = new mongoose.Types.ObjectId(req.body.org_code);

        req.body.updated_by = req.user._id;

        const ProjectData = await projectRepo.getById(req.body.project_code);

        if (_.isEmpty(ProjectData)) {
          res.status(201).send( { status: 201, data: [], message: "Project not exist" });
        }else{
          let vaultsInfo = await vaultRepo.save(req.body);
          if (!_.isEmpty(vaultsInfo)) {
            res.status(200).send( {
              status: 200,
              data: vaultsInfo,
              message: "Project Vault successfully saved."
            });
          } else {
            res.status(201).send( { status: 201, data: [], message: "Something went wrong!" });
          }
        }

      }
    } catch (error) {
      console.log("Error in VaultController.insert: " + error);
			res.status(500).send({ status: 500, message: error.message });
    }
  }

  //NOT IN USE, if needed need to change code for Org validation
  // async vaults(req, res) {
  //   try {
  //     let vault = await vaultRepo.getAllByField({
  //       isDeleted: false
  //     });

  //     if (vault) {
  //       res.status(200).send( { status: 200, data: vault, message: "Data fetched successfully."
  //       });
  //     } else {
  //       res.status(201).send( { status: 201, data: [], message: "There are no data at this moment." });
  //     }
  //   } catch (e) {
  //     console.log("Error in vaults: " + e);
  //     res.status(500).send({ status: 500, message: error.message });
  //   }
  // }

	async vaultsDetails(req, res) {
		try {
			if (!mongoose.isValidObjectId(req.params.id)) {
				res.status(201).send({ status: 201, data: [], message: 'Not Valid Id' });
			} else {
				const vault = await vaultRepo.getById(new mongoose.Types.ObjectId(req.params.id));

				let vaultResp = {
					_id: vault._id,
					org_code: vault.org_code,
					project_type: vault.project_type,
					project_code: vault.project_code
				}

				if (!_.isEmpty(vault)) {
					if (req.user.role.role == "orgAdmin" && (JSON.stringify(vault.org_code) != JSON.stringify(req.user.org_code._id))) {
						res.status(201).send({ status: 201, data: [], message: 'Not Authorized.' });
					} else {
						res.status(200).send({ status: 200, data: vaultResp, message: 'Vault data fetched successfully' });
					}
				} else {
					res.status(201).send({ status: 201, data: [], message: 'No data found.' });
				}
			}
		} catch (e) {
			console.log("Error at vaultsDetails: " + e)
			return { status: 500, message: e.message };
		}
	}

  async update(req, res) {
    try {
      if (!mongoose.isValidObjectId(req.params.id)){
				res.status(201).send({ status: 201, data: [], message: 'Not valid ID' });
			}else{
        const vault = await vaultRepo.getById( new mongoose.Types.ObjectId(req.params.id));
  
        if (!_.isEmpty(vault)) {
					if(req.user.role.role == "orgAdmin" && (JSON.stringify(vault.org_code) != JSON.stringify(req.user.org_code._id)) ){
						res.status(201).send({ status: 201, data: "", message: 'Not authorized' });
					}else{

            req.body.updated_by = req.user._id;
            let vaultdata = await vaultRepo.updateById(req.body, new mongoose.Types.ObjectId(req.params.id));
						if (!_.isEmpty(vaultdata)) {
							res.status(200).send({ status: 200, data: vaultdata, message: "Vault data updated successfully" });
						} else {
							res.status(201).send({ status: 201, data: [], message: 'Something is wrong!' });
						}
					}
				}else {
					res.status(201).send({ status: 201, data: [], message: 'Vault details not available' });
				}
			}
    } catch (error) {
			res.status(500).send({ status: 500, message: error.message });
    }
  }

  async delete(req, res) {
    try {

      if (!mongoose.isValidObjectId(req.params.id)){
				res.status(201).send({ status: 201, data: [], message: 'Not Valid Id' });
			}else{
        const vault = await vaultRepo.getById( new mongoose.Types.ObjectId(req.params.id));
  
        if (!_.isEmpty(vault)) {
					if(req.user.role.role == "orgAdmin" && (JSON.stringify(vault.org_code) != JSON.stringify(req.user.org_code._id)) ){
						res.status(201).send({ status: 201, data: "", message: 'Not Authorized' });
					}else{
            req.body.updated_by = req.user._id;
            let delData = await vaultRepo.updateById({ isDeleted: true }, new mongoose.Types.ObjectId(req.params.id) );
      
            let vault = await vaultRepo.getAll(req);						
            if (!_.isEmpty(vault)) {
							res.status(200).send({ status: 200, data: vault, message: "Vault data deleted successfully" });
						} else {
							res.status(201).send({ status: 201, data: [], message: 'Something is wrong!' });
						}
					}
				}else {
					res.status(201).send({ status: 201, data: [], message: 'Vault details not available' });
				}
			}
    } catch (e) {
      return { status: 500, message: error.message };
    }
  }

  async vaultsByProject(req, res) {
    try {

      if (!mongoose.isValidObjectId(req.params.project_code)){
				res.status(201).send({ status: 201, data: [], message: 'Not Valid Id' });
			}else {

        let vaults = await vaultRepo.getByProject({ project_code: new mongoose.Types.ObjectId(req.params.project_code), isDeleted: false });

				if(!_.isEmpty(vaults) ) {

					if(req.user.role.role == "orgAdmin" && (JSON.stringify(vaults[0].org_code) != JSON.stringify(req.user.org_code._id))){
						res.status(201).send({ status: 201, data: [], message: 'Not Authorized.' });
					}else {
							res.status(200).send({ status: 200, data: vaults, message: 'Vault data fetched successfully' });
					}
				}else{
					res.status(201).send({ status: 201, data: [], message: 'No data found.' });
				}
      }
    } catch (e) {
      res.status(500).send( { status: 500, message: e.message });
    }
  }

  //Safety Rules set
  async getSafetyRuleSet(req, res) {
    //let ruleset = ["FDA ICSR", "EMA ICSR", "MHRA", "PMDA ICSR","SUBMISSIONS"];
    try{
      let srs = await srsDataRepo.getRulesSet();
      //console.log(srs);
      if (!_.isEmpty(srs)) {
        res.status(200).send( {
          status: 200,
          data: srs[0].rules_set,
          message: "Data fetched successfully."
        });
      } else {
        res.status(201).send( {
          status: 201,
          data: {},
          message: `There are no data at this moment.`
        });
      }
    } catch (e) {
      console.log("Error at getSafetyRuleSet: " + e);
      res.status(500).send( { status: 500, message: e.message });
    }
  }

  async getSafetyRuleTestCases(req, res) {
    try{

      const vault = await vaultRepo.getById( new mongoose.Types.ObjectId(req.params.vaultID));
      //console.log(JSON.stringify(vault.org_code) +" != "+ JSON.stringify(req.user.org_code._id))

      if(!_.isEmpty(vault)) {

        if(req.user.role.role != "superAdmin" && JSON.stringify(vault.org_code) != JSON.stringify(req.user.org_code._id)){
          res.status(201).send({ status: 201, data: [], message: 'Not Authorized.' });
        }else {
          let srs = await stdRepo.getTestCases({ rule_set_id: req.params.RuleSetID, vault_id: new mongoose.Types.ObjectId(req.params.vaultID) });
          if (!_.isEmpty(srs)) {
            res.status(200).send( {status: 200, data: srs, message: "Data fetched successfully." });
          } else {
            res.status(201).send( { status: 201, data: [], message: "There are no data at this moment." });
          }
        }
      }else {
        res.status(201).send( { status: 201, data: [], message: "There are no data at this moment." });    
      }
    } catch (e) {
      console.log("Error at getSafetyRuleKeys: "+ e);
      res.status(500).send( { status: 500, message: e.message });
    }
  }

  //Safety Rules set
  async getSafetyRuleKeys(req, res) {
    try{
      // ["FDA ICSR", "EMA ICSR", "MHRA", "PMDA ICSR"]
      let srslist = await srsDataRepo.getRulesSet();
      let RuleSetName = srslist[0].rules_set.find(ele => ele.id == req.params.RuleSetID ).name;
      let ruleName ="";
      if(RuleSetName == "FDA ICSR"){
        ruleName="FDA_Keys"
      }else if(RuleSetName == "EMA ICSR"){
        ruleName="EMA_Keys"
      }else if(RuleSetName == "MHRA"){
        ruleName="MHRA_Keys"
      }else if(RuleSetName == "PMDA ICSR"){
        ruleName="PMDA_Keys"
      }else if(RuleSetName == "SUBMISSIONS"){
        ruleName="SUBMISSIONS_Keys"
      }
      let srs = await srsDataRepo.getRuleSetKeys(ruleName);
      if (!_.isEmpty(ruleName)) {
        res.status(200).send( {
          status: 200,
          data: srs[0][ruleName],
          message: "Data fetched successfully."
        });
      } else {
        res.status(201).send( {
          status: 201,
          data: {},
          message: "There are no data at this moment."
        });
      }
    } catch (e) {
      console.log("Error at getSafetyRuleKeys: "+ e);
      res.status(500).send( { status: 500, message: e.message });
    }
  }

  async getSafetyRules(req, res) {
    try {
      //let srslist = await srsDataRepo.getRulesSet();
      //let RuleSetName = srslist[0].rules_set.find(ele => ele.id == req.params.RuleSetID ).name;
      

      const vault = await vaultRepo.getById( new mongoose.Types.ObjectId(req.params.vault_id));

      if(!_.isEmpty(vault)) {

        if(req.user.role.role != "superAdmin" && JSON.stringify(vault.org_code) != JSON.stringify(req.user.org_code._id)){
          res.status(201).send({ status: 201, data: [], message: 'Not authorized.' });
        }else {

          let std = await stdRepo.getRule({ vault_id: new mongoose.Types.ObjectId(req.params.vault_id), rule_set_id: req.params.RuleSetID, tag_id: req.params.tag_id });

          if (!_.isEmpty(std)) {
            res.status(200).send( {status: 200, data: std[0].Rules, message: "Data fetched successfully." });
          } else {
            res.status(201).send( { status: 201, data: [], message: "There are no data at this moment." });
          }
        }
      }else {
        res.status(201).send( { status: 201, data: [], message: "There are no data at this moment." });    
      }
    } catch (e) {
      console.log("Error at getSafetyRules: " + e)
      res.status(500).send( { status: 500, message: e.message });
    }
  }

  async updateSafetyRules(req, res) {
    try {


      const vault = await vaultRepo.getById( new mongoose.Types.ObjectId(req.params.vault_id));

      if(!_.isEmpty(vault)) {

        if(req.user.role.role != "superAdmin" && JSON.stringify(vault.org_code) != JSON.stringify(req.user.org_code._id)){
          res.status(201).send({ status: 201, data: [], message: 'Not Authorized.' });
        }else {

          let filter = {
            vault_id: new mongoose.Types.ObjectId(req.params.vault_id),
            rule_set_id: req.params.RuleSetID,
            tag_id: req.params.tag_id
          };
          
          // req.body.forEach(function(element) {
          //   element["isFileRequired"] = "Yes"
          // });
          delete req.body['userId'];
          let rules =[];
          if (!Array.isArray( req.body)){  
            let keys = Object.keys(req.body);
            keys.forEach( ele =>{
              if (!req.body[ele].hasOwnProperty("isFileRequired")) {
                req.body[ele]["isFileRequired"] = "Yes";
              }
              if (req.body[ele].hasOwnProperty("Vault_Name")) {
                req.body[ele]["Vault_Name"] = vault.vault_name;
              }
              rules.push(req.body[ele]);
            });
          }else
            rules = req.body;

          let data = {
            Rules: rules
          };

        let stddata = await stdRepo.updateByField(filter, data);

          if (!_.isEmpty(stddata)) {
            res.status(200).send( {status: 200, data: stddata.Rules, message: "Safety test data updated successfully." });
          } else {
            res.status(201).send( { status: 201, data: [], message: "Something is wrong!" });
          }
        }
      }else {
        res.status(201).send( { status: 201, data: [], message: "No vault found." });    
      }
    } catch (error) {
      console.log("updateSafetyRules error: "+ error);
      res.status(500).send( { status: 500, message: error.message });
    }
  }

}

async function formatAdditionalFields(testdata){
	let addlFields = new Array();
  //console.log("testdata : "+JSON.stringify(testdata, null, 4));  
	for( key in testdata){
		if(key != "project_type" && key != "org_code" ){
			//console.log("key : "+key+" value : "+testdata[key]);
			if(isEmail(testdata[key])){
				addlFields.push({
					"labelName": unCamelCase(key),
					"fieldName": key,
					"fieldType": "email",
					"defaultValue": testdata[key]
				});
			} else if(typeof(testdata[key]) === 'object' || typeof(testdata[key]) === 'array'){
				addlFields.push({
					"labelName": unCamelCase(key),
					"fieldName": key,
					"fieldType": "json",
					"defaultValue": JSON.stringify(testdata[key])
				});
      		} else if(typeof(testdata[key]) === 'number'){
				addlFields.push({
					"labelName": unCamelCase(key),
					"fieldName": key,
					"fieldType": "number",
					"defaultValue": testdata[key]
				});
			} else if(typeof(testdata[key]) === 'date' || typeof(testdata[key]) === 'datetime'){
				addlFields.push({
					"labelName": unCamelCase(key),
					"fieldName": key,
					"fieldType": "date",
					"defaultValue": testdata[key]
				});
			} else if(typeof(testdata[key]) === 'boolean'){
				addlFields.push({
					"labelName": unCamelCase(key),
					"fieldName": key,
					"fieldType": "boolean",
					"defaultValue": testdata[key]
				});
			}else {
				addlFields.push({
					"labelName": unCamelCase(key),
					"fieldName": key,
					"fieldType": "text",
					"defaultValue": testdata[key]
				});
			}
		}
	}
	return addlFields;
};

function unCamelCase (str){
  return str
      // insert a space between lower & upper
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // space before last upper in a sequence followed by lower
      .replace(/\b([A-Z]+)([A-Z])([a-z])/, '$1 $2$3')
      // uppercase the first character
      .replace(/^./, function(str){ return str.toUpperCase(); })
}

const isEmail = (value) => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  	return typeof value === 'string' && emailRegex.test(value);
}

module.exports = new VaultController();
