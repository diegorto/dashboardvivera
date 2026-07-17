import json, os, time, re, csv, urllib.request
from datetime import datetime, timedelta

BASE_DIR = '/root/dashboardvivera-prod'
ENV_PATH = os.path.join(BASE_DIR, '.env')
STATE_PATH = os.path.join(BASE_DIR, 'pipeline_tracker_state.json')
EVENTS_PATH = os.path.join(BASE_DIR, 'pipeline_events.csv')
REPORT_PATH = os.path.join(BASE_DIR, 'pipeline_report.csv')
LOG_PROGRESS = os.path.join(BASE_DIR, 'pipeline_tracker_progress.txt')

TRACKED_STAGES = {
    5:  ('comparecimento', 'compareceu'),
    13: ('nao_compareceu', 'faltou'),
    63: ('remarcou', 'remarcou'),
    64: ('cancelou', 'cancelou'),
}

def load_token():
    with open(ENV_PATH) as f:
        for line in f:
            if line.startswith('PIPEDRIVE_TOKEN='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('PIPEDRIVE_TOKEN not found')

TOKEN = load_token()
BASE = 'https://api.pipedrive.com/v1'

def get(url):
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                return json.load(r)
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None

def normalize_phone(person):
    if not isinstance(person, dict):
        return ''
    phones = person.get('phone') or []
    if not phones:
        return ''
    primary = next((p for p in phones if p.get('primary')), phones[0])
    raw = primary.get('value') or ''
    digits = re.sub(r'\D', '', raw)
    if len(digits) >= 10:
        digits = digits[-11:]
    return digits

def fetch_deals_all():
    deals = []
    start = 0
    while True:
        url = f"{BASE}/deals?status=all_not_deleted&start={start}&limit=500&api_token={TOKEN}"
        d = get(url)
        if not d or not d.get('data'):
            break
        deals.extend(d['data'])
        pag = d.get('additional_data', {}).get('pagination', {})
        if not pag.get('more_items_in_collection'):
            break
        start = pag.get('next_start')
        time.sleep(0.1)
    return deals

def fetch_deals_updated_since(since_dt):
    deals = []
    start = 0
    since_str = since_dt.strftime('%Y-%m-%d %H:%M:%S')
    while True:
        url = f"{BASE}/deals?status=all_not_deleted&start={start}&limit=500&sort=update_time%20DESC&api_token={TOKEN}"
        d = get(url)
        if not d or not d.get('data'):
            break
        stop = False
        for deal in d['data']:
            ut = deal.get('update_time') or ''
            if ut and ut < since_str:
                stop = True
                break
            deals.append(deal)
        if stop:
            break
        pag = d.get('additional_data', {}).get('pagination', {})
        if not pag.get('more_items_in_collection'):
            break
        start = pag.get('next_start')
        time.sleep(0.1)
    return deals

def load_existing_event_keys():
    keys = set()
    if os.path.exists(EVENTS_PATH):
        with open(EVENTS_PATH, newline='', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                keys.add((row['deal_id'], row['entered_at'], row['stage_id']))
    return keys

def append_events(new_rows):
    file_exists = os.path.exists(EVENTS_PATH)
    with open(EVENTS_PATH, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['deal_id', 'person_name', 'phone', 'owner_name', 'stage_id', 'event_key', 'entered_at', 'old_stage'])
        for row in new_rows:
            writer.writerow(row)

def scan_deals(deals, existing_keys):
    new_rows = []
    total = len(deals)
    with open(LOG_PROGRESS, 'w') as pf:
        pf.write(f'total={total}\nprocessed=0\nfound=0\n')
    found = 0
    for i, deal in enumerate(deals):
        did = str(deal['id'])
        url = f"{BASE}/deals/{did}/flow?api_token={TOKEN}"
        fd = get(url)
        if fd and fd.get('data'):
            person = deal.get('person_id') if isinstance(deal.get('person_id'), dict) else {}
            person_name = person.get('name') or deal.get('title') or ''
            phone = normalize_phone(person)
            owner = (deal.get('user_id') or {}).get('name') if isinstance(deal.get('user_id'), dict) else ''
            for x in fd['data']:
                if x.get('object') != 'dealChange':
                    continue
                c = x.get('data', {})
                if c.get('field_key') != 'stage_id':
                    continue
                new_val = c.get('new_value')
                try:
                    stage_id = int(new_val)
                except (TypeError, ValueError):
                    continue
                if stage_id not in TRACKED_STAGES:
                    continue
                entered_at = c.get('log_time')
                key = (did, entered_at, str(stage_id))
                if key in existing_keys:
                    continue
                existing_keys.add(key)
                event_key = TRACKED_STAGES[stage_id][0]
                new_rows.append([did, person_name, phone, owner, stage_id, event_key, entered_at, c.get('old_value')])
                found += 1
        if i % 25 == 0:
            with open(LOG_PROGRESS, 'w') as pf:
                pf.write(f'total={total}\nprocessed={i}\nfound={found}\n')
            print(f'{i}/{total} processed, {found} new events', flush=True)
        time.sleep(0.12)
    with open(LOG_PROGRESS, 'w') as pf:
        pf.write(f'total={total}\nprocessed={total}\nfound={found}\nDONE=1\n')
    return new_rows

def build_report():
    rows = []
    with open(EVENTS_PATH, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            rows.append(row)
    by_person = {}
    for row in rows:
        ident = row['phone'] or ('name:' + row['person_name'].strip().lower())
        by_person.setdefault(ident, []).append(row)
    out_rows = []
    for ident, evts in by_person.items():
        by_type = {}
        for e in evts:
            by_type.setdefault(e['event_key'], []).append(e)
        for event_key, lst in by_type.items():
            lst.sort(key=lambda r: r['entered_at'])
            verb = TRACKED_STAGES[[k for k, v in TRACKED_STAGES.items() if v[0] == event_key][0]][1]
            for idx, e in enumerate(lst, start=1):
                label = verb if idx == 1 else f'{verb} {idx}a vez'
                out_rows.append({
                    'person_name': e['person_name'],
                    'phone': e['phone'],
                    'deal_id': e['deal_id'],
                    'owner_name': e['owner_name'],
                    'event_type': event_key,
                    'occurrence': idx,
                    'label': label,
                    'entered_at': e['entered_at'],
                })
    out_rows.sort(key=lambda r: r['entered_at'])
    with open(REPORT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['person_name', 'phone', 'deal_id', 'owner_name', 'event_type', 'occurrence', 'label', 'entered_at'])
        writer.writeheader()
        writer.writerows(out_rows)
    return len(out_rows)

def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH) as f:
            return json.load(f)
    return {}

def save_state(state):
    with open(STATE_PATH, 'w') as f:
        json.dump(state, f)

def main():
    state = load_state()
    now = datetime.utcnow()
    if not state.get('last_run'):
        print('No previous state found -> running FULL backfill (all deals).', flush=True)
        deals = fetch_deals_all()
    else:
        last_run = datetime.fromisoformat(state['last_run'])
        since = last_run - timedelta(days=2)
        print(f'Incremental run: deals updated since {since}', flush=True)
        deals = fetch_deals_updated_since(since)
    print(f'Deals to scan: {len(deals)}', flush=True)
    existing_keys = load_existing_event_keys()
    new_rows = scan_deals(deals, existing_keys)
    if new_rows:
        append_events(new_rows)
    total_report_rows = build_report()
    state['last_run'] = now.isoformat()
    save_state(state)
    print(f'New events this run: {len(new_rows)}. Report rows total: {total_report_rows}.', flush=True)

if __name__ == '__main__':
    main()
