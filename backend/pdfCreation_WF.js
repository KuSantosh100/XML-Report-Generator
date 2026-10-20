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
		project_type: "Quality"
	  }); 
	let vault = await vaultRepo.getById({
		_id: new mongoose.Types.ObjectId("696e8674e7f55f7120f2d6c2")
	});

	let projObj = {
		_id: new mongoose.Types.ObjectId("686e7d9902471bc6e40550c6"),
		isDeleted: false,
	};
	let projectDetails = await projectRepo.getByField(projObj);
	fs.readFile("C:/Users/sdasi/Downloads/dev/6970d7bdb0c7d41c09ed1aee-output.xml", async function (err, data) {
	if (err) {
		console.log("xmlParser: ERROR:==>" + err);
	} else {
		//console.log(data.length);
			let testData = await testDataRepo.getByField({
			org_code: projectDetails.org_code._id,
			project_type: projectDetails.type
			});          
			
			let testCaseData = await testCaseRepo.getAllByField({
			test_suite_code: new mongoose.Types.ObjectId("696e81b7c415acf1fe6be08e"),
			tag_id: "BASICS_PQ_QUAL_QD_08"
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
			'test_suite_id': new mongoose.Types.ObjectId("696e81b7c415acf1fe6be08e"),
			'execution_id': new mongoose.Types.ObjectId("69500e2c35d83edffe9e9853"),
			'project_id': projectDetails._id
		};
		// console.log(JSON.stringify(firstPage, null, 4) );6847
		 let docDefinition = await PDFGen.generatePDF(data, firstPage,new mongoose.Types.ObjectId("66f3afff3413e7a07cdfdebe"), 3, false);
		//let docDefinition = await PDFGen.generatePDF(data, firstPage,mongoose.Types.ObjectId("65565baa3fd5e11601a42c57"), 110, false);
		//let docDefinition = await PDFGen.generatePDF(data, firstPage, null , 10, true);
        let pdfDoc = await printer.createPdfKitDocument(docDefinition, {});
        pdfDoc.end();

		await pdfDoc.pipe(fs.createWriteStream('C:/Users/sdasi/Downloads/Test.pdf'));
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