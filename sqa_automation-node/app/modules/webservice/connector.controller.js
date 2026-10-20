const mongoose = require('mongoose');
const test_caseRepo = require('test_case/repositories/test_case.repository');
const test_caseHistRepo = require('test_case_hist/repositories/test_case_hist.repository');
const userRepo = require('user/repositories/user.repository');
const test_suiteRepo = require('test_suite/repositories/test_suite.repository');
const executionReqRepo = require('execution_request/repositories/execution_request.repository');
const executionRepo = require('execution/repositories/execution.repository');
const EHRepo = require('execution_history/repositories/execution_history.repository');
const executionServ = require('services/executionService');
const TestCaseServ = require('services/testCaseService');
const vaultMapRepo = require('connector_vault_map/repositories/connector_vault_map.repository');
const projectRepo = require('project/repositories/project.repository');

class ConnectorController {
  constructor() { }
/**
 * This method is for VAssure Connector for automation
 */
    async handleTestCase(req, res) {

        let testCase_id = null;
        let ticketActionRequired = "none";
        let exeReqData;
        try {
            let user = await userRepo.getUserByField({
                email: { $regex: "^" + req.body.email.trim() + "$", $options: "i" },
                isDeleted: false,
                status: "Active",
            });
            //console.log(JSON.stringify(user));
            if (_.isEmpty(user)) {
                res.status(400).send({ status: 400, data: [], message: req.body.email+ " user does not exists" });
                return;
            }
            let oldexeReq = await executionReqRepo.getByField({test_case_id: req.body.testCase.test_case_id, org_code : new mongoose.Types.ObjectId(req.body.org_id), status: { $in: ["OPEN","READY_AUTOMATION"]} });
            const trimTS = req.body.testSteps.map(({ procedure, expected_result, source_object_name, ...rest }) => rest);
            exeReqData = await executionReqRepo.save({
                    test_case_steps: trimTS,
                    request_id : (req.body.request_id ? req.body.request_id : null),
                    dryRun_object_id: (req.body.dryRun_object_id ? req.body.dryRun_object_id : null),
                    source_req_body: req.body,
                    execution_vault: req.body.execution_vault,
                    execution_type : req.body.execution_type,
                    test_case_id: req.body.testCase.test_case_id,
                    test_suite_name: req.body.test_suite_name,
                    created_by: user._id,
                    run_number: req.body.run_number ?? "",
                    status: "OPEN",
                    org_code: new mongoose.Types.ObjectId(req.body.org_id),
                    comments: (req.body.comments ? req.body.comments : null),
                    connector_url: req.body.connector_url
            });
            console.log("Execution Request creation successfully...");

            let testCaseReqBody = {
                test_case_id: req.body.testCase.test_case_id,
                description: req.body.testCase.description,
                test_case_name: req.body.testCase.test_case_name,
                testSteps:req.body.testSteps,
                source_object_name: req.body.testCase.source_object_name,
                org_code: new mongoose.Types.ObjectId(req.body.org_id),
                project_type: req.body.project_type,
                created_by: user._id,
                test_suite_name: req.body.test_suite_name
            };
            let responseObj = await TestCaseServ.processExternalTestCase(testCaseReqBody)

            // console.log("responseObj --->: "+JSON.stringify(responseObj, null, 2));
            // return res.status(200).send({ status: 200, data: [], message: 'Request successfully processed.' });

            if (!responseObj.hasOwnProperty("status") ) {
                //create an entry in History.
                let tch = {
                    testcase_id: responseObj.testCaseId,
                    request_id:(req.body.request_id ? req.body.request_id : null),
                    comments:(req.body.comments ? req.body.comments : null),
                    data:responseObj["data"]
                        };
                    await test_caseHistRepo.save(tch);
                if (!_.isEmpty(oldexeReq)) 
                    await executionReqRepo.updateById(oldexeReq[0]._id,{ status:"INVALID", failure_reason: 'Test Case Modified/New Request received.'});
                await executionReqRepo.updateById(exeReqData._id,{testcase_id: responseObj.testCaseId, status:"READY_AUTOMATION"} );

                let resData ={testCase: responseObj.testCase, testSteps:responseObj.testSteps, "ticketActionRequired": (ticketActionRequired == "none" ? "modified": ticketActionRequired) };
                res.status(200).send({ status: 200, data: resData, message: 'Request successfully processed.' });
            }else if ( responseObj.status === "ERROR") {
                await executionReqRepo.updateById(exeReqData._id, {testcase_id: responseObj.testCaseId, status:"ERROR", failure_reason: responseObj.message} );
                res.status(400).send({ status: 400, data: [], message: responseObj.message });
            }else if ( responseObj.status === "DUP_REQ") {
                let resData ={testCase: responseObj.testCase, testSteps:responseObj.testSteps, "ticketActionRequired": (ticketActionRequired == "none" ? "modified": ticketActionRequired) };
                if (!_.isEmpty(oldexeReq)) 
                    await executionReqRepo.updateById(oldexeReq[0]._id,{ status:"INVALID", failure_reason: 'Test Case Modified/New Request received.'});
                await executionReqRepo.updateById(exeReqData._id, {testcase_id: responseObj.testCaseId, status:"READY_AUTOMATION", failure_reason: null} );
                res.status(200).send({ status: 200, data: resData, message: 'Request successfully processed.' });
            }else{
                ticketActionRequired = 'new';
                await executionReqRepo.updateById(exeReqData._id,{testcase_id: responseObj.testCaseId, status:"READY_AUTOMATION"} );
                let resData ={testCase: responseObj.testCase, testSteps:responseObj.testSteps, "ticketActionRequired": (ticketActionRequired == "none" ? "modified": ticketActionRequired) };
                res.status(200).send({ status: 200, data: resData, message: 'Request successfully processed.' });
            }
        }
        catch (error) {
            console.log("Exception at ConnectorController.handleTestCase : "+error.message);
            await executionReqRepo.updateById(exeReqData._id,{testcase_id: testCase_id, status:"ERROR", failure_reason: "Exception at test_case.ConnectorController.handleTestCase : "+error.message} );
            res.status(500).send({ status: 500, message: error.message });
        }
        return;
    };

