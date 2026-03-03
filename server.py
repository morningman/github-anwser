#!/usr/bin/env python3
"""
GitHub Issue Manager — Local Backend Server
Uses Python's built-in http.server with ThreadingHTTPServer for concurrent access.
No external dependencies required (uses urllib for HTTP requests).
"""

import json
import os
import re
import sys
import logging
import urllib.request
import urllib.parse
import urllib.error
from http.server import SimpleHTTPRequestHandler
try:
    from http.server import ThreadingHTTPServer
except ImportError:
    # Python < 3.7: ThreadingHTTPServer is not available, build one manually
    import socketserver
    from http.server import HTTPServer
    class ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
        daemon_threads = True
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PORT = int(os.environ.get('PORT', 8080))
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
CONFIG_FILE = os.path.join(DATA_DIR, 'config.json')
STARRED_FILE = os.path.join(DATA_DIR, 'starred.json')
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(LOG_DIR, 'server.log'), encoding='utf-8'),
    ]
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------
DEFAULT_CONFIG = {
    'github_token': '',
    'repos': ['apache/doris'],
    'current_repo': 'apache/doris',
    'github_username': '',
    'ai_api_key': '',
    'ai_base_url': 'https://api.openai.com/v1',
    'ai_model': 'gpt-4o',
}


def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
            # Merge with defaults for any missing keys
            for k, v in DEFAULT_CONFIG.items():
                cfg.setdefault(k, v)
            return cfg
    return dict(DEFAULT_CONFIG)


def save_config(cfg):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)


def masked_config(cfg):
    """Return config with sensitive fields masked."""
    c = dict(cfg)
    if c.get('github_token'):
        t = c['github_token']
        c['github_token'] = t[:4] + '****' + t[-4:] if len(t) > 8 else '****'
    if c.get('ai_api_key'):
        t = c['ai_api_key']
        c['ai_api_key'] = t[:4] + '****' + t[-4:] if len(t) > 8 else '****'
    return c


