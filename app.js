/**
 * GitHub Issue Manager — Frontend Application
 * Single-file vanilla JS SPA with hash routing, state management, and API client.
 */

// ============================================================================
// Theme Manager
// ============================================================================
const ThemeManager = {
    _key: 'theme',
    init() {
        const saved = localStorage.getItem(this._key);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'light');
        this._apply(theme);
        // Listen for system theme changes when no explicit preference
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(this._key)) {
                this._apply(e.matches ? 'dark' : 'light');
            }
        });
        // Bind toggle button
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggle());
    },
    toggle() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        // Add transition class for smooth animation
        document.documentElement.classList.add('theme-transitioning');
        this._apply(next);
        localStorage.setItem(this._key, next);
        // Remove transition class after animation completes
        setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 500);
    },
    _apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        // Update icons
        const sunIcon = document.getElementById('themeIconSun');
        const moonIcon = document.getElementById('themeIconMoon');
        if (sunIcon && moonIcon) {
            sunIcon.style.display = theme === 'dark' ? '' : 'none';
            moonIcon.style.display = theme === 'light' ? '' : 'none';
        }
    }
};

// Apply theme ASAP (before DOMContentLoaded) to avoid flash
(function () {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', saved || (prefersDark ? 'dark' : 'light'));
})();

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
    aiSummarize: (b) => API.request('/api/ai/summarize', { method: 'POST', body: b }),
    aiChat: (b) => API.request('/api/ai/chat', { method: 'POST', body: b }),
    postComment: (num, body) => API.request(`/api/issues/${num}/comments`, { method: 'POST', body: { body } }),
    patchIssue: (num, b) => API.request(`/api/issues/${num}`, { method: 'PATCH', body: b }),
    getDashboardIssues: (days) => API.request(`/api/dashboard-issues?days=${days || 7}`),
    getStarred: () => API.request('/api/starred'),
    starIssue: (num) => API.request('/api/starred', { method: 'POST', body: { number: num } }),
    unstarIssue: (num) => API.request('/api/starred', { method: 'DELETE', body: { number: num } }),
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
let dashboardState = {
    tab: 'top',          // 'top' or 'starred'
    days: 3,             // 3 or 7 — time range for top issues
    topIssues: [],
    starredIssues: [],
    starredNumbers: [],
    dismissed: new Set(), // session-only dismissed issue numbers
    summaries: {},        // number -> summary text
};

async function renderDashboard() {
    showLoading();
    try {
        const data = await API.getDashboardIssues(dashboardState.days);
        dashboardState.topIssues = data.items || [];
        dashboardState.starredNumbers = data.starred || [];

        renderDashboardContent();
    } catch (err) {
        setContent(`<div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p>Failed to load dashboard. Please check your settings.</p>
            <a href="#settings" class="btn btn-primary">Go to Settings</a>
        </div>`);
    }
}

