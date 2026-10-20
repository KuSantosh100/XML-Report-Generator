require('dotenv').config();
const xmldoc = require('xmldoc');
var moment = require('moment-timezone');
const RptCnfRepo = require('report_config/repositories/report_config.repository');
const test_caseRepo = require('test_case/repositories/test_case.repository');
const userRepo = require('user/repositories/user.repository');
const appInfoRepo = require('app_info/repositories/app_info.repository');
const testSuiteRepo = require('test_suite/repositories/test_suite.repository');
const testCaseStepsResultsRepo = require('executed_steps_output/repositories/executed_steps_output.repository');
const { default: mongoose } = require('mongoose');
const { Upload } = require('@aws-sdk/lib-storage');
const { S3Client } = require('@aws-sdk/client-s3');
const executionReqRepo = require('execution_request/repositories/execution_request.repository');

var suite;

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});
    
function buildReportTableBodyData(data, xmlType, gCtx) {
    let document = new xmldoc.XmlDocument(data);

	suite = new Array();
    
    let suiteTag = document.descendantWithPath('suite');
    // console.log("--->"+suiteTag.valueWithPath("status@start") + " ---> "+suiteTag.valueWithPath("status@elapsed"))
    if (typeof suiteTag.valueWithPath("status@starttime") != 'undefined'){
        suite.push({
            status: suiteTag.valueWithPath("status@status"),
            startTime: moment.utc(suiteTag.valueWithPath("status@starttime"),"YYYYMMDD HH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss [GMT]Z").toUpperCase(),
            endTime: moment.utc(suiteTag.valueWithPath("status@endtime"),"YYYYMMDD HH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss [GMT]Z").toUpperCase(),
            timeZone: moment.utc(suiteTag.valueWithPath("status@endtime"),"YYYYMMDD HH:mm:ss.SSS").tz("America/Los_Angeles").format("[GMT] Z")
        });
    }else{
        let endtime = moment.utc(suiteTag.valueWithPath("status@start"),"YYYY-MM-DDTHH:mm:ss.SSS").add(suiteTag.valueWithPath("status@elapsed"), 'seconds');
        suite.push({
            status: suiteTag.valueWithPath("status@status"),
            startTime: moment.utc(suiteTag.valueWithPath("status@start"),"YYYY-MM-DDTHH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss [GMT]Z").toUpperCase(),
            endTime: endtime.tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss [GMT]Z").toUpperCase(),
            timeZone: endtime.tz("America/Los_Angeles").format("[GMT] Z")
        });
       // console.log("--->"+suiteTag.valueWithPath("status@start") + " ---> "+suiteTag.valueWithPath("status@elapsed"))
       // console.log(suite)
   }

    checkAddTestSuiteElement(suiteTag, gCtx);
   // console.log("testSuiteElement --->"+ testSuiteElement)
    gCtx.testSuiteElement.forEach(element => {
        readSuite(element, xmlType, gCtx);
    });
    return suite;
} //end of function

function checkAddTestSuiteElement(tmpTag, gCtx){

    if(tmpTag.childrenNamed("test").length>0){
        gCtx.testSuiteElement.push(tmpTag);
    }else{
        tmpTag.childrenNamed("suite").forEach(function (suiteEle){
            checkAddTestSuiteElement(suiteEle, gCtx);
        });
    }
}
//Read Test Suite
function readSuite( tmpSuite, xmlType, gCtx ){
    let suiteName = tmpSuite.attr.name;
    let scriptVersion = "";
    tmpSuite.eachChild(function (testNode) {
        
        if (testNode.name === 'test') {

            gCtx.requirementIDs =[];

            let testName = testNode.attr.name;
            let testStatus = "NA";
            let sTime = "NA";
            let eTime = "NA";
            let tID = "NA";

            if(typeof testNode.valueWithPath("doc") != 'undefined'){
                    testName = testNode.valueWithPath("doc");
            }

            if(typeof testNode.valueWithPath("status") != 'undefined'){

                if (typeof testNode.valueWithPath("status@starttime") != 'undefined'){
                    testStatus = testNode.valueWithPath("status@status");
                    sTime = moment.utc(testNode.valueWithPath("status@starttime"),"YYYYMMDD HH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss").toUpperCase();
                    eTime = moment.utc(testNode.valueWithPath("status@endtime"),"YYYYMMDD HH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss").toUpperCase();
                }else{
                    let endtime = moment.utc(testNode.valueWithPath("status@start"),"YYYY-MM-DDTHH:mm:ss.SSS").add(testNode.valueWithPath("status@elapsed"), 'seconds');

                    testStatus = testNode.valueWithPath("status@status");
                    sTime = moment.utc(testNode.valueWithPath("status@start"),"YYYYMMDD HH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss").toUpperCase();
                    eTime = endtime.tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss").toUpperCase();
               }
                //console.log("readSuite: "+testStatus +" : "+ sTime+" : "+ eTime);
            }
        
            //script version
            testNode.childrenNamed("tag").forEach(function (tag){
                //console.log( "tag :" + tag.val)
                if(tag.val.includes("ScriptVersion")){
                    scriptVersion = tag.val.split(":")[1]
                } else if(tag.val.includes("veevaVaultVersion")){
                    gCtx.veevaVaultVersion = tag.val.split(":")[1]
                } else if(tag.val.includes("robot:")){
                    // Ignore robot tags.
                } else {
                    tID = tag.val;
                   // console.log("Test Tag : "+tag.val);
                }
            });
            //iterate through individual test cases.
            //let rowCount = 1;
            let prereq = null;
            let reqs = {}
            testNode.eachChild(function (keyWord) {

                if (typeof keyWord !== 'undefined' && keyWord && keyWord.name == 'try' ) {
                    keyWord.childrenNamed("branch").forEach(function (branch){
                        branch.eachChild(function (inBranch){
                            processElement(inBranch)
                        });
                    });
                }else 
                    processElement(keyWord)
                function processElement(keyWord){
                    if (typeof keyWord !== 'undefined' && keyWord && keyWord.name == 'try' ) {
                        keyWord.childrenNamed("branch").forEach(function (branch){
                            branch.eachChild(function (inBranch){
                                processElement(inBranch)
                            });
                        });
                    }else if(typeof keyWord !== 'undefined' && keyWord && keyWord.name == 'kw') {
                    gCtx.capturetag = new Array();
                    
                    if(typeof keyWord.valueWithPath("tag") != 'undefined' ) {
                        if (keyWord.valueWithPath("tag") == "pre_requisite") {
                            let prestep = [];
                            let docID = "";
                            let failureMessage = "";
                            keyWord.eachChild(function (ele){
                                if (typeof ele !== 'undefined' && ele && ele.name == "try"){
                                    ele.childrenNamed("branch").forEach(function(branch){
                                        var branchType = branch.attr && branch.attr.type;
                                        branch.eachChild(function(inBranch){
                                            if (typeof inBranch === 'undefined' || !inBranch) return;
                                            if (branchType === "EXCEPT" && inBranch.name === 'kw' && inBranch.attr && inBranch.attr.name === 'Fail'){
                                                var failMsg = inBranch.childNamed('msg');
                                                if (failMsg && failMsg.val){
                                                    failureMessage = failMsg.val;
                                                }
                                            }
                                            if (branchType !== "EXCEPT" && inBranch.name === 'kw' && inBranch.attr && inBranch.attr.name === 'Log'){
                                                prestep.push(inBranch.valueWithPath('msg'));
                                            }
                                            getScreenshotNodes(inBranch, gCtx);
                                        });
                                    });
                                    return;
                                }
                                if(typeof ele.valueWithPath("msg") != 'undefined' ){
                                    let ps = ele.valueWithPath("msg");
                                    if(ps.trim().startsWith("Document ID"))
                                        docID =ps.substring(ps.indexOf(':') + 1);
                                   // else
                                   //     prestep.push(ele.valueWithPath("msg"))
                                }
                                if (typeof ele !== 'undefined' && ele && ele.attr.name == 'Log'  ) { //&& ele.childNamed("msg") != 'undefined'
                                        prestep.push(ele.valueWithPath("msg"))
                                }
                                //capture screenshot in PTS step
                                if (typeof ele !== "undefined" && ele) {
                                    getScreenshotNodes(ele, gCtx);
                                }
                            });
                            prereq = {
                                "documentID" : docID,
                                "ScriptNumber": keyWord.attr.name,
                                "Steps": prestep,
                                "ptsStatus": keyWord.valueWithPath("status@status") || "NA",
                                "failureMessage": failureMessage
                            }; 
                        }else if (keyWord.valueWithPath("tag") == "pre_step_req") {
                            //let prestep = [];
                            keyWord.eachChild(function (ele){
                                if (typeof ele !== 'undefined' && ele && ele.attr.name == 'Log'  ) { //&& ele.childNamed("msg") != 'undefined'
                                    if (prereq == null) prereq={}
                                    prereq["pre_step_req"] = ele.valueWithPath("msg");
                                }
                            });
                            // if (prereq == null) prereq={}
                            // prereq["pre_step_req"] = prestep;
                        }else if (keyWord.valueWithPath("tag") == "pre_step_val") {
                            keyWord.eachChild(function (ele){
                                if (typeof ele !== 'undefined' && ele && ele.attr.name == 'Log'  ) { //&& ele.childNamed("msg") != 'undefined'
                                    if (prereq == null) prereq={}
                                    prereq["pre_step_val"] = ele.valueWithPath("msg");
                                }
                            });

                        }
                    }
                    loopkw(keyWord, gCtx);

                    if (xmlType == "Type1"){
                        updateReportXMLTableData(gCtx);
                    }
                }
                }
            });
            if (prereq == null){
                prereq = {
                    "documentID" : "NA",
                    "ScriptNumber": "NA",
                    "Steps": []
                }; 
            }
            let testCase = {
                suite: suiteName,
                test: testName,
                status: testStatus,
                startTime: sTime,
                endTime: eTime,
                testData: gCtx.xmlRepotFormatData,
                reqIDs: gCtx.requirementIDs,
                testID: tID,
                preTestStep: prereq
            };
            suite.push(testCase);
        }
    });
    suite[0]["scriptRelease"] = scriptVersion;
}

