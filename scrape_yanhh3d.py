#!/usr/bin/env python3
"""
Cào 4 phim hoạt hình 3D từ yanhh3d.plus và tích hợp vào clone-web (DâuPhim).
Phim:
1. Tiên Nghịch (tien-nghich)
2. Quang Âm Chi Ngoại (quan-am-chi-ngoai)
3. Mục Thần Ký (muc-than-ky)
4. Thương Nguyên Đồ (thuong-nguyen-do)
"""

import sys
import os
import re
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_JSON_PATH = os.path.join(BASE_DIR, 'data.json')
DATA_JS_PATH = os.path.join(BASE_DIR, 'data.js')
SW_JS_PATH = os.path.join(BASE_DIR, 'sw.js')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
}

MOVIES_TO_SCRAPE = [
    {
        'id': 'tien-nghich',
        'url': 'https://yanhh3d.plus/tien-nghich/tap-164',
        'name': 'Tiên Nghịch - Renegade Immortal',
        'year': '2023'
    },
    {
        'id': 'quan-am-chi-ngoai',
        'url': 'https://yanhh3d.plus/quan-am-chi-ngoai/tap-45',
        'name': 'Quang Âm Chi Ngoại - Beyond the Timescape',
        'year': '2024'
    },
    {
        'id': 'muc-than-ky',
        'url': 'https://yanhh3d.plus/muc-than-ky/tap-106',
        'name': 'Mục Thần Ký - Tales of Herding Gods',
        'year': '2024'
    },
    {
        'id': 'thuong-nguyen-do',
        'url': 'https://yanhh3d.plus/thuong-nguyen-do/tap-101',
        'name': 'Thương Nguyên Đồ - The Demon Hunter',
        'year': '2023'
    }
]

def fetch_html(url, retries=3):
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                return resp.read().decode('utf-8', errors='ignore')
        except Exception as e:
            if attempt == retries - 1:
                return None
            time.sleep(0.5)
    return None

def extract_episode_servers(url):
    html = fetch_html(url)
    if not html:
        return {}
    matches = re.findall(r'id=\"(sv_LINK\d+)\"[^>]*data-src=\"([^\"]+)\"', html)
    return dict(matches)

