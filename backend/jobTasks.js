const mongoose = require("mongoose");
const projectRepo = require("project/repositories/project.repository");
const executionRepo = require("execution/repositories/execution.repository");
const executionHisRepo = require("execution_history/repositories/execution_history.repository");
const organisationRepo = require("organisation/repositories/organisation.repository");
const testDataRepo = require("test_case_data/repositories/test_case_data.repository");
const userRepo = require('user/repositories/user.repository');
const vaultRepo = require("vault/repositories/vault.repository");
const mailer = require('./app/modules/util/mailer.js');
const testCaseRepo = require('test_case/repositories/test_case.repository');
const executionServ = require('services/executionService');
const executionReqRepo = require('execution_request/repositories/execution_request.repository');

const request = require("axios");
const { Upload } = require('@aws-sdk/lib-storage');
const { S3Client, HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const PdfPrinter = require("pdfmake");
const PDFGen = require("util/pdfGenerator");

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


async function executeCron() {
 // console.log("started executeCron...");
  let exeParam = {
    status: "Active",
    isDeleted: false
  };

  try {
    let excRecords = await executionRepo.getAllByFields(exeParam);

    const promises = excRecords.map(async (element) => {
      let que_no = element.que_no;
      let buildNumber = element.build_no;
      let currentDate = new Date();

      if (
        element.result_status == "ABORTED" ||
        element.result_status == "ERROR"
      ) {
        await moveToHistory(element, "", "DONE", currentDate);
        return;
      }
      let vault = await vaultRepo.getById({
        _id: element.vault
      });
      let JENKINS_BASE_URL = vault.jenkins_base_url;
      let JENKINS_JOB_NAME = vault.jenkins_job_name;

      if (JENKINS_BASE_URL != null || JENKINS_JOB_NAME != null){
      if ( element.result_status == "FAILURE" || element.result_status == "SUCCESS" ) 
      {
        try {
          const s3 = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          });

          const reportParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `${element.project_id}/${element._id}-report.pdf`,
          };
          //Check if report exists

          const objectExists = await checkFileExists(s3, reportParams);

          if (objectExists) {
            currentDate = new Date();
            console.log("File already exists..." + reportParams.Key);
            element["report_path"] = { "pdf_path": reportParams.Key };
            await moveToHistory(element, "", "DONE", currentDate);
          } else {
            let uploadStatus = await uploadToS3(
              buildNumber,
              element.project_id,
              element.vault,
              element.dry_run,
              element.ccInfo,
              element.user_id,
              element.test_suite_id,
              element.tag_id[0],
              element._id,
              element.test_case_id[0]
            );

            if (uploadStatus !== null) {
              currentDate = new Date();
              console.log( "Not able to upload to S3 build_no:" + buildNumber + " project_id :" + element.project_id );
              await moveToHistory(element, uploadStatus, "ERROR", currentDate);
             // await updateTCwithExcDetails(element.test_case_id[0], element.vault, element._id, "ERROR", currentDate);
            } else {
              currentDate = new Date();
              console.log("Upload successful : " + reportParams.Key);
              element["report_path"] = { "pdf_path": reportParams.Key };

              await moveToHistory(element, "", "DONE", currentDate );
            }
          }
        } catch (error) {
          console.log("moveToHistory Exception :" + error);
        }
      } else {
          
        let excID = new mongoose.Types.ObjectId(element._id);

        if (typeof buildNumber === "undefined" || buildNumber === null) {
            var jenkinsAPI = `${JENKINS_BASE_URL}/queue/item/`;
          let queResponse = jenkinsAPI + que_no + "/api/json";
          let optionsQue = {
            method: "GET",
            url: queResponse,
            headers: {},
            resolveWithFullResponse: true,
          };
          //console.log("queResponse ->" + queResponse);
          let response = await apiCall(optionsQue);
          if (response.code == "00") {
            let reason = response.data.body.why;
            //console.log("response code 00 " + JSON.stringify(response, null, 4));
            if (reason == null) {
              let buildno = response.data.body.executable.number;
              let buildresp = await checkJenkinsAPIBuild(
                excID,
                  JENKINS_BASE_URL,
                  JENKINS_JOB_NAME,
                  buildno,
                  currentDate
                );
                if (buildresp != null) {
                  currentDate = new Date();
                  await moveToHistory(element, buildresp, "ERROR", currentDate);
                 // await updateTCwithExcDetails(element.test_case_id[0], element.vault, element._id, "ERROR", currentDate );

                }
              } else {
                //Ignore this...
              //  console.log(element._id + " Blocked reason: " + reason);
              }
            } else {
              currentDate = new Date();
              await moveToHistory(element, response, "ERROR", currentDate);
             // await updateTCwithExcDetails(element.test_case_id[0], element.vault, element._id, "ERROR", currentDate );

            }
          } else {
            currentDate = new Date();
            //Check Jenkins with build number
            let buildresp = await checkJenkinsAPIBuild(
              excID,
              JENKINS_BASE_URL,
              JENKINS_JOB_NAME,
              buildNumber,
              currentDate
            );
            if (buildresp != null) {
              await moveToHistory(element, buildresp, "ERROR", currentDate);
            //  await updateTCwithExcDetails(element.test_case_id[0], element.vault, element._id, "ERROR", currentDate );
            }
          }
        }
      } else {
        console.log("Jenksins Base URL or Jenkins Job name not set for Project ID: "+element._id );
    }
     // console.log("execution Completed for ID: "+element._id);
    });
    await Promise.all(promises);
  } catch (err) {
    console.log(err);
  }
 // console.log("Queno execution done........");
}

