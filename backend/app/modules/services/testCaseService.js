const mongoose = require('mongoose');
const compareObjects = require('util/compareObjects');
const testCaseRepository = require('test_case/repositories/test_case.repository');
const test_suiteRepo = require('test_suite/repositories/test_suite.repository');
const projectRepo = require('project/repositories/project.repository');

class testCaseService {

    async processExternalTestCase(testCaseInputData) {
        let testCaseChange ={};
        let responseObject ={};

        //Project
        let proj_query = {
            status: "Active",
            isDeleted: false,
            org_code: testCaseInputData.org_code,
            type: testCaseInputData.project_type
        };
        let project_data = await projectRepo.getIdByField(proj_query);
        //console.log("project_data exists : --->: "+JSON.stringify(project_data, null, 2));
        if (_.isEmpty(project_data)) {
            console.log('Project : '+ testCaseInputData.project_type +" does not exists in V-Assure.");
            responseObject["status"] ="ERROR";
            responseObject["message"] = testCaseInputData.project_type +" project does not exists in V-Assure.";
            return responseObject;
        }
        let suiteName = testCaseInputData.test_suite_name.trim();

        //Test suite
        let testsuite_query = {
            status: "Active",
            isDeleted: false,
            project_code: project_data._id,
            suite_name: {
                $regex: `^\\s*${suiteName}\\s*$`,
                $options: "i"
            }
        };
        let testsuite_data = await test_suiteRepo.getByFieldNoIcon(testsuite_query);
        //console.log("Test_suite exists : --->: " + JSON.stringify(testsuite_data._id, null, 2));

        if (_.isEmpty(testsuite_data)) {
            // console.log('test suite  : '+ testCaseInputData.test_suite_name +" does not exists in V-Assure.");
            responseObject["status"] ="ERROR";
            responseObject["message"] = testCaseInputData.test_suite_name +" test suite does not exists in V-Assure.";
            return responseObject;
        }

        let tcResp ={
            test_case_id: testCaseInputData.test_case_id,
            description: testCaseInputData.description,
            test_case_name: testCaseInputData.test_case_name,
            changed_fields:[]
        };

        // const test_stepRes = testCaseInputData.testSteps.map(({ source_object_name, ...rest }) => rest);
        const test_stepRes = testCaseInputData.testSteps;
        //Find testcase in database
        let test_caseReq = {
            test_case_id: testCaseInputData.test_case_id,
            description: testCaseInputData.description,
            test_case_name: testCaseInputData.test_case_name,
            //source_object_name: testCaseInputData.source_object_name
        };

        const test_case_data = await testCaseRepository.getByFieldOnly(
            {   test_case_id: testCaseInputData.test_case_id, 
                test_suite_code : testsuite_data._id
            }
        );
        //console.log("test_case_data exists : --->: " + JSON.stringify(test_case_data, null, 2));
        //Check if testcase exists in database
        if (!_.isEmpty(test_case_data)) {
            //TestCase check
            let test_caseDB = {
                test_case_id: test_case_data.test_case_id,
                description: test_case_data.description,
                test_case_name: test_case_data.test_case_name
               // source_object_name: test_case_data.source_object_name
            };

            let testCaseDiff = compareObjects(test_caseReq, test_caseDB);
            // console.log("testCaseDiff : "+JSON.stringify(testCaseDiff, null, 2));
            if(!_.isEmpty(testCaseDiff)) {
                for(const ele of Object.keys(testCaseDiff.newValue)){
                    testCaseChange[ele] = testCaseDiff.newValue[ele];
                    tcResp.changed_fields.push(ele);
                }
                //console.log("testCaseChange : "+JSON.stringify(testCaseChange, null, 2));
            }else{
                console.log(testCaseInputData.test_case_id+' test case already available with same data. ' );
            }

            // console.log("test_case_data.test_steps : "+JSON.stringify(test_case_data.test_steps, null, 2));
            // console.log("test_stepRes : "+JSON.stringify(test_stepRes, null, 2));

            //Test Step check
            if (_.isEmpty(test_case_data.test_steps)) {
                test_case_data["test_steps"] =[];
            }
            let testCaseStepsDiff = compareObjects(test_stepRes, test_case_data.test_steps,"source_object_name", ["source_id"]);
            // console.log("testCaseStepsDiff : "+JSON.stringify(testCaseStepsDiff, null, 2));


            if (!_.isEmpty(testCaseStepsDiff)) {
                testCaseChange["test_steps"]= structuredClone(test_stepRes);

                //Prepare Response Object for diff
                for (const stepDiff of testCaseStepsDiff) {
                    if(_.isEmpty(stepDiff.diff.oldValue)){
                        await findandAppend(test_stepRes,"source_object_name",stepDiff.source_object_name,  "change_type" , "New");
                    }else if(_.isEmpty(stepDiff.diff.newValue)){
                        test_stepRes.push(stepDiff.diff.oldValue)
                        await findandAppend(test_stepRes,"source_object_name",stepDiff.source_object_name,  "change_type" , "Deleted");
                    }else{
                        await findandAppend(test_stepRes,"source_object_name",stepDiff.source_object_name,  "change_type" , "Modified");
                    }
                }
            }else{
                //No Changes in steps
                console.log(testCaseInputData.test_case_id+' test case steps already available with same data.' );
            }

            // console.log("testCaseChange : "+JSON.stringify(testCaseChange, null, 2));
            // return null;

            if (!_.isEmpty(testCaseChange)) {
                const tcupdate = await testCaseRepository.updateById(testCaseChange, test_case_data._id);
                //console.log("Test Case Updated : "+JSON.stringify(tcupdate, null, 2));
            }else{
                responseObject["status"] = "DUP_REQ";
                responseObject["message"] = 'Duplicate Request.';
            }
            responseObject["testCaseId"]= test_case_data._id;
            responseObject["data"]= test_case_data;
        }else{
            //test_caseReq["org_code"] = new mongoose.Types.ObjectId(testCaseInputData.org_code)
            test_caseReq["tag_id"] =  testCaseInputData.test_case_id.replaceAll("-", "_");
            test_caseReq["org_code"] = testsuite_data.org_code;
            test_caseReq["test_suite_code"] = testsuite_data._id;
            test_caseReq["test_steps"] = test_stepRes;
            test_caseReq["created_by"] = testCaseInputData.created_by;
            test_caseReq["comments"] = testCaseInputData.comments;

            //create test case
            const tcInsert = await testCaseRepository.save(test_caseReq);
            if (_.isEmpty(tcInsert )) {
                console.log('Problem in creating test case: '+ obj);
                responseObject["status"] ="ERROR";
                responseObject["message"] = 'Problem in creating test case: '+ JSON.stringify(obj);
                return responseObject;
            }            
            responseObject["testCaseId"]= tcInsert._id;
            responseObject["status"] = "NEW";
            // console.log("tcInsert exists : --->: " + JSON.stringify(tcInsert, null, 2));
            // console.log("responseObject exists : --->: " + JSON.stringify(responseObject, null, 2));
        }
        test_stepRes.forEach(obj => { 
            if (!obj.hasOwnProperty('change_type')) 
                obj.change_type = ""; 
        });
        responseObject["testCase"]= tcResp;
        responseObject["testSteps"]= test_stepRes;
        if (!responseObject.hasOwnProperty("testCaseId")) {
            responseObject["testCaseId"] = test_case_data._id;
        }
        return responseObject;
    }

