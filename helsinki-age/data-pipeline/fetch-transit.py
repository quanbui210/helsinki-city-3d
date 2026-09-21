"""Stream HSL's large GTFS archive using Python's standard library (no extraction).
Routes are scheduled in the downloaded feed window, not live departures.
"""
import csv, io, json, pathlib, shutil, sys, urllib.request, zipfile
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / 'data-pipeline/raw/nearby'
URL = 'https://infopalvelut.storage.hsldev.com/gtfs/hsl.zip'

def mode(value):
    n = int(value)
    if n == 0 or 900 <= n < 1000: return 'tram'
    if n == 1 or n in (400, 401, 402): return 'metro'
    if n == 2 or 100 <= n < 200: return 'train'
    if n == 4 or 1000 <= n < 1100: return 'ferry'
    return 'bus' if n == 3 or 700 <= n < 800 else 'transit'

def rows(archive, name):
    with archive.open(name) as stream:
        yield from csv.DictReader(io.TextIOWrapper(stream, encoding='utf-8-sig', newline=''))

def prepare(archive, bounds):
    w,s,e,n = bounds
    stops = {}
    for r in rows(archive, 'stops.txt'):
        lon,lat = float(r['stop_lon']),float(r['stop_lat'])
        if r.get('location_type','0') not in ('','0') or not(w <= lon <= e and s <= lat <= n): continue
        stops[r['stop_id']] = {'id':'hsl:'+r['stop_id'], 'name':r['stop_name'], 'code':r.get('stop_code',''), 'position':[lon,lat], 'routes':set()}
    routes = {r['route_id']:(mode(r['route_type']), r['route_short_name'] or r['route_long_name']) for r in rows(archive,'routes.txt')}
    trips = {r['trip_id']:r['route_id'] for r in rows(archive,'trips.txt')}
    for r in rows(archive,'stop_times.txt'):
        stop = stops.get(r['stop_id'])
        # Retain drop-off-only stops, but not pass-through timing points.
        if stop is not None and not(r.get('pickup_type')=='1' and r.get('drop_off_type')=='1'):
            route = routes.get(trips.get(r['trip_id']))
            if route: stop['routes'].add(route)
    result = []
    for stop in stops.values():
        if not stop['routes']: continue
        route_list = sorted(stop.pop('routes'))
        modes = sorted(set(m for m,_ in route_list))
        stop.update(type=modes[0] if len(modes)==1 else 'transit', modes=modes, lines=[f'{m.title()} {line}' for m,line in route_list])
        result.append(stop)
    return sorted(result,key=lambda r:r['id'])

def main():
    RAW.mkdir(parents=True,exist_ok=True)
    path = RAW / 'hsl.zip'
    if '--offline' not in sys.argv:
        print('Downloading official HSL GTFS...',flush=True)
        with urllib.request.urlopen(URL,timeout=120) as response, open(RAW/'hsl.download','wb') as target:
            shutil.copyfileobj(response,target)
        (RAW/'hsl.download').replace(path)
        (RAW/'hsl-source.json').write_text(json.dumps({'url':URL,'retrievedAt':datetime.now(timezone.utc).isoformat(),'license':'HSL CC BY 4.0','documentation':'https://www.hsl.fi/en/hsl/open-data'}),encoding='utf-8')
    manifest = json.loads((ROOT/'viewer/public/buildings-manifest.json').read_text(encoding='utf-8'))
    positions = [r['position'] for r in manifest]
    bounds = [min(p[0] for p in positions)-.06,min(p[1] for p in positions)-.03,max(p[0] for p in positions)+.06,max(p[1] for p in positions)+.03]
    with zipfile.ZipFile(path) as archive:
        print('Joining GTFS stops -> stop times -> trips -> routes...',flush=True)
        stops = prepare(archive,bounds)
        feed = list(rows(archive,'feed_info.txt')) if 'feed_info.txt' in archive.namelist() else []
    if len(stops)<100: raise RuntimeError('Unexpectedly incomplete stop coverage')
    output={'bounds':bounds,'stops':stops,'source':json.loads((RAW/'hsl-source.json').read_text(encoding='utf-8')),'feed':feed}
    (RAW/'transit.json').write_text(json.dumps(output,ensure_ascii=False),encoding='utf-8')
    print(f'{len(stops)} served boarding stops prepared',flush=True)

if __name__ == '__main__': main()
