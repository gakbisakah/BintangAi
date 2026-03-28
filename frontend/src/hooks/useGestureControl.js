import { useEffect, useRef, useCallback, useState } from 'react';
import { useAccessibilityStore } from '../store/accessibilityStore';

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
];

const detectFingers = (landmarks) => {
  if (!landmarks) return 0;
  let count = 0;

  // Deteksi Jari (Telunjuk, Tengah, Manis, Kelingking) - Sangat Akurat (Sumbu Y)
  const tips = [8, 12, 16, 20];
  const joints = [6, 10, 14, 18];
  tips.forEach((tip, i) => {
    if (landmarks[tip].y < landmarks[joints[i]].y) count++;
  });

  // Deteksi Ibu Jari (Jempol) - Menggunakan Jarak Euclidean ke Pangkal Kelingking
  // Ini jauh lebih akurat daripada hanya sumbu X atau Y
  const thumbTip = landmarks[4];
  const thumbMCP = landmarks[2];
  const pinkyBase = landmarks[17];

  const distTip = Math.sqrt(Math.pow(thumbTip.x - pinkyBase.x, 2) + Math.pow(thumbTip.y - pinkyBase.y, 2));
  const distBase = Math.sqrt(Math.pow(thumbMCP.x - pinkyBase.x, 2) + Math.pow(thumbMCP.y - pinkyBase.y, 2));

  // Jempol dianggap terbuka jika ujung jempol jauh dari telapak tangan
  if (distTip > distBase * 1.15) count++;

  return count;
};

export function useGestureControl({ onGesture, onScroll, enabled } = {}) {
  const { mode, isGestureActive } = useAccessibilityStore();
  const isActiveMode = enabled !== undefined ? enabled : (mode === 'tunawicara' || isGestureActive);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const streamRef = useRef(null);
  const lastYRef = useRef(null);
  const onGestureRef = useRef(onGesture);
  const onScrollRef = useRef(onScroll);

  const [isActive, setIsActive] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [totalFingers, setTotalFingers] = useState(0);

  useEffect(() => { onGestureRef.current = onGesture; }, [onGesture]);
  useEffect(() => { onScrollRef.current = onScroll; }, [onScroll]);

  const initHands = useCallback(() => {
    if (handsRef.current || !window.Hands) return;
    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.8, // Menaikkan akurasi deteksi
      minTrackingConfidence: 0.8
    });

    let countBuffer = [];
    let lastFinalCount = 0;

    hands.onResults((results) => {
      const hasHand = results.multiHandLandmarks?.length > 0;
      setHandDetected(hasHand);

      if (canvasRef.current && videoRef.current?.readyState >= 2) {
        const ctx = canvasRef.current.getContext('2d');
        const { clientWidth: w, clientHeight: h } = canvasRef.current;
        if (canvasRef.current.width !== w || canvasRef.current.height !== h) {
          canvasRef.current.width = w; canvasRef.current.height = h;
        }
        ctx.clearRect(0, 0, w, h);

        let currentFrameCount = 0;
        if (hasHand) {
          results.multiHandLandmarks.forEach((lm) => {
            currentFrameCount += detectFingers(lm);
            // Render Skeletal Hand (Indigo Neon)
            ctx.strokeStyle = '#6366F1'; ctx.lineWidth = 4; ctx.lineCap = 'round';
            HAND_CONNECTIONS.forEach(([s, e]) => {
              ctx.beginPath(); ctx.moveTo(lm[s].x * w, lm[s].y * h); ctx.lineTo(lm[e].x * w, lm[e].y * h); ctx.stroke();
            });
            lm.forEach(p => { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 3, 0, 2 * Math.PI); ctx.fill(); });
          });

          // Logic Scroll
          const y = results.multiHandLandmarks[0][9].y;
          if (lastYRef.current !== null && onScrollRef.current) {
            const dy = y - lastYRef.current;
            if (Math.abs(dy) > 0.05) onScrollRef.current(dy > 0 ? 'down' : 'up');
          }
          lastYRef.current = y;
        } else {
          lastYRef.current = null;
        }

        // --- SISTEM BUFFER STABILITAS (Anti-Flicker) ---
        // Simpan 10 frame terakhir
        countBuffer.push(currentFrameCount);
        if (countBuffer.length > 10) countBuffer.shift();

        // Cari angka yang paling sering muncul (Mode)
        const counts = {};
        countBuffer.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
        let modeCount = 0;
        let maxFreq = 0;
        for (const val in counts) {
          if (counts[val] > maxFreq) { maxFreq = counts[val]; modeCount = parseInt(val); }
        }

        // Hanya update jika angka tersebut muncul di > 70% frame terakhir
        if (maxFreq >= 7 && modeCount !== lastFinalCount) {
          lastFinalCount = modeCount;
          setTotalFingers(modeCount);
          if (onGestureRef.current) onGestureRef.current(modeCount);
        }
      }
    });
    handsRef.current = hands;
  }, []);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: { ideal: 30 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => { videoRef.current.play(); setIsActive(true); };
      }
      if (!window.Hands) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
        s.async = true; s.onload = initHands; document.head.appendChild(s);
      } else initHands();
    } catch (e) { console.error(e); }
  }, [initHands]);

  useEffect(() => {
    if (isActiveMode) startCamera();
    else {
      setIsActive(false);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [isActiveMode, startCamera]);

  useEffect(() => {
    let m = true;
    const loop = async () => {
      if (m && handsRef.current && videoRef.current?.readyState >= 2 && isActive) {
        try { await handsRef.current.send({ image: videoRef.current }); } catch(e){}
      }
      requestAnimationFrame(loop);
    };
    loop();
    return () => { m = false; };
  }, [isActive]);

  return { videoRef, canvasRef, isActive, handDetected, totalFingers };
}
