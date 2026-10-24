"""
nunu Portal Backend Server (Python Built-in Standard Library)
- No external pip dependencies required!
- Built with Python's http.server & sqlite3
- Serves static files and RESTful APIs
"""

import http.server
import socketserver
import json
import os
import sys
import sqlite3
import urllib.parse
import urllib.request
import socket
import subprocess
import time
import re
import base64
import ssl
import html
import random
import concurrent.futures
from datetime import datetime

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "nunu.db")
BOOKWAVE_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "book-player"))
TUNNEL_FILE = os.path.join(BASE_DIR, "tunnel_url.txt")

def get_public_tunnel_url():
    """외부 접속용 공용 HTTPS 터널 주소 반환 (같은 Wi-Fi 아니어도 LTE/외부 접속 가능)"""
    if os.path.exists(TUNNEL_FILE):
        try:
            with open(TUNNEL_FILE, "r", encoding="utf-8") as f:
                url = f.read().strip()
                if url.startswith("http"):
                    return url
        except Exception:
            pass
    return "https://worker-temporary-soundtrack-flights.trycloudflare.com"

EMERGENCY_STOP_FILE = os.path.join(BASE_DIR, "emergency_stop.json")

def get_emergency_status():
    if os.path.exists(EMERGENCY_STOP_FILE):
        try:
            with open(EMERGENCY_STOP_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"emergencyStopped": False, "timestamp": "", "message": "정상 운영 중"}

def set_emergency_status(stopped, message="관리자로 인해 종료되었습니다."):
    data = {
        "emergencyStopped": bool(stopped),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "message": message
    }
    try:
        with open(EMERGENCY_STOP_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    return data

def fetch_google_search(query):
    results = []
    clean_q = query.strip()
    if not clean_q: return results
    enc_q = urllib.parse.quote(clean_q)
    ctx = ssl._create_unverified_context()
    h = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8'
    }

    # 1. Google News / Search RSS
    try:
        rss_url = f"https://news.google.com/rss/search?q={enc_q}&hl=ko&gl=KR&ceid=KR:ko"
        req = urllib.request.Request(rss_url, headers=h)
        with urllib.request.urlopen(req, context=ctx, timeout=3.5) as resp:
            xml_content = resp.read().decode('utf-8', errors='ignore')
        items = re.findall(r'<item>([\s\S]*?)</item>', xml_content)
        for it in items[:8]:
            tm = re.search(r'<title>([\s\S]*?)</title>', it)
            lm = re.search(r'<link>([\s\S]*?)</link>', it)
            pm = re.search(r'<pubDate>([\s\S]*?)</pubDate>', it)
            if tm and lm:
                t = html.unescape(re.sub(r'<[^>]+>', '', tm.group(1))).strip()
                l = lm.group(1).strip()
                d_str = pm.group(1).strip() if pm else ''
                results.append({
                    'title': t,
                    'url': l,
                    'source': 'Google',
                    'domain': 'google.com',
                    'snippet': f'Google 실시간 검색 및 뉴스 정보 {d_str}'
                })
    except Exception as e:
        pass

    # 2. Bing Web Scraper (fallback/supplement for Google-like web results)
    if len(results) < 6:
        try:
            b_url = f"https://www.bing.com/search?q={enc_q}"
            req = urllib.request.Request(b_url, headers=h)
            with urllib.request.urlopen(req, context=ctx, timeout=3.5) as resp:
                content = resp.read().decode('utf-8', errors='ignore')
            blocks = re.findall(r'<li[^>]*class="b_algo"[^>]*>([\s\S]*?)</li>', content)
            for b in blocks[:6]:
                lm = re.search(r'<h2[^>]*><a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a></h2>', b)
                if lm:
                    raw_link = html.unescape(lm.group(1))
                    raw_title = lm.group(2)
                    clean_title = html.unescape(re.sub(r'<[^>]+>', '', raw_title)).strip()
                    snip_m = re.search(r'<p[^>]*>([\s\S]*?)</p>', b)
                    snip = html.unescape(re.sub(r'<[^>]+>', '', snip_m.group(1))).strip() if snip_m else f'{clean_title} 웹 문서'
                    if clean_title and not any(r['url'] == raw_link for r in results):
                        results.append({
                            'title': clean_title,
                            'url': raw_link,
                            'source': 'Google',
                            'domain': urllib.parse.urlparse(raw_link).netloc,
                            'snippet': snip
                        })
        except Exception:
            pass

    # Always add Google official direct portal card
    results.append({
        'title': f"'{clean_q}' Google(구글) 공식 검색결과 보기",
        'url': f"https://www.google.com/search?q={enc_q}",
        'source': 'Google',
        'domain': 'google.com',
        'isOfficial': True,
        'snippet': f"Google 공식 사이트에서 '{clean_q}'에 관한 모든 웹, 이미지, 지도, 최신 뉴스 결과를 탐색합니다."
    })
    return results

def fetch_naver_search(query):
    results = []
    clean_q = query.strip()
    if not clean_q: return results
    enc_q = urllib.parse.quote(clean_q)
    ctx = ssl._create_unverified_context()
    h = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8'
    }

    try:
        url = f'https://search.naver.com/search.naver?where=view&query={enc_q}'
        req = urllib.request.Request(url, headers=h)
        with urllib.request.urlopen(req, context=ctx, timeout=3.5) as resp:
            content = resp.read().decode('utf-8', errors='ignore')
        
        items = re.findall(r'<a[^>]+href="(https?://[^"]+)"[^>]*>([\s\S]*?)</a>', content)
        for link, raw_txt in items:
            clean_txt = html.unescape(re.sub(r'<[^>]+>', '', raw_txt)).strip()
            if len(clean_txt) > 12 and not link.startswith('https://search.naver.com') and not any(r['url'] == link for r in results):
                results.append({
                    'title': clean_txt,
                    'url': link,
                    'source': 'Naver',
                    'domain': urllib.parse.urlparse(link).netloc,
                    'snippet': f'네이버 블로그/카페/VIEW 인기 글: {clean_txt}'
                })
                if len(results) >= 8:
                    break
    except Exception:
        pass

    results.append({
        'title': f"'{clean_q}' Naver(네이버) 통합검색 바로가기",
        'url': f"https://search.naver.com/search.naver?query={enc_q}",
        'source': 'Naver',
        'domain': 'naver.com',
        'isOfficial': True,
        'snippet': f"네이버 공식 포털에서 '{clean_q}'의 블로그, 카페, 지식iN, 쇼핑 결과를 확인하세요."
    })
    return results

def fetch_youtube_search(query):
    results = []
    clean_q = query.strip()
    if not clean_q: return results
    enc_q = urllib.parse.quote(clean_q)
    ctx = ssl._create_unverified_context()
    h = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }

    try:
        url = f'https://www.youtube.com/results?search_query={enc_q}'
        req = urllib.request.Request(url, headers=h)
        with urllib.request.urlopen(req, context=ctx, timeout=4) as resp:
            content = resp.read().decode('utf-8', errors='ignore')
        
        m = re.search(r'var ytInitialData = ({.*?});</script>', content) or re.search(r'ytInitialData\s*=\s*({.*?});', content)
        if m:
            data = json.loads(m.group(1))
            def find_videos(obj):
                if isinstance(obj, dict):
                    if 'videoRenderer' in obj:
                        vr = obj['videoRenderer']
                        vid = vr.get('videoId')
                        title = ''
                        if 'title' in vr and 'runs' in vr['title']:
                            title = ''.join(r.get('text', '') for r in vr['title']['runs'])
                        elif 'title' in vr and 'simpleText' in vr['title']:
                            title = vr['title']['simpleText']
                        channel = ''
                        if 'ownerText' in vr and 'runs' in vr['ownerText']:
                            channel = ''.join(r.get('text', '') for r in vr['ownerText']['runs'])
                        thumb = f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg' if vid else ''
                        if vid and title:
                            results.append({
                                'videoId': vid,
                                'title': title,
                                'channel': channel,
                                'thumbnail': thumb,
                                'url': f'https://www.youtube.com/watch?v={vid}',
                                'embedUrl': f'https://www.youtube-nocookie.com/embed/{vid}',
                                'source': 'YouTube',
                                'domain': 'youtube.com',
                                'snippet': f'{channel} 채널 추천 동영상'
                            })
                    for v in obj.values():
                        find_videos(v)
                elif isinstance(obj, list):
                    for v in obj:
                        find_videos(v)
            find_videos(data)
    except Exception:
        pass

    results.append({
        'title': f"'{clean_q}' YouTube(유튜브) 검색결과 바로가기",
        'url': f"https://www.youtube.com/results?search_query={enc_q}",
        'source': 'YouTube',
        'domain': 'youtube.com',
        'isOfficial': True,
        'snippet': f"유튜브에서 '{clean_q}' 관련 실시간 인기 동영상, Shorts 및 음악을 감상하세요."
    })
    return results[:10]

def fetch_daum_search(query):
    results = []
    clean_q = query.strip()
    if not clean_q: return results
    enc_q = urllib.parse.quote(clean_q)
    ctx = ssl._create_unverified_context()
    h = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }

    try:
        url = f'https://search.daum.net/search?w=tot&q={enc_q}'
        req = urllib.request.Request(url, headers=h)
        with urllib.request.urlopen(req, context=ctx, timeout=3.5) as resp:
            content = resp.read().decode('utf-8', errors='ignore')
        items = re.findall(r'<a[^>]+href="(https?://[^"]+)"[^>]*>([\s\S]*?)</a>', content)
        for link, raw_txt in items:
            clean_txt = html.unescape(re.sub(r'<[^>]+>', '', raw_txt)).strip()
            if len(clean_txt) > 12 and not link.startswith('https://search.daum.net') and not any(r['url'] == link for r in results):
                results.append({
                    'title': clean_txt,
                    'url': link,
                    'source': 'Daum',
                    'domain': urllib.parse.urlparse(link).netloc,
                    'snippet': f'다음 통합 검색결과: {clean_txt}'
                })
                if len(results) >= 8:
                    break
    except Exception:
        pass

    results.append({
        'title': f"'{clean_q}' Daum(다음) 통합검색 바로가기",
        'url': f"https://search.daum.net/search?q={enc_q}",
        'source': 'Daum',
        'domain': 'daum.net',
        'isOfficial': True,
        'snippet': f"다음 포털에서 '{clean_q}'의 최신 뉴스, 카페, 티스토리 블로그 글을 탐색합니다."
    })
    return results

