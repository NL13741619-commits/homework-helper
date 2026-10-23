import asyncio,json,pathlib,sys,time,unittest
import numpy as np
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from voice.protocol import VAD,TurnGate,PhraseBuffer
from voice.server import make_app
from aiohttp import web,ClientSession,WSMsgType

quiet=np.zeros(320,dtype='<i2').tobytes()
loud=(np.sin(np.arange(320)*.1)*.1*32767).astype('<i2').tobytes()
class Protocol(unittest.TestCase):
    def test_silence_never_becomes_a_turn(self):
        vad=VAD();self.assertTrue(all(vad.feed(quiet) is None for _ in range(100)))
    def test_short_spike_does_not_start_a_turn(self):
        vad=VAD();self.assertIsNone(vad.feed(loud));self.assertIsNone(vad.feed(quiet))
    def test_automatic_end_after_pause(self):
        vad=VAD();events=[vad.feed(loud) for _ in range(20)]+[vad.feed(quiet) for _ in range(26)]
        self.assertEqual([e['type'] for e in events if e],['speech_start','utterance'])
    def test_barge_in_detected_during_playback(self):
        vad=VAD();events=[vad.feed(loud,playing=True) for _ in range(5)];self.assertTrue(any(e and e['type']=='speech_start' for e in events))
    def test_incorrect_pcm_rejected(self):
        with self.assertRaises(ValueError):VAD().feed(b'bad')
    def test_old_audio_invalidated_by_interrupt(self):
        gate=TurnGate();old=gate.epoch;new=gate.interrupt();self.assertFalse(gate.current(old));self.assertTrue(gate.current(new));gate.close();self.assertFalse(gate.current(new))
    def test_phrases_stream_before_full_reply(self):
        b=PhraseBuffer();self.assertEqual(b.add('今天很累嗎？先休息'),'今天很累嗎？'.split('|'));self.assertEqual(b.add('一下。'),['先休息一下。'])
    def test_conversational_clause_emits_at_comma(self):
        b=PhraseBuffer();self.assertEqual(b.add('先休息一下，還想聊什麼？'),['先休息一下，','還想聊什麼？'])
    def test_final_short_phrase_flushed(self):
        b=PhraseBuffer();self.assertEqual(b.add('我在聽'),[]);self.assertEqual(b.add('',True),['我在聽'])
    def test_ui_does_not_use_speech_synthesis_or_subtitle_reader(self):
        src=(pathlib.Path(__file__).parent/'client.js').read_text();self.assertNotIn('speechSynthesis',src);self.assertNotIn('SpeechRecognition',src);self.assertIn("getUserMedia",src);self.assertIn('AudioWorkletNode',src)

class MockEngine:
    def transcribe(self,pcm):return '我今天很累'
    def respond(self,text,history,emit,stale):
        # Simulates a native inference that cannot stop immediately. Gate must
        # drop its output after interruption even if this worker keeps running.
        time.sleep(.08)
        if not stale():emit({'type':'audio','text':'先休息一下。','samples':np.ones(2400,dtype=np.float32)*.01,'sample_rate':24000})
        return {'text':'先休息一下。'}

class SocketTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.runner=web.AppRunner(make_app(MockEngine(),'v'*40));await self.runner.setup();site=web.TCPSite(self.runner,'127.0.0.1',0);await site.start();self.port=site._server.sockets[0].getsockname()[1];self.url=f'http://127.0.0.1:{self.port}';self.client=ClientSession()
    async def asyncTearDown(self):await self.client.close();await self.runner.cleanup()
    async def test_origin_denied(self):
        r=await self.client.get(self.url+'/health',headers={'Origin':'https://attacker.test'});self.assertEqual(r.status,403)
    async def test_first_message_auth(self):
        ws=await self.client.ws_connect(self.url+'/voice');await ws.send_json({'token':'wrong'});m=await ws.receive();self.assertEqual(m.type,WSMsgType.CLOSE)
    async def test_audio_round_trip_has_voice_not_dom(self):
        ws=await self.client.ws_connect(self.url+'/voice');await ws.send_json({'token':'v'*40});self.assertEqual((await ws.receive_json())['type'],'ready')
        for frame in [loud]*20+[quiet]*26:await ws.send_bytes(frame)
        events=[]
        for _ in range(12):
            m=await asyncio.wait_for(ws.receive_json(),2);events.append(m)
            if m['type']=='generation_done':break
        self.assertTrue(any(m['type']=='audio' and m['pcm'] for m in events));self.assertTrue(any(m['type']=='input_transcript' for m in events));await ws.close()
    async def test_interrupt_discards_old_generation(self):
        ws=await self.client.ws_connect(self.url+'/voice');await ws.send_json({'token':'v'*40});await ws.receive_json()
        for frame in [loud]*20+[quiet]*26:await ws.send_bytes(frame)
        while True:
            m=await ws.receive_json()
            if m.get('state')=='thinking':break
        await ws.send_json({'type':'interrupt'})
        while True:
            m=await ws.receive_json()
            if m['type']=='interrupt':new_epoch=m['epoch'];break
        try:
            m=await asyncio.wait_for(ws.receive_json(),.2);self.assertFalse(m['type']=='audio' and m['epoch']<new_epoch)
        except asyncio.TimeoutError:pass
        await ws.close()
if __name__=='__main__':unittest.main()
