const fs = require('fs');
const path = require('path');
const xmldoc = require('xmldoc');
const moment = require('moment-timezone');
const PdfPrinter = require('pdfmake');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Ensure module resolution
require('app-module-path').addPath(path.join(__dirname, 'app', 'modules'));
global._ = require('underscore');
if (!global.config) {
  global.config = require(path.join(__dirname, 'app', 'config'));
}

const PDFGen = require(path.join(__dirname, 'app', 'modules', 'util', 'pdfGenerator'));

const fonts = {
  Courier: { normal: 'Courier', bold: 'Courier-Bold', italics: 'Courier-Oblique', bolditalics: 'Courier-BoldOblique' },
  Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' },
  Times: { normal: 'Times-Roman', bold: 'Times-Bold', italics: 'Times-Italic', bolditalics: 'Times-BoldItalic' },
};
const printer = new PdfPrinter(fonts);

const REPORTS_DIR = path.join(__dirname, 'public', 'generated_reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Fast XML parser to extract test execution metadata and populate UI defaults
 */
function parseXmlMetadata(xmlString) {
  try {
    const doc = new xmldoc.XmlDocument(xmlString);
    const suiteTag = doc.descendantWithPath('suite');

    let suiteName = suiteTag?.attr?.name || 'Unknown Suite';
    let suiteStatus = suiteTag?.valueWithPath('status@status') || 'UNKNOWN';
    let startTime = suiteTag?.valueWithPath('status@starttime') || suiteTag?.valueWithPath('status@start') || 'NA';
    let endTime = suiteTag?.valueWithPath('status@endtime') || suiteTag?.valueWithPath('status@elapsed') || 'NA';

    const testCases = [];
    let scriptVersion = '1.0';
    let veevaVaultVersion = '24.1';

    function traverseSuite(node) {
      if (!node || !node.childrenNamed) return;
      node.childrenNamed('test').forEach(testNode => {
        let testName = testNode.attr?.name || 'Unnamed Test';
        if (testNode.valueWithPath('doc')) {
          testName = testNode.valueWithPath('doc');
        }
        let testStatus = testNode.valueWithPath('status@status') || 'NA';
        let testId = testNode.attr?.id || '';
        let tagId = '';

        testNode.childrenNamed('tag').forEach(tag => {
          const val = tag.val || '';
          if (val.includes('ScriptVersion')) {
            scriptVersion = val.split(':')[1]?.trim() || scriptVersion;
          } else if (val.includes('veevaVaultVersion')) {
            veevaVaultVersion = val.split(':')[1]?.trim() || veevaVaultVersion;
          } else if (!val.includes('robot:')) {
            if (!tagId) tagId = val.trim();
          }
        });

        testCases.push({
          id: testId,
          name: testName,
          status: testStatus,
          tagId: tagId || 'TC_DEFAULT'
        });
      });

      node.childrenNamed('suite').forEach(s => traverseSuite(s));
    }

    if (suiteTag) {
      traverseSuite(suiteTag);
    }

    // Count screenshots and execution steps
    let screenshotCount = (xmlString.match(/screenshot_of_page/g) || []).length;
    let captureForReportCount = (xmlString.match(/capture_for_report/g) || []).length;
    let preReqCount = (xmlString.match(/<tag>pre_requisite<\/tag>/g) || []).length;

    const primaryTest = testCases[0] || {
      id: 'TC_01',
      name: 'Default Test Case',
      status: suiteStatus,
      tagId: 'BASICS_PQ_TEST'
    };

    return {
      success: true,
      suiteName,
      suiteStatus,
      startTime,
      endTime,
      scriptVersion,
      veevaVaultVersion,
      testCases,
      primaryTest,
      stats: {
        totalTests: testCases.length,
        screenshotCount,
        captureForReportCount,
        preReqCount,
        xmlLengthBytes: xmlString.length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generates the PDF report using the org's PDFGen engine
 */
async function generateReport(xmlBufferOrString, options = {}) {
  const xmlBuffer = Buffer.isBuffer(xmlBufferOrString) ? xmlBufferOrString : Buffer.from(xmlBufferOrString);
  const metadata = parseXmlMetadata(xmlBuffer.toString('utf8'));
  const primaryTest = metadata.primaryTest || {};

  const reportType = options.reportType || 'Type0';
  const dryrun = options.dryrun === true || options.dryrun === 'true';
  const batchId = options.batchId || options.runNo || '1';

  const firstPage = {
    firstPageContent1: options.projectName || 'Operational Qualification',
    firstPageContent2: options.orgName || 'Wonder Pharma',
    firstPageContent3: options.vendorName || 'Spotline',
    veevaRelease: options.veevaRelease || '24R1',
    veevaVaultID: options.veevaVaultId || 'NA',
    vaultName: options.vaultName || 'Spotline Vault',
    vaultURL: options.vaultUrl || 'https://login.veevavault.com',
    vaultEnvironment: options.vaultEnvironment || 'Development',
    productVersion: options.productVersion || metadata.veevaVaultVersion || 'NA',
    reportType: reportType,
    testerName: options.testerName || 'Automation',
    ccInfo: {
      runNo: options.runNo || batchId
    },
    testData: {
      Approver: options.approver || 'NA',
      QualityApprover: options.qualityApprover || 'NA',
      project_type: options.projectType || 'LIMS'
    },
    customTestCaseId: options.customTestCaseId || primaryTest.tagId || 'NA',
    customTestCaseName: options.customTestCaseName || primaryTest.name || 'NA',
    customScriptVersion: options.customScriptVersion || metadata.scriptVersion || '1.0',
    customDescription: options.customDescription || primaryTest.name || 'Automated SQA Verification',
    customRequirementNo: options.customRequirementNo || 'NA',
    customVassureRefNo: options.customVassureRefNo || 'NA',
    customLogo: options.customLogo || null
  };

  const orgId = options.orgId 
    ? new mongoose.Types.ObjectId(options.orgId) 
    : (options.orgName === 'Wonder Pharma' ? new mongoose.Types.ObjectId("66f3afff3413e7a07cdfdebe") : null);

  const startTime = Date.now();
  const docDefinition = await PDFGen.generatePDF(xmlBuffer, firstPage, orgId, batchId, dryrun);

  // Apply intelligent Intentionally Left Blank 2-pass filtering if enabled
  if (options.filterBlankPages !== false && !dryrun) {
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
    if (Array.isArray(docDefinition.content)) {
      docDefinition.content = docDefinition.content.filter(node => {
        if (node.text === 'Intentionally Left Blank') {
          const r = ilbData[ilbIdx++]?.ratio ?? 0;
          if (r < 0.001 || r >= 0.5) return false;
          node.margin = [0, 20, 0, 0];
        }
        return true;
      });
    }
  }

  const reportId = crypto.randomUUID();
  const safeTag = (firstPage.customTestCaseId || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeTag}_${reportType}_${dryrun ? 'Template' : 'Execution'}_${Date.now()}.pdf`;
  const filePath = path.join(REPORTS_DIR, filename);

  await new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition, {});
    const writeStream = fs.createWriteStream(filePath);
    pdfDoc.pipe(writeStream);
    pdfDoc.end();
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  const durationMs = Date.now() - startTime;
  const fileStat = fs.statSync(filePath);

  return {
    reportId,
    filename,
    filePath,
    url: `/generated_reports/${filename}`,
    downloadUrl: `/api/reports/${filename}/download`,
    previewUrl: `/api/reports/${filename}/preview`,
    fileSizeBytes: fileStat.size,
    fileSizeFormatted: `${(fileStat.size / (1024 * 1024)).toFixed(2)} MB`,
    generationDurationMs: durationMs,
    reportType,
    isTemplate: dryrun,
    metadata: {
      tagId: firstPage.customTestCaseId,
      scriptTitle: firstPage.customTestCaseName,
      projectName: firstPage.firstPageContent1,
      orgName: firstPage.firstPageContent2,
      veevaRelease: firstPage.veevaRelease,
      vaultName: firstPage.vaultName,
      status: metadata.suiteStatus
    }
  };
}

module.exports = {
  parseXmlMetadata,
  generateReport,
  REPORTS_DIR
};
