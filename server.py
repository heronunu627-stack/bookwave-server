#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bookwave Local Server
- Pure Python 3 standard library
- Serves Web App UI
- HTTP Range support for smooth audio seeking and progressive download
- File upload & library metadata management
- Admin authentication with SHA-256 one-way hashed security
- Admin-managed user registration & login
"""

import os
import sys
import json
import mimetypes
import urllib.parse
import webbrowser
import threading
import time
import hashlib
import secrets
import zipfile
import io
import re
import random
import subprocess
import base64
import xml.etree.ElementTree as ET
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import socket

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
LIBRARY_DIR = BASE_DIR / "library"
BOOKS_DIR = LIBRARY_DIR / "books"
AUDIO_DIR = LIBRARY_DIR / "audio"
METADATA_FILE = LIBRARY_DIR / "metadata.json"
USERS_FILE = LIBRARY_DIR / "users.json"
ADS_FILE = LIBRARY_DIR / "ads.json"
USER_PROGRESS_FILE = LIBRARY_DIR / "user_progress.json"
SHARES_FILE = LIBRARY_DIR / "shares.json"
DATA_DIR = BASE_DIR / "data"
DATA_USERS_FILE = DATA_DIR / "users.json"

TIERS_FILE = LIBRARY_DIR / "tiers.json"
DATA_TIERS_FILE = DATA_DIR / "tiers.json"

DELETED_USERS_FILE = LIBRARY_DIR / "deleted_users.json"
DATA_DELETED_USERS_FILE = DATA_DIR / "deleted_users.json"

EMERGENCY_FILE = LIBRARY_DIR / "emergency.json"
DATA_EMERGENCY_FILE = DATA_DIR / "emergency.json"

DEFAULT_TIERS_CONFIG = {
    "free": {
        "label": "무료",
        "description": "기본 가입 회원",
        "access": "block",  # "allow" (이용 가능), "block" (전면 제한)
        "adMode": "always", # "always" (광고 필수), "none" (광고 없음)
        "allowDownload": False,
        "maxDownloads": 0
    },
    "pro": {
        "label": "PRO",
        "description": "광고 시청 지원 등급",
        "access": "allow",
        "adMode": "always",
        "allowDownload": False,
        "maxDownloads": 0
    },
    "premium": {
        "label": "프리미엄",
        "description": "최상위 멤버십",
        "access": "allow",
        "adMode": "none",
        "allowDownload": True,
        "maxDownloads": 5
    }
}

def load_tiers():
    if TIERS_FILE.exists():
        try:
            with open(TIERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "free" in data and "pro" in data and "premium" in data:
                    return data
        except Exception as e:
            print(f"[Warning] Failed to read tiers.json: {e}")
    save_tiers(DEFAULT_TIERS_CONFIG)
    return DEFAULT_TIERS_CONFIG

def save_tiers(data):
    try:
        LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
        with open(TIERS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Error] Failed to save library/tiers.json: {e}")

    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(DATA_TIERS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Warning] Failed to export data/tiers.json: {e}")

# Public tunnel URL state for cross-network/LTE sharing
PUBLIC_TUNNEL_URL = ""
CURRENT_SERVER_PORT = 8000

# One-way cryptographic hash of admin master password (SHA-256)
# Plaintext password is NEVER stored in any code or file.
DEFAULT_ADMIN_PW_HASH = "51dee4b64e747e69497f4a5649f2aba0ccdd63e50a863fe2aaec52d96e7057cd"
ADMIN_CONFIG_FILE = LIBRARY_DIR / "admin_config.json"
SESSIONS_FILE = LIBRARY_DIR / "admin_sessions.json"

def get_admin_pw_hash():
    if ADMIN_CONFIG_FILE.exists():
        try:
            with open(ADMIN_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                h = data.get("admin_pw_hash")
                if h:
                    return h
        except Exception:
            pass
    return DEFAULT_ADMIN_PW_HASH

def save_admin_pw_hash(new_hash):
    try:
        with open(ADMIN_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump({"admin_pw_hash": new_hash}, f, indent=2)
        return True
    except Exception:
        return False

def load_admin_sessions():
    if SESSIONS_FILE.exists():
        try:
            with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return set(data.get("tokens", []))
        except Exception:
            pass
    return set()

def save_admin_sessions(tokens):
    try:
        with open(SESSIONS_FILE, "w", encoding="utf-8") as f:
            json.dump({"tokens": list(tokens)}, f, indent=2)
    except Exception:
        pass

# Active admin session tokens (persisted across restarts)
admin_sessions = load_admin_sessions()

AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".aac", ".ogg", ".flac", ".wma", ".opus", ".m4b", ".webm"}
EBOOK_EXTS = {".docx", ".doc"}

# Ensure required folders exist
BOOKS_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# Register common mimetypes
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx")
mimetypes.add_type("application/msword", ".doc")
mimetypes.add_type("audio/mpeg", ".mp3")
mimetypes.add_type("audio/mp4", ".m4a")
mimetypes.add_type("audio/wav", ".wav")
mimetypes.add_type("audio/aac", ".aac")
mimetypes.add_type("audio/flac", ".flac")
mimetypes.add_type("audio/ogg", ".ogg")


def parse_docx_pages(data_bytes):
    """
    Parses a Word (.docx) file and returns a list of pages.
    Each page matches Word's actual page 1..N with preserved page breaks and illustrations.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(data_bytes)) as z:
            if "word/document.xml" not in z.namelist():
                return []
            
            # Read image relationships
            rel_map = {}
            if "word/_rels/document.xml.rels" in z.namelist():
                rels_content = z.read("word/_rels/document.xml.rels")
                rels_tree = ET.fromstring(rels_content)
                for rel in rels_tree:
                    r_id = rel.attrib.get('Id')
                    target = rel.attrib.get('Target')
                    if r_id and target:
                        rel_map[r_id] = target

            # Cache embedded images as data URLs
            img_cache = {}
            for r_id, target in rel_map.items():
                target_path = target if target.startswith("word/") else f"word/{target}"
                if target_path in z.namelist():
                    img_bytes = z.read(target_path)
                    mime = "image/png"
                    if target.lower().endswith(".jpg") or target.lower().endswith(".jpeg"):
                        mime = "image/jpeg"
                    elif target.lower().endswith(".gif"):
                        mime = "image/gif"
                    b64 = base64.b64encode(img_bytes).decode('ascii')
                    img_cache[r_id] = f"data:{mime};base64,{b64}"

            xml_content = z.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            namespaces = {
                'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
                'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
            }
            body = tree.find('.//w:body', namespaces)
            if body is None:
                return []

            pages = []
            current_page_elements = []
            current_para_parts = []

            def flush_para():
                nonlocal current_para_parts
                text = "".join(current_para_parts).strip()
                if text:
                    current_page_elements.append(text)
                current_para_parts = []

            def flush_page():
                nonlocal current_page_elements
                flush_para()
                if current_page_elements:
                    pages.append(list(current_page_elements))
                    current_page_elements = []

            for child in body:
                tag = child.tag.split('}')[-1]
                if tag == 'p':
                    for node in child.iter():
                        n_tag = node.tag.split('}')[-1]
                        # Page break detection (Word rendered break or explicit break)
                        if n_tag == 'lastRenderedPageBreak' or (n_tag == 'br' and node.attrib.get(f'{{{namespaces["w"]}}}type') == 'page'):
                            flush_para()
                            if current_page_elements:
                                pages.append(list(current_page_elements))
                                current_page_elements = []
                        elif n_tag == 'blip':
                            embed_id = node.attrib.get(f'{{{namespaces["r"]}}}embed')
                            if embed_id and embed_id in img_cache:
                                flush_para()
                                current_page_elements.append(f'<img src="{img_cache[embed_id]}" class="book-page-embedded-img" alt="삽화" />')
                        elif n_tag == 't' and node.text:
                            current_para_parts.append(node.text)

                    flush_para()

            flush_page()

            result = []
            for idx, p_elems in enumerate(pages):
                html_parts = []
                text_parts = []
                for elem in p_elems:
                    if elem.startswith('<img'):
                        html_parts.append(elem)
                    else:
                        html_parts.append(f'<p class="book-para">{elem}</p>')
                        text_parts.append(elem)
                result.append({
                    "pageNumber": idx + 1,
                    "html": "\n".join(html_parts),
                    "text": "\n\n".join(text_parts)
                })
            return result
    except Exception as e:
        print(f"[Warning] Failed to parse docx pages: {e}")
        return []


