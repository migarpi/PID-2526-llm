INSERT INTO users (username) VALUES ('demo') ON CONFLICT DO NOTHING;
-- Crea una sesión para 'demo'
INSERT INTO sessions (user_id) 
SELECT user_id FROM users WHERE username='demo';
-- Añade dos mensajes a la última sesión
WITH last_s AS (
  SELECT session_id FROM sessions ORDER BY session_id DESC LIMIT 1
)
INSERT INTO messages (session_id, sender, message_text)
SELECT session_id, 'User', 'Hola, ¿qué tal?' FROM last_s;
WITH last_s AS (
  SELECT session_id FROM sessions ORDER BY session_id DESC LIMIT 1
)
INSERT INTO messages (session_id, sender, message_text)
SELECT session_id, 'AI', '¡Hola! Listo para ayudarte.' FROM last_s;