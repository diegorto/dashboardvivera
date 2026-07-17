import json, os, time, sys, urllib.request

TOKEN = None
with open('/root/dashboardvivera-prod/.env') as f:
    for line in f:
        if line.startswith('PIPEDRIVE_TOKEN='):
            TOKEN = line.strip().split('=',1)[1]
BASE = 'https://api.pipedrive.com/v1'

def get(url):
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                return json.load(r)
        except Exception as e:
            time.sleep(2 * (attempt+1))
    return None

def fetch_all_deals():
    deals = []
    start = 0
    while True:
        url = f"{BASE}/deals?status=all_not_deleted&start={start}&limit=500&api_token={TOKEN}"
        d = get(url)
        if not d or not d.get('data'):
            break
        deals.extend(d['data'])
        pag = d.get('additional_data',{}).get('pagination',{})
        if not pag.get('more_items_in_collection'):
            break
        start = pag.get('next_start')
        time.sleep(0.1)
    return deals

def main():
    out_path = '/root/dashboardvivera-prod/comparecimento_history.csv'
    progress_path = '/root/dashboardvivera-prod/scan_progress.txt'
    print('Fetching all deals...')
    deals = fetch_all_deals()
    print(f'Total deals: {len(deals)}')
    with open(progress_path, 'w') as pf:
        pf.write(f'total_deals={len(deals)}\nprocessed=0\nfound=0\n')
    found = 0
    with open(out_path, 'w') as out:
        out.write('deal_id,person_name,owner_name,entered_at,old_stage\n')
        for i, deal in enumerate(deals):
            did = deal['id']
            url = f"{BASE}/deals/{did}/flow?api_token={TOKEN}"
            fd = get(url)
            if fd and fd.get('data'):
                for x in fd['data']:
                    if x.get('object') == 'dealChange':
                        c = x.get('data', {})
                        if c.get('field_key') == 'stage_id' and str(c.get('new_value')) == '5':
                            person = deal.get('person_name') or (deal.get('person_id') or {}).get('name') if isinstance(deal.get('person_id'), dict) else ''
                            owner = (deal.get('user_id') or {}).get('name') if isinstance(deal.get('user_id'), dict) else ''
                            entered = c.get('log_time')
                            old_stage = c.get('old_value')
                            out.write(f"{did},\"{person}\",\"{owner}\",{entered},{old_stage}\n")
                            out.flush()
                            found += 1
            if i % 25 == 0:
                with open(progress_path, 'w') as pf:
                    pf.write(f'total_deals={len(deals)}\nprocessed={i}\nfound={found}\n')
                print(f'{i}/{len(deals)} processed, {found} found', flush=True)
            time.sleep(0.12)
    with open(progress_path, 'w') as pf:
        pf.write(f'total_deals={len(deals)}\nprocessed={len(deals)}\nfound={found}\nDONE=1\n')
    print('DONE', found)

if __name__ == '__main__':
    main()