function renderDashboardContent() {
    const topCount = dashboardState.topIssues.filter(i => !dashboardState.dismissed.has(i.number)).length;
    const starredCount = dashboardState.starredNumbers.length;

    let html = `
        <div class="page-header">
            <h1 class="page-title">Dashboard</h1>
            <p class="page-subtitle">High-value issue triage for ${escapeHtml(State.currentRepo)}</p>
        </div>

        <div class="dashboard-stats-bar">
            <div class="dash-stat"><span class="dash-stat-value">${topCount}</span><span class="dash-stat-label">Top Issues</span></div>
            <div class="dash-stat"><span class="dash-stat-value">${starredCount}</span><span class="dash-stat-label">Starred</span></div>
        </div>

        <div class="dashboard-toolbar">
            <div class="dashboard-tabs">
                <button class="dashboard-tab ${dashboardState.tab === 'top' ? 'active' : ''}" onclick="switchDashboardTab('top')">
                    🔥 Top Issues
                </button>
                <button class="dashboard-tab ${dashboardState.tab === 'starred' ? 'active' : ''}" onclick="switchDashboardTab('starred')">
                    ⭐ Starred <span class="tab-count">${starredCount}</span>
                </button>
            </div>
            <div class="dashboard-actions">
                ${dashboardState.tab === 'top' ? `
                    <div class="days-toggle">
                        <button class="days-toggle-btn ${dashboardState.days === 3 ? 'active' : ''}" onclick="switchDashboardDays(3)">3 天</button>
                        <button class="days-toggle-btn ${dashboardState.days === 7 ? 'active' : ''}" onclick="switchDashboardDays(7)">7 天</button>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="batchSummaryBtn" onclick="batchAISummary()">
                        🤖 Batch Summary
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="refreshDashboard()">
                        🔄 Refresh
                    </button>
                ` : ''}
            </div>
        </div>`;

    if (dashboardState.tab === 'top') {
        const issues = dashboardState.topIssues.filter(i => !dashboardState.dismissed.has(i.number));
        if (issues.length === 0) {
            html += `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M9 9h.01M15 9h.01"/></svg>
                <p>No high-value issues found right now</p>
            </div>`;
        } else {
            html += `<div class="issue-list">${issues.map(i => renderDashboardIssueCard(i)).join('')}</div>`;
        }
    } else {
        // Starred tab
        if (dashboardState.starredIssues.length > 0) {
            html += `<div class="issue-list">${dashboardState.starredIssues.map(i => renderDashboardIssueCard(i, true)).join('')}</div>`;
        } else if (starredCount > 0) {
            html += `<div class="loading"><div class="spinner"></div><span>Loading starred issues...</span></div>`;
        } else {
            html += `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <p>No starred issues yet. Star issues from the Top Issues tab!</p>
            </div>`;
        }
    }

    setContent(html);
    bindIssueCardClicks();

    // If on starred tab and we need to fetch starred issue details
    if (dashboardState.tab === 'starred' && starredCount > 0 && dashboardState.starredIssues.length === 0) {
        loadStarredIssues();
    }
}

function renderDashboardIssueCard(issue, isStarredTab = false) {
    const labels = (issue.labels || []).map(l =>
        `<span class="label-badge" style="${labelStyle(l.color)}">${escapeHtml(l.name)}</span>`
    ).join('');
    const user = issue.user || {};
    const commentsCount = issue.comments || 0;
    const isStarred = dashboardState.starredNumbers.includes(issue.number);
    const summary = dashboardState.summaries[issue.number];

    return `
        <div class="issue-card dashboard-issue-card" data-issue-number="${issue.number}">
            <div class="issue-card-left">
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
                    ${summary ? `<div class="issue-card-summary">${renderMarkdown(summary)}</div>` : ''}
                </div>
            </div>
            <div class="issue-card-actions">
                ${commentsCount > 0 ? `
                    <div class="comment-count">
                        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                            <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
                        </svg>
                        ${commentsCount}
                    </div>
                ` : ''}
                <button class="star-btn ${isStarred ? 'starred' : ''}" onclick="event.stopPropagation(); toggleStar(${issue.number})" title="${isStarred ? 'Unstar' : 'Star'}">
                    ${isStarred ? '★' : '☆'}
                </button>
                ${!isStarredTab ? `
                    <button class="dismiss-btn" onclick="event.stopPropagation(); dismissIssue(${issue.number})" title="Dismiss from list">
                        ✕
                    </button>
                ` : ''}
                <a href="${issue.html_url}" target="_blank" class="btn-icon-link" onclick="event.stopPropagation()" title="Open on GitHub">
                    ↗
                </a>
            </div>
        </div>`;
}

async function switchDashboardTab(tab) {
    dashboardState.tab = tab;
    if (tab === 'starred') {
        // Reload starred data
        dashboardState.starredIssues = [];
    }
    renderDashboardContent();
}

