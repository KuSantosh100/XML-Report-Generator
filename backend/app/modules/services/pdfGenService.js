const RptCnfRepo = require('report_config/repositories/report_config.repository');
var moment = require('moment-timezone');
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

class pdfGenService {
    constructor() { }

    async createTemplateBodyFromDB(firstPage, tc) {
        //console.log("firstPage :"+JSON.stringify(firstPage.testData.org_code, null, 4));
        let reportConfig = await getReportConfig(firstPage.testData.org_code, true);

        const filtered = tc.test_steps.filter(item => item.step_type === 'Execution Step');
        const executionSteps = filtered.sort((a, b) => a.step_no - b.step_no);
        // const PreStep = tc.test_steps.find(item => item.step_type === 'Setup Step');
        let preStepData = tc.test_steps
            .filter(step => step.step_type === "Setup Step")
            .sort((a, b) => a.step_no - b.step_no);
        let preStepNos = preStepData.map(step => step.step_no);
        let preSteps = preStepData.map(step => `${step.procedure}`)

        preSteps = preSteps.map((step, index, array) => 
            step
                .replace(/\\r\\n/g, '\n')  // escaped CRLF
                .replace(/\\n/g, '\n')     // escaped LF
                .replace(/\r\n/g, '\n')    // real CRLF
                .replace(/\r/g, '\n')      // real CR
                .replace(/\t/g, '    ')    // real tab
                + (index === array.length - 1 ? '' : '\n\n') // adds newlines ONLY if not the last step
        );
        // console.log("reportConfig :"+JSON.stringify(reportConfig, null, 4));
        let dynamicContent = new Array();
        //First Page
        if(reportConfig.type == "Type3"){
            findAndReplaceString(reportConfig.firstPage.content,"$TagId", tc.tag_id.replace(/_/g, ' '));
            findAndReplaceString(reportConfig.firstPage.content,"$ProjectName", "Veeva Vault v" + firstPage.veevaRelease + " " + firstPage.firstPageContent1);
            // findAndReplaceString(reportConfig.firstPage.content,"$DocumentID",suiteArg[1].preTestStep.documentID);
            findAndReplaceString(reportConfig.firstPage.content,"$DocumentID",'');
            findAndReplaceString(reportConfig.firstPage.content,"$ScriptTitle", tc.test_case_name);
            findAndReplaceString(reportConfig.firstPage.content,"$Version", tc.release_no);
            findAndReplaceString(reportConfig.firstPage.content,"$logo",reportConfig.logo);
            findAndReplaceString(reportConfig.firstPage.content,"$VaultEnvironment", firstPage.vaultName);
    
            dynamicContent.push(reportConfig.firstPage.content);
        }else if( reportConfig.type == "Type5" || reportConfig.type == "Type8" ){
            findAndReplaceString(reportConfig.firstPage.content,"$TagId", tc.test_case_id);
            findAndReplaceString(reportConfig.firstPage.content,"$ScriptTitle", tc.test_case_name);
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
            findAndReplaceString(reportConfig.firstPage.content,"$scriptRelease", '');
            findAndReplaceString(reportConfig.firstPage.content,"$batchID", '');
            dynamicContent.push(reportConfig.firstPage.content);
        }  else if(reportConfig.type == "Type4"){
            findAndReplaceString(reportConfig.firstPage.content,"$tc_Sno", tc.test_case_series);
            findAndReplaceString(reportConfig.firstPage.content,"$startTime", '');
            findAndReplaceString(reportConfig.firstPage.content,"Automation", '');
            findAndReplaceString(reportConfig.firstPage.content,"Yes", '');
           // console.log("------------->"+JSON.stringify(reportConfig.firstPage.content, null, 4));
            dynamicContent.push(reportConfig.firstPage.content);
        } else if(reportConfig.type == "Type6" ){
            findAndReplaceString(reportConfig.firstPage.content,"$TagId", `${tc.test_case_id}-Auto`);
            findAndReplaceString(reportConfig.firstPage.content,"$ProjectName", "Veeva Vault v" + firstPage.veevaRelease + " " + firstPage.firstPageContent1);
            findAndReplaceString(reportConfig.firstPage.content,"$DocumentID",'');
            findAndReplaceString(reportConfig.firstPage.content,"$ScriptTitle", tc.test_case_name);
            findAndReplaceString(reportConfig.firstPage.content,"$Version", tc.release_no);
            findAndReplaceString(reportConfig.firstPage.content,"$logo",reportConfig.logo);
            findAndReplaceString(reportConfig.firstPage.content,"$startTime", '');
            findAndReplaceString(reportConfig.firstPage.content,"$endTime", '');
            findAndReplaceString(reportConfig.firstPage.content,"$VaultEnvironment", firstPage.vaultName);
    
            dynamicContent.push(reportConfig.firstPage.content);
        } else if (reportConfig.type == "Type7"){
            findAndReplaceString(reportConfig.firstPage.content,"$TagId", tc.test_case_id);
            findAndReplaceString(reportConfig.firstPage.content,"$VRefID", tc.vassureReferenceNo);
            findAndReplaceString(reportConfig.firstPage.content,"$ProjectName", "Veeva Vault v" + firstPage.veevaRelease + " " + firstPage.firstPageContent1);
            findAndReplaceString(reportConfig.firstPage.content,"$DocumentID",'');
            findAndReplaceString(reportConfig.firstPage.content,"$ScriptTitle", tc.test_case_name);
            findAndReplaceString(reportConfig.firstPage.content,"$Version", tc.release_no);
            findAndReplaceString(reportConfig.firstPage.content,"$logo",reportConfig.logo);
            findAndReplaceString(reportConfig.firstPage.content,"$startTime", '');
            findAndReplaceString(reportConfig.firstPage.content,"$endTime", '');
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
             findAndReplaceString(reportConfig.secondPage.content,"$TestCaseID", tc.test_case_id);
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
            sumTitle.push({ text: tc.tag_id.replace(/_/g, ' '), style: 'tableHeader', "fillColor": "#F79646" });
            sumBody.push(sumTitle);
    
            let dataRow = new Array();
            dataRow.push({ text: 'Test Description:', style: 'tableHeader', "fillColor": "#F79646" });
            dataRow.push({ text: (typeof tc.test_case_name != 'undefined'? "Script for "+tc.test_case_name : 'NA'), style: 'tableData' });
            sumBody.push(dataRow);
    
            dataRow = new Array();
            dataRow.push({ text: 'Purpose:', style: 'tableHeader', "fillColor": "#F79646" });
            dataRow.push({ text: (typeof tc.description != 'undefined'? tc.description: 'NA'), style: 'tableData'});
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
            dataRow.push({text: preSteps, colSpan:3, preserveLeadingSpaces: true });
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
            dataRow.push({ text: tc.tag_id.replace(/_/g, '-'), style:  'tableData'  });
            dataRow.push({ text: 'Title', style: 'tableHeader', "fillColor": "#FF9E16" });
            dataRow.push({ text: (typeof tc.test_case_name != 'undefined'? tc.test_case_name : 'NA'), style: 'tableData' });
            sumBody.push(dataRow);
    
            dataRow = new Array();
            dataRow.push({ text: 'Description', style: 'tableHeader', fillColor: "#FF9E16" });
            dataRow.push({ text: (typeof tc.description != 'undefined'? tc.description: 'NA'), style: 'tableData', colSpan:3});
            //dataRow.push({ text: 'Build Number', style: 'tableHeader', fillColor: "#FF9E16" });
            //dataRow.push({ text: '', style: 'tableData'});
            dataRow.push({});
            dataRow.push({});
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
            findAndRemoveStringSpecialVar(preSteps);
            // console.log(preSteps);
            dataRow.push({
                stack: preSteps.map((text, i) => ({
                    columns: [
                        { text: `${preStepNos[i]}.`, width: 'auto', style: 'tableData' },
                        { text: text, style: 'tableData', preserveLeadingSpaces: true }
                    ],
                    columnGap: 2
                })),
                colSpan: 3
            });
            dataRow.push({});
            dataRow.push({});
            sumBody.push(dataRow);
            // console.log(dataRow);

    
            dynamicContent.push(
            {
                pageOrientation: 'landscape',
                margin: [30, 25, 20, 20],
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
            let dataRow = new Array();
            dataRow.push((typeof tc.test_case_id != 'undefined'? tc.test_case_id: 'NA'))
            //dataRow.push("suiteArg[0].scriptRelease")
            dataRow.push("");
            dataRow.push((typeof tc.test_case_name != 'undefined'? tc.test_case_name : "NA"));
            dataRow.push((typeof tc.description != 'undefined'? tc.description: 'NA'));
            dataRow.push((typeof tc.requirement_no != 'undefined'? tc.requirement_no: 'NA'))
            dataRow.push("");
            dataRow.push("");
            // console.log(dataRow);
            summaryBody.push(dataRow);
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
            dataRow.push({ text: `${tc.tag_id.replace(/_/g, '-')}-Auto`, style:  'tableData'  });
            dataRow.push({ text: 'Test Title', style: 'tableHeader', "fillColor": "#FF9E16" });
            dataRow.push({ text: (typeof tc.test_case_name != 'undefined'? tc.test_case_name : 'NA'), style: 'tableData' });
            sumBody.push(dataRow);
    
            dataRow = new Array();
            dataRow.push({ text: 'Test Description', style: 'tableHeader', fillColor: "#FF9E16" });
            dataRow.push({ text: (typeof tc.description != 'undefined'? tc.description: 'NA'), style: 'tableData'});
            dataRow.push({ text: 'Run Number', style: 'tableHeader', fillColor: "#FF9E16" });
            dataRow.push({ text: (typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.runNo : ''), style: 'tableData'});
            sumBody.push(dataRow);
    
            dataRow = new Array();
            // dataRow.push({ text: 'History Number', style: 'tableHeader', fillColor: "#FF9E16" });
            // dataRow.push({ text: batchID, style: 'tableData'});
            dataRow.push({ text: 'Version Date', style: 'tableHeader', fillColor: "#FF9E16" });
            dataRow.push({ text: moment.utc(tc.release_date).format("DD-MMM-YYYY").toUpperCase(), style: 'tableData'});
            dataRow.push({ text: 'Test Version', style: 'tableHeader', fillColor: "#FF9E16" });
            dataRow.push({ text: tc.release_no, style: 'tableData'});
            sumBody.push(dataRow);
    
            dataRow = new Array();
            dataRow.push({ text: 'Start Time', style: 'tableHeader', fillColor: "#FF9E16" });
            dataRow.push({ text: '', style: 'tableData'});
            dataRow.push({ text: 'End Time', style: 'tableHeader', fillColor: "#FF9E16" });
            dataRow.push({ text: '', style: 'tableData'});
            sumBody.push(dataRow);
    
            dataRow = new Array();
            dataRow.push({ text: 'Steps Executed', style: 'tableHeader', fillColor: "#FF9E16" });
            dataRow.push({ text: '' , style: 'tableData'});
            dataRow.push({ text: 'Overall Status', style: 'tableHeader', fillColor: "#FF9E16" });
            dataRow.push({ text: '', style: 'tableData'});
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
            dataRow.push({ text: (typeof tc.requirement_no != 'undefined'? tc.requirement_no: 'NA'), style: 'tableData',colSpan:3 });
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
            findAndRemoveStringSpecialVar(preSteps);
            dataRow.push({text: preSteps, colSpan:3, preserveLeadingSpaces: true });
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
            dataRow.push({ text: tc.tag_id.replace(/_/g, '-'), style:  'tableData'  });
            dataRow.push({ text: 'Test Suite Name / Test Script Name', style: 'tableHeader', "fillColor": "#C23D48" });
            dataRow.push({ text: (typeof tc.test_case_name != 'undefined'? tc.test_case_name : 'NA'), style: 'tableData' });
            sumBody.push(dataRow);
    
            dataRow = new Array();
            dataRow.push({ text: 'Test Description', style: 'tableHeader', fillColor: "#C23D48" });
            dataRow.push({ text: (typeof tc.description != 'undefined'? tc.description: 'NA'), style:  'tableData'  });
            dataRow.push({ text: 'Test Suite/Script Version', style: 'tableHeader', fillColor: "#C23D48" });
            dataRow.push({ text: tc.release_no, style: 'tableData' });
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
            dataRow.push({ text: (typeof tc.requirement_no != 'undefined'? tc.requirement_no: 'NA'), style: 'tableData',colSpan:3 });
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
            //findAndReplaceStringSpecialChar(preSteps);
            dataRow.push({text: preSteps, colSpan:3, preserveLeadingSpaces: true });
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

            // let rowCount = 1
            // let ignoreColumns = [2,3,5,6];
            executionSteps.forEach(function (row) {
                let dataRow = new Array();
                dataRow.push({ text: parseInt(tc.test_step_start_no)+parseInt(row.step_no), style: 'tableData' });
                dataRow.push(row.procedure); //Instructions		 
                dataRow.push(row.expected_result); //Expected Results
                dataRow.push(""); //Actual Results
                dataRow.push(""); //Pass/Fail
                body.push(dataRow);
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
        } else if( reportConfig.type == "Type3" ){
            let body = new Array();
    
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', "fillColor": "#F79646", alignment: 'center' },
                { text: 'User', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Description of Action', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Expected Results ', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Actual Results', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
                { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center', "fillColor": "#F79646" },
            );
            body.push(tableTitle1);

            executionSteps.forEach(function (row) {
                let dataRow = new Array();
                dataRow.push({ text: row.step_no, style: 'tableHeader', fillColor: "#FF9E16" });
                dataRow.push([{ text: row.procedure, style: 'tableData' }]); //Description of Action		 
                dataRow.push([{ text: row.expected_result, style: 'tableData' }]); //Expected Results
                dataRow.push(""); //Actual Results
                dataRow.push(""); //Pass/Fail
                body.push(dataRow);
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
    
        } else if( reportConfig.type == "Type5" || reportConfig.type == "Type8" ){
            let body = new Array();
    
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', fillColor: "#FF9E16", alignment: 'center' },
                { text: 'Procedure', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Expected Results ', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Actual Results', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center',  fillColor: "#FF9E16" },
            );
            body.push(tableTitle1);

            executionSteps.forEach(function (row) {
                let dataRow = new Array();
                let procedure = row.procedure
                                    .replace(/\\r\\n/g, '\n')  // escaped CRLF
                                    .replace(/\\n/g, '\n')     // escaped LF
                                    .replace(/\r\n/g, '\n')    // real CRLF
                                    .replace(/\r/g, '\n')      // real CR
                                    .replace(/\t/g, '    ');
                let expected_result = row.expected_result
                                    .replace(/\\r\\n/g, '\n')  // escaped CRLF
                                    .replace(/\\n/g, '\n')     // escaped LF
                                    .replace(/\r\n/g, '\n')    // real CRLF
                                    .replace(/\r/g, '\n')      // real CR
                                    .replace(/\t/g, '    ');                                    

                dataRow.push({ text: row.step_no, style: 'tableHeader', fillColor: "#FF9E16" });
                dataRow.push([{ text: procedure, style: 'tableData' }]); //Description of Action		 
                dataRow.push([{ text: expected_result, style: 'tableData' }]); //Expected Results
                dataRow.push(""); //Actual Results
                dataRow.push(""); //Pass/Fail
                body.push(dataRow);
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
    
        } else if(reportConfig.type == "Type4"){

            let body = new Array();
            let tableTitle1 = new Array({ text: 'Step', bold: true, "fillColor": "#95B3D7", alignment: 'center' },
                { text: 'Instructions', bold: true, alignment: 'center', "fillColor": "#95B3D7" },
                { text: 'Expected Results ', bold: true, alignment: 'center', "fillColor": "#95B3D7" },
                { text: 'Actual Results', bold: true, alignment: 'center', "fillColor": "#95B3D7" },
                { text: 'Pass/Fail', bold: true, alignment: 'center', "fillColor": "#95B3D7" },
                
            );
            body.push(tableTitle1);
            executionSteps.forEach(function (row) {
                let dataRow = new Array();
                dataRow.push({ text: row.step_no, style: 'tableHeader', fillColor: "#FF9E16" });
                dataRow.push([{ text: row.procedure, style: 'tableData' }]); //Description of Action		 
                dataRow.push([{ text: row.expected_result, style: 'tableData' }]); //Expected Results
                dataRow.push(""); //Actual Results
                dataRow.push(""); //Pass/Fail
                body.push(dataRow);
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
   
        } else if( reportConfig.type == "Type6"){
            let body = new Array();
        
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', fillColor: "#FF9E16", alignment: 'center' },
                { text: 'Procedure', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Expected Results ', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Actual Results', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#FF9E16" },
                { text: 'Pass/Fail', style: 'tableHeader', alignment: 'center', fillColor: "#FF9E16" },
            );
            body.push(tableTitle1);

            executionSteps.forEach(function (row) {
                let dataRow = new Array();
                dataRow.push({ text: row.step_no, style: 'tableHeader', fillColor: "#FF9E16" });
                dataRow.push([{ text: row.procedure, style: 'tableData' }]); //Description of Action		 
                dataRow.push([{ text: row.expected_result, style: 'tableData' }]); //Expected Results
                dataRow.push(""); //Actual Results
                dataRow.push(""); //Pass/Fail
                body.push(dataRow);
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
        } else if( reportConfig.type == "Type7"){
            let body = new Array();
        
            let tableTitle1 = new Array({ text: 'Step #', style: 'tableHeader', fillColor: "#C23D48", alignment: 'center' },
                { text: 'Description', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#C23D48" },
                { text: 'Expected Results ', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#C23D48" },
                { text: 'Actual Results', style: 'tableData', alignment: 'center',  color: '#FFFFFF', fillColor: "#C23D48" },
                { text: 'Status', style: 'tableHeader', alignment: 'center', fillColor: "#C23D48" },
            );
            body.push(tableTitle1);

            executionSteps.forEach(function (row) {
                let dataRow = new Array();
                dataRow.push({ text: row.step_no, style: 'tableHeader', fillColor: "#FF9E16" });
                dataRow.push([{ text: row.procedure, style: 'tableData' }]); //Description of Action		 
                dataRow.push([{ text: row.expected_result, style: 'tableData' }]); //Expected Results
                dataRow.push(""); //Actual Results
                dataRow.push(""); //Pass/Fail
                body.push(dataRow);
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
            findAndReplaceString(refBody,"$tc_Sno", tc.test_case_series);
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
            pageOrientation: (typeof tc.test_case_name != 'undefined' ? reportConfig.firstPage.pageOrientation : 'portrait'),    
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
                        findAndReplaceString(pageHead,"$release_no",tc.release_no);
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
                        findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", tc.tag_id.replace(/_/g, ' ') + " - " + tc.test_case_name);
                        findAndReplaceString(reportConfig.otherPage.header,"$DocumentID", '');
                        findAndReplaceString(reportConfig.otherPage.header,"$Version", tc.release_no);                    
                        return reportConfig.otherPage.header;
                    }else if( reportConfig.type == "Type5" || reportConfig.type == "Type8") {
                        findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                        findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", tc.test_case_id );
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
                        findAndReplaceString(pageHead,"$release_no",tc.release_no);
                        findAndReplaceString(pageHead,"$change_no",(typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.changeControlNo : ''));
                        return pageHead
                    } else if( reportConfig.type == "Type6" ) {
                        findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                        findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", `${tc.test_case_id}-Auto` );
                        return reportConfig.otherPage.header;
                    } else if(reportConfig.type == "Type7") {
                        findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
                        findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", tc.test_case_id );
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

        // let docDefinition = {
        //     info: {
        //         title: 'V-Assure Test Execution Results',
        //         author: 'Spotline Inc.',
        //         subject: 'V-Assure Test Execution Results'
        //     },
        //     pageMargins : reportConfig.pageMargins,
        //     pageOrientation: (typeof tc.test_case_name != 'undefined' ? reportConfig.firstPage.pageOrientation : 'portrait'),    
        //     header:  (currentPage, pageCount, pageSize) => {
        //         if(currentPage == 1 ){
        //             if(reportConfig.type == "Type5" || reportConfig.type == "Type6" || reportConfig.type == "Type7") {
        //                 findAndReplaceString(reportConfig.firstPage.header,"$logo",reportConfig.logo);
        //                 return reportConfig.firstPage.header;
        //             }else if(reportConfig.type == "Type4") {
        //                 let pageHead  = JSON.parse(JSON.stringify(reportConfig.firstPage.header));
    
        //                 findAndReplaceString(pageHead,"$logo",reportConfig.logo);
        //                 findAndReplaceString(pageHead, "$currentPage", currentPage.toString());
        //                 findAndReplaceString(pageHead, "$pageCount", pageCount);
        //                 findAndReplaceString(pageHead,"$release_no",tc.release_no);
        //                 findAndReplaceString(pageHead,"$change_no",(typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.changeControlNo : ''));
        //                 return pageHead
        //             }
        //         } 
        //         else {
        //             if( reportConfig.type == "Type5") {
        //                 findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
        //                 findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", tc.test_case_id );
        //                 return reportConfig.otherPage.header;
        //             }else if(reportConfig.type == "Type4") {
        //                 let pageHead  = JSON.parse(JSON.stringify(reportConfig.firstPage.header));
    
        //                 findAndReplaceString(pageHead,"$logo",reportConfig.logo);
        //                 findAndReplaceString(pageHead, "$currentPage", currentPage.toString());
        //                 findAndReplaceString(pageHead, "$pageCount", pageCount);
        //                 findAndReplaceString(pageHead,"$release_no",tc.release_no);
        //                 findAndReplaceString(pageHead,"$change_no",(typeof firstPage.ccInfo != 'undefined' ? firstPage.ccInfo.changeControlNo : ''));
        //                 return pageHead
        //             } else if( reportConfig.type == "Type6" ) {
        //                 findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
        //                 findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", `${tc.test_case_id}-Auto` );
        //                 return reportConfig.otherPage.header;
        //             } else if(reportConfig.type == "Type7") {
        //                 findAndReplaceString(reportConfig.otherPage.header,"$logo",reportConfig.logo);
        //                 findAndReplaceString(reportConfig.otherPage.header,"$DocumentTitle", tc.test_case_id );
        //                 return reportConfig.otherPage.header;
        //             }
        //         }
        //     },
        //     footer:  (currentPage, pageCount, pageSize) => {
        //         if(currentPage == 1 ){
        //             if(reportConfig.type == "Type4") {
        //                 return reportConfig.firstPage.footer;
        //             }else if(reportConfig.type == "Type5" || reportConfig.type == "Type6" || reportConfig.type == "Type7") {
        //                 let pageFooter  = JSON.parse(JSON.stringify(reportConfig.firstPage.footer));
        //                 findAndReplaceEvalNum(pageFooter,"$psw",pageSize.width);
        //                 findAndReplaceString(pageFooter,"$currentPage",currentPage);
        //                 findAndReplaceString(pageFooter,"$pageCount",pageCount);
        //                 return pageFooter;                
        //             }
        //         } else {
        //             if(reportConfig.type == "Type4") {
        //                 return reportConfig.otherPage.footer;
        //             }else if(reportConfig.type == "Type5" || reportConfig.type == "Type6" || reportConfig.type == "Type7") {
        //                 let pageFooter  = JSON.parse(JSON.stringify(reportConfig.otherPage.footer));
        //                 findAndReplaceEvalNum(pageFooter,"$psw",pageSize.width);
        //                 findAndReplaceString(pageFooter,"$currentPage",currentPage);
        //                 findAndReplaceString(pageFooter,"$pageCount",pageCount);
        //                 return pageFooter;                
        //             }
        //         }

        //     },
        //     styles: {
        //         tableHeader: {
        //             fontSize: 10,
        //             bold: true,
        //             color: '#FFFFFF',
        //             fillColor: '#191970',
        //         },
        //         tableData: {
        //             fontSize: 10
        //         }
        //     },
        //     defaultStyle: {
        //         font: 'Helvetica',
        //         fontSize: 10
        //     },
        //     content: dynamicContent
        // }

        // return docDefinition;
    }
}

async function getReportConfig(org, dryrun){
    try{
        let rc = await RptCnfRepo.getByField({ org_code: org, template: dryrun });
        if(!_.isEmpty(rc)) {
            return rc;
        }else{  //get default
            rc = await RptCnfRepo.getByField({ org_code: null, template: dryrun});
        return rc;
        }

    }catch(error) {
       console.log(error);
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

module.exports = new pdfGenService();