    async handleExecution(req,res){
        try{

            let user = await userRepo.getUserByField({
                email: { $regex: "^" + req.body.email.trim() + "$", $options: "i" },
                isDeleted: false,
                status: "Active",
            });
            //console.log(JSON.stringify(user));
            if (_.isEmpty(user)) {
                res.status(400).send({ status: 400, data: [], message: req.body.email+ " user does not exists" });
                return;
            }

            let oldexeReq = await executionReqRepo.getByField({test_case_id: req.body.testCase.test_case_id, org_code : new mongoose.Types.ObjectId(req.body.org_id),  status: "READY_EXECUTION" });
            if (!_.isEmpty(oldexeReq)) {
                res.status(200).send({ status: 200, data: [], message: req.body.testCase.test_case_id + ' Already in Process!' });
                return;
            }
            if (_.isEmpty(req.body.testSteps)) {
                res.status(400).send({ status: 400, data: [], message: 'No test steps found in the request!' });
                return;
            }

            //Project
            let proj_query = {
                status: "Active",
                isDeleted: false,
                org_code: new mongoose.Types.ObjectId(req.body.org_id),
                type: req.body.project_type
            };
            let project_data = await projectRepo.getIdByField(proj_query);
            //console.log("project_data exists : --->: "+JSON.stringify(project_data, null, 2));
            if (_.isEmpty(project_data)) {
                res.status(400).send({ status: 400, data: [], message: req.body.project_type + ' project does not exists!' });
                return;
            }

            let suiteName = req.body.test_suite_name.trim();
            //Test suite
            let testsuite_query = {
                status: "Active",
                isDeleted: false,
                project_code: project_data._id,
                suite_name:{
                    $regex: `^\\s*${suiteName}\\s*$`,
                    $options: "i"
                }
            };
            let testsuite_data = await test_suiteRepo.getByFieldNoIcon(testsuite_query);
            //console.log("Test_suite exists : --->: " + JSON.stringify(testsuite_data._id, null, 2));

            if (_.isEmpty(testsuite_data)) {
                res.status(400).send({ status: 400, data: [], message: req.body.test_suite_name + ' test suite does not exists!' });
                return;
            }

            const testCasefromDB = await test_caseRepo.getByField({   
                test_case_id: req.body.testCase.test_case_id, 
                test_suite_code : testsuite_data._id });
            // console.log("testCasefromDB : "+JSON.stringify(testCasefromDB, null, 2));
        
            if (_.isEmpty(testCasefromDB)) {
                res.status(400).send({ status: 400, data: [], message:  req.body.testCase.test_case_id + ' test case does not exits!' });
                return;
            }
            // let testCaseReqBody = {
            //     test_case_id: req.body.testCase.test_case_id,
            //     description: req.body.testCase.description,
            //     test_case_name: req.body.testCase.test_case_name,
            //     testSteps: req.body.testSteps,
            //     source_object_name: req.body.testCase.source_object_name
            // };
            // let responseObj = await TestCaseServ.GetTestCaseDiff(testCaseReqBody, testCasefromDB);
            // console.log("responseObj --->: "+JSON.stringify(responseObj.diff, null, 2));

        //    if(responseObj === null){
        //         res.status(400).send({ status: 400, data: [], message: 'Test case not exists in DB.' });
        //    }else if(responseObj["diff"]) {
        //         res.status(400).send({ status: 400, data: [], message: 'Input Testcase data and VAssure Testcase data not matching.' });
        //    }else if (responseObj["testSteps"] == null)
        //         res.status(400).send({ status: 400, data: [], message: 'Something went wrong, no test steps found in VAssure db.' });
        //     else{
                const trimTS = req.body.testSteps.map(({ procedure, expected_result, source_object_name, ...rest }) => rest);

                let vaultMap = await vaultMapRepo.getAllByField({execution_vault:req.body.execution_vault, project_type: req.body.project_type, org_code: new mongoose.Types.ObjectId(req.body.org_id) });
                if (_.isEmpty(vaultMap)) {
                    res.status(400).send({ status: 400, data: [], message: req.body.execution_vault + ' does not exits in connector_vault_map.!' });
                    return;
                }
                //console.log("vaultMap :"+  JSON.stringify(vaultMap, null, 4));
                // res.status(200).send({ status: 200, data: [], message: 'Executions started successfully' });   
                // return
                let obj = {
                    ccInfo: {runNo:  req.body.run_number ?? ""},
                    user_id: user._id,
                    org_code: new mongoose.Types.ObjectId(req.body.org_id),
                    project_id: testCasefromDB.test_suite_code.project_code,
                    test_suite_id: testCasefromDB.test_suite_code._id,
                    test_case_id: testCasefromDB._id,
                    tag_id: testCasefromDB.tag_id,
                    vault_id: vaultMap[0].vault_id
                };
                let result = await executionServ.executeTestCase(obj,"Immediate");
                // console.log("records :"+  JSON.stringify(result, null, 4));

                if(result.status != 200){
                    res.status(400).send({ status: 400, data: [], message: 'Something went wrong, in triggering the execution.' });
                }else{
                    let exeReqData = await executionReqRepo.save({
                            testcase_id: testCasefromDB._id,
                            test_case_steps: trimTS,
                            request_id : (req.body.request_id ? req.body.request_id : null),
                            dryRun_object_id: (req.body.dryRun_object_id ? req.body.dryRun_object_id : null),
                            source_req_body: req.body,
                            execution_vault: req.body.execution_vault,
                            execution_type : req.body.execution_type,
                            test_case_id: req.body.testCase.test_case_id,
                            org_code: new mongoose.Types.ObjectId(req.body.org_id),
                            comments: (req.body.comments ? req.body.comments : null),
                            execution_id: result.data.execution_id,
                            run_number: req.body.run_number ?? "",
                            test_suite_name: req.body.test_suite_name,
                            status:"READY_EXECUTION",
                            connector_url: req.body.connector_url
                    });
                    res.status(200).send({ status: 200, data: { test_case_id: req.body.testCase.test_case_id }, message: 'Executions started successfully' });       
                }
            //}
            return;
        }
        catch (error) {
            console.log("Exception at ConnectorController.handleExecution : "+error.message);
            res.status(500).send({ status: 500, message: error.message });
            return;
        }
    };