async function loadStarredIssues() {
    try {
        const data = await API.getStarred();
        dashboardState.starredIssues = data.items || [];
        dashboardState.starredNumbers = data.starred || dashboardState.starredNumbers;
        renderDashboardContent();
    } catch (err) {
        Toast.show('Failed to load starred issues', 'error');
    }
}

async function toggleStar(number) {
    const isStarred = dashboardState.starredNumbers.includes(number);
    try {
        if (isStarred) {
            const result = await API.unstarIssue(number);
            dashboardState.starredNumbers = result.starred || [];
            dashboardState.starredIssues = dashboardState.starredIssues.filter(i => i.number !== number);
            Toast.show(`Issue #${number} unstarred`, 'info');
        } else {
            const result = await API.starIssue(number);
            dashboardState.starredNumbers = result.starred || [];
            Toast.show(`Issue #${number} starred ⭐`, 'success');
        }
        renderDashboardContent();
    } catch (err) {
        Toast.show('Failed to update star', 'error');
    }
}

function dismissIssue(number) {
    dashboardState.dismissed.add(number);
    // Animate the card out
    const card = document.querySelector(`.issue-card[data-issue-number="${number}"]`);
    if (card) {
        card.classList.add('issue-card-dismissed');
        setTimeout(() => renderDashboardContent(), 300);
    } else {
        renderDashboardContent();
    }
    Toast.show(`Issue #${number} dismissed`, 'info');
}

async function refreshDashboard() {
    dashboardState.dismissed.clear();
    dashboardState.summaries = {};
    await renderDashboard();
}

async function switchDashboardDays(days) {
    if (dashboardState.days === days) return;
    dashboardState.days = days;
    dashboardState.dismissed.clear();
    dashboardState.summaries = {};
    await renderDashboard();
}

