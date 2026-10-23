"""Audio turn detection and stale-output protection, independent of a DOM."""
import math,re
from collections import deque
import numpy as np
RATE=16000
FRAME=320

class VAD:
    def __init__(self):
        self.pre=deque(maxlen=8);self.active=False;self.frames=[];self.hot=0;self.quiet=0;self.noise=.002
    def feed(self,pcm,playing=False):
        if len(pcm)!=FRAME*2:raise ValueError('EXPECTED_20MS_PCM16')
        x=np.frombuffer(pcm,dtype='<i2').astype(np.float32)/32768
        rms=float(np.sqrt(np.mean(x*x)));threshold=max(.016 if not playing else .026,self.noise*3.5)
        loud=rms>threshold
        if not self.active:
            if not loud:self.noise=.98*self.noise+.02*min(rms,.01)
            self.pre.append(pcm);self.hot=self.hot+1 if loud else 0
            if self.hot>=3:
                self.active=True;self.frames=list(self.pre);self.pre.clear();self.quiet=0
                return {'type':'speech_start','rms':rms}
            return None
        self.frames.append(pcm);self.quiet=0 if loud else self.quiet+1
        if self.quiet>=26 or len(self.frames)>=600:
            frames=self.frames;self.frames=[];self.active=False;self.hot=0;self.quiet=0
            if len(frames)<15:return None
            return {'type':'utterance','pcm':b''.join(frames)}
        return None

class TurnGate:
    def __init__(self):self.epoch=0;self.closed=False
    def interrupt(self):self.epoch+=1;return self.epoch
    def current(self,epoch):return not self.closed and epoch==self.epoch
    def close(self):self.closed=True;self.epoch+=1

class PhraseBuffer:
    def __init__(self):self.text=''
    def add(self,text,final=False):
        self.text+=text;out=[]
        while self.text:
            match=re.search(r'[。！？!?\n，,；;]' ,self.text)
            if match:end=match.end()
            elif len(self.text)>=18:
                commas=[m.end() for m in re.finditer(r'[，,；;]',self.text[:18])]
                end=commas[-1] if commas else 14
            elif final:end=len(self.text)
            else:break
            value=self.text[:end].strip();self.text=self.text[end:]
            if value:out.append(value)
        return out
