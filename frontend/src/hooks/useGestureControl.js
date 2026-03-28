import { useEffect, useRef, useCallback, useState } from 'react';
import { useAccessibilityStore } from '../store/accessibilityStore';

// Gesture mapping
export const GESTURE_MAP = {
  thumbs_up: { label: '👍', action: 'confirm', text: 'OK' },
  thumbs_down: { label: '👎', action: 'back', text: 'Kembali' },
  peace: { label: '✌️', action: 'next', text: 'Lanjut' },
  open_hand: { label: '✋', action: 'stop', text: 'Stop' },
  point_up: { label: '☝️', action: 'ask_ai', text: 'Tanya AI' },
  fist: { label: '✊', action: 'home', text: 'Beranda' },
  ok: { label: '👌', action: 'confirm', text: 'OK' },
  three_fingers: { label: '🤘', action: 'answer_c', text: 'Jawaban C' },
  four_fingers: { label: '🖖', action: 'answer_d', text: 'Jawaban D' }
};

// Hand skeletal connections
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17] // pinky & palm
];

const detectFingers = (landmarks) => {
  if (!landmarks || landmarks.length < 21) return null;
  const isFingerUp = (tip, pip) => tip.y < pip.y;

  // Thumb detection (x-axis based for left/right hand)
  const thumb = landmarks[4].x < landmarks[3].x;

  return {
    thumb,
    index: isFingerUp(landmarks[8], landmarks[6]),
    middle: isFingerUp(landmarks[12], landmarks[10]),
    ring: isFingerUp(landmarks[16], landmarks[14]),
    pinky: isFingerUp(landmarks[20], landmarks[18])
  };
};

const detectGesture = (fingers) => {
  if (!fingers) return null;
  const { thumb, index, middle, ring, pinky } = fingers;

  if (thumb && !index && !middle && !ring && !pinky) return 'thumbs_up';
  if (!thumb && !index && !middle && !ring && !pinky) return 'fist';
  if (index && middle && !ring && !pinky && !thumb) return 'peace';
  if (thumb && index && middle && ring && pinky) return 'open_hand';
  if (index && !middle && !ring && !pinky && !thumb) return 'point_up';
  if (thumb && index && !middle && !ring && !pinky) return 'ok';
  if (index && middle && ring && !pinky && !thumb) return 'three_fingers';
  if (index && middle && ring && pinky && !thumb) return 'four_fingers';

  return null;
};

export function useGestureControl({ onGesture, enabled } = {}) {
  const { mode, isGestureActive: storeGestureActive } = useAccessibilityStore();
  const isMute = mode === 'tunawicara';
  const isActiveMode = enabled !== undefined ? enabled : (isMute || storeGestureActive);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastGestureTimeRef = useRef(0);
  const gestureTimeoutRef = useRef(null);

  const [isActive, setIsActive] = useState(false);
  const [lastGesture, setLastGesture] = useState(null);
  const [gestureLabel, setGestureLabel] = useState('');
  const [handDetected, setHandDetected] = useState(false);

  const drawSkeletalHand = useCallback((ctx, landmarks, width, height) => {
    if (!ctx || !landmarks) return;

    // Clear with semi-transparent for slight trail effect or full clear for accuracy
    ctx.clearRect(0, 0, width, height);

    // Draw Connections
    ctx.strokeStyle = '#00FF00'; // Neon Green
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00FF00';

    HAND_CONNECTIONS.forEach(([start, end]) => {
      const p1 = landmarks[start];
      const p2 = landmarks[end];
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    });

    // Draw Landmarks
    ctx.shadowBlur = 0;
    landmarks.forEach((lm, i) => {
      const isTip = [4, 8, 12, 16, 20].includes(i);
      ctx.fillStyle = isTip ? '#FF0000' : '#FFFFFF';
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, isTip ? 6 : 4, 0, 2 * Math.PI);
      ctx.fill();

      // Outer ring for tips
      if (isTip) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }, []);

  const initHands = useCallback(() => {
    if (handsRef.current || !window.Hands) return;

    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7, // Increased for stability
      minTrackingConfidence: 0.7
    });

    hands.onResults((results) => {
      const hasHand = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
      setHandDetected(hasHand);

      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (canvas && video && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        if (hasHand) {
          const landmarks = results.multiHandLandmarks[0];
          drawSkeletalHand(ctx, landmarks, width, height);

          const fingers = detectFingers(landmarks);
          const gesture = detectGesture(fingers);

          if (gesture) {
            const now = Date.now();
            if (now - lastGestureTimeRef.current >= 1200) { // Increased delay to prevent flickering
              lastGestureTimeRef.current = now;
              setLastGesture(gesture);
              const info = GESTURE_MAP[gesture];
              setGestureLabel(info?.label || '');

              if (onGesture && info) {
                onGesture(gesture, info.action, info.text);
              }

              if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
              gestureTimeoutRef.current = setTimeout(() => {
                setLastGesture(null);
                setGestureLabel('');
              }, 2000);
            }
          }
        } else {
          ctx.clearRect(0, 0, width, height);
        }
      }
    });

    handsRef.current = hands;
  }, [onGesture, drawSkeletalHand]);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return; // Already running

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(console.error);
          setIsActive(true);
        };
      }

      if (!window.Hands) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
        script.async = true;
        script.onload = () => initHands();
        document.head.appendChild(script);
      } else {
        initHands();
      }
    } catch (err) {
      console.error('Camera Error:', err);
      setIsActive(false);
    }
  }, [initHands]);

  const stopCamera = useCallback(() => {
    setIsActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setHandDetected(false);
  }, []);

  // Frame processing loop - separated from camera start to avoid flickering
  useEffect(() => {
    let isMounted = true;

    const processFrame = async () => {
      if (!isMounted) return;

      if (handsRef.current && videoRef.current && isActive) {
        const video = videoRef.current;
        if (video.readyState >= 2) {
          try {
            await handsRef.current.send({ image: video });
          } catch (e) {
            // Silently handle send errors to prevent loop breaking
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    if (isActive) {
      animFrameRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive]);

  useEffect(() => {
    if (isActiveMode) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
    };
  }, [isActiveMode, startCamera, stopCamera]);

  return {
    videoRef, canvasRef, isActive, lastGesture, gestureLabel, handDetected,
    startCamera, stopCamera, GESTURE_MAP
  };
}
