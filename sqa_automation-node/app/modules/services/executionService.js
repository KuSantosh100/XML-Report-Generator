const mongoose = require('mongoose');
const executionRepo = require('execution/repositories/execution.repository');
const vaultRepo = require("vault/repositories/vault.repository");
const testCaseRepo = require('test_case/repositories/test_case.repository');
const ExecutionStepsOutputRepo = require('executed_steps_output/repositories/executed_steps_output.repository');
const EHRepo = require('execution_history/repositories/execution_history.repository');
const executionReqRepo = require('execution_request/repositories/execution_request.repository');

const projectRepo = require("project/repositories/project.repository");
const executionHisRepo = require("execution_history/repositories/execution_history.repository");
const organisationRepo = require("organisation/repositories/organisation.repository");
const testDataRepo = require("test_case_data/repositories/test_case_data.repository");
const userRepo = require('user/repositories/user.repository');
const { Upload } = require('@aws-sdk/lib-storage');
const { S3Client} = require('@aws-sdk/client-s3');
const PdfPrinter = require("pdfmake");
const pdfGenServ = require('services/pdfGenService');

const fonts = {
  Courier: {
    normal: "Courier",
    bold: "Courier-Bold",
    italics: "Courier-Oblique",
    bolditalics: "Courier-BoldOblique",
  },
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
  Times: {
    normal: "Times-Roman",
    bold: "Times-Bold",
    italics: "Times-Italic",
    bolditalics: "Times-BoldItalic",
  },
};


const request = require('axios');

class executionService {
    constructor() { }

