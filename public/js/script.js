document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('linkForm');
    const resultSection = document.getElementById('resultSection');
    const shortUrlInput = document.getElementById('shortUrl');
    const originalDisplay = document.getElementById('originalDisplay');
    const shortCodeSpan = document.getElementById('shortCode');
    const clickCountSpan = document.getElementById('clickCount');
    const createdAtSpan = document.getElementById('createdAt');
    const expiresAtSpan = document.getElementById('expiresAt');
    const visitLink = document.getElementById('visitLink');
    const copyBtn = document.getElementById('copyBtn');
    const qrBtn = document.getElementById('qrBtn');
    const qrContainer = document.getElementById('qrContainer');
    const qrImage = document.getElementById('qrImage');
    const downloadQrBtn = document.getElementById('downloadQrBtn');
    const linkList = document.getElementById('linkList');
    const refreshBtn = document.getElementById('refreshBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const toast = document.getElementById('toast');

    let currentShortCode = '';

    // Toast helper
    function showToast(msg, isError = false) {
        toast.textContent = msg;
        toast.style.borderColor = isError ? '#ff2a5e66' : '#00f0ff66';
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // Load all links
    async function loadLinks() {
        try {
            const res = await fetch('/api/links');
            const data = await res.json();
            renderLinks(data);
        } catch (e) {
            showToast('Failed to load links', true);
        }
    }

    function renderLinks(links) {
        if (!links || links.length === 0) {
            linkList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⊡</div>
                    <p class="empty-text">No links created yet</p>
                    <p class="empty-sub">Mask your first URL above</p>
                </div>
            `;
            return;
        }
        linkList.innerHTML = links.map(link => `
            <div class="link-item">
                <div class="link-info">
                    <a href="/${link.shortCode}" target="_blank" class="link-short">${window.location.origin}/${link.shortCode}</a>
                    <div class="link-original" title="${link.originalUrl}">${link.originalUrl}</div>
                </div>
                <div class="link-meta">
                    <span>🔄 ${link.clicks || 0}</span>
                    <span>📅 ${new Date(link.createdAt).toLocaleDateString()}</span>
                    ${link.expired ? '<span class="expired">⏳ Expired</span>' : ''}
                    ${link.expiryDate ? `<span>⏱️ ${new Date(link.expiryDate).toLocaleDateString()}</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    // Submit form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const originalUrl = document.getElementById('originalUrl').value.trim();
        const customSlug = document.getElementById('customSlug').value.trim();
        const expiryDays = parseInt(document.getElementById('expiryDays').value);

        if (!originalUrl) {
            showToast('Please enter a destination URL', true);
            return;
        }

        try {
            const res = await fetch('/api/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originalUrl, customSlug, expiryDays })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create link');

            // Show result
            currentShortCode = data.shortCode;
            shortUrlInput.value = data.shortUrl;
            originalDisplay.value = data.originalUrl;
            shortCodeSpan.textContent = data.shortCode;
            clickCountSpan.textContent = '0';
            createdAtSpan.textContent = new Date(data.createdAt).toLocaleString();
            expiresAtSpan.textContent = data.expiryDate ? new Date(data.expiryDate).toLocaleString() : 'Never';
            visitLink.href = data.shortUrl;
            resultSection.style.display = 'block';
            qrContainer.style.display = 'none';

            // Clear form
            document.getElementById('customSlug').value = '';
            document.getElementById('originalUrl').value = '';

            showToast('Link created successfully!');
            loadLinks();
        } catch (err) {
            showToast(err.message || 'Something went wrong', true);
        }
    });

    // Copy
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(shortUrlInput.value).then(() => {
            showToast('Copied to clipboard!');
        }).catch(() => {
            // fallback
            shortUrlInput.select();
            document.execCommand('copy');
            showToast('Copied!');
        });
    });

    // QR Code
    qrBtn.addEventListener('click', async () => {
        if (!currentShortCode) return;
        try {
            const res = await fetch(`/api/qr/${currentShortCode}`);
            if (!res.ok) throw new Error('QR generation failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            qrImage.src = url;
            qrContainer.style.display = 'block';
            downloadQrBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = `caplink-${currentShortCode}.png`;
                a.click();
            };
        } catch (e) {
            showToast('QR error: ' + e.message, true);
        }
    });

    // Refresh
    refreshBtn.addEventListener('click', loadLinks);

    // Clear all
    clearAllBtn.addEventListener('click', async () => {
        if (!confirm('Delete all links?')) return;
        try {
            const res = await fetch('/api/links', { method: 'DELETE' });
            if (res.ok) {
                showToast('All links cleared');
                loadLinks();
                resultSection.style.display = 'none';
            }
        } catch (e) {
            showToast('Error clearing', true);
        }
    });

    // Initial load
    loadLinks();
});
