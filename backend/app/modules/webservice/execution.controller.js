const mongoose = require('mongoose');
const executionRepo = require('execution/repositories/execution.repository');
const EHRepo = require('execution_history/repositories/execution_history.repository');
const userRepo = require('user/repositories/user.repository');
const testCaseRepo = require('test_case/repositories/test_case.repository');
const vaultRepo = require("vault/repositories/vault.repository");
const test_suiteRepo = require('test_suite/repositories/test_suite.repository');
const request = require('axios');
const { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const schedule = require("node-schedule");
const executionServ = require('services/executionService');

const path = require('path');
const fs = require('fs');
const os = require('os');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const { isEmpty } = require('underscore');
const axios = require("axios");

const fonts = {
    Courier: {
        normal: 'Courier',
        bold: 'Courier-Bold',
        italics: 'Courier-Oblique',
        bolditalics: 'Courier-BoldOblique'
    },
    Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    },
    Times: {
        normal: 'Times-Roman',
        bold: 'Times-Bold',
        italics: 'Times-Italic',
        bolditalics: 'Times-BoldItalic'
    }
};

var schedule_jobs = {};
(async () => {
    await initScheduledJob();
})();

class executionController {
    constructor() {
        this.execution = [];
    }

    /**
     * @Method: execute the jenkins api and update the exceutions table
     * @Description: execution create
     *  
     * */      
    async test_case(req, res) {
        let orgid = new mongoose.Types.ObjectId(req.body.org_id);
        let projectid = new mongoose.Types.ObjectId(req.body.project_id);
        let test_suite_id = new mongoose.Types.ObjectId(req.body.test_suite_id);
        let userid = new mongoose.Types.ObjectId(req.body.user_id);
        let p_ccInfo = req.body.ccInfo;
        let vault_id = req.body.vault;
        let tag_id_list = req.body.tag_id;//test_case._id list
        let test_case_object_id_list = [];

        if(JSON.stringify(req.body.org_id) != JSON.stringify(req.user.org_code._id)){
            console.log("test_case API: " + JSON.stringify(req.body.org_id) + "!=" + JSON.stringify(req.user.org_code._id));
            res.status(201).send({ status: 201, data: "", message: 'Not Authorized' });
        } else 
        {
            tag_id_list.forEach(element => {
                let testcase_id = new mongoose.Types.ObjectId(element);
                test_case_object_id_list.push(testcase_id);
            });

            const testcaseResponse = await testCaseRepo.getByIds(test_case_object_id_list);
            let test_case_name_list = [];
            testcaseResponse.forEach(element => {
                test_case_name_list.push({"tag_id": element.tag_id, "_id": element._id});
            });

            let data = [];
            let finalMsg = [];
            let finalStatus  ; 

            for (const element of test_case_name_list){
                let obj = {
                    ccInfo: p_ccInfo,
                    user_id: userid,
                    org_code: orgid,
                    project_id: projectid,
                    test_suite_id: test_suite_id,
                    test_case_id: element._id,
                    tag_id: element.tag_id,
                    vault: new mongoose.Types.ObjectId(vault_id)
                };
                let result = await execJob(obj, req.body.schedule_date);

                if(result.status != 200){
                    finalStatus = result.status;
                    data.push(result.data);
                    finalMsg.push(result.message);
                }else{
                    finalStatus = 200;
                    finalMsg = ["Executions started successfully"];
                }
            // console.log(finalStatus + " : "+ data + " : "+ finalMsg.toString());

            }
            //console.log(finalStatus + " : "+ data + " : "+ finalMsg.toString());
            res.status(finalStatus).send({ status: finalStatus, data: data, message: finalMsg.toString() });
        }
    };

