class DawnMicrophone extends AudioWorkletProcessor {
  constructor(){super();this.buffer=[];this.position=0;this.pcm=new Int16Array(320);this.used=0;}
  process(inputs,outputs){
    const data=inputs[0]?.[0];if(!data)return true;
    this.buffer.push(...data);
    const step=sampleRate/16000;
    while(this.position+1<this.buffer.length){const left=Math.floor(this.position),fraction=this.position-left;
      const value=this.buffer[left]*(1-fraction)+this.buffer[left+1]*fraction;
      this.pcm[this.used++]=Math.round(Math.max(-1,Math.min(1,value))*32767);this.position+=step;
      if(this.used===320){this.port.postMessage(this.pcm.buffer,[this.pcm.buffer]);this.pcm=new Int16Array(320);this.used=0;}}
    const consumed=Math.floor(this.position);this.buffer.splice(0,consumed);this.position-=consumed;
    // Silent sink keeps the worklet processing without monitoring our own mic.
    for(const channel of outputs[0]||[])channel.fill(0);
    return true;
  }
}
registerProcessor('dawn-microphone',DawnMicrophone);
