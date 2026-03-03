/**
 * GitHub Issue Manager — Frontend Application
 * Single-file vanilla JS SPA with hash routing, state management, and API client.
 */

// ============================================================================
// API Client
// ============================================================================
const API = {
    async request(path, options = {}) {
        const { method = 'GET', body } = options;
        const config = { method, headers: {} };
        if (body) {
            config.headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(body);
        }
        try {
            const resp = await fetch(path, config);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.message || data.error || `HTTP ${resp.status}`);
            return data;
        } catch (err) {
            Toast.show(err.message, 'error');
            throw err;
        }
    },
    getSettings: () => API.request('/api/settings'),
    saveSettings: (s) => API.request('/api/settings', { method: 'POST', body: s }),
    testGitHub: (b) => API.request('/api/settings/test-github', { method: 'POST', body: b }),
    testAI: (b) => API.request('/api/settings/test-ai', { method: 'POST', body: b }),
    getIssues: (params) => API.request(`/api/issues?${new URLSearchParams(params)}`),
    getIssueDetail: (num) => API.request(`/api/issues/${num}`),
    getLabels: () => API.request('/api/labels'),
    getMyIssues: (params) => API.request(`/api/my-issues?${new URLSearchParams(params)}`),
    getStats: () => API.request('/api/stats'),
    aiGenerate: (b) => API.request('/api/ai/generate-reply', { method: 'POST', body: b }),
    postComment: (num, body) => API.request(`/api/issues/${num}/comments`, { method: 'POST', body: { body } }),
    patchIssue: (num, b) => API.request(`/api/issues/${num}`, { method: 'PATCH', body: b }),
};

// ============================================================================
// Toast Notifications
// ============================================================================
const Toast = {
    container: null,
    init() { this.container = document.getElementById('toastContainer'); },
    show(message, type = 'info', duration = 4000) {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<span>${this._escapeHtml(message)}</span>`;
        this.container.appendChild(el);
        setTimeout(() => {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 300);
        }, duration);
    },
    _escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
};

// ============================================================================
// Utility Functions
// ============================================================================
function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

function renderMarkdown(text) {
    if (!text) return '';
    try {
        return marked.parse(text, { breaks: true, gfm: true });
    } catch {
        return escapeHtml(text);
    }
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

function labelStyle(color) {
    const hex = color.startsWith('#') ? color : `#${color}`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const textColor = luminance > 0.5 ? '#000' : '#fff';
    return `background-color: ${hex}; color: ${textColor};`;
}

function issueStatusIcon(state) {
    if (state === 'open') {
        return `<svg class="status-icon open" viewBox="0 0 16 16" fill="currentColor" width="20" height="20">
            <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
        </svg>`;
    }
    return `<svg class="status-icon closed" viewBox="0 0 16 16" fill="currentColor" width="20" height="20">
        <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z"/>
        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"/>
    </svg>`;
}

function sinceDate(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
}

// ============================================================================
// Router
// ============================================================================
const Router = {
    routes: {},
    current: '',
    register(name, handler) { this.routes[name] = handler; },
    navigate(hash) {
        window.location.hash = hash;
    },
    init() {
        window.addEventListener('hashchange', () => this._handleRoute());
        this._handleRoute();
    },
    _handleRoute() {
        const hash = window.location.hash.slice(1) || 'dashboard';
        const page = hash.split('/')[0];
        if (this.routes[page]) {
            this.current = page;
            this._updateNavLinks(page);
            this.routes[page]();
        } else {
            this.navigate('dashboard');
        }
    },
    _updateNavLinks(page) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });
    }
};

// ============================================================================
// State
// ============================================================================
const State = {
    settings: null,
    currentRepo: 'apache/doris',
    labels: [],
    async loadSettings() {
        try {
            this.settings = await API.getSettings();
            this.currentRepo = this.settings.current_repo || 'apache/doris';
            this._updateRepoSelector();
        } catch { /* ignore on first load */ }
    },
    _updateRepoSelector() {
        const select = document.getElementById('repoSelect');
        if (!this.settings || !this.settings.repos) return;
        select.innerHTML = '';
        for (const repo of this.settings.repos) {
            const opt = document.createElement('option');
            opt.value = repo;
            opt.textContent = repo;
            opt.selected = repo === this.currentRepo;
            select.appendChild(opt);
        }
    }
};