async function checkJenkinsAPIBuild(excID,JENKINS_BASE_URL, jobname, buildno, currentDate) {
  let queResponse1 = `${JENKINS_BASE_URL}/job/${jobname}/${buildno}/api/json`;
  let options = {
    method: "GET",
    url: queResponse1,
    headers: {},
    resolveWithFullResponse: true,
  };
  //console.log("options : "+JSON.stringify(options));
  let response3 = await apiCall(options);
  if (response3.code == "00") {
    let resultStatus = response3.data.body.result;
    let buildTimeDuration = response3.data.body.estimatedDuration
    let obj = {
      build_no: buildno,
      result_status: resultStatus,
      reason: null,
      estimated_duration: buildTimeDuration
    };
    let execution = await executionRepo.updateById(obj, excID);
    if (!_.isEmpty(execution)) {
    //  console.log( "jobTasks: que_no:" + execution.que_no + " buildNumber :" + execution.build_no + "result_status:" + execution.result_status );
    if (!_.isEmpty(resultStatus)) //Update only if restStatus is not null SUCCESS/FAILURE
      {
        //Update End time in execution
        let execution = await executionRepo.updateById({ end_date: currentDate }, excID);
       // await updateTCwithExcDetails(execution.test_case_id[0], execution.vault, excID, resultStatus, currentDate );
      }
    } else {
      console.log( "Something went wrong while updating db: executions table for _id : " + excID );
      return response3;
    }
  } else {
    console.log( "Error in executing Jenkins api with build no " +buildno + "  for executions id : " + excID );
    return response3;
  }
  return null;
}

