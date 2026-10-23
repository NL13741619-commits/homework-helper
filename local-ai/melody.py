"""Measured monophonic melody/rhythm, proposed lyric alignment and Mandarin rhyme.
Not polyphonic transcription, ASR or forced alignment to a recorded singer.
"""
import base64,io,math,re,wave
import numpy as np
from scipy.signal import find_peaks,resample_poly
from scipy.ndimage import median_filter

RATE=22050

def decode_wav(encoded):
    if not isinstance(encoded,str) or len(encoded)>8_000_000:raise ValueError('AUDIO_SIZE_LIMIT')
    try:raw=base64.b64decode(encoded,validate=True)
    except Exception:raise ValueError('INVALID_BASE64')
    try:
        with wave.open(io.BytesIO(raw)) as file:
            rate,channels,width,count=file.getframerate(),file.getnchannels(),file.getsampwidth(),file.getnframes()
            if channels not in [1,2] or width!=2 or not 8000<=rate<=96000 or count/rate>30 or count/rate<1:
                raise ValueError('REQUIRE_1_TO_30_SECOND_PCM16_WAV')
            pcm=file.readframes(count)
            if len(pcm)!=count*channels*width:raise ValueError('TRUNCATED_WAV')
    except (wave.Error,EOFError):raise ValueError('INVALID_WAV')
    x=np.frombuffer(pcm,dtype='<i2').astype(float).reshape(-1,channels).mean(axis=1)/32768
    if np.max(np.abs(x))<.005:raise ValueError('AUDIO_TOO_QUIET')
    if rate!=RATE:
        divisor=math.gcd(rate,RATE);x=resample_poly(x,RATE//divisor,rate//divisor)
    return np.ascontiguousarray(x),RATE

def rhythm(x,rate):
    hop=220;frame=660
    energy=np.array([np.sqrt(np.mean(x[i:i+frame]**2)) for i in range(0,len(x)-frame,hop)])
    novelty=np.maximum(0,np.diff(np.r_[0,energy]));novelty=np.convolve(novelty,np.ones(3)/3,mode='same')
    if not np.any(novelty):return {'tempo_bpm':None,'tempo_candidates':[],'onsets_seconds':[],'confidence':'INSUFFICIENT_RHYTHM'}
    peaks,_=find_peaks(novelty,height=np.max(novelty)*.18,distance=round(.12*rate/hop),prominence=np.max(novelty)*.08)
    times=peaks*hop/rate
    if len(times)<3:return {'tempo_bpm':None,'tempo_candidates':[],'onsets_seconds':times.tolist(),'confidence':'INSUFFICIENT_RHYTHM'}
    # Inter-onset durations carry beat/subdivision ambiguity; report candidates.
    intervals=np.diff(times);intervals=intervals[(intervals>=.25)&(intervals<=1.2)]
    if not len(intervals):return {'tempo_bpm':None,'tempo_candidates':[],'onsets_seconds':times.tolist(),'confidence':'INSUFFICIENT_RHYTHM'}
    interval=float(np.median(intervals));bpm=60/interval
    while bpm<60:bpm*=2
    while bpm>180:bpm/=2
    alternatives=sorted(set(round(v,2) for v in [bpm/2,bpm,bpm*2] if 40<=v<=240))
    variability=float(np.std(intervals)/max(np.mean(intervals),.001))
    return {'tempo_bpm':round(bpm,2),'tempo_candidates':alternatives,'onsets_seconds':[round(float(t),4) for t in times],
        'confidence':'REGULAR_ONSETS_BEAT_LEVEL_UNCONFIRMED' if variability<.15 else 'VARIABLE_OR_UNCERTAIN',
        'interval_variation':round(variability,4),'meter':'NOT_INFERRED','tempo_changes':'NOT_IMPLEMENTED'}

def autocorrelation_pitch(x,rate,times):
    """Normalized autocorrelation fallback for clean tonal instruments."""
    size=2048;minimum=round(rate/1000);maximum=round(rate/65);result=np.zeros(len(times))
    padded=np.pad(x,(size//2,size//2))
    for index,time in enumerate(times):
        start=round(time*rate);frame=padded[start:start+size]
        if len(frame)<size or np.sqrt(np.mean(frame**2))<.005:continue
        frame=frame-np.mean(frame);power=np.r_[0,np.cumsum(frame**2)]
        spectrum=np.fft.rfft(frame,n=size*2);ac=np.fft.irfft(spectrum*np.conj(spectrum),n=size*2)
        lags=np.arange(minimum,maximum+1)
        denominator=np.sqrt((power[size-lags]-power[0])*(power[size]-power[lags]))
        normalized=ac[lags]/np.maximum(denominator,1e-12)
        peaks,_=find_peaks(normalized)
        if not len(peaks):continue
        best=np.max(normalized[peaks]);eligible=peaks[normalized[peaks]>=max(.85,best*.98)]
        if not len(eligible):continue
        k=int(eligible[0]);lag=float(lags[k])
        if 0<k<len(normalized)-1:
            a,b,c=normalized[k-1:k+2];denom=a-2*b+c
            if abs(denom)>1e-12:lag+=float(.5*(a-c)/denom)
        result[index]=rate/lag
    return result

def analyze(encoded,source_kind='monophonic'):
    if source_kind not in ['monophonic','isolated_vocal']:raise ValueError('NEEDS_MELODY_SOURCE_SEPARATION')
    import pyworld as pw
    x,rate=decode_wav(encoded);f0,t=pw.harvest(x,rate,f0_floor=65,f0_ceil=1000,frame_period=5.)
    pitch_engine='WORLD_HARVEST'
    if source_kind=='monophonic' or np.mean(f0>0)<.05:
        f0=autocorrelation_pitch(x,rate,t);pitch_engine='NORMALIZED_AUTOCORRELATION_FALLBACK'
    voiced=f0>0;midi=np.zeros_like(f0);midi[voiced]=69+12*np.log2(f0[voiced]/440)
    rounded=median_filter(np.rint(midi).astype(int),size=5)
    notes=[];begin=None;current=None
    for i,pitch in enumerate(np.r_[rounded,0]):
        valid=pitch>0
        if valid and begin is None:begin=i;current=int(pitch)
        elif begin is not None and (not valid or pitch!=current):
            end=i
            if (end-begin)*.005>=.07:
                hz=f0[begin:end];hz=hz[hz>0]
                notes.append({'midi':current,'frequency_hz':round(float(np.median(hz)),3),'start_seconds':round(begin*.005,4),
                    'end_seconds':round(end*.005,4),'duration_seconds':round((end-begin)*.005,4)})
            begin=i if valid else None;current=int(pitch) if valid else None
    if not notes:raise ValueError('NO_STABLE_MELODY')
    beat=rhythm(x,rate)
    for note in notes:
        note['pitch_name']=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][note['midi']%12]+str(note['midi']//12-1)
        note['beats_estimate']=round(note['duration_seconds']*beat['tempo_bpm']/60,3) if beat['tempo_bpm'] else None
    return {'status':'EXPERIMENTAL_MONOPHONIC_ANALYSIS','sample_rate':rate,'duration_seconds':round(len(x)/rate,4),'source_kind':source_kind,
        'notes':notes,'pitch_engine':pitch_engine,'rhythm':beat,'voiced_fraction':round(float(voiced.mean()),4),'polyphonic_transcription':False,
        'limitations':['Pitch octaves and repeated same-pitch notes may need correction.','Tempo half/double ambiguity is retained.','Recorded lyric transcription is not implemented.']}

def syllables(text):
    return re.findall(r"[\u3400-\u9fff]|[A-Za-z]+(?:'[A-Za-z]+)?",text)

def align_lyrics(notes,text):
    if not isinstance(text,str) or len(text)>2000:raise ValueError('INVALID_LYRICS')
    units=syllables(text)
    if not units or not notes:raise ValueError('LYRICS_AND_NOTES_REQUIRED')
    if len(units)>len(notes):raise ValueError('MORE_SYLLABLES_THAN_NOTES_NEEDS_MANUAL_SPLIT')
    # Dynamic programming groups contiguous notes into syllables. Each syllable
    # gets at least one note; long groups become melisma, not invented new words.
    n,m=len(notes),len(units)
    if n>256:raise ValueError('TOO_MANY_NOTES')
    durations=np.array([v['duration_seconds'] for v in notes]);prefix=np.r_[0,np.cumsum(durations)];target=prefix[-1]/m
    dp=np.full((m+1,n+1),np.inf);back={};dp[0,0]=0
    for u in range(1,m+1):
        for j in range(u,n-(m-u)+1):
            for k in range(u-1,j):
                cost=dp[u-1,k]+((prefix[j]-prefix[k]-target)/max(target,.001))**2
                if cost<dp[u,j]:dp[u,j]=cost;back[u,j]=k
    groups=[];j=n
    for u in range(m,0,-1):
        k=back[u,j];group=notes[k:j];groups.append({'syllable':units[u-1],'note_indexes':list(range(k,j)),
            'start_seconds':group[0]['start_seconds'],'end_seconds':group[-1]['end_seconds'],'melisma':len(group)>1});j=k
    groups.reverse()
    return {'status':'PROPOSED_SCORE_ALIGNMENT','forced_alignment_to_recording':False,'items':groups,
        'english_word_syllabification':'ONE_TOKEN_PER_WORD_NOT_PHONETIC','mandarin_units':'ONE_HAN_CHARACTER_PER_SYLLABLE',
        'current_english_voice_can_render':all(re.fullmatch('[A-Za-z]+',v) for v in units)}

def rhyme_report(text):
    from pypinyin import lazy_pinyin,Style
    if not isinstance(text,str) or len(text)>2000:raise ValueError('INVALID_LYRICS')
    lines=[line.strip() for line in re.split(r'[\n。！？!?；;]+',text) if line.strip()]
    reports=[];labels={}
    for line in lines:
        chars=re.findall(r'[\u3400-\u9fff]',line)
        if not chars:
            reports.append({'line':line,'status':'MANDARIN_ENDING_NOT_FOUND'});continue
        # Contextual default pronunciation; polyphonic words remain reviewable.
        final=lazy_pinyin(''.join(chars),style=Style.FINALS,strict=True)[-1]
        if final not in labels:labels[final]=chr(65+len(labels)%26)
        reports.append({'line':line,'last_character':chars[-1],'pinyin_final':final,'exact_rhyme_group':labels[final],
            'pronunciation_status':'DEFAULT_READING_REVIEW_POLYPHONES'})
    return {'status':'MANDARIN_EXACT_FINAL_RHYME_PROPOSAL','lines':reports,'scheme':' '.join(r.get('exact_rhyme_group','?') for r in reports),
        'note':'Compares finals, not written characters or tones. Near-rhyme, dialect and artistic judgement are not inferred.'}
