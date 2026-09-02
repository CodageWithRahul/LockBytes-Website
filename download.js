const GITHUB_RELEASE_API = 'https://api.github.com/repos/CodageWithRahul/LockBytes/releases/latest';

const elements = {
  version: document.querySelectorAll('[data-version]'),
  versionDetail: document.querySelectorAll('[data-version-detail]'),
  releaseDate: document.querySelectorAll('[data-release-date]'),
  installer: document.querySelectorAll('[data-installer]'),
  installerName: document.querySelectorAll('[data-installer-name]'),
  architecture: document.querySelectorAll('[data-architecture]'),
  size: document.querySelectorAll('[data-size]'),
  compatibility: document.querySelectorAll('[data-compatibility]'),
  downloadButton: document.querySelector('[data-download-button]'),
  downloadNote: document.querySelector('[data-download-note]'),
  checksumBox: document.querySelector('[data-checksum-box]'),
  checksum: document.querySelector('[data-checksum]'),
  checksumMessage: document.querySelector('[data-checksum-message]'),
  releaseNotes: document.querySelector('[data-release-notes]'),
  releaseHeading: document.querySelector('[data-release-heading]'),
  errorState: document.querySelector('[data-error-state]'),
  retryButton: document.querySelector('[data-retry-button]')
};