def parse_docx_bytes(data_bytes):
    """
    Extracts text paragraphs from a Word (.docx) file byte stream.
    """
    pages = parse_docx_pages(data_bytes)
    if pages:
        return "\n\n".join(p["text"] for p in pages if p["text"])
    return ""


def load_metadata():
    if METADATA_FILE.exists():
        try:
            with open(METADATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Warning] Failed to read metadata.json: {e}")
    return {"items": {}}


def save_metadata(data):
    try:
        with open(METADATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Error] Failed to save metadata: {e}")


def load_ads():
    default_ads = {
        "active": True,
        "rotationMode": "sequence",  # sequence (순차 순환) or random (무작위)
        "ads": [
            {
                "id": "ad_1",
                "active": True,
                "title": "탈로스",
                "sponsor": "탈로스&연우job",
                "message": "탈로스에서 풍부한 한끼를",
                "imageUrl": "/library/ad_banner.png",
                "linkUrl": "",
                "skipSeconds": 5
            },
            {
                "id": "ad_2",
                "active": True,
                "title": "북웨이브 프리미엄 멤버십",
                "sponsor": "bookwave official",
                "message": "지금 프리미엄으로 업그레이드하고 광고 없이 무제한으로 다운로드하여 감상하세요!",
                "imageUrl": "",
                "linkUrl": "#",
                "skipSeconds": 5
            }
        ]
    }
    if ADS_FILE.exists():
        try:
            with open(ADS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                # If legacy single ad dict, migrate to multi-ad list seamlessly
                if "ads" not in data:
                    single_ad = {
                        "id": f"ad_{int(time.time())}",
                        "active": data.get("active", True),
                        "title": data.get("title", "북웨이브 프리미엄 멤버십"),
                        "sponsor": data.get("sponsor", "bookwave official"),
                        "message": data.get("message", ""),
                        "imageUrl": data.get("imageUrl", ""),
                        "linkUrl": data.get("linkUrl", "#"),
                        "skipSeconds": data.get("skipSeconds", 5)
                    }
                    data = {
                        "active": data.get("active", True),
                        "rotationMode": "sequence",
                        "ads": [
                            single_ad,
                            {
                                "id": "ad_2",
                                "active": True,
                                "title": "북웨이브 프리미엄 멤버십",
                                "sponsor": "bookwave official",
                                "message": "지금 프리미엄으로 업그레이드하고 광고 없이 무제한으로 다운로드하여 감상하세요!",
                                "imageUrl": "",
                                "linkUrl": "#",
                                "skipSeconds": 5
                            }
                        ]
                    }
                    save_ads(data)
                return data
        except Exception as e:
            print(f"[Warning] Failed to read ads.json: {e}")
    save_ads(default_ads)
    return default_ads


def save_ads(data):
    try:
        with open(ADS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Error] Failed to save ads: {e}")


def get_default_users():
    initial_pw_hash = hashlib.sha256("1234".encode("utf-8")).hexdigest()
    return {
        "users": [
            {
                "username": "reader",
                "name": "김독서",
                "tier": "premium",
                "password": "1234",
                "passwordHash": initial_pw_hash,
                "createdAt": time.strftime("%Y-%m-%d %H:%M")
            },
            {
                "username": "yeonwoo",
                "name": "연우",
                "tier": "premium",
                "password": "1234",
                "passwordHash": initial_pw_hash,
                "createdAt": time.strftime("%Y-%m-%d %H:%M")
            }
        ]
    }


def load_deleted_users():
    if DELETED_USERS_FILE.exists():
        try:
            with open(DELETED_USERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return [x.lower() for x in data if isinstance(x, str)]
                elif isinstance(data, dict):
                    return [x.lower() for x in data.get("deleted", []) if isinstance(x, str)]
        except Exception as e:
            print(f"[Warning] Failed to read deleted_users.json: {e}")
    return []


def add_deleted_user(username):
    if not username:
        return
    username_clean = username.strip().lower()
    deleted_list = load_deleted_users()
    if username_clean not in deleted_list:
        deleted_list.append(username_clean)
        try:
            with open(DELETED_USERS_FILE, "w", encoding="utf-8") as f:
                json.dump({"deleted": deleted_list}, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[Error] Failed to save deleted_users: {e}")
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            with open(DATA_DELETED_USERS_FILE, "w", encoding="utf-8") as f:
                json.dump({"deleted": deleted_list}, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[Warning] Failed to export data/deleted_users.json: {e}")


def remove_from_deleted_users(username):
    if not username:
        return
    username_clean = username.strip().lower()
    deleted_list = load_deleted_users()
    if username_clean in deleted_list:
        deleted_list = [u for u in deleted_list if u != username_clean]
        try:
            with open(DELETED_USERS_FILE, "w", encoding="utf-8") as f:
                json.dump({"deleted": deleted_list}, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        try:
            with open(DATA_DELETED_USERS_FILE, "w", encoding="utf-8") as f:
                json.dump({"deleted": deleted_list}, f, ensure_ascii=False, indent=2)
        except Exception:
            pass


def load_emergency():
    if EMERGENCY_FILE.exists():
        try:
            with open(EMERGENCY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Warning] Failed to read emergency.json: {e}")
    return {"active": False, "message": "운영자로 인해 종료되었습니다.", "timestamp": 0}


def save_emergency(data):
    try:
        with open(EMERGENCY_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Error] Failed to save emergency: {e}")
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(DATA_EMERGENCY_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Warning] Failed to export data/emergency.json: {e}")


def load_users():
    default_users = get_default_users()
    deleted_users = load_deleted_users()
    if USERS_FILE.exists():
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                users_list = data.get("users", [])
                # Filter out any tombstoned deleted users
                filtered_list = [u for u in users_list if u.get("username", "").strip().lower() not in deleted_users]
                modified = (len(filtered_list) != len(users_list))
                for u in filtered_list:
                    if "tier" not in u:
                        u["tier"] = "premium" if u.get("username") in ("reader", "yeonwoo") else "pro"
                        modified = True
                    if "password" not in u:
                        u["password"] = "1234"
                        modified = True
                    if "passwordHash" not in u:
                        u["passwordHash"] = hashlib.sha256(u.get("password", "1234").encode("utf-8")).hexdigest()
                        modified = True
                data["users"] = filtered_list
                if modified:
                    save_users(data)
                return data
        except Exception as e:
            print(f"[Warning] Failed to read users.json: {e}")

    # Initialize only if USERS_FILE never existed, omitting tombstoned users
    filtered_defaults = [u for u in default_users.get("users", []) if u.get("username", "").strip().lower() not in deleted_users]
    init_data = {"users": filtered_defaults}
    save_users(init_data)
    return init_data


def save_users(data):
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Error] Failed to save users: {e}")

    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        export_users = []
        for u in data.get("users", []):
            pw = u.get("password", "1234")
            pw_hash = u.get("passwordHash") or hashlib.sha256(pw.encode("utf-8")).hexdigest()
            export_users.append({
                "username": u.get("username"),
                "name": u.get("name", u.get("username")),
                "tier": u.get("tier", "pro"),
                "password": pw,
                "passwordHash": pw_hash,
                "createdAt": u.get("createdAt", "-")
            })
        with open(DATA_USERS_FILE, "w", encoding="utf-8") as f:
            json.dump({"users": export_users}, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Warning] Failed to export data/users.json: {e}")


def get_sanitized_users():
    users_data = load_users().get("users", [])
    return [
        {
            "username": u.get("username"),
            "name": u.get("name", u.get("username")),
            "tier": u.get("tier", "pro"),
            "createdAt": u.get("createdAt", "-")
        }
        for u in users_data
    ]


def load_user_progress():
    if USER_PROGRESS_FILE.exists():
        try:
            with open(USER_PROGRESS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Warning] Failed to read user_progress.json: {e}")
    return {}


def save_user_progress(data):
    try:
        with open(USER_PROGRESS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Error] Failed to save user_progress.json: {e}")


def load_shares():
    if SHARES_FILE.exists():
        try:
            with open(SHARES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Warning] Failed to read shares.json: {e}")
    return {}


def save_shares(data):
    try:
        with open(SHARES_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[Error] Failed to save shares.json: {e}")


def _run_tunnel(port):
    global PUBLIC_TUNNEL_URL
    try:
        cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8", "-R", f"80:localhost:{port}", "localhost.run"]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        for line in proc.stdout:
            if not line:
                break
            m = re.search(r"https?://[a-zA-Z0-9\.\-]+\.lhr\.life", line)
            if m:
                PUBLIC_TUNNEL_URL = m.group(0)
                print(f"[북웨이브] 🌐 외부(다른 와이파이/LTE) 공유 공용 주소 연결 성공: {PUBLIC_TUNNEL_URL}")
                break
        proc.wait()
    except Exception as e:
        print(f"[Info] 외부 공유 터널 연결 대기: {e}")


def start_public_tunnel(port):
    t = threading.Thread(target=_run_tunnel, args=(port,), daemon=True)
    t.start()


def sync_library():
    """Sync file system contents with metadata."""
    meta = load_metadata()
    items = meta.get("items", {})
    found_ids = set()

    # Scan books
    for p in BOOKS_DIR.iterdir():
        if p.is_file() and p.suffix.lower() in EBOOK_EXTS:
            item_id = f"book_{p.name}"
            found_ids.add(item_id)
            if item_id not in items:
                items[item_id] = {
                    "id": item_id,
                    "title": p.stem.replace("_", " "),
                    "fileName": p.name,
                    "type": "ebook",
                    "format": p.suffix.lower().lstrip("."),
                    "size": p.stat().st_size,
                    "url": f"/library/books/{urllib.parse.quote(p.name)}",
                    "progress": 0,
                    "createdAt": time.strftime("%Y-%m-%d %H:%M"),
                }

    # Scan audio
    for p in AUDIO_DIR.iterdir():
        if p.is_file() and p.suffix.lower() in AUDIO_EXTS:
            item_id = f"audio_{p.name}"
            found_ids.add(item_id)
            if item_id not in items:
                items[item_id] = {
                    "id": item_id,
                    "title": p.stem.replace("_", " "),
                    "fileName": p.name,
                    "type": "audiobook",
                    "format": p.suffix.lower().lstrip("."),
                    "size": p.stat().st_size,
                    "url": f"/library/audio/{urllib.parse.quote(p.name)}",
                    "progress": 0,
                    "duration": 0,
                    "createdAt": time.strftime("%Y-%m-%d %H:%M"),
                }

    # Clean removed files
    for item_id in list(items.keys()):
        if item_id not in found_ids:
            del items[item_id]

    meta["items"] = items
    save_metadata(meta)
    return list(items.values())


class BookPlayerHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and custom headers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Filename, X-Admin-Token, Range")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def is_admin_authorized(self):
        token = self.headers.get("X-Admin-Token")
        return token and token in admin_sessions

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # API: Get Active Advertisement List & Rotation Settings
        if path == "/api/ad":
            ads_data = load_ads()
            active_list = [a for a in ads_data.get("ads", []) if a.get("active", True)]
            primary_ad = active_list[0] if active_list else (ads_data.get("ads", [{}])[0] if ads_data.get("ads") else {})
            res_payload = {
                "success": True,
                "active": ads_data.get("active", True),
                "rotationMode": ads_data.get("rotationMode", "sequence"),
                "ads": ads_data.get("ads", []),
                "ad": primary_ad
            }
            data = json.dumps(res_payload, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # API: Get Tiers Policy Configuration
        if path == "/api/tiers":
            tiers_data = load_tiers()
            data = json.dumps({"success": True, "tiers": tiers_data}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # API: Get Emergency Stop State (Public for user web heartbeat)
        if path == "/api/emergency":
            emergency_data = load_emergency()
            data = json.dumps({"success": True, "emergency": emergency_data}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # API: Get Library Items
        if path == "/api/items":
            items = sync_library()
            data = json.dumps({"items": items}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # API: Get Word eBook Extracted Text (For 2-page spread physical reader)
        if path == "/api/book-text":
            query = urllib.parse.parse_qs(parsed.query)
            item_id = query.get("id", [""])[0]
            filename = query.get("file", [""])[0]

            meta = load_metadata()
            items = meta.get("items", {})

            target_file = None
            book_title = "전자책"
            if item_id and item_id in items:
                target_file = BOOKS_DIR / items[item_id].get("fileName", "")
                book_title = items[item_id].get("title", "전자책")
            elif filename:
                safe_name = os.path.basename(urllib.parse.unquote(filename))
                target_file = BOOKS_DIR / safe_name
                book_title = Path(safe_name).stem

            if not target_file or not target_file.exists():
                res = json.dumps({"success": False, "message": "도서 파일을 찾을 수 없습니다."}).encode("utf-8")
                self.send_response(404)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            ext = target_file.suffix.lower()
            text = ""
            pages = []
            if ext == ".docx":
                try:
                    with open(target_file, "rb") as f:
                        raw_bytes = f.read()
                        pages = parse_docx_pages(raw_bytes)
                        text = parse_docx_bytes(raw_bytes)
                except Exception as e:
                    text = f"Word 문서 파싱 오류: {e}"
            else:
                try:
                    with open(target_file, "r", encoding="utf-8", errors="replace") as f:
                        text = f.read()
                except Exception as e:
                    text = f"도서 내용을 읽을 수 없습니다: {e}"

            res = json.dumps({"success": True, "pages": pages, "text": text, "title": book_title}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(res)))
            self.end_headers()
            self.wfile.write(res)
            return

        # API: Get Registered Users (Admin only)
        if path == "/api/users":
            if not self.is_admin_authorized():
                res = json.dumps({"success": False, "message": "인증이 필요합니다."}).encode("utf-8")
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            users = get_sanitized_users()
            data = json.dumps({"success": True, "users": users}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # API: Real-time User Profile & Tier Status (For client real-time sync)
        if path == "/api/user/status":
            query = urllib.parse.parse_qs(parsed.query)
            username = query.get("username", [""])[0].strip()
            users_data = load_users().get("users", [])
            matched = None
            for u in users_data:
                if u.get("username", "").lower() == username.lower():
                    matched = u
                    break
            if matched:
                res = json.dumps({
                    "success": True,
                    "user": {
                        "username": matched.get("username"),
                        "name": matched.get("name", matched.get("username")),
                        "tier": matched.get("tier", "pro")
                    }
                }, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
            else:
                res = json.dumps({"success": False, "message": "사용자를 찾을 수 없습니다."}).encode("utf-8")
                self.send_response(404)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(res)))
            self.end_headers()
            self.wfile.write(res)
            return

        # API: Get Saved Reading/Listening Progress
        if path == "/api/user/progress":
            query = urllib.parse.parse_qs(parsed.query)
            username = query.get("username", [""])[0].strip()
            item_id = query.get("itemId", [""])[0].strip()
            all_progress = load_user_progress()
            user_data = all_progress.get(username, {})
            if item_id:
                prog_item = user_data.get(item_id)
                res_data = {"success": True, "found": bool(prog_item), "progress": prog_item}
            else:
                res_data = {"success": True, "progress": user_data}
            res = json.dumps(res_data, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(res)))
            self.end_headers()
            self.wfile.write(res)
            return

        # API: Resolve Book Share Code (BW-XXXX)
        if path == "/api/share/resolve":
            query = urllib.parse.parse_qs(parsed.query)
            raw_code = query.get("code", [""])[0].strip()
            code = raw_code.upper()
            if not code.startswith("BW-") and len(code) == 4 and code.isdigit():
                code = f"BW-{code}"
            shares = load_shares()
            if code in shares:
                res = json.dumps({"success": True, "share": shares[code]}, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
            else:
                # Fallback: check if raw_code is directly an itemId in metadata
                meta = load_metadata().get("items", {})
                if raw_code in meta:
                    item = meta[raw_code]
                    fallback_share = {
                        "code": code,
                        "itemId": item["id"],
                        "title": item["title"],
                        "type": item["type"],
                        "spreadIndex": 0,
                        "currentTime": 0
                    }
                    res = json.dumps({"success": True, "share": fallback_share}, ensure_ascii=False).encode("utf-8")
                    self.send_response(200)
                else:
                    res = json.dumps({"success": False, "message": "유효하지 않거나 만료된 공유 코드입니다."}).encode("utf-8")
                    self.send_response(404)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(res)))
            self.end_headers()
            self.wfile.write(res)
            return

        # API: Network & Cross-Network Sharing Info
        if path == "/api/network/info":
            local_ip = get_local_ip()
            info = {
                "success": True,
                "port": CURRENT_SERVER_PORT,
                "localIp": local_ip,
                "localUrl": f"http://{local_ip}:{CURRENT_SERVER_PORT}",
                "publicUrl": PUBLIC_TUNNEL_URL,
                "hasPublicTunnel": bool(PUBLIC_TUNNEL_URL)
            }
            res = json.dumps(info, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(res)))
            self.end_headers()
            self.wfile.write(res)
            return

        # Serve static index.html on root
        if path in ("/", "/index.html"):
            return self.serve_file(STATIC_DIR / "index.html")

        # Serve static admin.html on /admin
        if path in ("/admin", "/admin.html"):
            return self.serve_file(STATIC_DIR / "admin.html")

        # Static assets
        if path.startswith("/static/"):
            rel_path = path[len("/static/"):]
            file_path = STATIC_DIR / rel_path
            return self.serve_file(file_path)

        # Library media/book files (with HTTP Range support)
        if path.startswith("/library/"):
            rel_path = urllib.parse.unquote(path[len("/library/"):])
            file_path = LIBRARY_DIR / rel_path
            return self.serve_file_with_range(file_path)

        # Data directory files
        if path.startswith("/data/"):
            rel_path = urllib.parse.unquote(path[len("/data/"):])
            file_path = DATA_DIR / rel_path
            return self.serve_file(file_path)

        # Fallback 404
        self.send_error(404, f"File Not Found: {path}")

    def serve_file(self, file_path: Path):
        file_path = file_path.resolve()
        if not file_path.exists() or not file_path.is_file():
            self.send_error(404, "File Not Found")
            return

        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            mime_type = "application/octet-stream"

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {e}")

    def serve_file_with_range(self, file_path: Path):
        file_path = file_path.resolve()
        if not file_path.exists() or not file_path.is_file():
            self.send_error(404, "File Not Found")
            return

        file_size = file_path.stat().st_size
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            mime_type = "application/octet-stream"

        range_header = self.headers.get("Range")

        try:
            with open(file_path, "rb") as f:
                if range_header and range_header.startswith("bytes="):
                    byte_range = range_header[6:].strip()
                    parts = byte_range.split("-")
                    start = int(parts[0]) if parts[0] else 0
                    end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1

                    if start >= file_size or end >= file_size or start > end:
                        self.send_response(416)
                        self.send_header("Content-Range", f"bytes */{file_size}")
                        self.end_headers()
                        return

                    length = end - start + 1
                    f.seek(start)
                    chunk = f.read(length)

                    self.send_response(206)
                    self.send_header("Content-Type", mime_type)
                    self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                    self.send_header("Content-Length", str(length))
                    self.send_header("Accept-Ranges", "bytes")
                    self.end_headers()
                    self.wfile.write(chunk)
                else:
                    self.send_response(200)
                    self.send_header("Content-Type", mime_type)
                    self.send_header("Content-Length", str(file_size))
                    self.send_header("Accept-Ranges", "bytes")
                    self.end_headers()
                    while True:
                        buf = f.read(65536)
                        if not buf:
                            break
                        self.wfile.write(buf)
        except (ConnectionResetError, BrokenPipeError):
            pass
        except Exception as e:
            self.send_error(500, f"Streaming error: {e}")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get("Content-Length", 0))

        # API: Admin Authentication (Verify secret password via hash)
        if path == "/api/admin/auth":
            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8"))
                input_pwd = payload.get("password", "")

                # Cryptographic hash verification (SHA-256)
                input_hash = hashlib.sha256(input_pwd.encode("utf-8")).hexdigest()
                if input_hash == get_admin_pw_hash():
                    token = secrets.token_hex(20)
                    admin_sessions.add(token)
                    save_admin_sessions(admin_sessions)
                    res = json.dumps({"success": True, "token": token}).encode("utf-8")
                    self.send_response(200)
                else:
                    res = json.dumps({"success": False, "message": "접속 암호가 올바르지 않습니다."}).encode("utf-8")
                    self.send_response(401)

                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Auth error: {e}")
            return

        # API: Change Master Password (When logged into Studio)
        if path == "/api/admin/change-password":
            if not self.is_admin_authorized():
                res = json.dumps({"success": False, "message": "보안 인증이 필요합니다."}).encode("utf-8")
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8"))
                new_pw = payload.get("newPassword", "")
                if not new_pw or len(new_pw) < 4:
                    res = json.dumps({"success": False, "message": "새 암호는 4자 이상이어야 합니다."}).encode("utf-8")
                    self.send_response(400)
                else:
                    new_hash = hashlib.sha256(new_pw.encode("utf-8")).hexdigest()
                    save_admin_pw_hash(new_hash)
                    res = json.dumps({"success": True, "message": "스튜디오 접속 암호가 성공적으로 변경되었습니다."}).encode("utf-8")
                    self.send_response(200)

                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Password change error: {e}")
            return

        # API: User Login (ID + PW verification)
        if path == "/api/login":
            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8"))
                username = payload.get("username", "").strip()
                password = payload.get("password", "")

                pw_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
                users_data = load_users().get("users", [])

                matched = None
                for u in users_data:
                    if u.get("username", "").lower() == username.lower() and u.get("passwordHash") == pw_hash:
                        matched = u
                        break

                if matched:
                    res = json.dumps({
                        "success": True,
                        "user": {
                            "username": matched.get("username"),
                            "name": matched.get("name", matched.get("username")),
                            "tier": matched.get("tier", "pro")
                        }
                    }, ensure_ascii=False).encode("utf-8")
                    self.send_response(200)
                else:
                    res = json.dumps({
                        "success": False,
                        "message": "등록되지 않은 아이디이거나 비밀번호가 일치하지 않습니다."
                    }, ensure_ascii=False).encode("utf-8")
                    self.send_response(401)

                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Login error: {e}")
            return

        # API: Sync Session Tier State (Real-time tier update)
        if path == "/api/user/sync":
            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8")) if body else {}
                username = payload.get("username", "").strip()
                users_data = load_users().get("users", [])
                matched = None
                for u in users_data:
                    if u.get("username", "").lower() == username.lower():
                        matched = u
                        break
                if matched:
                    client_tier = payload.get("currentTier", "")
                    db_tier = matched.get("tier", "pro")
                    res = json.dumps({
                        "success": True,
                        "changed": (bool(client_tier) and client_tier != db_tier),
                        "user": {
                            "username": matched.get("username"),
                            "name": matched.get("name", matched.get("username")),
                            "tier": db_tier
                        }
                    }, ensure_ascii=False).encode("utf-8")
                    self.send_response(200)
                else:
                    res = json.dumps({"success": False, "message": "사용자를 찾을 수 없습니다."}).encode("utf-8")
                    self.send_response(404)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Sync error: {e}")
            return

        # API: Save Reading / Listening Progress to Server
        if path == "/api/user/progress":
            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8")) if body else {}
                username = payload.get("username", "").strip()
                item_id = payload.get("itemId", "").strip()

                if not username or not item_id:
                    res = json.dumps({"success": False, "message": "아이디와 도서 정보가 누락되었습니다."}).encode("utf-8")
                    self.send_response(400)
                else:
                    all_progress = load_user_progress()
                    if username not in all_progress:
                        all_progress[username] = {}

                    record = {
                        "itemId": item_id,
                        "title": payload.get("title", ""),
                        "type": payload.get("type", "ebook"),
                        "format": payload.get("format", ""),
                        "spreadIndex": int(payload.get("spreadIndex", 0)),
                        "totalSpreads": int(payload.get("totalSpreads", 0)),
                        "currentTime": float(payload.get("currentTime", 0)),
                        "duration": float(payload.get("duration", 0)),
                        "progress": float(payload.get("progress", payload.get("percent", 0))),
                        "percent": float(payload.get("percent", payload.get("progress", 0))),
                        "updatedAt": time.strftime("%Y-%m-%d %H:%M:%S")
                    }
                    all_progress[username][item_id] = record
                    save_user_progress(all_progress)
                    res = json.dumps({"success": True, "saved": record}, ensure_ascii=False).encode("utf-8")
                    self.send_response(200)

                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Progress save error: {e}")
            return

        # API: Create 6-character Book Share Code (e.g. BW-8491)
        if path == "/api/share/create":
            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8")) if body else {}
                item_id = payload.get("itemId", "").strip()
                title = payload.get("title", "").strip()
                item_type = payload.get("type", "ebook")
                spread_index = int(payload.get("spreadIndex", 0))
                current_time = float(payload.get("currentTime", 0))
                sender = payload.get("sender", "북웨이브 독자")

                if not item_id:
                    res = json.dumps({"success": False, "message": "공유할 도서 ID가 필요합니다."}).encode("utf-8")
                    self.send_response(400)
                else:
                    shares = load_shares()
                    # Generate unique 4-digit number suffix: BW-XXXX
                    code = ""
                    for _ in range(50):
                        cand = f"BW-{random.randint(1000, 9999)}"
                        if cand not in shares:
                            code = cand
                            break
                    if not code:
                        code = f"BW-{random.randint(10000, 99999)}"

                    share_entry = {
                        "code": code,
                        "itemId": item_id,
                        "title": title,
                        "type": item_type,
                        "spreadIndex": spread_index,
                        "currentTime": current_time,
                        "sender": sender,
                        "createdAt": time.strftime("%Y-%m-%d %H:%M")
                    }
                    shares[code] = share_entry
                    save_shares(shares)

                    local_ip = get_local_ip()
                    base_url = PUBLIC_TUNNEL_URL if PUBLIC_TUNNEL_URL else f"http://{local_ip}:{CURRENT_SERVER_PORT}"
                    share_link = f"{base_url}/?share={code}"

                    res = json.dumps({
                        "success": True,
                        "code": code,
                        "shareLink": share_link,
                        "publicUrl": PUBLIC_TUNNEL_URL,
                        "share": share_entry
                    }, ensure_ascii=False).encode("utf-8")
                    self.send_response(200)

                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Share create error: {e}")
            return

        # API: Request / Restart External Sharing Tunnel
        if path == "/api/network/tunnel":
            start_public_tunnel(CURRENT_SERVER_PORT)
            res = json.dumps({
                "success": True,
                "message": "외부 공유 터널 연결을 시도 중입니다.",
                "publicUrl": PUBLIC_TUNNEL_URL
            }, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(res)))
            self.end_headers()
            self.wfile.write(res)
            return

        # API: Create / Register User (Admin Only)
        if path == "/api/users":
            if not self.is_admin_authorized():
                res = json.dumps({"success": False, "message": "보안 인증이 필요합니다."}).encode("utf-8")
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8"))
                username = payload.get("username", "").strip()
                password = payload.get("password", "").strip()
                name = payload.get("name", "").strip() or username
                tier = payload.get("tier", "pro").strip().lower()
                if tier not in ("free", "pro", "premium"):
                    tier = "pro"

                if not username or not password:
                    res = json.dumps({"success": False, "message": "아이디와 비밀번호를 모두 입력해주세요."}).encode("utf-8")
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(res)))
                    self.end_headers()
                    self.wfile.write(res)
                    return

                users_obj = load_users()
                users_list = users_obj.get("users", [])

                # Check duplicate username
                for u in users_list:
                    if u.get("username", "").lower() == username.lower():
                        res = json.dumps({"success": False, "message": f"'{username}' 아이디는 이미 등록되어 있습니다."}).encode("utf-8")
                        self.send_response(400)
                        self.send_header("Content-Type", "application/json; charset=utf-8")
                        self.send_header("Content-Length", str(len(res)))
                        self.end_headers()
                        self.wfile.write(res)
                        return

                # Hash password and save
                pw_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
                new_user = {
                    "username": username,
                    "name": name,
                    "tier": tier,
                    "password": password,
                    "passwordHash": pw_hash,
                    "createdAt": time.strftime("%Y-%m-%d %H:%M")
                }
                users_list.append(new_user)
                users_obj["users"] = users_list
                save_users(users_obj)
                remove_from_deleted_users(username)

                res = json.dumps({
                    "success": True,
                    "message": f"회원 '{username}' 등록 완료 ({tier})",
                    "users": get_sanitized_users()
                }, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"User registration error: {e}")
            return

        # API: Delete User via POST (Fallback for proxies/environments that restrict DELETE)
        if path == "/api/users/delete":
            if not self.is_admin_authorized():
                res = json.dumps({"success": False, "message": "보안 인증이 필요합니다."}).encode("utf-8")
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8")) if body else {}
                target_username = payload.get("username", "").strip()
                if target_username:
                    add_deleted_user(target_username)
                users_obj = load_users()
                users_list = users_obj.get("users", [])
                users_list = [u for u in users_list if u.get("username", "").lower() != target_username.lower()]
                users_obj["users"] = users_list
                save_users(users_obj)

                res = json.dumps({"success": True, "users": get_sanitized_users()}, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Delete user error: {e}")
            return

        # API: Reveal User Passwords (Requires Master Password verification)
        if path == "/api/users/reveal-passwords":
            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8"))
                master_pw = payload.get("masterPassword", "")

                input_hash = hashlib.sha256(master_pw.encode("utf-8")).hexdigest()
                if input_hash == get_admin_pw_hash():
                    users_data = load_users().get("users", [])
                    passwords = {
                        u.get("username"): u.get("password", "1234")
                        for u in users_data
                    }
                    res = json.dumps({"success": True, "passwords": passwords}, ensure_ascii=False).encode("utf-8")
                    self.send_response(200)
                else:
                    res = json.dumps({"success": False, "message": "접속 암호가 올바르지 않습니다."}).encode("utf-8")
                    self.send_response(401)

                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Reveal passwords error: {e}")
            return

        # API: Update User Password (From Studio)
        if path == "/api/users/update-password":
            if not self.is_admin_authorized():
                res = json.dumps({"success": False, "message": "보안 인증이 필요합니다."}).encode("utf-8")
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8"))
                username = payload.get("username", "").strip()
                new_password = payload.get("newPassword", "")

                if not username or not new_password:
                    res = json.dumps({"success": False, "message": "아이디와 새 비밀번호를 입력해 주세요."}).encode("utf-8")
                    self.send_response(400)
                else:
                    users_obj = load_users()
                    users_list = users_obj.get("users", [])
                    matched = False
                    for u in users_list:
                        if u.get("username", "").lower() == username.lower():
                            u["password"] = new_password
                            u["passwordHash"] = hashlib.sha256(new_password.encode("utf-8")).hexdigest()
                            matched = True
                            break
                    if matched:
                        save_users(users_obj)
                        res = json.dumps({
                            "success": True,
                            "message": f"'{username}' 회원의 비밀번호가 성공적으로 변경되었습니다.",
                            "users": get_sanitized_users()
                        }, ensure_ascii=False).encode("utf-8")
                        self.send_response(200)
                    else:
                        res = json.dumps({"success": False, "message": "해당 회원을 찾을 수 없습니다."}).encode("utf-8")
                        self.send_response(404)

                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"User password update error: {e}")
            return

        # API: Update User Tier (Admin Only)
        if path == "/api/users/update-tier":
            if not self.is_admin_authorized():
                res = json.dumps({"success": False, "message": "보안 인증이 필요합니다."}).encode("utf-8")
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8"))
                username = payload.get("username", "").strip()
                tier = payload.get("tier", "free").strip().lower()
                if tier not in ("free", "pro", "premium"):
                    tier = "free"

                users_obj = load_users()
                users_list = users_obj.get("users", [])
                updated = False
                for u in users_list:
                    if u.get("username", "").lower() == username.lower():
                        u["tier"] = tier
                        updated = True
                        break

                if updated:
                    save_users(users_obj)
                    res = json.dumps({
                        "success": True,
                        "message": f"'{username}' 회원의 등급이 '{tier}'(으)로 변경되었습니다.",
                        "users": get_sanitized_users()
                    }, ensure_ascii=False).encode("utf-8")
                    self.send_response(200)
                else:
                    res = json.dumps({"success": False, "message": "해당 회원을 찾을 수 없습니다."}).encode("utf-8")
                    self.send_response(404)

                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Tier update error: {e}")
            return

        # API: Update Advertisement Settings (Admin Only)
        if path == "/api/ad":
            if not self.is_admin_authorized():
                res = json.dumps({"success": False, "message": "보안 인증이 필요합니다."}).encode("utf-8")
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8"))
                if "ads" not in payload:
                    payload = {
                        "active": payload.get("active", True),
                        "rotationMode": payload.get("rotationMode", "sequence"),
                        "ads": [payload]
                    }
                save_ads(payload)
                active_list = [a for a in payload.get("ads", []) if a.get("active", True)]
                primary_ad = active_list[0] if active_list else (payload.get("ads", [{}])[0] if payload.get("ads") else {})
                res = json.dumps({
                    "success": True,
                    "message": "광고 로테이션 설정이 성공적으로 저장되었습니다.",
                    "active": payload.get("active", True),
                    "rotationMode": payload.get("rotationMode", "sequence"),
                    "ads": payload.get("ads", []),
                    "ad": primary_ad
                }, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Ad update error: {e}")
            return

        # API: Update Tiers Policy Configuration (Admin Only)
        if path == "/api/tiers":
            if not self.is_admin_authorized():
                res = json.dumps({"success": False, "message": "보안 인증이 필요합니다."}).encode("utf-8")
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8")) if body else {}
                tiers_data = load_tiers()
                # Update free, pro, premium policies safely
                for t in ("free", "pro", "premium"):
                    if t in payload and isinstance(payload[t], dict):
                        t_conf = payload[t]
                        if "access" in t_conf:
                            tiers_data[t]["access"] = "allow" if t_conf["access"] == "allow" else "block"
                        if "adMode" in t_conf:
                            tiers_data[t]["adMode"] = "none" if t_conf["adMode"] == "none" else "always"
                        if "allowDownload" in t_conf:
                            tiers_data[t]["allowDownload"] = bool(t_conf["allowDownload"])
                        if "maxDownloads" in t_conf:
                            try:
                                tiers_data[t]["maxDownloads"] = max(0, int(t_conf["maxDownloads"]))
                            except Exception:
                                pass
                        if "label" in t_conf:
                            tiers_data[t]["label"] = str(t_conf["label"])
                        if "description" in t_conf:
                            tiers_data[t]["description"] = str(t_conf["description"])
                save_tiers(tiers_data)
                res = json.dumps({
                    "success": True,
                    "message": "회원 등급별 정책 설정이 성공적으로 저장되었습니다.",
                    "tiers": tiers_data
                }, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Tiers update error: {e}")
            return

        # API: Toggle Emergency Stop (Admin Only)
        if path == "/api/emergency":
            if not self.is_admin_authorized():
                res = json.dumps({"success": False, "message": "보안 인증이 필요합니다."}).encode("utf-8")
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8")) if body else {}
                active = bool(payload.get("active", False))
                msg = payload.get("message", "운영자로 인해 종료되었습니다.")
                em_data = {
                    "active": active,
                    "message": msg,
                    "timestamp": int(time.time() * 1000)
                }
                save_emergency(em_data)
                res = json.dumps({"success": True, "emergency": em_data}, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Emergency toggle error: {e}")
            return

        # API: Upload Advertisement Banner Image (Admin Only)
        if path == "/api/ad/image":
            if not self.is_admin_authorized():
                res = json.dumps({"success": False, "message": "인증이 필요합니다."}).encode("utf-8")
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            if content_length <= 0:
                res = json.dumps({"success": False, "message": "업로드할 파일 내용이 비어있습니다."}).encode("utf-8")
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            raw_filename = self.headers.get("X-Filename", "ad_banner.png")
            safe_name = os.path.basename(urllib.parse.unquote(raw_filename))
            ext = Path(safe_name).suffix.lower()
            if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}:
                ext = ".png"

            raw_ad_id = self.headers.get("X-Ad-Id", "")
            safe_ad_id = re.sub(r'[^a-zA-Z0-9_-]', '', raw_ad_id) if raw_ad_id else f"{int(time.time() * 1000)}"
            dest_filename = f"ad_banner_{safe_ad_id}{ext}"

            LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
            dest_path = LIBRARY_DIR / dest_filename
            try:
                remaining = content_length
                with open(dest_path, "wb") as f:
                    while remaining > 0:
                        chunk_size = min(remaining, 65536)
                        chunk = self.rfile.read(chunk_size)
                        if not chunk:
                            break
                        f.write(chunk)
                        remaining -= len(chunk)

                image_url = f"/library/{dest_filename}?t={int(time.time())}"
                res = json.dumps({
                    "success": True,
                    "imageUrl": image_url,
                    "message": "광고 이미지가 업로드되었습니다."
                }, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Ad image upload failed: {e}")
            return

        # API: Upload File
        if path == "/api/upload":
            raw_filename = self.headers.get("X-Filename")
            if not raw_filename:
                query = urllib.parse.parse_qs(parsed.query)
                raw_filename = query.get("name", [""])[0]

            if not raw_filename:
                self.send_error(400, "Missing filename header or query (X-Filename)")
                return

            filename = urllib.parse.unquote(raw_filename)
            safe_name = os.path.basename(filename)
            if not safe_name:
                self.send_error(400, "Invalid filename")
                return

            ext = Path(safe_name).suffix.lower()
            upload_type = self.headers.get("X-Upload-Type", "").strip().lower()

            if upload_type == "ebook" and ext not in EBOOK_EXTS:
                res = json.dumps({"success": False, "message": f"전자책 구역에는 Word(.docx, .doc) 파일만 등록할 수 있습니다."}, ensure_ascii=False).encode("utf-8")
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return
            elif upload_type == "audiobook" and ext not in AUDIO_EXTS:
                res = json.dumps({"success": False, "message": f"오디오북 구역에는 음원 파일(MP3, M4A, WAV, FLAC 등)만 등록할 수 있습니다."}, ensure_ascii=False).encode("utf-8")
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            if ext in AUDIO_EXTS:
                dest_dir = AUDIO_DIR
            elif ext in EBOOK_EXTS:
                dest_dir = BOOKS_DIR
            else:
                res = json.dumps({
                    "success": False,
                    "message": f"지원되지 않는 파일 형식('{ext}')입니다. 전자책은 Word(.docx) 파일만, 오디오북은 음원 파일만 지원됩니다."
                }, ensure_ascii=False).encode("utf-8")
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            dest_path = dest_dir / safe_name
            try:
                remaining = content_length
                with open(dest_path, "wb") as f:
                    while remaining > 0:
                        chunk_size = min(remaining, 65536)
                        chunk = self.rfile.read(chunk_size)
                        if not chunk:
                            break
                        f.write(chunk)
                        remaining -= len(chunk)

                items = sync_library()
                res = json.dumps({"success": True, "message": f"{safe_name} 업로드 완료", "items": items}, ensure_ascii=False)
                res_bytes = res.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res_bytes)))
                self.end_headers()
                self.wfile.write(res_bytes)
            except Exception as e:
                self.send_error(500, f"Upload failed: {e}")
            return

        # API: Save Progress
        if path == "/api/progress":
            try:
                body = self.rfile.read(content_length)
                payload = json.loads(body.decode("utf-8"))
                item_id = payload.get("id")
                progress = payload.get("progress")
                duration = payload.get("duration")

                meta = load_metadata()
                if item_id in meta.get("items", {}):
                    if progress is not None:
                        meta["items"][item_id]["progress"] = progress
                    if duration is not None:
                        meta["items"][item_id]["duration"] = duration
                    save_metadata(meta)

                res = json.dumps({"success": True}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                self.send_error(500, f"Progress save failed: {e}")
            return

        self.send_error(404, "Not Found")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # API: Delete Registered User (Admin Only)
        if path.startswith("/api/users/"):
            if not self.is_admin_authorized():
                res = json.dumps({"success": False, "message": "인증이 필요합니다."}).encode("utf-8")
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                return

            target_username = urllib.parse.unquote(path[len("/api/users/"):])
            if target_username:
                add_deleted_user(target_username)
            users_obj = load_users()
            users_list = users_obj.get("users", [])
            users_list = [u for u in users_list if u.get("username", "").lower() != target_username.lower()]
            users_obj["users"] = users_list
            save_users(users_obj)

            res = json.dumps({"success": True, "users": get_sanitized_users()}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(res)))
            self.end_headers()
            self.wfile.write(res)
            return

        # API: Delete Item (/api/items/<id>)
        if path.startswith("/api/items/"):
            item_id = urllib.parse.unquote(path[len("/api/items/"):])
            meta = load_metadata()
            items = meta.get("items", {})

            if item_id in items:
                item = items[item_id]
                filename = item.get("fileName")
                if item.get("type") == "audiobook":
                    target_file = AUDIO_DIR / filename
                else:
                    target_file = BOOKS_DIR / filename

                if target_file.exists():
                    try:
                        target_file.unlink()
                    except Exception as e:
                        print(f"[Error] Deleting file {target_file}: {e}")

                del items[item_id]
                save_metadata(meta)

            res = json.dumps({"success": True, "items": list(items.values())}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(res)))
            self.end_headers()
            self.wfile.write(res)
            return

        self.send_error(404, "Not Found")

    def log_message(self, format, *args):
        sys.stdout.write(f"[{time.strftime('%H:%M:%S')}] {args[0]} {args[1]}\n")
        sys.stdout.flush()