    /**
     * @Method: to execute the jenkins api and update the exceutions table for dry run
     * to get template with test steps
     * @Description: to dry run the test cases to get template with test steps
     * */      
    async dry_run(req, res) {
    //   console.log("dry_run API: " + JSON.stringify(req.body) + ":" + JSON.stringify(req.user.org_code._id));

        if(JSON.stringify(req.body.org_id) != JSON.stringify(req.user.org_code._id)){
            console.log("dry_run API: " + JSON.stringify(req.body.org_id) + "!=" + JSON.stringify(req.user.org_code._id));
            res.status(201).send({ status: 201, data: "", message: 'Not Authorized' });
        } else {

            let orgid = new mongoose.Types.ObjectId(req.body.org_id);
            let projectid = new mongoose.Types.ObjectId(req.body.project_id);
            let test_suite_id = new mongoose.Types.ObjectId(req.body.test_suite_id);
            let userid = new mongoose.Types.ObjectId(req.body.user_id);
            let p_ccInfo = req.body.ccInfo;
            let vault_id = req.body.vault;
            let tag_id_list = req.body.tag_id;//JSON.parse(req.body.tag_id);
            let test_case_object_id_list = [];

            tag_id_list.forEach(element => {
                let tag_id = new mongoose.Types.ObjectId(element);
                test_case_object_id_list.push(tag_id);
            });

            const testcaseResponse = await testCaseRepo.getByIds(test_case_object_id_list);
            let test_case_name_list = [];
            testcaseResponse.forEach(element => {
                test_case_name_list.push({"tag_id": element.tag_id, "_id": element._id, "data": element});
            });

            let data = [];
            let finalMsg = [];
            let finalStatus  ; 

            for (const element of test_case_name_list){
                let obj = {
                    ccInfo: p_ccInfo,
                    user_id: userid,
                    org_code: orgid,
                    project_id: projectid,
                    test_suite_id: test_suite_id,
                    test_case_id: element._id,
                    tag_id: element.tag_id,
                    vault: new mongoose.Types.ObjectId(vault_id)
                };
                let result;
                if (!_.isEmpty(element.data.test_steps)){
                    let testsuite_data = await test_suiteRepo.getByFieldNoIcon({_id :test_suite_id });
                
                    let preExeObj = {
                        user_id: new mongoose.Types.ObjectId(req.body.user_id),
                        test_case_data: element.data,
                        testsuite_data: testsuite_data,
                        vault_id: new mongoose.Types.ObjectId(vault_id),
                        ccInfo: p_ccInfo
                    };
                    // console.log(JSON.stringify(preExeObj, null, 4));
                    // return res.status(200).send( {status: 200, message:"good to go"});
                    let resp = await executionServ.createPreExeuctionReport(preExeObj);
                    result = { status: 200, data: { execution_id: resp.execution_id }, message: 'Executions started sucessfully.' };
                }else{
                    result = await executeTestCase(obj,"Immediate", true);
                }
                
                if(result.status != 200){
                    finalStatus = result.status;
                    data.push(result.data);
                    finalMsg.push(result.message);
                }else{
                    finalStatus = 200;
                    finalMsg = ["Executions started successfully"];
                }
            // console.log(finalStatus + " : "+ data + " : "+ finalMsg.toString());

            }
            //console.log(finalStatus + " : "+ data + " : "+ finalMsg.toString());
            res.status(finalStatus).send({ status: finalStatus, data: data, message: finalMsg.toString() });
      }
    };

    /* @Method: execute the jenkins api and update the exceutions table
    // @Description: execution create
    */
    async execution_details(req, res) {
        let exe_id = new mongoose.Types.ObjectId(req.body.execution_id);
        const execResponse = await executionRepo.getByIdDetail(exe_id);
        if (_.isEmpty(execResponse)) {
            const execution_hist = await EHRepo.getById(exe_id);
            if (!_.isEmpty(execution_hist)) {
                //res.status(200).send({ status: 200, data: { execution_id: execution_hist._id, build_no: execution_hist.build_no, result_status: execution_hist.result_status, buildTimeDuration: 'N/A'}, message: 'Executions updated successfully' });
                res.status(200).send({ status: 200, data: { execution_id: execution_hist._id, build_no: execution_hist.build_no, result_status: execution_hist.result_status, ccInfo: execution_hist.ccInfo, vault: execution_hist.vault, test_case: execution_hist.test_case_id, project_id: execution_hist.project_id, test_suite_id: execution_hist.test_suite_id}, message: 'Execution fetched successfully' });
            }else
                res.status(201).send({ status: 201, data: [], message: 'Something went wrong!' });
        }
        else {
              // res.status(200).send({ status: 200, data: { execution_id: execResponse._id, build_no: execResponse.build_no, result_status: execResponse.result_status, buildTimeDuration: execResponse.estimated_duration}, message: 'Executions updated successfully' });
              res.status(200).send({ status: 200, data: { execution_id: execResponse._id, build_no: execResponse.build_no, result_status: execResponse.result_status, ccInfo: execResponse.ccInfo, vault: execResponse.vault, test_case: execResponse.test_case_id, project_id: execResponse.project_id, test_suite_id: execResponse.test_suite_id}, message: 'Executions fetched successfully' });
        }
        
    };