def fetch_namu_search(query):
    results = []
    clean_q = query.strip()
    if not clean_q: return results
    enc_q = urllib.parse.quote(clean_q)
    ctx = ssl._create_unverified_context()
    h = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

    try:
        w_url = f"https://ko.wikipedia.org/w/api.php?action=query&list=search&srsearch={enc_q}&format=json&utf8=1"
        req = urllib.request.Request(w_url, headers=h)
        with urllib.request.urlopen(req, context=ctx, timeout=3.5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        for item in data.get("query", {}).get("search", [])[:8]:
            t = item.get("title", "")
            s = html.unescape(re.sub(r'<[^>]+>', '', item.get("snippet", "")))
            if t:
                results.append({
                    "title": t + " (백과사전 문서)",
                    "url": f"https://namu.wiki/w/{urllib.parse.quote(t)}",
                    "source": "나무위키",
                    "domain": "namu.wiki",
                    "snippet": s or f"{t}에 관한 백과사전 및 나무위키 지식 정보입니다."
                })
    except Exception:
        pass

    results.append({
        'title': f"'{clean_q}' 나무위키(NamuWiki) 문서 열람",
        'url': f"https://namu.wiki/w/{enc_q}",
        'source': '나무위키',
        'domain': 'namu.wiki',
        'isOfficial': True,
        'snippet': f"나무위키에서 '{clean_q}'에 관한 깊이 있는 지식과 상세한 설명 문서를 확인하세요."
    })
    return results

def generate_search_ai_summary(query, search_snippets):
    api_key = get_gemini_key()
    prompt = f"""당신은 nunuSky(누누스카이) 웹 브라우저의 스마트 AI 검색 엔진입니다.
사용자 검색어: '{query}'
수집된 실시간 검색 정보:
{chr(10).join(search_snippets[:5])}

위 내용을 바탕으로 네이버와 구글의 AI Overview처럼, 검색어 '{query}'에 대해 핵심적이고 명쾌한 한국어 요약 브리핑을 작성하세요.
- 첫 문장에서 검색어의 핵심 개념 또는 최신 현황을 명확히 정의하세요.
- 주요 핵심 포인트 2~3개를 '•' 불릿 기호와 함께 **중요 단어 볼드체**로 설명하세요.
- 3~4줄 분량으로 가독성 높게 작성하세요."""

    if api_key:
        candidate_models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-pro"]
        for model_id in candidate_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
                req_payload = {"contents": [{"parts": [{"text": prompt}]}]}
                req = urllib.request.Request(
                    url,
                    data=json.dumps(req_payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=3.5) as resp:
                    res_json = json.loads(resp.read().decode("utf-8"))
                    candidates = res_json.get("candidates", [])
                    if candidates:
                        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                        if text:
                            return text
            except Exception:
                pass

    #     # Intelligent Extractive Synthesis Fallback
    if search_snippets:
        clean_snips = [s for s in search_snippets if len(s) > 15]
        first = clean_snips[0] if clean_snips else f"'{query}'에 관한 실시간 종합 검색 정보입니다."
        bullets = []
        for s in clean_snips[1:4]:
            bullets.append(f"• **주요 내용**: {s}")
        return f"**{query}**에 대한 nunu AI 실시간 요약 브리핑입니다.\n\n{first}\n\n" + "\n".join(bullets)
    return f"**{query}**에 대한 nunu AI 브리핑: 실시간 5대 포털(Google, Naver, YouTube, Daum, 나무위키) 종합 검색 데이터를 바탕으로 최신 정보를 전달합니다."

def generate_ai_sidechat_reply(message, title, url, page_text):
    api_key = get_gemini_key()
    prompt = f"""당신은 nunuSky(누누스카이) 웹 브라우저의 전용 'AI Chat 어시스턴트'입니다.
현재 사용자는 왼쪽 브라우저 화면에서 아래 웹 페이지를 보면서 당신과 대화하고 있습니다.

[현재 화면 정보]
- 페이지 제목: {title}
- 페이지 URL: {url}
- 화면 주요 내용:
{page_text if page_text else '(내용 없음)'}

[사용자의 질문]
"{message}"

규칙:
1. 사용자가 보고 있는 왼쪽 화면의 내용을 적극적으로 참고하여 정확하고 친절하게 답변하세요.
2. 만약 사용자가 "화면 요약해줘" 또는 "이 페이지 내용 뭐야?"라고 물으면, 화면 주요 내용을 한눈에 보기 쉽게 3~4개 불릿 포인트로 요약하세요.
3. 한국어로 자연스럽고 정중하게 답변하세요."""

    if api_key:
        candidate_models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-pro"]
        for model_id in candidate_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
                req_payload = {"contents": [{"parts": [{"text": prompt}]}]}
                req = urllib.request.Request(
                    url,
                    data=json.dumps(req_payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=12) as resp:
                    res_json = json.loads(resp.read().decode("utf-8"))
                    candidates = res_json.get("candidates", [])
                    if candidates:
                        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                        if text:
                            return text
            except Exception:
                pass

    if "요약" in message:
        return f"📄 **현재 보고 계신 화면('{title}') 요약**입니다:\n\n• **화면 주소**: {url}\n• **내용 개요**: {page_text[:220]}...\n\n궁금하신 점이 있다면 언제든 편하게 물어보세요!"
    return f"현재 화면 **'{title}'**의 내용을 확인했습니다. '{message}'에 대해 질문해 주셨네요. 추가로 필요한 정보나 분석이 있다면 말씀해 주세요!"

def perform_multisource_search(query):
    """5대 포털(Google, Naver, YouTube, Daum, 나무위키) 병렬 실시간 검색"""
    clean_q = query.strip()
    if not clean_q:
        return {
            "results": [],
            "googleResults": [],
            "naverResults": [],
            "youtubeResults": [],
            "daumResults": [],
            "namuResults": []
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        fut_g = executor.submit(fetch_google_search, clean_q)
        fut_n = executor.submit(fetch_naver_search, clean_q)
        fut_y = executor.submit(fetch_youtube_search, clean_q)
        fut_d = executor.submit(fetch_daum_search, clean_q)
        fut_w = executor.submit(fetch_namu_search, clean_q)

        g_res = fut_g.result()
        n_res = fut_n.result()
        y_res = fut_y.result()
        d_res = fut_d.result()
        w_res = fut_w.result()

    # Collect snippets for AI Overview
    snippets = []
    for item in (w_res + g_res + n_res):
        s = item.get("snippet", "")
        if s and len(s) > 10:
            snippets.append(s)

    # Generate AI Overview
    ai_summary = generate_search_ai_summary(clean_q, snippets)

    # Unified list (top picks from each)
    unified = []
    unified.extend(w_res[:3])
    unified.extend(g_res[:3])
    unified.extend(n_res[:3])
    unified.extend(y_res[:3])
    unified.extend(d_res[:2])

    return {
        "results": unified,
        "googleResults": g_res,
        "naverResults": n_res,
        "youtubeResults": y_res,
        "daumResults": d_res,
        "namuResults": w_res,
        "aiSummary": ai_summary
    }

def perform_web_search(query):
    data = perform_multisource_search(query)
    return data.get("results", [])

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0

def get_local_ip():
    """스마트폰 등 다른 기기 접속을 위한 로컬 네트워크 IP 감지"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def launch_bookwave_server():
    return True, "https://bookwave-server.onrender.com"

def init_db():
    """SQLite 데이터베이스: users, ai_sessions, ai_messages 테이블 초기화"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # 1. 회원 정보 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            is_pro INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("PRAGMA table_info(users)")
    cols = [col[1] for col in cursor.fetchall()]
    if "is_pro" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN is_pro INTEGER DEFAULT 0")
    if "credits" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 20")
    if "last_credit_date" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN last_credit_date TEXT DEFAULT ''")
    if "ads_enabled" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN ads_enabled INTEGER DEFAULT 1")

    # 2. 계정별 AI 대화 세션 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ai_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    # 3. AI 대화 메시지 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ai_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            text TEXT NOT NULL,
            html TEXT,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_sessions(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id)")
    # 4. 시스템 설정 및 Gemini API 키 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('daily_credit_limit', '20')")
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('global_ads_enabled', '1')")

    # 5. 홈 화면 광고 관리 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            desc TEXT DEFAULT '',
            link_url TEXT NOT NULL,
            media_type TEXT DEFAULT 'none', -- 'none' | 'image' | 'video'
            media_url TEXT DEFAULT '',
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        )
    """)
    # 6. nunu 메일 및 문자 메시지 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mail_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_email TEXT NOT NULL,
            from_name TEXT NOT NULL,
            to_email TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            is_starred INTEGER DEFAULT 0,
            is_trash INTEGER DEFAULT 0,
            mail_type TEXT DEFAULT 'mail', -- 'mail' | 'sms' | 'system'
            provider TEXT DEFAULT 'nunu', -- 'nunu' | 'gmail' | 'naver' | 'external'
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mail_to ON mail_messages(to_email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mail_from ON mail_messages(from_email)")

    # 7. 탈로스(Talos) 공식 시험지 및 정답 관리 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS talos_tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_code TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            subject TEXT DEFAULT '',
            grade TEXT DEFAULT '',
            total_points INTEGER DEFAULT 100,
            question_count INTEGER DEFAULT 0,
            questions_json TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()

init_db()

def send_welcome_mail_if_needed(user_id, user_name="회원"):
    """새 회원 또는 메일함이 빈 사용자에게 nunu 메일 환영 안내 메일 발송"""
    if not user_id or user_id == "nunu_member": return
    target_email = f"{user_id.lower()}@nunu.com" if "@" not in user_id else user_id.lower()
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # 실제 가입된 회원인지 확인
        cursor.execute("SELECT id, name FROM users WHERE LOWER(id) = LOWER(?)", (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            conn.close()
            return
        actual_name = user_row[1] or user_name

        cursor.execute("SELECT id FROM mail_messages WHERE LOWER(to_email) = ? OR LOWER(to_email) = ? LIMIT 1", (target_email, user_id.lower()))
        if not cursor.fetchone():
            created_at = datetime.now().isoformat()
            cursor.execute("""
                INSERT INTO mail_messages (from_email, from_name, to_email, subject, body, is_read, mail_type, provider, created_at)
                VALUES (?, ?, ?, ?, ?, 0, 'system', 'nunu', ?)
            """, (
                "welcome@nunu.com",
                "nunu 메일 운영팀",
                target_email,
                f"🎉 [nunu 메일] {actual_name}님의 전용 메일({target_email}) 개설을 축하합니다!",
                f"안녕하세요, {user_name}님!\n\nnunu 포털 및 nunu 전용 메일 서비스 가입을 진심으로 환영합니다.\n\n"
                f"■ 회원님의 전용 메일 주소: {target_email}\n"
                f"■ 제공되는 주요 기능:\n"
                "  1. nunu 회원 간 자유로운 실시간 이메일 및 문자 송수신\n"
                "  2. 외부 메일(Gmail, Naver 등) 수신 웹훅 연동 및 시뮬레이션 지원\n"
                "  3. 중요 메일 보관, 실시간 검색, 답장 및 휴지통 관리\n\n"
                "상단 '메일 쓰기' 또는 '외부 메일 수신 테스트' 버튼을 눌러 바로 메일을 주고받아 보세요!\n\n"
                "- nunu 포털 & 메일 서비스 팀 드림",
                created_at
            ))
            conn.commit()
        conn.close()
    except Exception as e:
        print("환영 메일 전송 예외:", e)

def get_global_ads_enabled():
    """홈 화면 전체 광고 활성화 여부 조회 (1: 활성화, 0: 비활성화)"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = 'global_ads_enabled'")
        row = cursor.fetchone()
        conn.close()
        return bool(row and row[0].strip() == '1')
    except Exception:
        return True

def set_global_ads_enabled(enabled):
    """홈 화면 전체 광고 활성화 여부 설정"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('global_ads_enabled', ?)", ('1' if enabled else '0',))
    conn.commit()
    conn.close()

def get_daily_credit_limit():
    """매일 기본 충전 크레딧 한도 조회"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = 'daily_credit_limit'")
        row = cursor.fetchone()
        conn.close()
        return int(row[0].strip()) if row and row[0].strip().isdigit() else 20
    except Exception:
        return 20

def set_daily_credit_limit(val):
    """매일 기본 충전 크레딧 한도 설정"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_credit_limit', ?)", (str(int(val)),))
    conn.commit()
    conn.close()

def ensure_daily_user_credits(user_id):
    """새로운 날짜 접속 시 일일 기본 크레딧 자동 충전 보장"""
    today_str = datetime.now().strftime("%Y-%m-%d")
    daily_limit = get_daily_credit_limit()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, credits, last_credit_date FROM users WHERE LOWER(id) = LOWER(?)", (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return 0, daily_limit

    current_credits = row["credits"] if row["credits"] is not None else daily_limit
    last_date = row["last_credit_date"] or ""

    if last_date != today_str:
        if current_credits < daily_limit:
            current_credits = daily_limit
        cursor.execute("UPDATE users SET credits = ?, last_credit_date = ? WHERE LOWER(id) = LOWER(?)", (current_credits, today_str, user_id))
        conn.commit()

    conn.close()
    return current_credits, daily_limit

def get_gemini_key():
    """Gemini API 키 조회 (환경변수, SQLite DB, 또는 로컬 파일)"""
    env_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if env_key:
        return env_key
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = 'gemini_api_key'")
        row = cursor.fetchone()
        conn.close()
        if row and row[0].strip():
            return row[0].strip()
    except Exception:
        pass

    key_file = os.path.join(BASE_DIR, "gemini_key.txt")
    if os.path.exists(key_file):
        try:
            with open(key_file, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    return content
        except Exception:
            pass
    return ""

def set_gemini_key(key_val):
    """Gemini API 키 저장 (SQLite DB 및 로컬 파일 보관)"""
    clean_key = key_val.strip()
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('gemini_api_key', ?)", (clean_key,))
        conn.commit()
        conn.close()
    except Exception:
        pass

    try:
        key_file = os.path.join(BASE_DIR, "gemini_key.txt")
        with open(key_file, "w", encoding="utf-8") as f:
            f.write(clean_key)
    except Exception:
        pass

class NunuHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _send_json(self, status_code, data):
        try:
            body_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body_bytes)))
            self.send_header("Connection", "close")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body_bytes)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, OSError):
            pass
        finally:
            self.close_connection = True

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 0. Download nunuSky App Package (단일 독립 실행 설치 파일 nunuSky_Setup.exe)
        if path in ("/download/nunusky", "/download/nunuSky_Setup.exe", "/nunuSky_Setup.exe", "/download/nunuSky_App_Setup.zip", "/nunuSky_App_Setup.zip"):
            exe_file = os.path.join(BASE_DIR, "nunuSky_Setup.exe")
            if os.path.exists(exe_file):
                with open(exe_file, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.microsoft.portable-executable")
                self.send_header("Content-Disposition", 'attachment; filename="nunuSky_Setup.exe"')
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            else:
                zip_file = os.path.join(BASE_DIR, "nunuSky_App_Setup.zip")
                if os.path.exists(zip_file):
                    with open(zip_file, "rb") as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/zip")
                    self.send_header("Content-Disposition", 'attachment; filename="nunuSky_App_Setup.zip"')
                    self.send_header("Content-Length", str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                    return
                else:
                    self._send_json(404, {"success": False, "message": "다운로드 설치 파일이 아직 준비되지 않았습니다."})
                    return
        query = urllib.parse.parse_qs(parsed.query)

        # 0-1. API: 비상정지 상태 확인
        if path == "/api/emergency-status":
            st = get_emergency_status()
            self._send_json(200, {
                "success": True,
                **st
            })
            return

        # 1. API: 아이디 중복 확인
        if path == "/api/check-id":
            user_id = query.get("id", [""])[0].strip()
            if not user_id:
                self._send_json(400, {"success": False, "message": "아이디를 입력해주세요."})
                return
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE LOWER(id) = LOWER(?)", (user_id,))
            row = cursor.fetchone()
            conn.close()

            is_duplicate = row is not None
            self._send_json(200, {
                "success": True,
                "isDuplicate": is_duplicate,
                "message": "이미 사용 중인 아이디입니다." if is_duplicate else "사용 가능한 아이디입니다."
            })
            return

        # 2. API: 전체 회원 목록 조회 (관리자 전용)
        if path == "/api/users":
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, email, password, is_pro, credits, ads_enabled, created_at FROM users ORDER BY created_at DESC")
            rows = cursor.fetchall()
            conn.close()

            users = []
            for r in rows:
                c_val = r["credits"] if ("credits" in r.keys() and r["credits"] is not None) else 20
                ads_en = bool(r["ads_enabled"]) if ("ads_enabled" in r.keys() and r["ads_enabled"] is not None) else True
                users.append({
                    "id": r["id"],
                    "name": r["name"],
                    "email": r["email"],
                    "password": r["password"],
                    "isPro": bool(r["is_pro"]),
                    "credits": c_val,
                    "adsEnabled": ads_en,
                    "createdAt": r["created_at"]
                })
            self._send_json(200, {"success": True, "users": users, "dailyLimit": get_daily_credit_limit()})
            return

        # 2-1. API: 개별 계정의 AI PRO 권한 및 크레딧 실시간 상태 조회
        if path == "/api/user-status":
            user_id = query.get("id", [""])[0].strip()
            if not user_id:
                self._send_json(400, {"success": False, "message": "id 파라미터가 필요합니다."})
                return
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, is_pro, credits, ads_enabled FROM users WHERE LOWER(id) = LOWER(?)", (user_id,))
            row = cursor.fetchone()
            conn.close()
            if row:
                current_credits, daily_limit = ensure_daily_user_credits(user_id)
                ads_en = bool(row["ads_enabled"]) if ("ads_enabled" in row.keys() and row["ads_enabled"] is not None) else True
                self._send_json(200, {
                    "success": True,
                    "id": row["id"],
                    "name": row["name"],
                    "isPro": bool(row["is_pro"]),
                    "credits": current_credits,
                    "adsEnabled": ads_en,
                    "dailyLimit": daily_limit
                })
            else:
                self._send_json(404, {"success": False, "message": "사용자를 찾을 수 없습니다.", "isPro": False, "credits": 0, "dailyLimit": get_daily_credit_limit()})
            return

        # 2-2. API: 일일 크레딧 한도 설정 조회
        if path == "/api/credits/config":
            self._send_json(200, {
                "success": True,
                "dailyLimit": get_daily_credit_limit()
            })
            return

        # 3. API: 북웨이브 프로젝트 실행
        if path == "/api/launch-bookwave":
            success, url_or_msg = launch_bookwave_server()
            if success:
                self._send_json(200, {"success": True, "url": url_or_msg})
            else:
                self._send_json(500, {"success": False, "message": url_or_msg})
            return

        # 4. API: 네트워크 접속 정보 (스마트폰 / 다른 기기 접속용 IP 및 외부 접속 URL)
        if path == "/api/network-info":
            local_ip = get_local_ip()
            public_url = get_public_tunnel_url()
            self._send_json(200, {
                "success": True,
                "localIp": local_ip,
                "port": PORT,
                "localUrl": f"http://localhost:{PORT}",
                "networkUrl": f"http://{local_ip}:{PORT}",
                "publicUrl": public_url
            })
            return

        # 5. API: 실시간 웹 검색 (/api/search?q=...)
        if path == "/api/search":
            q_str = query.get("q", [""])[0].strip()
            if not q_str:
                self._send_json(400, {"success": False, "message": "검색어를 입력해주세요."})
                return
            search_data = perform_multisource_search(q_str)
            self._send_json(200, {
                "success": True,
                "query": q_str,
                "total": len(search_data.get("results", [])),
                **search_data
            })
            return

        # 6. API: 계정별 AI 대화 세션 목록 조회
        if path == "/api/ai/sessions":
            user_id = query.get("user_id", [""])[0].strip()
            if not user_id:
                self._send_json(400, {"success": False, "message": "user_id가 필요합니다."})
                return
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id, user_id, title, created_at, updated_at FROM ai_sessions WHERE user_id = ? ORDER BY updated_at DESC", (user_id,))
            rows = cursor.fetchall()
            conn.close()
            sessions = [{
                "id": r["id"],
                "userId": r["user_id"],
                "title": r["title"],
                "createdAt": r["created_at"],
                "updatedAt": r["updated_at"]
            } for r in rows]
            self._send_json(200, {"success": True, "sessions": sessions})
            return

        # 7. API: 특정 세션의 AI 대화 메시지 목록 조회
        if path == "/api/ai/messages":
            session_id = query.get("session_id", [""])[0].strip()
            if not session_id:
                self._send_json(400, {"success": False, "message": "session_id가 필요합니다."})
                return
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id, session_id, role, text, html, created_at FROM ai_messages WHERE session_id = ? ORDER BY id ASC", (session_id,))
            rows = cursor.fetchall()
            conn.close()
            messages = [{
                "id": r["id"],
                "sessionId": r["session_id"],
                "role": r["role"],
                "text": r["text"],
                "html": r["html"],
                "time": r["created_at"]
            } for r in rows]
            self._send_json(200, {"success": True, "messages": messages})
            return

        # 8. API: nunu AI 실시간 모델 및 설정 조회
        if path == "/api/gemini/config":
            key = get_gemini_key()
            has_key = bool(key)
            masked = key[:6] + "..." + key[-4:] if len(key) > 10 else ("등록됨" if has_key else "")
            self._send_json(200, {
                "success": True,
                "hasKey": has_key,
                "maskedKey": masked,
                "standardModel": "gemini-3.8-flash",
                "proModel": "gemini-3.1-pro-preview",
                "model": "nunu AI (기본: gemini-3.8-flash / PRO: gemini-3.1-pro-preview)",
                "capabilities": ["language", "image", "music", "video"]
            })
            return

        # 8-1. API: 홈 화면 광고 목록 조회 (전체 활성화 여부 확인 및 최대 2개 표출, 3개 이상 시 랜덤 2개)
        # 8-1. API: 홈 화면 광고 목록 조회 (전체 활성화 여부 및 개인(계정별) 활성화 여부 확인 및 최대 2개 표출)
        if path == "/api/ads":
            global_enabled = get_global_ads_enabled()
            if not global_enabled:
                self._send_json(200, {
                    "success": True,
                    "globalAdsEnabled": False,
                    "userAdsEnabled": True,
                    "ads": []
                })
                return

            # 개인(계정별) 광고 ON/OFF 확인
            user_id = query.get("user_id", [""])[0].strip()
            user_ads_enabled = True
            if user_id:
                try:
                    conn_u = sqlite3.connect(DB_PATH)
                    conn_u.row_factory = sqlite3.Row
                    cur_u = conn_u.cursor()
                    cur_u.execute("SELECT ads_enabled FROM users WHERE LOWER(id) = LOWER(?)", (user_id,))
                    u_row = cur_u.fetchone()
                    conn_u.close()
                    if u_row and u_row["ads_enabled"] is not None and u_row["ads_enabled"] == 0:
                        user_ads_enabled = False
                except Exception:
                    pass

            if not user_ads_enabled:
                self._send_json(200, {
                    "success": True,
                    "globalAdsEnabled": True,
                    "userAdsEnabled": False,
                    "ads": []
                })
                return

            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id, title, desc, link_url, media_type, media_url, is_active, created_at FROM ads WHERE is_active = 1 ORDER BY id DESC")
            rows = cursor.fetchall()
            conn.close()

            active_ads = [{
                "id": r["id"],
                "title": r["title"],
                "desc": r["desc"] or "",
                "linkUrl": r["link_url"],
                "mediaType": r["media_type"] or "none",
                "mediaUrl": r["media_url"] or "",
                "isActive": bool(r["is_active"]),
                "createdAt": r["created_at"]
            } for r in rows]

            # 3개 이상이면 랜덤으로 2개 선택, 그 외엔 최대 2개
            if len(active_ads) >= 3:
                chosen_ads = random.sample(active_ads, 2)
            else:
                chosen_ads = active_ads[:2]

            self._send_json(200, {
                "success": True,
                "globalAdsEnabled": True,
                "userAdsEnabled": True,
                "ads": chosen_ads
            })
            return

        # 8-2. API: 관리자 전용 전체 광고 목록 및 전체 ON/OFF 상태 조회
        if path == "/api/admin/ads":
            global_enabled = get_global_ads_enabled()
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id, title, desc, link_url, media_type, media_url, is_active, created_at FROM ads ORDER BY id DESC")
            rows = cursor.fetchall()
            conn.close()

            ads_list = [{
                "id": r["id"],
                "title": r["title"],
                "desc": r["desc"] or "",
                "linkUrl": r["link_url"],
                "mediaType": r["media_type"] or "none",
                "mediaUrl": r["media_url"] or "",
                "isActive": bool(r["is_active"]),
                "createdAt": r["created_at"]
            } for r in rows]

            self._send_json(200, {
                "success": True,
                "globalAdsEnabled": global_enabled,
                "ads": ads_list
            })
            return

        # 8-2-1. API: 탈로스(Talos) 공식 시험지 목록 조회 (/api/talos-tests 또는 /api/admin/talos-tests)
        if path in ("/api/talos-tests", "/api/admin/talos-tests"):
            is_admin_req = (path == "/api/admin/talos-tests") or (query.get("admin", ["0"])[0] == "1")
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            if is_admin_req:
                cursor.execute("SELECT id, test_code, title, subject, grade, total_points, question_count, questions_json, auth_code, is_active, created_at FROM talos_tests ORDER BY id DESC")
            else:
                cursor.execute("SELECT id, test_code, title, subject, grade, total_points, question_count, questions_json, is_active, created_at FROM talos_tests WHERE is_active = 1 ORDER BY id DESC")
            rows = cursor.fetchall()
            conn.close()

            tests_list = []
            for r in rows:
                try:
                    q_list = json.loads(r["questions_json"])
                except Exception:
                    q_list = []
                item = {
                    "id": r["id"],
                    "testCode": r["test_code"],
                    "title": r["title"],
                    "subject": r["subject"] or "",
                    "grade": r["grade"] or "",
                    "totalPoints": r["total_points"] or 100,
                    "questionCount": r["question_count"] or len(q_list),
                    "questions": q_list,
                    "isActive": bool(r["is_active"]),
                    "createdAt": r["created_at"]
                }
                if is_admin_req:
                    item["authCode"] = r["auth_code"] or ""
                tests_list.append(item)

            self._send_json(200, {
                "success": True,
                "company": "탈로스(Talos)",
                "tests": tests_list
            })
            return

        # 8-3. API: nunu 메일 목록 조회 (/api/mail/list?user_id=...&box=inbox|sent|starred|trash&q=...)
        if path == "/api/mail/list":
            query = urllib.parse.parse_qs(parsed.query)
            user_id = query.get("user_id", [""])[0].strip()
            box = query.get("box", ["inbox"])[0].strip()
            search = query.get("q", [""])[0].strip().lower()

            if not user_id:
                self._send_json(400, {"success": False, "message": "user_id가 필요합니다."})
                return

            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # 해당 회원의 DB 공식 정보 조회 (id, name, email)
            cursor.execute("SELECT id, name, email FROM users WHERE LOWER(id) = LOWER(?) OR LOWER(email) = LOWER(?)", (user_id, user_id))
            u_row = cursor.fetchone()
            actual_id = (u_row["id"] if u_row else user_id).lower()
            actual_name = u_row["name"] if u_row else actual_id
            reg_email = (u_row["email"] if u_row else "").lower()
            user_email = reg_email if (reg_email and "@" in reg_email) else f"{actual_id}@nunu.com"

            send_welcome_mail_if_needed(actual_id, actual_name)

            # 이 사용자를 가리킬 수 있는 모든 별칭/주소 목록
            user_aliases = set()
            user_aliases.add(user_id.lower())
            user_aliases.add(f"{user_id.lower()}@nunu.com")
            user_aliases.add(actual_id)
            user_aliases.add(f"{actual_id}@nunu.com")
            if reg_email:
                user_aliases.add(reg_email)
                if "@" in reg_email:
                    user_aliases.add(reg_email.split("@")[0])
            user_aliases = [a for a in user_aliases if a]

            in_placeholders = ",".join("?" for _ in user_aliases)

            # 받은 편지함 미확인 개수
            cursor.execute(f"""
                SELECT COUNT(*) as cnt FROM mail_messages 
                WHERE LOWER(to_email) IN ({in_placeholders}) 
                  AND is_trash = 0 AND is_read = 0
            """, user_aliases)
            unread_inbox = cursor.fetchone()["cnt"]

            if box == "sent":
                sql = f"""
                    SELECT * FROM mail_messages 
                    WHERE LOWER(from_email) IN ({in_placeholders}) AND is_trash = 0
                """
                params = list(user_aliases)
            elif box == "starred":
                sql = f"""
                    SELECT * FROM mail_messages 
                    WHERE (LOWER(to_email) IN ({in_placeholders}) OR LOWER(from_email) IN ({in_placeholders}))
                      AND is_trash = 0 AND is_starred = 1
                """
                params = list(user_aliases) + list(user_aliases)
            elif box == "trash":
                sql = f"""
                    SELECT * FROM mail_messages 
                    WHERE (LOWER(to_email) IN ({in_placeholders}) OR LOWER(from_email) IN ({in_placeholders}))
                      AND is_trash = 1
                """
                params = list(user_aliases) + list(user_aliases)
            else: # inbox
                sql = f"""
                    SELECT * FROM mail_messages 
                    WHERE LOWER(to_email) IN ({in_placeholders}) AND is_trash = 0
                """
                params = list(user_aliases)

            if search:
                sql += " AND (LOWER(subject) LIKE ? OR LOWER(body) LIKE ? OR LOWER(from_name) LIKE ? OR LOWER(from_email) LIKE ?)"
                sp = f"%{search}%"
                params.extend([sp, sp, sp, sp])

            sql += " ORDER BY id DESC LIMIT 100"
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            conn.close()

            mails = [{
                "id": r["id"],
                "fromEmail": r["from_email"],
                "fromName": r["from_name"],
                "toEmail": r["to_email"],
                "subject": r["subject"],
                "body": r["body"],
                "isRead": bool(r["is_read"]),
                "isStarred": bool(r["is_starred"]),
                "isTrash": bool(r["is_trash"]),
                "mailType": r["mail_type"] if "mail_type" in r.keys() else "mail",
                "provider": r["provider"] if "provider" in r.keys() else "nunu",
                "createdAt": r["created_at"]
            } for r in rows]

            self._send_json(200, {
                "success": True,
                "box": box,
                "userEmail": user_email,
                "unreadInbox": unread_inbox,
                "mails": mails
            })
            return

        # 8-4. API: nunu 메일 상세 보기 및 읽음 처리 (/api/mail/detail?id=...)
        if path == "/api/mail/detail":
            query = urllib.parse.parse_qs(parsed.query)
            mail_id = query.get("id", [""])[0].strip()
            if not mail_id:
                self._send_json(400, {"success": False, "message": "id가 필요합니다."})
                return

            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM mail_messages WHERE id = ?", (mail_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                self._send_json(404, {"success": False, "message": "메일을 찾을 수 없습니다."})
                return

            cursor.execute("UPDATE mail_messages SET is_read = 1 WHERE id = ?", (mail_id,))
            conn.commit()
            conn.close()

            self._send_json(200, {
                "success": True,
                "mail": {
                    "id": row["id"],
                    "fromEmail": row["from_email"],
                    "fromName": row["from_name"],
                    "toEmail": row["to_email"],
                    "subject": row["subject"],
                    "body": row["body"],
                    "isRead": True,
                    "isStarred": bool(row["is_starred"]),
                    "isTrash": bool(row["is_trash"]),
                    "mailType": row["mail_type"] if "mail_type" in row.keys() else "mail",
                    "provider": row["provider"] if "provider" in row.keys() else "nunu",
                    "createdAt": row["created_at"]
                }
            })
            return

        # 8-5. API: nunu 메일 안 읽은 개수 조회 (/api/mail/stats?user_id=...)
        if path == "/api/mail/stats":
            query = urllib.parse.parse_qs(parsed.query)
            user_id = query.get("user_id", [""])[0].strip()
            if not user_id:
                self._send_json(200, {"success": True, "unread": 0, "email": ""})
                return

            send_welcome_mail_if_needed(user_id, user_id)
            user_email = f"{user_id.lower()}@nunu.com"
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) FROM mail_messages 
                WHERE (LOWER(to_email) = ? OR LOWER(to_email) = ?) 
                  AND is_trash = 0 AND is_read = 0
            """, (user_email, user_id.lower()))
            row = cursor.fetchone()
            conn.close()
            self._send_json(200, {"success": True, "unread": row[0] if row else 0, "email": user_email})
            return

        # 8. 루트 접근 시 index.html 서빙
        if path == "/" or path == "":
            self.path = "/index.html"
            return super().do_GET()

        # 9. /ai 및 /chat 접근 시 ai.html 서빙
        if path in ("/ai", "/ai/", "/chat", "/chat/"):
            self.path = "/ai.html"
            return super().do_GET()

        # 10. /mail 접근 시 mail.html 서빙
        if path in ("/mail", "/mail/"):
            self.path = "/mail.html"
            return super().do_GET()

        # 10-1. /admin 또는 admin.html 접근 차단 (관리자웹은 별도 프로젝트 nunu-admin 으로 완전 분리)
        if path in ("/admin", "/admin/", "/admin.html"):
            body = "<h3>[403 접근 금지] 관리자 페이지는 보안을 위해 독립 프로젝트(nunu-admin)로 분리되었습니다.</h3>".encode("utf-8")
            self.send_response(403)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return



        # 10-2. /diary 접근 시 diary.html 서빙
        if path in ("/diary", "/diary/", "/writing", "/writing/"):
            self.path = "/diary.html"
            return super().do_GET()

        # 11. 정적 파일 기본 처리
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8")
        try:
            data = json.loads(body) if body else {}
        except Exception:
            self._send_json(400, {"success": False, "message": "잘못된 JSON 형식입니다."})
            return

        # 0-0. API: 긴급 비상정지 제어 (/api/emergency-stop)
        if path == "/api/emergency-stop":
            active = bool(data.get("active", True))
            msg = data.get("message", "관리자로 인해 종료되었습니다.")
            res = set_emergency_status(active, msg)
            self._send_json(200, {
                "success": True,
                **res
            })
            return

        # 0. API: 파일 업로드 (/api/upload)
        if path == "/api/upload":
            file_name = data.get("fileName", "upload").strip()
            data_url = data.get("dataUrl", "").strip()
            if not data_url or "," not in data_url:
                self._send_json(400, {"success": False, "message": "유효한 파일 데이터가 아닙니다."})
                return

            try:
                header, b64_str = data_url.split(",", 1)
                file_bytes = base64.b64decode(b64_str)
                
                # 안전한 파일명 생성
                ext = os.path.splitext(file_name)[1].lower()
                if not ext:
                    if "image/jpeg" in header: ext = ".jpg"
                    elif "image/png" in header: ext = ".png"
                    elif "image/gif" in header: ext = ".gif"
                    elif "image/webp" in header: ext = ".webp"
                    elif "video/mp4" in header: ext = ".mp4"
                    elif "video/webm" in header: ext = ".webm"
                    else: ext = ".bin"

                uploads_dir = os.path.join(BASE_DIR, "uploads")
                if not os.path.exists(uploads_dir):
                    os.makedirs(uploads_dir, exist_ok=True)

                saved_name = f"ad_{int(time.time())}_{random.randint(1000, 9999)}{ext}"
                file_path = os.path.join(uploads_dir, saved_name)
                with open(file_path, "wb") as f:
                    f.write(file_bytes)

                public_url = f"/uploads/{saved_name}"
                self._send_json(200, {
                    "success": True,
                    "url": public_url,
                    "fileName": saved_name
                })
            except Exception as e:
                self._send_json(500, {"success": False, "message": f"파일 저장 실패: {str(e)}"})
            return

        # 1. API: 회원가입
        if path == "/api/signup" or path == "/api/users":
            user_id = data.get("id", "").strip()
            name = data.get("name", "").strip()
            email = data.get("email", "").strip()
            password = data.get("password", "").strip()

            if not user_id or not name or not email or not password:
                self._send_json(400, {"success": False, "message": "모든 항목을 입력해주세요."})
                return

            if len(user_id) < 3:
                self._send_json(400, {"success": False, "message": "아이디는 3자 이상이어야 합니다."})
                return

            if len(password) < 4:
                self._send_json(400, {"success": False, "message": "비밀번호는 4자 이상이어야 합니다."})
                return

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE LOWER(id) = LOWER(?)", (user_id,))
            if cursor.fetchone():
                conn.close()
                self._send_json(409, {"success": False, "message": "이미 존재하는 아이디입니다."})
                return

            created_at = datetime.now().isoformat()
            today_str = datetime.now().strftime("%Y-%m-%d")
            initial_credits = get_daily_credit_limit()
            cursor.execute(
                "INSERT INTO users (id, name, email, password, is_pro, credits, last_credit_date, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)",
                (user_id, name, email, password, initial_credits, today_str, created_at)
            )
            conn.commit()
            conn.close()

            # nunu 메일 계정 개설 환영 메일 발송
            send_welcome_mail_if_needed(user_id, name)

            self._send_json(201, {
                "success": True,
                "message": "회원가입이 완료되었습니다.",
                "user": {
                    "id": user_id,
                    "name": name,
                    "email": email,
                    "isPro": False,
                    "credits": initial_credits,
                    "dailyLimit": initial_credits,
                    "createdAt": created_at
                }
            })
            return

        # 2. API: 로그인
        if path == "/api/login":
            user_id = data.get("id", "").strip()
            password = data.get("password", "").strip()

            if not user_id or not password:
                self._send_json(400, {"success": False, "message": "아이디와 비밀번호를 입력해주세요."})
                return

            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, name, email, password, is_pro, credits, ads_enabled, created_at FROM users WHERE (LOWER(id) = LOWER(?) OR LOWER(email) = LOWER(?)) AND password = ?",
                (user_id, user_id, password)
            )
            row = cursor.fetchone()
            conn.close()

            if not row:
                self._send_json(401, {
                    "success": False,
                    "message": "일치하는 회원 정보가 없습니다. 아이디와 비밀번호를 확인해주세요."
                })
                return

            # 오늘 날짜에 따른 일일 크레딧 갱신 보장
            current_credits, daily_limit = ensure_daily_user_credits(row["id"])
            ads_en = bool(row["ads_enabled"]) if ("ads_enabled" in row.keys() and row["ads_enabled"] is not None) else True

            # nunu 메일 환영 안내 발송 보장
            send_welcome_mail_if_needed(row["id"], row["name"])

            self._send_json(200, {
                "success": True,
                "message": "로그인 성공",
                "user": {
                    "id": row["id"],
                    "name": row["name"],
                    "email": row["email"],
                    "isPro": bool(row["is_pro"]),
                    "credits": current_credits,
                    "adsEnabled": ads_en,
                    "dailyLimit": daily_limit,
                    "createdAt": row["created_at"]
                }
            })
            return

        # 2-0. API: nunu 관리자 비밀번호 검증 (/api/admin/verify) - 비밀번호 없이 즉시 허용
        if path == "/api/admin/verify":
            self._send_json(200, {
                "success": True,
                "message": "관리자 센터 접근이 승인되었습니다."
            })
            return
        # 2-0-1. API: nunu 메일 전송 (/api/mail/send) - nunu 회원 간 전송만 허용
        if path == "/api/mail/send":
            from_id = data.get("from_id", "").strip()
            from_name = data.get("from_name", "").strip() or from_id
            to_input = data.get("to", "").strip()
            subject = data.get("subject", "").strip()
            body = data.get("body", "").strip()
            mail_type = data.get("mail_type", "mail").strip() # 'mail' or 'sms'

            if not to_input or not body:
                self._send_json(400, {"success": False, "message": "수신자와 메시지 내용을 모두 입력해주세요."})
                return

            to_clean = to_input.lower().strip()

            # nunu 메일 전용 검증: 외부 이메일 주소 전송 엄격 차단
            if "@" in to_clean and not to_clean.endswith("@nunu.com"):
                self._send_json(400, {
                    "success": False,
                    "message": "nunu 메일은 nunu 회원(@nunu.com)에게만 전송할 수 있습니다. 외부 메일(Gmail, Naver 등)로는 전송할 수 없습니다."
                })
                return

            raw_target = to_clean.replace("@nunu.com", "").strip()

            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # 발신자 정보 보정
            if from_id:
                cursor.execute("SELECT id, name FROM users WHERE LOWER(id) = LOWER(?) OR LOWER(email) = LOWER(?)", (from_id, from_id))
                sender_row = cursor.fetchone()
                if sender_row:
                    from_id = sender_row["id"]
                    from_name = sender_row["name"] or from_name
            from_email = f"{from_id.lower()}@nunu.com" if "@" not in from_id else from_id

            # 수신 회원을 id, email, name 등 다양한 조건으로 유연하게 탐색
            cursor.execute("""
                SELECT id, name, email FROM users 
                WHERE LOWER(id) = LOWER(?) 
                   OR LOWER(id) = LOWER(?)
                   OR LOWER(email) = LOWER(?)
                   OR LOWER(email) = LOWER(?)
                   OR LOWER(name) = LOWER(?)
            """, (to_clean, raw_target, to_clean, f"{raw_target}@nunu.com", raw_target))
            target_user = cursor.fetchone()

            if target_user:
                actual_target_id = target_user["id"].lower()
                target_name = target_user["name"] or actual_target_id
                to_email = f"{actual_target_id}@nunu.com"
            else:
                actual_target_id = raw_target
                target_name = raw_target
                to_email = f"{raw_target}@nunu.com"

            if not subject:
                subject = "(제목 없음)" if mail_type == "mail" else "간편 문자 메시지"

            created_at = datetime.now().isoformat()
            cursor.execute("""
                INSERT INTO mail_messages (from_email, from_name, to_email, subject, body, is_read, mail_type, provider, created_at)
                VALUES (?, ?, ?, ?, ?, 0, ?, 'nunu', ?)
            """, (from_email, from_name, to_email, subject, body, mail_type, created_at))
            mail_id = cursor.lastrowid
            conn.commit()
            conn.close()

            self._send_json(200, {
                "success": True,
                "message": f"{target_name}님({to_email})에게 성공적으로 전송되었습니다.",
                "mailId": mail_id
            })
            return

        # 2-0-4. API: nunu 메일 상태 변경 (/api/mail/action)
        if path == "/api/mail/action":
            mail_id = data.get("mail_id")
            action = data.get("action", "").strip()

            if not mail_id or not action:
                self._send_json(400, {"success": False, "message": "mail_id와 action이 필요합니다."})
                return

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            if action == "mark_read":
                cursor.execute("UPDATE mail_messages SET is_read = 1 WHERE id = ?", (mail_id,))
            elif action == "mark_unread":
                cursor.execute("UPDATE mail_messages SET is_read = 0 WHERE id = ?", (mail_id,))
            elif action == "star":
                cursor.execute("UPDATE mail_messages SET is_starred = 1 WHERE id = ?", (mail_id,))
            elif action == "unstar":
                cursor.execute("UPDATE mail_messages SET is_starred = 0 WHERE id = ?", (mail_id,))
            elif action == "trash":
                cursor.execute("UPDATE mail_messages SET is_trash = 1 WHERE id = ?", (mail_id,))
            elif action == "restore":
                cursor.execute("UPDATE mail_messages SET is_trash = 0 WHERE id = ?", (mail_id,))
            elif action == "delete":
                cursor.execute("DELETE FROM mail_messages WHERE id = ?", (mail_id,))
            conn.commit()
            conn.close()

            self._send_json(200, {"success": True, "action": action, "mailId": mail_id})
            return

        # 2-1. API: 관리자 회원 PRO 사용 권한 토글 (/api/users/<user_id>/toggle-pro)
        if path.startswith("/api/users/") and path.endswith("/toggle-pro"):
            parts = path.strip("/").split("/")
            if len(parts) == 4:
                target_user_id = urllib.parse.unquote(parts[2])
                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT is_pro FROM users WHERE LOWER(id) = LOWER(?)", (target_user_id,))
                row = cursor.fetchone()
                if not row:
                    conn.close()
                    self._send_json(404, {"success": False, "message": "사용자를 찾을 수 없습니다."})
                    return

                new_pro = 0 if row["is_pro"] else 1
                cursor.execute("UPDATE users SET is_pro = ? WHERE LOWER(id) = LOWER(?)", (new_pro, target_user_id))
                conn.commit()
                conn.close()

                self._send_json(200, {
                    "success": True,
                    "userId": target_user_id,
                    "isPro": bool(new_pro),
                    "message": f"PRO 사용 권한이 {'부여' if new_pro else '해제'}되었습니다."
                })
                return

        # 2-1.1. API: 특정 회원 개인 광고 ON/OFF 권한 토글 (/api/users/<user_id>/toggle-ads)
        if path.startswith("/api/users/") and path.endswith("/toggle-ads"):
            parts = path.strip("/").split("/")
            if len(parts) == 4:
                target_user_id = urllib.parse.unquote(parts[2])
                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT ads_enabled FROM users WHERE LOWER(id) = LOWER(?)", (target_user_id,))
                row = cursor.fetchone()
                if not row:
                    conn.close()
                    self._send_json(404, {"success": False, "message": "사용자를 찾을 수 없습니다."})
                    return

                cur_en = row["ads_enabled"] if row["ads_enabled"] is not None else 1
                new_en = 0 if cur_en == 1 else 1
                cursor.execute("UPDATE users SET ads_enabled = ? WHERE LOWER(id) = LOWER(?)", (new_en, target_user_id))
                conn.commit()
                conn.close()

                self._send_json(200, {
                    "success": True,
                    "userId": target_user_id,
                    "adsEnabled": bool(new_en),
                    "message": f"[{target_user_id}] 회원의 개인 광고 표시가 {'ON (표출)' if new_en else 'OFF (숨김)'}으로 설정되었습니다."
                })
                return

        # 2-2. API: 관리자 일일 기본 크레딧 한도 설정 (/api/credits/config)
        if path == "/api/credits/config":
            daily_limit = data.get("dailyLimit")
            if daily_limit is None:
                self._send_json(400, {"success": False, "message": "dailyLimit 값이 필요합니다."})
                return
            try:
                limit_int = max(1, int(daily_limit))
                set_daily_credit_limit(limit_int)
                self._send_json(200, {
                    "success": True,
                    "dailyLimit": limit_int,
                    "message": f"매일 기본 충전 한도가 {limit_int}개로 저장되었습니다."
                })
            except Exception:
                self._send_json(400, {"success": False, "message": "유효한 숫자를 입력해주세요."})
            return

        # 2-3. API: 특정 회원 크레딧 지급/차감 (/api/users/<user_id>/credits)
        if path.startswith("/api/users/") and path.endswith("/credits"):
            parts = path.strip("/").split("/")
            if len(parts) == 4:
                target_user_id = urllib.parse.unquote(parts[2])
                try:
                    amount = int(data.get("amount", 0))
                except Exception:
                    amount = 0

                if amount == 0:
                    self._send_json(400, {"success": False, "message": "변경할 크레딧 수량을 입력해주세요 (0이 아닌 정수)."})
                    return

                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT credits FROM users WHERE LOWER(id) = LOWER(?)", (target_user_id,))
                row = cursor.fetchone()
                if not row:
                    conn.close()
                    self._send_json(404, {"success": False, "message": "사용자를 찾을 수 없습니다."})
                    return

                cur_c = row["credits"] if row["credits"] is not None else 20
                new_c = max(0, cur_c + amount)
                cursor.execute("UPDATE users SET credits = ? WHERE LOWER(id) = LOWER(?)", (new_c, target_user_id))
                conn.commit()
                conn.close()

                action_str = f"{amount} 크레딧 지급" if amount > 0 else f"{abs(amount)} 크레딧 차감"
                self._send_json(200, {
                    "success": True,
                    "userId": target_user_id,
                    "credits": new_c,
                    "message": f"[{target_user_id}] 회원에게 {action_str}이 완료되었습니다. (현재 잔여: {new_c}개)"
                })
                return

        # 2-3.1. API: AI 사용 시 크레딧 차감 (/api/credits/consume)
        # 크레딧 기준: 언어: -1, 그림: -2, 음악: -2, 동영상: -10
        if path == "/api/credits/consume":
            target_user_id = (data.get("userId") or data.get("user_id") or "").strip()
            task_type = (data.get("type") or data.get("taskType") or "language").lower().strip()

            if task_type in ("video", "동영상", "영상"):
                cost = 10
            elif task_type in ("image", "그림", "이미지"):
                cost = 2
            elif task_type in ("music", "음악", "노래"):
                cost = 2
            else:
                try:
                    cost = max(1, int(data.get("cost") or data.get("amount") or 1))
                except Exception:
                    cost = 1

            if not target_user_id:
                self._send_json(200, {
                    "success": True,
                    "isGuest": True,
                    "cost": cost,
                    "credits": 20
                })
                return
            
            cur_credits, _ = ensure_daily_user_credits(target_user_id)
            if cur_credits < cost:
                self._send_json(403, {
                    "success": False,
                    "outOfCredits": True,
                    "credits": cur_credits,
                    "required": cost,
                    "message": f"보유 크레딧이 부족합니다. (필요: {cost}개, 현재 잔여: {cur_credits}개)"
                })
                return
            
            new_credits = max(0, cur_credits - cost)
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET credits = ? WHERE LOWER(id) = LOWER(?)", (new_credits, target_user_id))
            conn.commit()
            conn.close()
            
            self._send_json(200, {
                "success": True,
                "cost": cost,
                "credits": new_credits,
                "outOfCredits": (new_credits <= 0)
            })
            return

        # 2-4. API: 모든 회원 크레딧 일괄 지급/차감 (/api/users/credits/batch)
        if path == "/api/users/credits/batch":
            try:
                amount = int(data.get("amount", 0))
            except Exception:
                amount = 0

            if amount == 0:
                self._send_json(400, {"success": False, "message": "일괄 변경할 크레딧 수량을 입력해주세요 (0이 아닌 정수)."})
                return

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET credits = MAX(0, COALESCE(credits, 20) + ?)", (amount,))
            affected = cursor.rowcount
            conn.commit()
            conn.close()

            action_str = f"{amount} 크레딧 일괄 지급" if amount > 0 else f"{abs(amount)} 크레딧 일괄 차감"
            self._send_json(200, {
                "success": True,
                "amount": amount,
                "affectedCount": affected,
                "message": f"전체 등록 회원({affected}명)에게 {action_str}이 완료되었습니다."
            })
            return

        # 3. API: AI 대화 세션 생성 또는 수정 (/api/ai/sessions)
        if path == "/api/ai/sessions":
            user_id = data.get("userId") or data.get("user_id") or ""
            session_id = data.get("id") or ""
            title = data.get("title", "새 대화")
            if not user_id or not session_id:
                self._send_json(400, {"success": False, "message": "userId와 id가 필요합니다."})
                return
            now = datetime.now().isoformat()
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM ai_sessions WHERE id = ?", (session_id,))
            if cursor.fetchone():
                cursor.execute("UPDATE ai_sessions SET title = ?, updated_at = ? WHERE id = ?", (title, now, session_id))
            else:
                cursor.execute("INSERT INTO ai_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", (session_id, user_id, title, now, now))
            conn.commit()
            conn.close()
            self._send_json(200, {"success": True, "message": "세션이 저장되었습니다."})
            return

        # 4. API: AI 대화 메시지 추가 (/api/ai/messages)
        if path == "/api/ai/messages":
            session_id = data.get("sessionId") or data.get("session_id") or ""
            user_id = data.get("userId") or data.get("user_id") or ""
            role = data.get("role", "user")
            text = data.get("text", "")
            html = data.get("html", "")
            time_str = data.get("time", "")
            if not session_id or not text:
                self._send_json(400, {"success": False, "message": "sessionId와 text가 필요합니다."})
                return
            now = datetime.now().isoformat()
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            # 세션 존재 여부 확인 후 없으면 자동 생성
            cursor.execute("SELECT id FROM ai_sessions WHERE id = ?", (session_id,))
            if not cursor.fetchone() and user_id:
                initial_title = text[:20] + "..." if len(text) > 20 else text
                cursor.execute("INSERT INTO ai_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", (session_id, user_id, initial_title, now, now))

            cursor.execute("INSERT INTO ai_messages (session_id, role, text, html, created_at) VALUES (?, ?, ?, ?, ?)", (session_id, role, text, html, time_str or now))
            cursor.execute("UPDATE ai_sessions SET updated_at = ? WHERE id = ?", (now, session_id))
            conn.commit()
            conn.close()
            self._send_json(200, {"success": True, "message": "메시지가 저장되었습니다."})
            return

        # 5. API: AI 설정 (/api/gemini/config)
        if path == "/api/gemini/config":
            key_val = data.get("apiKey", "").strip()
            set_gemini_key(key_val)
            self._send_json(200, {"success": True, "message": "nunu AI 엔진 설정이 안전하게 저장되었습니다."})
            return

        # 5-2. API: nunu AI Side Chat (화면 보고 대화하기) (/api/ai/sidechat)
        if path == "/api/ai/sidechat":
            msg = data.get("message", "").strip()
            ctx_data = data.get("context", {})
            title = ctx_data.get("title", "nunuSky 브라우저")
            url = ctx_data.get("url", "")
            page_text = ctx_data.get("pageContent", "")[:2500]

            if not msg:
                self._send_json(400, {"success": False, "message": "질문 내용을 입력해 주세요."})
                return

            reply = generate_ai_sidechat_reply(msg, title, url, page_text)
            self._send_json(200, {
                "success": True,
                "reply": reply
            })
            return

                # 6. API: nunu AI 실시간 생성 프록시 (/api/gemini/generate)
        if path == "/api/gemini/generate":
            prompt = data.get("prompt", "").strip()
            if not prompt:
                self._send_json(400, {"success": False, "message": "프롬프트를 입력해주세요."})
                return

            req_model = data.get("model", "flash").strip().lower() # "flash" | "pro"
            user_id = data.get("userId", "").strip() or data.get("user_id", "").strip()

            task_type = (data.get("type") or data.get("taskType") or "language").lower().strip()
            if task_type in ("video", "동영상", "영상"):
                cost = 10
            elif task_type in ("image", "그림", "이미지"):
                cost = 2
            elif task_type in ("music", "음악", "노래"):
                cost = 2
            else:
                try:
                    cost = max(1, int(data.get("cost") or 1))
                except Exception:
                    cost = 1

            # 크레딧 검증: 회원인 경우 잔여 크레딧 확인 (필요 크레딧 기준)
            remaining_credits = 20
            if user_id:
                cur_credits, _ = ensure_daily_user_credits(user_id)
                if cur_credits < cost:
                    self._send_json(403, {
                        "success": False,
                        "outOfCredits": True,
                        "credits": cur_credits,
                        "required": cost,
                        "message": f"보유 크레딧이 부족합니다. (필요: {cost}개, 현재 잔여: {cur_credits}개)"
                    })
                    return
                if not data.get("skipCreditDeduct"):
                    conn = sqlite3.connect(DB_PATH)
                    cursor = conn.cursor()
                    cursor.execute("UPDATE users SET credits = MAX(0, credits - ?) WHERE LOWER(id) = LOWER(?)", (cost, user_id))
                    conn.commit()
                    conn.close()
                    remaining_credits = max(0, cur_credits - cost)
                else:
                    remaining_credits = cur_credits

            # PRO 권한 검증: DB에서 해당 계정의 PRO 권한 여부 확인
            is_pro_granted = False
            if user_id:
                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT is_pro FROM users WHERE LOWER(id) = LOWER(?)", (user_id,))
                u_row = cursor.fetchone()
                conn.close()
                if u_row and u_row["is_pro"]:
                    is_pro_granted = True

            if req_model == "pro":
                if not is_pro_granted:
                    self._send_json(403, {
                        "success": False,
                        "requiresPro": True,
                        "message": "PRO 엔진은 관리자 웹에서 승인된 계정 전용입니다. 관리자 센터에서 승인을 받아주세요."
                    })
                    return
                target_model_name = "gemini-pro-latest"
                candidate_models = ["gemini-pro-latest", "gemini-2.5-pro", "gemini-3.1-pro-preview", "gemini-flash-latest"]
            else:
                target_model_name = "gemini-flash-latest"
                candidate_models = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3.8-flash", "gemini-pro-latest"]

            api_key = data.get("apiKey", "").strip() or get_gemini_key()
            if not api_key:
                self._send_json(200, {
                    "success": False,
                    "model": "pro" if req_model == "pro" else "standard",
                    "modelName": "PRO 엔진" if req_model == "pro" else "기본 AI",
                    "targetEngine": target_model_name,
                    "remainingCredits": remaining_credits,
                    "message": "현재 AI 서비스 점검 중입니다. 잠시 후 다시 이용해주세요."
                })
                return

            last_err_msg = ""
            pro_attempted_and_failed = False
            for model_id in candidate_models:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
                    req_payload = {
                        "contents": [{"parts": [{"text": prompt}]}]
                    }
                    req = urllib.request.Request(
                        url,
                        data=json.dumps(req_payload).encode("utf-8"),
                        headers={"Content-Type": "application/json"},
                        method="POST"
                    )
                    with urllib.request.urlopen(req, timeout=20) as resp:
                        res_json = json.loads(resp.read().decode("utf-8"))
                        candidates = res_json.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            text_out = "".join(p.get("text", "") for p in parts)
                            if text_out:
                                is_actually_pro = (req_model == "pro" and ("pro" in model_id.lower()))
                                is_fallback = (req_model == "pro" and pro_attempted_and_failed and ("flash" in model_id.lower()))
                                self._send_json(200, {
                                    "success": True,
                                    "source": "api",
                                    "model": "pro" if req_model == "pro" else "standard",
                                    "modelName": "PRO 엔진" if req_model == "pro" else "기본 AI",
                                    "activeModel": model_id,
                                    "fallbackFromPro": is_fallback,
                                    "remainingCredits": remaining_credits,
                                    "text": text_out
                                })
                                return
                except urllib.error.HTTPError as he:
                    if req_model == "pro" and ("pro" in model_id.lower()):
                        pro_attempted_and_failed = True
                    try:
                        err_json = json.loads(he.read().decode("utf-8"))
                        last_err_msg = err_json.get("error", {}).get("message", f"HTTP {he.code}")
                    except Exception:
                        last_err_msg = f"HTTP {he.code}"
                except Exception as ex:
                    if req_model == "pro" and ("pro" in model_id.lower()):
                        pro_attempted_and_failed = True
                    last_err_msg = str(ex)

            # API 호출 실패 시 에러 사유 반환
            self._send_json(200, {
                "success": False,
                "apiError": True,
                "model": "pro" if req_model == "pro" else "standard",
                "modelName": "PRO 엔진" if req_model == "pro" else "기본 AI",
                "remainingCredits": remaining_credits,
                "message": "AI 응답 생성 중 일시적인 지연이 발생했습니다. 잠시 후 다시 시도해주세요."
            })
            return

        # 10-3. API: 카메라 스캔 / 일기·독서록 검사 및 시험지 채점 (/api/diary/analyze)
        if path == "/api/diary/analyze":
            app_mode = data.get("mode", "inspect").strip().lower()  # "inspect"(검사 모드) | "test"(시험 모드)
            doc_type = data.get("type", "diary").strip().lower()    # "diary" | "book" | "test"
            title = data.get("title", "").strip()
            content = data.get("content", "").strip()
            date_val = data.get("date", "").strip()
            weather = data.get("weather", "").strip()
            mood = data.get("mood", "").strip()
            book_title = data.get("bookTitle", "").strip()
            book_author = data.get("bookAuthor", "").strip()
            test_subject = data.get("subject", "").strip()
            test_standard = data.get("testStandard", "").strip()
            style = data.get("style", "mentor").strip()
            image_raw = data.get("image", "").strip()
            api_key = data.get("apiKey", "").strip() or get_gemini_key()

            # 이미지 데이터 분리 (Base64 처리)
            image_b64 = ""
            mime_type = "image/jpeg"
            if image_raw:
                if "," in image_raw:
                    header, b64_part = image_raw.split(",", 1)
                    image_b64 = b64_part.strip()
                    if "image/png" in header:
                        mime_type = "image/png"
                    elif "image/webp" in header:
                        mime_type = "image/webp"
                    else:
                        mime_type = "image/jpeg"
                else:
                    image_b64 = image_raw

            if not content and not image_b64:
                self._send_json(400, {"success": False, "message": "카메라로 촬영한 사진을 스캔하거나 직접 내용을 입력해주세요."})
                return

            if not api_key:
                self._send_json(200, {
                    "success": False,
                    "message": "AI 연동 키(Gemini Key)가 설정되어 있지 않습니다. 관리자 콘솔 또는 화면 설정에서 키를 등록해주세요."
                })
                return

            if app_mode == "test":
                # 탈로스(Talos) 공식 등록 시험지 DB 조회
                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("SELECT id, test_code, title, subject, grade, total_points, question_count, questions_json, auth_code FROM talos_tests WHERE is_active = 1 ORDER BY id DESC")
                talos_rows = cur.fetchall()
                conn.close()

                req_test_code = (data.get("testCode") or "").strip().upper()
                entered_auth_code = (data.get("authCode") or "").strip()

                # 등록된 시험지가 하나도 없는 경우
                if not talos_rows:
                    self._send_json(200, {
                        "success": True,
                        "modelUsed": "nunu-talos-engine",
                        "appMode": "test",
                        "docType": "test",
                        "data": {
                            "mode": "test",
                            "isTalosVerified": False,
                            "rejected": True,
                            "reason": "등록된 탈로스 공식 시험지가 없습니다.",
                            "explanation": "nunu 관리자 사이트에 등록된 탈로스 공식 시험지가 없습니다. 관리자 사이트에서 [신규 탈로스 시험지 등록]을 진행해주세요."
                        }
                    })
                    return

                # 인증코드 사전 검증:
                # 1) 특정 시험 코드가 지정된 경우 해당 시험지의 auth_code와 일치하는지 검증
                # 2) 특정 시험 코드가 지정되지 않은 경우, 활성화된 시험지들 중 하나라도 auth_code가 일치하는지 검증
                matched_row = None
                if req_test_code:
                    for tr in talos_rows:
                        if tr["test_code"].upper() == req_test_code:
                            matched_row = tr
                            break
                    if matched_row:
                        expected_auth = (matched_row["auth_code"] or "").strip()
                        if expected_auth and entered_auth_code != expected_auth:
                            self._send_json(200, {
                                "success": True,
                                "modelUsed": "nunu-talos-engine",
                                "appMode": "test",
                                "docType": "test",
                                "data": {
                                    "mode": "test",
                                    "isTalosVerified": False,
                                    "rejected": True,
                                    "reason": f"[{matched_row['title']}] 시험지 인증코드가 일치하지 않습니다.",
                                    "explanation": f"탈로스 공식 시험지({matched_row['test_code']}) 채점을 위해 nunu 관리자 사이트에 설정된 고유 인증코드를 정확히 입력해주세요."
                                }
                            })
                            return
                else:
                    # 자동 감지 모드인 경우 입력한 인증코드가 등록된 시험지 중 유효한지 확인
                    valid_codes = [tr["auth_code"].strip() for tr in talos_rows if (tr["auth_code"] or "").strip()]
                    if valid_codes and (entered_auth_code not in valid_codes):
                        self._send_json(200, {
                            "success": True,
                            "modelUsed": "nunu-talos-engine",
                            "appMode": "test",
                            "docType": "test",
                            "data": {
                                "mode": "test",
                                "isTalosVerified": False,
                                "rejected": True,
                                "reason": "유효하지 않은 시험지 인증코드입니다.",
                                "explanation": "입력하신 인증코드가 등록된 탈로스 공식 시험지 인증코드와 일치하지 않습니다. 관리자 사이트에서 시험지별 인증코드를 확인 후 입력해주세요."
                            }
                        })
                        return

                talos_tests_summary = []
                for tr in talos_rows:
                    # 인증코드가 일치하는 시험지만 AI 채점 대상 후보에 포함
                    tr_auth = (tr["auth_code"] or "").strip()
                    if tr_auth and entered_auth_code and tr_auth != entered_auth_code:
                        continue
                    try:
                        q_data = json.loads(tr["questions_json"])
                    except Exception:
                        q_data = []
                    item = {
                        "testCode": tr["test_code"],
                        "title": tr["title"],
                        "subject": tr["subject"],
                        "grade": tr["grade"],
                        "totalPoints": tr["total_points"],
                        "questionCount": tr["question_count"] or len(q_data),
                        "questions": q_data
                    }
                    talos_tests_summary.append(item)

                if not talos_tests_summary:
                    self._send_json(200, {
                        "success": True,
                        "modelUsed": "nunu-talos-engine",
                        "appMode": "test",
                        "docType": "test",
                        "data": {
                            "mode": "test",
                            "isTalosVerified": False,
                            "rejected": True,
                            "reason": "해당 인증코드와 일치하는 시험지가 없습니다.",
                            "explanation": "입력하신 인증코드와 매칭되는 활성화된 탈로스 시험지를 찾을 수 없습니다."
                        }
                    })
                    return

                talos_db_json = json.dumps(talos_tests_summary, ensure_ascii=False, indent=2)


                prompt = f"""당신은 탈로스(내 회사, Talos)의 공식 시험 채점관이자 AI 평가위원입니다.
제공된 시험지/답안지 (카메라 스캔 사진 또는 텍스트)를 면밀히 분석하여 채점을 진행하세요.

[⚠️ 최우선 규정 - 탈로스(Talos) 비인증 시험지 채점 차단]
1. 본 채점 시스템은 **탈로스(내 회사, Talos)**에서 공식 제공/발행하고 nunu 관리자 시스템에 정답이 등록된 시험지만 채점합니다.
2. 아래는 nunu 관리자 시스템에 등록된 [탈로스(Talos) 공식 시험지 및 정답표 데이터베이스]입니다:
\"\"\"
{talos_db_json}
\"\"\"

3. [인증 및 판별 규칙]:
   - 스캔된 시험지(사진 또는 텍스트)를 판독하여, 시험지 상단/표지에 '탈로스', 'Talos', 또는 등록된 탈로스 시험 코드(예: TALOS-...)나 등록된 문항 내용과 일치하는지 먼저 엄격하게 판별하세요.
   - 만약 제공된 시험지가 탈로스(Talos)에서 제공한 공식 시험지가 아니거나, 위의 탈로스 공식 시험지 목록 중 일치하는 시험지를 찾을 수 없는 외부 시험지(타사 문제집, 개인 시험지 등)라면:
     절대로 채점을 진행하지 말고, 반드시 아래와 같이 isTalosVerified: false, rejected: true 로 거부 응답을 반환하세요:
     {{
       "mode": "test",
       "isTalosVerified": false,
       "rejected": true,
       "extractedText": "시험지에서 판독된 내용...",
       "reason": "탈로스(Talos) 공식 발급 시험지가 아닙니다.",
       "explanation": "본 AI 자동 채점 시스템은 탈로스(내 회사)에서 공식 발급하고 nunu 관리자 사이트에 정답이 등록된 시험지만 채점할 수 있습니다. 시험지 상단의 '탈로스(Talos)' 공식 로고나 고유 시험 코드(TALOS-...)가 선명하게 나오도록 촬영해 주시거나, 관리자 센터에서 해당 시험지와 정답을 먼저 등록해주세요."
     }}

4. [탈로스 공식 시험지로 확인된 경우 채점 지침]:
   - 일치하는 탈로스 공식 시험지의 정답표(Answer Key) 및 문항별 배점을 1:1로 정확하게 대조하여 학생의 답(손글씨/마킹)을 채점하세요.
   - 반드시 아래 JSON 형식으로 응답하세요:
     {{
       "mode": "test",
       "isTalosVerified": true,
       "rejected": false,
       "testCode": "<일치한 탈로스 시험 코드>",
       "testTitle": "<일치한 탈로스 시험명>",
       "score": <총점(숫자, 예: 80)>,
       "totalQuestions": <총 문항 수>,
       "correctCount": <맞은 개수>,
       "wrongCount": <틀린 개수>,
       "extractedText": "<판독된 시험지/답안 원문 텍스트>",
       "grading": [
         {{
           "questionNumber": 1,
           "questionText": "<문제 내용>",
           "studentAnswer": "<학생이 쓴 답안>",
           "correctAnswer": "<탈로스 공식 정답>",
           "isCorrect": true,
           "points": 20,
           "explanation": "<정답 풀이 및 해설>"
         }}
       ],
       "feedback": {{
         "summary": "<탈로스 공식 총평 및 격려>",
         "strengths": "<잘한 부분>",
         "reviewTips": "<틀린 문제 오답 복습 포인트>"
       }}
     }}
"""

                if req_test_code:
                    prompt += f"\n[선택/지정된 탈로스 공식 시험 코드]\n- 지정 코드: {req_test_code} (이 시험 코드의 문제 및 정답 데이터베이스와 대조하여 학생 답안을 채점하세요)\n"

                if content:
                    prompt += f"\n[입력/판독된 시험/답안 텍스트]\n\"\"\"\n{content}\n\"\"\"\n"

            else:
                # [검사 모드] 일기 & 독서록 맞춤법 교정 및 피드백 프롬프트
                doc_type_kr = "독서록" if doc_type in ("book", "독서록") else "일기"
                style_desc = {
                    "mentor": "다정하고 따뜻한 멘토 (칭찬과 격려를 아끼지 않고, 초등학생과 어린이의 눈높이에 맞춘 다정한 말투)",
                    "coach": "균형 잡힌 글쓰기 코치 (생각을 더 깊게 확장하고 어휘력과 표현력을 길러주는 성장 중심 피드백)",
                    "editor": "전문 문장 교정가 (어휘의 정확성, 문맥의 호응, 세련된 문장 구조를 꼼꼼하게 지도하는 피드백)"
                }.get(style, "다정하고 따뜻한 글쓰기 멘토")

                prompt = f"""당신은 한국어 맞춤법 및 국어 글쓰기 교육 전문 AI 코치입니다.
제공된 [{doc_type_kr}] 사진(손글씨/인쇄본) 또는 텍스트를 꼼꼼하게 분석하여
1) 사진 속 글씨를 정확하게 판독(OCR)하고,
2) 맞춤법 및 띄어쓰기 교정을 수행하며,
3) 글의 내용과 감정에 깊이 공감하는 맞춤형 AI 피드백을 작성하세요.

[분석 정보]
- 유형: {doc_type_kr}
- 제목: {title or '(제목 미지정)'}
"""
                if doc_type_kr == "일기":
                    prompt += f"- 날짜: {date_val or '미지정'}, 날씨: {weather or '미지정'}, 기분: {mood or '미지정'}\n"
                else:
                    prompt += f"- 책 제목: {book_title or '미지정'}, 지은이: {book_author or '미지정'}\n"

                prompt += f"- 코칭 어조: {style_desc}\n"

                if content:
                    prompt += f"\n[입력된 원문 텍스트]\n\"\"\"\n{content}\n\"\"\"\n"

                prompt += """
[작성 요구사항]
1. 텍스트 추출 (extractedText):
   - 이미지에 손글씨나 인쇄된 글이 있다면, 원문 그대로 오탈자까지 충실하게 판독하여 extractedText에 담으세요. 텍스트가 이미 제공되었다면 그 내용을 담으세요.
2. 맞춤법 및 띄어쓰기 교정 (corrections):
   - 국립국어원 표준어 맞춤법 및 띄어쓰기 규정을 철저히 따르세요.
   - 글쓴이의 고유한 표현은 존중하되, 맞춤법/띄어쓰기 오류만 올바르게 교정하세요.
   - 각 교정 항목마다 original(오류), corrected(올바른 표현), reason(쉬운 규칙 설명)을 작성하세요.
   - 오류가 전혀 없다면 corrections는 빈 배열([])로 두세요.
   - correctedText에는 맞춤법/띄어쓰기가 완벽하게 교정된 전체 완성 글을 작성하세요.
3. AI 내용 피드백 (feedback):
   - summary: 글 전체를 아우르는 따뜻하고 힘이 나는 한 줄 총평
   - praise: 인상 깊은 생각, 솔직한 감정, 참신한 문장에 대한 구체적인 칭찬 (2~3문장)
   - questions: 생각을 더 넓힐 수 있도록 돕는 다정한 질문 2가지 (배열)
   - tips: 더 멋진 글을 위한 생생한 어휘/표현 꿀팁 (1~2문장)

반드시 아래 JSON 형식으로만 응답해야 합니다. 마크다운 코드블록이나 부가 설명 없이 순수 JSON만 반환하세요:
{
  "mode": "inspect",
  "extractedText": "카메라에서 판독된 전체 원문 내용",
  "correctionCount": 0,
  "correctedText": "교정된 전체 글 완성본",
  "corrections": [
    {
      "original": "틀린 단어 또는 어절",
      "corrected": "올바른 단어 또는 어절",
      "reason": "교정 이유 및 맞춤법 규칙 설명"
    }
  ],
  "feedback": {
    "summary": "한 줄 총평",
    "praise": "인상 깊은 점과 따뜻한 칭찬",
    "questions": [
      "생각을 넓혀주는 다정한 질문 1",
      "생각을 넓혀주는 다정한 질문 2"
    ],
    "tips": "더 멋진 글을 위한 표현 꿀팁"
  }
}
"""

            # Gemini 호출 파트 구성 (멀티모달 이미지 + 텍스트)
            req_parts = []
            if image_b64:
                req_parts.append({
                    "inlineData": {
                        "mimeType": mime_type,
                        "data": image_b64
                    }
                })
            req_parts.append({"text": prompt})

            candidate_models = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3.8-flash", "gemini-pro-latest"]
            analysis_result = None
            last_err = ""

            for model_id in candidate_models:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
                    req_payload = {
                        "contents": [{"parts": req_parts}],
                        "generationConfig": {
                            "temperature": 0.2
                        }
                    }
                    req = urllib.request.Request(
                        url,
                        data=json.dumps(req_payload).encode("utf-8"),
                        headers={"Content-Type": "application/json"},
                        method="POST"
                    )
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        res_json = json.loads(resp.read().decode("utf-8"))
                        candidates = res_json.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            raw_out = "".join(p.get("text", "") for p in parts).strip()
                            if raw_out:
                                json_str = raw_out
                                if "```" in json_str:
                                    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", json_str)
                                    if match:
                                        json_str = match.group(1).strip()
                                
                                try:
                                    parsed = json.loads(json_str)
                                    analysis_result = {
                                        "success": True,
                                        "modelUsed": model_id,
                                        "appMode": app_mode,
                                        "docType": doc_type,
                                        "data": parsed
                                    }
                                    break
                                except Exception:
                                    start_idx = json_str.find("{")
                                    end_idx = json_str.rfind("}")
                                    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                                        parsed = json.loads(json_str[start_idx:end_idx+1])
                                        analysis_result = {
                                            "success": True,
                                            "modelUsed": model_id,
                                            "appMode": app_mode,
                                            "docType": doc_type,
                                            "data": parsed
                                        }
                                        break
                except Exception as ex:
                    last_err = str(ex)

            if analysis_result:
                self._send_json(200, analysis_result)
            else:
                self._send_json(500, {
                    "success": False,
                    "message": "AI 카메라 스캔 및 분석 중 지연이 발생했습니다. 잠시 후 다시 시도해주세요.",
                    "error": last_err
                })
            return

        # 10-4. API: 탈로스 신규 시험지 등록 (/api/admin/talos-tests)
        if path == "/api/admin/talos-tests":
            test_code = data.get("testCode", "").strip().upper()
            title = data.get("title", "").strip()
            subject = data.get("subject", "").strip()
            grade = data.get("grade", "").strip()
            total_points = int(data.get("totalPoints") or 100)
            auth_code = data.get("authCode", "").strip()
            questions = data.get("questions", [])
            is_active = 1 if data.get("isActive", True) else 0

            if not test_code:
                test_code = f"TALOS-{int(time.time())}"
            if not title:
                self._send_json(400, {"success": False, "message": "시험지 이름을 입력해주세요."})
                return
            if not auth_code:
                self._send_json(400, {"success": False, "message": "시험지 인증코드를 입력해주세요."})
                return

            q_json = json.dumps(questions, ensure_ascii=False)
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO talos_tests (test_code, title, subject, grade, total_points, question_count, questions_json, auth_code, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (test_code, title, subject, grade, total_points, len(questions), q_json, auth_code, is_active, now_str))
                new_id = cursor.lastrowid
                conn.commit()
                conn.close()

                self._send_json(201, {
                    "success": True,
                    "message": f"탈로스 공식 시험지 '{title}'({test_code})가 성공적으로 등록되었습니다.",
                    "id": new_id
                })
            except sqlite3.IntegrityError:
                self._send_json(400, {"success": False, "message": f"이미 등록된 시험 코드('{test_code}')입니다. 다른 코드를 사용해주세요."})
            except Exception as e:
                self._send_json(500, {"success": False, "message": f"시험지 등록 실패: {str(e)}"})
            return

        # 10-5. API: 탈로스 시험지 수정 (/api/admin/talos-tests/update)
        if path == "/api/admin/talos-tests/update":
            test_id = data.get("id")
            if not test_id:
                self._send_json(400, {"success": False, "message": "시험지 ID가 필요합니다."})
                return

            title = data.get("title", "").strip()
            subject = data.get("subject", "").strip()
            grade = data.get("grade", "").strip()
            total_points = int(data.get("totalPoints") or 100)
            auth_code = data.get("authCode", "").strip()
            questions = data.get("questions")
            is_active = data.get("isActive")

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            if questions is not None and title:
                q_json = json.dumps(questions, ensure_ascii=False)
                cursor.execute("""
                    UPDATE talos_tests
                    SET title = ?, subject = ?, grade = ?, total_points = ?, question_count = ?, questions_json = ?, auth_code = ?, is_active = ?
                    WHERE id = ?
                """, (title, subject, grade, total_points, len(questions), q_json, auth_code, 1 if is_active else 0, test_id))
            elif is_active is not None:
                cursor.execute("UPDATE talos_tests SET is_active = ? WHERE id = ?", (1 if is_active else 0, test_id))
            conn.commit()
            conn.close()

            self._send_json(200, {"success": True, "message": "탈로스 시험지 정보가 수정되었습니다."})
            return

        # 10-6. API: 탈로스 시험지 삭제 (/api/admin/talos-tests/delete)
        if path == "/api/admin/talos-tests/delete":
            test_id = data.get("id")
            if not test_id:
                self._send_json(400, {"success": False, "message": "삭제할 시험지 ID가 필요합니다."})
                return

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM talos_tests WHERE id = ?", (test_id,))
            conn.commit()
            conn.close()

            self._send_json(200, {"success": True, "message": "탈로스 시험지가 삭제되었습니다."})
            return

        # 11. API: 관리자 신규 광고 등록 (/api/admin/ads)
        if path == "/api/admin/ads":
            title = data.get("title", "").strip()
            desc = data.get("desc", "").strip()
            link_url = data.get("linkUrl", "").strip()
            media_type = data.get("mediaType", "none").strip().lower()
            media_url = data.get("mediaUrl", "").strip()

            if not title:
                self._send_json(400, {"success": False, "message": "광고 제목을 입력해주세요."})
                return

            if media_type not in ("none", "image", "video"):
                media_type = "none"

            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO ads (title, desc, link_url, media_type, media_url, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
                (title, desc, link_url, media_type, media_url, now_str)
            )
            new_id = cursor.lastrowid
            conn.commit()
            conn.close()

            self._send_json(201, {
                "success": True,
                "message": "새로운 광고가 성공적으로 등록되었습니다.",
                "ad": {
                    "id": new_id,
                    "title": title,
                    "desc": desc,
                    "linkUrl": link_url,
                    "mediaType": media_type,
                    "mediaUrl": media_url,
                    "isActive": True,
                    "createdAt": now_str
                }
            })
            return

        # 12. API: 관리자 광고 전체 ON/OFF 토글 (/api/admin/ads/toggle-global)
        if path == "/api/admin/ads/toggle-global":
            req_state = data.get("enabled")
            if req_state is None:
                current = get_global_ads_enabled()
                new_state = not current
            else:
                new_state = bool(req_state)

            set_global_ads_enabled(new_state)
            self._send_json(200, {
                "success": True,
                "globalAdsEnabled": new_state,
                "message": f"홈 화면 광고가 {'전체 활성화' if new_state else '전체 비활성화 (OFF)'} 되었습니다."
            })
            return

        self._send_json(404, {"success": False, "message": "존재하지 않는 엔드포인트입니다."})

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # API: 관리자 비밀번호 수정 (/api/users/<user_id>/password)
        if path.startswith("/api/users/") and path.endswith("/password"):
            parts = path.strip("/").split("/")
            if len(parts) == 4:
                user_id = urllib.parse.unquote(parts[2])
                content_len = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_len).decode("utf-8")
                try:
                    data = json.loads(body)
                except Exception:
                    self._send_json(400, {"success": False, "message": "잘못된 데이터입니다."})
                    return

                new_password = data.get("password", "").strip()
                if not new_password:
                    self._send_json(400, {"success": False, "message": "새 비밀번호를 입력해주세요."})
                    return

                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("UPDATE users SET password = ? WHERE id = ?", (new_password, user_id))
                updated = cursor.rowcount > 0
                conn.commit()
                conn.close()

                if updated:
                    self._send_json(200, {"success": True, "message": "비밀번호가 변경되었습니다."})
                else:
                    self._send_json(404, {"success": False, "message": "사용자를 찾을 수 없습니다."})
                return

        # API: 개별 광고 활성화/비활성화 토글 (/api/admin/ads/<id>/toggle)
        if path.startswith("/api/admin/ads/") and path.endswith("/toggle"):
            parts = path.strip("/").split("/")
            if len(parts) == 5:
                try:
                    ad_id = int(parts[3])
                except ValueError:
                    self._send_json(400, {"success": False, "message": "유효하지 않은 광고 ID입니다."})
                    return

                content_len = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
                try:
                    data = json.loads(body) if body else {}
                except Exception:
                    data = {}

                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("SELECT is_active FROM ads WHERE id = ?", (ad_id,))
                row = cursor.fetchone()
                if not row:
                    conn.close()
                    self._send_json(404, {"success": False, "message": "해당 광고를 찾을 수 없습니다."})
                    return

                if "isActive" in data:
                    new_val = 1 if bool(data["isActive"]) else 0
                else:
                    new_val = 0 if row[0] == 1 else 1

                cursor.execute("UPDATE ads SET is_active = ? WHERE id = ?", (new_val, ad_id))
                conn.commit()
                conn.close()

                self._send_json(200, {
                    "success": True,
                    "adId": ad_id,
                    "isActive": bool(new_val),
                    "message": f"광고가 {'활성화 (ON)' if new_val == 1 else '비활성화 (OFF)'} 되었습니다."
                })
                return

        self._send_json(404, {"success": False, "message": "존재하지 않는 엔드포인트입니다."})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # API: 개별 광고 삭제 (/api/admin/ads/<id>)
        if path.startswith("/api/admin/ads/"):
            parts = path.strip("/").split("/")
            if len(parts) == 4:
                try:
                    ad_id = int(parts[3])
                except ValueError:
                    self._send_json(400, {"success": False, "message": "유효하지 않은 광고 ID입니다."})
                    return

                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM ads WHERE id = ?", (ad_id,))
                deleted = cursor.rowcount > 0
                conn.commit()
                conn.close()

                if deleted:
                    self._send_json(200, {"success": True, "message": "광고가 삭제되었습니다."})
                else:
                    self._send_json(404, {"success": False, "message": "해당 광고를 찾을 수 없습니다."})
                return

        # API: 관리자 회원 삭제 (/api/users/<user_id>)
        if path.startswith("/api/users/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                user_id = urllib.parse.unquote(parts[2])
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
                deleted = cursor.rowcount > 0
                conn.commit()
                conn.close()

                if deleted:
                    self._send_json(200, {"success": True, "message": "회원이 삭제되었습니다."})
                else:
                    self._send_json(404, {"success": False, "message": "사용자를 찾을 수 없습니다."})
                return

        # API: 특정 AI 대화 세션 삭제 (/api/ai/sessions/<session_id>)
        if path.startswith("/api/ai/sessions/"):
            parts = path.strip("/").split("/")
            if len(parts) == 4:
                session_id = urllib.parse.unquote(parts[3])
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM ai_messages WHERE session_id = ?", (session_id,))
                cursor.execute("DELETE FROM ai_sessions WHERE id = ?", (session_id,))
                conn.commit()
                conn.close()
                self._send_json(200, {"success": True, "message": "세션이 삭제되었습니다."})
                return

        # API: 특정 사용자의 모든 AI 대화 세션 삭제 (/api/ai/sessions?user_id=...)
        if path == "/api/ai/sessions":
            query = urllib.parse.parse_qs(parsed.query)
            user_id = query.get("user_id", [""])[0].strip()
            if user_id:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM ai_messages WHERE session_id IN (SELECT id FROM ai_sessions WHERE user_id = ?)", (user_id,))
                cursor.execute("DELETE FROM ai_sessions WHERE user_id = ?", (user_id,))
                conn.commit()
                conn.close()
                self._send_json(200, {"success": True, "message": "모든 세션이 삭제되었습니다."})
                return

        self._send_json(404, {"success": False, "message": "존재하지 않는 엔드포인트입니다."})


class RobustThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def handle_error(self, request, client_address):
        import sys
        exc_type, _, _ = sys.exc_info()
        if exc_type and issubclass(exc_type, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, OSError)):
            return
        super().handle_error(request, client_address)


if __name__ == "__main__":
    os.chdir(BASE_DIR)
    local_ip = get_local_ip()
    print("=" * 65)
    print(f"  nunu 포털 & nunu AI 백엔드 서버 시작 (포트: {PORT})")
    print(f"  데이터베이스: {DB_PATH}")
    print(f"  [PC] 내 컴퓨터 접속 주소: http://localhost:{PORT}")
    print(f"  [Mobile] 스마트폰 / 다른 기기 접속 주소: http://{local_ip}:{PORT}")
    print(f"     (같은 Wi-Fi에 연결된 기기에서 접속 가능)")
    print("=" * 65)
    while True:
        try:
            with RobustThreadingTCPServer(("", PORT), NunuHandler) as httpd:
                httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버가 종료되었습니다.")
            break
        except BaseException as e:
            print(f"\n[서버 에러 감지] {type(e).__name__}: {e} - 1초 후 자동 복구합니다...")
            time.sleep(1)