    async GetTestCaseDiff(testCaseInputData, test_case_data) {
        let responseObject ={};

        let tcResp ={
            test_case_id: testCaseInputData.test_case_id,
            description: testCaseInputData.description,
            test_case_name: testCaseInputData.test_case_name,
            changed_fields:[]
        };

        const test_stepRes = testCaseInputData.testSteps;

        let test_caseReq = {
            test_case_id: testCaseInputData.test_case_id,
            description: testCaseInputData.description,
            test_case_name: testCaseInputData.test_case_name
        };
        let diff = false;
        //Check if testcase exists in database
        if (!_.isEmpty(test_case_data)) {
            //TestCase check
            let test_caseDB = {
                test_case_id: test_case_data.test_case_id,
                description: test_case_data.description,
                test_case_name: test_case_data.test_case_name
            };

            let testCaseDiff = compareObjects(test_caseReq, test_caseDB);
            //console.log("testCaseDiff : "+JSON.stringify(testCaseDiff, null, 2));
            if(!_.isEmpty(testCaseDiff)) {
                diff = true;
                for(const ele of Object.keys(testCaseDiff.newValue)){
                    tcResp.changed_fields.push(ele);
                }
               // console.log("testCaseChange : "+JSON.stringify(testCaseChange, null, 2));
            }else{
                console.log(testCaseInputData.test_case_id+' test case already available with same data. ' );
            }

            //console.log("test_case_data.test_steps : "+JSON.stringify(test_case_data.test_steps, null, 2));

            //Test Step check
            if (!_.isEmpty(test_case_data.test_steps)) {
                let testCaseStepsDiff = compareObjects(test_stepRes, test_case_data.test_steps,"source_object_name", ["source_id"]);
                console.log("testCaseStepsDiff : "+JSON.stringify(testCaseStepsDiff, null, 2));

                if (!_.isEmpty(testCaseStepsDiff)) {
                    diff = true;
                    //Prepare Response Object for diff
                    for (const stepDiff of testCaseStepsDiff) {
                        if(_.isEmpty(stepDiff.diff.oldValue)){
                            await findandAppend(test_stepRes,"source_object_name",stepDiff.source_object_name,  "change_type" , "New");
                        }else if(_.isEmpty(stepDiff.diff.newValue)){
                            test_stepRes.push(stepDiff.diff.oldValue)
                            await findandAppend(test_stepRes,"source_object_name",stepDiff.source_object_name,  "change_type" , "Deleted");
                        }else{
                            await findandAppend(test_stepRes,"source_object_name",stepDiff.source_object_name,  "change_type" , "Modified");
                        }
                    }
                }else{
                    //No Changes in steps
                    //console.log(testCaseInputData.test_case_id+' test steps already available with same data.' );
                }
            }else{
                responseObject["testSteps"] = null;
            }
            responseObject["testCaseId"]= test_case_data._id;
        }else{
            return null;
        }

        test_stepRes.forEach(obj => { 
            if (!obj.hasOwnProperty('change_type')) 
                obj.change_type = ""; 
        });

        responseObject["diff"]= diff;
        responseObject["testCase"]= tcResp;
        if (!responseObject.hasOwnProperty('testSteps')) 
            responseObject["testSteps"]=test_stepRes;
        return responseObject;
    }
}

async function findandAppend(array, targetKey, targetValue, newKey, newValue) {
    const index = array.findIndex(obj => obj[targetKey] === targetValue);
    if (index !== -1) {
        array[index][newKey] = newValue;
    }
}

module.exports = new testCaseService();
