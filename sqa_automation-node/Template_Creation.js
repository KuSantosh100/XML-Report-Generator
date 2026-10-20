require("dotenv").config();
global._ = require("underscore");
const fs = require("fs");
const mongoose = require("mongoose");
const { join, resolve } = require("path");
require("app-module-path").addPath(`${__dirname}/app/modules`);
global.config = require(resolve(join(__dirname, "app", "config")));
const projectRepo = require("project/repositories/project.repository");
const testCaseRepo = require("test_case/repositories/test_case.repository");
const testDataRepo = require("test_case_data/repositories/test_case_data.repository");
const vaultRepo = require("vault/repositories/vault.repository");
const pdfGenServ = require("services/pdfGenService");
const PdfPrinter = require("pdfmake");

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

const printer = new PdfPrinter(fonts);


////////////////////////////////////////////////////////////CHANGE HERE //////////////////////////////////////////////////////////// 
const CONFIG = {
  orgId: "66f3afff3413e7a07cdfdebe",
  projectId: "686e7d9902471bc6e40550c6",
  testSuiteId: "696e81b7c415acf1fe6be08e",
  tagId: "BASICS_QA_LIMS_02",
  vaultId: new mongoose.Types.ObjectId("693c2e1b363315b023875325"),
  outputFile: "Template.pdf",
};
////////////////////////////////////////////////////////////CHANGE HERE //////////////////////////////////////////////////////////// 

async function initialize() {
  loadModels();
  await require(resolve(join(__dirname, "app", "database")))();
  require("organisation/repositories/organisation.repository");
  require("user/repositories/user.repository");
  console.log("Database connected");
}

function loadModels() {
  [
    "organisation/models/organisation.model",
    "project/models/project.model",
    "vault/models/vault.model",
    "test_suite/models/test_suite.model",
    "test_case/models/test_case.model",
    "test_case_data/models/test_case_data.model",
    "user/models/user.model",
  ].forEach(require);
}

async function getProject(projectId) {
  const project = await projectRepo.getByField({
    _id: projectId,
    isDeleted: false,
  });
  if (!project) {
    throw new Error("Project not found");
  }
  return project;
}

async function getTestCase(testSuiteId, tagId) {
  const testCases = await testCaseRepo.getAllByField({
    test_suite_code: testSuiteId,
    tag_id: tagId,
  });

  if (!testCases?.length) {
    throw new Error(`No test case found for tag ${tagId}`);
  }

  return testCases[0];
}

async function getVault(vaultId) {
  if (!vaultId) {
    return null;
  }

  try {
    return await vaultRepo.getById({
      _id: vaultId,
    });
  } catch {
    return null;
  }
}

function applyApproverOverrides(testData, testCase) {
  if (_.isEmpty(testCase)) {
    return testData;
  }
  testData.Approver = testCase.Approver || testData.Approver;
  testData.QualityApprover =
    testCase.QualityApprover || testData.QualityApprover;
  return testData;
}

function buildFirstPage({ project, vault, testData, testCase }) {
  return {
    firstPageContent1: project.project_name,
    firstPageContent2: project.org_code?.org_name || "NA",
    firstPageContent3: "Spotline",
    veevaRelease: project.supported_vault_release || "NA",
    vaultName: vault?.vault_name || "NA",
    vaultEnvironment: vault?.vault_env || "NA",
    productVersion: vault?.product_version || "NA",
    ccInfo: {},
    testData,
    test_suite_id: testCase.test_suite_code?._id,
    project_id: project._id,
  };
}

async function generatePdf(docDefinition, outputFile) {
  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition, {});
    const stream = fs.createWriteStream(outputFile);
    stream.on("finish", resolve);
    stream.on("error", reject);
    pdfDoc.pipe(stream);
    pdfDoc.end();
  });
}

(async () => {
  try {
    await initialize();
    const orgId = new mongoose.Types.ObjectId(CONFIG.orgId);
    const projectId = new mongoose.Types.ObjectId(CONFIG.projectId);
    const testSuiteId = new mongoose.Types.ObjectId(CONFIG.testSuiteId);
    const project = await getProject(projectId);
    const testData = await testDataRepo.getByField({
      org_code: orgId,
      project_type: project.type,
    });

    const testCase = await getTestCase(testSuiteId, CONFIG.tagId);
    applyApproverOverrides(testData, testCase);
    const vault = await getVault(CONFIG.vaultId);
    const firstPage = buildFirstPage({
      project,
      vault,
      testData,
      testCase,
    });

    console.log(`Generating template for ${testCase.tag_id}`);
    console.log(
    JSON.stringify(testCase, null, 2)
  );
    const docDefinition = await pdfGenServ.createTemplateBodyFromDB(
      firstPage,
      testCase,
    );
    await generatePdf(docDefinition, CONFIG.outputFile);
    console.log(`PDF generated: ${CONFIG.outputFile}`);
  } catch (error) {
    console.error("\nTemplate generation failed");
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
})();