def load_starred():
    """Load starred issues per repo from local JSON file."""
    if os.path.exists(STARRED_FILE):
        try:
            with open(STARRED_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_starred(data):
    """Save starred issues per repo to local JSON file."""
    with open(STARRED_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# GitHub API helpers
# ---------------------------------------------------------------------------
GITHUB_API = 'https://api.github.com'


def github_request(path, method='GET', body=None, token=None):
    """Make a request to the GitHub API."""
    if token is None:
        token = load_config().get('github_token', '')

    url = f'{GITHUB_API}{path}'
    headers = {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'GitHub-Issue-Manager/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
    }
    if token:
        headers['Authorization'] = f'token {token}'

    data = None
    if body is not None:
        data = json.dumps(body).encode('utf-8')
        headers['Content-Type'] = 'application/json'

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_body = resp.read().decode('utf-8')
            # Parse Link header for pagination
            link_header = resp.getheader('Link', '')
            result = json.loads(resp_body) if resp_body else {}
            return result, resp.status, link_header
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8') if e.fp else '{}'
        logger.error(f'GitHub API error: {e.code} {err_body[:200]}')
        try:
            return json.loads(err_body), e.code, ''
        except json.JSONDecodeError:
            return {'message': err_body[:200]}, e.code, ''
    except Exception as e:
        logger.error(f'GitHub API exception: {e}')
        return {'message': str(e)}, 500, ''


def parse_link_header(link_header):
    """Parse GitHub Link header into dict of rel -> url."""
    links = {}
    if not link_header:
        return links
    for part in link_header.split(','):
        m = re.match(r'<([^>]+)>;\s*rel="([^"]+)"', part.strip())
        if m:
            links[m.group(2)] = m.group(1)
    return links


# ---------------------------------------------------------------------------
# AI / LLM helpers
# ---------------------------------------------------------------------------
def ai_generate_reply(issue_title, issue_body, labels, comments):
    """Call LLM API to generate a reply."""
    cfg = load_config()
    api_key = cfg.get('ai_api_key', '')
    base_url = cfg.get('ai_base_url', 'https://api.openai.com/v1').rstrip('/')
    model = cfg.get('ai_model', 'gpt-4o')

    if not api_key:
        return None, 'AI API Key not configured'

    comments_text = ''
    for c in (comments or [])[-5:]:
        comments_text += f"**{c.get('user', {}).get('login', 'unknown')}** ({c.get('created_at', '')}):\n{c.get('body', '')}\n\n"

    labels_text = ', '.join(labels) if labels else 'None'

    prompt = f"""You are a helpful assistant for an open-source project maintainer.
Based on the following GitHub Issue, generate a professional, friendly reply.

## Issue Info
- Title: {issue_title}
- Body:
{issue_body or '(empty)'}
- Labels: {labels_text}

## Recent Comments (last 5)
{comments_text or '(no comments yet)'}

## Requirements
1. Be professional and friendly
2. For bug reports: provide troubleshooting suggestions
3. For feature requests: give a reasonable response
4. If more information is needed: list specific questions
5. Use Markdown formatting
6. Reply in English"""

    url = f'{base_url}/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }
    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.7,
        'max_tokens': 4096,
    }

    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            msg = result['choices'][0]['message']
            reply = msg.get('content') or msg.get('reasoning_content') or ''
            if not reply:
                return None, 'AI returned empty response'
            return reply, None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8') if e.fp else ''
        logger.error(f'AI API error: {e.code} {err_body[:200]}')
        return None, f'AI API error: {e.code}'
    except Exception as e:
        logger.error(f'AI API exception: {e}')
        return None, str(e)


def ai_generate_summary(issue_title, issue_body, labels, comments):
    """Call LLM API to generate a Chinese summary of the issue."""
    cfg = load_config()
    api_key = cfg.get('ai_api_key', '')
    base_url = cfg.get('ai_base_url', 'https://api.openai.com/v1').rstrip('/')
    model = cfg.get('ai_model', 'gpt-4o')

    if not api_key:
        return None, 'AI API Key not configured'

    comments_text = ''
    for c in (comments or [])[-5:]:
        comments_text += f"**{c.get('user', {}).get('login', 'unknown')}**: {c.get('body', '')}\n\n"

    labels_text = ', '.join(labels) if labels else 'None'

    prompt = f"""你是一个开源项目维护者的助手。请根据以下 GitHub Issue 信息，生成结构化的中文分析。

## Issue 信息
- 标题: {issue_title}
- 正文:
{issue_body or '(空)'}
- 标签: {labels_text}

## 最近评论
{comments_text or '(暂无评论)'}

## 要求
请严格按照以下三个部分输出，每个部分用对应的标题开头：

### 📋 Issue 摘要
用 2-3 句话简要概括这个 Issue 主要在说什么，核心诉求和关键信息。

### 🏷️ Issue 分类
明确指出 Issue 的类型，只能是以下之一：Bug 报告 / 功能请求 / 开发贡献 / 使用咨询 / 其他。并用一句话解释分类的原因。

### 💡 回复建议
给出 2-3 条具体可操作的回复建议，帮助维护者决定如何回应这个 Issue。

注意：使用中文返回，使用 Markdown 格式。"""

    url = f'{base_url}/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }
    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.5,
        'max_tokens': 4096,
    }

    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            msg = result['choices'][0]['message']
            reply = msg.get('content') or msg.get('reasoning_content') or ''
            if not reply:
                return None, 'AI returned empty response'
            return reply, None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8') if e.fp else ''
        logger.error(f'AI API error: {e.code} {err_body[:200]}')
        return None, f'AI API error: {e.code}'
    except Exception as e:
        logger.error(f'AI API exception: {e}')
        return None, str(e)


def ai_chat(messages, issue_title, issue_body, labels, comments):
    """Call LLM API for multi-turn conversation with issue context."""
    cfg = load_config()
    api_key = cfg.get('ai_api_key', '')
    base_url = cfg.get('ai_base_url', 'https://api.openai.com/v1').rstrip('/')
    model = cfg.get('ai_model', 'gpt-4o')

    if not api_key:
        return None, 'AI API Key not configured'

    comments_text = ''
    for c in (comments or [])[-5:]:
        comments_text += f"**{c.get('user', {}).get('login', 'unknown')}**: {c.get('body', '')}\n\n"

    labels_text = ', '.join(labels) if labels else 'None'

    system_prompt = f"""你是一个开源项目维护者的助手。你正在帮助维护者分析和回复一个 GitHub Issue。

## 当前 Issue 上下文
- 标题: {issue_title}
- 正文:
{issue_body or '(空)'}
- 标签: {labels_text}

## 最近评论
{comments_text or '(暂无评论)'}

## 你的角色
- 你可以回答关于这个 Issue 的任何问题
- 你可以帮助分析 Issue 的技术细节
- 你可以提供回复建议
- 使用中文回答用户的问题
- 使用 Markdown 格式"""

    full_messages = [{'role': 'system', 'content': system_prompt}] + messages

    url = f'{base_url}/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }
    payload = {
        'model': model,
        'messages': full_messages,
        'temperature': 0.7,
        'max_tokens': 4096,
    }

    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            msg = result['choices'][0]['message']
            reply = msg.get('content') or msg.get('reasoning_content') or ''
            if not reply:
                return None, 'AI returned empty response'
            return reply, None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8') if e.fp else ''
        logger.error(f'AI API error: {e.code} {err_body[:200]}')
        return None, f'AI API error: {e.code}'
    except Exception as e:
        logger.error(f'AI API exception: {e}')
        return None, str(e)