def scrape_movie(cfg):
    movie_id = cfg['id']
    main_url = cfg['url']
    print(f"\n==================================================")
    print(f"[*] Đang cào phim '{cfg['name']}' từ {main_url}...")
    
    html = fetch_html(main_url)
    if not html:
        print(f"[!] Không thể tải trang chính: {main_url}")
        return None

    # 1. Trích xuất metadata
    poster_m = re.search(r'thumbnailUrl\":\[\"([^\"]+)\"\]', html)
    if not poster_m:
        poster_m = re.search(r'<img[^>]*data-src=\"([^\"]+)\"[^>]*alt=\"[^\"]*\"', html)
    poster = poster_m.group(1) if poster_m else f"https://yanhh3d.plus/storage/movies/{movie_id}.jpg"

    desc_m = re.search(r'description\":\"([^\"]+)\"', html)
    desc = desc_m.group(1) if desc_m else ""
    desc = desc.replace('\\n', ' ').replace('\\r', '').strip()

    # 2. Tìm danh sách tất cả các tập
    ep_matches = re.findall(r'<a\s+class=\"ssl-item ep-item[^\"]*\"\s+href=\"([^\"]+)\"\s+title=\"([^\"]+)\"', html)
    print(f"[*] Tìm thấy {len(ep_matches)} link tập phim.")

    # Gom theo số tập
    episodes_map = {}
    for href, title in ep_matches:
        # Bỏ trailer nếu muốn hoặc chuẩn hóa
        is_trailer = 'TL' in title or 'Trailer' in title
        raw_num = re.sub(r'[^\d]', '', title.split(' ')[0])
        if not raw_num:
            continue
        ep_num = int(raw_num)
        ep_name = str(ep_num)
        if is_trailer:
            ep_name = f"{ep_num} (Trailer)"

        if ep_num not in episodes_map:
            episodes_map[ep_num] = {
                'name': ep_name,
                'slug': str(ep_num),
                'tm_url': None,
                'vs_url': None
            }

        if 'sever2' in href:
            episodes_map[ep_num]['vs_url'] = href
        else:
            episodes_map[ep_num]['tm_url'] = href

    sorted_ep_nums = sorted(episodes_map.keys(), reverse=True)
    print(f"[*] Tổng số tập duy nhất: {len(sorted_ep_nums)} tập (Tập {sorted_ep_nums[0]} -> {sorted_ep_nums[-1]})")

    # 3. Tạo danh sách URL cần cào
    tasks = []
    for num in sorted_ep_nums:
        ep_info = episodes_map[num]
        if ep_info['tm_url']:
            tasks.append((num, 'tm', ep_info['tm_url']))
        if ep_info['vs_url']:
            tasks.append((num, 'vs', ep_info['vs_url']))

    print(f"[*] Bắt đầu tải link video cho {len(tasks)} trang tập bằng đa luồng...")

    def worker(task):
        num, kind, url = task
        srvs = extract_episode_servers(url)
        return num, kind, srvs

    ep_servers_results = {}
    with ThreadPoolExecutor(max_workers=20) as executor:
        for num, kind, srvs in executor.map(worker, tasks):
            if num not in ep_servers_results:
                ep_servers_results[num] = {'tm': {}, 'vs': {}}
            ep_servers_results[num][kind] = srvs

    # 4. Tổ chức lại danh sách episodes cho DâuPhim
    final_episodes = []
    for num in sorted_ep_nums:
        ep_info = episodes_map[num]
        srv_data = ep_servers_results.get(num, {'tm': {}, 'vs': {}})
        tm_srvs = srv_data['tm']
        vs_srvs = srv_data['vs']

        servers = {}

        # Thuyết minh
        if tm_srvs.get('sv_LINK1') or tm_srvs.get('sv_LINK4'):
            servers['YanHH3D (Thuyết Minh 1080p)'] = tm_srvs.get('sv_LINK1') or tm_srvs.get('sv_LINK4')
        if tm_srvs.get('sv_LINK5') or tm_srvs.get('sv_LINK6'):
            servers['YanHH3D (Thuyết Minh 4K)'] = tm_srvs.get('sv_LINK5') or tm_srvs.get('sv_LINK6')
        if tm_srvs.get('sv_LINK2'):
            servers['YanHH3D (Thuyết Minh HD)'] = tm_srvs.get('sv_LINK2')

        # Vietsub
        if vs_srvs.get('sv_LINK1') or vs_srvs.get('sv_LINK4'):
            servers['YanHH3D (Vietsub 1080p)'] = vs_srvs.get('sv_LINK1') or vs_srvs.get('sv_LINK4')
        if vs_srvs.get('sv_LINK5') or vs_srvs.get('sv_LINK6'):
            servers['YanHH3D (Vietsub 4K)'] = vs_srvs.get('sv_LINK5') or vs_srvs.get('sv_LINK6')
        if vs_srvs.get('sv_LINK2'):
            servers['YanHH3D (Vietsub HD)'] = vs_srvs.get('sv_LINK2')

        # Nếu không có tên cụ thể, lấy bất kỳ server nào có
        if not servers:
            for srv_dict, prefix in [(tm_srvs, 'Thuyết Minh'), (vs_srvs, 'Vietsub')]:
                for k, v in srv_dict.items():
                    servers[f"YanHH3D ({prefix} {k})"] = v

        final_episodes.append({
            'name': ep_info['name'],
            'slug': ep_info['slug'],
            'servers': servers
        })

    print(f"[✓] Cào thành công {len(final_episodes)} tập cho '{cfg['name']}'.")

    return {
        'id': movie_id,
        'name': cfg['name'],
        'category': 'phim-bo',
        'description': desc,
        'poster': poster,
        'year': cfg['year'],
        'episodes': final_episodes
    }

def main():
    # Đọc dữ liệu hiện tại
    with open(DATA_JSON_PATH, 'r', encoding='utf-8') as f:
        db = json.load(f)

    if 'movies' not in db:
        db['movies'] = {}

    for cfg in MOVIES_TO_SCRAPE:
        movie_data = scrape_movie(cfg)
        if movie_data:
            m_id = movie_data['id']
            # Giữ lại các server fallback (nếu có từ trước)
            if m_id in db['movies']:
                old_movie = db['movies'][m_id]
                old_eps_by_slug = {ep['slug']: ep.get('servers', {}) for ep in old_movie.get('episodes', [])}
                for ep in movie_data['episodes']:
                    slug = ep['slug']
                    if slug in old_eps_by_slug:
                        for s_name, s_url in old_eps_by_slug[slug].items():
                            if not s_name.startswith('YanHH3D') and s_name not in ep['servers']:
                                ep['servers'][s_name] = s_url

            db['movies'][m_id] = movie_data

    # Ghi lại data.json
    with open(DATA_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print("\n[+] Đã cập nhật data.json")

    # Ghi lại data.js
    with open(DATA_JS_PATH, 'w', encoding='utf-8') as f:
        f.write('const movies = ')
        json.dump(db['movies'], f, indent=4, ensure_ascii=False)
        f.write(';\n\n')
        f.write("if (typeof window !== 'undefined') { window.DEFAULT_MOVIES = movies; }\n")
        f.write("if (typeof module !== 'undefined') { module.exports = movies; }\n")
    print("[+] Đã cập nhật data.js")

    # Bump Service Worker version
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
            print(f"[+] Đã cập nhật Service Worker cache lên {new_version}")

if __name__ == '__main__':
    main()
