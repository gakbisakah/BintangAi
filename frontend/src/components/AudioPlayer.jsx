import React, { useRef } from 'react'

export default function AudioPlayer({ src }) {
  const audioRef = useRef(null)

  const play = () => {
    audioRef.current?.play()
  }

  return (
    <div className="flex items-center gap-2">
      <audio ref={audioRef} src={src} />
      <button onClick={play} className="bg-primary text-white px-3 py-1 rounded">
        🔈 Dengarkan
      </button>
    </div>
  )
}