import base64,io,json,pathlib,sys,unittest
import numpy as np
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from audio_engine import wav_bytes
from melody import analyze,decode_wav,align_lyrics,rhyme_report
from song_search import search

class MelodyTests(unittest.TestCase):
    def test_measured_pitch_and_tempo(self):
        rate=22050;parts=[];expected=[60,62,64,65,67,69,71,72]
        for note in expected:
            t=np.arange(round(rate*.5))/rate;hz=440*2**((note-69)/12)
            envelope=np.minimum(1,t/.02)*np.minimum(1,np.maximum(0,.43-t)/.02)
            parts.append(.5*np.sin(2*np.pi*hz*t)*envelope)
        result=analyze(base64.b64encode(wav_bytes(np.concatenate(parts))).decode())
        recovered=[n['midi'] for n in result['notes']]
        self.assertEqual(recovered,expected)
        self.assertLess(abs(result['rhythm']['tempo_bpm']-120),3)
        self.assertEqual(result['polyphonic_transcription'],False)
    def test_no_fake_pitch_from_silence(self):
        with self.assertRaisesRegex(ValueError,'AUDIO_TOO_QUIET'):decode_wav(base64.b64encode(wav_bytes(np.zeros(22050))).decode())
    def test_mixed_song_is_not_claimed_as_monophonic(self):
        with self.assertRaisesRegex(ValueError,'SOURCE_SEPARATION'):analyze('not-used','full_mix')
    def test_invalid_wav(self):
        for value in ['!',base64.b64encode(b'bad').decode()]:
            with self.assertRaises(ValueError):decode_wav(value)
    def test_alignment_covers_every_note_and_handles_melisma(self):
        notes=[{'midi':60+i,'start_seconds':i*.5,'end_seconds':(i+1)*.5,'duration_seconds':.5} for i in range(4)]
        report=align_lyrics(notes,'曙光')
        self.assertEqual([v['syllable'] for v in report['items']],['曙','光'])
        self.assertEqual([i for v in report['items'] for i in v['note_indexes']],list(range(4)))
        self.assertFalse(report['forced_alignment_to_recording'])
        self.assertFalse(report['current_english_voice_can_render'])
        with self.assertRaises(ValueError):align_lyrics(notes,'曙光陪著你唱')
    def test_rhyme_is_pronunciation_not_same_character(self):
        r=rhyme_report('曙光照在我的心\n歌聲陪你到如今\n一起迎接太陽')
        self.assertEqual(r['scheme'],'A A B')
        self.assertEqual(r['lines'][0]['pinyin_final'],'in')
        self.assertNotEqual(r['lines'][0]['last_character'],r['lines'][1]['last_character'])
    def test_catalogue_metadata_is_not_audio_analysis(self):
        payload={'query':{'pages':[{'title':'File:Example.wav','imageinfo':[{'descriptionurl':'https://commons.wikimedia.org/wiki/File:Example.wav','extmetadata':{'LicenseShortName':{'value':'<b>CC0</b>'}}}]}]}}
        class Reply(io.BytesIO):pass
        def opener(req,timeout):
            self.assertTrue(req.full_url.startswith('https://commons.wikimedia.org/w/api.php?'));return Reply(json.dumps(payload).encode())
        result=search('example',opener)
        self.assertFalse(result['results'][0]['analysis_performed']);self.assertFalse(result['results'][0]['audio_downloaded']);self.assertEqual(result['results'][0]['license_label'],'CC0')
if __name__=='__main__':unittest.main()