// ============================================================================
// Main Content Helper
// ============================================================================
function setContent(html) {
    document.getElementById('mainContent').innerHTML = html;
}

function showLoading() {
    setContent(`<div class="loading"><div class="spinner"></div><span>Loading...</span></div>`);
}

// ============================================================================
// Dashboard Page
// ============================================================================
async function renderDashboard() {
    showLoading();
    try {
        const stats = await API.getStats();
        let html = `
            <div class="page-header">
                <h1 class="page-title">Dashboard</h1>
                <p class="page-subtitle">Overview of ${escapeHtml(State.currentRepo)}</p>
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.open_count || 0}</div>
                    <div class="stat-label">Open Issues</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.unanswered_count || 0}</div>
                    <div class="stat-label">Unanswered Issues</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${(stats.recent_issues || []).length}</div>
                    <div class="stat-label">Updated This Week</div>
                </div>
            </div>`;

        // Unanswered issues
        if (stats.unanswered_issues && stats.unanswered_issues.length > 0) {
            html += `<div class="card" style="margin-bottom:var(--space-6)">
                <div class="card-header">
                    <h2 class="card-title">⚡ Unanswered Issues</h2>
                </div>
                <div class="issue-list">
                    ${stats.unanswered_issues.map(renderIssueCard).join('')}
                </div>
            </div>`;
        }

        // Recent issues
        if (stats.recent_issues && stats.recent_issues.length > 0) {
            html += `<div class="card">
                <div class="card-header">
                    <h2 class="card-title">🕐 Recently Updated</h2>
                </div>
                <div class="issue-list">
                    ${stats.recent_issues.map(renderIssueCard).join('')}
                </div>
            </div>`;
        }

        setContent(html);
        bindIssueCardClicks();
    } catch (err) {
        setContent(`<div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p>Failed to load dashboard. Please check your settings.</p>
            <a href="#settings" class="btn btn-primary">Go to Settings</a>
        </div>`);
    }
}

// ============================================================================
// Issues Page
// ============================================================================
let issuesState = { page: 1, state: 'open', sort: 'updated', direction: 'desc', since: '', labels: '', q: '' };

async function renderIssuesPage() {
    showLoading();
    // Load labels once
    if (State.labels.length === 0) {
        try { State.labels = await API.getLabels(); } catch { /* ignore */ }
    }
    await fetchAndRenderIssues();
}

