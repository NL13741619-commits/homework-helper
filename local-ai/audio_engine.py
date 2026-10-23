"""Local speech plus score-controlled experimental singing; no external API.
Flite supplies the English speech timbre; WORLD explicitly controls pitch/time.
This is a DSP singing prototype, not a trained standalone singing model.
"""
import io, math, re, struct, subprocess, tempfile, wave
from pathlib import Path
import numpy as np
from scipy.io import wavfile

RATE = 22050
VOICE = 'slt'

def wav_bytes(audio, rate=RATE):
    out = io.BytesIO()
    with wave.open(out, 'wb') as file:
        file.setnchannels(1); file.setsampwidth(2); file.setframerate(rate)
        file.writeframes((np.clip(audio, -.98, .98) * 32767).astype('<i2').tobytes())
    return out.getvalue()

def speech(text):
    if not isinstance(text, str) or not re.fullmatch(r"[A-Za-z0-9 .,!?'-]{1,600}", text) or not re.search('[A-Za-z]', text):
        raise ValueError('ENGLISH_VOICE_ONLY')
    with tempfile.TemporaryDirectory(prefix='dawn-speech-') as temp:
        path = Path(temp); (path/'text.txt').write_text(text)
        result = subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i',
            f"flite=textfile={path/'text.txt'}:voice={VOICE}", '-ar',str(RATE),'-ac','1','-y',str(path/'out.wav')],
            capture_output=True, timeout=20, check=False)
        if result.returncode: raise RuntimeError('LOCAL_TTS_UNAVAILABLE')
        rate, pcm = wavfile.read(path/'out.wav')
    return pcm.astype(np.float64) / 32768, rate

def validate_score(score):
    if not isinstance(score, dict) or score.get('rights') not in ['original','licensed']:
        raise ValueError('LYRICS_RIGHTS_REQUIRED')
    tempo = score.get('tempo', 100)
    if isinstance(tempo,bool) or not isinstance(tempo,(float,int)) or not math.isfinite(tempo) or not 50 <= tempo <= 180:
        raise ValueError('INVALID_TEMPO')
    notes = score.get('notes')
    if not isinstance(notes,list) or not 1 <= len(notes) <= 32: raise ValueError('INVALID_SCORE')
    cleaned=[]; duration=0
    for item in notes:
        if not isinstance(item,dict): raise ValueError('INVALID_NOTE')
        word,note,beats = item.get('lyric'),item.get('midi'),item.get('beats',1)
        if not isinstance(word,str) or not re.fullmatch('[A-Za-z]{1,18}',word): raise ValueError('ENGLISH_SYLLABLE_REQUIRED')
        if isinstance(note,bool) or not isinstance(note,int) or not 48 <= note <= 84: raise ValueError('INVALID_PITCH')
        if isinstance(beats,bool) or not isinstance(beats,(float,int)) or not math.isfinite(beats) or not .25<=beats<=4: raise ValueError('INVALID_BEATS')
        duration += beats*60/tempo
        cleaned.append({'lyric':word,'midi':note,'beats':beats})
    if duration>30: raise ValueError('SONG_TOO_LONG')
    return tempo,cleaned

def variable_length(value):
    result=[value & 127]; value >>= 7
    while value: result.insert(0,(value & 127)|128); value >>= 7
    return bytes(result)

def midi_file(tempo, notes):
    track=bytearray(b'\x00\xff\x51\x03'+round(60000000/tempo).to_bytes(3,'big'))
    for n in notes:
        lyric=n['lyric'].encode('ascii')
        track.extend(b'\x00\xff\x05'+variable_length(len(lyric))+lyric)
        track.extend(bytes([0,0x90,n['midi'],85]))
        track.extend(variable_length(round(n['beats']*480))+bytes([0x80,n['midi'],0]))
    track.extend(b'\x00\xff\x2f\x00')
    return b'MThd'+struct.pack('>IHHH',6,0,1,480)+b'MTrk'+struct.pack('>I',len(track))+track

def sing(score, cancelled=lambda: False):
    import pyworld as pw
    tempo, notes=validate_score(score)
    vocal=[]; accompaniment=[]; timeline=[]; start=0
    for note in notes:
        if cancelled(): raise ValueError('CANCELLED')
        x,rate=speech(note['lyric'])
        if rate != RATE: raise RuntimeError('INVALID_SAMPLE_RATE')
        active=np.flatnonzero(np.abs(x)>.007)
        if not len(active): raise RuntimeError('NO_SPEECH_AUDIO')
        x=np.ascontiguousarray(x[max(0,active[0]-300):min(len(x),active[-1]+300)],dtype=np.float64)
        f0,t=pw.dio(x,RATE,frame_period=5.0,f0_floor=65,f0_ceil=600)
        f0=pw.stonemask(x,f0,t,RATE)
        sp=pw.cheaptrick(x,f0,t,RATE)
        ap=pw.d4c(x,f0,t,RATE)
        duration=note['beats']*60/tempo; count=round(duration*RATE)
        frame_count=max(2,round(duration/.005)); idx=np.linspace(0,len(f0)-1,frame_count)
        lo=np.floor(idx).astype(int); hi=np.minimum(lo+1,len(f0)-1); alpha=(idx-lo)[:,None]
        sp2=np.ascontiguousarray(sp[lo]*(1-alpha)+sp[hi]*alpha)
        ap2=np.ascontiguousarray(ap[lo]*(1-alpha)+ap[hi]*alpha)
        voiced=f0[np.rint(idx).astype(int)]>0
        if voiced.mean()<.05: raise RuntimeError('NO_VOICED_SYLLABLE')
        pitch=440*2**((note['midi']-69)/12)
        phase=np.arange(frame_count)*.005
        target=np.where(voiced,pitch*(1+.003*np.sin(2*np.pi*5*phase)),0).astype(np.float64)
        y=pw.synthesize(target,sp2,ap2,RATE,frame_period=5.0)
        y=np.pad(y,(0,max(0,count-len(y))))[:count]
        peak=np.max(np.abs(y)); y=y*(.7/max(peak,.01))
        fade=min(round(.012*RATE),len(y)//2)
        if fade: y[:fade]*=np.linspace(0,1,fade); y[-fade:]*=np.linspace(1,0,fade)
        seconds=np.arange(count)/RATE
        backing=.08*np.sin(2*np.pi*pitch/4*seconds)*np.minimum(1,seconds/.03)*np.minimum(1,(duration-seconds)/.05)
        vocal.append(y); accompaniment.append(backing)
        timeline.append({**note,'start_seconds':round(start,5),'end_seconds':round(start+duration,5),'target_hz':pitch})
        start+=duration
    voice=np.concatenate(vocal); backing=np.concatenate(accompaniment)
    return {'vocal_wav':wav_bytes(voice),'backing_wav':wav_bytes(backing),'mix_wav':wav_bytes(voice+backing),
        'midi':midi_file(tempo,notes),'timeline':timeline,'duration_seconds':len(voice)/RATE,
        'engine':'dawn-score-world-v1','status':'EXPERIMENTAL_DSP_SINGING','trained_singing_model':False,
        'voice_id':'flite-slt-en','rights':score['rights']}
