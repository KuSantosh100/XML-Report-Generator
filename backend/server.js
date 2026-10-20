const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// Add module resolution
require('app-module-path').addPath(path.join(__dirname, 'app', 'modules'));
global._ = require('underscore');
if (!global.config) {
  global.config = require(path.join(__dirname, 'app', 'config'));
}

const webReportService = require('./webReportService');

const app = express();
const PORT = process.env.PORT || process.env.WEB_PORT || 1500;

// Enable CORS for GitHub Pages and remote client origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Support large XML payloads (up to 100MB)
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
app.use(bodyParser.text({ type: ['text/xml', 'application/xml', 'text/plain'], limit: '100mb' }));

// Serve static assets from public/
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));
app.use('/generated_reports', express.static(webReportService.REPORTS_DIR));

// Maintain session report history in memory
const reportHistory = [];

let dbConnected = false;
let dbStatusMessage = 'Connecting...';

// Asynchronously attempt DB connection without blocking server startup
(async () => {
  if (process.env.DB_URL) {
    try {
      [
        'organisation/models/organisation.model',
        'project/models/project.model',
        'vault/models/vault.model',
        'test_suite/models/test_suite.model',
        'test_case/models/test_case.model',
        'test_case_data/models/test_case_data.model',
        'user/models/user.model',
        'report_config/models/report_config.model'
      ].forEach(require);

      await mongoose.connect(process.env.DB_URL, {
        serverSelectionTimeoutMS: 5000
      });
      dbConnected = true;
      dbStatusMessage = 'Connected to MongoDB Atlas';
      console.log('Database connected successfully in background.');
    } catch (err) {
      dbConnected = false;
      dbStatusMessage = `Standalone Mode (DB Offline: ${err.message})`;
      console.log('MongoDB connection skipped/failed. Running in Standalone Mode:', err.message);
    }
  } else {
    dbConnected = false;
    dbStatusMessage = 'Standalone Mode (No DB_URL configured)';
  }
})();

// API: Health & Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      connected: dbConnected,
      message: dbStatusMessage
    },
    totalReportsGenerated: reportHistory.length
  });
});

// API: Available Report Template Configurations
app.get('/api/configs', (req, res) => {
  const templates = [
    {
      id: 'Type0',
      name: 'Type 0: Operational Qualification Protocol & Table of Contents',
      description: 'The standard qualification protocol format. Displays the centered Wonder Pharma logo, Operational Qualification header, Table of Contents, and execution steps.',
      isDefault: true
    },
    {
      id: 'Type5',
      name: 'Type 5: Modern Landscape Summary & Steps',
      description: 'SQA execution report format with executive summary card, execution step logs, and full-page screenshots.'
    },
    {
      id: 'Type3',
      name: 'Type 3: Veeva Classic Format',
      description: 'Features formal Version History table, Landscape summary table, and step-by-step verification.'
    },
    {
      id: 'Type1',
      name: 'Type 1: Enterprise Multi-Script Summary',
      description: 'Optimized for test suites with multi-script verification and comprehensive summary tables.'
    },
    {
      id: 'Type4',
      name: 'Type 4: Tabular Form Instruction Matrix',
      description: 'Detailed instructions, user verification roles, and expected vs actual matrices.'
    },
    {
      id: 'Type6',
      name: 'Type 6: Automated Script Reviewer Assessment',
      description: 'Includes automated script suffix (-Auto), formal Reviewer Assessment checkboxes, and system attributes.'
    },
    {
      id: 'Type7',
      name: 'Type 7: System Under Test & Objective Protocol',
      description: 'Detailed breakdown of system environment, OS, browser, test objectives, and sign-offs.'
    },
    {
      id: 'Type8',
      name: 'Type 8: High-Density Evidence Format',
      description: 'Variant of Type 5 tailored for high-volume evidence and compact step headers.'
    }
  ];

  res.json({
    templates,
    defaultRelease: '24R1',
    defaultProject: 'Operational Qualification',
    defaultOrg: 'Wonder Pharma',
    defaultVaultUrl: 'https://login.veevavault.com'
  });
});

// API: Parse XML metadata
app.post('/api/parse-xml', (req, res) => {
  try {
    let xmlContent = '';
    if (typeof req.body === 'string') {
      xmlContent = req.body;
    } else if (req.body && req.body.xmlContent) {
      xmlContent = req.body.xmlContent;
    }

    if (!xmlContent || xmlContent.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Empty or missing XML content' });
    }

    const metadata = webReportService.parseXmlMetadata(xmlContent);
    if (!metadata.success) {
      return res.status(400).json(metadata);
    }

    res.json(metadata);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Load sample output.xml for 1-click testing
app.get('/api/sample-xml', (req, res) => {
  try {
    const samplePath = path.join(__dirname, 'output.xml');
    if (!fs.existsSync(samplePath)) {
      return res.status(404).json({ success: false, error: 'sample output.xml not found on server' });
    }

    const xmlContent = fs.readFileSync(samplePath, 'utf8');
    const metadata = webReportService.parseXmlMetadata(xmlContent);

    res.json({
      success: true,
      filename: 'output.xml',
      sizeBytes: xmlContent.length,
      sizeFormatted: `${(xmlContent.length / (1024 * 1024)).toFixed(2)} MB`,
      metadata,
      xmlContent
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Generate PDF Report
app.post('/api/generate', async (req, res) => {
  try {
    const { xmlContent, ...options } = req.body || {};

    if (!xmlContent || xmlContent.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Missing XML content for report generation.' });
    }

    console.log(`[API /generate] Generating report with type: ${options.reportType || 'Type5'}...`);
    const result = await webReportService.generateReport(xmlContent, options);

    reportHistory.unshift({
      reportId: result.reportId,
      filename: result.filename,
      reportType: result.reportType,
      isTemplate: result.isTemplate,
      fileSizeFormatted: result.fileSizeFormatted,
      fileSizeBytes: result.fileSizeBytes,
      generatedAt: new Date().toISOString(),
      metadata: result.metadata,
      downloadUrl: result.downloadUrl,
      previewUrl: result.previewUrl
    });

    // Keep history at most 20 items
    if (reportHistory.length > 20) {
      reportHistory.pop();
    }

    res.json({
      success: true,
      report: result
    });
  } catch (err) {
    console.error('[API /generate] Error generating report:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'Dev' ? err.stack : undefined
    });
  }
});

// API: Preview PDF (inline in browser)
app.get('/api/reports/:filename/preview', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(webReportService.REPORTS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Report not found');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

// API: Download PDF
app.get('/api/reports/:filename/download', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(webReportService.REPORTS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Report not found');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

// API: History of recent reports
app.get('/api/history', (req, res) => {
  res.json({
    reports: reportHistory
  });
});

// Start HTTP Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` SQA Report Studio Web Server is running!`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Mode: ${dbConnected ? 'MongoDB Connected' : 'Standalone / Fallback'}`);
  console.log(`=======================================================`);
});