    async stop_execution(req, res) {
        try {
            let exe_id = new mongoose.Types.ObjectId(req.body.execution_id);
            let projectid = new mongoose.Types.ObjectId(req.body.project_id);

            const exeResponse = await executionRepo.getById(exe_id);

            if(JSON.stringify(exeResponse.org_code) != JSON.stringify(req.user.org_code._id)){
                console.log("stop_execution API: " + JSON.stringify(exeResponse.org_code) + "!=" + JSON.stringify(req.user.org_code._id));
                res.status(201).send({ status: 201, data: "", message: 'Not Authorized' });
            } else 
            {
                //console.log(schedule_jobs);
                if(exeResponse.status == "Scheduled"){
                    console.log(exe_id.toString()+" job cancelled...");
                    schedule_jobs[exe_id.toString()].cancel();
                    let execution = await executionRepo.updateById({
                        status:"Active",
                        result_status: 'ABORTED',
                        reason: "User Cancelled JOB" }, exe_id);
                    //await updateTCwithExcDetails(element.test_case_id[0], element.vault, element._id, "ABORTED" );
                    res.status(200).send({ status: 200, data: { execution_id: exe_id, build_no: execution.build_no, result_status: execution.result_status }, message: 'Executions updated successfully' });
                    // console.log(schedule.scheduledJobs);

                }else{
                    let build_no = exeResponse.build_no;
                    let vault_data = await vaultRepo.getById({
                        _id: exeResponse.vault
                      });
                    
                    let JENKINS_BASE_URL = vault_data.jenkins_base_url;
                    let JENKINS_JOB_NAME = vault_data.jenkins_job_name;
                    if (JENKINS_BASE_URL != null || JENKINS_JOB_NAME != null){
        
                            let stopURL = `${JENKINS_BASE_URL}/job/${JENKINS_JOB_NAME}/${build_no}/stop`;
                            var options = {
                                'method': 'POST',
                                'url': stopURL,
                                'headers': {
                                },
                                resolveWithFullResponse: true,
                            };
                
                            let response = await apiCall(options)
                            let obj = {
                                result_status: 'ABORTED'
                            };
                            const execution = await executionRepo.updateById(obj, exe_id);
                            if (!_.isEmpty(execution)) {
                               // await updateTCwithExcDetails(execution.test_case_id[0], execution.vault, exe_id, execution.result_status );
                                res.status(200).send({ status: 200, data: { execution_id: exe_id, build_no: execution.build_no, result_status: execution.result_status }, message: 'Executions updated successfully' });
                            }
                            else {
                                res.status(201).send({ status: 201, data: [], message: 'Something went wrong!' });
                            }
                    }else {
                        console.log("Jenksins Base URL or Jenkins Job name not set for Project ID: "+projectid );
                        res.status(201).send({ status: 201, data: [], message: 'Contact Admin SQA:12002' });
                    }
                }
            }
        } catch (error) {
            console.log("stop_execution API Exception: "+error);
            res.status(500).send({ status: 500, message: error.message });
        }
    };

    async exe_history(req, res) {
        let obj = {
            project_id:  new mongoose.Types.ObjectId(req.body.project_id),
            test_suite_id: new mongoose.Types.ObjectId(req.body.test_suite_id),
            vault_id: req.body.vault_id,
            page: (typeof req.body.pagination != 'undefined' && typeof req.body.pagination.page != 'undefined'? req.body.pagination.page : 1),
            limit: (typeof req.body.pagination != 'undefined' && typeof req.body.pagination.perpage != 'undefined' ? req.body.pagination.perpage : process.env.RECORD_LIMIT),
        };
        
        if (_.has(req.body, 'query') ){
            obj['query_field'] = req.body.query.searchCol;
            obj['query_value'] = req.body.query.searchVal;
        } 
        if (_.has(req.body, 'sort_field') && _.has(req.body, 'sort_order')) {
            obj['sort_field'] = req.body.sort_field;
            obj['sort_order'] = req.body.sort_order;
        }
        try {
            const hist_result = await EHRepo.getHistoryPagination(obj); 

            if(hist_result.docs.length > 0 && JSON.stringify(hist_result.docs[0].org_code) != JSON.stringify(req.user.org_code._id)){
                console.log("exe_history API: " + JSON.stringify(hist_result.docs[0].org_code) + "!=" + JSON.stringify(req.user.org_code._id));
                res.status(201).send({ status: 201, data: "", message: 'Not Authorized' });
            } else 
            {
                if (!_.isEmpty(hist_result)) {
                    res.status(200).send({ status: 200, data: hist_result, message: 'Executions fetched successfully' });
                }
                else {
                    res.status(201).send({ status: 200, data: [], message: 'No history records found' });
                }
            }


        } catch (error) {
            console.log("exe_history API Exception: "+error);
            res.status(500).send({ status: 500, message: error.message });
        }
    };
    
