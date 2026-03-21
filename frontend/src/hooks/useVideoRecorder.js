"use client";
import { useState, useRef, useCallback } from "react";

const MIME_TYPE = "video/webm;codecs=vp9,opus";

export function useVideoRecorder() {
  const [state, setState] = useState("idle"); // idle | requesting | ready | recording | stopped | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [duration, setDuration] = useState(0);

  const streamRef    = useRef(null);
  const recorderRef  = useRef(null);
  const chunksRef    = useRef([]);
  const timerRef     = useRef(null);
  const previewRef   = useRef(null); // attach to <video> for live preview

  const startCamera = useCallback(async () => {
    setState("requesting");
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        previewRef.current.muted = true;
      }
      setState("ready");
    } catch (err) {
      setErrorMsg(err.name === "NotAllowedError" ? "Camera permission denied." : "Camera not available.");
      setState("error");
    }
  }, []);

  const startRecording = useCallback((maxSeconds = 120) => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordedBlob(null);
    setDuration(0);

    const recorder = new MediaRecorder(streamRef.current, { mimeType: MIME_TYPE });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: MIME_TYPE });
      setRecordedBlob(blob);
      clearInterval(timerRef.current);
    };

    recorder.start(250); // collect chunks every 250ms
    setState("recording");

    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 1;
      setDuration(elapsed);
      if (elapsed >= maxSeconds) stopRecording();
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setState("stopped");
  }, []);

  const reset = useCallback(() => {
    stopRecording();
    setRecordedBlob(null);
    setDuration(0);
    setState("ready");
  }, [stopRecording]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState("idle");
  }, []);

  return { state, errorMsg, recordedBlob, duration, previewRef, startCamera, startRecording, stopRecording, reset, stopCamera };
}
