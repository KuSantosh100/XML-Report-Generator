// SQA Report Studio Frontend Configuration
// For GitHub Pages: Set defaultApiUrl to your VM's IP/domain (e.g. 'http://192.168.1.50:1500' or 'https://api.yourdomain.com')
// You can also change the Server URL dynamically anytime directly in the web UI!

window.SQA_CONFIG = {
  // Default Backend API URL
  // If left empty '', the app uses localStorage (if saved) or falls back to 'http://localhost:1500'
  defaultApiUrl: '',

  // App version
  version: 'v3.4 Engine',

  // Defaults matching original engine
  defaultReportType: 'Type0',
  defaultProjectName: 'Operational Qualification',
  defaultOrgName: 'Wonder Pharma',
  defaultProjectType: 'LIMS'
};