async function moveToHistory(element, msg, recstatus, currentDate) {
  //console.log("------------>"+ JSON.stringify(element));
  let delres = await executionRepo.delete(element._id);
  let message = "";

  if (delres != null && delres.deletedCount === 1) {
    try {
      message = JSON.stringify(msg, null, 4)
    } catch (error) {
      message = "Error in JSON.stringify"
    }

    if (element.result_status == "" ||element.result_status == null ){
      element.result_status ="ERROR"
    }
    if (!_.isEmpty(element.end_date)) 
      currentDate = element.end_date;

    let obj = {
      _id: element._id,
      ccInfo: element.ccInfo,
      user_id: element.user_id,
      org_code: element.org_code,
      executed: element.executed,
      progress_percent: element.progress_percent,
      status: element.status,
      isDeleted: element.isDeleted,
      project_id: element.project_id,
      test_suite_id: element.test_suite_id,
      test_case_id: element.test_case_id,
      tag_id: element.tag_id,
      location: element.location,
      build_no: element.build_no,
      que_no: element.que_no,
      result_status: element.result_status,
      report_url: element.report_url,
      execution_date: element.createdAt,
      end_date: currentDate,
      estimated_duration: element.estimated_duration,
      reason: element.reason ,
      vault: element.vault,
      cron_status: recstatus,
      cron_msg: message,
      dry_run: element.dry_run,
      report_path: (element.report_path ? element.report_path : null)
    };
    try {
      let savobj = await executionHisRepo.save(obj);
      if (savobj == null) {
        console.log("Unable to save to Hist, so saving back to execution...." );
        await executionRepo.save(element.toJSON());
      }else {
        try{
          //Update Test Case Last execution details
          await updateTCwithExcDetails(element.test_case_id[0], element.vault, element._id, element.result_status, currentDate );
          let user = await userRepo.getById(new mongoose.Types.ObjectId(element.user_id));
          let proj = await projectRepo.getById(new mongoose.Types.ObjectId(element.project_id));
          if (!_.isEmpty(user)) {
            let locals = {
              //user: (proj.notification_email) ? proj.notification_email : user.full_name,
              user: (proj.notification_email) ? "Team" : user[0].full_name,
              status: element.result_status
            };
            if (user[0].notification_preference == "Enable All Notifications"){
              let isMailSend = await mailer.sendMail(
                `V-Assure<${process.env.MAIL_USERNAME}>`,
                (proj.notification_email) ? proj.notification_email : user[0].email,
                "Job Execution Status",
                "job-completion",
                locals
              );
            }else if (proj.notification_email =="Notify on successful completions" && element.result_status == "SUCCESS" ){
              let isMailSend = await mailer.sendMail(
                `V-Assure<${process.env.MAIL_USERNAME}>`,
                (proj.notification_email) ? proj.notification_email : user[0].email,
                "Job Execution Status",
                "job-completion",
                locals
              );
            }else if (user[0].notification_preference =="Notify on errors only" && (  element.result_status == "FAILURE" || element.result_status == "ERROR" )){
              let isMailSend = await mailer.sendMail(
                `V-Assure<${process.env.MAIL_USERNAME}>`,
                (proj.notification_email) ? proj.notification_email : user[0].email,
                "Job Execution Status",
                "job-completion",
                locals
              );
            }

          }
        }catch (err){
          console.log("Unable to send an email :"+err);
        }
        //Call connector ....
        // skip if not a VAssure connector request 
        let execReq_qry_parm = {testcase_id: element.test_case_id[0], org_code : element.org_code, execution_id: element._id, status:"READY_EXECUTION"};
        //console.log("execReq_qry_parm request response :"+JSON.stringify(execReq_qry_parm));

        let exeReq = await executionReqRepo.getByField(execReq_qry_parm);
        if (!_.isEmpty(exeReq)) {
          // let execReq_qry= { execution_id : element._id, status:"READY_EXECUTION"};
          let response = await executionServ.prepareConnectorData(element._id);
          delete response.data.connector_url;
          if(response.status === 200){
              try{
                let connectorOptions = {
                  method: "POST",
                  url:  exeReq[0].connector_url,//process.env.CONNECTOR_SYNC_DATA_URL,
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.API_KEY_CONNECTOR_OUTGOING
                  },
                  data: response.data,
                  resolveWithFullResponse: true,
                };
                console.log("connectorOptions : " + JSON.stringify(connectorOptions, null, 4));

               let resp = await apiCall(connectorOptions);
                if (resp.code === "00") {
                    console.log("Posted Data Successfully : " + JSON.stringify(resp, null, 4));
                } else {
                    console.log("Error in Posting Data :" + JSON.stringify(resp, null, 4));
                }
            }catch(error){
              console.log("Problem in connecting connector api");
            }
          }else{
            //Ignore..
            console.log("Ignore Connector request response :"+JSON.stringify(response));
          }
        }else{
          // console.log("No execution request found for "+ execReq_qry_parm);
        }
        
      }
    } catch (err) {
      console.log(
        "Error occured while moving to history ...error.message : " + err.message );
        console.log("Execution Record : " + JSON.stringify(element.toJSON(), null, 4));
        //await executionRepo.save(element.toJSON());
    }
  } else {
    console.log("problem in deleting from execution" + element._id);
  }
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