function setTextCollection(nodes, value) {
  if (!nodes || nodes.length === 0) return;

  nodes.forEach((node) => {
    if (node) node.textContent = value;
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatVersion(tag) {
  const rawTag = String(tag || '').trim();
  if (!rawTag) return 'Latest';
  return rawTag.startsWith('v') ? rawTag : `v${rawTag}`;
}

function formatReleaseDate(value) {
  if (!value) return 'Not available';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not available';
  }

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return 'Size unavailable';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function findWindowsInstaller(assets = []) {
  if (!Array.isArray(assets) || assets.length === 0) {
    return null;
  }

  const sortedAssets = [...assets].sort((a, b) => {
    const aScore = getAssetPriority(a.name || '');
    const bScore = getAssetPriority(b.name || '');
    return bScore - aScore;
  });

  return sortedAssets.find((asset) => {
    const name = (asset.name || '').toLowerCase();
    return name.endsWith('.exe') && (name.includes('setup') || name.includes('installer') || name.includes('windows') || name.includes('lockbytes'));
  }) || sortedAssets.find((asset) => (asset.name || '').toLowerCase().endsWith('.exe')) || null;
}

function getAssetPriority(name) {
  const lowerName = name.toLowerCase();
  let score = 0;

  if (lowerName.includes('setup')) score += 40;
  if (lowerName.includes('installer')) score += 35;
  if (lowerName.includes('windows')) score += 25;
  if (lowerName.includes('x64')) score += 15;
  if (lowerName.includes('64')) score += 10;
  if (lowerName.includes('lockbytes')) score += 20;
  if (lowerName.endsWith('.exe')) score += 5;

  return score;
}

function detectChecksumAsset(assets = []) {
  return (assets || []).find((asset) => {
    const name = (asset.name || '').toLowerCase();
    return /sha(256)?|checksum/.test(name) || /\.sha256$/i.test(name) || /sha256sums?\.txt$/i.test(name);
  }) || null;
}

function applyInlineMarkdown(text) {
  const escaped = escapeHtml(text || '');

  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderMarkdown(markdown) {
  if (!markdown || !markdown.trim()) {
    return '<p>No release notes were provided for this version.</p>';
  }

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraphBuffer = [];
  let listBuffer = [];
  let orderedListBuffer = [];
  let quoteBuffer = [];

  function flushParagraph() {
    if (paragraphBuffer.length > 0) {
      html.push(`<p>${applyInlineMarkdown(paragraphBuffer.join(' '))}</p>`);
      paragraphBuffer = [];
    }
  }

  function flushList(type) {
    const buffer = type === 'ordered' ? orderedListBuffer : listBuffer;
    if (buffer.length > 0) {
      const listTag = type === 'ordered' ? 'ol' : 'ul';
      html.push(`<${listTag}>${buffer.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join('')}</${listTag}>`);
      if (type === 'ordered') orderedListBuffer = []; else listBuffer = [];
    }
  }

  function flushQuote() {
    if (quoteBuffer.length > 0) {
      html.push(`<blockquote>${quoteBuffer.map((item) => applyInlineMarkdown(item)).join('<br>')}</blockquote>`);
      quoteBuffer = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList('unordered');
      flushList('ordered');
      flushQuote();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList('unordered');
      flushList('ordered');
      flushQuote();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      html.push(`<h${level}>${applyInlineMarkdown(text)}</h${level}>`);
      continue;
    }

    const listMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      flushList('ordered');
      flushQuote();
      listBuffer.push(listMatch[1].trim());
      continue;
    }

    const orderedListMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedListMatch) {
      flushParagraph();
      flushList('unordered');
      flushQuote();
      orderedListBuffer.push(orderedListMatch[1].trim());
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList('unordered');
      flushList('ordered');
      quoteBuffer.push(quoteMatch[1].trim());
      continue;
    }

    if (paragraphBuffer.length > 0) {
      paragraphBuffer.push(trimmed);
      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  flushList('unordered');
  flushList('ordered');
  flushQuote();

  return html.join('');
}

function setLoadingState() {
  setTextCollection(elements.version, 'Loading...');
  setTextCollection(elements.versionDetail, 'Loading...');
  setTextCollection(elements.releaseDate, 'Loading...');
  setTextCollection(elements.installer, 'Loading...');
  setTextCollection(elements.installerName, 'Loading...');
  setTextCollection(elements.architecture, 'Loading...');
  setTextCollection(elements.size, 'Loading...');
  setTextCollection(elements.compatibility, 'Loading...');

  if (elements.downloadButton) {
    elements.downloadButton.disabled = true;
    elements.downloadButton.setAttribute('aria-disabled', 'true');
    elements.downloadButton.setAttribute('aria-label', 'Loading latest LockBytes release');
    elements.downloadButton.textContent = 'Loading latest release...';
  }
  if (elements.downloadNote) {
    elements.downloadNote.textContent = 'Preparing the latest Windows installer...';
  }
  if (elements.releaseNotes) {
    elements.releaseNotes.innerHTML = '<p>Loading latest LockBytes release...</p>';
  }
  if (elements.releaseHeading) {
    elements.releaseHeading.textContent = 'Loading release notes...';
  }
  if (elements.checksumBox) elements.checksumBox.hidden = true;
  if (elements.checksumMessage) elements.checksumMessage.textContent = 'Checking for an available checksum...';
  if (elements.errorState) {
    elements.errorState.hidden = true;
    elements.errorState.innerHTML = '';
  }
}

function setDownloadUnavailable(message) {
  if (elements.downloadButton) {
    elements.downloadButton.disabled = true;
    elements.downloadButton.setAttribute('aria-disabled', 'true');
    elements.downloadButton.setAttribute('aria-label', message);
    elements.downloadButton.textContent = 'Download unavailable';
    elements.downloadButton.removeAttribute('href');
    elements.downloadButton.removeAttribute('download');
  }

  if (elements.downloadNote) {
    elements.downloadNote.textContent = message;
  }
}

function renderRelease(release, installer) {
  const versionText = formatVersion(release.tag_name || release.name || 'Latest');
  const dateText = formatReleaseDate(release.published_at);
  const installerName = installer.name || 'LockBytes installer';
  const installerSize = formatFileSize(installer.size || 0);
  const architectureText = /x86|32/.test((installer.name || '').toLowerCase()) ? '32-bit' : '64-bit';

  setTextCollection(elements.version, versionText);
  setTextCollection(elements.versionDetail, versionText);
  setTextCollection(elements.releaseDate, dateText);
  setTextCollection(elements.installer, 'Windows Installer');
  setTextCollection(elements.installerName, installerName);
  setTextCollection(elements.architecture, architectureText);
  setTextCollection(elements.size, installerSize);
  setTextCollection(elements.compatibility, 'Windows 10 / 11');

  if (elements.downloadButton) {
    elements.downloadButton.disabled = false;
    elements.downloadButton.setAttribute('aria-disabled', 'false');
    elements.downloadButton.setAttribute('aria-label', `Download LockBytes version ${versionText} for Windows`);
    elements.downloadButton.textContent = 'Download for Windows';
    elements.downloadButton.href = installer.browser_download_url || '#';
    elements.downloadButton.setAttribute('download', installerName);
  }

  if (elements.downloadNote) {
    elements.downloadNote.textContent = `${installerName} • ${installerSize}`;
  }

  if (elements.releaseNotes) {
    const markdown = release.body || 'No release notes were provided for this version.';
    const safeHtml = renderMarkdown(markdown);
    elements.releaseNotes.innerHTML = safeHtml;
  }

  if (elements.releaseHeading) {
    elements.releaseHeading.textContent = `What's New in ${versionText}`;
  }

  const checksumAsset = detectChecksumAsset(release.assets || []);
  if (checksumAsset && elements.checksumBox && elements.checksum && elements.checksumMessage) {
    elements.checksumBox.hidden = false;
    elements.checksum.textContent = checksumAsset.name;
    elements.checksumMessage.textContent = 'Checksum file is available for verification.';
  } else if (elements.checksumBox && elements.checksumMessage) {
    elements.checksumBox.hidden = true;
    elements.checksumMessage.textContent = 'Checksum not provided for this release.';
  }
}

function renderNoInstallerState(release) {
  const versionText = formatVersion(release?.tag_name || release?.name || 'Latest');

  setTextCollection(elements.version, versionText);
  setTextCollection(elements.versionDetail, versionText);
  setTextCollection(elements.releaseDate, formatReleaseDate(release?.published_at));
  setTextCollection(elements.installerName, 'Not available');
  setTextCollection(elements.architecture, '64-bit');
  setTextCollection(elements.size, 'Not available');
  setTextCollection(elements.compatibility, 'Windows 10 / 11');

  if (elements.releaseNotes) {
    const markdown = release?.body || 'No release notes were provided for this version.';
    elements.releaseNotes.innerHTML = renderMarkdown(markdown);
  }

  if (elements.releaseHeading) {
    elements.releaseHeading.textContent = `What's New in ${versionText}`;
  }

  setDownloadUnavailable('Windows installer is currently unavailable.');

  if (elements.downloadNote) {
    elements.downloadNote.textContent = 'Please check back later for the Windows installer.';
  }

  if (elements.checksumBox && elements.checksumMessage) {
    elements.checksumBox.hidden = true;
    elements.checksumMessage.textContent = 'Checksum not provided for this release.';
  }
}

function renderErrorState(message) {
  const errorHtml = `
    <div class="release-error-message">
      <p>${escapeHtml(message)}</p>
      <button type="button" class="button button-secondary" data-retry-button>Try again</button>
    </div>
  `;

  if (elements.errorState) {
    elements.errorState.hidden = false;
    elements.errorState.innerHTML = errorHtml;
  }

  if (elements.releaseNotes) {
    elements.releaseNotes.innerHTML = '<p>Unable to load the latest LockBytes release.</p>';
  }

  if (elements.releaseHeading) {
    elements.releaseHeading.textContent = 'Release unavailable';
  }

  if (elements.downloadButton) {
    elements.downloadButton.disabled = true;
    elements.downloadButton.setAttribute('aria-disabled', 'true');
    elements.downloadButton.setAttribute('aria-label', 'Unable to load the latest LockBytes release');
    elements.downloadButton.textContent = 'Download unavailable';
    elements.downloadButton.removeAttribute('href');
    elements.downloadButton.removeAttribute('download');
  }

  if (elements.downloadNote) {
    elements.downloadNote.textContent = 'Please try again.';
  }

  if (elements.checksumMessage) {
    elements.checksumMessage.textContent = 'Checksum information is unavailable at the moment.';
  }

  const retryButton = document.querySelector('[data-retry-button]');
  if (retryButton) {
    retryButton.addEventListener('click', () => fetchLatestRelease());
  }
}

async function fetchLatestRelease() {
  setLoadingState();

  try {
    const response = await fetch(GITHUB_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'LockBytes-Website'
      }
    });

    if (!response.ok) {
      throw new Error('Unable to load the latest LockBytes release from GitHub.');
    }

    const release = await response.json();
    if (!release || !release.tag_name) {
      throw new Error('The GitHub API did not return a published release.');
    }

    const installer = findWindowsInstaller(release.assets || []);
    if (!installer) {
      renderNoInstallerState(release);
      return;
    }

    renderRelease(release, installer);
  } catch (error) {
    renderErrorState(error && error.message ? error.message : 'Unable to load the latest LockBytes release.');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  fetchLatestRelease();
});