async function fetchAndRenderIssues() {
    const params = {
        state: issuesState.state,
        sort: issuesState.sort,
        direction: issuesState.direction,
        page: issuesState.page,
        per_page: 20,
    };
    if (issuesState.since) params.since = sinceDate(parseInt(issuesState.since));
    if (issuesState.labels) params.labels = issuesState.labels;
    if (issuesState.q) params.q = issuesState.q;

    let html = `
        <div class="page-header">
            <h1 class="page-title">Issues</h1>
            <p class="page-subtitle">${escapeHtml(State.currentRepo)}</p>
        </div>

        <div class="filter-bar">
            <div class="filter-group">
                <label class="filter-label">Status:</label>
                <select class="filter-select" id="filterState" onchange="onFilterChange()">
                    <option value="open" ${issuesState.state === 'open' ? 'selected' : ''}>Open</option>
                    <option value="closed" ${issuesState.state === 'closed' ? 'selected' : ''}>Closed</option>
                    <option value="all" ${issuesState.state === 'all' ? 'selected' : ''}>All</option>
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">Updated:</label>
                <select class="filter-select" id="filterSince" onchange="onFilterChange()">
                    <option value="" ${!issuesState.since ? 'selected' : ''}>Any time</option>
                    <option value="1" ${issuesState.since === '1' ? 'selected' : ''}>Last 24h</option>
                    <option value="3" ${issuesState.since === '3' ? 'selected' : ''}>Last 3 days</option>
                    <option value="7" ${issuesState.since === '7' ? 'selected' : ''}>Last 7 days</option>
                    <option value="30" ${issuesState.since === '30' ? 'selected' : ''}>Last 30 days</option>
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">Sort:</label>
                <select class="filter-select" id="filterSort" onchange="onFilterChange()">
                    <option value="updated" ${issuesState.sort === 'updated' ? 'selected' : ''}>Updated</option>
                    <option value="created" ${issuesState.sort === 'created' ? 'selected' : ''}>Created</option>
                    <option value="comments" ${issuesState.sort === 'comments' ? 'selected' : ''}>Comments</option>
                </select>
            </div>
            <div class="search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" id="searchInput" placeholder="Search issues..." value="${escapeHtml(issuesState.q)}" onkeydown="if(event.key==='Enter')onSearchSubmit()">
            </div>
        </div>`;

    try {
        const data = await API.getIssues(params);
        const issues = data.items || [];
        if (issues.length === 0) {
            html += `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M9 9h.01M15 9h.01"/></svg>
                <p>No issues found</p>
            </div>`;
        } else {
            html += `<div class="issue-list">${issues.map(renderIssueCard).join('')}</div>`;
        }

        // Pagination
        const pagination = data.pagination || {};
        html += `<div class="pagination">
            <button class="btn btn-secondary btn-sm" ${!pagination.prev ? 'disabled' : ''} onclick="onPageChange(${issuesState.page - 1})">← Previous</button>
            <span class="page-info">Page ${issuesState.page}</span>
            <button class="btn btn-secondary btn-sm" ${!pagination.next ? 'disabled' : ''} onclick="onPageChange(${issuesState.page + 1})">Next →</button>
        </div>`;

        setContent(html);
        bindIssueCardClicks();
    } catch (err) {
        html += `<div class="empty-state"><p>Failed to load issues</p></div>`;
        setContent(html);
    }
}

function onFilterChange() {
    issuesState.state = document.getElementById('filterState').value;
    issuesState.since = document.getElementById('filterSince').value;
    issuesState.sort = document.getElementById('filterSort').value;
    issuesState.page = 1;
    fetchAndRenderIssues();
}

function onSearchSubmit() {
    issuesState.q = document.getElementById('searchInput').value.trim();
    issuesState.page = 1;
    fetchAndRenderIssues();
}

function onPageChange(page) {
    if (page < 1) return;
    issuesState.page = page;
    fetchAndRenderIssues();
}

// ============================================================================
// My Issues Page
// ============================================================================
let myIssuesState = { type: 'mentioned', page: 1 };

async function renderMyIssuesPage() {
    showLoading();
    await fetchAndRenderMyIssues();
}

async function fetchAndRenderMyIssues() {
    const username = State.settings?.github_username;

    let html = `
        <div class="page-header">
            <h1 class="page-title">My Issues</h1>
            <p class="page-subtitle">Issues related to you in ${escapeHtml(State.currentRepo)}</p>
        </div>`;

    if (!username) {
        html += `<div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <p>Please configure your GitHub username in Settings first.</p>
            <a href="#settings" class="btn btn-primary">Go to Settings</a>
        </div>`;
        setContent(html);
        return;
    }

    html += `
        <div class="tabs">
            <button class="tab ${myIssuesState.type === 'mentioned' ? 'active' : ''}" onclick="switchMyIssuesTab('mentioned')">@ Mentioned</button>
            <button class="tab ${myIssuesState.type === 'assigned' ? 'active' : ''}" onclick="switchMyIssuesTab('assigned')">Assigned</button>
            <button class="tab ${myIssuesState.type === 'created' ? 'active' : ''}" onclick="switchMyIssuesTab('created')">Created</button>
            <button class="tab ${myIssuesState.type === 'commented' ? 'active' : ''}" onclick="switchMyIssuesTab('commented')">Commented</button>
        </div>`;

    try {
        const data = await API.getMyIssues({ type: myIssuesState.type, page: myIssuesState.page, per_page: 20 });
        const issues = data.items || [];
        const total = data.total_count || 0;

        if (issues.length === 0) {
            html += `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M9 9h.01M15 9h.01"/></svg>
                <p>No issues found for this filter</p>
            </div>`;
        } else {
            html += `<p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-4)">${total} issue${total !== 1 ? 's' : ''} found</p>`;
            html += `<div class="issue-list">${issues.map(renderIssueCard).join('')}</div>`;
        }

        // Pagination
        const pagination = data.pagination || {};
        html += `<div class="pagination">
            <button class="btn btn-secondary btn-sm" ${myIssuesState.page <= 1 ? 'disabled' : ''} onclick="onMyIssuesPageChange(${myIssuesState.page - 1})">← Previous</button>
            <span class="page-info">Page ${myIssuesState.page}</span>
            <button class="btn btn-secondary btn-sm" ${!pagination.next ? 'disabled' : ''} onclick="onMyIssuesPageChange(${myIssuesState.page + 1})">Next →</button>
        </div>`;

        setContent(html);
        bindIssueCardClicks();
    } catch (err) {
        html += `<div class="empty-state"><p>Failed to load issues</p></div>`;
        setContent(html);
    }
}