async function checkFileExists(s3, reportParams) {
  try {
    const headCommand = new HeadObjectCommand(reportParams);
    await s3.send(headCommand);
    return true; // file exists
  } catch (err) {
    if (err.name === 'NotFound') {
      return false; // headObject threw with NotFound, object doesn't exist
    }
    throw err; // Rethrow other errors
  };
}

async function uploadToS3(build_no, project_id, vault_id, dryrun, ccInfo, userID, test_suite_id, tag_id_val, exec_id, test_case_id) {
  let projectid = new mongoose.Types.ObjectId(project_id);

  let vault = await vaultRepo.getById({
    _id: vault_id
  });

  let projObj = {
    _id: projectid,
    isDeleted: false,
  };
  let projectDetails = await projectRepo.getByField(projObj);

  let JENKINS_BASE_URL = vault.jenkins_base_url;
  let JENKINS_JOB_NAME = vault.jenkins_job_name;
  let printer = new PdfPrinter(fonts);
  if (JENKINS_BASE_URL != null || JENKINS_JOB_NAME != null){
    try {
      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      });
  
      let testCase = await testCaseRepo.getById({
        _id: test_case_id
      });
  
      //  output.xml from Jenkins
      let xmlJenkinsUrl =  `${JENKINS_BASE_URL}/job/${JENKINS_JOB_NAME}/${build_no}/robot/report/output.xml`;
  
      let xmloptions = {
        method: "POST",
        url: xmlJenkinsUrl,
        headers: {},
        resolveWithFullResponse: true,
      };
      console.log(xmloptions);
      let resp = await apiCall(xmloptions);
      //console.log("XML from Jekins response: "+JSON.stringify(resp, null, 4));
      if (resp.code === "00") {
        //console.log("resp.code 00 ..." + xmlJenkinsUrl);
        //Upload output.xml to S3
        let paramsXml = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: `${project_id}/${exec_id}-output.xml`,
          Body: resp.data.body,
        };
        try {
          await s3.send(new PutObjectCommand(paramsXml));
        } catch (s3Err) {
            console.log("jobTasks.uploadToS3 s3.send .html error....."+s3Err);
              return s3Err;
            }

          let testData = await testDataRepo.getByField({
            org_code: projectDetails.org_code._id,
            project_type: projectDetails.type
          });          
          
          let testCaseData = await testCaseRepo.getAllByField({
            test_suite_code: test_suite_id,
            tag_id: tag_id_val
          });
          if(!_.isEmpty(testCaseData))
          {
            testData.Approver = (testCaseData[0].Approver ? testCaseData[0].Approver : testData.Approver);
            testData.QualityApprover = (testCaseData[0].QualityApprover ? testCaseData[0].QualityApprover : testData.QualityApprover);
          }
        //Convert output.xml to PDF and upload to S3 then return S3 url
        const firstPage = {
          firstPageContent1: projectDetails.project_name,
          firstPageContent2: projectDetails.org_code.org_name,
          firstPageContent3: "Spotline",
          veevaRelease: (projectDetails.supported_vault_release != null ? projectDetails.supported_vault_release : "NA" ),
          veevaVaultID: (vault != null ? vault.veeva_vault_id : "NA" ),
          vaultName: (vault != null ? vault.vault_name : "NA" ),
          vaultURL: (vault != null ? vault.url : "https://login.veevavault.com" ),
          vaultEnvironment: (vault != null ? vault.vault_env : "NA" ),
          productVersion: (vault != null && vault.product_version) ? vault.product_version : "NA",
          'ccInfo': ccInfo,
          'testData': testData,
          'userID': userID,
          'test_suite_id': test_suite_id,
          'execution_id': exec_id,
          'project_id': projectDetails._id
        };

      let docDefinition = await PDFGen.generatePDF(resp.data.body, firstPage, new mongoose.Types.ObjectId(projectDetails.org_code._id), build_no, dryrun);

        // Pass 1: measure each ILB's vertical position on its page.
        // ratio ˜ 0 means the ILB is the very first content on its page (overflowed alone ? remove).
        // ratio >= 0.5 means content already fills more than half the page (not much blank space ? remove).
        const ilbData = [];
        docDefinition.pageBreakBefore = function (currentNode) {
          if (currentNode.text === 'Intentionally Left Blank') {
            ilbData.push({ ratio: currentNode.startPosition?.verticalRatio ?? 0 });
          }
          return false;
        };
        printer.createPdfKitDocument(docDefinition);
        delete docDefinition.pageBreakBefore;

        let ilbIdx = 0;
        docDefinition.content = docDefinition.content.filter(node => {
          if (node.text === 'Intentionally Left Blank') {
            const r = ilbData[ilbIdx++]?.ratio ?? 0;
            if (r < 0.001 || r >= 0.5) return false;
              node.margin = [0, 20, 0, 0];
            }
          return true;
        });

        // Pass 2: final PDF
        let pdfDoc = printer.createPdfKitDocument(docDefinition, {});
        pdfDoc.end();
  
      const upload = new Upload({
        client: s3,
        params: {
          Bucket: process.env.AWS_BUCKET_NAME,
              Key: `${project_id}/${exec_id}-report.pdf`,
          Body: pdfDoc,
          ContentType: 'application/pdf'
            }
      });

      try {
          const data = await upload.done();
      } catch (err) {
          console.error("Error uploading PDF to S3", err);
            }

      } else {
       // console.log("resp.code not 00 ..." + xmlJenkinsUrl);
        //console.log( "Response for output.xml with status code error :" + JSON.stringify(resp, null, 4) );
        return resp;
      }
  
      //Upload report.html to S3
      let reportJenkinsUrl = `${JENKINS_BASE_URL}/job/${JENKINS_JOB_NAME}/${build_no}/robot/report/log.html`;
  
      // console.log(reportJenkinsUrl);
      let options = {
        method: "POST",
        url: reportJenkinsUrl,
        headers: {},
        resolveWithFullResponse: true,
      };
      //console.log(options);
      let response = await apiCall(options);
  
      if (response.code === "00") {
        const params = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: `${project_id}/${exec_id}-report.html`,
          Body: response.data.body,
        };
  
        try {
          await s3.send(new PutObjectCommand(params));
        } catch (s3Err) {
          console.log("jobTasks.uploadToS3 s3.send .Pdf error....."+s3Err);
              return s3Err;
            }
      } else {
        //console.log( "Response log.html with status code error :" + JSON.stringify(response, null, 4) );
        return response;
      }
    } catch (error) {
      console.log("UploadToS3 Exception :" + error);
      return error;
    }
  } else {
    console.log("Jenksins Base URL or Jenkins Job name not set for Project ID: "+element._id );
    return "Jenksins Base URL or Jenkins Job name not set for Project ID: " + element._id;
}
  return null;
}

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
}

module.exports = { executeCron };
