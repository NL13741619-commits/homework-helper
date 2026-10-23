"""Bounded local duplex audio WebSocket, first-message auth and epoch cancellation."""
import asyncio,base64,hmac,json,pathlib,time
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from aiohttp import web,WSMsgType
from .protocol import VAD,TurnGate
ROOT=pathlib.Path(__file__).resolve().parent

def make_app(engine,token):
    sessions=set();worker=ThreadPoolExecutor(max_workers=1,thread_name_prefix='dawn-voice')
    @web.middleware
    async def origin_guard(request,handler):
        host=request.host
        if host.split(':')[0] not in ['127.0.0.1','localhost']:return web.json_response({'error':'LOCAL_HOST_ONLY'},status=403)
        origin=request.headers.get('Origin')
        if origin and origin!='http://'+host:return web.json_response({'error':'ORIGIN_DENIED'},status=403)
        response=await handler(request)
        response.headers['Cache-Control']='no-store';response.headers['X-Content-Type-Options']='nosniff'
        response.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; worker-src 'self'; frame-ancestors 'none'"
        return response
    app=web.Application(middlewares=[origin_guard],client_max_size=2048)
    async def asset(request):
        names={'/':'index.html','/client.js':'client.js','/mic-worklet.js':'mic-worklet.js','/style.css':'style.css'}
        path=names.get(request.path)
        if not path:raise web.HTTPNotFound()
        return web.FileResponse(ROOT/path)
    async def health(request):
        return web.json_response({'voice_engine':'local-whisper-base+qwen3+kokoro-zh','audio_input':True,'audio_output':True,'asr_language':'zh','caption_readback':False,'transport':'PCM16 WebSocket','native_speech_foundation_model':False,'microphone_e2e_verified':False})
    async def socket(request):
        if len(sessions)>=2:return web.json_response({'error':'VOICE_SESSIONS_FULL'},status=429)
        ws=web.WebSocketResponse(max_msg_size=2048,heartbeat=20);await ws.prepare(request)
        try:
            first=await ws.receive(timeout=5)
            auth=json.loads(first.data) if first.type==WSMsgType.TEXT else {}
            if not hmac.compare_digest(str(auth.get('token','')),token):
                await ws.close(code=1008,message=b'UNAUTHORIZED');return ws
        except Exception:
            await ws.close(code=1008,message=b'AUTH_REQUIRED');return ws
        if len(sessions)>=2:
            await ws.close(code=1013,message=b'VOICE_SESSIONS_FULL');return ws
        sessions.add(ws);loop=asyncio.get_running_loop();gate=TurnGate();vad=VAD();history=[];pending=None;playing=False
        outgoing=asyncio.Queue(maxsize=32);turns=[];window_start=time.monotonic();window_bytes=0;began=time.monotonic()
        async def send(event):
            if not ws.closed:await ws.send_json(event)
        async def flush_output():
            while True:
                event=await outgoing.get()
                if gate.current(event.pop('_epoch')):await send(event)
        sender=asyncio.create_task(flush_output())
        async def expire():
            await asyncio.sleep(600)
            await ws.close(code=1000,message=b'VOICE_SESSION_LIMIT')
        expiry=asyncio.create_task(expire())
        def emit(epoch,event):
            if not gate.current(epoch):return
            if event['type']=='audio':
                pcm=(np.clip(event['samples'],-1,1)*32767).astype('<i2').tobytes()
                event={k:v for k,v in event.items() if k!='samples'};event.update(pcm=base64.b64encode(pcm).decode())
            event.update(epoch=epoch,_epoch=epoch)
            def put():
                if not gate.current(epoch):return
                try:outgoing.put_nowait(event)
                except asyncio.QueueFull:gate.close();asyncio.create_task(ws.close(code=1013,message=b'OUTPUT_BACKPRESSURE'))
            loop.call_soon_threadsafe(put)
        async def process(pcm,epoch):
            started=time.monotonic()
            try:
                await send({'type':'state','state':'recognizing','epoch':epoch})
                text=await loop.run_in_executor(worker,engine.transcribe,pcm)
                if not gate.current(epoch):return
                if not text:
                    await send({'type':'state','state':'listening','epoch':epoch});return
                await send({'type':'input_transcript','text':text,'epoch':epoch})
                await send({'type':'state','state':'thinking','epoch':epoch})
                result=await loop.run_in_executor(worker,engine.respond,text,history.copy(),lambda event:emit(epoch,event),lambda:not gate.current(epoch))
                if gate.current(epoch):
                    history.extend([{'role':'user','content':text},{'role':'assistant','content':result['text']}]);del history[:-8]
                    # Queued after audio so completion never overtakes its chunks.
                    emit(epoch,{'type':'generation_done','processing_seconds':round(time.monotonic()-started,3),'text':result['text']})
            except asyncio.CancelledError:pass
            except Exception:
                if gate.current(epoch):emit(epoch,{'type':'error','code':'LOCAL_VOICE_ENGINE_FAILED'})
        async def interrupt():
            nonlocal pending
            epoch=gate.interrupt()
            if pending and not pending.done():pending.cancel()
            await send({'type':'interrupt','epoch':epoch})
            return epoch
        try:
            await send({'type':'ready','epoch':gate.epoch,'sample_rate':16000,'frame_samples':320})
            async for message in ws:
                now=time.monotonic()
                if now-began>600:break
                if now-window_start>1:window_start=now;window_bytes=0
                if message.type==WSMsgType.BINARY:
                    window_bytes+=len(message.data)
                    if len(message.data)!=640 or window_bytes>96000:
                        await ws.close(code=1008,message=b'AUDIO_RATE_OR_FORMAT');break
                    event=vad.feed(message.data,playing)
                    if not event:continue
                    if event['type']=='speech_start':await interrupt();await send({'type':'state','state':'listening','epoch':gate.epoch})
                    elif event['type']=='utterance':
                        turns=[t for t in turns if now-t<60]
                        if len(turns)>=12:await send({'type':'error','code':'VOICE_TURN_LIMIT'});continue
                        turns.append(now);pending=asyncio.create_task(process(event['pcm'],gate.epoch))
                elif message.type==WSMsgType.TEXT:
                    data=json.loads(message.data)
                    if data.get('type')=='interrupt':await interrupt()
                    elif data.get('type')=='playback':playing=data.get('active') is True
                    elif data.get('type')=='stop':break
                    else:await send({'type':'error','code':'UNKNOWN_CONTROL'})
                elif message.type in [WSMsgType.ERROR,WSMsgType.CLOSE]:break
        except (ValueError,json.JSONDecodeError):await send({'type':'error','code':'INVALID_AUDIO_MESSAGE'})
        finally:
            gate.close()
            if pending:pending.cancel()
            sender.cancel();expiry.cancel();sessions.discard(ws);await ws.close()
        return ws
    app.router.add_get('/health',health);app.router.add_get('/voice',socket)
    for route in ['/','/client.js','/mic-worklet.js','/style.css']:app.router.add_get(route,asset)
    async def cleanup(app):
        for ws in list(sessions):await ws.close(code=1001,message=b'SERVER_SHUTDOWN')
        worker.shutdown(wait=False,cancel_futures=True)
    app.on_cleanup.append(cleanup)
    return app