function switchMyIssuesTab(type) {
    myIssuesState.type = type;
    myIssuesState.page = 1;
    fetchAndRenderMyIssues();
}

function onMyIssuesPageChange(page) {
    if (page < 1) return;
    myIssuesState.page = page;
    fetchAndRenderMyIssues();
}

// ============================================================================
// Settings Page
// ============================================================================
async function renderSettingsPage() {
    showLoading();
    try {
        State.settings = await API.getSettings();
    } catch { /* use whatever we have */ }

    const s = State.settings || {};

    setContent(`
        <div class="page-header">
            <h1 class="page-title">Settings</h1>
            <p class="page-subtitle">Configure your GitHub and AI settings</p>
        </div>

        <!-- GitHub Settings -->
        <div class="settings-section">
            <h2 class="settings-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                GitHub Configuration
            </h2>

            <div class="form-group">
                <label class="form-label">Personal Access Token</label>
                <div class="password-input">
                    <input type="password" class="form-input" id="githubToken"
                        value="${escapeHtml(s.github_token || '')}" placeholder="ghp_xxxxxxxxxxxx">
                    <button class="password-toggle" onclick="togglePassword('githubToken')">👁</button>
                </div>
                <p class="form-hint">Generate at GitHub → Settings → Developer settings → Personal access tokens</p>
            </div>

            <div class="form-group">
                <label class="form-label">GitHub Username</label>
                <input type="text" class="form-input" id="githubUsername"
                    value="${escapeHtml(s.github_username || '')}" placeholder="your-username">
                <p class="form-hint">Used for "My Issues" filtering (mentions, assigned, etc.)</p>
            </div>

            <div class="form-group">
                <label class="form-label">Repositories (one per line, owner/repo format)</label>
                <textarea class="form-textarea" id="repos" rows="3" style="font-family:var(--font-mono)"
                    placeholder="apache/doris">${(s.repos || ['apache/doris']).join('\n')}</textarea>
            </div>

            <div class="form-group">
                <label class="form-label">Default Repository</label>
                <input type="text" class="form-input" id="currentRepo"
                    value="${escapeHtml(s.current_repo || 'apache/doris')}" placeholder="apache/doris">
            </div>

            <div style="display:flex;gap:var(--space-3)">
                <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
                <button class="btn btn-secondary" onclick="testGitHub()">Test GitHub Connection</button>
            </div>

            <div class="test-result" id="githubTestResult"></div>
        </div>

        <!-- AI Settings -->
        <div class="settings-section">
            <h2 class="settings-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 2a4 4 0 0 1 4 4v2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z"/></svg>
                AI / LLM Configuration
            </h2>

            <div class="form-group">
                <label class="form-label">API Key</label>
                <div class="password-input">
                    <input type="password" class="form-input" id="aiApiKey"
                        value="${escapeHtml(s.ai_api_key || '')}" placeholder="sk-xxxxxxxxxxxx">
                    <button class="password-toggle" onclick="togglePassword('aiApiKey')">👁</button>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Base URL</label>
                    <input type="text" class="form-input" id="aiBaseUrl"
                        value="${escapeHtml(s.ai_base_url || 'https://api.openai.com/v1')}"
                        placeholder="https://api.openai.com/v1">
                    <p class="form-hint">OpenAI / DeepSeek / Ollama compatible endpoint</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Model</label>
                    <input type="text" class="form-input" id="aiModel"
                        value="${escapeHtml(s.ai_model || 'gpt-4o')}" placeholder="gpt-4o">
                </div>
            </div>

            <div style="display:flex;gap:var(--space-3)">
                <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
                <button class="btn btn-secondary" onclick="testAI()">Test AI Connection</button>
            </div>

            <div class="test-result" id="aiTestResult"></div>
        </div>
    `);
}

