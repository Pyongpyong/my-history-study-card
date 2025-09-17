# syntax=docker/dockerfile:1

FROM node:20-alpine AS frontend-builder

WORKDIR /workspace

COPY frontend/package.json frontend/yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

COPY frontend ./
RUN corepack enable && yarn build

FROM python:3.11-alpine AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=on

WORKDIR /app

RUN apk add --no-cache build-base libffi-dev openssl-dev cargo

COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

FROM python:3.11-alpine AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    FRONTEND_DIST=/app/frontend \
    HOST=0.0.0.0 \
    PORT=8000

WORKDIR /app

COPY --from=builder /usr/local /usr/local
COPY app ./app
COPY --from=frontend-builder /workspace/dist ./frontend

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host ${HOST:-0.0.0.0} --port ${PORT:-8000}"]
