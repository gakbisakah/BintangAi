import React, { useState } from 'react'
import styles from './VoiceButton.module.css'

export default function VoiceButton({ onStart, onStop, isListening }) {
  const [status, setStatus] = useState('idle') // idle, listening, processing

  const handleClick = () => {
    if (status === 'idle') {
      setStatus('listening')
      onStart?.()
    } else {
      setStatus('processing')
      onStop?.()
      setTimeout(() => setStatus('idle'), 1000)
    }
  }

  return (
    <div className={styles.container}>
      <button
        className={`${styles.button} ${styles[status]}`}
        onClick={handleClick}
        aria-label="Aktifkan perintah suara"
      >
        <span className={styles.mic}>🎤</span>
      </button>
      <span className={styles.label}>
        {status === 'idle' && 'Tekan untuk bicara'}
        {status === 'listening' && 'Mendengarkan...'}
        {status === 'processing' && 'Memproses...'}
      </span>
    </div>
  )
}