// SQA Report Studio Client Application Logic

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // State
  let activeXmlContent = null;
  let activeXmlFileName = null;
  let activeLogoBase64 = null;

  // DOM Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfoBox = document.getElementById('fileInfoBox');
  const fileBadge = document.getElementById('fileBadge');
  const fileNameEl = document.getElementById('fileName');
  const fileSizeEl = document.getElementById('fileSize');
  const clearFileBtn = document.getElementById('clearFileBtn');
  const loadSampleBtn = document.getElementById('loadSampleBtn');

  // Detected stat elements
  const detectedStatusEl = document.getElementById('detectedStatus');
  const detectedTagIdEl = document.getElementById('detectedTagId');
  const detectedScriptVersionEl = document.getElementById('detectedScriptVersion');
  const detectedScreenshotsEl = document.getElementById('detectedScreenshots');

  // Form Elements
  const reportForm = document.getElementById('reportForm');
  const generateBtn = document.getElementById('generateBtn');
  const generateBtnText = document.getElementById('generateBtnText');
  const resetFormBtn = document.getElementById('resetFormBtn');
  const reportTypeSelect = document.getElementById('reportType');
  const templateDescEl = document.getElementById('templateDescription');
  const logoInput = document.getElementById('logoInput');

  // Tabs
  const tabBtnCore = document.getElementById('tabBtnCore');
  const tabBtnOptional = document.getElementById('tabBtnOptional');
  const tabBtnMode = document.getElementById('tabBtnMode');
  const tabCoreContent = document.getElementById('tabCoreContent');
  const tabOptionalContent = document.getElementById('tabOptionalContent');
  const tabModeContent = document.getElementById('tabModeContent');

  // Output Elements
  const reportActionsCard = document.getElementById('reportActionsCard');
  const reportTitleHeader = document.getElementById('reportTitleHeader');
  const reportSizeBadge = document.getElementById('reportSizeBadge');
  const reportDurationBadge = document.getElementById('reportDurationBadge');
  const downloadReportBtn = document.getElementById('downloadReportBtn');
  const openNewTabBtn = document.getElementById('openNewTabBtn');
  const generatingProgressBox = document.getElementById('generatingProgressBox');
  const previewEmptyState = document.getElementById('previewEmptyState');
  const pdfPreviewFrame = document.getElementById('pdfPreviewFrame');
  const historyList = document.getElementById('historyList');
  const historyCountBadge = document.getElementById('historyCountBadge');
  const emptyHistoryNotice = document.getElementById('emptyHistoryNotice');

  // Status Elements
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // Theme Toggle Handler
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.theme = isDark ? 'dark' : 'light';
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });
  }

  // Template descriptions map
  const templateDescriptions = {
    Type0: 'Formal qualification protocol featuring the centered Wonder Pharma logo, Operational Qualification cover, Table of Contents, and step tables (Original Engine Format).',
    Type5: 'Standard SQA execution report with executive summary card, execution step logs, and full-page screenshots.',
    Type3: 'Features formal Version History table, landscape summary table, and step-by-step verification.',
    Type1: 'Optimized for test suites with multi-script verification and comprehensive summary tables.',
    Type4: 'Tabular form instruction matrix with user verification roles, and expected vs actual matrices.',
    Type6: 'Includes automated script suffix (-Auto), formal Reviewer Assessment checkboxes, and system attributes.',
    Type7: 'Detailed breakdown of system environment, OS, browser, test objectives, and sign-offs.',
    Type8: 'Variant of Type 5 tailored for high-volume evidence and compact step headers.'
  };

  // 1. Check System Health
  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.database && data.database.connected) {
        statusDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
        statusText.textContent = 'MongoDB Atlas Connected';
      } else {
        statusDot.className = 'w-2 h-2 rounded-full bg-blue-500';
        statusText.textContent = 'Standalone Mode (Built-in Templates)';
      }
    } catch {
      statusDot.className = 'w-2 h-2 rounded-full bg-slate-400';
      statusText.textContent = 'Local Engine Ready';
    }
  }
  checkHealth();

  // 2. Tab switching logic
  function switchTab(activeTab) {
    [tabBtnCore, tabBtnOptional, tabBtnMode].forEach(btn => {
      btn.className = 'tab-btn px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-b-2 border-transparent focus:outline-none transition-colors';
    });
    [tabCoreContent, tabOptionalContent, tabModeContent].forEach(content => {
      content.classList.add('hidden');
    });

    const activeClasses = 'tab-btn px-4 py-2 text-xs font-semibold text-brand-600 dark:text-brand-400 border-b-2 border-brand-500 dark:border-brand-400 focus:outline-none transition-colors';
    if (activeTab === 'core') {
      tabBtnCore.className = activeClasses;
      tabCoreContent.classList.remove('hidden');
    } else if (activeTab === 'optional') {
      tabBtnOptional.className = activeClasses;
      tabOptionalContent.classList.remove('hidden');
    } else if (activeTab === 'mode') {
      tabBtnMode.className = activeClasses;
      tabModeContent.classList.remove('hidden');
    }
  }

  tabBtnCore.addEventListener('click', () => switchTab('core'));
  tabBtnOptional.addEventListener('click', () => switchTab('optional'));
  tabBtnMode.addEventListener('click', () => switchTab('mode'));

  // 3. Template dropdown description updater
  reportTypeSelect.addEventListener('change', () => {
    const val = reportTypeSelect.value;
    templateDescEl.textContent = templateDescriptions[val] || 'Custom report template';
  });

  // 4. File Drag & Drop Handling
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('border-brand-500', 'bg-brand-50/50', 'dark:bg-brand-950/20');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-brand-500', 'bg-brand-50/50', 'dark:bg-brand-950/20');
    });
  });

  dropZone.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  fileInput.addEventListener('change', e => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  // Read and parse selected file
  function handleFileSelected(file) {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      alert('Please select a valid Robot Framework output.xml file.');
      return;
    }

    activeXmlFileName = file.name;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    const reader = new FileReader();
    reader.onload = async event => {
      activeXmlContent = event.target.result;
      await parseAndApplyXml(activeXmlContent, file.name);
    };
    reader.readAsText(file);
  }

  // Parse XML via server API
  async function parseAndApplyXml(xmlString, filename) {
    try {
      fileBadge.textContent = 'Parsing...';
      fileBadge.className = 'text-xs bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 px-2 py-0.5 rounded-full font-medium';
      fileBadge.classList.remove('hidden');

      const res = await fetch('/api/parse-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xmlContent: xmlString })
      });

      const meta = await res.json();
      if (!meta.success) {
        throw new Error(meta.error || 'Failed to parse XML');
      }

      applyParsedMetadata(meta);

      fileBadge.textContent = 'Parsed';
      fileBadge.className = 'text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-medium';
      fileInfoBox.classList.remove('hidden');
    } catch (err) {
      fileBadge.textContent = 'Error';
      fileBadge.className = 'text-xs bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-full font-medium';
      alert(`Could not parse XML: ${err.message}`);
    }
  }

  function applyParsedMetadata(meta) {
    const primary = meta.primaryTest || {};

    // Update status badge
    const isPass = meta.suiteStatus === 'PASS';
    detectedStatusEl.innerHTML = `
      <span class="w-2 h-2 rounded-full ${isPass ? 'bg-emerald-500' : 'bg-rose-500'} inline-block"></span>
      <span class="${isPass ? 'text-emerald-700' : 'text-rose-700'} font-bold">${meta.suiteStatus}</span>
    `;

    detectedTagIdEl.textContent = primary.tagId || 'NA';
    detectedScriptVersionEl.textContent = meta.scriptVersion || '1.0';
    detectedScreenshotsEl.textContent = `${meta.stats?.screenshotCount || 0} Screenshots`;

    // Smart prefill form fields
    if (primary.tagId) {
      document.getElementById('customTestCaseId').value = primary.tagId;
    }
    if (primary.name) {
      document.getElementById('customTestCaseName').value = primary.name;
      document.getElementById('customDescription').value = primary.name;
    }
    if (meta.scriptVersion) {
      document.getElementById('customScriptVersion').value = meta.scriptVersion;
    }
  }

  // Clear file
  clearFileBtn.addEventListener('click', () => {
    activeXmlContent = null;
    activeXmlFileName = null;
    fileInput.value = '';
    fileInfoBox.classList.add('hidden');
    fileBadge.classList.add('hidden');
  });

  // Load sample XML (1-click test button)
  loadSampleBtn.addEventListener('click', async () => {
    loadSampleBtn.disabled = true;
    loadSampleBtn.innerHTML = `
      <div class="w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      <span>Loading sample...</span>
    `;

    try {
      const res = await fetch('/api/sample-xml');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      activeXmlContent = data.xmlContent;
      activeXmlFileName = data.filename;
      fileNameEl.textContent = data.filename;
      fileSizeEl.textContent = data.sizeFormatted;

      applyParsedMetadata(data.metadata);

      fileBadge.textContent = 'Sample Loaded';
      fileBadge.className = 'text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-medium';
      fileBadge.classList.remove('hidden');
      fileInfoBox.classList.remove('hidden');
    } catch (err) {
      alert(`Could not load sample XML: ${err.message}`);
    } finally {
      loadSampleBtn.disabled = false;
      loadSampleBtn.innerHTML = `
        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-brand-600 dark:text-brand-400"></i>
        <span>Load Sample XML</span>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Handle custom logo file selection
  const logoPreviewImg = document.getElementById('logoPreviewImg');
  logoInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        activeLogoBase64 = ev.target.result;
        if (logoPreviewImg) logoPreviewImg.src = activeLogoBase64;
      };
      reader.readAsDataURL(file);
    } else {
      activeLogoBase64 = null;
      if (logoPreviewImg) logoPreviewImg.src = '/logo_Type0_template_false.jpg';
    }
  });

  // Reset form to default values
  resetFormBtn.addEventListener('click', () => {
    if (confirm('Reset form fields to default values?')) {
      reportForm.reset();
      reportTypeSelect.value = 'Type0';
      reportTypeSelect.dispatchEvent(new Event('change'));
      activeLogoBase64 = null;
      if (logoPreviewImg) logoPreviewImg.src = '/logo_Type0_template_false.jpg';
    }
  });

  // 5. Submit Form & Generate Report
  reportForm.addEventListener('submit', async e => {
    e.preventDefault();

    if (!activeXmlContent) {
      alert('Please upload an output.xml file first (or click "Load Sample XML").');
      return;
    }

    // Prepare payload
    const formData = new FormData(reportForm);
    const reportMode = document.querySelector('input[name="reportModeRadio"]:checked')?.value || 'execution';
    const isDryrun = reportMode === 'template';

    const payload = {
      xmlContent: activeXmlContent,
      reportType: formData.get('reportType') || 'Type5',
      projectName: formData.get('projectName') || 'Veeva Vault Basics LIMS',
      orgName: formData.get('orgName') || 'Spotline',
      veevaRelease: formData.get('veevaRelease') || '24R1',
      vaultName: formData.get('vaultName') || 'Spotline Vault',
      vaultEnvironment: formData.get('vaultEnvironment') || 'Development',
      veevaVaultId: formData.get('veevaVaultId') || '12345',
      vaultUrl: formData.get('vaultUrl') || 'https://login.veevavault.com',
      testerName: formData.get('testerName') || 'Automation',
      runNo: formData.get('runNo') || 'Run-01',
      batchId: formData.get('batchId') || '3',

      customTestCaseName: formData.get('customTestCaseName') || undefined,
      customTestCaseId: formData.get('customTestCaseId') || undefined,
      customScriptVersion: formData.get('customScriptVersion') || undefined,
      customDescription: formData.get('customDescription') || undefined,
      customRequirementNo: formData.get('customRequirementNo') || 'NA',
      customVassureRefNo: formData.get('customVassureRefNo') || 'NA',
      approver: formData.get('approver') || 'NA',
      qualityApprover: formData.get('qualityApprover') || 'NA',
      projectType: formData.get('projectType') || 'LIMS',

      dryrun: isDryrun,
      filterBlankPages: document.getElementById('filterBlankPages').checked,
      customLogo: activeLogoBase64
    };

    // UI state during generation
    setGeneratingState(true);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate report');
      }

      displayGeneratedReport(data.report);
      updateHistory();
    } catch (err) {
      alert(`Report Generation Error: ${err.message}`);
    } finally {
      setGeneratingState(false);
    }
  });

  function setGeneratingState(isGenerating) {
    if (isGenerating) {
      generateBtn.disabled = true;
      generateBtnText.textContent = 'Generating PDF...';
      generatingProgressBox.classList.remove('hidden');
      previewEmptyState.classList.add('hidden');
      pdfPreviewFrame.classList.add('hidden');
    } else {
      generateBtn.disabled = false;
      generateBtnText.textContent = 'Generate PDF Report';
      generatingProgressBox.classList.add('hidden');
    }
  }

  function displayGeneratedReport(report) {
    // Update Header
    reportTitleHeader.textContent = report.filename;
    reportSizeBadge.textContent = report.fileSizeFormatted;
    reportDurationBadge.textContent = `${(report.generationDurationMs / 1000).toFixed(1)}s`;

    downloadReportBtn.href = report.downloadUrl;
    downloadReportBtn.download = report.filename;
    openNewTabBtn.href = report.previewUrl;

    reportActionsCard.classList.remove('hidden');

    // Display PDF in interactive iframe
    pdfPreviewFrame.src = report.previewUrl;
    pdfPreviewFrame.classList.remove('hidden');
    previewEmptyState.classList.add('hidden');

    document.getElementById('previewPageIndicator').textContent = `${report.reportType} • ${report.fileSizeFormatted}`;
  }

  // 6. Session History
  async function updateHistory() {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      const reports = data.reports || [];

      historyCountBadge.textContent = `${reports.length} report${reports.length === 1 ? '' : 's'}`;

      if (reports.length === 0) {
        emptyHistoryNotice.classList.remove('hidden');
        historyList.innerHTML = '<p class="text-xs text-slate-400 text-center py-3">No reports generated in this session yet.</p>';
        return;
      }

      emptyHistoryNotice.classList.add('hidden');
      historyList.innerHTML = reports.map(r => `
        <div class="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-500/50 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-800 transition-all text-xs">
          <div class="flex items-center space-x-2.5 overflow-hidden">
            <i data-lucide="file-text" class="w-4 h-4 text-corp-600 dark:text-corp-400 flex-shrink-0"></i>
            <div class="truncate">
              <span class="font-semibold text-slate-800 dark:text-slate-200 truncate block">${r.filename}</span>
              <span class="text-[10px] text-slate-400 dark:text-slate-500">${r.reportType} • ${r.fileSizeFormatted} • ${new Date(r.generatedAt).toLocaleTimeString()}</span>
            </div>
          </div>
          <div class="flex items-center space-x-1.5 flex-shrink-0">
            <button onclick="previewSpecificReport('${r.previewUrl}', '${r.filename}', '${r.fileSizeFormatted}')" class="text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors" title="Preview in frame">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            </button>
            <a href="${r.downloadUrl}" download="${r.filename}" class="text-corp-600 dark:text-corp-400 hover:text-corp-700 dark:hover:text-corp-300 p-1.5 rounded-lg hover:bg-corp-50 dark:hover:bg-corp-950/40 transition-colors" title="Download PDF">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
            </a>
          </div>
        </div>
      `).join('');

      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      console.error('Error updating history:', e);
    }
  }

  // Global function for previewing from history
  window.previewSpecificReport = (previewUrl, filename, sizeFormatted) => {
    pdfPreviewFrame.src = previewUrl;
    pdfPreviewFrame.classList.remove('hidden');
    previewEmptyState.classList.add('hidden');

    reportTitleHeader.textContent = filename;
    reportSizeBadge.textContent = sizeFormatted;
    downloadReportBtn.href = `/api/reports/${filename}/download`;
    downloadReportBtn.download = filename;
    openNewTabBtn.href = previewUrl;
    reportActionsCard.classList.remove('hidden');
  };
});