function togglePassword(id) {
    const input = document.getElementById(id);
    input.type = input.type === 'password' ? 'text' : 'password';
}

async function saveSettings() {
    const repos = document.getElementById('repos').value.split('\n').map(r => r.trim()).filter(Boolean);
    const settings = {
        github_token: document.getElementById('githubToken').value,
        github_username: document.getElementById('githubUsername').value.trim(),
        repos,
        current_repo: document.getElementById('currentRepo').value.trim(),
        ai_api_key: document.getElementById('aiApiKey').value,
        ai_base_url: document.getElementById('aiBaseUrl').value.trim(),
        ai_model: document.getElementById('aiModel').value.trim(),
    };

    try {
        const result = await API.saveSettings(settings);
        State.settings = result.settings;
        State.currentRepo = settings.current_repo;
        State._updateRepoSelector();
        Toast.show('Settings saved successfully!', 'success');
    } catch (err) {
        // Toast already shown by API client
    }
}

async function testGitHub() {
    const resultEl = document.getElementById('githubTestResult');
    resultEl.className = 'test-result';
    resultEl.style.display = 'block';
    resultEl.textContent = 'Testing...';

    try {
        const token = document.getElementById('githubToken').value;
        const result = await API.testGitHub({ github_token: token });
        resultEl.className = 'test-result success';
        resultEl.textContent = `✓ Connected as ${result.user} (${result.name || ''})`;
    } catch (err) {
        resultEl.className = 'test-result error';
        resultEl.textContent = `✗ Connection failed: ${err.message}`;
    }
}

async function testAI() {
    const resultEl = document.getElementById('aiTestResult');
    resultEl.className = 'test-result';
    resultEl.style.display = 'block';
    resultEl.textContent = 'Testing...';

    try {
        const result = await API.testAI({
            ai_api_key: document.getElementById('aiApiKey').value,
            ai_base_url: document.getElementById('aiBaseUrl').value,
            ai_model: document.getElementById('aiModel').value,
        });
        resultEl.className = 'test-result success';
        resultEl.textContent = `✓ ${result.message}`;
    } catch (err) {
        resultEl.className = 'test-result error';
        resultEl.textContent = `✗ Connection failed: ${err.message}`;
    }
}

// ============================================================================
// Issue Card Component
// ============================================================================
function renderIssueCard(issue) {
    const labels = (issue.labels || []).map(l =>
        `<span class="label-badge" style="${labelStyle(l.color)}">${escapeHtml(l.name)}</span>`
    ).join('');

    const user = issue.user || {};
    const commentsCount = issue.comments || 0;

    return `
        <div class="issue-card" data-issue-number="${issue.number}" style="animation-delay: ${Math.random() * 0.1}s">
            ${issueStatusIcon(issue.state)}
            <div class="issue-card-body">
                <div class="issue-card-title">
                    <span>${escapeHtml(issue.title)}</span>
                    <span class="issue-number">#${issue.number}</span>
                </div>
                <div class="issue-card-meta">
                    <span class="author">
                        <img src="${user.avatar_url || ''}" alt="" loading="lazy">
                        ${escapeHtml(user.login || 'unknown')}
                    </span>
                    <span>updated ${timeAgo(issue.updated_at)}</span>
                    <span>opened ${timeAgo(issue.created_at)}</span>
                </div>
                ${labels ? `<div class="issue-card-labels">${labels}</div>` : ''}
            </div>
            ${commentsCount > 0 ? `
                <div class="comment-count">
                    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                        <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
                    </svg>
                    ${commentsCount}
                </div>
            ` : ''}
        </div>`;
}

