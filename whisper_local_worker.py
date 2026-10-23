"""Whisper base multilingual CPU worker.

Isolated process, no server traffic, no writing audio to disk, no external API.
Reads input bytes from stdin; prints only one JSON result to stdout.
"""
import json,os,subprocess,sys
os.environ.setdefault("OMP_NUM_THREADS","2")
os.environ.setdefault("MKL_NUM_THREADS","2")
os.environ.setdefault("OPENBLAS_NUM_THREADS","2")

from pathlib import Path
MODEL=Path(__file__).resolve().parent/"models"/"whisper"/"base.pt"
MAX_BYTES=7*1024*1024
MAX_DURATION_SECONDS=90
RATE=16000

def main():
 if not MODEL.is_file():
  raise RuntimeError("Whisper base model is not installed.")
 blob=sys.stdin.buffer.read(MAX_BYTES+1)
 if not blob or len(blob)>MAX_BYTES:
  raise ValueError("Audio exceeds the 7 MB limit.")
 audio=subprocess.run(
  ["/usr/bin/ffmpeg","-nostdin","-hide_banner","-loglevel","error",
    "-threads","1","-i","pipe:0","-vn","-ac","1","-ar",str(RATE),
    "-t",str(MAX_DURATION_SECONDS+1),"-f","f32le","pipe:1"],
  input=blob,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=16,check=False)
 if audio.returncode!=0 or not audio.stdout:
  raise ValueError("Audio could not be decoded.")
 seconds=len(audio.stdout)/4/RATE
 if seconds>MAX_DURATION_SECONDS or seconds<0.35:
  raise ValueError("Audio must last between 0.35 and 90 seconds.")
 import numpy as np
 import torch
 import whisper
 torch.set_num_threads(2)
 model=whisper.load_model(str(MODEL),device="cpu")
 waveform=np.frombuffer(audio.stdout,dtype=np.float32)
 if float(np.sqrt(np.mean(np.square(waveform.astype(np.float64)))))<0.003:
  raise ValueError("Audio silence: no meaningful speech")
 transcript=model.transcribe(waveform,language="pt",task="transcribe",
   fp16=False,verbose=None,temperature=0,best_of=1,beam_size=1,
   initial_prompt="Transcricao de despesas em portugues brasileiro: reais, supermercado, farmacia, gasolina, combustivel, oficina, corridas de Uber e 99.",
   condition_on_previous_text=False)
 text=str(transcript.get("text") or "").strip()
 if not text:
  raise ValueError("No understandable speech found.")
 print(json.dumps({"text":text[:1500],"engine":"whisper-base-local",
    "duration_seconds":round(seconds,2)},ensure_ascii=False),flush=True)

if __name__=="__main__":
 try:main()
 except Exception as error:
  print(json.dumps({"error":type(error).__name__}),flush=True)
  sys.exit(2)
