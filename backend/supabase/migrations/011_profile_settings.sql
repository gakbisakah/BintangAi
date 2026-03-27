-- 011_profile_settings.sql
-- Menambahkan kolom tambahan untuk pengaturan aksesibilitas dan preferensi di tabel profiles

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
  "voice": {
    "speed": 0.9,
    "volume": 1.0,
    "auto_listen": false,
    "auto_tts": true,
    "voice_navigation": true
  },
  "ai": {
    "simplification_level": "normal",
    "suggestion_enabled": true
  },
  "ui": {
    "font_size": "normal",
    "theme": "light",
    "contrast": "normal",
    "subtitle_enabled": true,
    "keyboard_shortcut_enabled": true
  },
  "notifications": {
    "learning_reminder": true,
    "reminder_time": "08:00",
    "task_alert": true
  }
}'::jsonb,
ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb;

-- Update RLS (sudah ada di 001_profiles.sql, tapi pastikan user bisa update settings-nya sendiri)
-- Kebijakan update sudah ada: "User dapat mengupdate profilnya sendiri"