    async preExecutionReport(req,res){
        try{

            let user = await userRepo.getUserByField({
                email: { $regex: "^" + req.body.email.trim() + "$", $options: "i" },
                isDeleted: false,
                status: "Active",
            });
            //console.log(JSON.stringify(user));
            if (_.isEmpty(user)) {
                res.status(400).send({ status: 400, data: [], message: req.body.email+ " user does not exists" });
                return;
            }

            if (_.isEmpty(req.body.testSteps)) {
                res.status(400).send({ status: 400, data: [], message: 'No test steps found in the request!' });
                return;
            }

            //Project
            let proj_query = {
                status: "Active",
                isDeleted: false,
                org_code: new mongoose.Types.ObjectId(req.body.org_id),
                type: req.body.project_type
            };
            let project_data = await projectRepo.getIdByField(proj_query);
            //console.log("project_data exists : --->: "+JSON.stringify(project_data, null, 2));
            if (_.isEmpty(project_data)) {
                res.status(400).send({ status: 400, data: [], message: req.body.project_type + ' project does not exists!' });
                return;
            }
            let suiteName = req.body.test_suite_name.trim();

            //Test suite
            let testsuite_query = {
                status: "Active",
                isDeleted: false,
                project_code: project_data._id,
                suite_name:{
                    $regex: `^\\s*${suiteName}\\s*$`,
                    $options: "i"
                }
            };
            let testsuite_data = await test_suiteRepo.getByFieldNoIcon(testsuite_query);
            // console.log("Test_suite exists : --->: " + JSON.stringify(testsuite_data, null, 2));

            if (_.isEmpty(testsuite_data)) {
                res.status(400).send({ status: 400, data: [], message: req.body.test_suite_name + ' test suite does not exists!' });
                return;
            }

            const testCasefromDB = await test_caseRepo.getByField({   
                test_case_id: req.body.testCase.test_case_id, 
                test_suite_code : testsuite_data._id });
            //console.log("testCasefromDB : "+JSON.stringify(testCasefromDB, null, 2));

            if (_.isEmpty(testCasefromDB)) {
                res.status(400).send({ status: 400, data: [], message: req.body.testCase.test_case_id + ' does not exits!' });
                return;
            }

            // let testCaseReqBody = {
            //     test_case_id: req.body.testCase.test_case_id,
            //     description: req.body.testCase.description,
            //     test_case_name: req.body.testCase.test_case_name,
            //     testSteps: req.body.testSteps,
            //     source_object_name: req.body.testCase.source_object_name
            // };
            // let responseObj = await TestCaseServ.GetTestCaseDiff(testCaseReqBody, testCasefromDB);
            //console.log("responseObj --->: "+JSON.stringify(responseObj, null, 2));

            // if(responseObj === null){
            //     res.status(400).send({ status: 400, data: [], message: 'Test case not exists in DB.' });   
            // }else if(responseObj["diff"]){
            //     res.status(400).send({ status: 400, data: [], message: 'Input Testcase data and VAssure Testcase data not matching.' });   
            // }else if (responseObj["testSteps"] == null)
            //     res.status(400).send({ status: 400, data: [], message: 'Something went wrong, no test steps found in VAssure db.' });   
            // else{
                const trimTS = req.body.testSteps.map(({ source_id, source_object_name, ...rest }) => rest);
    
                let vaultMap = await vaultMapRepo.getAllByField({execution_vault:req.body.execution_vault, project_type: req.body.project_type, org_code: new mongoose.Types.ObjectId(req.body.org_id) });
                if (_.isEmpty(vaultMap)) {
                    res.status(400).send({ status: 400, data: [], message: req.body.execution_vault + ' does not exists in connector_vault_map.!' });
                    return;
                }
                //console.log("vaultMap :"+  JSON.stringify(vaultMap, null, 4));
                // res.status(200).send({ status: 200, data: [], message: 'Executions started successfully' });   
                // return    
                let obj = {
                    user_id: user._id,
                    test_case_data: testCasefromDB,
                    testsuite_data: testsuite_data,
                    request_id:(req.body.request_id ? req.body.request_id : null),
                    vault_id: vaultMap[0].vault_id,
                    comments: (req.body.comments ? req.body.comments : null),
                    ccInfo:{}
                };
                let result = await executionServ.createPreExeuctionReport(obj);
                //console.log("records :"+  JSON.stringify(result, null, 4));
                // res.status(200).send({ status: 200, data: [], message: 'Executions started successfully' });   
                // return
                let ret_msg = { 
                    "requestId": req.body.request_id,
                    "dryRun_object_id": req.body.dryRun_object_id,
                    "orgId": req.body.org_code,
                    "bucketName": process.env.AWS_BUCKET_NAME,
                    "reportS3Path": result.message.report_path
                }; 
                if ( result.code == 200 ){
                    let exeReqData = await executionReqRepo.save({
                        testcase_id: testCasefromDB._id,
                        test_case_steps: trimTS,
                        request_id : (req.body.request_id ? req.body.request_id : null),
                        dryRun_object_id: (req.body.dryRun_object_id ? req.body.dryRun_object_id : null),
                        source_req_body: req.body,
                        execution_vault: req.body.execution_vault,
                        execution_type : req.body.execution_type,
                        test_case_id: req.body.testCase.test_case_id,
                        org_code: new mongoose.Types.ObjectId(req.body.org_id),
                        comments: (req.body.comments ? req.body.comments : null),
                        execution_id: result.message.execution_id,
                        run_number: req.body.run_number ?? "",
                        test_suite_name: req.body.test_suite_name,
                        status:"DONE",
                        connector_url: req.body.connector_url
                    });
                    res.status(200).send({ status: 200, data: ret_msg, message: 'Pre execution report generated successfully' });
                }else {
                    let exeReqData = await executionReqRepo.save({
                        testcase_id: testCasefromDB._id,
                        test_case_steps: trimTS,
                        request_id : (req.body.request_id ? req.body.request_id : null),
                        dryRun_object_id: (req.body.dryRun_object_id ? req.body.dryRun_object_id : null),
                        source_req_body: req.body,
                        execution_vault: req.body.execution_vault,
                        execution_type : req.body.execution_type,
                        test_case_id: req.body.testCase.test_case_id,
                        org_code: new mongoose.Types.ObjectId(req.body.org_id),
                        comments: (req.body.comments ? req.body.comments : null),
                        failure_reason: result.message,
                        run_number: req.body.run_number ?? "",
                        test_suite_name: req.body.test_suite_name,
                        status:"ERROR",
                        connector_url: req.body.connector_url
                    });
                    res.status(400).send({ status: 400, data: [], message: 'Something went wrong!!' });
                }   
            // }
        }
        catch (error) {
            console.log("Exception at ConnectorController.preExecutionReport : "+error.message);
            res.status(500).send({ status: 500, message: error.message });
        }

    };