    async executeTestCase(testData, action, dryrun = false) {
    // console.log(action+" : "+JSON.stringify(testData));
        
        let vault = await vaultRepo.getById(testData.vault_id);
        //console.log("vault : "+JSON.stringify(vault));

        let JENKINS_BASE_URL = vault.jenkins_base_url;
        let JENKINS_JOB_NAME = vault.jenkins_job_name;
        if (JENKINS_BASE_URL != null || JENKINS_JOB_NAME != null){
            try {

                //   let JENKINS_JOB_NAME = await getJenkinsJobName(projectid);
                    // --- first api call to get the que number ---//   
                    var jeenks_api = `${JENKINS_BASE_URL}/job/${JENKINS_JOB_NAME}/buildWithParameters?TestCaseID=${testData.tag_id}&ProjectInstanceID=${testData.vault_id.toString()}`;
        
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
                                vault: new mongoose.Types.ObjectId(testData.vault_id.toString()),
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

    async prepareConnectorData(execution_id, reqType = null){

        try {

            console.log("execution_id: "+JSON.stringify(execution_id, null, 2));
            const exeHistData = await EHRepo.getById(new mongoose.Types.ObjectId(execution_id) );
            if(!_.isEmpty(exeHistData)){
                let execReq_qry_parm = {testcase_id: exeHistData.test_case_id[0]._id, execution_id: execution_id, status:{ $in: ["READY_AUTOMATION", "READY_EXECUTION"] }};
                if(reqType === 'Automation'){
                    execReq_qry_parm = {testcase_id: exeHistData.test_case_id[0]._id, status:"READY_AUTOMATION" };
                }
                let exeReq = await executionReqRepo.getByField(execReq_qry_parm);
                if (_.isEmpty(exeReq)) {
                    return { status: 201, data: [], message: "Execution request not found for test case id : " + exeHistData.test_case_id[0].test_case_id };
                }
    
                if(reqType === 'Automation'){
                    console.log("updating exeuction_id from History in execution_request " + exeReq[0]._id);
                    await executionReqRepo.updateById(exeReq[0]._id, {execution_id: execution_id} );
                }
    
                let steps = exeReq[0].test_case_steps;
    
                const exc_records = await ExecutionStepsOutputRepo.getStepsByQueryWithProjection({
                    execution_id: execution_id,
                    type:'Execution Step'
                });
                //console.log("records: "+JSON.stringify(exc_records, null, 2));
    
                const mapSourceIdToStepNo = (steps, records) => {
                    return records.map(record => {
                        const matchingStep = steps.find(step => step.step_no === record.step_no && step.step_type === "Execution Step");
                        
                        if (matchingStep) {
                        const { step_no, ...rest } = record; 
                        return {
                            ...rest,
                            source_id: matchingStep.source_id
                        };
                        }
                        return null;
                    }).filter(record => record !== null);;
                };
    
                const testCaseResult = mapSourceIdToStepNo(steps, exc_records);
                //console.log("testCaseResult: "+JSON.stringify(testCaseResult, null, 2));
    
                let data={ 
                    "requestId": exeReq[0].request_id,
                    "dryRun_object_id": exeReq[0].dryRun_object_id,
                    "orgId": exeReq[0].org_code,
                    "source_script_id": exeReq?.[0]?.source_req_body?.testCase?.source_script_id ?? null,
                    "records": testCaseResult,
                    "buildNumber": exeHistData?.build_no ?? null,
                    "bucketName": process.env.AWS_BUCKET_NAME,
                    "reportS3Path": exeHistData?.report_path?.pdf_path ?? null,
                    "execution_vault": exeReq[0].execution_vault,
                    "execution_type": exeReq[0].execution_type,
                    "executionStatus": exeHistData?.result_status ?? "FAILED",
                    "connector_url": exeReq[0].connector_url
                }
    
              //  console.log("data: "+JSON.stringify(data, null, 2));
    
                return { status: 200, data: data, message: 'Data prepared successfully' };
            }else{
                return { status: 201, data: [], message: "prepareConnectorData: Execution record not found for execution Id : " +JSON.stringify(execution_id, null, 4)};
            }
            
        } catch (error) {
            let data={ 
                "requestId": exeReq[0].request_id,
                "dryRun_object_id": exeReq[0].dryRun_object_id,
                "orgId": exeReq[0].org_code,
                "source_script_id": exeReq?.[0]?.source_req_body?.testCase?.source_script_id ?? null,
                "records": testCaseResult,
                "buildNumber": exeHistData?.build_no ?? null,
                "bucketName": process.env.AWS_BUCKET_NAME,
                "reportS3Path": exeHistData?.report_path?.pdf_path ?? null,
                "execution_vault": exeReq[0].execution_vault,
                "execution_type": exeReq[0].execution_type,
                "executionStatus": exeHistData?.result_status ?? "FAILED",
                "connector_url": exeReq[0].connector_url
            }
            return { status: 200, data: data, message: 'Data prepared successfully' };
        }

    };

    async createPreExeuctionReport(obj){
        try {

            let vault = await vaultRepo.getById({
            _id: obj.vault_id
            });

            //console.log( obj.testsuite_data.org_code._id +" : "+ obj.testsuite_data.project_code.type);

            let testData = await testDataRepo.getByField({
                org_code: obj.testsuite_data.org_code._id,
                project_type: obj.testsuite_data.project_code.type } );

            // console.log("testData : "+JSON.stringify(testData, null, 2));
            if(!_.isEmpty( obj.test_case_data)) {
                testData.Approver = ( obj.test_case_data.Approver ?  obj.test_case_data.Approver : testData.Approver);
                testData.QualityApprover = ( obj.test_case_data.QualityApprover ?  obj.test_case_data.QualityApprover : testData.QualityApprover);
            }
            const firstPage = {
                firstPageContent1: obj.testsuite_data.project_code.project_name,
                firstPageContent2: obj.testsuite_data.org_code.org_name,
                firstPageContent3: "Spotline",
                veevaRelease: (obj.testsuite_data.project_code.supported_vault_release != null ? obj.testsuite_data.project_code.supported_vault_release : "NA" ),
                veevaVaultID: (vault != null ? vault.veeva_vault_id : "NA" ),
                vaultName: (vault != null ? vault.vault_name : "NA" ),
                vaultURL: (vault != null ? vault.url : "https://login.veevavault.com" ),
                vaultEnvironment: (vault != null ? vault.vault_env : "NA" ),
                productVersion: (vault != null && vault.product_version) ? vault.product_version : "NA",
                'ccInfo': obj.ccInfo,
                'testData': testData,
                'userID': obj.user_id,
                'test_suite_id': obj.test_case_data.test_suite_code._id,
                'project_id': obj.testsuite_data.project_code._id
            };
            //console.log("firstPage : "+JSON.stringify(firstPage, null, 2));

            let pdfDoc;
            try{
                let printer = new PdfPrinter(fonts);
                let docDefinition = await pdfGenServ.createTemplateBodyFromDB(firstPage, obj.test_case_data);
    
                pdfDoc = await printer.createPdfKitDocument(docDefinition, {});
                pdfDoc.end();
            }catch(error){
                console.error("Error creating Pre Exeuction Report", error);
                return { code: 400, message : "Something went Wrong in generating Template - " + error};
            }

            //console.log("obj :" + JSON.stringify(obj, null, 2));
            // const fs = require("fs");
            // await pdfDoc.pipe(fs.createWriteStream('C:/Users/sdasi/Downloads/Template.pdf'));

            //generate history record for template
            let hist_obj = {
                ccInfo: {},
                user_id: obj.user_id,
                org_code: obj.testsuite_data.org_code._id,
                status: 'Active',
                isDeleted: false,
                project_id: obj.testsuite_data.project_code._id,
                test_suite_id: obj.testsuite_data._id,
                test_case_id: [obj.test_case_data._id],
                tag_id: [obj.test_case_data.tag_id],
                build_no: -1,
                result_status: 'SUCCESS',
                execution_date: new Date(),
                reason: obj.comments,
                vault: obj.vault_id,
                cron_status: "DONE",
                dry_run: true
              };
            let savobj = await executionHisRepo.save(hist_obj);
            if (savobj == null) {
                console.log("Unable to save to Hist : " +JSON.stringify(hist_obj, null, 2) );
            }else{
                //console.log("savobj :" + JSON.stringify(savobj, null, 2));
            
                const s3 = new S3Client({
                    region: process.env.AWS_REGION,
                    credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    }
                    });
    
                const upload = new Upload({
                        client: s3,
                        params: {
                            Bucket: process.env.AWS_BUCKET_NAME,
                            Key: `${obj.testsuite_data.project_code._id}/${savobj._id}-report.pdf`,
                            Body: pdfDoc,
                            ContentType: 'application/pdf'
                        }
                    });
                try {
                    await upload.done();
                } catch (error) {
                    console.error("Error uploading Pre Exeuction Report to S3", error);
                    return { code: 400, message : "Error uploading Pre Exeuction Report to S3 - " + error};
                }
                
                let hist_upd = {
                        end_date:  new Date(),
                        report_path : { "pdf_path" : `${obj.testsuite_data.project_code._id}/${savobj._id}-report.pdf` },
                        estimated_duration: (new Date().getTime() - savobj.execution_date.getTime() ).toString()
                    };
                await executionHisRepo.updateById(hist_upd, savobj._id);
                let resp = {
                        report_path : `${obj.testsuite_data.project_code._id}/${savobj._id}-report.pdf`,
                        execution_id: savobj._id
                    };
                return { code: 200, message : resp }; 
            }

        } catch (error) {
            console.error("executionService.createPreExeuctionReport: ", error);
            return { code: 400, message : "executionService.createPreExeuctionReport: - " + error};
        }
    };
}

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

module.exports = new executionService();