# Fix Windows cp949 encoding for console output
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def get_local_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def find_free_port(start_port=8000, max_attempts=50):
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("0.0.0.0", port))
                return port
            except OSError:
                continue
    return start_port


def open_browser_delayed(url):
    time.sleep(1.0)
    print(f"\n[북웨이브] 브라우저를 실행합니다: {url}")
    webbrowser.open(url)


# ========================================================
# AUTO-EMBEDDED DEPLOYMENT ASSETS (Single-File Self-Extractor)
# ========================================================
EMBEDDED_BUNDLE_B64 = "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"

def extract_update_bundle():
    for zname in ["server_deploy.zip", "bookwave_bundle.zip", "bookwave_all_in_one.zip"]:
        zp = BASE_DIR / zname
        if zp.exists():
            try:
                with zipfile.ZipFile(zp, "r") as z:
                    z.extractall(BASE_DIR)
                print(f"[북웨이브] 📦 {zname} 압축 패키지 자동 해제 완료")
            except Exception as e:
                print(f"[Warning] Failed to unpack {zname}: {e}")

    if EMBEDDED_BUNDLE_B64:
        try:
            raw = base64.b64decode(EMBEDDED_BUNDLE_B64)
            with zipfile.ZipFile(io.BytesIO(raw), "r") as z:
                z.extractall(BASE_DIR)
            print("[북웨이브] ✨ 통합 업데이트 에셋 동기화 완료")
        except Exception as e:
            print(f"[Warning] Failed to unpack embedded bundle: {e}")