function bindIssueCardClicks() {
    document.querySelectorAll('.issue-card').forEach(card => {
        card.addEventListener('click', () => {
            const number = card.dataset.issueNumber;
            openIssueDetail(number);
        });
    });
}

// ============================================================================
// Issue Detail Panel
// ============================================================================
async function openIssueDetail(number) {
    const panel = document.getElementById('detailPanel');
    const overlay = document.getElementById('overlay');
    const content = document.getElementById('detailPanelContent');

    content.innerHTML = `<div class="loading"><div class="spinner"></div><span>Loading issue #${number}...</span></div>`;
    panel.classList.add('active');
    overlay.classList.add('active');

    try {
        const data = await API.getIssueDetail(number);
        const issue = data.issue;
        const comments = data.comments || [];
        const labels = (issue.labels || []).map(l =>
            `<span class="label-badge" style="${labelStyle(l.color)}">${escapeHtml(l.name)}</span>`
        ).join('');

        let html = `
            <div class="detail-header">
                <div>
                    <h2 class="detail-title">
                        ${escapeHtml(issue.title)}
                        <span class="issue-number">#${issue.number}</span>
                    </h2>
                    <div style="display:flex;align-items:center;gap:var(--space-2);margin-top:var(--space-2)">
                        ${issueStatusIcon(issue.state)}
                        <span style="color:var(--text-secondary);font-size:var(--font-size-sm)">
                            ${escapeHtml(issue.user?.login || '')} opened ${timeAgo(issue.created_at)}
                            · ${comments.length} comment${comments.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    ${labels ? `<div class="issue-card-labels" style="margin-top:var(--space-2)">${labels}</div>` : ''}
                </div>
                <button class="btn btn-icon" onclick="closeDetail()" title="Close (Esc)">✕</button>
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions">
                <a href="${issue.html_url}" target="_blank" class="btn btn-secondary btn-sm">
                    Open on GitHub ↗
                </a>
                ${issue.state === 'open' ?
                    `<button class="btn btn-danger btn-sm" onclick="closeIssue(${issue.number})">Close Issue</button>` :
                    `<button class="btn btn-success btn-sm" onclick="reopenIssue(${issue.number})">Reopen Issue</button>`
                }
            </div>

            <!-- Issue Body -->
            <div class="detail-body" style="margin-top:var(--space-6)">
                ${renderMarkdown(issue.body)}
            </div>

            <!-- Comments -->
            <div class="comments-section">
                <h3>💬 Comments (${comments.length})</h3>
                ${comments.map(c => `
                    <div class="comment-item">
                        <div class="comment-avatar">
                            <img src="${c.user?.avatar_url || ''}" alt="" loading="lazy">
                        </div>
                        <div class="comment-box">
                            <div class="comment-header">
                                <span class="username">${escapeHtml(c.user?.login || 'unknown')}</span>
                                <span class="time">commented ${timeAgo(c.created_at)}</span>
                            </div>
                            <div class="comment-body">${renderMarkdown(c.body)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- AI Reply Panel -->
            <div class="ai-panel">
                <div class="ai-panel-header">
                    <div class="ai-panel-title">
                        <span class="spark">✨</span> AI Reply Assistant
                    </div>
                    <button class="btn btn-primary btn-sm" id="aiGenerateBtn" onclick="generateAIReply(${issue.number})">
                        Generate Reply
                    </button>
                </div>
                <textarea class="ai-reply-editor" id="aiReplyEditor" placeholder="AI-generated reply will appear here. You can edit it before posting."></textarea>
                <div class="ai-panel-actions">
                    <button class="btn btn-secondary btn-sm" onclick="document.getElementById('aiReplyEditor').value=''">Clear</button>
                    <button class="btn btn-success" id="postCommentBtn" onclick="postAIComment(${issue.number})">
                        Post Comment to GitHub
                    </button>
                </div>
            </div>`;

        content.innerHTML = html;

        // Store current issue data for AI generation
        panel._currentIssue = { issue, comments };

    } catch (err) {
        content.innerHTML = `<div class="empty-state"><p>Failed to load issue</p></div>`;
    }
}

function closeDetail() {
    document.getElementById('detailPanel').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

async function closeIssue(number) {
    try {
        await API.patchIssue(number, { state: 'closed' });
        Toast.show('Issue closed', 'success');
        openIssueDetail(number); // Refresh
    } catch { /* handled */ }
}

async function reopenIssue(number) {
    try {
        await API.patchIssue(number, { state: 'open' });
        Toast.show('Issue reopened', 'success');
        openIssueDetail(number); // Refresh
    } catch { /* handled */ }
}

async function generateAIReply(number) {
    const btn = document.getElementById('aiGenerateBtn');
    const editor = document.getElementById('aiReplyEditor');
    btn.disabled = true;
    btn.textContent = 'Generating...';
    editor.value = 'Generating AI reply, please wait...';

    try {
        const panel = document.getElementById('detailPanel');
        const { issue, comments } = panel._currentIssue;
        const result = await API.aiGenerate({
            title: issue.title,
            body: issue.body,
            labels: (issue.labels || []).map(l => l.name),
            comments: comments,
        });
        editor.value = result.reply || '';
        Toast.show('AI reply generated! Review and edit before posting.', 'success');
    } catch (err) {
        editor.value = '';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Reply';
    }
}

async function postAIComment(number) {
    const editor = document.getElementById('aiReplyEditor');
    const body = editor.value.trim();
    if (!body) {
        Toast.show('Comment body is empty', 'warning');
        return;
    }

    const btn = document.getElementById('postCommentBtn');
    btn.disabled = true;
    btn.textContent = 'Posting...';

    try {
        await API.postComment(number, body);
        Toast.show('Comment posted successfully!', 'success');
        editor.value = '';
        // Refresh detail to show new comment
        openIssueDetail(number);
    } catch { /* handled */ } finally {
        btn.disabled = false;
        btn.textContent = 'Post Comment to GitHub';
    }
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================
document.addEventListener('keydown', (e) => {
    // Esc: close detail panel
    if (e.key === 'Escape') {
        closeDetail();
        return;
    }

    // Don't trigger shortcuts when typing in inputs
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    // j/k: navigate issues
    const cards = document.querySelectorAll('.issue-card');
    if (cards.length === 0) return;

    const focused = document.querySelector('.issue-card.focused');
    let idx = focused ? Array.from(cards).indexOf(focused) : -1;

    if (e.key === 'j') {
        idx = Math.min(idx + 1, cards.length - 1);
    } else if (e.key === 'k') {
        idx = Math.max(idx - 1, 0);
    } else if (e.key === 'Enter' && focused) {
        focused.click();
        return;
    } else {
        return;
    }

    cards.forEach(c => c.classList.remove('focused'));
    cards[idx].classList.add('focused');
    cards[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

// ============================================================================
// Repo Selector
// ============================================================================
document.getElementById('repoSelect').addEventListener('change', (e) => {
    State.currentRepo = e.target.value;
    // Save to backend
    API.saveSettings({ current_repo: State.currentRepo }).catch(() => {});
    // Re-render current page
    const handler = Router.routes[Router.current];
    if (handler) handler();
});

// Overlay click to close
document.getElementById('overlay').addEventListener('click', closeDetail);

// ============================================================================
// Initialize App
// ============================================================================
async function initApp() {
    Toast.init();

    // Load settings
    await State.loadSettings();

    // Register routes
    Router.register('dashboard', renderDashboard);
    Router.register('issues', renderIssuesPage);
    Router.register('my-issues', renderMyIssuesPage);
    Router.register('settings', renderSettingsPage);

    // Start router
    Router.init();
}

// Boot
initApp();
