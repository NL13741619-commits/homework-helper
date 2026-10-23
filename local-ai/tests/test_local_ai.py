import io,json,pathlib,sys,tempfile,threading,unittest,urllib.request,urllib.error,uuid,wave
import numpy as np
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from audio_engine import validate_score,midi_file,sing
from server import State,handler,ThreadingHTTPServer,private_key
class FakeModel:
    def health(self):return False
    def chat(self,*args):raise RuntimeError('NO_MODEL')
class Contract(unittest.TestCase):
    def test_score_rejects_unlicensed_and_invalid(self):
        for score in [{},{'rights':'copied','notes':[]},{'rights':'original','tempo':0,'notes':[]},{'rights':'original','tempo':100,'notes':[{'lyric':'la','midi':100}]}]:
            with self.assertRaises(ValueError):validate_score(score)
    def test_score_duration_limit(self):
        with self.assertRaises(ValueError):validate_score({'rights':'original','tempo':50,'notes':[{'lyric':'la','midi':60,'beats':4}]*32})
    def test_midi_header_and_pitch(self):
        raw=midi_file(100,[{'lyric':'la','midi':60,'beats':1}]);self.assertTrue(raw.startswith(b'MThd'));self.assertIn(bytes([0x90,60,85]),raw)
    def test_key_permissions(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=pathlib.Path(tmp)/'token';key=private_key(p);self.assertGreater(len(key),32);p.chmod(0o644)
            with self.assertRaises(RuntimeError):private_key(p)
    def test_limits_and_duplicate(self):
        s=State('token',FakeModel());a=str(uuid.uuid4());s.reserve(a)
        with self.assertRaises(ValueError):s.reserve(a)
        s.reserve(str(uuid.uuid4()))
        with self.assertRaises(ValueError):s.reserve(str(uuid.uuid4()))
    def test_http_auth_origin_model_failure(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),handler(State('t'*40,FakeModel())))
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();url=f'http://127.0.0.1:{server.server_port}'
        def req(path,auth=True,origin=None):
            heads={'Content-Type':'application/json'}
            if auth:heads['Authorization']='Bearer '+'t'*40
            if origin:heads['Origin']=origin
            r=urllib.request.Request(url+path,data=json.dumps({'request_id':str(uuid.uuid4()),'message':'hi'}).encode(),headers=heads)
            try:
                with urllib.request.urlopen(r) as response:return response.status,json.load(response)
            except urllib.error.HTTPError as error:return error.code,json.load(error)
        try:
            self.assertEqual(req('/chat',False)[0],401);self.assertEqual(req('/chat',origin='https://attacker.test')[0],403)
            self.assertEqual(req('/chat')[1]['error'],'LOCAL_ENGINE_UNAVAILABLE');self.assertEqual(req('/nope')[0],404)
        finally:server.shutdown();server.server_close()
    def test_singing_audio_has_measured_melody(self):
        import pyworld
        score={'rights':'original','tempo':100,'notes':[{'lyric':'la','midi':n,'beats':1} for n in [60,64,67,72]]}
        result=sing(score)
        with wave.open(io.BytesIO(result['vocal_wav'])) as file:
            rate=file.getframerate();x=np.frombuffer(file.readframes(file.getnframes()),dtype='<i2').astype(float)/32768
        self.assertAlmostEqual(len(x)/rate,2.4,places=2)
        f0,t=pyworld.harvest(np.ascontiguousarray(x),rate,f0_floor=80,f0_ceil=850)
        for note in result['timeline']:
            valid=f0[(t>note['start_seconds']+.1)&(t<note['end_seconds']-.1)];valid=valid[valid>0]
            self.assertGreater(len(valid),5)
            cents=abs(1200*np.log2(np.median(valid)/note['target_hz']));self.assertLess(cents,60)
    def test_cancel_before_render(self):
        with self.assertRaisesRegex(ValueError,'CANCELLED'):sing({'rights':'original','notes':[{'lyric':'la','midi':60}]},cancelled=lambda:True)
if __name__=='__main__':unittest.main()