    async download_reports(req, res) {

        try {

            const s3 = new S3Client({
                region: process.env.AWS_REGION,
                credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                }
            });
            let tempDir = path.join(os.tmpdir(), `VAssure_${uuidv4()}`);
    
            // Download all files
            const downloadedFiles = await Promise.all(req.body.execution_id.map(async (element) => { return await download_report({"_id": new mongoose.Types.ObjectId(element)}, tempDir, s3)  }));
            //console.log(downloadedFiles)
            if(downloadedFiles.length > 1){
                await zipAndStreamFiles(res, downloadedFiles );
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            else
                await streamFile(tempDir,downloadedFiles[0], res);
        } catch (error) {
            console.log("download_report API Exception :" + error);
            //res.status(500).send({ status: 500, message: error });
        }
    };
    
    async raise_connector_request(req, res) {
        try {
            await postDataToConnector(req, res);
        } catch (error) {
            console.log("raise_connector_request API Exception :" + error);
            res.status(500).send({ status: 500, message:  'Something went wrong!' });
        }
    };

};

//Function to push data to V-Assure Connector
async function postDataToConnector(req, res) {
    try {
        let histQry = {
            project_id : new mongoose.Types.ObjectId(req.body.project_id),
            build_no: req.body.build_no,
            test_suite_id: new mongoose.Types.ObjectId(req.body.test_suite_id)
            }
        // console.log("histQry: "+JSON.stringify(histQry, null, 2));
        //Get Execuction record
        const exeHistData = await EHRepo.getAllByFields(histQry);
        let exec_id;
        if(exeHistData.length > 0){
            exec_id = exeHistData[0]._id;
            // console.log("--->"+exec_id);
        }else{
            return { status: 201, data: [], message: "Execution record not found." };
        }
        // console.log(exec_id);

        // let response = await executionServ.prepareConnectorData(req.body.execution_id, "Automation");
        let response = await executionServ.prepareConnectorData(exec_id, "Automation");
        // console.log(response.data);
        let connector_url = response.data.connector_url;
        delete response.data.connector_url;
        if(response.status === 200){
            try{
                let connectorOptions = {
                    method: "POST",
                    url: connector_url, //process.env.CONNECTOR_SYNC_DATA_URL,
                    headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.API_KEY_CONNECTOR_OUTGOING
                    },
                    data: response.data,
                    resolveWithFullResponse: true,
                };
                //console.log("connectorOptions : " + JSON.stringify(connectorOptions, null, 4));

                let resp = await apiCall(connectorOptions);
                if (resp.code === "00") {
                    // console.log("Posted Data Successfully : " + JSON.stringify(resp, null, 4));
                    res.status(200).send({ status: 200, data: [], message: 'Data synced with external system successfully' });
                } else {
                    console.log("executionController.prepareConnectorData - Connector resp.code :" + resp.code);
                    res.status(500).send({ status: 500, data: [], message: 'Unable to connect with Connector API' });
                }
            }catch(error){
                console.log("Error while pushing data to connector :"+ error);
                res.status(response.status).send( error);
            }

        }else{
            console.log("Response from prepareConnectorData : " + JSON.stringify(response, null, 4));
            res.status(response.status).send( response);
        }

    } catch (error) {
        console.log("postDataToConnector: Error posting data to Connector :" + error);
        throw error;
    }
} 

