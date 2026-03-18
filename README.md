# Chat LLM Stateful

Aplicación de chat con IA que utiliza modelos locales a través de Ollama. Mantiene historial de conversación por sesión en PostgreSQL y expone una interfaz web con Next.js.

## Arquitectura

```
Usuario → Caddy (:80) → Next.js frontend (:3000)
                      → FastAPI backend (:8000) → Ollama (:11434)
                                                 → PostgreSQL (:5432)
```

- **Frontend**: Next.js con panel de chat y panel de administración (`/admin`)
- **Backend**: FastAPI con endpoints REST y streaming SSE
- **Base de datos**: PostgreSQL — almacena usuarios, sesiones y mensajes
- **LLM**: Ollama ejecutando el modelo configurado (por defecto `mistral`)
- **Proxy**: Caddy como reverse proxy unificado en el puerto 80

## Requisitos

- [Docker](https://www.docker.com/) y Docker Compose
- [Ollama](https://ollama.com/) instalado y corriendo en tu máquina (o via contenedor)

## Puesta en marcha

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd PID_2526_llm
```

### 2. Configurar variables de entorno

Copia y ajusta el archivo `.env` en la raíz:

```bash
cp .env .env.local
```

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PGUSER` | Usuario de PostgreSQL | `user` |
| `PGPASSWORD` | Contraseña de PostgreSQL | `password` |
| `PGDATABASE` | Nombre de la base de datos | `chatdb` |
| `MODEL` | Modelo de Ollama a usar | `mistral` |
| `CONTEXT_LIMIT` | Nº de mensajes previos enviados como contexto | `12` |
| `NEXT_PUBLIC_USER_ID` | ID del usuario activo en el frontend | `1` |
| `ADMIN_USER` | Usuario del panel de administración | `admin` |
| `ADMIN_PASS` | Contraseña del panel de administración | `changeme` |

### 3. Levantar los servicios

```bash
docker compose -f docker-compose2.yaml up -d --build
```

Esto levanta: PostgreSQL, Ollama, Backend, Frontend y Caddy.

### 4. Descargar el modelo

La primera vez es necesario descargar el modelo dentro del contenedor de Ollama:

```bash
docker compose -f docker-compose2.yaml exec ollama ollama pull mistral
```

Si quieres usar otro modelo, cámbialo en `.env` (`MODEL=llama3` por ejemplo) y descárgalo de igual forma.

### 5. Acceder a la aplicación

| Servicio | URL |
|---|---|
| Chat | http://localhost |
| Panel de administración | http://localhost/admin |
| API docs (Swagger) | http://localhost/docs |
| Adminer (BD) | http://localhost:8080 |

Las credenciales del panel de administración son las definidas en `ADMIN_USER` y `ADMIN_PASS`.

## Desarrollo local (sin Docker)

### Backend

```bash
cd backend
pip install -r requirements.txt
# Asegúrate de tener un .env con DATABASE_URL y OLLAMA_HOST correctos
uvicorn app:app --reload --port 8000
```

### Frontend

```bash
cd chat-frontend
npm install
npm run dev
```

Requiere tener Ollama y PostgreSQL corriendo localmente. El `backend/.env` usa por defecto `OLLAMA_HOST=http://127.0.0.1:11434`.

## API del backend

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del backend, BD y Ollama |
| `POST` | `/send_message` | Envía mensaje, devuelve respuesta completa |
| `POST` | `/send_message_stream` | Envía mensaje con respuesta en streaming (SSE) |
| `GET` | `/sessions/{session_id}/messages` | Historial de mensajes de una sesión |

### Ejemplo de petición

```bash
curl -X POST http://localhost/send_message \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "message": "Hola, ¿cómo estás?"}'
```

Si no se proporciona `session_id`, se crea una nueva sesión automáticamente y se devuelve en la respuesta.

## Estructura del proyecto

```
.
├── backend/
│   ├── app.py            # API FastAPI
│   ├── requirements.txt
│   └── Dockerfile
├── chat-frontend/
│   ├── app/
│   │   ├── page.tsx      # Interfaz de chat
│   │   └── admin/        # Panel de administración
│   ├── middleware.ts      # Protección Basic Auth del panel admin
│   └── Dockerfile
├── docker/
│   └── Caddyfile         # Configuración del proxy
├── schema.sql            # Esquema de la base de datos
├── seed.sql              # Datos iniciales (usuario demo)
├── docker-compose.yaml   # Compose básico (solo DB + Adminer)
├── docker-compose2.yaml  # Compose completo (todos los servicios)
└── .env                  # Variables de entorno
```

## Solución de problemas

**Error 404 en `/api/chat`**
El modelo no está descargado dentro del contenedor de Ollama. Ejecuta:
```bash
docker compose -f docker-compose2.yaml exec ollama ollama list
docker compose -f docker-compose2.yaml exec ollama ollama pull mistral
```

**El backend no conecta con la BD**
Espera a que PostgreSQL esté listo (el healthcheck puede tardar unos segundos) y comprueba que `DATABASE_URL` apunta al host correcto (`db` en Docker, `localhost` en local).

**Ver logs de un servicio**
```bash
docker compose -f docker-compose2.yaml logs -f backend
docker compose -f docker-compose2.yaml logs -f ollama
```
