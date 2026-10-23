"""Optional public catalogue discovery. Never downloads or analyzes a full song."""
import html,json,re,urllib.parse,urllib.request

def plain(value):return html.unescape(re.sub('<[^>]+>','',str(value)))[:2000]

def search(query,opener=urllib.request.urlopen):
    if not isinstance(query,str) or not 1<=len(query.strip())<=120:raise ValueError('INVALID_SONG_QUERY')
    params={'action':'query','format':'json','generator':'search','gsrsearch':query.strip()+' filetype:audio','gsrnamespace':6,'gsrlimit':5,
        'prop':'imageinfo','iiprop':'url|extmetadata','formatversion':2}
    req=urllib.request.Request('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params),headers={'User-Agent':'DawnMelodyResearch/0.1 (local educational prototype)'})
    with opener(req,timeout=15) as response:
        raw=response.read(524289)
        if len(raw)>524288:raise RuntimeError('CATALOGUE_RESPONSE_LIMIT')
        data=json.loads(raw)
    if data.get('error'):raise RuntimeError('CATALOGUE_SEARCH_FAILED')
    results=[]
    for page in data.get('query',{}).get('pages',[]):
        for info in page.get('imageinfo',[])[:1]:
            meta=info.get('extmetadata',{});value=lambda key:plain(meta.get(key,{}).get('value',''))
            url=info.get('descriptionurl','')
            if not url.startswith('https://commons.wikimedia.org/wiki/'):continue
            results.append({'title':plain(page.get('title','')),'source_page':url,'license_label':value('LicenseShortName'),
                'license_url':value('LicenseUrl'),'attribution':value('Artist'),'analysis_performed':False,'audio_downloaded':False})
    return {'status':'CATALOGUE_CANDIDATES_ONLY','provider':'Wikimedia Commons','query':query.strip(),'results':results,
        'note':'Search result is not a song identity match or a melody. Select an appropriate source and supply an audio file for measurement.'}
