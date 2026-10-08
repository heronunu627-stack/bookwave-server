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


def main():
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