def main():
    extract_update_bundle()
    global CURRENT_SERVER_PORT
    sync_library()
    env_port = os.environ.get("PORT")
    if env_port:
        try:
            port = int(env_port)
        except ValueError:
            port = find_free_port(8000)
    else:
        port = find_free_port(8000)
    CURRENT_SERVER_PORT = port
    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, BookPlayerHandler)

    local_ip = get_local_ip()
    url = f"http://localhost:{port}"
    mobile_url = f"http://{local_ip}:{port}"
    print("=" * 64)
    print("🌊 [북웨이브 (bookwave)] 오디오북 & 전자책 서버 가동 중")
    print(f"[*] 💻 PC 접속 주소:     {url}")
    print(f"[*] 📱 스마트폰 접속 주소: {mobile_url} (동일 와이파이 접속)")
    print(f"[*] 🌐 외부/다른 와이파이 공유: 백그라운드 터널 준비 중...")
    print(f"[*] 📖 전자책 저장소:     {BOOKS_DIR} (Word .docx 전용)")
    print(f"[*] 🎧 오디오북 저장소:   {AUDIO_DIR} (모든 음원 지원)")
    print("=" * 64)
    print("서버를 종료하려면 이 창에서 Ctrl + C 를 누르세요.\n")

    start_public_tunnel(port)
    if not os.environ.get("PORT"):
        threading.Thread(target=open_browser_delayed, args=(url,), daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
        httpd.server_close()


if __name__ == "__main__":
    main()
