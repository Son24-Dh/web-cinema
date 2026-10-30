#!/usr/bin/env python3
"""
Tool import phim từ API (KKPhim/OPhim) vào DâuPhim (clone-web).
Usage:
    python3 import_movie.py <slug1> <slug2> ...
Ví dụ:
    python3 import_movie.py tien-nghich
"""

import sys
import os
import re
import json
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_JSON_PATH = os.path.join(BASE_DIR, 'data.json')
DATA_JS_PATH = os.path.join(BASE_DIR, 'data.js')
SW_JS_PATH = os.path.join(BASE_DIR, 'sw.js')

def clean_html(text):
    if not text:
        return ""
    return re.sub(r'<[^>]+>', '', text).strip()

def fetch_movie_from_api(slug):
    # Trích xuất slug nếu người dùng truyền vào cả URL
    slug = slug.strip().rstrip('/')
    if '/' in slug:
        slug = slug.split('/')[-1]

    url = f"https://phimapi.com/phim/{slug}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if not data.get('status'):
                print(f"[!] API trả về lỗi cho slug '{slug}': {data.get('msg')}")
                return None
            return data
    except Exception as e:
        print(f"[!] Không thể tải dữ liệu cho '{slug}': {e}")
        return None

def process_movie(raw_data):
    m = raw_data['movie']
    slug = m.get('slug')
    name = m.get('name', '')
    origin_name = m.get('origin_name', '')
    full_name = f"{name} - {origin_name}" if origin_name and origin_name != name else name

    # Phân loại category
    episodes_raw = raw_data.get('episodes', [])
    total_eps_count = sum(len(s.get('server_data', [])) for s in episodes_raw)
    
    # Kiểm tra nếu là hoạt hình
    genres = [c.get('name', '').lower() for c in m.get('category', [])]
    if any('hoạt hình' in g or 'anime' in g for g in genres):
        category = 'hoat-hinh'
    else:
        category = 'phim-bo' if total_eps_count > 1 else 'phim-le'

    # Gộp các server theo số tập
    episodes_dict = {}
    for ep_set in episodes_raw:
        s_name = ep_set.get('server_name', '').strip()
        if 'vietsub' in s_name.lower():
            s_label = 'Hà Nội (Vietsub)'
        elif 'thuyết minh' in s_name.lower():
            s_label = 'Thuyết Minh'
        elif 'lồng tiếng' in s_name.lower():
            s_label = 'Lồng Tiếng'
        else:
            s_label = s_name

        for ep in ep_set.get('server_data', []):
            ep_name = ep.get('name', '').replace('Tập ', '').replace('tập ', '').strip()
            ep_slug = ep.get('slug', '').replace('tap-', '').strip()
            if not ep_slug:
                ep_slug = ep_name
            
            # Chuẩn hóa tên tập (bỏ số 0 thừa nếu là số)
            if ep_name.isdigit():
                clean_name = str(int(ep_name))
            else:
                clean_name = ep_name

            if ep_slug.isdigit():
                clean_slug = str(int(ep_slug))
            else:
                clean_slug = ep_slug

            key = clean_slug
            if key not in episodes_dict:
                episodes_dict[key] = {
                    'name': clean_name,
                    'slug': clean_slug,
                    'servers': {}
                }
            
            link = ep.get('link_m3u8')
            if link:
                episodes_dict[key]['servers'][s_label] = link

    def sort_key(x):
        try:
            return (0, int(x['slug']))
        except ValueError:
            return (1, x['slug'])

    sorted_episodes = sorted(episodes_dict.values(), key=sort_key)

    poster = m.get('thumb_url') or m.get('poster_url')
    # Đảm bảo poster có http/https
    if poster and not poster.startswith('http'):
        poster = f"https://phimimg.com/{poster.lstrip('/')}"

    return {
        'id': slug,
        'name': full_name,
        'category': category,
        'description': clean_html(m.get('content', '')),
        'poster': poster,
        'year': str(m.get('year', '2023')),
        'episodes': sorted_episodes
    }

def update_database(new_movies):
    with open(DATA_JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if 'movies' not in data:
        data['movies'] = {}

    for m in new_movies:
        data['movies'][m['id']] = m
        print(f" [+] Đã cập nhật phim '{m['name']}' ({len(m['episodes'])} tập)")

    # 1. Ghi lại data.json
    with open(DATA_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')

    # 2. Ghi lại data.js
    with open(DATA_JS_PATH, 'w', encoding='utf-8') as f:
        f.write('const movies = ')
        json.dump(data['movies'], f, indent=4, ensure_ascii=False)
        f.write(';\n\n')
        f.write("if (typeof window !== 'undefined') { window.DEFAULT_MOVIES = movies; }\n")
        f.write("if (typeof module !== 'undefined') { module.exports = movies; }\n")

    # 3. Bump version sw.js
    if os.path.exists(SW_JS_PATH):
        with open(SW_JS_PATH, 'r', encoding='utf-8') as f:
            sw_content = f.read()
        m = re.search(r"const CACHE = 'dauphim-v(\d+)\.(\d+)';", sw_content)
        if m:
            major, minor = int(m.group(1)), int(m.group(2))
            new_version = f"dauphim-v{major}.{minor + 1}"
            sw_content = re.sub(r"const CACHE = 'dauphim-v\d+\.\d+';", f"const CACHE = '{new_version}';", sw_content)
            with open(SW_JS_PATH, 'w', encoding='utf-8') as f:
                f.write(sw_content)
            print(f" [*] Đã cập nhật Service Worker cache lên {new_version}")

def main():
    if len(sys.argv) < 2:
        print("Sử dụng: python3 import_movie.py <slug_phim_1> <slug_phim_2> ...")
        sys.exit(1)

    slugs = sys.argv[1:]
    processed = []
    for slug in slugs:
        print(f"[*] Đang tải thông tin phim '{slug}'...")
        raw = fetch_movie_from_api(slug)
        if raw:
            movie = process_movie(raw)
            processed.append(movie)

    if processed:
        update_database(processed)
        print(f"\n[✓] Hoàn tất thêm {len(processed)} phim vào clone-web!")
    else:
        print("\n[!] Không có phim nào được thêm.")

if __name__ == '__main__':
    main()