# ---------------------------------------------------------------------------
# Request Handler
# ---------------------------------------------------------------------------
class APIHandler(SimpleHTTPRequestHandler):
    """Handle both static files and API requests."""

    # Serve files from the project root
    def translate_path(self, path):
        """Only serve static files from the project root directory."""
        # Strip query string and fragment
        path = path.split('?', 1)[0].split('#', 1)[0]
        # Normalize path
        path = urllib.parse.unquote(path)
        # Remove leading slash
        rel = path.lstrip('/')
        # Serve from the project root
        root = os.path.dirname(os.path.abspath(__file__))
        full = os.path.join(root, rel)
        return full

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == '/api/settings':
            self._handle_get_settings()
        elif path == '/api/issues':
            self._handle_get_issues(query)
        elif re.match(r'^/api/issues/(\d+)$', path):
            num = re.match(r'^/api/issues/(\d+)$', path).group(1)
            self._handle_get_issue_detail(num, query)
        elif path == '/api/labels':
            self._handle_get_labels()
        elif path == '/api/my-issues':
            self._handle_get_my_issues(query)
        elif path == '/api/stats':
            self._handle_get_stats()
        elif path == '/api/dashboard-issues':
            self._handle_get_dashboard_issues(query)
        elif path == '/api/starred':
            self._handle_get_starred()
        else:
            # Serve static files
            super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        body = self._read_body()

        if path == '/api/settings':
            self._handle_save_settings(body)
        elif path == '/api/settings/test-github':
            self._handle_test_github(body)
        elif path == '/api/settings/test-ai':
            self._handle_test_ai(body)
        elif path == '/api/ai/generate-reply':
            self._handle_ai_generate(body)
        elif path == '/api/ai/summarize':
            self._handle_ai_summarize(body)
        elif path == '/api/ai/chat':
            self._handle_ai_chat(body)
        elif re.match(r'^/api/issues/(\d+)/comments$', path):
            num = re.match(r'^/api/issues/(\d+)/comments$', path).group(1)
            self._handle_post_comment(num, body)
        elif path == '/api/starred':
            self._handle_star_issue(body)
        else:
            self._json_response({'error': 'Not found'}, 404)

    def do_PATCH(self):
        path = urllib.parse.urlparse(self.path).path
        body = self._read_body()

        if re.match(r'^/api/issues/(\d+)$', path):
            num = re.match(r'^/api/issues/(\d+)$', path).group(1)
            self._handle_patch_issue(num, body)
        else:
            self._json_response({'error': 'Not found'}, 404)

    def do_DELETE(self):
        path = urllib.parse.urlparse(self.path).path
        body = self._read_body()

        if path == '/api/starred':
            self._handle_unstar_issue(body)
        else:
            self._json_response({'error': 'Not found'}, 404)

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    # --- Settings -----------------------------------------------------------
    def _handle_get_settings(self):
        cfg = load_config()
        self._json_response(masked_config(cfg))

    def _handle_save_settings(self, body):
        cfg = load_config()
        # Sensitive fields: skip if value still contains mask placeholder
        sensitive_keys = {'github_token', 'ai_api_key'}
        for key in ['github_token', 'repos', 'current_repo', 'github_username',
                     'ai_api_key', 'ai_base_url', 'ai_model']:
            if key in body:
                value = body[key]
                # Don't overwrite real secrets with masked values
                if key in sensitive_keys and isinstance(value, str) and '****' in value:
                    continue
                cfg[key] = value
        save_config(cfg)
        logger.info('Settings saved')
        self._json_response({'ok': True, 'settings': masked_config(cfg)})

    def _handle_test_github(self, body):
        token = body.get('github_token', '')
        if not token:
            # Try from config
            token = load_config().get('github_token', '')
        result, status, _ = github_request('/user', token=token)
        if status == 200:
            self._json_response({
                'ok': True,
                'user': result.get('login', ''),
                'name': result.get('name', ''),
                'avatar_url': result.get('avatar_url', ''),
            })
        else:
            self._json_response({'ok': False, 'message': result.get('message', 'Unknown error')}, 401)

    def _handle_test_ai(self, body):
        cfg = load_config()
        api_key = body.get('ai_api_key', cfg.get('ai_api_key', ''))
        base_url = body.get('ai_base_url', cfg.get('ai_base_url', '')).rstrip('/')
        model = body.get('ai_model', cfg.get('ai_model', ''))

        if not api_key:
            self._json_response({'ok': False, 'message': 'API Key not provided'}, 400)
            return

        url = f'{base_url}/models'
        headers = {
            'Authorization': f'Bearer {api_key}',
        }
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                self._json_response({'ok': True, 'message': f'Connected successfully. Model: {model}'})
        except Exception as e:
            self._json_response({'ok': False, 'message': str(e)}, 400)

    # --- Issues -------------------------------------------------------------
    def _handle_get_issues(self, query):
        cfg = load_config()
        repo = query.get('repo', [cfg.get('current_repo', 'apache/doris')])[0]
        state = query.get('state', ['open'])[0]
        sort = query.get('sort', ['updated'])[0]
        direction = query.get('direction', ['desc'])[0]
        page = query.get('page', ['1'])[0]
        per_page = query.get('per_page', ['20'])[0]
        since = query.get('since', [''])[0]
        labels = query.get('labels', [''])[0]
        q = query.get('q', [''])[0]

        if q:
            # Use search API for keyword search
            search_q = f'{q} repo:{repo} is:issue'
            if state != 'all':
                search_q += f' is:{state}'
            if labels:
                for label in labels.split(','):
                    search_q += f' label:"{label.strip()}"'

            params = urllib.parse.urlencode({
                'q': search_q,
                'sort': sort if sort != 'updated' else 'updated',
                'order': direction,
                'page': page,
                'per_page': per_page,
            })
            result, status, link = github_request(f'/search/issues?{params}')
            if status == 200:
                self._json_response({
                    'items': result.get('items', []),
                    'total_count': result.get('total_count', 0),
                    'pagination': parse_link_header(link),
                })
            else:
                self._json_response(result, status)
        else:
            # Use search API with is:issue to exclude PRs
            search_q = f'repo:{repo} is:issue'
            if state != 'all':
                search_q += f' is:{state}'
            if labels:
                for label in labels.split(','):
                    search_q += f' label:"{label.strip()}"'
            if since:
                search_q += f' updated:>={since}'

            sort_field = sort if sort in ('updated', 'created', 'comments') else 'updated'
            params = urllib.parse.urlencode({
                'q': search_q,
                'sort': sort_field,
                'order': direction,
                'page': page,
                'per_page': per_page,
            })
            result, status, link = github_request(f'/search/issues?{params}')
            if status == 200:
                self._json_response({
                    'items': result.get('items', []),
                    'total_count': result.get('total_count', 0),
                    'pagination': parse_link_header(link),
                })
            else:
                self._json_response(result, status)

    def _handle_get_issue_detail(self, number, query):
        cfg = load_config()
        repo = query.get('repo', [cfg.get('current_repo', 'apache/doris')])[0]
        owner, name = repo.split('/')

        # Get issue details
        issue, status, _ = github_request(f'/repos/{owner}/{name}/issues/{number}')
        if status != 200:
            self._json_response(issue, status)
            return

        # Get comments
        comments, c_status, _ = github_request(
            f'/repos/{owner}/{name}/issues/{number}/comments?per_page=50'
        )
        if c_status != 200:
            comments = []

        self._json_response({
            'issue': issue,
            'comments': comments,
        })

    def _handle_get_labels(self):
        cfg = load_config()
        repo = cfg.get('current_repo', 'apache/doris')
        owner, name = repo.split('/')
        result, status, _ = github_request(f'/repos/{owner}/{name}/labels?per_page=100')
        if status == 200:
            self._json_response(result)
        else:
            self._json_response(result, status)

    # --- My Issues ----------------------------------------------------------
    def _handle_get_my_issues(self, query):
        cfg = load_config()
        username = cfg.get('github_username', '')
        repo = query.get('repo', [cfg.get('current_repo', 'apache/doris')])[0]
        issue_type = query.get('type', ['mentioned'])[0]
        page = query.get('page', ['1'])[0]
        per_page = query.get('per_page', ['20'])[0]

        if not username:
            self._json_response({'error': 'GitHub username not configured'}, 400)
            return

        qualifier_map = {
            'mentioned': f'mentions:{username}',
            'assigned': f'assignee:{username}',
            'created': f'author:{username}',
            'commented': f'commenter:{username}',
        }
        qualifier = qualifier_map.get(issue_type, f'mentions:{username}')
        search_q = f'{qualifier} repo:{repo} is:issue is:open'

        params = urllib.parse.urlencode({
            'q': search_q,
            'sort': 'updated',
            'order': 'desc',
            'page': page,
            'per_page': per_page,
        })
        result, status, link = github_request(f'/search/issues?{params}')
        if status == 200:
            self._json_response({
                'items': result.get('items', []),
                'total_count': result.get('total_count', 0),
                'pagination': parse_link_header(link),
            })
        else:
            self._json_response(result, status)

    # --- Stats --------------------------------------------------------------
    def _handle_get_stats(self):
        cfg = load_config()
        repo = cfg.get('current_repo', 'apache/doris')
        owner, name = repo.split('/')

        # Open issues count
        repo_info, status, _ = github_request(f'/repos/{owner}/{name}')
        open_count = repo_info.get('open_issues_count', 0) if status == 200 else 0

        # Recent issues (last 7 days)
        from datetime import timedelta
        since = (datetime.now(timezone.utc) - timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
        recent, r_status, _ = github_request(
            f'/repos/{owner}/{name}/issues?state=open&sort=created&direction=desc&since={since}&per_page=5'
        )
        recent_issues = [i for i in (recent if r_status == 200 else []) if 'pull_request' not in i]

        # Unanswered issues (open, 0 comments) — use search
        search_q = f'repo:{repo} is:issue is:open comments:0'
        params = urllib.parse.urlencode({'q': search_q, 'sort': 'created', 'order': 'desc', 'per_page': '10'})
        unanswered, u_status, _ = github_request(f'/search/issues?{params}')
        unanswered_items = unanswered.get('items', []) if u_status == 200 else []
        unanswered_count = unanswered.get('total_count', 0) if u_status == 200 else 0

        self._json_response({
            'open_count': open_count,
            'recent_issues': recent_issues[:5],
            'unanswered_issues': unanswered_items,
            'unanswered_count': unanswered_count,
        })

    # --- Dashboard Issues (Recent Active) -----------------------------------
    def _handle_get_dashboard_issues(self, query=None):
        """Fetch issues updated in the last N days (excluding stale), sorted by update time."""
        from datetime import timedelta
        cfg = load_config()
        repo = cfg.get('current_repo', 'apache/doris')

        # Support 'days' query param, default to 7
        days = 7
        if query and 'days' in query:
            try:
                days = int(query['days'][0])
            except (ValueError, IndexError):
                pass

        logger.info(f'Dashboard: fetching issues updated in last {days} days for {repo}')
        since_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')
        q = f'repo:{repo} is:issue is:open -label:stale updated:>={since_date}'
        params = urllib.parse.urlencode({'q': q, 'sort': 'updated', 'order': 'desc', 'per_page': '30'})
        result, status, _ = github_request(f'/search/issues?{params}')

        if status != 200:
            err_msg = result.get('message', 'Unknown error') if isinstance(result, dict) else str(result)
            logger.error(f'Dashboard: GitHub API returned {status}: {err_msg}')
            self._json_response({'error': f'GitHub API error ({status}): {err_msg}'}, 500)
            return

        items = [i for i in result.get('items', []) if 'pull_request' not in i][:20]

        # Get starred list
        starred = load_starred()
        starred_numbers = starred.get(repo, [])

        self._json_response({
            'items': items,
            'starred': starred_numbers,
            'total_count': len(items),
        })


    # --- Starred Issues (local storage) -------------------------------------
    def _handle_get_starred(self):
        """Return starred issues for the current repo with full issue data."""
        cfg = load_config()
        repo = cfg.get('current_repo', 'apache/doris')
        owner, name = repo.split('/')
        starred = load_starred()
        starred_numbers = starred.get(repo, [])

        if not starred_numbers:
            self._json_response({'items': [], 'starred': []})
            return

        # Fetch each starred issue (in parallel would be nice, but keep it simple)
        items = []
        for num in starred_numbers:
            issue, status, _ = github_request(f'/repos/{owner}/{name}/issues/{num}')
            if status == 200 and 'pull_request' not in issue:
                items.append(issue)

        self._json_response({'items': items, 'starred': starred_numbers})

    def _handle_star_issue(self, body):
        """Add an issue number to the starred list."""
        cfg = load_config()
        repo = cfg.get('current_repo', 'apache/doris')
        number = body.get('number')
        if not number:
            self._json_response({'error': 'Issue number required'}, 400)
            return

        starred = load_starred()
        repo_starred = starred.setdefault(repo, [])
        if number not in repo_starred:
            repo_starred.insert(0, number)  # Add to front
        save_starred(starred)
        logger.info(f'Starred issue #{number} in {repo}')
        self._json_response({'ok': True, 'starred': repo_starred})

    def _handle_unstar_issue(self, body):
        """Remove an issue number from the starred list."""
        cfg = load_config()
        repo = cfg.get('current_repo', 'apache/doris')
        number = body.get('number')
        if not number:
            self._json_response({'error': 'Issue number required'}, 400)
            return

        starred = load_starred()
        repo_starred = starred.get(repo, [])
        if number in repo_starred:
            repo_starred.remove(number)
        starred[repo] = repo_starred
        save_starred(starred)
        logger.info(f'Unstarred issue #{number} in {repo}')
        self._json_response({'ok': True, 'starred': repo_starred})

    # --- AI -----------------------------------------------------------------
    def _handle_ai_generate(self, body):
        title = body.get('title', '')
        issue_body = body.get('body', '')
        labels = body.get('labels', [])
        comments = body.get('comments', [])

        reply, error = ai_generate_reply(title, issue_body, labels, comments)
        if reply:
            self._json_response({'ok': True, 'reply': reply})
        else:
            self._json_response({'ok': False, 'message': error}, 500)

    def _handle_ai_summarize(self, body):
        title = body.get('title', '')
        issue_body = body.get('body', '')
        labels = body.get('labels', [])
        comments = body.get('comments', [])

        reply, error = ai_generate_summary(title, issue_body, labels, comments)
        if reply:
            self._json_response({'ok': True, 'summary': reply})
        else:
            self._json_response({'ok': False, 'message': error}, 500)

    def _handle_ai_chat(self, body):
        messages = body.get('messages', [])
        title = body.get('title', '')
        issue_body = body.get('body', '')
        labels = body.get('labels', [])
        comments = body.get('comments', [])

        reply, error = ai_chat(messages, title, issue_body, labels, comments)
        if reply:
            self._json_response({'ok': True, 'reply': reply})
        else:
            self._json_response({'ok': False, 'message': error}, 500)

    # --- Post comment / Patch issue -----------------------------------------
    def _handle_post_comment(self, number, body):
        cfg = load_config()
        repo = cfg.get('current_repo', 'apache/doris')
        owner, name = repo.split('/')
        comment_body = body.get('body', '')
        if not comment_body:
            self._json_response({'error': 'Comment body is required'}, 400)
            return

        result, status, _ = github_request(
            f'/repos/{owner}/{name}/issues/{number}/comments',
            method='POST',
            body={'body': comment_body}
        )
        self._json_response(result, status if status != 201 else 200)

    def _handle_patch_issue(self, number, body):
        cfg = load_config()
        repo = cfg.get('current_repo', 'apache/doris')
        owner, name = repo.split('/')

        result, status, _ = github_request(
            f'/repos/{owner}/{name}/issues/{number}',
            method='PATCH',
            body=body
        )
        self._json_response(result, status)

    # --- Helpers ------------------------------------------------------------
    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length:
            raw = self.rfile.read(length).decode('utf-8')
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return {}
        return {}

    def _json_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def log_message(self, format, *args):
        logger.info(f'{self.client_address[0]} - {format % args}')


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    server = ThreadingHTTPServer(('0.0.0.0', PORT), APIHandler)
    logger.info(f'🚀 GitHub Issue Manager started on http://localhost:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info('Server shutting down...')
        server.shutdown()


if __name__ == '__main__':
    main()
