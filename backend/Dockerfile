# --- build base ---
FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN pip install --no-cache-dir --upgrade pip

# --- dependencies layer ---
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- runtime ---
COPY backend/ ./
# Uvicorn en 0.0.0.0 para que acepte tráfico del proxy
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]