// Function to zip downloaded files and stream the zip
async function zipAndStreamFiles (res, files) {

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="VAssureReports.zip"');
  
    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level
    });

    archive.on('error', (err) => {
        res.status(500).send({ error: err.message });
    });
    archive.pipe(res);

    let fileCount = 0;
    // Add files to the archive
    files.forEach((file) => {
        fileCount++;
        if(file != null)
            archive.file(file, { name: path.basename(file) });
        else
            fileCount--;
    });

    if (fileCount > 0 ){
        await archive.finalize();
    }
    else
        res.status(204).send({ status: 204, message: 'Report(s) not available.' });
//    console.log("Zipped files size: " + archive.pointer()
};

async function execJob(obj, schedule_date){

    if(typeof schedule_date != 'undefined'){
        obj["status"] = "Scheduled";
        obj["schedule_date"] = schedule_date;
        let scheduleExecution = await executionRepo.save(obj);
        if (!_.isEmpty(scheduleExecution)) {
            obj["execution_id"] = scheduleExecution.id
            schedule_jobs[scheduleExecution.id.toString()] = schedule.scheduleJob(schedule_date, async function(obj){
                let result = await executeTestCase(obj,"Scheduled");
                if(result.status != 200){
                    //Update execution table.
                    await executionRepo.updateById({
                        status: "Active",
                        result_status: "ERROR",
                        reason: result.message }, obj.execution_id);
                   // await updateTCwithExcDetails(obj.test_case_id[0], obj.vault, obj._id, "ERROR" );
                }
                //console.log("test_case - result :"+JSON.stringify(result));
            }.bind(null,obj));

            return { status: 200, data: { execution_id: scheduleExecution.id }, message: 'Scheduled successfully' };
        }
        else {
            return { status: 201, data: [], message: 'Something went wrong!' };
        }
    }else{
        //console.log(JSON.stringify(obj));
       let result = await executeTestCase(obj,"Immediate");
       return { status: result.status, data: result.data, message: result.message };
    }
}

async function streamFile(tempDir, filePath, res){
    if(filePath !==  null)
    {
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                console.error('Report not available:', filePath);
                console.log('Error:'+ err);
                res.status(204).send({ status: 204, message: 'Report not available.' });
            }
            else {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'inline; filename="'+path.basename(filePath)+'"');

                const readStream = fs.createReadStream(filePath);
                readStream.pipe(res);

                readStream.on('error', (err) => {
                    console.log('readStream Error:'+ err);
        res.status(201).send({ status: 201, message: err });
    });

                res.on('finish', () => {
                try {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                   // console.log('Temp directory deleted successfully.'+ filePath);
                } catch (err) {
                    console.error('Error deleting temp directory:', err);
                }
                });

                res.on('close', () => {
                  //  console.log('Response closed');
                });

            }
        });
    }
    else{
        console.error('Report not available:', filePath);
        return res.status(204).send('Report not available');
    }

}

async function checkFileExists(s3, reportParams) {
    try {
      const headCommand = new HeadObjectCommand(reportParams);
      await s3.send(headCommand);
      return true; // file exists
    } catch (err) {
      if (err.name === 'NotFound') {
        return false; // headObject threw with NotFound, object doesn't exist
      }
      console.log("checkFileExists Throwing error "+ err.name)
      throw err; // Rethrow other errors
    };
  };


async function apiCall(options) {

   // process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

   // console.log("API Call: "+ JSON.stringify(options, null, 4));
    let response = await new Promise(function (resolve, reject) {
        request(options).then(function (response) {
            resolve({ code: "00", data: {"headers":response.headers, "body": response.data } })
        }).catch(function (error) {

            if (error.response) {
                // The client was given an error response (5xx, 4xx)
                console.log("apiCall: err.response : "+error);
            resolve({ code: "STCERR", data: error.response }) // status code error
                //console.log(err.response.data);
                //console.log(err.response.status);
                //console.log(err.response.headers);
            } else if (error.request) {
                // The client never received a response, and the request was never left
                console.log("apiCall: error.request :"+error);
                resolve({ code: "RETERR", data: error.request }) // request error 
            } else {
                // Anything else
                console.log("apiCall: else unknown error :"+error)
            }
        })
    })
    return response
};