async function myTableBody(suiteArg, firstPage, org, batchID, gCtx) {

    let reportConfig = await getReportConfig(org, false, firstPage);
    let tc = await getTestDescription(suiteArg[1].testID, firstPage.test_suite_id, firstPage, suiteArg);
    let userDetail = await userDetails(firstPage.userID, firstPage);
    let appInfoData = null;
    try { appInfoData = await appInfoRepo.getAll(); } catch(e) {}
    let testSuitData = null;
    try { testSuitData = await testSuiteRepo.getById({ _id: firstPage.test_suite_id }); } catch(e) {}
//    console.log( suiteArg[1].testID+"------"+reportConfig.type+"---tc -- : "+ JSON.stringify(tc, null, 4));
//    console.log("userDetail------------->"+JSON.stringify(userDetail, null, 4));
  //  console.log("firstPage------------->"+JSON.stringify(firstPage, null, 4));
//    console.log("reportConfig.firstPage------------->"+JSON.stringify(reportConfig.firstPage, null, 4));
    let useDbSteps = false;
    let oldexeReq = null;
    try {
        oldexeReq = await executionReqRepo.getByField({test_case_id: tc[0]?.test_case_id ? tc[0]?.test_case_id : '', org_code: org, status:{ $in: ["READY_AUTOMATION", "READY_EXECUTION"] }  });
    } catch(e) {}
    if(!_.isEmpty(oldexeReq) && Array.isArray(tc[0]?.test_steps ) && tc[0]?.test_steps.length > 0){
        useDbSteps = true;
    }
    //console.log(useDbSteps)
    const failureInPTS = (reportConfig.type === "Type5") && (suiteArg[1]?.preTestStep?.ptsStatus === "FAIL");
    const executedStepCount = suiteArg[1]?.testData?.length ?? 0;
    const executionFailedStep = (!failureInPTS && suiteArg[1]?.status !== 'PASS' && executedStepCount > 0) ? executedStepCount : null;
    let failureLocationText;
    if (suiteArg[1]?.status === 'PASS') {
        failureLocationText = 'PASS';
    } else if (failureInPTS) {
        failureLocationText = 'Failed During Pre-Test Set up';
    } else if (executionFailedStep !== null) {
        failureLocationText = `Failed at Execution Step ${executionFailedStep}`;
    } else {
        failureLocationText = 'FAIL';
    }
    let dynamicContent = new Array();
    //First Page
    if(reportConfig.type == "Type3" || reportConfig.type == "Type5" || reportConfig.type == "Type8"){
        findAndReplaceString(reportConfig.firstPage.content,"$TagId", tc[0].test_case_id);
        findAndReplaceString(reportConfig.firstPage.content,"$ProjectName", "Veeva Vault v" + firstPage.veevaRelease + " " + firstPage.firstPageContent1);
        findAndReplaceString(reportConfig.firstPage.content,"$DocumentID",suiteArg[1].preTestStep.documentID);
        findAndReplaceString(reportConfig.firstPage.content,"$ScriptTitle", tc[0].test_case_name);
        findAndReplaceString(reportConfig.firstPage.content,"$Version", tc[0].release_no);
        findAndReplaceString(reportConfig.firstPage.content,"$logo",reportConfig.logo);
        findAndReplaceString(reportConfig.firstPage.content,"$startTime", suiteArg[0].startTime);
        findAndReplaceString(reportConfig.firstPage.content,"$endTime", suiteArg[0].endTime);
        findAndReplaceString(reportConfig.firstPage.content,"$VaultEnvironment", firstPage.vaultName);

        dynamicContent.push(reportConfig.firstPage.content);
    } else if(reportConfig.type == "Type0"){
        findAndReplaceString(reportConfig.firstPage.content,"$logo",reportConfig.logo);
        if(firstPage.testData.project_type == "eTMF"){
            findAndReplaceString(reportConfig.firstPage.content, "$ProjectDescription", "electronic Trial Master File (eTMF) System");
        }else if(firstPage.testData.project_type == "QMS"){
            findAndReplaceString(reportConfig.firstPage.content, "$ProjectDescription", "Quality Management System (QMS)");
        }else if(firstPage.testData.project_type == "QualityDocs"){
            findAndReplaceString(reportConfig.firstPage.content, "$ProjectDescription", "Quality Documents System (QualityDocs)");
        }else{
            findAndReplaceString(reportConfig.firstPage.content, "$ProjectDescription", firstPage.testData.project_type);
        }

        dynamicContent.push(reportConfig.firstPage.content);
       // console.log("------------->"+JSON.stringify(reportConfig.firstPage.content, null, 4));
    } else if(reportConfig.type == "Type1"){
        findAndReplaceString(reportConfig.firstPage.content,"$veevaRelease", firstPage.veevaRelease);
        findAndReplaceString(reportConfig.firstPage.content,"$environment", firstPage.vaultName);
        findAndReplaceString(reportConfig.firstPage.content,"$scriptRelease", suiteArg[0].scriptRelease);
        findAndReplaceString(reportConfig.firstPage.content,"$batchID", batchID);
        findAndReplaceString(reportConfig.firstPage.content,"$startTime", suiteArg[0].startTime);
        findAndReplaceString(reportConfig.firstPage.content,"$endTime", suiteArg[0].endTime);
        findAndReplaceString(reportConfig.firstPage.content,"$status", suiteArg[0].status);

        dynamicContent.push(reportConfig.firstPage.content);
    } else if(reportConfig.type == "Type4"){
      //  console.log("----------->"+tc[0].test_case_series);
        findAndReplaceString(reportConfig.firstPage.content,"$tc_Sno", tc[0].test_case_series);
        findAndReplaceString(reportConfig.firstPage.content,"$startTime", suiteArg[0].startTime);
       // console.log("------------->"+JSON.stringify(reportConfig.firstPage.content, null, 4));

        let row1 = new Array();
        let col1 = new Array();
    
        col1.push({
            "text": "User access must be available with the following role.",
            "alignment": "left",
            "fontSize": 10
        });
        col1.push({
            "text": "Record the User Ids:",
            "fillColor": "#95B3D7",
            "alignment": "left",
            "fontSize": 10
        });
        try{
            if (!_.isEmpty(suiteArg[1].preTestStep) ) {
                let tmp = JSON.parse(suiteArg[1].preTestStep["pre_step_req"]);
                tmp["alignment"] = 'left';
                tmp["colSpan"] = 2;
                tmp["fontSize"] = 10;
                col1.push(tmp);
            }
        }catch(e){
            console.log("Error at pre_step_req :"+e);
        }
        row1.push(col1);

        try{
            if (!_.isEmpty(suiteArg[1].preTestStep) ) {
                let tmp = JSON.parse(suiteArg[1].preTestStep["pre_step_val"]);
                tmp["alignment"] = 'left';
                tmp["colSpan"] = 2;
                tmp["fontSize"] = 10;
                row1.push(tmp);
            }
        }catch(e){
            console.log("Error at pre_step_val :"+e);
        }
        row1.push({});
        row1.push({
            "text": "Yes",
            "alignment": "left",
            "fontSize": 10
        });
        reportConfig.firstPage.content[0].table.body.push(row1);

        row1 = new Array();

        row1.push({
            "text": "Record Veeva Vault Login URL",
            "alignment": "left",
            "fontSize": 10
          });
        row1.push({
            "text": "Veeva Vault URL: " + firstPage.vaultURL,
            "alignment": "left",
            "colSpan": 2,
            "fontSize": 10
          });
        row1.push({});
        row1.push({
            "text": "Yes",
            "alignment": "left",
            "fontSize": 10
          });

        reportConfig.firstPage.content[0].table.body.push(row1);
        dynamicContent.push(reportConfig.firstPage.content);
    } else if(reportConfig.type == "Type6" ){
        findAndReplaceString(reportConfig.firstPage.content,"$TagId", `${tc[0].test_case_id}-Auto`);
        findAndReplaceString(reportConfig.firstPage.content,"$VRefId", tc[0].vassureReferenceNo);
        findAndReplaceString(reportConfig.firstPage.content,"$ProjectName", "Veeva Vault v" + firstPage.veevaRelease + " " + firstPage.firstPageContent1);
        findAndReplaceString(reportConfig.firstPage.content,"$DocumentID",suiteArg[1].preTestStep.documentID);
        findAndReplaceString(reportConfig.firstPage.content,"$ScriptTitle", tc[0].test_case_name);
        findAndReplaceString(reportConfig.firstPage.content,"$Version", tc[0].release_no);
        findAndReplaceString(reportConfig.firstPage.content,"$logo",reportConfig.logo);
        findAndReplaceString(reportConfig.firstPage.content,"$startTime", suiteArg[0].startTime);
        findAndReplaceString(reportConfig.firstPage.content,"$endTime", suiteArg[0].endTime);
        findAndReplaceString(reportConfig.firstPage.content,"$VaultEnvironment", firstPage.vaultName);

        dynamicContent.push(reportConfig.firstPage.content);
    } else if (reportConfig.type == "Type7"){
        findAndReplaceString(reportConfig.firstPage.content,"$TagId", tc[0].test_case_id);
        findAndReplaceString(reportConfig.firstPage.content,"$VRefID", tc[0].vassureReferenceNo);
        findAndReplaceString(reportConfig.firstPage.content,"$ProjectName", "Veeva Vault v" + firstPage.veevaRelease + " " + firstPage.firstPageContent1);
        findAndReplaceString(reportConfig.firstPage.content,"$DocumentID",suiteArg[1].preTestStep.documentID);
        findAndReplaceString(reportConfig.firstPage.content,"$ScriptTitle", tc[0].test_case_name);
        findAndReplaceString(reportConfig.firstPage.content,"$Version", tc[0].release_no);
        findAndReplaceString(reportConfig.firstPage.content,"$logo",reportConfig.logo);
        findAndReplaceString(reportConfig.firstPage.content,"$startTime", suiteArg[0].startTime);
        findAndReplaceString(reportConfig.firstPage.content,"$endTime", suiteArg[0].endTime);
        findAndReplaceString(reportConfig.firstPage.content,"$VaultEnvironment", firstPage.vaultName);

        dynamicContent.push(reportConfig.firstPage.content);
    }

    //Second page
    if(reportConfig.type == "Type3"){

        dynamicContent.push(
        {
            margin: [30, 0, 50, 20],
            text: 'VERSION HISTORY\n',
            style: 'subheader',
            pageBreak: 'before'
        });

        let verBody = new Array();
        let verTitle = new Array(
            { text: 'Version Number', 	fillColor:'#808080', alignment: 'center' },
            { text: 'Date', fillColor:'#808080', alignment: 'center' },
            { text: 'Description', fillColor:'#808080', alignment: 'center' },
            { text: 'Author(s)', fillColor:'#808080', alignment: 'center' }
            );
                
        verBody.push(verTitle);
        let dataRow = new Array();
        dataRow.push({text:"1.0", style: 'tableData', alignment: 'center'});
        dataRow.push({text:moment.utc().format("DD MMM YYYY").toUpperCase(), style: 'tableData', alignment: 'center'});
        dataRow.push({text:"New Document", style: 'tableData', alignment: 'center'});
        dataRow.push({text:"Automation", style: 'tableData', alignment: 'center'});
        verBody.push(dataRow);
        dynamicContent.push(
            {
                table: {
                    body: verBody,
                    widths: [90, 100, 200, 80],
                    headerRows: 1,
                    pageBreak: 'before',
                },
                margin: [25, 2, 10, 2]
            });
    } else if (reportConfig.type == "Type0"){
       // console.log("reportConfig.firstPage------------->"+JSON.stringify(reportConfig, null, 4));
        findAndReplaceString(reportConfig.secondPage.content,"$ProjectName", "Veeva Vault v" + firstPage.veevaRelease + " " + firstPage.firstPageContent1);
        findAndReplaceString(reportConfig.secondPage.content,"$TestCaseID", tc[0].test_case_id);
        findAndReplaceString(reportConfig.secondPage.content,"$UserName", (typeof userDetail != 'undefined'? userDetail[0].first_name +" "+ userDetail[0].last_name : ''));
        findAndReplaceString(reportConfig.secondPage.content,"$startTime", suiteArg[0].startTime);
        findAndReplaceString(reportConfig.secondPage.content,"$endTime", suiteArg[0].endTime);
        findAndReplaceString(reportConfig.secondPage.content,"$VaultEnvironment", firstPage.vaultName);

        dynamicContent.push(reportConfig.secondPage.content);
        //TOC section
        dynamicContent.push(
            {
                //margin: [30, 0, 30, 30],
                toc: {
                    title: { text: 'Table of Contents\n\n\n', color: '#000080', fontSize: 15 }
                }
            });
    } else if (reportConfig.type == "Type1" ){
         //TOC section
         dynamicContent.push(
             {
                 //margin: [30, 0, 30, 30],
                 toc: {
                     title: { text: 'Table of Contents\n\n\n', color: '#000080', fontSize: 15 }
                 },
                 pageBreak: 'before'
             });
    } else if(reportConfig.type == "Type4" || reportConfig.type == "Type5" || reportConfig.type == "Type6" || reportConfig.type == "Type7" || reportConfig.type == "Type8"){
        // No second page
    }
    
    //Third page page to landscape 
    if(reportConfig.type == "Type3" ){   
        let sumTitle = new Array();
        let sumBody = new Array();
        
        sumTitle.push({ text: 'Script Number', style: 'tableHeader', "fillColor": "#F79646" });
        sumTitle.push({ text: tc[0].tag_id.replace(/_/g, ' '), style: 'tableHeader', "fillColor": "#F79646" });
        sumBody.push(sumTitle);

        let dataRow = new Array();
        dataRow.push({ text: 'Test Description:', style: 'tableHeader', "fillColor": "#F79646" });
        dataRow.push({ text: (typeof tc[0].test_case_name != 'undefined'? "Script for "+tc[0].test_case_name : 'NA'), style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Purpose:', style: 'tableHeader', "fillColor": "#F79646" });
        dataRow.push({ text: (typeof tc[0].description != 'undefined'? tc[0].description: 'NA'), style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Tester(s):', style: 'tableHeader', "fillColor": "#F79646" });
        dataRow.push({ text: 'Automation', style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Execution Number:', style: 'tableHeader', "fillColor": "#F79646" });
        dataRow.push({ text: batchID, style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Test Environment:', style: 'tableHeader', "fillColor": "#F79646" });
        dataRow.push({ text: firstPage.vaultName, style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Pre-Test Setup:', style: 'tableHeader', "fillColor": "#F79646" });
        dataRow.push({ ul: suiteArg[1].preTestStep.Steps, style: 'tableData' })
        sumBody.push(dataRow);

        dynamicContent.push(
            {
                pageOrientation: 'landscape',
                margin: [30, 70, 20, 20],
                table: {
                    headerRows: 1,
                    widths: [100, 400],
                    dontBreakRows: true,
                    body: sumBody,
                },
                pageBreak: 'before'
            });
        
     }else if(reportConfig.type == "Type5" || reportConfig.type == "Type8"){   
        let sumBody = new Array();
        let dataRow = new Array();

        dataRow.push({ text: 'Test Script ID', style: 'tableHeader', "fillColor": "#FF9E16" });
        dataRow.push({ text: tc[0].tag_id.replace(/_/g, '-'), style:  'tableData'  });
        dataRow.push({ text: 'Title', style: 'tableHeader', "fillColor": "#FF9E16" });
        dataRow.push({ text: (typeof tc[0].test_case_name != 'undefined'? tc[0].test_case_name : 'NA'), style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Description', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: (typeof tc[0].description != 'undefined'? tc[0].description: 'NA'), style: 'tableData',colSpan: 3});
        dataRow.push({});
        dataRow.push({});
        // dataRow.push({ text: 'Build Number', style: 'tableHeader', fillColor: "#FF9E16" });
        // dataRow.push({ text: batchID, style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Vault Name', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: firstPage.vaultName, style: 'tableData' });
        dataRow.push({ text: 'Product Version', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: (typeof firstPage.productVersion != 'undefined' ? firstPage.productVersion : 'NA') , style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'V-Assure Environment', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: ( process.env.NODE_ENV == 'Dev' ? "Spotline: V-Assure Development" : "Spotline: V-Assure Production"), style: 'tableData'});
        dataRow.push({ text: 'Run Number', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: (typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.runNo : ''), style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Start Time', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: suiteArg[0].startTime, style: 'tableData'});
        dataRow.push({ text: 'End Time', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: suiteArg[0].endTime, style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Pre-Test Setup (PTS)', style: 'tableHeader', fillColor: "#FF9E16" });
        findAndReplaceStringSpecialChar(suiteArg[1].preTestStep.Steps)
        try{
            if (!_.isEmpty(suiteArg[1].preTestStep.Steps) ) {
                // console.log(JSON.stringify(suiteArg[1].preTestStep.Steps, null, 4));
                let tmp = JSON.parse(suiteArg[1].preTestStep.Steps);
                    // console.log(JSON.stringify(tmp, null, 4));
                if (Array.isArray(tmp.ol)) {
                tmp.ol = tmp.ol.map((item, idx) => {
                    const items = Array.isArray(item) ? item : [item];
                    const contentStack = items.map(el => ({
                        text: typeof el === 'object' && el !== null ? el.text || "" : el || "",
                        ...(el?.margin && { margin: el.margin })
                    }));
                    return {
                        stack: contentStack, 
                        margin: [0, 0, 0, (idx === tmp.ol.length - 1 ? 0 : 3)]
                    };
                })};   
                tmp.style = 'tableData';
                tmp.colSpan = 3;
                // console.log("-->"+JSON.stringify(tmp, null, 4));
                dataRow.push(tmp);
            }else{
                dataRow.push({text:"", colSpan:3 });
            }
        }catch(e){
            console.log(e);
            dataRow.push({text:"", colSpan:3 });
        }

        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dynamicContent.push(
        {
            pageOrientation: 'landscape',
            margin: [30, 50, 20, 20],
            table: {
              //  headerRows: 1,
                widths: [100, 250, 100, 250],
                dontBreakRows: false,
                body: sumBody,
            },
            pageBreak: 'before'
        });
        dynamicContent.push({
            text: 'Intentionally Left Blank',
            alignment: 'center',
            color: '#888888',
            italics: true,
            fontSize: 12,
            margin: [0, 0, 0, 0]
        });
    }else if(reportConfig.type == "Type0" || reportConfig.type == "Type1") {
        // Table format summary section

        dynamicContent.push(
            {
                margin: [50, 0, 50, 10],
                pageOrientation: 'landscape',
                text: '1  Test Case Summary\n',
                color: '#000080',
                pageBreak: 'before',
                tocItem: true
            });

        dynamicContent.push(
            {
                text: 'This section lists all the test scripts used during the exeuction of the test case run.\n\n\n',
                margin: [50, 0, 50, 10],
                fontSize: 12,
                alignment: 'justify'
            });
        let summaryBody = new Array();

        let summTitle = new Array(
            { text: 'Test Case ID', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            { text: 'Script Version#', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            { text: 'Test Case Name', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            { text: 'Description', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            { text: 'Req#', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            { text: 'Start Time/ End Time', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" }
            );
            
        summaryBody.push(summTitle);
        for (let i = 1; i < suiteArg.length; i++) {
            let dataRow = new Array();
            let tc = await getTestDescription(suiteArg[i].testID, firstPage.test_suite_id);
            
            dataRow.push((typeof tc[0].test_case_id != 'undefined'? tc[0].test_case_id: 'NA'))
            dataRow.push(suiteArg[0].scriptRelease)
            dataRow.push((typeof tc[0].test_case_name != 'undefined'? tc[0].test_case_name : suiteArg[i].test));
            dataRow.push((typeof tc[0].description != 'undefined'? tc[0].description: 'NA'));
            dataRow.push((typeof tc[0].requirement_no != 'undefined'? tc[0].requirement_no: 'NA'))
            dataRow.push(suiteArg[i].status);
            dataRow.push(suiteArg[i].startTime +" \n "+suiteArg[i].endTime);
            // console.log(dataRow);
            summaryBody.push(dataRow);
        }
        dynamicContent.push(
            {
                table: {
                    body: summaryBody,
                    //Adjust table.
                    widths: [45, 50, 150, 150, 110, 45, 130],
                    headerRows: 1,
                },
                margin: [35, 2, 2, 2],
              //  pageBreak: 'after',
            });
    } else if(reportConfig.type == "Type4"){
        // No Third page
    } else if(reportConfig.type == "Type6"){   
        let sumBody = new Array();
        let dataRow = new Array();

        dataRow.push({ text: 'Test Script ID', style: 'tableHeader', "fillColor": "#FF9E16" });
        dataRow.push({ text: `${tc[0].tag_id.replace(/_/g, '-')}-Auto`, style:  'tableData'  });
        dataRow.push({ text: 'Test Title', style: 'tableHeader', "fillColor": "#FF9E16" });
        dataRow.push({ text: (typeof tc[0].test_case_name != 'undefined'? tc[0].test_case_name : 'NA'), style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Test Description', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: (typeof tc[0].description != 'undefined'? tc[0].description: 'NA'), style: 'tableData'});
        dataRow.push({ text: 'Run Number', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: (typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.runNo : ''), style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        // dataRow.push({ text: 'History Number', style: 'tableHeader', fillColor: "#FF9E16" });
        // dataRow.push({ text: batchID, style: 'tableData'});
        dataRow.push({ text: 'Version Date', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: moment.utc(tc[0].release_date).format("DD-MMM-YYYY").toUpperCase(), style: 'tableData'});
        dataRow.push({ text: 'Test Version', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: tc[0].release_no, style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Start Time', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: suiteArg[0].startTime, style: 'tableData'});
        dataRow.push({ text: 'End Time', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: suiteArg[0].endTime, style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Steps Executed', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: suiteArg[1].testData.length , style: 'tableData'});
        dataRow.push({ text: 'Overall Status', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: (suiteArg[1].status == "PASS" ? "PASS": "FAIL"), style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Comments', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: "\n\n\n\n", style: 'tableData', colSpan:3});
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Reviewer Assessment', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({
            stack: [
                {
                    columns: [
                        { text: "Pass:", alignment: "left",fontSize: 10 },
                        { text: "Fail:",alignment: "left",fontSize: 10 },
                        { 
                            stack: [
                                { text: "Pass on Deviation:" ,fontSize: 10},
                                { text: "\n\nReference:\n\n",fontSize: 10 }
                            ], 
                            width: "50%"
                        }
                    ]
                }
            ],
            colSpan: 3
        });
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Requirements Tested', style: 'tableHeader', fillColor: "#FF9E16" }); 
        dataRow.push({ text: (typeof tc[0].requirement_no != 'undefined'? tc[0].requirement_no: 'NA'), style: 'tableData',colSpan:3 });
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Test System', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({
            stack: [
                {
                    columns: [
                        { text: "Vault ID:", alignment: "left",fontSize: 10 },
                        { text: (typeof firstPage.veevaVaultID != 'undefined'? firstPage.veevaVaultID: 'NA'),alignment: "left",fontSize: 10,width: "85%" }
                    ]
                },
                {
                    columns: [
                        { text: "Product Version:", alignment: "left",fontSize: 10 },
                        { text: gCtx.veevaVaultVersion, alignment: "left",fontSize: 10, width: "85%" }
                    ]
                },
                {
                    columns: [
                        { text: "Device ID:", alignment: "left",fontSize: 10 },
                        { text: "V-Assure",alignment: "left",fontSize: 10, width: "85%" }
                    ]
                }
            ],
            colSpan: 3
        })
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Note', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: "Test run executed via automation.\n\n Post run reviews (Independent Review, GxP Acceptance) are performed in Veeva EDMS.\n\n Script steps and tested requirements are based upon the referenced Veeva Test Script.  As an independently controlled near copy of the original manually executed test, IDs managed within Spotline V-Assure are appended with “-Auto” suffix for uniqueness.", style: 'tableData', colSpan:3});
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Pre-Test Setup', style: 'tableHeader', fillColor: "#FF9E16" });
        findAndReplaceStringSpecialChar(suiteArg[1].preTestStep.Steps)
        try{
            if (!_.isEmpty(suiteArg[1].preTestStep.Steps) ) {
            //  console.log(suiteArg[1].preTestStep.Steps);
            let tmp = JSON.parse(suiteArg[1].preTestStep.Steps);
                // console.log(JSON.stringify(tmp, null, 4));
            tmp.style = 'tableData';
            tmp.colSpan = 3;
            dataRow.push(tmp);
            }else{
                dataRow.push({text:"", colSpan:3 });
            }
        }catch(e){
            console.log(e);
            dataRow.push({text:"", colSpan:3 });
        }

        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dynamicContent.push(
        {
            pageOrientation: 'landscape',
            margin: [0, 0, 0, 0],
            table: {
              //  headerRows: 1,
                widths: [100, 250, 100, 250],
                dontBreakRows: false,
                body: sumBody,
            },
            pageBreak: 'before'
        });
    } else if(reportConfig.type == "Type7"){   
        let sumBody = new Array();
        let dataRow = new Array();

        dataRow.push({ text: 'Test Script ID', style: 'tableHeader', "fillColor": "#C23D48" });
        dataRow.push({ text: tc[0].tag_id.replace(/_/g, '-'), style:  'tableData'  });
        dataRow.push({ text: 'Test Script Version', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: tc[0].release_no, style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Test Suite Name', style: 'tableHeader', "fillColor": "#C23D48" });
        dataRow.push({ text: (typeof testSuitData.suite_name != 'undefined'? testSuitData.suite_name : 'NA'), style: 'tableData' });
        dataRow.push({ text: 'Automated Test Framework Version', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: (typeof appInfoData[0].test_framework_version != 'undefined' ? appInfoData[0].test_framework_version : ''), style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Test Script Name', style: 'tableHeader', "fillColor": "#C23D48" });
        dataRow.push({ text: (typeof tc[0].test_case_name != 'undefined'? tc[0].test_case_name : 'NA'), style: 'tableData' });
        dataRow.push({ text: 'Test Run Type', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: (typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.justification : ''), style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'V-Assure Environment', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: ( process.env.NODE_ENV == 'Dev' ? "Development" : "Production"), style: 'tableData'});
        dataRow.push({ text: 'Iteration', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: (typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.runNo : ''), style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Tester (who ran/scheduled the automated test):', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: (typeof userDetail[0] != 'undefined' ? userDetail[0].full_name : 'Automated Tested'), style: 'tableData' });
        dataRow.push({ text: 'V-Assure Build No', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: batchID, style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Start Time', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: suiteArg[0].startTime, style: 'tableData'});
        dataRow.push({ text: 'End Time', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: suiteArg[0].endTime, style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Steps Executed', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: suiteArg[1].testData.length , style: 'tableData'});
        dataRow.push({ text: 'Overall Test Result', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: (suiteArg[1].status == "PASS" ? "PASS": "FAIL"), style: 'tableData'});
        sumBody.push(dataRow);

        // dataRow = new Array();
        // dataRow.push({ text: 'Test Description', style: 'tableHeader', fillColor: "#C23D48" });
        // dataRow.push({ text: (typeof tc[0].description != 'undefined'? tc[0].description: 'NA'), style:  'tableData',colSpan:3 });
        // dataRow.push({});
        // dataRow.push({});
        // sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Information on System Under Test (Name, Version, Environment, Browser)', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({
            stack: [
                {
                    columns: [
                        { text: "System Name:", alignment: "left",fontSize: 10 },
                        { text: firstPage.vaultName, alignment: "left",fontSize: 10,width: "85%" }
                    ]
                },
                {
                    columns: [
                        { text: "Version:", alignment: "left",fontSize: 10 },
                        { text: gCtx.veevaVaultVersion, alignment: "left",fontSize: 10, width: "85%" }
                    ]
                },
                {
                    columns: [
                        { text: "Environment:", alignment: "left",fontSize: 10 },
                        { text: firstPage.vaultEnvironment,alignment: "left",fontSize: 10, width: "85%" }
                    ]
                },
                {
                    columns: [
                        { text: "Web Browser:", alignment: "left",fontSize: 10 },
                        { text: (firstPage.testData.browser == "chrome") ? "Chrome" : "NA" ,alignment: "left",fontSize: 10, width: "85%" }
                    ]
                }
            ],
            colSpan: 3
        })
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Requirements Covered', style: 'tableHeader', fillColor: "#C23D48" }); 
        dataRow.push({ text: (typeof tc[0].requirement_no != 'undefined'? tc[0].requirement_no: 'NA'), style: 'tableData',colSpan:3 });
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Comments', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: "\n\n\n\n", style: 'tableData', colSpan:3});
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Test Objective(s)', style: 'tableHeader', fillColor: "#C23D48" });
        findAndReplaceStringSpecialChar(suiteArg[1].preTestStep.Steps)
        try{
        if (!_.isEmpty(suiteArg[1].preTestStep.Steps) ) {
          //  console.log(suiteArg[1].preTestStep.Steps);
        let tmp = JSON.parse(suiteArg[1].preTestStep.Steps);
               // console.log(JSON.stringify(tmp, null, 4));
        tmp.style = 'tableData';
        tmp.colSpan = 3;
        dataRow.push(tmp);
        }else{
            dataRow.push({text:"", colSpan:3 });
        }
        }catch(e){
            console.log(e);
            dataRow.push({text:"", colSpan:3 });
        }

        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dynamicContent.push(
        {
            pageOrientation: 'landscape',
            margin: [30, 20, 20, 20],
            table: {
              //  headerRows: 1,
                widths: [100, 250, 100, 250],
                dontBreakRows: false,
                body: sumBody,
            },
            pageBreak: 'before'
        });
    }

    //Test Case Actual Report
    if(reportConfig.type == "Type0" || reportConfig.type == "Type1"){
        
        for (let i = 1; i < suiteArg.length; i++) {
            let screenshots = Array()

            dynamicContent.push(
                {
                    margin: [50, 0, 50, 20],
                    text: "1." + (i) + "  " + suiteArg[i].test + " Report\n",
                    color: '#000080',
                    pageBreak: 'before',
                    tocItem: true
                });

            dynamicContent.push(
                {
                    text: 'This section lists all the test steps performed during the test case exeuction.\n\n',
                    margin: [50, 0, 50, 10],
                    fontSize: 12,
                    alignment: 'justify'
                });

            let body = new Array();
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', "fillColor": "#F79646", alignment: 'center' },
             //   { text: 'User', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Description of Action', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Expected Results ', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Actual Results', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            );
            body.push(tableTitle1);

            let rowCount = 1
            suiteArg[i].testData.forEach(function (row) {

                let dataRow = new Array();
                dataRow.push({ text: rowCount, style: 'tableData' });
                //dataRow.push(row[0]); //Step
               // dataRow.push(row[6]); //User
                dataRow.push(row[0]); //Description of Action		 
                dataRow.push(row[3]); //Expected Results
                dataRow.push(row[4]); //Actual Results
                dataRow.push(row[1]); //Pass/Fail
                body.push(dataRow);
                screenshots.push({
                    step: "Step #" + rowCount +" Screenshot",
                    images: row[5],
                    screenshotTime: row[7]
                });
                rowCount++;
            });

            dynamicContent.push(
            {
                margin: [40, 10, 40, 40],
              //  pageBreak: 'after',
                table: {
                    body: body,
                    //widths: [30, 60, 220, 150, 150 , 75],
                    widths: [35, 220, 170, 170 , 70],
                    headerRows: 1,
                    //dontBreakRows: true
                }
            });

            //Screenshot page
            let screenShotBody = new Array();

            screenShotBody.push([{ text: 'Comments', style: 'tableHeader', fillColor: "#F79646", alignment: 'center', colSpan:2},{}]);

            //Get the screeshot list
            let screenshotTags = Array();
            let scount=0;
            
            for(ele of screenshots) {
                let  x ;
                if(scount == 0 )
                    x = [{ text: ele.step  +  "       Screenshot Time: "+ ele.screenshotTime + "\n\n", style: 'tableData'} ].concat(ele.images);
                else
                    x = [{ text: ele.step  +  "       Screenshot Time: "+ ele.screenshotTime + "\n\n", style: 'tableData', pageBreak: 'before'} ].concat(ele.images);
                scount++;
                screenshotTags.push(x)
            }
            screenShotBody.push([{text: 'Screenshots Attached: ' + (scount >= 1 ?' YES' : ' NO'), style: 'tableData'}, 
            { text: 'If yes, Number of Screenshots Attached: ' + scount, style: 'tableData', alignment: 'center'}]);

            //Attach screenshots
            screenShotBody.push([{stack: screenshotTags, colSpan: 2}, {}]);

            dynamicContent.push(
                {
                    // margin: [left, top, right, bottom]
                    margin: [40, 10, 40, 10],
                    pageBreak: 'before',
                    table: {
                        body: screenShotBody,
                        widths: [350, 350]
                    }
                });
        }

    }else if(reportConfig.type == "Type3" ){
        let screenshots = Array()
        for (let i = 1; i < suiteArg.length; i++) {
            let body = new Array();
    
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', "fillColor": "#F79646", alignment: 'center' },
                { text: 'User', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Description of Action', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Expected Results ', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Actual Results', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            );
            body.push(tableTitle1);

            let rowCount = 1
            suiteArg[i].testData.forEach(function (row) {
                let dataRow = new Array();
                dataRow.push({ text: rowCount, style: 'tableData' });
                //dataRow.push(row[0]); //Step
                dataRow.push(row[6]); //User
                dataRow.push(row[0]); //Description of Action		 
                dataRow.push(row[3]); //Expected Results
                dataRow.push(row[4]); //Actual Results
                dataRow.push(row[1]); //Pass/Fail
                body.push(dataRow);
                screenshots.push({
                    step: "Step #" + rowCount +" Screenshot",
                    images: row[5],
                    screenshotTime: row[7]
                });
                rowCount++;
            });

            dynamicContent.push(
            {
                margin: [40, 20, 40, 40],
                pageBreak: 'before',
                table: {
                    body: body,
                    widths: [30, 60, 220, 150, 150 , 75],
                    headerRows: 1,
                }
            });

            //Screenshot page
            let screenShotBody = new Array();
           screenShotBody.push([{ text: 'Comments', style: 'tableHeader', fillColor: "#F79646", alignment: 'center', colSpan:2},{}]);
            //Get the screeshot list
            let screenshotTags = Array();
            let scount=0;
            
            for(ele of screenshots) {
                let  x ;
                if(scount == 0 )
                    x = [{ text: ele.step  +  "       Screenshot Time: "+ ele.screenshotTime + "\n\n", style: 'tableData'} ].concat(ele.images);
                else
                    x = [{ text: ele.step  +  "       Screenshot Time: "+ ele.screenshotTime + "\n\n", style: 'tableData', pageBreak: 'before'} ].concat(ele.images);
                scount++;
                screenshotTags.push(x)
            }

            screenShotBody.push([{text: 'Screenshots Attached: ' + (scount > 1 ?' YES' : ' NO'), style: 'tableData'}, 
            { text: 'If yes, Number of Screenshots Attached: ' + scount, style: 'tableData', alignment: 'center'}]);

            screenShotBody.push([{stack: screenshotTags, colSpan: 2}, {}]);
            dynamicContent.push(
                {
                    margin: [40, 40, 40, 40],
                    pageBreak: 'before',
                    table: {
                        body: screenShotBody,
                        widths: [350, 350]
                    }
                });
        }

    }else if( reportConfig.type == "Type5" || reportConfig.type == "Type8"){
        let screenshots = Array()
        let ptsScreenshots = Array();
        let stepScreenshotCount = {};
        gCtx.preReqImgs.forEach(({stepNum}) => {
            if (!stepScreenshotCount[stepNum]) {
                stepScreenshotCount[stepNum] = 0;
            }
            stepScreenshotCount[stepNum]++;
        });
        let lastIndexForStep = {};
        gCtx.preReqImgs.forEach(({stepNum}, idx) => {
            if (typeof stepNum !== 'undefined' && stepNum !== null) {
                lastIndexForStep[stepNum] = idx;
            }
        });
        const failureMessage = suiteArg[1]?.preTestStep?.failureMessage;
        gCtx.preReqImgs.forEach(({stepNum, scrNum, img }, index) => {
                const hasMultipleScreenshots = stepScreenshotCount[stepNum] > 1;
                const isFailureStep = failureMessage && new RegExp(`\\b${stepNum}\\b`).test(failureMessage);
                const isLastScreenshot = index === lastIndexForStep[stepNum];
                let stepName;
                if (isFailureStep && isLastScreenshot) {
                    stepName = failureMessage;
                } else {
                    stepName = hasMultipleScreenshots ? 
                    `PTS Step #${stepNum} Screenshot #${scrNum}` : 
                    `PTS Step #${stepNum} Screenshot`;
                }
                 
                ptsScreenshots.push({
                    step: stepName,
                    images: [img], 
                    screenshotTime: [gCtx.preReqScreenshotTime[index]]
                });
        }); 
        for (let i = 1; i < suiteArg.length; i++) {
            if (ptsScreenshots.length > 0) {
                let ptsScreenshotBody = new Array();
                ptsScreenshotBody.push([{ text: 'PTS Screenshots', style: 'tableHeader', fillColor: "#FF9E16", alignment: 'center', colSpan:2},{}]);
                let ptsScreenshotTags = Array();
                let ptsScount = 0;
                for(ele of ptsScreenshots) {
                    for(let i = 0; i < (ele.images).length; i++){
                        let x;
                        if(ptsScount == 0) {
                            x = [{ text: ele.step + ((ele.images).length > 1 ? " #"+ (i+1) : "") + "       Screenshot Time: "+ ele.screenshotTime[i] + "\n\n", style: 'tableData'} ].concat(ele.images[i]);
                        } else {
                            x = [{ text: ele.step + ((ele.images).length > 1 ? " #"+ (i+1) : "") + "       Screenshot Time: "+ ele.screenshotTime[i] + "\n\n", style: 'tableData', pageBreak: 'before'} ].concat(ele.images[i]);
                        }
                        ptsScount++;
                        ptsScreenshotTags.push(x);
                    }
                }
                ptsScreenshotBody.push([{stack: ptsScreenshotTags, colSpan: 2}, {}]);
                dynamicContent.push({
                    margin: [40, 40, 40, -40],
                    pageBreak: 'before',
                    table: {
                        body: ptsScreenshotBody,
                        widths: [350, 350]
                    }
                });
            }
            let body = new Array();      
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', fillColor: "#FF9E16", alignment: 'center' },
                { text: 'Procedure', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Expected Results ', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Actual Results', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center', fillColor: "#FF9E16" },
            );
            body.push(tableTitle1);

            let rowCount = 1
            suiteArg[i].testData.forEach(function (row) {
               // console.log("------------->"+JSON.stringify(row, null, 4));
            //    let result = tc[0]?.test_steps?.find( step => step.step_no === rowCount && step.step_type === "Execution Step" );

                let dataRow = new Array();
                dataRow.push({ text: rowCount, style: 'tableHeader', fillColor: "#FF9E16" });
                dataRow.push(row[0] ); //Description of Action		 
                dataRow.push(row[3] ); //Expected Results
                // dataRow.push(useDbSteps ? [{ text: (result?.procedure ?? ""), style: 'tableData' }] : (row[0] ?? "")); //Description of Action		 
                // dataRow.push( useDbSteps ? [{ text: (result?.expected_result ?? ""), style: 'tableData' }] : (row[3] ?? "") ); //Expected Results
                dataRow.push(row[4] ); //Actual Results
                //console.log("=============>"+JSON.stringify(row[2], null, 4));
                dataRow.push([row[1],"\n", row[2]]); //Pass/Fail
                body.push(dataRow);
                //console.log("=============>"+row[7].length);
                if(typeof row[7] !== 'undefined' && row[7].length >0){
                    screenshots.push({
                        step: "Step #" + rowCount +" Screenshot",
                        images: row[5],
                        screenshotTime: row[7]
                    });
                }
                rowCount++;
                // console.log("------------->"+JSON.stringify(dataRow, null, 4));
            });

            const remainingSteps = (tc[0]?.test_steps || []).filter(
                step => step.step_type === "Execution Step" &&
                (failureInPTS || step.step_no >= rowCount));
                remainingSteps.forEach(result => {
                let dataRow = new Array();
                dataRow.push({ text: result.step_no, style: 'tableHeader', fillColor: "#FF9E16" });
                dataRow.push([{ text: (result?.procedure ?? ""), style: 'tableData' }]); //Description of Action		 
                dataRow.push( [{ text: (result?.expected_result ?? ""), style: 'tableData' }]  ); //Expected Results
                dataRow.push([{ text: "N/A", style: 'tableData'}]);//Actual Results
                dataRow.push([{ text: "N/A", style: 'tableData'}]);//Pass/Fail
                body.push(dataRow);
            })

            dynamicContent.push(
            {
                margin: [40, 20, 40, 0],
                pageBreak: 'before',
                table: {
                    body: body,
                    widths: [30, 200, 175, 175 , 105],
                    headerRows: 1,
                    dontBreakRows: true
                }
            });
            dynamicContent.push({
                text: 'Intentionally Left Blank',
                alignment: 'center',
                color: '#888888',
                italics: true,
                fontSize: 12,
                margin: [0, 0, 0, 0]
            });

            //Screenshot page
            let screenShotBody = new Array();
           screenShotBody.push([{ text: 'Execution Screenshots', style: 'tableHeader', fillColor: "#FF9E16", alignment: 'center', colSpan:2},{}]);
            //Get the screeshot list
            let screenshotTags = Array();
            let scount=0;
            
            for(ele of screenshots) {

                for(let i = 0; i < (ele.images).length; i++){
                let  x ;
                if(scount == 0 )
                        x = [{ text: ele.step  + ((ele.images).length > 1 ? " #"+ (i+1) : "") + "       Screenshot Time: "+ ele.screenshotTime[i] + "\n\n", style: 'tableData'} ].concat(ele.images[i]);
                else
                        x = [{ text: ele.step   + ((ele.images).length > 1 ? " #"+ (i+1) : "") +  "       Screenshot Time: "+ ele.screenshotTime[i] + "\n\n", style: 'tableData', pageBreak: 'before'} ].concat(ele.images[i]);
                scount++;
                screenshotTags.push(x)
            }

            }


            screenShotBody.push([{stack: screenshotTags, colSpan: 2}, {}]);
            dynamicContent.push(
                {
                    margin: [40, 40, 40, -130],
                    pageBreak: 'before',
                    table: {
                        body: screenShotBody,
                        widths: [350, 350]
                    }
                });
        }

    }else if(reportConfig.type == "Type4"){
        
        for (let i = 1; i < suiteArg.length; i++) {
            let screenshots = Array()
            let body = new Array();
            let tableTitle1 = new Array({ text: 'Step', bold: true, "fillColor": "#95B3D7", alignment: 'center' },
                { text: 'Instructions', bold: true, alignment: 'center', "fillColor": "#95B3D7" },
                { text: 'Expected Results ', bold: true, alignment: 'center', "fillColor": "#95B3D7" },
                { text: 'Actual Results', bold: true, alignment: 'center', "fillColor": "#95B3D7" },
                { text: 'Pass/Fail', bold: true, alignment: 'center', "fillColor": "#95B3D7" },
                
            );
            body.push(tableTitle1);

            let rowCount = 1
            suiteArg[i].testData.forEach(function (row) {

                let dataRow = new Array();
                dataRow.push({ text: parseInt(tc[0].test_step_start_no)+rowCount, style: 'tableData' });
                dataRow.push(row[0]); //Instructions		 
                dataRow.push(row[3]); //Expected Results
                dataRow.push(row[4]); //Actual Results
                dataRow.push(row[1]); //Pass/Fail
                body.push(dataRow);
                screenshots.push({
                    step: "Step #" + (parseInt(tc[0].test_step_start_no)+rowCount) +" Screenshot",
                    images: row[5],
                    screenshotTime: row[7]
                });
                rowCount++;

            });

            dynamicContent.push(
            {
               // margin: [40, 10, 40, 40],
               "margin":[5,10,5,20],
                pageBreak: 'before',
                table: {
                    body: body,
                    widths:['10%','40%','20%','20%','10%'],
                    headerRows: 1,
                    //dontBreakRows: true
                }
            });

            //Screenshot page
            let screenShotBody = new Array();

            screenShotBody.push([{ text: 'Comments', bold: true, fillColor: "#95B3D7", alignment: 'center', colSpan:2},{}]);

            //Get the screeshot list
            let screenshotTags = Array();
            let scount=0;
            
            for(ele of screenshots) {
                let  x ;
                if(scount == 0 )
                    x = [{ text: ele.step  +  "       Screenshot Time: "+ ele.screenshotTime + "\n\n"} ].concat(ele.images);
                else
                    x = [{ text: ele.step  +  "       Screenshot Time: "+ ele.screenshotTime + "\n\n", pageBreak: 'before'} ].concat(ele.images);
                scount++;
                screenshotTags.push(x)
            }
            screenShotBody.push([{text: 'Screenshots Attached: ' + (scount >= 1 ?' YES' : ' NO')}, 
            { text: 'If yes, Number of Screenshots Attached: ' + scount, alignment: 'center'}]);

            //Attach screenshots
            screenShotBody.push([{stack: screenshotTags, colSpan: 2}, {}]);

            dynamicContent.push(
                {
                    // margin: [left, top, right, bottom]
                    "margin":[5,20,5,20],
                    pageBreak: 'before',
                    table: {
                        body: screenShotBody,
                        widths: ['50%', '50%']
                    }
                });
        }

    }else if( reportConfig.type == "Type6"){
        let screenshots = Array()
        gCtx.preReqImgs.forEach(({stepNum, scrNum, img }, index) => {
            screenshots.push({
                step: `PTS Step #${stepNum} Screenshot #${scrNum}`,
                images: [img], 
                screenshotTime: [gCtx.preReqScreenshotTime[index]]
            });
        });
        //console.log("Screenshots: ", screenshots);
        for (let i = 1; i < suiteArg.length; i++) {
            let body = new Array();
    
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', fillColor: "#FF9E16", alignment: 'center' },
                { text: 'Procedure', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Expected Results ', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Actual Results', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center', fillColor: "#FF9E16" },
            );
            body.push(tableTitle1);

            let rowCount = 1
            suiteArg[i].testData.forEach(function (row) {
               // console.log("------------->"+JSON.stringify(row, null, 4));

                let dataRow = new Array();
                dataRow.push({ text: rowCount +"\n"+row[8] , style: 'tableHeader', fillColor: "#FF9E16" });
                dataRow.push(row[0]); //Description of Action		 
                dataRow.push(row[3]); //Expected Results
                dataRow.push(row[4] ); //Actual Results
                //console.log("=============>"+JSON.stringify(row[2], null, 4));
                dataRow.push({text:[row[1],"\n\n",moment.tz(row[2].text, "DD-MMM-YYYY HH:mm:ss", "America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss [GMT]Z").toUpperCase()],style: 'tableData'
                }); //Pass/Fail

                body.push(dataRow);
                //console.log("=============>"+row[7].length);
                if(typeof row[7] !== 'undefined' && row[7].length >0){
                    screenshots.push({
                        step: "Step #" + rowCount +" Screenshot",
                        images: row[5],
                        screenshotTime: row[7]
                    });
                }
                rowCount++;
            });

            dynamicContent.push(
            {
                margin: [0, 0, 0, 0],
                pageBreak: 'before',
                table: {
                    body: body,
                    widths: [65, 205, 165, 165 , 80],
                    headerRows: 1,
                    dontBreakRows: true
                }
            });

            //Screenshot page
            let screenShotBody = new Array();
           screenShotBody.push([{ text: 'Screenshots', style: 'tableHeader', fillColor: "#FF9E16", alignment: 'center', colSpan:2},{}]);
            //Get the screeshot list
            let screenshotTags = Array();
            let scount=0;
            
            for(ele of screenshots) {
                for(let i = 0; i < (ele.images).length; i++){
                let  x ;
                if(scount == 0 )
                        x = [{ text: ele.step  + ((ele.images).length > 1 ? " #"+ (i+1) : "") + "       Screenshot Time: "+ ele.screenshotTime[i] + "\n\n", style: 'tableData'} ].concat(ele.images[i]);
                else
                        x = [{ text: ele.step   + ((ele.images).length > 1 ? " #"+ (i+1) : "") +  "       Screenshot Time: "+ ele.screenshotTime[i] + "\n\n", style: 'tableData', pageBreak: 'before'} ].concat(ele.images[i]);
                scount++;
                screenshotTags.push(x)
            }

            }

            screenShotBody.push([{text: 'Screenshots Attached: ' + (scount >= 1 ?' Yes' : ' No'), style: 'tableData'}, 
            { text: 'If yes, Number of Screenshots Attached: ' + scount, style: 'tableData', alignment: 'center'}]);

            screenShotBody.push([{stack: screenshotTags, colSpan: 2}, {}]);
            dynamicContent.push(
                {
                    margin: [0, 0, 0, -1000],
                    pageBreak: 'before',
                    table: {
                        body: screenShotBody,
                        widths: [340, 350]
                    }
                });
        }
    }else if( reportConfig.type == "Type7"){
        let screenshots = Array()
        gCtx.preReqImgs.forEach(({stepNum, scrNum, img }, index) => {
            screenshots.push({
                step: `PTS Step #${stepNum} Screenshot #${scrNum}`,
                images: [img], 
                screenshotTime: [gCtx.preReqScreenshotTime[index]]
            });
        });
        //console.log("Screenshots: ", screenshots);
        for (let i = 1; i < suiteArg.length; i++) {
            let body = new Array();
    
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', fillColor: "#C23D48", alignment: 'center' },
                { text: 'Description', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#C23D48" },
                { text: 'Expected Results ', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#C23D48" },
                { text: 'Actual Results', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#C23D48" },
                { text: 'Status', style: 'tableHeader', alignment: 'center', fillColor: "#C23D48" },
            );
            body.push(tableTitle1);

            let rowCount = 1
            suiteArg[i].testData.forEach(function (row) {
               // console.log("------------->"+JSON.stringify(row, null, 4));

                let dataRow = new Array();
                dataRow.push({ text: rowCount +"\n"+row[8] , style: 'tableHeader', fillColor: "#C23D48" });
                dataRow.push(row[0]); //Description		 
                dataRow.push(row[3]); //Expected Results
                dataRow.push(row[4] ); //Actual Results
                //console.log("=============>"+JSON.stringify(row[2], null, 4));
                dataRow.push([row[1],"\n", row[2]]); //Status
                body.push(dataRow);
                //console.log("=============>"+row[7].length);
                if(typeof row[7] !== 'undefined' && row[7].length >0){
                    screenshots.push({
                        step: "Step #" + rowCount +" Screenshot",
                        images: row[5],
                        screenshotTime: row[7]
                    });
                }
                rowCount++;
            });

            dynamicContent.push(
            {
                margin: [40, 20, 40, 20],
                pageBreak: 'before',
                table: {
                    body: body,
                    widths: [65, 205, 165, 165 , 80],
                    headerRows: 1,
                    dontBreakRows: false
                }
            });
            //Screenshot page
            let screenShotBody = new Array();
            screenShotBody.push([{ text: 'Screenshots', style: 'tableHeader', fillColor: "#C23D48", alignment: 'center', colSpan:2},{}]);
            //Get the screeshot list
            let screenshotTags = Array();
            let scount=0;
            
            for(ele of screenshots) {
                for(let i = 0; i < (ele.images).length; i++){
                    let  x ;
                    if(scount == 0 ){
                        x = [{ text: ele.step  + ((ele.images).length > 1 ? " #"+ (i+1) : "") + "       Screenshot Time: "+ ele.screenshotTime[i] + "\n\n", style: 'tableData'} ].concat(ele.images[i]);
                    } else {
                        x = [{ text: ele.step   + ((ele.images).length > 1 ? " #"+ (i+1) : "") +  "       Screenshot Time: "+ ele.screenshotTime[i] + "\n\n", style: 'tableData', pageBreak: 'before'} ].concat(ele.images[i]);
                    }
                    scount++;
                    screenshotTags.push(x)
                }

            }

            screenShotBody.push([{text: 'Screenshots Attached: ' + (scount >= 1 ?' Yes' : ' No'), style: 'tableData'}, 
            { text: 'If yes, Number of Screenshots Attached: ' + scount, style: 'tableData', alignment: 'center'}]);

            screenShotBody.push([{stack: screenshotTags, colSpan: 2}, {}]);
            dynamicContent.push(
                {
                    margin: [30, 0, 40, -40],
                    pageBreak: 'before',
                    table: {
                        body: screenShotBody,
                        widths: [340, 350]
                    }
                });
        }
    }
    //Last page
    let refBody = new Array();

    if(reportConfig.type == "Type4"){
        refBody.push({
                "table":{
                "widths": ['50%','10%','30%','10%'],
                "body":[
                    [{ "text": 'Test Case Series Number', "fillColor": "#95B3D7", "alignment": 'left', "bold":true, "fontSize": 10},
                    { "text": "$tc_Sno", "alignment": 'left', "bold":true, "fontSize": 10},
                    { "text": 'Retest Number (or N/A for Orginal)', "fillColor": "#95B3D7", "alignment": 'left', "bold":true, "fontSize": 10},
                    { "text": 'NA', "alignment": 'left', "bold":true, "fontSize": 10}
                    ],
                    [{ "text": 'Date and Time Testing Stopped (e.g., 28-DEC-2023 15:19:18 GMT-08:00)', "fillColor": "#95B3D7", "alignment": 'left', "bold":true, "fontSize": 10},
                    { "text":  "$endTime", "alignment": 'left', "bold":true, "colSpan":3, "fontSize": 10},
                    {},
                    {}
                    ]                                     
                ]
                },
                "margin":[5,10,15,20],
                pageBreak: 'before'
            },
            {
                "table":{
                "widths": ['50%','50%'],
                "body":[
                    [{ "text": 'ELECTRONIC SIGNATURES', "fillColor": "#95B3D7", alignment: 'center', "bold":true, "fontSize": 10, "colSpan":2},
                    {}
                    ],
                    [
                        [
                            { "text": 'Tester Signature',  alignment: 'left', "fontSize": 10, "bold":true},
                            { "text": "\n(I confirm that I completed the above testing, and the entries are complete and correct)", "fillColor": "#95B3D7", "alignment": 'left', "fontSize": 10},
                        ],
                        [
                            { "text": 'QA Reviewer Signature',  "alignment": 'left', "fontSize": 10, "bold":true},
                            { "text": "\n(I confirm that I reviewed the above testing for completeness and correctness)", "fillColor": "#95B3D7", "alignment": 'left', "fontSize": 10},
                        ]
                    ]                                     
                ]
            },
            "margin":[5,10,15,20]
            }
        );
        findAndReplaceString(refBody,"$tc_Sno", tc[0].test_case_series);
        findAndReplaceString(refBody,"$endTime", suiteArg[0].endTime);
        dynamicContent.push(refBody);

    }else if (reportConfig.type == "Type5"){
         refBody.push([{ text: 'Script Execution Approval', alignment: 'center', style: 'tableHeader', fillColor: "#FF9E16", colSpan:2  }, {}]);
        // refBody.push([{ text: 'Status Pass/Fail:', style: 'tableHeader', fillColor: "#FF9E16" , rowSpan: 2},['',{ text: suiteArg[0].status , style: 'tableData'}]],
        //     ['',{text: 'Executed through automation', italics: true, style: 'tableData'  }] );

        refBody.push([{ text: 'Status Pass/Fail:', style: 'tableHeader', fillColor: "#FF9E16" },{ text: failureLocationText + '\n\n', style: 'tableData'}]);

        refBody.push([{ text: 'Executed by', style: 'tableHeader', fillColor: "#FF9E16" },{text: 'Executed through automation'+ '\n\n', italics: true, style: 'tableData'  }]);

        //refBody.push([{ },[{},{text: 'Executed through automation'+'\n\n', italics: true, style: 'tableData'  }] ]);             
  
        refBody.push([{ text: 'Validation Specialist', style: 'tableHeader', fillColor: "#FF9E16" },
                        [{text: (typeof firstPage.testData.ValidationSpecialist != 'undefined' ? firstPage.testData.ValidationSpecialist : 'Molly Baechler') + '\n\n', style: 'tableData'  }, {text: 'Approval by Electronic Signature'+'\n\n', italics: true, style: 'tableData'  } ]]);

        refBody.push([{ text: 'Business/Technical Approver', style: 'tableHeader', fillColor: "#FF9E16" },
                     [{text: (typeof firstPage.testData.Approver != 'undefined' ? firstPage.testData.Approver : '') + '\n\n', style: 'tableData'  }, {text: 'Approval by Electronic Signature'+'\n\n', italics: true, style: 'tableData'  } ]]);
        refBody.push([{ text: 'Quality Approver', style: 'tableHeader', fillColor: "#FF9E16" },
                     [{text: (typeof firstPage.testData.QualityApprover != 'undefined' ? firstPage.testData.QualityApprover : '') + '\n\n', style: 'tableData'  }, {text: 'Approval by Electronic Signature'+'\n\n', italics: true, style: 'tableData'  } ]]);
   
        dynamicContent.push(
            {
                margin: [40, 50, 40, 40],
                pageBreak: 'before',
                table: {
                    headerRows: 1,
                    widths: [100, 600],
                    dontBreakRows: true,
                    body: refBody
                }
            });
    
    }else if (reportConfig.type == "Type8"){
         refBody.push([{ text: 'Script Execution Approval', alignment: 'center', style: 'tableHeader', fillColor: "#FF9E16", colSpan:2  }, {}]);
        // refBody.push([{ text: 'Status Pass/Fail:', style: 'tableHeader', fillColor: "#FF9E16" , rowSpan: 2},['',{ text: suiteArg[0].status , style: 'tableData'}]],
        //     ['',{text: 'Executed through automation', italics: true, style: 'tableData'  }] );

        refBody.push([{ text: 'Status Pass/Fail:', style: 'tableHeader', fillColor: "#FF9E16" },{ text: suiteArg[0].status + '\n\n', style: 'tableData'}]);

        refBody.push([{ text: 'Executed by', style: 'tableHeader', fillColor: "#FF9E16" },{text: 'Executed through automation'+ '\n\n', italics: true, style: 'tableData'  }]);

        //refBody.push([{ },[{},{text: 'Executed through automation'+'\n\n', italics: true, style: 'tableData'  }] ]);             
  
        refBody.push([{ text: 'Validation Specialist', style: 'tableHeader', fillColor: "#FF9E16" },
                        [{text: '' + '\n\n', style: 'tableData'  }, {text: 'Approval by Electronic Signature'+'\n\n', italics: true, style: 'tableData'  } ]]);

        refBody.push([{ text: 'Approver', style: 'tableHeader', fillColor: "#FF9E16" },
                     [{text: '' + '\n\n', style: 'tableData'  }, {text: 'Approval by Electronic Signature'+'\n\n', italics: true, style: 'tableData'  } ]]);
        refBody.push([{ text: 'Quality Approver', style: 'tableHeader', fillColor: "#FF9E16" },
                     [{text: ''+ '\n\n', style: 'tableData'  }, {text: 'Approval by Electronic Signature'+'\n\n', italics: true, style: 'tableData'  } ]]);
   
        dynamicContent.push(
            {
                margin: [40, 50, 40, 40],
                pageBreak: 'before',
                table: {
                    headerRows: 1,
                    widths: [100, 600],
                    dontBreakRows: true,
                    body: refBody
                }
            });
    
    }else if (reportConfig.type == "Type6"){
        // No reference page for type 6
    }else if (reportConfig.type == "Type7"){
        refBody.push([{ text: 'Script Execution Approval - to be completed by Validation Lead', style: 'tableHeader', fillColor: "#C23D48", alignment: 'center',colSpan:2  }, {}]);
        refBody.push([{ text: 'Deviations', style: 'tableHeader', fillColor: "#C23D48", rowSpan:2 },
                     {text:'Were there any deviations that were observed during the execution?  NO', style: 'tableData'  }]);
        refBody.push([{ },
                     {text:'If yes, have they been successfully resolved? ', style: 'tableData'  }]);
        refBody.push([{ text: 'Acceptance Criteria', style: 'tableHeader', fillColor: "#C23D48" },
                     {text:'Have all test steps been successfully executed? ' + (suiteArg[1].status == "PASS" ? "YES": "NO"), style: 'tableData'  }]);
        refBody.push([{ text: 'Validation Lead', style: 'tableHeader', fillColor: "#C23D48" },
                     {text:'Electronically signed through Veeva', style: 'tableData'  }]);
        refBody.push([{ text: 'Quality Assurance Approver', style: 'tableHeader', fillColor: "#C23D48" },
                     {text:'Electronically signed through Veeva', style: 'tableData'  }]);
    
        dynamicContent.push(
            {
                margin: [40, 50, 40, 40],
                pageBreak: 'before',
                table: {
                    headerRows: 1,
                    widths: [100, 600],
                    dontBreakRows: true,
                    body: refBody
                }
            });
    }else {
        refBody.push([{ text: 'Script Execution Approval - to be completed by Validation Lead', style: 'tableHeader', fillColor: "#F79646", colSpan:2  }, {}]);
        refBody.push([{ text: 'Deviations', style: 'tableHeader', fillColor: "#F79646", rowSpan:2 },
                     {text:'Were there any deviations that were observed during the execution?  NO', style: 'tableData'  }]);
        refBody.push([{ },
                     {text:'If yes, have they been successfully resolved? ', style: 'tableData'  }]);
        refBody.push([{ text: 'Acceptance Criteria', style: 'tableHeader', fillColor: "#F79646" },
                     {text:'Have all test steps been successfully executed? ' + (suiteArg[1].status == "PASS" ? "YES": "NO"), style: 'tableData'  }]);
        refBody.push([{ text: 'Validation Lead', style: 'tableHeader', fillColor: "#F79646" },
                     {text:'Electronically signed through Veeva', style: 'tableData'  }]);
        refBody.push([{ text: 'Quality Assurance Approver', style: 'tableHeader', fillColor: "#F79646" },
                     {text:'Electronically signed through Veeva', style: 'tableData'  }]);
    
        dynamicContent.push(
            {
                margin: [40, 50, 40, 40],
                pageBreak: 'before',
                table: {
                    headerRows: 1,
                    widths: [100, 600],
                    dontBreakRows: true,
                    body: refBody
                }
            });
    }


    if(useDbSteps){
        //create test steps entries in database.
        try {
            let testcaseStep = {};
            let screenshotPaths = [];  // Store the S3 paths of the uploaded images
            let screenshotTimes = [];  // Store the time of upload
            if (!_.isEmpty(suiteArg[1].preTestStep.Steps) ) {

                testcaseStep["type"]= "Setup Step";
                testcaseStep["procedure"]= JSON.stringify(suiteArg[1].preTestStep.Steps);
                testcaseStep["step_no"]= 1;
                testcaseStep["tag_id"]= tc[0].tag_id;
                testcaseStep["test_case_id"]= tc[0].test_case_id;
                testcaseStep["build_no"]= batchID;
                testcaseStep["execution_id"]=firstPage.execution_id;

                try {
                    const uploadPromises = gCtx.preReqImgs
                    .filter(imageData => imageData?.img?.image)   // remove invalid entries
                    .map((imageData, index) => {

                        const { stepNum, scrNum, img } = imageData;
                        const timeTaken = gCtx.preReqScreenshotTime[index];

                        const screenshot = img.image.slice();
                        const fn = `${firstPage.project_id}/${firstPage.execution_id}/PTS/${stepNum}-${scrNum}-screenshot.png`;

                        return uploadImage({ fn, screenshot })
                            .then((imagePath) => {
                                screenshotPaths.push(imagePath);
                                screenshotTimes.push(timeTaken);
                            });
                    });

                    // Wait for all uploads to finish concurrently
                    const results = await Promise.all(uploadPromises);
                    testcaseStep["screenshots"] =  {
                        "images": screenshotPaths,
                        "screenshotTime":screenshotTimes
                    }
                } catch (error) {
                    throw new Error('Error during concurrent PTS images uploads:', error);
                }
                await testCaseStepsResultsRepo.save(testcaseStep);
            }
            //console.log(" gCtx.testCaseSteps :"+gCtx.testCaseSteps.length);

            for (let index = 0; index < suiteArg[1].testData.length; index++) {

                const row = suiteArg[1].testData[index];
                const rowCount = index + 1;
            
                const testcaseStep = {};
                const screenshotPaths = [];
                const screenshotTimes = [];
            
                testcaseStep.type = "Execution Step";
                testcaseStep.step_no = rowCount;
                testcaseStep.tag_id = tc[0].tag_id;
                testcaseStep.test_case_id = tc[0].test_case_id;
                testcaseStep.build_no = batchID;
                testcaseStep.execution_id = firstPage.execution_id;
                testcaseStep.procedure = extractText(row[0]);
                testcaseStep.expected_result = extractText(row[3]);
                testcaseStep.actual_result = extractText(row[4]);
                testcaseStep.status = extractText(row[1]);
                testcaseStep.executed_time = extractText(row[2]);
            
                // Upload screenshots in parallel per step
                await Promise.all(
                    (row[5] || []).map(async (imageData, imgIndex) => {
                        const { image } = imageData;
                        if (!image) return;
            
                        const scrnshotTime = row[7]?.[imgIndex];
                        const fn = `${firstPage.execution_id}/${rowCount}-${imgIndex + 1}-screenshot.png`;
            
                        const screenshot = image.slice();
                        const imagePath = await uploadImage({ fn, screenshot });
            
                        if (imagePath) {
                            screenshotPaths.push(imagePath);
                            screenshotTimes.push(scrnshotTime);
                        }
                    })
                );
            
                testcaseStep.screenshots = {
                    images: screenshotPaths,
                    screenshotTime: screenshotTimes
                };
            
                await testCaseStepsResultsRepo.save(testcaseStep);
            }
        } catch (error) {
            console.log("Exception while processing executionsteps for connector: "+ error);
        }

    }else{
     //   console.log("Not a connector requests.")
    }
    // const fs = require('fs');
    // let jsonString = JSON.stringify(gCtx, null, 4);

    // // Write to file
    // fs.writeFile('gCtx.json', jsonString, (err) => {
    //     if (err) {
    //         console.error('Error writing file', err);
    //     } else {
    //         console.log('File saved successfully as gCtx.json');
    //     }
    // });

    // jsonString = JSON.stringify(suiteArg[1], null, 4);

    // // Write to file
    // fs.writeFile('suiteArg.json', jsonString, (err) => {
    //     if (err) {
    //         console.error('Error writing file', err);
    //     } else {
    //         console.log('File saved successfully as suiteArg.json');
    //     }
    // });

    let docDefinition = {
        info: {
            title: 'V-Assure Test Execution Results',
            author: 'Spotline Inc.',
            subject: 'V-Assure Test Execution Results'
        },
        pageMargins : reportConfig.pageMargins, //[30, 70, 30, 50],
        pageOrientation: (typeof tc[0].test_case_name != 'undefined' ? reportConfig.firstPage.pageOrientation : 'portrait'),
        header:  (currentPage, pageCount, pageSize) => {
            if(currentPage == 1 ){
                if(reportConfig.type == "Type1") {
                    findAndReplaceString(reportConfig.firstPage.header,"$logo",reportConfig.logo);
                    findAndReplaceEvalNum(reportConfig.firstPage.header,"$psw",pageSize.width);
                    return reportConfig.firstPage.header;
                }else if(reportConfig.type == "Type3" || reportConfig.type == "Type5" || reportConfig.type == "Type6" || reportConfig.type == "Type7" || reportConfig.type == "Type8") {
                    findAndReplaceString(reportConfig.firstPage.header,"$logo",reportConfig.logo);
                    return reportConfig.firstPage.header;
                }else if(reportConfig.type == "Type4") {
                    let pageHead  = JSON.parse(JSON.stringify(reportConfig.firstPage.header));

                    findAndReplaceString(pageHead,"$logo",reportConfig.logo);
                    findAndReplaceString(pageHead, "$currentPage", currentPage.toString());
                    findAndReplaceString(pageHead, "$pageCount", pageCount);
                    findAndReplaceString(pageHead,"$release_no",tc[0].release_no);
                    findAndReplaceString(pageHead,"$change_no",(typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.changeControlNo : ''));
                    return pageHead
                }
            } 
            else {
                if(reportConfig.type == "Type1") {
                    findAndReplaceString(reportConfig.otherPage.header,"$batchID",batchID);
                    let otherPageHeader  = JSON.parse(JSON.stringify(reportConfig.otherPage.header));
                    findAndReplaceEvalNum(otherPageHeader,"$psw",pageSize.width);
                    return otherPageHeader;
                }else if(reportConfig.type == "Type3" ) {
                    findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                    findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", tc[0].tag_id.replace(/_/g, ' ') + " - " + tc[0].test_case_name);
                    findAndReplaceString(reportConfig.otherPage.header,"$DocumentID", suiteArg[1].preTestStep.documentID);
                    findAndReplaceString(reportConfig.otherPage.header,"$Version", tc[0].release_no);                    
                    return reportConfig.otherPage.header;
                }else if( reportConfig.type == "Type5" || reportConfig.type == "Type8" ) {
                    findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                    findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", tc[0].test_case_id );
                    return reportConfig.otherPage.header;
                }else if(reportConfig.type == "Type0") {
                    findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                    findAndReplaceString(reportConfig.otherPage.header,"$ProjectName",  "Operational Qualification - " + firstPage.firstPageContent1 + " - " + firstPage.vaultName );
                    return reportConfig.otherPage.header;
                }else if(reportConfig.type == "Type4") {
                    let pageHead  = JSON.parse(JSON.stringify(reportConfig.firstPage.header));
                    findAndReplaceString(pageHead,"$logo",reportConfig.logo);
                    findAndReplaceString(pageHead, "$currentPage", currentPage.toString());
                    findAndReplaceString(pageHead, "$pageCount", pageCount);
                    findAndReplaceString(pageHead,"$release_no",tc[0].release_no);
                    findAndReplaceString(pageHead,"$change_no",(typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.changeControlNo : ''));

                    return pageHead
                } else if( reportConfig.type == "Type6") {
                    findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                    findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", `${tc[0].test_case_id}-Auto` );
                    return reportConfig.otherPage.header;

                } else if(reportConfig.type == "Type7") {
                    findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                    findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", tc[0].test_case_id );
                    return reportConfig.otherPage.header;
                }
            }
        },
        footer:  (currentPage, pageCount, pageSize) => {
            if(currentPage == 1 ){
                 if(reportConfig.type == "Type3" || reportConfig.type == "Type0" ) {
                    let pageFooter  = JSON.parse(JSON.stringify(reportConfig.firstPage.footer));
                    findAndReplaceString(pageFooter,"$currentPage",currentPage);
                    findAndReplaceString(pageFooter,"$pageCount",pageCount);
                    return pageFooter;
                 }else if(reportConfig.type == "Type4") {
                    return reportConfig.firstPage.footer;
                }else if(reportConfig.type == "Type5" || reportConfig.type == "Type6" || reportConfig.type == "Type7" || reportConfig.type == "Type8") {
                    let pageFooter  = JSON.parse(JSON.stringify(reportConfig.firstPage.footer));
                    findAndReplaceEvalNum(pageFooter,"$psw",pageSize.width);
                    findAndReplaceString(pageFooter,"$currentPage",currentPage);
                    findAndReplaceString(pageFooter,"$pageCount",pageCount);
                    return pageFooter;                
                }

                // }else if(reportConfig.type == "Type1") {
                // }
            } else {
                if(reportConfig.type == "Type3" || reportConfig.type == "Type0"  ) {
                    let pageFooter  = JSON.parse(JSON.stringify(reportConfig.otherPage.footer));
                    findAndReplaceString(pageFooter,"$currentPage",currentPage);
                    findAndReplaceString(pageFooter,"$pageCount",pageCount);
                    return pageFooter;
                }else if(reportConfig.type == "Type4") {
                    return reportConfig.otherPage.footer;
                }else if(reportConfig.type == "Type5" || reportConfig.type == "Type6" || reportConfig.type == "Type7" || reportConfig.type == "Type8") {
                    let pageFooter  = JSON.parse(JSON.stringify(reportConfig.otherPage.footer));
                    findAndReplaceEvalNum(pageFooter,"$psw",pageSize.width);
                    findAndReplaceString(pageFooter,"$currentPage",currentPage);
                    findAndReplaceString(pageFooter,"$pageCount",pageCount);
                    return pageFooter;                
                }
            }
            //for Type1 all page same footer
            if(reportConfig.type == "Type1") {
                let pageFooter  = JSON.parse(JSON.stringify(reportConfig.otherPage.footer));
                findAndReplaceEvalNum(pageFooter,"$psw",pageSize.width);
                findAndReplaceString(pageFooter,"$currentPage",currentPage);
                findAndReplaceString(pageFooter,"$pageCount",pageCount);
                 //console.log(pageFooter[0].canvas[0].x2);
                 return pageFooter;
            }
        },
        styles: {
            tableHeader: {
                fontSize: 10,
                bold: true,
                color: '#FFFFFF',
                fillColor: '#191970',
            },
            tableData: {
                fontSize: 10
            }
        },
        defaultStyle: {
            font: 'Helvetica'
        },
        content: dynamicContent
    }
    return docDefinition;
}

async function uploadImage({ fn, screenshot }) {

    if (!screenshot || screenshot.trim().length === 0) {
        console.log(fn + " called with empty screenshot");
        return null;
    }

    if (typeof screenshot !== 'string') {
        console.log(`${fn} Expected screenshot to be string, got ${typeof screenshot}`);
        return null;
    }

    const matches = screenshot.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!matches) {
        console.log("Invalid base64 image format " + fn);
        return null;
    }

    const contentType = matches[1];
    const imageBuffer = Buffer.from(matches[2], 'base64');

    const parallelUpload = new Upload({
        client: s3,
        params: {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fn,
            Body: imageBuffer,
            ContentEncoding: 'base64',
            ContentType: contentType
        }
    });

    try {
        const data = await parallelUpload.done();
      //  console.log(`Successfully uploaded: ${fn}`);
        return fn; 
    } catch (error) {
        console.error(`Error uploading ${fn}:`, error);
        return null;
    }
}

function extractText(input) {
    if (!input) return "";

    // If array → join text values with newline
    if (Array.isArray(input)) {
        return input
            .map(item => item?.text)
            .filter(Boolean)
            .join("\n");
    }

    // If object → return text
    if (typeof input === "object") {
        return input.text || "";
    }

    // Fallback
    return "";
}

async function myTableBody_Template(suiteArg, firstPage, org, batchID, gCtx) {

    let reportConfig = await getReportConfig(org, true, firstPage);
    let tc = await getTestDescription(suiteArg[1].testID, firstPage.test_suite_id, firstPage, suiteArg);
    let userDetail = await userDetails(firstPage.userID, firstPage);
    let appInfoData = null;
    try { appInfoData = await appInfoRepo.getAll(); } catch(e) {}

    //console.log("------------->"+JSON.stringify(firstPage, null, 4));
    let dynamicContent = new Array();
    //First Page
    if(reportConfig.type == "Type3"){
        findAndReplaceString(reportConfig.firstPage.content,"$TagId", tc[0].tag_id.replace(/_/g, ' '));
        findAndReplaceString(reportConfig.firstPage.content,"$ProjectName", "Veeva Vault v" + firstPage.veevaRelease + " " + firstPage.firstPageContent1);
        findAndReplaceString(reportConfig.firstPage.content,"$DocumentID",suiteArg[1].preTestStep.documentID);
        findAndReplaceString(reportConfig.firstPage.content,"$ScriptTitle", tc[0].test_case_name);
        findAndReplaceString(reportConfig.firstPage.content,"$Version", tc[0].release_no);
        findAndReplaceString(reportConfig.firstPage.content,"$logo",reportConfig.logo);
        findAndReplaceString(reportConfig.firstPage.content,"$VaultEnvironment", firstPage.vaultName);

        dynamicContent.push(reportConfig.firstPage.content);
    }else if( reportConfig.type == "Type5" || reportConfig.type == "Type8" ){
        findAndReplaceString(reportConfig.firstPage.content,"$TagId", tc[0].test_case_id);
        findAndReplaceString(reportConfig.firstPage.content,"$ScriptTitle", tc[0].test_case_name);
        dynamicContent.push(reportConfig.firstPage.content);
    } else if(reportConfig.type == "Type0"){
        findAndReplaceString(reportConfig.firstPage.content,"$logo",reportConfig.logo);
        if(firstPage.testData.project_type == "eTMF"){
            findAndReplaceString(reportConfig.firstPage.content, "$ProjectDescription", "electronic Trial Master File (eTMF) System");
        }else if(firstPage.testData.project_type == "QMS"){
            findAndReplaceString(reportConfig.firstPage.content, "$ProjectDescription", "Quality Management System (QMS)");
        }else if(firstPage.testData.project_type == "QualityDocs"){
            findAndReplaceString(reportConfig.firstPage.content, "$ProjectDescription", "Quality Documents System (QualityDocs)");
        }else{
            findAndReplaceString(reportConfig.firstPage.content, "$ProjectDescription", firstPage.testData.project_type);
        }
        dynamicContent.push(reportConfig.firstPage.content);
       // console.log("------------->"+JSON.stringify(reportConfig.firstPage.content, null, 4));
    } else if(reportConfig.type == "Type1"){
        findAndReplaceString(reportConfig.firstPage.content,"$veevaRelease", firstPage.veevaRelease);
        findAndReplaceString(reportConfig.firstPage.content,"$environment", firstPage.vaultName);
        findAndReplaceString(reportConfig.firstPage.content,"$scriptRelease", suiteArg[0].scriptRelease);
        findAndReplaceString(reportConfig.firstPage.content,"$batchID", batchID);
        dynamicContent.push(reportConfig.firstPage.content);
    }  else if(reportConfig.type == "Type4"){
        findAndReplaceString(reportConfig.firstPage.content,"$tc_Sno", tc[0].test_case_series);
        findAndReplaceString(reportConfig.firstPage.content,"$startTime", '');
        findAndReplaceString(reportConfig.firstPage.content,"Automation", '');
        findAndReplaceString(reportConfig.firstPage.content,"Yes", '');
       // console.log("------------->"+JSON.stringify(reportConfig.firstPage.content, null, 4));
        dynamicContent.push(reportConfig.firstPage.content);
    } else if(reportConfig.type == "Type6" ){
        findAndReplaceString(reportConfig.firstPage.content,"$TagId", `${tc[0].test_case_id}-Auto`);
        findAndReplaceString(reportConfig.firstPage.content,"$ProjectName", "Veeva Vault v" + firstPage.veevaRelease + " " + firstPage.firstPageContent1);
        findAndReplaceString(reportConfig.firstPage.content,"$DocumentID",suiteArg[1].preTestStep.documentID);
        findAndReplaceString(reportConfig.firstPage.content,"$ScriptTitle", tc[0].test_case_name);
        findAndReplaceString(reportConfig.firstPage.content,"$Version", tc[0].release_no);
        findAndReplaceString(reportConfig.firstPage.content,"$logo",reportConfig.logo);
        findAndReplaceString(reportConfig.firstPage.content,"$startTime", suiteArg[0].startTime);
        findAndReplaceString(reportConfig.firstPage.content,"$endTime", suiteArg[0].endTime);
        findAndReplaceString(reportConfig.firstPage.content,"$VaultEnvironment", firstPage.vaultName);

        dynamicContent.push(reportConfig.firstPage.content);
    } else if (reportConfig.type == "Type7"){
        findAndReplaceString(reportConfig.firstPage.content,"$TagId", tc[0].test_case_id);
        findAndReplaceString(reportConfig.firstPage.content,"$VRefID", tc[0].vassureReferenceNo);
        findAndReplaceString(reportConfig.firstPage.content,"$ProjectName", "Veeva Vault v" + firstPage.veevaRelease + " " + firstPage.firstPageContent1);
        findAndReplaceString(reportConfig.firstPage.content,"$DocumentID",suiteArg[1].preTestStep.documentID);
        findAndReplaceString(reportConfig.firstPage.content,"$ScriptTitle", tc[0].test_case_name);
        findAndReplaceString(reportConfig.firstPage.content,"$Version", tc[0].release_no);
        findAndReplaceString(reportConfig.firstPage.content,"$logo",reportConfig.logo);
        findAndReplaceString(reportConfig.firstPage.content,"$startTime", suiteArg[0].startTime);
        findAndReplaceString(reportConfig.firstPage.content,"$endTime", suiteArg[0].endTime);
        findAndReplaceString(reportConfig.firstPage.content,"$VaultEnvironment", firstPage.vaultName);

        dynamicContent.push(reportConfig.firstPage.content);
    }

    //Second page
    if(reportConfig.type == "Type3"){

        dynamicContent.push(
        {
            margin: [30, 0, 50, 20],
            text: 'VERSION HISTORY\n',
            style: 'subheader',
            pageBreak: 'before'
        });

        let verBody = new Array();
        let verTitle = new Array(
            { text: 'Version Number', 	fillColor:'#808080', alignment: 'center' },
            { text: 'Date', fillColor:'#808080', alignment: 'center' },
            { text: 'Description', fillColor:'#808080', alignment: 'center' },
            { text: 'Author(s)', fillColor:'#808080', alignment: 'center' }
            );
                
        verBody.push(verTitle);
        let dataRow = new Array();
        dataRow.push({text:"1.0", style: 'tableData', alignment: 'center'});
        dataRow.push({text:moment.utc().format("DD MMM YYYY").toUpperCase(), style: 'tableData', alignment: 'center'});
        dataRow.push({text:"New Document", style: 'tableData', alignment: 'center'});
        dataRow.push({text:"Automation", style: 'tableData', alignment: 'center'});
        verBody.push(dataRow);
        dynamicContent.push(
            {
                table: {
                    body: verBody,
                    widths: [90, 100, 200, 80],
                    headerRows: 1,
                    pageBreak: 'before',
                },
                margin: [25, 2, 10, 2]
            });
    }else if (reportConfig.type == "Type0"){
        // console.log("reportConfig.firstPage------------->"+JSON.stringify(reportConfig, null, 4));
         findAndReplaceString(reportConfig.secondPage.content,"$ProjectName", "Veeva Vault v" + firstPage.veevaRelease + " " + firstPage.firstPageContent1);
         findAndReplaceString(reportConfig.secondPage.content,"$TestCaseID", tc[0].test_case_id);
         findAndReplaceString(reportConfig.secondPage.content,"$UserName", (typeof userDetail != 'undefined'? userDetail[0].first_name +" "+ userDetail[0].last_name : ''));
         findAndReplaceString(reportConfig.secondPage.content,"$startTime", "");
         findAndReplaceString(reportConfig.secondPage.content,"$endTime", "");
         findAndReplaceString(reportConfig.secondPage.content,"$VaultEnvironment", firstPage.vaultName);
 
         dynamicContent.push(reportConfig.secondPage.content);
        //TOC section
        dynamicContent.push(
            {
                 //margin: [30, 0, 30, 30],
                toc: {
                     title: { text: 'Table of Contents\n\n\n', color: '#000080', fontSize: 15 }
                 }
            });
    } else if (reportConfig.type == "Type1" ){
        //TOC section
        dynamicContent.push(
            {
                //margin: [30, 0, 30, 30],
                toc: {
                    title: { text: 'Table of Contents\n\n\n', color: '#000080', fontSize: 15 }
                },
                pageBreak: 'before'
            });
    }else if(reportConfig.type == "Type4"){
        // No page
    } else if(reportConfig.type == "Type5" || reportConfig.type == "Type8"){
        // No page
    } else if(reportConfig.type == "Type6"){
        // No page
    } else if(reportConfig.type == "Type7"){
        // No page
    }

    //Third page to landscape 
    if(reportConfig.type == "Type3"  ){   
        let sumTitle = new Array();
        let sumBody = new Array();
        
        sumTitle.push({ text: 'Script Number', style: 'tableHeader', "fillColor": "#F79646" });
        sumTitle.push({ text: tc[0].tag_id.replace(/_/g, ' '), style: 'tableHeader', "fillColor": "#F79646" });
        sumBody.push(sumTitle);

        let dataRow = new Array();
        dataRow.push({ text: 'Test Description:', style: 'tableHeader', "fillColor": "#F79646" });
        dataRow.push({ text: (typeof tc[0].test_case_name != 'undefined'? "Script for "+tc[0].test_case_name : 'NA'), style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Purpose:', style: 'tableHeader', "fillColor": "#F79646" });
        dataRow.push({ text: (typeof tc[0].description != 'undefined'? tc[0].description: 'NA'), style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Tester(s):', style: 'tableHeader', "fillColor": "#F79646" });
        dataRow.push({ text: 'Automation', style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Execution Number:', style: 'tableHeader', "fillColor": "#F79646" });
        dataRow.push({ text: batchID, style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Test Environment:', style: 'tableHeader', "fillColor": "#F79646" });
        dataRow.push({ text: firstPage.vaultName, style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Pre-Test Setup:', style: 'tableHeader', "fillColor": "#F79646" });
        dataRow.push({ ul: suiteArg[1].preTestStep.Steps, style: 'tableData' })
        sumBody.push(dataRow);

        dynamicContent.push(
            {
                pageOrientation: 'landscape',
                margin: [30, 70, 20, 20],
                table: {
                    headerRows: 1,
                    widths: [100, 400],
                    dontBreakRows: true,
                    body: sumBody,
                },
                pageBreak: 'before'
            });
        
    }else if(reportConfig.type == "Type5" || reportConfig.type == "Type8" ){   
        let sumBody = new Array();
        let dataRow = new Array();

        dataRow.push({ text: 'Test Script ID', style: 'tableHeader', "fillColor": "#FF9E16" });
        dataRow.push({ text: tc[0].tag_id.replace(/_/g, '-'), style:  'tableData'  });
        dataRow.push({ text: 'Title', style: 'tableHeader', "fillColor": "#FF9E16" });
        dataRow.push({ text: (typeof tc[0].test_case_name != 'undefined'? tc[0].test_case_name : 'NA'), style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Description', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: (typeof tc[0].description != 'undefined'? tc[0].description: 'NA'), style: 'tableData', colSpan:3 });
        dataRow.push({});
        dataRow.push({});
        // dataRow.push({ text: 'Build Number', style: 'tableHeader', fillColor: "#FF9E16" });
        // dataRow.push({ text: '', style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Vault Name', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: "", style: 'tableData' });
        dataRow.push({ text: 'Product Version', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: "", style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'V-Assure Environment', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: "", style: 'tableData' });
        dataRow.push({ text: 'Run Number', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: "", style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Start Time', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: "", style: 'tableData'});
        dataRow.push({ text: 'End Time', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: "", style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Pre-Test Setup (PTS)', style: 'tableHeader', fillColor: "#FF9E16" });
        //dataRow.push({ ul: suiteArg[1].preTestStep.Steps, style: 'tableData' })
        //console.log("------------------>"+JSON.stringify(suiteArg[1].preTestStep.Steps, null, 4))
        findAndRemoveStringSpecialVar(suiteArg[1].preTestStep.Steps)
        try{
            if (!_.isEmpty(suiteArg[1].preTestStep.Steps) ) {

                let tmp = JSON.parse(suiteArg[1].preTestStep.Steps);
                //tmp.fontSize=10;
                tmp.style = 'tableData';
                tmp.colSpan = 3;
                dataRow.push(tmp);
            }else{
                dataRow.push({text:"", colSpan:3 });
            }
        }catch(e){
            dataRow.push({text:"", colSpan:3 });
        }

        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dynamicContent.push(
        {
            pageOrientation: 'landscape',
            margin: [30, 60, 20, 20],
            table: {
              //  headerRows: 1,
                widths: [100, 250, 100, 250],
                dontBreakRows: false,
                body: sumBody,
            },
            pageBreak: 'before'
        });

    }else if(reportConfig.type == "Type0" || reportConfig.type == "Type1") {
        // Table format summary section

        dynamicContent.push(
            {
                margin: [50, 0, 50, 10],
                pageOrientation: 'landscape',
                text: '1  Test Case Summary\n',
                color: '#000080',
                pageBreak: 'before',
                tocItem: true
            });

        dynamicContent.push(
            {
                text: 'This section lists all the test scripts used during the exeuction of the test case run.\n\n\n',
                margin: [50, 0, 50, 10],
                fontSize: 12,
                alignment: 'justify'
            });
        let summaryBody = new Array();

        let summTitle = new Array(
            { text: 'Test Case ID', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            { text: 'Script Version#', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            { text: 'Test Case Name', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            { text: 'Description', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            { text: 'Req#', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            { text: 'Start Time/ End Time', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" }
            );
            
        summaryBody.push(summTitle);
        for (let i = 1; i < suiteArg.length; i++) {
            let dataRow = new Array();
            let tc = await getTestDescription(suiteArg[i].testID, firstPage.test_suite_id);
            
            dataRow.push((typeof tc[0].test_case_id != 'undefined'? tc[0].test_case_id: 'NA'))
            dataRow.push(suiteArg[0].scriptRelease)
            dataRow.push((typeof tc[0].test_case_name != 'undefined'? tc[0].test_case_name : suiteArg[i].test));
            dataRow.push((typeof tc[0].description != 'undefined'? tc[0].description: 'NA'));
            dataRow.push((typeof tc[0].requirement_no != 'undefined'? tc[0].requirement_no: 'NA'))
            dataRow.push("");
            dataRow.push("");
            // console.log(dataRow);
            summaryBody.push(dataRow);
        }
        dynamicContent.push(
            {
                table: {
                    body: summaryBody,
                    //Adjust table.
                    widths: [45, 50, 150, 150, 110, 45, 130],
                    headerRows: 1,
                },
                margin: [35, 2, 2, 2],
              //  pageBreak: 'after',
            });
    }else if(reportConfig.type == "Type4"){
        // No page
    }else if(reportConfig.type == "Type6"){   
        let sumBody = new Array();
        let dataRow = new Array();

        dataRow.push({ text: 'Test Script ID', style: 'tableHeader', "fillColor": "#FF9E16" });
        dataRow.push({ text: `${tc[0].tag_id.replace(/_/g, '-')}-Auto`, style:  'tableData'  });
        dataRow.push({ text: 'Test Title', style: 'tableHeader', "fillColor": "#FF9E16" });
        dataRow.push({ text: (typeof tc[0].test_case_name != 'undefined'? tc[0].test_case_name : 'NA'), style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Test Description', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: (typeof tc[0].description != 'undefined'? tc[0].description: 'NA'), style: 'tableData'});
        dataRow.push({ text: 'Run Number', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: (typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.runNo : ''), style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        // dataRow.push({ text: 'History Number', style: 'tableHeader', fillColor: "#FF9E16" });
        // dataRow.push({ text: batchID, style: 'tableData'});
        dataRow.push({ text: 'Version Date', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: moment.utc(tc[0].release_date).format("DD-MMM-YYYY").toUpperCase(), style: 'tableData'});
        dataRow.push({ text: 'Test Version', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: tc[0].release_no, style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Start Time', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: suiteArg[0].startTime, style: 'tableData'});
        dataRow.push({ text: 'End Time', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: suiteArg[0].endTime, style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Steps Executed', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: suiteArg[1].testData.length , style: 'tableData'});
        dataRow.push({ text: 'Overall Status', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: (suiteArg[1].status == "PASS" ? "PASS": "FAIL"), style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Comments', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: "\n\n\n\n", style: 'tableData', colSpan:3});
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Reviewer Assessment', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({
            stack: [
                {
                    columns: [
                        { text: "Pass:", alignment: "left",fontSize: 10 },
                        { text: "Fail:",alignment: "left",fontSize: 10 },
                        { 
                            stack: [
                                { text: "Pass on Deviation:" ,fontSize: 10},
                                { text: "(Reference:                      )",fontSize: 10 }
                            ], 
                            width: "50%"
                        }
                    ]
                }
            ],
            colSpan: 3
        });
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Requirements Tested', style: 'tableHeader', fillColor: "#FF9E16" }); 
        dataRow.push({ text: (typeof tc[0].requirement_no != 'undefined'? tc[0].requirement_no: 'NA'), style: 'tableData',colSpan:3 });
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Test System', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({
            stack: [
                {
                    columns: [
                        { text: "Vault ID:", alignment: "left",fontSize: 10 },
                        { text: (typeof firstPage.veevaVaultID != 'undefined'? firstPage.veevaVaultID: 'NA'),alignment: "left",fontSize: 10,width: "85%" }
                    ]
                },
                {
                    columns: [
                        { text: "Product Version:", alignment: "left",fontSize: 10 },
                        { text: gCtx.veevaVaultVersion, alignment: "left",fontSize: 10, width: "85%" }
                    ]
                },
                {
                    columns: [
                        { text: "Device ID:", alignment: "left",fontSize: 10 },
                        { text: "V-Assure",alignment: "left",fontSize: 10, width: "85%" }
                    ]
                }
            ],
            colSpan: 3
        })
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Note', style: 'tableHeader', fillColor: "#FF9E16" });
        dataRow.push({ text: "Test run executed via automation.\n\n Post run reviews (Independent Review, GxP Acceptance) are performed in Veeva EDMS.\n\n Script steps and tested requirements are based upon the referenced Veeva Test Script.  As an independently controlled near copy of the original manually executed test, IDs managed within Spotline V-Assure are appended with “-Auto” suffix for uniqueness.", style: 'tableData', colSpan:3});
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Pre-Test Setup', style: 'tableHeader', fillColor: "#FF9E16" });
        // Removing the ##..## enclosed string from the string
        findAndRemoveStringSpecialVar(suiteArg[1].preTestStep.Steps)
        try{
            if (!_.isEmpty(suiteArg[1].preTestStep.Steps) ) {
                let tmp = JSON.parse(suiteArg[1].preTestStep.Steps);
                // console.log(JSON.stringify(tmp, null, 4));
                tmp.style = 'tableData';
                tmp.colSpan = 3;
                dataRow.push(tmp);
            }else{
                dataRow.push({text:"", colSpan:3 });
            }
        }catch(e){
            console.log(e);
            dataRow.push({text:"", colSpan:3 });
        }

        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dynamicContent.push(
        {
            pageOrientation: 'landscape',
            margin: [30, 70, 20, 20],
            table: {
              //  headerRows: 1,
                widths: [100, 250, 100, 250],
                dontBreakRows: false,
                body: sumBody,
            },
            pageBreak: 'before'
        });
    } else if(reportConfig.type == "Type7"){   
        let sumBody = new Array();
        let dataRow = new Array();

        dataRow.push({ text: 'Test Script ID', style: 'tableHeader', "fillColor": "#C23D48" });
        dataRow.push({ text: tc[0].tag_id.replace(/_/g, '-'), style:  'tableData'  });
        dataRow.push({ text: 'Test Suite Name / Test Script Name', style: 'tableHeader', "fillColor": "#C23D48" });
        dataRow.push({ text: (typeof tc[0].test_case_name != 'undefined'? tc[0].test_case_name : 'NA'), style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Test Description', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: (typeof tc[0].description != 'undefined'? tc[0].description: 'NA'), style:  'tableData'  });
        dataRow.push({ text: 'Test Suite/Script Version', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: tc[0].release_no, style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'V-Assure Build No', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: "", style: 'tableData'});
        dataRow.push({ text: 'Iteration', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: "", style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'V-Assure Environment', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: "", style: 'tableData'});
        dataRow.push({ text: 'Automated Test Framework Version', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: "", style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Tester (who ran/scheduled the automated test):', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: "", style: 'tableData' });
        dataRow.push({ text: 'Test Run Type:', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: "", style: 'tableData' });
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Start Time', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: "", style: 'tableData'});
        dataRow.push({ text: 'End Time', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: "", style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Steps Executed', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: "" , style: 'tableData'});
        dataRow.push({ text: 'Overall Test Result', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: "", style: 'tableData'});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Information on System Under Test (Name, Version, Build, OS, Browser)', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({
            stack: [
                {
                    columns: [
                        { text: "System Name:", alignment: "left",fontSize: 10 },
                        { text: "", alignment: "left",fontSize: 10,width: "85%" }
                    ]
                },
                {
                    columns: [
                        { text: "Version:", alignment: "left",fontSize: 10 },
                        { text: "", alignment: "left",fontSize: 10, width: "85%" }
                    ]
                },
                {
                    columns: [
                        { text: "Environment:", alignment: "left",fontSize: 10 },
                        { text: "", alignment: "left",fontSize: 10, width: "85%" }
                    ]
                },
                {
                    columns: [
                        { text: "Web Browser:", alignment: "left",fontSize: 10 },
                        { text: "", alignment: "left",fontSize: 10, width: "85%" }
                    ]
                }
            ],
            colSpan: 3
        })
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Requirements Tested', style: 'tableHeader', fillColor: "#C23D48" }); 
        dataRow.push({ text: (typeof tc[0].requirement_no != 'undefined'? tc[0].requirement_no: 'NA'), style: 'tableData',colSpan:3 });
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Comments', style: 'tableHeader', fillColor: "#C23D48" });
        dataRow.push({ text: "\n\n\n\n", style: 'tableData', colSpan:3});
        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dataRow = new Array();
        dataRow.push({ text: 'Test Objective(s)', style: 'tableHeader', fillColor: "#C23D48" });
        findAndReplaceStringSpecialChar(suiteArg[1].preTestStep.Steps)
        try{
        if (!_.isEmpty(suiteArg[1].preTestStep.Steps) ) {
          //  console.log(suiteArg[1].preTestStep.Steps);
        let tmp = JSON.parse(suiteArg[1].preTestStep.Steps);
               // console.log(JSON.stringify(tmp, null, 4));
        tmp.style = 'tableData';
        tmp.colSpan = 3;
        dataRow.push(tmp);
        }else{
            dataRow.push({text:"", colSpan:3 });
        }
        }catch(e){
            console.log(e);
            dataRow.push({text:"", colSpan:3 });
        }

        dataRow.push({});
        dataRow.push({});
        sumBody.push(dataRow);

        dynamicContent.push(
        {
            pageOrientation: 'landscape',
            margin: [30, 20, 20, 20],
            table: {
              //  headerRows: 1,
                widths: [100, 250, 100, 250],
                dontBreakRows: false,
                body: sumBody,
            },
            pageBreak: 'before'
        });
    }

    //Test Case Actual Report
    if( reportConfig.type == "Type0" || reportConfig.type == "Type1" ){
        
        for (let i = 1; i < suiteArg.length; i++) {
            let screenshots = Array()

            dynamicContent.push(
                {
                    margin: [50, 0, 50, 20],
                    text: "1." + (i) + "  " + suiteArg[i].test + " Report\n",
                    color: '#000080',
                    pageBreak: 'before',
                    tocItem: true
                });
            dynamicContent.push(
                {
                    text: 'This section lists all the test steps to be performed during the test case exeuction.\n\n',
                    margin: [50, 0, 50, 10],
                    fontSize: 12,
                    alignment: 'justify'
                });
            let body = new Array();
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', "fillColor": "#F79646", alignment: 'center' },
             //   { text: 'User', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Description of Action', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Expected Results ', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Actual Results', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            );
            body.push(tableTitle1);

            let rowCount = 1
            let ignoreColumns = [2,3,5,6];
            suiteArg[i].testData.forEach(function (row) {
                let dataRow = new Array();
                dataRow.push({ text: rowCount, style: 'tableData' });
                dataRow.push(row[0]); //Description of Action		 
                dataRow.push(row[3]); //Expected Results
                dataRow.push(""); //Actual Results
                dataRow.push(""); //Pass/Fail
                body.push(dataRow);
                rowCount++;
            });

            dynamicContent.push(
            {
                margin: [40, 10, 40, 40],
              //  pageBreak: 'after',
                table: {
                    body: body,
                    //widths: [30, 60, 220, 150, 150 , 75],
                    widths: [35, 220, 170, 170 , 70],
                    headerRows: 1,
                    //dontBreakRows: true
                }
            });

            //Screenshot page
            let screenShotBody = new Array();

            screenShotBody.push([{ text: 'Comments', style: 'tableHeader', fillColor: "#F79646", alignment: 'center', colSpan:2},{}]);

            //Get the screeshot list
            let screenshotTags = Array();

            screenShotBody.push([{text: 'Screenshots Attached: '}, 
            { text: 'If yes, Number of Screenshots Attached: ', alignment: 'center'}]);

            dynamicContent.push(
                {
                    // margin: [left, top, right, bottom]
                    margin: [40, 10, 40, 10],
                    pageBreak: 'before',
                    table: {
                        body: screenShotBody,
                        widths: [350, 350]
                    }
                });
        }

    }else if( reportConfig.type == "Type3" ){
        for (let i = 1; i < suiteArg.length; i++) {
            let body = new Array();
    
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', "fillColor": "#F79646", alignment: 'center' },
                { text: 'User', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Description of Action', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Expected Results ', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Actual Results', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            );
            body.push(tableTitle1);

            let rowCount = 1
            suiteArg[i].testData.forEach(function (row) {
                let dataRow = new Array();
                dataRow.push({ text: rowCount, style: 'tableData' });
                //dataRow.push(row[0]); //Step
                dataRow.push(row[6]); //User
                dataRow.push(row[0]); //Description of Action		 
                dataRow.push(row[3]); //Expected Results
                dataRow.push(""); //Actual Results
                dataRow.push(""); //Pass/Fail
                body.push(dataRow);
                rowCount++;
            });

            dynamicContent.push(
            {
                margin: [40, 20, 40, 40],
                pageBreak: 'before',
                table: {
                    body: body,
                    widths: [30, 60, 220, 150, 150 , 75],
                    headerRows: 1,
                }
            });

            //Screenshot page
            let screenShotBody = new Array();
           screenShotBody.push([{ text: 'Comments', style: 'tableHeader', fillColor: "#F79646", alignment: 'center', colSpan:2},{}]);
            screenShotBody.push([{text: 'Screenshots Attached:  NO', style: 'tableData'}, 
            { text: 'If yes, Number of Screenshots Attached: ', style: 'tableData', alignment: 'center'}]);

            dynamicContent.push(
                {
                    margin: [40, 40, 40, 20],
                    pageBreak: 'before',
                    table: {
                        body: screenShotBody,
                        widths: [350, 350]
                    }
                });
        }

    }else if( reportConfig.type == "Type5" || reportConfig.type == "Type8" ){
        for (let i = 1; i < suiteArg.length; i++) {
            let body = new Array();
    
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', fillColor: "#FF9E16", alignment: 'center' },
                { text: 'Procedure', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Expected Results ', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Actual Results', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center',  fillColor: "#FF9E16" },
            );
            body.push(tableTitle1);

            let rowCount = 1
            suiteArg[i].testData.forEach(function (row) {
                let dataRow = new Array();
                dataRow.push({ text: rowCount, style: 'tableHeader', fillColor: "#FF9E16" });
                dataRow.push(row[0]); //Description of Action		 
                dataRow.push(row[3]); //Expected Results
                dataRow.push(""); //Actual Results
                dataRow.push(""); //Pass/Fail
                body.push(dataRow);
                rowCount++;
            });

            dynamicContent.push(
            {
                margin: [40, 20, 40, 0],
                pageBreak: 'before',
                table: {
                    body: body,
                    widths: [30, 220, 180, 180 , 75],
                    headerRows: 1,
                    dontBreakRows: true
                }
            });

        }

    }if(reportConfig.type == "Type4"){
        
        for (let i = 1; i < suiteArg.length; i++) {
            let screenshots = Array()
            let body = new Array();
            let tableTitle1 = new Array({ text: 'Step', bold: true, "fillColor": "#95B3D7", alignment: 'center' },
                { text: 'Instructions', bold: true, alignment: 'center', "fillColor": "#95B3D7" },
                { text: 'Expected Results ', bold: true, alignment: 'center', "fillColor": "#95B3D7" },
                { text: 'Actual Results', bold: true, alignment: 'center', "fillColor": "#95B3D7" },
                { text: 'Pass/Fail', bold: true, alignment: 'center', "fillColor": "#95B3D7" },
                
            );
            body.push(tableTitle1);

            let rowCount = 1
            suiteArg[i].testData.forEach(function (row) {

                let dataRow = new Array();
                dataRow.push({ text: parseInt(tc[0].test_step_start_no)+rowCount, style: 'tableData' });
                dataRow.push(row[0]); //Instructions		 
                dataRow.push(row[3]); //Expected Results
                dataRow.push(""); //Actual Results
                dataRow.push(""); //Pass/Fail
                body.push(dataRow);
                rowCount++;

            });

            dynamicContent.push(
            {
               // margin: [40, 10, 40, 40],
               "margin":[5,10,5,20],
                pageBreak: 'before',
                table: {
                    body: body,
                    widths:['10%','40%','20%','20%','10%'],
                    headerRows: 1,
                    //dontBreakRows: true
                }
            });

            //Screenshot page
            let screenShotBody = new Array();

            screenShotBody.push([{ text: 'Comments', bold: true, fillColor: "#95B3D7", alignment: 'center', colSpan:2},{}]);
            
            screenShotBody.push([{text: 'Screenshots Attached: '}, 
            { text: 'If yes, Number of Screenshots Attached: ', alignment: 'center'}]);

            dynamicContent.push(
                {
                    // margin: [left, top, right, bottom]
                    "margin":[5,20,5,20],
                    pageBreak: 'before',
                    table: {
                        body: screenShotBody,
                        widths: ['50%', '50%']
                    }
                });
        }

    } else if( reportConfig.type == "Type6"){
        for (let i = 1; i < suiteArg.length; i++) {
            let body = new Array();
    
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', fillColor: "#FF9E16", alignment: 'center' },
                { text: 'Procedure', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Expected Results ', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Actual Results', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center', fillColor: "#FF9E16" },
            );
            body.push(tableTitle1);

            let rowCount = 1
            suiteArg[i].testData.forEach(function (row) {
               // console.log("------------->"+JSON.stringify(row, null, 4));

                let dataRow = new Array();
                dataRow.push({ text: rowCount +"\n"+row[8] , style: 'tableHeader', fillColor: "#FF9E16" });
                dataRow.push(row[0]); //Description of Action		 
                dataRow.push(row[3]); //Expected Results
                dataRow.push("" ); //Actual Results
                //console.log("=============>"+JSON.stringify(row[2], null, 4));
                dataRow.push(""); //Pass/Fail
                body.push(dataRow);
                //console.log("=============>"+row[7].length);
                rowCount++;
            });

            dynamicContent.push(
            {
                margin: [40, 20, 40, 40],
                pageBreak: 'before',
                table: {
                    body: body,
                    widths: [60, 200, 170, 170 , 90],
                    headerRows: 1,
                    dontBreakRows: true
                }
            });

            //Screenshot page
            let screenShotBody = new Array();
            screenShotBody.push([{ text: 'Screenshots', style: 'tableHeader', fillColor: "#FF9E16", alignment: 'center', colSpan:2},{}]);
            screenShotBody.push([{text: 'Screenshots Attached:', style: 'tableData'}, 
            { text: 'If yes, Number of Screenshots Attached: ', style: 'tableData', alignment: 'center'}]);
            dynamicContent.push(
                {
                    margin: [30, 0, 40, -20],
                    pageBreak: 'before',
                    table: {
                        body: screenShotBody,
                        widths: [350, 350]
                    }
                });
        }
    } else if( reportConfig.type == "Type7"){
        for (let i = 1; i < suiteArg.length; i++) {
            let body = new Array();
    
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', fillColor: "#C23D48", alignment: 'center' },
                { text: 'Description', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#C23D48" },
                { text: 'Expected Results ', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#C23D48" },
                { text: 'Actual Results', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#C23D48" },
                { text: 'Status', style: 'tableHeader', alignment: 'center', fillColor: "#C23D48" },
            );
            body.push(tableTitle1);

            let rowCount = 1
            suiteArg[i].testData.forEach(function (row) {
               // console.log("------------->"+JSON.stringify(row, null, 4));

                let dataRow = new Array();
                dataRow.push({ text: rowCount +"\n"+row[8] , style: 'tableHeader', fillColor: "#C23D48" });
                dataRow.push(row[0]); //Description		 
                dataRow.push(row[3]); //Expected Results
                dataRow.push(""); //Actual Results
                dataRow.push(""); //Pass/Fail
                body.push(dataRow);
                rowCount++;
            });

            dynamicContent.push(
            {
                margin: [40, 20, 40, 20],
                pageBreak: 'before',
                table: {
                    body: body,
                    widths: [65, 205, 165, 165 , 80],
                    headerRows: 1,
                    dontBreakRows: true
                }
            });
            //Screenshot page
            let screenShotBody = new Array();
            screenShotBody.push([{ text: 'Screenshots', style: 'tableHeader', fillColor: "#C23D48", alignment: 'center', colSpan:2},{}]);
            screenShotBody.push([{text: 'Screenshots Attached: ', style: 'tableData'}, 
            { text: 'If yes, Number of Screenshots Attached: ', style: 'tableData', alignment: 'center'}]);
            dynamicContent.push(
                {
                    margin: [30, 0, 40, -40],
                    pageBreak: 'before',
                    table: {
                        body: screenShotBody,
                        widths: [340, 350]
                    }
                });
        }
    }

    //Last page
    let refBody = new Array();

    if(reportConfig.type == "Type4"){
        refBody.push({
                "table":{
                "widths": ['50%','10%','30%','10%'],
                "body":[
                    [{ "text": 'Test Case Series Number', "fillColor": "#95B3D7", "alignment": 'left', "bold":true, "fontSize": 10},
                    { "text": "$tc_Sno", "alignment": 'left', "bold":true, "fontSize": 10},
                    { "text": 'Retest Number (or N/A for Orginal)', "fillColor": "#95B3D7", "alignment": 'left', "bold":true, "fontSize": 10},
                    { "text": '', "alignment": 'left', "bold":true, "fontSize": 10}
                    ],
                    [{ "text": 'Date and Time Testing Stopped (e.g., 28-DEC-2023 15:19:18 GMT-08:00)', "fillColor": "#95B3D7", "alignment": 'left', "bold":true, "fontSize": 10},
                    { "text":  "$endTime", "alignment": 'left', "bold":true, "colSpan":3, "fontSize": 10},
                    {},
                    {}
                    ]                                     
                ]
                },
                "margin":[5,10,15,20],
                pageBreak: 'before'
            },
            {
                "table":{
                "widths": ['50%','50%'],
                "body":[
                    [{ "text": 'ELECTRONIC SIGNATURES', "fillColor": "#95B3D7", "alignment": 'center', "bold":true, "fontSize": 10, "colSpan":2},
                    {}
                    ],
                    [
                        [
                            { "text": 'Tester Signature',  "alignment": 'left', "fontSize": 10, "bold":true},
                            { "text": "\n(I confirm that I completed the above testing, and the entries are complete and correct)", "fillColor": "#95B3D7", "alignment": 'left', "fontSize": 10},
                        ],
                        [
                            { "text": 'QA Reviewer Signature',  "alignment": 'left', "fontSize": 10, "bold":true},
                            { "text": "\n(I confirm that I reviewed the above testing for completeness and correctness)", "fillColor": "#95B3D7", "alignment": 'left', "fontSize": 10},
                        ]
                    ]                                     
                ]
            },
            "margin":[5,10,15,20]
            }
        );
        findAndReplaceString(refBody,"$tc_Sno", tc[0].test_case_series);
        findAndReplaceString(refBody,"$endTime", '');
        dynamicContent.push(refBody);

    }else if(reportConfig.type == "Type5" || reportConfig.type == "Type8"){
         refBody.push([{ text: 'Script Pre-Approval', alignment: 'center', style: 'tableHeader', fillColor: "#FF9E16", colSpan:2  }, {}]);

        refBody.push([{ text: 'Validation Specialist', style: 'tableHeader', fillColor: "#FF9E16" },
            [{text: (typeof firstPage.testData.ValidationSpecialist != 'undefined' ? firstPage.testData.ValidationSpecialist : 'Molly Baechler') + '\n\n', style: 'tableData'  }, {text: 'Approval by Electronic Signature'+'\n\n', italics: true, style: 'tableData'  } ]]);

        refBody.push([{ text: 'Business/Technical Approver', style: 'tableHeader', fillColor: "#FF9E16" },
            [{text: (typeof firstPage.testData.Approver != 'undefined' ? firstPage.testData.Approver : '') + '\n\n', style: 'tableData'  }, {text: 'Approval by Electronic Signature'+'\n\n', italics: true, style: 'tableData'  } ]]);
        refBody.push([{ text: 'Quality Approver', style: 'tableHeader', fillColor: "#FF9E16" },
            [{text: (typeof firstPage.testData.QualityApprover != 'undefined' ? firstPage.testData.QualityApprover : '') + '\n\n', style: 'tableData'  }, {text: 'Approval by Electronic Signature'+'\n\n', italics: true, style: 'tableData'  } ]]);
    
        dynamicContent.push(
            {
                margin: [40, 50, 40, 40],
                pageBreak: 'before',
                table: {
                    headerRows: 1,
                    widths: [100, 600],
                    dontBreakRows: true,
                    body: refBody
                }
            });

    } else if(reportConfig.type == "Type6" || reportConfig.type == "Type7"){
        // No config page for Type 6
    }else{
        refBody.push([{ text: 'Script Execution Approval - to be completed by Validation Lead', style: 'tableHeader', fillColor: "#F79646", colSpan:2  }, {}]);
        refBody.push([{ text: 'Deviations', style: 'tableHeader', fillColor: "#F79646", rowSpan:2 },
                     {text:'Were there any deviations that were observed during the execution? ', style: 'tableData'  }]);
        refBody.push([{ },
                     {text:'If yes, have they been successfully resolved? ', style: 'tableData'  }]);
        refBody.push([{ text: 'Acceptance Criteria', style: 'tableHeader', fillColor: "#F79646" },
                     {text:'Have all test steps been successfully executed? ', style: 'tableData'  }]);
        refBody.push([{ text: 'Validation Lead', style: 'tableHeader', fillColor: "#F79646", rowSpan:2 },
                     {text:'Electronically signed through Veeva', style: 'tableData'  }]);
        refBody.push([{ text: 'Quality Assurance Approver', style: 'tableHeader', fillColor: "#F79646", rowSpan:2 },
                     {text:'Electronically signed through Veeva', style: 'tableData'  }]);
    
        dynamicContent.push(
            {
                margin: [40, 50, 40, 40],
                pageBreak: 'before',
                table: {
                    headerRows: 1,
                    widths: [100, 600],
                    dontBreakRows: true,
                    body: refBody
                }
            });
    
    }

        let docDefinition = {
            info: {
                title: 'V-Assure Test Execution Results',
                author: 'Spotline Inc.',
                subject: 'V-Assure Test Execution Results'
            },
            //pageMargins : [30, 70, 30, 50],
            pageMargins : reportConfig.pageMargins,
            pageOrientation: (typeof tc[0].test_case_name != 'undefined' ? reportConfig.firstPage.pageOrientation : 'portrait'),    
            header:  (currentPage, pageCount, pageSize) => {
                if(currentPage == 1 ){
                    if(reportConfig.type == "Type1") {
                        findAndReplaceString(reportConfig.firstPage.header,"$logo",reportConfig.logo);
                        findAndReplaceEvalNum(reportConfig.firstPage.header,"$psw",pageSize.width);
                        return reportConfig.firstPage.header;
                    }else if(reportConfig.type == "Type3" || reportConfig.type == "Type5" || reportConfig.type == "Type6" || reportConfig.type == "Type7" || reportConfig.type == "Type8") {
                        findAndReplaceString(reportConfig.firstPage.header,"$logo",reportConfig.logo);
                        return reportConfig.firstPage.header;
                    }else if(reportConfig.type == "Type4") {
                        let pageHead  = JSON.parse(JSON.stringify(reportConfig.firstPage.header));
    
                        findAndReplaceString(pageHead,"$logo",reportConfig.logo);
                        findAndReplaceString(pageHead, "$currentPage", currentPage.toString());
                        findAndReplaceString(pageHead, "$pageCount", pageCount);
                        findAndReplaceString(pageHead,"$release_no",tc[0].release_no);
                        findAndReplaceString(pageHead,"$change_no",(typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.changeControlNo : ''));
                        return pageHead
                    }
                } 
                else {
                    if(reportConfig.type == "Type1") {
                        findAndReplaceString(reportConfig.otherPage.header,"$batchID",batchID);
                        let otherPageHeader  = JSON.parse(JSON.stringify(reportConfig.otherPage.header));
                        findAndReplaceEvalNum(otherPageHeader,"$psw",pageSize.width);
                        return otherPageHeader;
                    }else if(reportConfig.type == "Type3" ) {
                        findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                        findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", tc[0].tag_id.replace(/_/g, ' ') + " - " + tc[0].test_case_name);
                        findAndReplaceString(reportConfig.otherPage.header,"$DocumentID", suiteArg[1].preTestStep.documentID);
                        findAndReplaceString(reportConfig.otherPage.header,"$Version", tc[0].release_no);                    
                        return reportConfig.otherPage.header;
                    }else if( reportConfig.type == "Type5" || reportConfig.type == "Type8") {
                        findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                        findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", tc[0].test_case_id );
                        return reportConfig.otherPage.header;
                    }else if(reportConfig.type == "Type0") {
                        findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                        findAndReplaceString(reportConfig.otherPage.header,"$ProjectName",  "Operational Qualification - " + firstPage.firstPageContent1 + " - " + firstPage.vaultName );
                        return reportConfig.otherPage.header;
                    }else if(reportConfig.type == "Type4") {
                        let pageHead  = JSON.parse(JSON.stringify(reportConfig.firstPage.header));
    
                        findAndReplaceString(pageHead,"$logo",reportConfig.logo);
                        findAndReplaceString(pageHead, "$currentPage", currentPage.toString());
                        findAndReplaceString(pageHead, "$pageCount", pageCount);
                        findAndReplaceString(pageHead,"$release_no",tc[0].release_no);
                        findAndReplaceString(pageHead,"$change_no",(typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.changeControlNo : ''));
                        return pageHead
                    } else if( reportConfig.type == "Type6" ) {
                        findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                        findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", `${tc[0].test_case_id}-Auto` );
                        return reportConfig.otherPage.header;
                    } else if(reportConfig.type == "Type7") {
                        findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                        findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", tc[0].test_case_id );
                        return reportConfig.otherPage.header;
                    }
                }
            },
            footer:  (currentPage, pageCount, pageSize) => {
                if(currentPage == 1 ){
                     if(reportConfig.type == "Type3" || reportConfig.type == "Type0" ) {
                        let pageFooter  = JSON.parse(JSON.stringify(reportConfig.firstPage.footer));
                        findAndReplaceString(pageFooter,"$currentPage",currentPage);
                        findAndReplaceString(pageFooter,"$pageCount",pageCount);
                        return pageFooter;
                     }else if(reportConfig.type == "Type4") {
                        return reportConfig.firstPage.footer;
                    }else if(reportConfig.type == "Type5" || reportConfig.type == "Type6" || reportConfig.type == "Type7" || reportConfig.type == "Type8") {
                        let pageFooter  = JSON.parse(JSON.stringify(reportConfig.firstPage.footer));
                        findAndReplaceEvalNum(pageFooter,"$psw",pageSize.width);
                        findAndReplaceString(pageFooter,"$currentPage",currentPage);
                        findAndReplaceString(pageFooter,"$pageCount",pageCount);
                        return pageFooter;                
                    }
                } else {
                    if(reportConfig.type == "Type3" || reportConfig.type == "Type0" ) {
                        let pageFooter  = JSON.parse(JSON.stringify(reportConfig.otherPage.footer));
                        findAndReplaceString(pageFooter,"$currentPage",currentPage);
                        findAndReplaceString(pageFooter,"$pageCount",pageCount);
                        return pageFooter;
                    }else if(reportConfig.type == "Type4") {
                        return reportConfig.otherPage.footer;
                    }else if(reportConfig.type == "Type5" || reportConfig.type == "Type6" || reportConfig.type == "Type7" || reportConfig.type == "Type8") {
                        let pageFooter  = JSON.parse(JSON.stringify(reportConfig.otherPage.footer));
                        findAndReplaceEvalNum(pageFooter,"$psw",pageSize.width);
                        findAndReplaceString(pageFooter,"$currentPage",currentPage);
                        findAndReplaceString(pageFooter,"$pageCount",pageCount);
                        return pageFooter;                
                    }
                }
                //for Type1 all page same footer
                if(reportConfig.type == "Type1") {
                    let pageFooter  = JSON.parse(JSON.stringify(reportConfig.otherPage.footer));
                    findAndReplaceEvalNum(pageFooter,"$psw",pageSize.width);
                    findAndReplaceString(pageFooter,"$currentPage",currentPage);
                    findAndReplaceString(pageFooter,"$pageCount",pageCount);
                     //console.log(pageFooter[0].canvas[0].x2);
                     return pageFooter;
                }
            },
            styles: {
                tableHeader: {
                    fontSize: 10,
                    bold: true,
                    color: '#FFFFFF',
                    fillColor: '#191970',
                },
                tableData: {
                    fontSize: 10
                }
            },
            defaultStyle: {
                font: 'Helvetica'
            },
            content: dynamicContent
        }
    return docDefinition;
}

async function generatePDF(data, firstPage, org, batchID, dryrun) {
    let reportConfig = await getReportConfig(org, dryrun, firstPage);
    if (!reportConfig) {
        throw new Error("Unable to load report configuration. Please ensure default_report_configs.json exists or database is reachable.");
    }
    if (firstPage && firstPage.reportType) {
        reportConfig.type = firstPage.reportType;
    }
    if (firstPage && firstPage.customLogo) {
        reportConfig.logo = firstPage.customLogo;
    }
    const globalContext ={
        testSuiteElement: [],
        xmlRepotFormatData : [],
        actual : "",
        expected : "",
        testStep : "",
        username : "",
        testReqNum:"",
        preReqScreenshotTime : [],
        preReqImgs : [],
        veevaVaultVersion : "",
        testCaseSteps : [],
        preTCStepScreenshot : [],
        preTCStepScreenshotTime : [],
        imgs:[],
        requirementIDs: [],
        capturetag: []
    }
    if (dryrun == false){
        let suiteTmp = await buildReportTableBodyData(data, reportConfig.xmlType, globalContext);
        //console.log("Data :"+JSON.stringify(suiteTmp, null, 4))
        let docDefinition = await myTableBody(suiteTmp,firstPage, org, batchID, globalContext);
        //console.log("Data :"+JSON.stringify(docDefinition, null, 4))
        return docDefinition;
    }else {
        let suiteTmp = await buildReportTableBodyData(data, reportConfig.xmlType, globalContext);
        let docDefinition = await myTableBody_Template(suiteTmp,firstPage, org, batchID, globalContext);
        return docDefinition;
    }
}

async function getTestDescription(testID, test_suite_id, firstPage = null, suiteArg = null){
    if (firstPage && firstPage.customTc) {
        return Array.isArray(firstPage.customTc) ? firstPage.customTc : [firstPage.customTc];
    }
    if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
            let tc = await test_caseRepo.getAllByField({
                                tag_id: testID.trim(),
                                test_suite_code: test_suite_id,
                                isDeleted:false
                            });
            if (tc && tc.length > 0) return tc;
        } catch(error) {
            console.log("getTestDescription Error: "+ error.message);
        }
    }
    // Safe fallback so report never crashes on new/unregistered tests
    return [{
        test_case_id: firstPage?.customTestCaseId || testID || 'NA',
        test_case_name: firstPage?.customTestCaseName || suiteArg?.[1]?.test || 'NA',
        tag_id: testID || 'NA',
        release_no: firstPage?.customScriptVersion || suiteArg?.[0]?.scriptRelease || '1.0',
        release_date: firstPage?.customReleaseDate || new Date(),
        description: firstPage?.customDescription || (suiteArg?.[1]?.test || 'NA'),
        requirement_no: firstPage?.customRequirementNo || (suiteArg?.[1]?.reqIDs && suiteArg[1].reqIDs.length > 0 ? suiteArg[1].reqIDs.join(', ') : 'NA'),
        vassureReferenceNo: firstPage?.customVassureRefNo || 'NA',
        test_case_series: firstPage?.customSeries || '1'
    }];
}

async function userDetails(userID, firstPage = null){
    if (firstPage && firstPage.customUserDetail) {
        return Array.isArray(firstPage.customUserDetail) ? firstPage.customUserDetail : [firstPage.customUserDetail];
    }
    if (mongoose.connection && mongoose.connection.readyState === 1 && userID) {
        try {
            let userDetail = await userRepo.getById(userID);
            if (userDetail && (!Array.isArray(userDetail) || userDetail.length > 0)) {
                return Array.isArray(userDetail) ? userDetail : [userDetail];
            }
        } catch(error) {
            console.log("getUserData Error: "+ error.message);
        }
    }
    return [{
        first_name: firstPage?.testerName || "Automation",
        last_name: ""
    }];
}

async function getReportConfig(org, dryrun, firstPage = null){
    if (firstPage && firstPage.customReportConfig) {
        return JSON.parse(JSON.stringify(firstPage.customReportConfig));
    }
    if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
            let rc = await RptCnfRepo.getByField({ org_code: org, template: dryrun });
            if(!_.isEmpty(rc)) {
                return JSON.parse(JSON.stringify(rc.toObject ? rc.toObject() : rc));
            } else {  //get default
                rc = await RptCnfRepo.getByField({ org_code: null, template: dryrun});
                if (!_.isEmpty(rc)) return JSON.parse(JSON.stringify(rc.toObject ? rc.toObject() : rc));
            }
        } catch(error) {
           console.log("getReportConfig DB Error: " + error.message);
        }
    }
    // Safe offline fallback
    try {
        const fs = require('fs');
        const path = require('path');
        let configPath = path.resolve(__dirname, '../../../default_report_configs.json');
        if (!fs.existsSync(configPath)) {
            configPath = path.resolve(__dirname, '../../../../default_report_configs.json');
        }
        if (!fs.existsSync(configPath)) {
            configPath = path.resolve(process.cwd(), 'default_report_configs.json');
        }
        if (!fs.existsSync(configPath)) {
            configPath = path.resolve(process.cwd(), 'sqa_automation-node/default_report_configs.json');
        }
        const defaultConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const type = firstPage?.reportType || 'Type5';
        const typeKey = `${type}_template_${dryrun ? true : false}`;
        const selected = defaultConfigs[typeKey] || defaultConfigs['Type5_template_false'] || defaultConfigs['Type0_template_false'];
        return JSON.parse(JSON.stringify(selected));
    } catch(e) {
        console.error("Config fallback error:", e);
        return null;
    }
}

function findAndReplaceString(object, value, replacevalue) {
    for (var x in object) {
      if (object.hasOwnProperty(x)) {
        if (typeof object[x] == 'object') {
            findAndReplaceString(object[x], value, replacevalue);
        }
        if (typeof object[x] == 'string') {
          if (object[x].indexOf(value) !== -1 ) { 
               object[x] = object[x].replace(value, replacevalue) ;
                break;
             }
        }
      }
    }
   // console.log("Data  :"+JSON.stringify(object, null, 4))
}

function findAndReplaceStringSpecialChar(object) {
    for (var x in object) {
      if (object.hasOwnProperty(x)) {
        if (typeof object[x] == 'object') {
            findAndReplaceStringSpecialChar(object[x]);
        }
        if (typeof object[x] == 'string') {
          if (object[x].indexOf("##") !== -1 ) { 
               object[x] = object[x].replace(/##/g, "") ;
                break;
             }
        }
      }
    }
   // console.log("Data  :"+JSON.stringify(object, null, 4))
}

function findAndRemoveStringSpecialVar(object) {
    for (var x in object) {
      if (object.hasOwnProperty(x)) {
        if (typeof object[x] == 'object') {
            findAndRemoveStringSpecialVar(object[x]);
        }
        if (typeof object[x] == 'string') {
          if (object[x].indexOf("##") !== -1 ) { // /<\/?[^>]+>/g
               object[x] = object[x].replace(/##(.*?)##/g, " ") ;
                break;
             }
        }
      }
    }
   // console.log("Data  :"+JSON.stringify(object, null, 4))
}

function findAndReplaceEvalNum(object, value, replacevalue) {
    for (let x in object) {
      if (object.hasOwnProperty(x)) {
        if (typeof object[x] == 'object') {
            findAndReplaceEvalNum(object[x], value, replacevalue);
        }
        if (typeof object[x] == 'string') {
          if (object[x].indexOf(value) !== -1 ) { 
               object[x] = parseInt(eval(object[x].replace(value, replacevalue))) ;
                break;
             }
        }
      }
    }
   // console.log("Data  :"+JSON.stringify(object, null, 4))
}

function CheckCaptureForReport(keyWord, gCtx){
    if (typeof keyWord !== 'undefined' && keyWord && keyWord.name == 'kw' ) {
        if(typeof keyWord.valueWithPath("tag") != 'undefined' && keyWord.valueWithPath("tag") == "capture_for_report"){
            gCtx.capturetag.push(keyWord);
        }
    }
}

function captureScreenshotPreRequisite(keyWord, gCtx, stepNum = null, scrNum = null) {
    let cap1 = keyWord.childWithAttribute("name", "Wait Until Keyword Succeeds");
    if (typeof cap1 !== 'undefined' && cap1) {
        let cap = cap1.childWithAttribute("name", "Capture Page Screenshot");
        if (typeof cap !== 'undefined' && cap) {
            let startIndex = cap.childNamed("msg").val.indexOf("src=");
            let endIndex = cap.childNamed("msg").val.indexOf('"', startIndex + 10);
            let screenshot = cap.childNamed("msg").val.substring(startIndex + 5, endIndex);
            if (stepNum != undefined && scrNum != undefined){
                gCtx.preReqImgs.push({stepNum: stepNum, scrNum: scrNum, img:{ image: screenshot, fit: [680, 310], style: 'tableData'}});
            } else {
                gCtx.preReqImgs.push({ image: screenshot, fit: [680, 310], style: 'tableData'});
            }
            gCtx.preTCStepScreenshot.push(screenshot);
            if (typeof cap.childNamed("msg").attr.timestamp != 'undefined'){
                gCtx.preReqScreenshotTime.push(moment.utc(cap.childNamed("msg").attr.timestamp,"YYYYMMDD HH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss [GMT]Z").toUpperCase());
                gCtx.preTCStepScreenshotTime.push(moment.utc(cap.childNamed("msg").attr.timestamp,"YYYYMMDD HH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss [GMT]Z").toUpperCase());

            } else {
                gCtx.preReqScreenshotTime.push(moment.utc(cap.childNamed("msg").attr.time,"YYYY-MM-DDTHH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss [GMT]Z").toUpperCase());
                gCtx.preTCStepScreenshotTime.push(moment.utc(cap.childNamed("msg").attr.time,"YYYY-MM-DDTHH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss [GMT]Z").toUpperCase());
            }
        }
    }
}

function captureScreenshot(keyWord, gCtx){
    let cap1 = keyWord.childWithAttribute("name", "Wait Until Keyword Succeeds");
    if (typeof cap1 !== 'undefined' && cap1) {
        let cap = cap1.childWithAttribute("name", "Capture Page Screenshot");
        if (typeof cap !== 'undefined' && cap) {
            let startIndex = cap.childNamed("msg").val.indexOf("src=");
            let endIndex = cap.childNamed("msg").val.indexOf('"', startIndex + 10);
            let screenshot = cap.childNamed("msg").val.substring(startIndex + 5, endIndex);
            gCtx.imgs.push({ image: screenshot, fit: [680, 310], style: 'tableData'});
            if (typeof cap.childNamed("msg").attr.timestamp != 'undefined')
                gCtx.screenshotTime.push(moment.utc(cap.childNamed("msg").attr.timestamp,"YYYYMMDD HH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss [GMT]Z").toUpperCase());
            else
                gCtx.screenshotTime.push(moment.utc(cap.childNamed("msg").attr.time,"YYYY-MM-DDTHH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss [GMT]Z").toUpperCase());
        }
    }
    //console.log("imgs--------------------------------->"+imgs.length)
}

function extractScreenshot(branch, gCtx, stepNum = null, scrNum = null, pre_requisite = false) {
    const node = branch.children.find(child => child.name === "kw");
    if (!node) return;
    const { name } = node.attr;
    if (!["Take Desktop Screenshot", "Capture Vnc Screenshot"].includes(name)) return;
    const msgNode = node.children.find(child => child.name === "msg" && child.val?.includes("src="));
    if (!msgNode) return;
    const startIndex = msgNode.val.indexOf("src=");
    const endIndex = msgNode.val.indexOf('"', startIndex + 10);
    const screenshot = msgNode.val.substring(startIndex + 5, endIndex);
    const timestamp = msgNode.attr.timestamp ? moment.utc(msgNode.attr.timestamp, "YYYYMMDD HH:mm:ss.SSS") : msgNode.attr.time ? moment.utc(msgNode.attr.time, "YYYY-MM-DDTHH:mm:ss.SSS") : moment.utc();
    const formattedTime = timestamp.tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss [GMT]Z").toUpperCase();
    if (pre_requisite) {
        gCtx.preReqImgs.push({stepNum, scrNum, img: { image: screenshot, fit: [600, 600], style: 'tableData' }});
        gCtx.preTCStepScreenshot.push(screenshot);
        gCtx.preReqScreenshotTime.push(formattedTime);
    } else {
        gCtx.imgs.push({ image: screenshot, fit: [600,600], style: 'tableData', colSpan: 3 });
        gCtx.screenshotTime.push(formattedTime);
    }
}

function captureExpectedActual(keyWord,name, takeScreenshot, gCtx){
    keyWord.eachChild(function (ele){
        if (typeof ele !== 'undefined' && ele && ele.name == 'kw') {
            if (typeof ele.attr.name !== 'undefined' && ele.attr.name == "Take screenshot of the page") {
                let ifNode = ele.children.find(child => child.name === "if");
                if (ifNode) {
                        let branches = ifNode.children.filter(child => child.name === "branch");
                        for (let branch of branches) {
                            if (branch.attr.type === "IF") {
                                captureScreenshot(branch, gCtx);
                            }
                            else {
                                extractScreenshot(branch, gCtx);
                            }
                        }
                }else{
                    captureScreenshot(ele, gCtx);
                    }
            } else if (typeof ele.attr.name !== 'undefined' && ele.attr.name == "Get scrolling screenshot of the page" && takeScreenshot) {
                const whileNode = ele.childNamed("while");
                if (whileNode) {
                    whileNode.children.forEach(iterNode => {
                        const screenshotNodes = findAllTakeScreenshotNodes(iterNode);
                        screenshotNodes.forEach(screenshotNode => {
                            let ifNode = screenshotNode.children.find(child => child.name === "if");
                            if (ifNode) {
                                let branches = ifNode.children.filter(child => child.name === "branch");
                                for (let branch of branches) {
                                    if (branch.attr.type === "IF") {
                                        captureScreenshot(branch, gCtx);
                                    } else {
                                        extractScreenshot(branch, gCtx);
                                    }
                                }
                            }
                        });
                    })
                }
            }
        } else if (typeof ele !== 'undefined' && ele && ele.name == 'if') {
            let allbranches = getAllbranches(ele);
            // console.log("allbranches------------------->"+JSON.stringify(allbranches, null, 4));
            allbranches.forEach(function (branch) {
            // capture expected & Actual values
                if (typeof branch.childWithAttribute("name", "Set Test Message") != 'undefined' && typeof branch.childWithAttribute("name", "Set Test Message").childNamed("msg") != 'undefined') {
                    let msg = branch.childWithAttribute("name", "Set Test Message").childNamed("msg").val.split("|");
                    msg.forEach(function (element) {
                        if (element.trim().startsWith("Set test message to:")) {
                            let keyValue = element.substring(element.indexOf(':') + 1).trim();
                            let keyValue2 = null
                            if (keyValue.startsWith("User:")) {
                                keyValue2 = keyValue.split("@");
                            }
                            if (!keyValue2) {
                                gCtx.username = "";
                                t_step = keyValue.substring(0, keyValue.lastIndexOf(':')).trim();
                                if (t_step.startsWith("json:")) {
                                    gCtx.testStep = t_step.replace("json:", "").trim();
                                    gCtx.testStep = JSON.parse(gCtx.testStep);
                                    findAndReplaceStringSpecialChar(gCtx.testStep);
                                } else {
                                    gCtx.testStep = t_step;
                                }
                            } else {
                                gCtx.username = keyValue2[0].substring(keyValue2[0].indexOf(':') + 1).trim();
                                gCtx.testStep = keyValue2[1].substring(0, keyValue2[1].lastIndexOf(':')).trim();
                            }
                        } else if (element.trim().startsWith("Expected")) {
                            t_exp = element.substring(element.indexOf(':') + 1).trim();
                            if (t_exp.startsWith("json:")) {
                                gCtx.expected = t_exp.replace("json:", "").trim();
                                gCtx.expected = JSON.parse(gCtx.expected);
                                findAndReplaceStringSpecialChar(gCtx.expected);
                            } else {
                                gCtx.expected = t_exp;
                            }
                        } else if (element.trim().startsWith("Actual")) {
                            t_actl = element.substring(element.indexOf(':') + 1).trim();
                            if (t_actl.startsWith("json:")) {
                                gCtx.actual = t_actl.replace("json:", "").trim();
                                gCtx.actual = JSON.parse(gCtx.actual);
                                findAndReplaceStringSpecialChar(gCtx.actual);
                            } else {
                                gCtx.actual = t_actl;
                            }
                        } else if (element.trim().startsWith("Test Requirement Number")) {
                            gCtx.testReqNum = element.substring(element.indexOf(':') + 1);
                        }
                    });
                    //console.log("============>"+takeScreenshot+" --> "+testStep+" --> " +username+"  --> "+expected+"  --> "+actual+"  --> "+testReqNum);
                }
            });
        } 
    });
}

function loopkwSnapShotInside(keyWord, name, gCtx, branchType){
    try
    {   
        let skipChildIteration = false;
        if (typeof keyWord !== 'undefined' && keyWord && keyWord.name == 'if') {
            keyWord.childrenNamed("branch").forEach(function (branch){
                branch.eachChild(function (inbranch){
                    loopkwSnapShotInside(inbranch, name, gCtx, branch.attr.type);
                });
            });
            return;
        }
        if (typeof keyWord !== 'undefined' && keyWord && keyWord.name == 'try') {
            keyWord.childrenNamed("branch").forEach(function (branch){
                branch.eachChild(function (inbranch){
                    loopkwSnapShotInside(inbranch, name, gCtx, branch.attr.type);
                });
            });
            return;
        }
        if (branchType ==="TRY" && keyWord && typeof keyWord.eachChild === "function") {
                keyWord.eachChild(function(child) {
                    loopkwSnapShotInside(child, name, gCtx, branchType);
                });
                skipChildIteration = true;
        }

        if (typeof keyWord !== 'undefined' && keyWord && keyWord.name == 'kw') {
            if (typeof keyWord.attr.name !== 'undefined' && (keyWord.attr.name == "Validate actual and expected values" || keyWord.attr.name == "Validate actual and expected are different")) {
                captureExpectedActual(keyWord,name, true, gCtx);
            }else if (typeof keyWord.attr.name !== 'undefined' && (keyWord.attr.name == "Validate actual and expected values without screenshot" || keyWord.attr.name == "Validate actual and expected are different and without screenshot")) {
                captureExpectedActual(keyWord,name, false, gCtx);
            } else if (typeof keyWord.attr.name !== 'undefined' && keyWord.attr.name == "Validate actual and expected values with scrolling screenshot") {
                captureExpectedActual(keyWord,name, true, gCtx);
            } else if (typeof keyWord.attr.name !== 'undefined' && keyWord.attr.name == "Take screenshot of the page") {
                let ifNode = keyWord.children.find(child => child.name === "if");
                let branches = ifNode.children.filter(child => child.name === "branch");
                for (let branch of branches) {
                    if (branchType !== "FINALLY" && branch.attr.type === "IF") {
                        captureScreenshot(branch, gCtx);
                    }
                    else {
                        extractScreenshot(branch, gCtx);
                    }
                }
            } else if (typeof keyWord.attr.name !== 'undefined' && keyWord.attr.name == "Get scrolling screenshot of the page") {
                keyWord.childNamed("while").children.forEach(function (iterelm){
                    if (iterelm.name == 'iter'){
                            iterelm.eachChild(function (iter){
                                if (typeof iter !== 'undefined' && iter && iter.attr.name == "Take screenshot of the page") {
                                let ifNode = iter.children.find(child => child.name === "if");
                                if (ifNode) {
                                    let branches = ifNode.children.filter(child => child.name === "branch");
                                    for (let branch of branches) {
                                        if (branchType !== "FINALLY" && branch.attr.type === "IF") {
                                            captureScreenshot(branch, gCtx);
                                        }
                                        else {
                                            extractScreenshot(branch, gCtx);
                                        }
                                    }
                                }
                            }
                        });
                    }
                })
            }else if (typeof keyWord.attr.name !== 'undefined' && keyWord.attr.name == "Download to Take pdf screenshot and delete the downloaded file") {
                keyWord.eachChild(function (insideTag) {
                    if (typeof insideTag !== 'undefined' && insideTag && insideTag.name == 'if' ) {
                        insideTag.childrenNamed("branch").forEach(function (branch){
                            if (branchType !== "FINALLY"){
                                let cap = branch.childWithAttribute("name", "Take screenshot of the page");
                                captureScreenshot(cap, gCtx);
                            }
                        });
                    }
                });
            }
        }
        if (!skipChildIteration) {
        keyWord.eachChild(function (ele){
            if (typeof ele !== 'undefined' && ele && ele.name == 'kw') {

                if (typeof ele.attr.name !== 'undefined' && (ele.attr.name == "Validate actual and expected values" || ele.attr.name == "Validate actual and expected are different")) {
                    captureExpectedActual(ele,name, true, gCtx);
                }else if (typeof ele.attr.name !== 'undefined' && (ele.attr.name == "Validate actual and expected values without screenshot" || ele.attr.name == "Validate actual and expected are different and without screenshot")) {
                    captureExpectedActual(ele,name, false, gCtx);
                } else if (typeof ele.attr.name !== 'undefined' && ele.attr.name == "Validate actual and expected values with scrolling screenshot") {
                    captureExpectedActual(ele, name, true, gCtx);
                }else if (typeof ele.attr.name !== 'undefined' && ele.attr.name == "Take screenshot of the page") {
                    let ifNode = ele.children.find(child => child.name === "if");
                    let branches = ifNode.children.filter(child => child.name === "branch");
                    for (let branch of branches) {
                        if (branchType !== "FINALLY" && branch.attr.type === "IF") {
                            captureScreenshot(branch, gCtx);
                        }
                        else {
                            extractScreenshot(branch, gCtx);
                        }
                    }
                } else if (typeof ele.attr.name !== 'undefined' && ele.attr.name == "Get scrolling screenshot of the page") {
                    ele.childNamed("while").children.forEach(function (iterelm){
                        if (iterelm.name == 'iter'){
                                iterelm.eachChild(function (iter){
                                    if (typeof iter !== 'undefined' && iter && iter.attr.name == "Take screenshot of the page") {
                                    let ifNode = iter.children.find(child => child.name === "if");
                                    if (ifNode) {
                                        let branches = ifNode.children.filter(child => child.name === "branch");
                                        for (let branch of branches) {
                                            if (branchType !== "FINALLY" && branch.attr.type === "IF") {
                                                captureScreenshot(branch, gCtx);
                                            }
                                            else {
                                                extractScreenshot(branch, gCtx);
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    })
                }else if (typeof ele.attr.name !== 'undefined' && ele.attr.name == "Download to Take pdf screenshot and delete the downloaded file") {
                    ele.eachChild(function (insideTag) {
                        if (typeof insideTag !== 'undefined' && insideTag && insideTag.name == 'if') {
                            insideTag.childrenNamed("branch").forEach(function (branch){
                                if (branchType !== "FINALLY") {
                                    let cap = branch.childWithAttribute("name", "Take screenshot of the page");
                                    captureScreenshot(cap, gCtx);
                                }
                            });
                        }
                    });
                }
            }else if (typeof ele !== 'undefined' && ele && ele.name == 'if' ) {
                ele.childrenNamed("branch").forEach(function (branch){
                    branch.eachChild(function (inBranch){
                        loopkwSnapShotInside(inBranch,name, gCtx, branch.attr.type);
                    });
                });
            } else if (typeof ele !== 'undefined' && ele && ele.name == 'try') {
                ele.childrenNamed("branch").forEach(function (branch) {
                    branch.eachChild(function (inBranch) { loopkwSnapShotInside(inBranch,name,gCtx,branch.attr.type);
                    });
                });
            } else if (typeof ele !== 'undefined' && ele && ele.name == 'for' ) {
                ele.eachChild(function (iter){
                if (typeof iter !== 'undefined' && iter && iter.name == 'iter' ) {
                    iter.eachChild(function (insideIter){
                        if (typeof insideIter !== 'undefined' && insideIter && insideIter.name == 'kw') {
                            loopkwSnapShotInside(insideIter, name, gCtx);
                        }else if (typeof insideIter !== 'undefined' && insideIter && insideIter.name == 'if' ) {
                            insideIter.childrenNamed("branch").forEach(function (branch){
                                branch.eachChild(function (insideBranch){
                                    loopkwSnapShotInside(insideBranch, name, gCtx);
                                });
                            });
                        }

                    });
                }
            });
            }
        });
        }
    }catch(e){
        console.log(e);
    }
}

function loopkwSnapShot(keyWord, name, gCtx){
    try
    {   
        let includeReport = false;
        gCtx.actual = "";
        gCtx.expected = "";
        gCtx.testStep = "";
        gCtx.username = "";
        gCtx.testReqNum = "";
        gCtx.imgs = new Array();
        gCtx.screenshotTime = new Array();
        gCtx.testCaseSteps = new Array();
       
    keyWord.eachChild(function (ele){
        if (typeof ele !== 'undefined' && ele && ele.name == 'kw') {

                if (typeof ele.attr.name !== 'undefined' && (ele.attr.name == "Validate actual and expected values" || ele.attr.name == "Validate actual and expected are different")) {
                    captureExpectedActual(ele, name, true, gCtx);
                    includeReport = true;
                }else if (typeof ele.attr.name !== 'undefined' && (ele.attr.name == "Validate actual and expected values without screenshot" || ele.attr.name == "Validate actual and expected are different and without screenshot")) {
                    captureExpectedActual(ele,name, false, gCtx);
                    includeReport = true;
                } else if (typeof ele.attr.name !== 'undefined' && ele.attr.name == "Validate actual and expected values with scrolling screenshot") {
                    captureExpectedActual(ele, name, true, gCtx);
                    includeReport = true;
                }else if (typeof ele.attr.name !== 'undefined' && ele.attr.name == "Take screenshot of the page") {
                    let ifNode = ele.children.find(child => child.name === "if");
                    let branches = ifNode.children.filter(child => child.name === "branch");
                    for (let branch of branches) {
                        if (branch.attr.type === "IF") {
                            captureScreenshot(branch, gCtx);
                        }
                        else {
                            extractScreenshot(branch, gCtx);
                        }
                    }
                }else if (typeof ele.attr.name !== 'undefined' && ele.attr.name == "Get scrolling screenshot of the page") {
                    ele.childNamed("while").children.forEach(function (iterelm){
                        if (iterelm.name == 'iter'){
                            iterelm.eachChild(function (iter){
                                if (typeof iter !== 'undefined' && iter && iter.attr.name == "Take screenshot of the page") {
                                    let ifNode = iter.children.find(child => child.name === "if");
                                    if (ifNode) {
                                        let branches = ifNode.children.filter(child => child.name === "branch");
                                        for (let branch of branches) {
                                            if (branch.attr.type === "IF") {
                                                captureScreenshot(branch, gCtx);
                                            }
                                            else {
                                                extractScreenshot(branch, gCtx);
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    })           
                }else if (typeof ele.attr.name !== 'undefined' && ele.attr.name === "Find Text In Pdf Document In VAssurePDFReader") {
                            ele.children.forEach(function (iter) {
                                if (iter && iter.name === 'kw' && iter.attr.name === "Take screenshot of the page") {
                                    let ifNode = iter.children.find(child => child.name === "if");
                                        if (ifNode) {
                                            let branches = ifNode.children.filter(child => child.name === "branch");
                                            for (let branch of branches) {
                                                if (branch.attr.type === "IF") {
                                                    captureScreenshot(branch, gCtx);
                                                }
                                                else {
                                                    extractScreenshot(branch, gCtx);
                                                }
                                            }
                                        }
                                    }
                                }
                            );
            }else if (typeof ele.attr.name !== 'undefined' && ele.attr.name == "Download to Take pdf screenshot and delete the downloaded file") {
                ele.eachChild(function (insideTag) {
                    if (typeof insideTag !== 'undefined' && insideTag && insideTag.name == 'if' ) {
                        insideTag.childrenNamed("branch").forEach(function (branch){
                            let cap = branch.childWithAttribute("name", "Take screenshot of the page");   
                            captureScreenshot(cap, gCtx);
                        });
                    }
                });
                }else {
                    loopkwSnapShotInside(ele,name, gCtx);
                    includeReport = true;
                }
            }else if (typeof ele !== 'undefined' && ele && ele.name == 'if' ) {
                ele.childrenNamed("branch").forEach(function (branch){
                    branch.eachChild(function (inBranch){
                        loopkwSnapShotInside(inBranch,name, gCtx, branch.attr.type);
                    });
                });
            } else if (typeof ele !== 'undefined' && ele && ele.name == 'try') {
                ele.childrenNamed("branch").forEach(function (branch) {
                    branch.eachChild(function (inBranch) {
                        loopkwSnapShotInside(inBranch,name,gCtx,branch.attr.type);
                    });
                });
            } else if (typeof ele !== 'undefined' && ele && ele.name == 'for') {
                ele.eachChild(function (iter){
                if (typeof iter !== 'undefined' && iter && iter.name == 'iter' ) {
                    iter.eachChild(function (insideIter){
                        if (typeof insideIter !== 'undefined' && insideIter && insideIter.name == 'kw') {
                            loopkwSnapShotInside(insideIter, name, gCtx);
                        }else if (typeof insideIter !== 'undefined' && insideIter && insideIter.name == 'if' ) {
                            insideIter.childrenNamed("branch").forEach(function (branch){
                                branch.eachChild(function (insideBranch){
                                    loopkwSnapShotInside(insideBranch, name, gCtx);
                                });
                            });
                        }

                    });
        }
    });
}
        });
        postCaptureExpectedActual(keyWord,includeReport, gCtx)

    }catch(e){
        console.log(e);
    }
}

function postCaptureExpectedActual(keyWord, includeReport, gCtx){
                    let row = [];
    if (!includeReport)
        return;
    let testcaseStep={};
    //console.log(keyWord.attr.name +"--------------------> Validate actual and expected values\n")
    if(typeof gCtx.testStep !== 'undefined' && gCtx.testStep && gCtx.testStep.length == 0 ) {
        row.push({ text: (typeof keyWord.valueWithPath("doc") != 'undefined') ? keyWord.valueWithPath("doc") : keyWord.attr.name, style: 'tableData' });
    } else if (typeof gCtx.testStep === "object" && gCtx.testStep !== null) {
        row.push([{ stack: gCtx.testStep, style: 'tableData' }]);
    } else {
        row.push([{ text: gCtx.testStep, style: 'tableData' }]);
    }
    testcaseStep["procedure"]= gCtx.testStep;
    if (typeof keyWord.valueWithPath("status@endtime") != 'undefined'){
        let endTime = moment.utc(keyWord.valueWithPath("status@endtime"),"YYYYMMDD HH:mm:ss.SSS").tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss").toUpperCase();
        row.push({ text: keyWord.valueWithPath("status@status"), style: 'tableData' });
        row.push({ text: endTime, style: 'tableData' });
        testcaseStep["executed_time"]=  moment.utc(keyWord.valueWithPath("status@endtime"),"YYYYMMDD HH:mm:ss.SSS").format('YYYY-MM-DDTHH:mm:ss')+".000Z";
    }else{
        let etime = moment.utc(keyWord.valueWithPath("status@start"),"YYYY-MM-DDTHH:mm:ss.SSS").add(keyWord.valueWithPath("status@elapsed"), 'seconds');
        testcaseStep["executed_time"]=  etime.format('YYYY-MM-DDTHH:mm:ss')+".000Z";

        let endTime = etime.tz("America/Los_Angeles").format("DD-MMM-YYYY HH:mm:ss").toUpperCase();
        row.push({ text: keyWord.valueWithPath("status@status"), style: 'tableData' });
        row.push({ text: endTime, style: 'tableData' });
        // testcaseStep["executed_time"]=  eutctime.format('YYYY-MM-DDTHH:mm:ss')+".000Z";
    }
    testcaseStep["status"]=  keyWord.valueWithPath("status@status");
    if(gCtx.expected.length == 0 ) {
        row .push([{ text: "NA", style: 'tableData', alignment: 'center' }]);
    } else if (typeof gCtx.expected === "object" && gCtx.expected !== null) {
        row.push([{ stack: gCtx.expected, style: 'tableData' }]);
    } else {
            row.push([{ text: gCtx.expected, style: 'tableData' }]);
    }
    testcaseStep["expected_result"]=  gCtx.expected;
    if(gCtx.actual.length == 0 ) {
        row.push([{ text: "NA", style: 'tableData', alignment: 'center' }]);
    } else if (typeof gCtx.actual === "object" && gCtx.actual !== null) {
        row.push([{ stack: gCtx.actual, style: 'tableData' }]);
    } else {
        row.push([{ text: gCtx.actual, style: 'tableData' }]);
    }
    testcaseStep["actual_result"]=  gCtx.actual;
    //console.log(screenshotTime.length+"===========================Total Images :===================>"+gCtx.imgs.length);
    let checkImage = false;
    if(gCtx.imgs.length > 0){
        checkImage= true;
        row.push(gCtx.imgs);
    }else
        row.push([{ text: "     NA    ", style: 'tableData', alignment: 'center' }]);
    if(typeof gCtx.username !== 'undefined' && gCtx.username )
        row.push({ text: gCtx.username, style: 'tableData' });
    else
        row.push({ text: "NA", style: 'tableData', alignment: 'center' });
    
    testcaseStep["username"]=  gCtx.username;

    if(gCtx.imgs.length > 0)
        row.push(gCtx.screenshotTime); 
    else
        row.push([]); 

    if (checkImage){

        let tmpImages = Array()
        let tmpTStamp = Array()
        for (let i = 0; i < gCtx.imgs.length; i++) {
            tmpImages.push(gCtx.imgs[i].image);
            tmpTStamp.push( gCtx.screenshotTime[i]);
        };

        testcaseStep["screenshots"] =  {
            "images": tmpImages,
            "screenshotTime":tmpTStamp
        }
    }
    else
        testcaseStep["screenshots"] =  { "images": [], "screenshotTime":[] }
    //console.log(testReqNum +":"+testReqNum.trim().replace(/ /g, '\n'))
    // replacing the spaces with new line characters.
    gCtx.testReqNum = gCtx.testReqNum.trim().replace(/ /g, '\n');
    row.push(gCtx.testReqNum);
    testcaseStep["testReqNum"]=  gCtx.testReqNum;
    // console.log(username+" : "+testStep+" : "+expected+" : "+actual +" : "+ keyWord.valueWithPath("status@status"));
    gCtx.testCaseSteps.push(testcaseStep);
    //console.log("-=-=-=-=-=-=-=--->"+JSON.stringify(testcaseStep, null, 4))
    gCtx.xmlRepotFormatData.push(row);
    //console.log(username+" : "+testStep+" : "+expected+" : "+actual +" : "+ keyWord.valueWithPath("status@status"));
}

function loopkw(keyWord, gCtx){
    keyWord.eachChild(function (ele){
        if (typeof ele !== 'undefined' && ele && ele.name == 'if' ) {
            ele.childrenNamed("branch").forEach(function (branch){
                branch.eachChild(function (inBranch){
                    loopkw(inBranch, gCtx);
                });
            });
        } else if (typeof ele !== 'undefined' && ele && ele.name == 'for' ) {
            ele.eachChild(function (iter){
            if (typeof iter !== 'undefined' && iter && iter.name == 'iter' ) {
                loopkw(iter, gCtx);
            }
        });
        } else if (typeof ele !== 'undefined' && ele && ele.name == 'kw' ) {
            loopkw(ele, gCtx);
        } else if (
            typeof ele !== 'undefined' && ele && ele.name == 'try') {
            ele.childrenNamed("branch").forEach(function (branch) {
                branch.eachChild(function (inBranch) {
                    if (typeof inBranch !== 'undefined' && inBranch ) {
                        loopkw(inBranch,gCtx);
                    }
                });
            });
        }
    });
    if (typeof keyWord !== 'undefined' && keyWord && keyWord.name == 'kw') {
        CheckCaptureForReport(keyWord, gCtx);
    //capturetag.push(keyWord);
    }
}

function updateReportXMLTableData(gCtx){
    gCtx.capturetag.forEach(function (ckw){
        //console.log("+capturetag+------------>"+ ckw.attr.name);
        if(typeof ckw.valueWithPath("tag") != 'undefined'){
            let reqno = ckw.valueWithPath("tag").split(":");
            if(reqno[0].includes("Requirement_ID"))
                gCtx.requirementIDs.push(reqno[1].trim());
        }

        loopkwSnapShot(ckw, ckw.attr.name, gCtx);
    });
    //return rowCount;
}

const getAllbranches = (node, branches = []) => {
    if (!node) return branchs;

    if (node.name === 'branch') {
        branches.push(node);
    }
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => getAllbranches(child, branches));
    }
    return branches;
}

const getScreenshotChildrenNode = (parent, gCtx) => {
    if (!parent.children) return;
    parent.children.forEach(child => {
        if (child.name === 'iter') {
            child.eachChild(inChild => getScreenshotNodes(inChild, gCtx));
        }
    });
};

function getScreenshotNodes(keyWord, gCtx) {
    const handleScreenshotKeyword = (node, gCtx) => {
        const [stepNum, scrNum] = node.childWithAttribute("name", "Log")?.childNamed("msg")?.val?.split("|").map(v => v.trim()) || [];
        if (!stepNum || !scrNum || stepNum === "None" || scrNum === "None") return;
        const branches = node.children.find(child => child.name === "if")?.children?.filter(child => child.name === "branch") || [];
        for (let branch of branches) {
            if (branch.attr?.type === "IF") {
                captureScreenshotPreRequisite(branch, gCtx, stepNum, scrNum);
            } else {
                extractScreenshot(branch, gCtx, stepNum, scrNum, true);
            }
        }
    };
    if (keyWord.attr?.name === "Take screenshot of the page") {
        return handleScreenshotKeyword(keyWord, gCtx);
    }
    if (keyWord.attr?.name === "Get scrolling screenshot of the page") {
        const whileBlock = keyWord.childNamed("while");
        if (whileBlock) getScreenshotChildrenNode(whileBlock, gCtx); return;
    }
    if (keyWord.name === 'for' || keyWord.name === 'while') {
        return getScreenshotChildrenNode(keyWord, gCtx);
    }
    if (keyWord.name === 'kw') {
        keyWord.children.forEach(child => {
            if (child.name === 'kw' && child.attr?.name === "Take screenshot of the page") {
                handleScreenshotKeyword(child, gCtx);
            } else {
                getScreenshotNodes(child, gCtx);
            }
        });
        return;
    }
    if (keyWord.children && keyWord.children.length > 0) {
        keyWord.children.forEach(child => getScreenshotNodes(child, gCtx));
    }
}

function findAllTakeScreenshotNodes(node, found = []) {
    if (!node) return found;
    if (node.name === 'kw' && node.attr && node.attr.name === "Take screenshot of the page") {
        found.push(node);
    }
    if (node.children) {
        node.children.forEach(child => findAllTakeScreenshotNodes(child, found));
    }
    return found;
}

module.exports = { generatePDF };