    async closeRequest(req,res){
        let exeReq = await executionReqRepo.getByField({request_id: req.body.request_id} );
        //console.log({request_id: req.body.request_id});
        if (_.isEmpty(exeReq)) {
            res.status(400).send({ status: 400, data: [], message: 'Invalid RequestId.' });
            return;
        }

        const execResponse = await executionReqRepo.updateById(exeReq[0]._id,{status:"CLOSED"} );

        if (!_.isEmpty(execResponse))
            res.status(200).send({ status: 200, data: [], message: 'Request closed successfully' });
        else
            res.status(400).send({ status: 400, data: [], message: 'Something went wrong!' });
    };

    async getExecutionDetails(req,res){
        let exeReq = await executionReqRepo.getByField({request_id: req.body.request_id} );

        if (_.isEmpty(exeReq)) {
            res.status(400).send({ status: 400, data: [], message: 'Invalid RequestId.' });
            return;
        }
        if (_.isEmpty(exeReq[0].execution_id)) {
            res.status(400).send({ status: 400, data: [], message: 'No executions found for request '+ req.body.request_id });
            return;
        }
        //console.log("exeReq :"+  JSON.stringify(exeReq, null, 4));

        const execResponse = await executionRepo.getByIdDetail(exeReq[0].execution_id);
        //console.log("execResponse :"+  JSON.stringify(execResponse, null, 4));

        if (_.isEmpty(execResponse)) {
            const execution_hist = await EHRepo.getById(exeReq[0].execution_id);
            if (!_.isEmpty(execution_hist)) {
                res.status(200).send({ status: 200, data: { build_no: execution_hist.build_no}, message: 'Request processed successfully' });
            }else
                res.status(400).send({ status: 400, data: [], message: 'No records found in vassure exuection ' +exeReq[0].execution_id });
        }
        else {
                // res.status(200).send({ status: 200, data: { execution_id: execResponse._id, build_no: execResponse.build_no, result_status: execResponse.result_status, buildTimeDuration: execResponse.estimated_duration}, message: 'Executions updated successfully' });
                res.status(200).send({ status: 200, data: { build_no: execResponse.build_no}, message: 'Request processed successfully' });
        }
    };

    /* @Method: checkEmail
        @Description: check if email Id exists or not
    */
    async checkEmail(req, res) {
        try {
            let user = await userRepo.getUserByField({
            email: { $regex: "^" + req.body.email.trim() + "$", $options: "i" },
            isDeleted: false,
            status: "Active",
            });
            if (!_.isEmpty(user)) {
            //console.log("User : " + JSON.stringify(user, null, 4));
            res.status(200).send({
                status: 200,
                data: {
                    orgId: user.org_code._id
                },
                message: "Email found in V-Assure.",
                });
            } else {
            res.status(201).send({
                status: 201,
                data: {},
                message: "Email not found in V-Assure.",
            });
            }
        } catch (e) {
            //throw e;
            console.log("Error in checkUser: " + e);
            res.status(500).send({ status: 500, data: {}, message: e.message });
        }
    };
}

module.exports = new ConnectorController();