async function initScheduledJob(){
    let obj = {
        status: "Scheduled"
    };
    let execution_result = await executionRepo.getAllByFields(obj);
    execution_result.forEach(element => {
    if(element.schedule_date > new Date()){
            obj = {
                user_id: element.user_id,
                org_code: element.org_code,
                project_id: element.project_id,
                test_suite_id: element.test_suite_id,
                test_case_id: element.test_case_id,
                tag_id: element.tag_id,
                vault: element.vault,
                execution_id:element.id
            };
            schedule_jobs[element.id.toString()] = schedule.scheduleJob(element.schedule_date, async function(obj){
                let result = await executeTestCase(obj,"Scheduled");
                if(result.status != 200){
                    //Update execution table.
                    await executionRepo.updateById({
                        status:"Active",
                        result_status: "ERROR",
                        reason: result.message }, obj.execution_id);
                  //  await updateTCwithExcDetails(obj.test_case_id[0], obj.vault, obj._id, "ERROR" );
                }
            }.bind(null, obj));
             //console.log("After Schedule "+element.id);
        }else{
            executionRepo.updateById({
                status:"Active",
                result_status: "ERROR",
                reason: "schedule time ( " + element.schedule_date +" ) is less then current time " + new Date() }, element.id);
        }
    });
    console.log("Scheduled Jobs initialized... ");
   // console.log(schedule_jobs);
};

async function updateTCwithExcDetails(test_case_id, vault_id, execution_id, result_status, currentDate) {
    try{
       // console.log(" TID :"+ test_case_id+" vault :"+vault_id +" exe :"+ execution_id +" RS :"+ result_status);
  
        let filter = { _id: test_case_id, "last_execution.vault_id": { $eq: vault_id  }};
        
        let testCases = await testCaseRepo.getAllByField(filter);
        if(testCases.length == 0){
          //Insert to last_execution Array
          delete filter["last_execution.vault_id"];
          await testCaseRepo.updateByFieldByAction( filter, { $push: { last_execution: {start_time: currentDate, end_time: null, exec_result: null, vault_id: vault_id, execution_id: execution_id }} }   );
        }else{
  
          if(result_status != null){
            filter["last_execution.execution_id"] = { $eq: execution_id  };
            await testCaseRepo.updateByFieldByAction(filter,{ $set: { "last_execution.$.end_time": currentDate, "last_execution.$.exec_result": result_status} } );
          }else{
            await testCaseRepo.updateByFieldByAction(filter,{ $set: { "last_execution.$.start_time": currentDate, "last_execution.$.end_time": null, "last_execution.$.exec_result": null, "last_execution.$.execution_id": execution_id  }}  );
  
          }
        }
      } catch (err) {
        console.log("Unable to update Test Case last_execution details...error.message : " + err.message );
      }
}; 