async function batchAISummary() {
    const btn = document.getElementById('batchSummaryBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = '⏳ Summarizing...';

    const issues = dashboardState.topIssues.filter(i => !dashboardState.dismissed.has(i.number));
    let completed = 0;
    const total = issues.length;

    // Create or get the progress indicator below the toolbar
    let progressEl = document.getElementById('batchProgressIndicator');
    if (!progressEl) {
        const toolbar = document.querySelector('.dashboard-toolbar');
        if (toolbar) {
            progressEl = document.createElement('div');
            progressEl.id = 'batchProgressIndicator';
            progressEl.className = 'batch-progress-indicator';
            toolbar.parentNode.insertBefore(progressEl, toolbar.nextSibling);
        }
    }

    function updateProgress(current, totalCount, issueTitle, issueNumber) {
        if (!progressEl) return;
        const percent = Math.round((current / totalCount) * 100);
        progressEl.innerHTML = `
            <div class="batch-progress-header">
                <span class="batch-progress-status">🤖 Analyzing issue ${current}/${totalCount}</span>
                <span class="batch-progress-percent">${percent}%</span>
            </div>
            <div class="batch-progress-bar-track">
                <div class="batch-progress-bar-fill" style="width: ${percent}%"></div>
            </div>
            <div class="batch-progress-issue">
                <span class="batch-progress-issue-icon">▶</span>
                <span class="batch-progress-issue-title">#${issueNumber} ${escapeHtml(issueTitle)}</span>
            </div>
        `;
        progressEl.style.display = 'block';
    }

    for (const issue of issues) {
        if (dashboardState.summaries[issue.number]) {
            completed++;
            continue; // Skip already summarized
        }
        // Show which issue is currently being analyzed
        updateProgress(completed + 1, total, issue.title, issue.number);
        // Also highlight the current card being analyzed
        const currentCard = document.querySelector(`.issue-card[data-issue-number="${issue.number}"]`);
        if (currentCard) currentCard.classList.add('issue-card-analyzing');

        try {
            const result = await API.aiSummarize({
                title: issue.title,
                body: (issue.body || '').substring(0, 2000), // Limit body length
                labels: (issue.labels || []).map(l => l.name),
                comments: [], // Skip comments for batch summary to save time
            });
            dashboardState.summaries[issue.number] = result.summary || '';
            completed++;
            btn.textContent = `⏳ ${completed}/${total}`;
            // Update the card in-place
            const summaryEl = document.querySelector(`.issue-card[data-issue-number="${issue.number}"] .issue-card-summary`);
            if (summaryEl) {
                summaryEl.innerHTML = renderMarkdown(dashboardState.summaries[issue.number]);
            } else {
                // Add summary element
                const bodyEl = document.querySelector(`.issue-card[data-issue-number="${issue.number}"] .issue-card-body`);
                if (bodyEl) {
                    const div = document.createElement('div');
                    div.className = 'issue-card-summary';
                    div.innerHTML = renderMarkdown(dashboardState.summaries[issue.number]);
                    bodyEl.appendChild(div);
                }
            }
        } catch (err) {
            completed++;
            // Continue with next issue
        }
        // Remove analyzing highlight
        if (currentCard) currentCard.classList.remove('issue-card-analyzing');
    }

    // Remove progress indicator with a fade
    if (progressEl) {
        progressEl.classList.add('batch-progress-done');
        setTimeout(() => progressEl.remove(), 600);
    }

    btn.disabled = false;
    btn.textContent = '🤖 Batch Summary';
    Toast.show('Batch summary complete!', 'success');
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

            <!-- AI Reply Assistant Panel -->
            <div class="ai-panel">
                <div class="ai-panel-header">
                    <div class="ai-panel-title">
                        <span class="spark">✨</span> AI Reply Assistant
                    </div>
                    <button class="btn btn-primary btn-sm" id="helpToResponseBtn" onclick="helpToResponse(${issue.number})">
                        💬 Help to Response
                    </button>
                </div>

                <!-- Chat Messages Area -->
                <div class="ai-chat-messages" id="aiChatMessages" style="display:none"></div>

                <!-- Chat Input -->
                <div class="ai-chat-input-row" id="aiChatInputRow" style="display:none">
                    <div class="ai-chat-input-wrap">
                        <textarea class="ai-chat-input" id="aiChatInput" rows="2" placeholder="继续追问，例如：这个 issue 的技术细节是什么？" onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();sendChatMessage(${issue.number})}"></textarea>
                        <span class="ai-chat-input-hint">Ctrl + Enter 发送</span>
                    </div>
                    <div class="ai-chat-input-btns">
                        <button class="btn btn-primary btn-sm" onclick="sendChatMessage(${issue.number})">
                            发送
                        </button>
                        <button class="btn btn-danger btn-sm" id="stopChatBtn" onclick="stopChatMessage()" style="display:none">
                            ⏹ 停止
                        </button>
                    </div>
                </div>

                <!-- Generate Reply & Undo Buttons -->
                <div class="ai-panel-actions" id="aiGenerateActions" style="display:none">
                    <button class="btn btn-secondary btn-sm" onclick="undoLastChat()" title="撤销上一条消息">
                        ↩ Undo Last
                    </button>
                    <button class="btn btn-primary" id="generateReplyBtn" onclick="generateFinalReply(${issue.number})">
                        ✍️ Generate Reply
                    </button>
                </div>

                <!-- Reply Editor (shown after generating reply) -->
                <div id="aiReplySection" style="display:none">
                    <textarea class="ai-reply-editor" id="aiReplyEditor" placeholder="AI-generated reply will appear here. You can edit it before posting."></textarea>
                    <div class="ai-panel-actions">
                        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('aiReplyEditor').value=''">Clear</button>
                        <button class="btn btn-success" id="postCommentBtn" onclick="postAIComment(${issue.number})">
                            Post Comment to GitHub
                        </button>
                    </div>
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

async function helpToResponse(number) {
    const btn = document.getElementById('helpToResponseBtn');
    const chatArea = document.getElementById('aiChatMessages');
    const chatInputRow = document.getElementById('aiChatInputRow');
    const generateActions = document.getElementById('aiGenerateActions');
    const panel = document.getElementById('detailPanel');

    btn.disabled = true;
    btn.textContent = '⏳ Analyzing...';
    chatArea.style.display = 'block';

    // Initialize chat history
    panel._chatHistory = [];

    // Show typing indicator
    chatArea.innerHTML = `<div class="ai-chat-msg assistant">
        <div class="msg-avatar">🤖</div>
        <div class="msg-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>
    </div>`;

    try {
        const { issue, comments } = panel._currentIssue;
        const result = await API.aiSummarize({
            title: issue.title,
            body: issue.body,
            labels: (issue.labels || []).map(l => l.name),
            comments: comments,
        });

        const summaryText = result.summary || '';
        // Store in chat history as assistant message
        panel._chatHistory.push({ role: 'assistant', content: summaryText });

        // Render the analysis
        chatArea.innerHTML = `<div class="ai-chat-msg assistant">
            <div class="msg-avatar">🤖</div>
            <div class="msg-content">${renderMarkdown(summaryText)}</div>
        </div>`;

        // Show chat input and generate reply button
        chatInputRow.style.display = 'flex';
        generateActions.style.display = 'flex';
        Toast.show('Issue 分析完成！你可以继续追问或直接生成回复', 'success');
    } catch (err) {
        chatArea.innerHTML = `<div class="ai-chat-msg assistant">
            <div class="msg-avatar">🤖</div>
            <div class="msg-content">分析失败，请重试。</div>
        </div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = '💬 Help to Response';
    }
}

// Track the current chat AbortController
let _chatAbortController = null;

function undoLastChat() {
    const panel = document.getElementById('detailPanel');
    const chatArea = document.getElementById('aiChatMessages');
    if (!panel._chatHistory || panel._chatHistory.length < 2) return;

    // Remove last assistant + user pair
    const lastMsg = panel._chatHistory[panel._chatHistory.length - 1];
    if (lastMsg.role === 'assistant') {
        panel._chatHistory.pop(); // remove assistant
        panel._chatHistory.pop(); // remove user
    } else if (lastMsg.role === 'user') {
        // User sent but no response yet — just remove user
        panel._chatHistory.pop();
    }

    // Re-render all chat messages
    _rerenderChatMessages(chatArea, panel._chatHistory);
    Toast.show('已撤销上一条消息', 'info');
}

function stopChatMessage() {
    if (_chatAbortController) {
        _chatAbortController.abort();
        _chatAbortController = null;
    }
}

function _rerenderChatMessages(chatArea, history) {
    let html = '';
    for (const msg of history) {
        if (msg.role === 'assistant') {
            html += `<div class="ai-chat-msg assistant">
                <div class="msg-avatar">🤖</div>
                <div class="msg-content">${renderMarkdown(msg.content)}</div>
            </div>`;
        } else if (msg.role === 'user') {
            html += `<div class="ai-chat-msg user">
                <div class="msg-content">${escapeHtml(msg.content)}</div>
                <div class="msg-avatar">👤</div>
            </div>`;
        }
    }
    chatArea.innerHTML = html;
    chatArea.scrollTop = chatArea.scrollHeight;
}

async function sendChatMessage(number) {
    const input = document.getElementById('aiChatInput');
    const chatArea = document.getElementById('aiChatMessages');
    const panel = document.getElementById('detailPanel');
    const stopBtn = document.getElementById('stopChatBtn');
    const message = input.value.trim();

    if (!message) return;
    input.value = '';

    // Add user message to history and UI (with undo button)
    panel._chatHistory.push({ role: 'user', content: message });
    chatArea.innerHTML += `<div class="ai-chat-msg user">
        <div class="msg-content">${escapeHtml(message)}</div>
        <div class="msg-avatar">👤</div>
    </div>`;

    // Show typing indicator
    chatArea.innerHTML += `<div class="ai-chat-msg assistant typing-msg">
        <div class="msg-avatar">🤖</div>
        <div class="msg-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>
    </div>`;
    chatArea.scrollTop = chatArea.scrollHeight;

    // Show stop button, disable send
    if (stopBtn) stopBtn.style.display = 'inline-flex';
    input.disabled = true;

    // Set up abort controller
    _chatAbortController = new AbortController();

    try {
        const { issue, comments } = panel._currentIssue;
        const result = await API.aiChat({
            messages: panel._chatHistory,
            title: issue.title,
            body: issue.body,
            labels: (issue.labels || []).map(l => l.name),
            comments: comments,
        });

        // Check if aborted
        if (_chatAbortController && _chatAbortController.signal.aborted) throw new Error('aborted');

        const reply = result.reply || '';
        panel._chatHistory.push({ role: 'assistant', content: reply });

        // Remove typing indicator and add response
        const typingEl = chatArea.querySelector('.typing-msg');
        if (typingEl) typingEl.remove();

        chatArea.innerHTML += `<div class="ai-chat-msg assistant">
            <div class="msg-avatar">🤖</div>
            <div class="msg-content">${renderMarkdown(reply)}</div>
        </div>`;
    } catch (err) {
        const typingEl = chatArea.querySelector('.typing-msg');
        if (typingEl) typingEl.remove();

        if (err.message === 'aborted' || (err.name === 'AbortError')) {
            // User stopped — undo the user message too
            panel._chatHistory.pop(); // remove user msg
            _rerenderChatMessages(chatArea, panel._chatHistory);
            Toast.show('已停止生成', 'info');
        } else {
            chatArea.innerHTML += `<div class="ai-chat-msg assistant">
                <div class="msg-avatar">🤖</div>
                <div class="msg-content">回复失败，请重试。</div>
            </div>`;
        }
    } finally {
        _chatAbortController = null;
        if (stopBtn) stopBtn.style.display = 'none';
        input.disabled = false;
        input.focus();
    }

    chatArea.scrollTop = chatArea.scrollHeight;
}

async function generateFinalReply(number) {
    const btn = document.getElementById('generateReplyBtn');
    const replySection = document.getElementById('aiReplySection');
    const editor = document.getElementById('aiReplyEditor');
    const panel = document.getElementById('detailPanel');

    btn.disabled = true;
    btn.textContent = '⏳ Generating Reply...';

    // Capture any unsent text in the input box
    const pendingInput = document.getElementById('aiChatInput');
    const pendingText = pendingInput ? pendingInput.value.trim() : '';

    // Add instruction to generate final reply, including unsent input as extra context
    let replyInstruction = '请根据我们之前的讨论，生成一段专业、友好的英文回复，可以直接发布到 GitHub Issue 上。使用 Markdown 格式，回复内容要简洁专业。只输出回复内容本身，不要包含其他解释。';
    if (pendingText) {
        replyInstruction += `\n\n另外，用户还有以下补充要求：${pendingText}`;
    }
    const generateMessages = [...(panel._chatHistory || []), {
        role: 'user',
        content: replyInstruction
    }];

    try {
        const { issue, comments } = panel._currentIssue;
        const result = await API.aiChat({
            messages: generateMessages,
            title: issue.title,
            body: issue.body,
            labels: (issue.labels || []).map(l => l.name),
            comments: comments,
        });

        editor.value = result.reply || '';
        replySection.style.display = 'block';
        Toast.show('Reply generated! Review and edit before posting.', 'success');
    } catch (err) {
        editor.value = '';
        Toast.show('Failed to generate reply', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✍️ Generate Reply';
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
    API.saveSettings({ current_repo: State.currentRepo }).catch(() => { });
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
    ThemeManager.init();

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
