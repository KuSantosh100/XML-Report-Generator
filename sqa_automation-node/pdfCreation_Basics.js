const dns= require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');

const { join, resolve } = require("path");
_ = require("underscore");
require("app-module-path").addPath(__dirname + "/app/modules");
config = require(resolve(join(__dirname, "app", "config")));
const mongoose = require('mongoose');
const projectRepo = require("project/repositories/project.repository");
// const executionRepo = require("execution/repositories/execution.repository");
// const executionHisRepo = require("execution_history/repositories/execution_history.repository");
// const organisationRepo = require("organisation/repositories/organisation.repository");
const userRepo = require('user/repositories/user.repository');
const vaultRepo = require("vault/repositories/vault.repository");
const mailer = require('./app/modules/util/mailer.js');
const testCaseRepo = require('test_case/repositories/test_case.repository');
const executionServ = require('services/executionService');

const request = require("axios");
const { Upload } = require('@aws-sdk/lib-storage');
//const { S3Client, HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const PdfPrinter = require("pdfmake");
const PDFGen = require("util/pdfGenerator");
const testDataRepo = require("test_case_data/repositories/test_case_data.repository");

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



let printer = new PdfPrinter(fonts);


const fs = require("fs");


(async () => {
await databaseInit();
console.log("Welcome to the test")

//"C:/Users/sukum/Downloads/scriptversion.xml"

	let testData = await testDataRepo.getByField({
		org_code: new mongoose.Types.ObjectId("66f3afff3413e7a07cdfdebe"),
		project_type: "LIMS"
	  }); 
	let vault = await vaultRepo.getById({
		_id: new mongoose.Types.ObjectId("698dd50cae684af6cd73ae9a")
	});

	let projObj = {
		_id: new mongoose.Types.ObjectId("66f3b529666a854d4d41a57c"),
		isDeleted: false,
	};
	//EXECUTION_STEP_FAILURE
	let projectDetails = await projectRepo.getByField(projObj);
	fs.readFile("./output.xml", async function (err, data) {
	if (err) {
		console.log("xmlParser: ERROR:==>" + err);
	} else {
		//console.log(data.length);
			let testData = await testDataRepo.getByField({
			org_code: projectDetails.org_code._id,
			project_type: projectDetails.type
			});          
			
			let testCaseData = await testCaseRepo.getAllByField({
			test_suite_code: new mongoose.Types.ObjectId("686e7eb302471bc6e40550c8"), // 68d191cfe1b3ff6f413b66fa 686e7eb302471bc6e40550c8  68d18fa0e1b3ff6f413b66f7   696e81b7c415acf1fe6be08e
			tag_id: "BASICS_PQ_LIMS_10"    //"BASICS_PQ_LIMS_22 BASICS_PQ_QUAL_QD_12 BASICS_PQ_CLIN_CTMS_05
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
			'ccInfo': {},
			'testData': testData,
			'userID': new mongoose.Types.ObjectId("68137554f5c22548a6f32545"),
			'test_suite_id': new mongoose.Types.ObjectId("686e7eb302471bc6e40550c8"),
			'execution_id': new mongoose.Types.ObjectId("69b9a53d67da2c2fa8ab3cf7"),
			'project_id': projectDetails._id
		};
		 let docDefinition = await PDFGen.generatePDF(data, firstPage,new mongoose.Types.ObjectId("66f3afff3413e7a07cdfdebe"), 3, false);
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
        pdfDoc.pipe(fs.createWriteStream('C:/Users/KumarSantosh/Downloads/SQAAutomation-dev/sqa_automation-node/Test_10_auto.pdf'));
        pdfDoc.end();
		console.log("I am done..........................")

	}
});

})()

async function databaseInit() {
	try {
	  await require(resolve(join(__dirname, "app", "database")))();
	  //await require('project_setting/repositories/project_setting.repository');
	  await require('user/repositories/user.repository');
	} catch (error) {
	  console.error(error);
	}
  }


/*

(async () => {
	await databaseInit();

	let oid = mongoose.Types.ObjectId("62af0562337a2f06663820fd");
	var emailExists = await userRepo.updateById(
		{
			isDeleted: false,
		  },
		  mongoose.Types.ObjectId("62af0562337a2f06663820fd"));
		  //{ email: "sdasi@spotline.com",
		//isDeleted: false,
	//	_id: { $ne: mongoose.Types.ObjectId("618406847e6c9264fa7ea03f") }, 	  });
	  console.log("user :"+JSON.stringify(emailExists, null, 4))

  })()


async function databaseInit() {
  try {
    await require(resolve(join(__dirname, "app", "database")))();
	//await require('project_setting/repositories/project_setting.repository');
	await require('user/repositories/user.repository');
  } catch (error) {
    console.error(error);
  }
}

async function getUser(id){
    try{
		let user = await userRepo.getById(mongoose.Types.ObjectId(id));
		return user;
    }catch(error) {
       console.log(error);
    }
};

async function validateToken(id, token) {
	try {
	  let user = await userRepo.getById(mongoose.Types.ObjectId(id));
  
	  if (user) {
		const secret = config.jwtSecret + user.password;
		let payload = jwt.verify(token, secret); 
		console.log("payload : "+JSON.stringify(payload, null, 4));
		return { status: 200, data: {user_name: user.full_name }, message: "Valid URL." };
	  } else {
		return { status: 201, data: {}, message: "Not a valid URL." };
	  }
	} catch (e) {
	  console.log(e);
	  return { message: "Not a valid URL." };
	}
  };

  */