async function executeTestCase(testData, action, dryrun = false) {
   // console.log(action+" : "+JSON.stringify(testData));
    
    let vault = await vaultRepo.getById({
        _id: testData.vault
      });

    let JENKINS_BASE_URL = vault.jenkins_base_url;
    let JENKINS_JOB_NAME = vault.jenkins_job_name;
    if (JENKINS_BASE_URL != null || JENKINS_JOB_NAME != null){
        try {

            //   let JENKINS_JOB_NAME = await getJenkinsJobName(projectid);
                // --- first api call to get the que number ---//   
                var jeenks_api = `${JENKINS_BASE_URL}/job/${JENKINS_JOB_NAME}/buildWithParameters?TestCaseID=${testData.tag_id}&ProjectInstanceID=${testData.vault.toString()}`;
    
                var QueueOptions = {
                    'method': 'post',
                    'url': jeenks_api,
                    'headers': {
                    },
                    resolveWithFullResponse: true,
                };
                //console.log("api", QueueOptions)
                // --- extracting que number and storing in data base ---//
                let response = await apiCall(QueueOptions)
                if (response.code == '00') {
                    let responseurl = response.data.headers.location;

                    var parse = require('url-parse')
                    let url = parse(responseurl, true);
                    let queno = url.pathname.split('/')[3];
    
                    //call jenkins api to get build number 
                    var jenkinsAPI = `${JENKINS_BASE_URL}/queue/item/`;
                    let queResponse = jenkinsAPI + queno + '/api/json'
    
                    var options = {
                        'method': 'get',
                        'url': queResponse,
                        'headers': {
                        },
                        resolveWithFullResponse: true,
                    };
    
                    let second_api_response = await apiCall(options);
                    let q_reason = null;
                    if (second_api_response.code == '00') {
    
                        let flag = true;
                        let counter = process.env.EXECUTION_RETRY;
                        let buildno = null
                        try{
                            while (flag) {
                                await delay(5000);    //5sec
                                second_api_response = await apiCall(options);
                                q_reason = second_api_response.data.body.why;
                                if (q_reason == null || (counter <= 1)) {
                                    flag = false;
                                }else{
                                    counter = counter - 1;
                                }
                            }
                            buildno = second_api_response.data.body.executable.number;
                           // console.log("buildno :"+buildno);

                        }catch(err){
                            // console.log("Still in Jenkins Queue, ignore this error."+err);
                            buildno = null;
                        }

                        let obj = {
                            ccInfo: testData.ccInfo,
                            user_id: testData.user_id,
                            org_code: testData.org_code,
                            project_id: testData.project_id,
                            test_suite_id: testData.test_suite_id,
                            test_case_id: testData.test_case_id,
                            tag_id: testData.tag_id,
                            location: response.data.headers.location,
                            que_no: queno,
                            build_no: buildno,
                            reason: q_reason,
                            vault: new mongoose.Types.ObjectId(testData.vault.toString()),
                            dry_run: dryrun
                        };
                        var execution;
                        if(action == "Scheduled"){
                            execution = await executionRepo.updateById({
                                status: "Active",
                                location: response.data.headers.location,
                                que_no: queno,
                                build_no: buildno,
                                reason: q_reason }, testData.execution_id);
                        }else{
                            execution = await executionRepo.save(obj);
                        }
                        if (!_.isEmpty(execution)) {
                            await updateTCwithExcDetails(new mongoose.Types.ObjectId(execution.test_case_id[0]), execution.vault, execution._id, null, execution.createdAt );
                            return { status: 200, data: { execution_id: execution.id, que_no: execution.que_no, build_no: execution.build_no }, message: 'Executions started successfully' };
                        }
                        else {
                            return { status: 201, data: [], message: 'Something went wrong!' };
                        }
    
                    } else {
                        return { status: 201, data: [], message: 'Error in executing 2nd API!' };
                    }
                }else{
                //console.log("Response from Jenkins API : "+JSON.stringify(response, null, 4));
                return { status: 201, data: [], message: 'Something went wrong!' };
                }
            }
            catch (error) {
                console.log("testcase API Error: "+error);
                return { status: 500, message: error.message };
            }
    }else {
        console.log("Jenksins Base URL or Jenkins Job name not set for Project ID: "+testData.projectid );
        return { status: 201, data: [], message: 'Contact Admin SQA:11001' };
    }
};

async function download_report(params, tempDir, s3)  {
    try {
       
        const execution_hist = await EHRepo.getAllByFields(params);
    
        const pdfPath = execution_hist?.[0]?.report_path?.pdf_path;
       
        if (pdfPath) {
            const reportParams = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: pdfPath
            };
            //Check if report exists
            const objectExists = await checkFileExists(s3,reportParams);
            if(objectExists){
                let fn = await downloadFromS3(s3, tempDir, reportParams);
                return fn;
            }
        }
        return null;
    } catch (error) {
        console.log("download_report Exception :" + error);
        return null;
    }
};

const delay = async (ms) => {
    return await new Promise(resolve => setTimeout(resolve, ms));
};

async function downloadFromS3(s3, tempDir, reportParams) {
    const downloadPath = path.join(tempDir, reportParams.Key);
    fs.mkdirSync(path.dirname(downloadPath), { recursive: true });

    const getCommand = new GetObjectCommand(reportParams);
    const data = await s3.send(getCommand);
    const fileStream = fs.createWriteStream(downloadPath);

    return new Promise((resolve, reject) => {
        data.Body.pipe(fileStream);

        fileStream.on('error', (err) => {
            console.error('Error writing to file: '+ reportParams.Key, err);
            reject(err);
        });

        data.Body.on('error', (err) => {
            console.error('Error reading from S3: '+ reportParams.Key, err);
            reject(err);
    });

        data.Body.on('end', () => {
          //  console.log('Stream ended');
    });

        fileStream.on('finish', () => {
          //  console.log("S3 download completed...");
            resolve(downloadPath);
    });
    });
}



module.exports = new executionController();
