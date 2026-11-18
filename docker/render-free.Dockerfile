# Render Free tier image: no Chromium or SHAP explainers to stay within 512 MiB.
FROM python:3.12-slim-bookworm AS builder
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install pip==24.3.1 && pip install -r /tmp/requirements.txt

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/opt/venv/bin:$PATH \
    MODELS_DIR=/models \
    REPORTS_DIR=/reports \
    DATA_DIR=/tmp/phishguard-data \
    SCREENSHOT_ENABLED=false \
    EXPLANATIONS_ENABLED=false \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    HOME=/tmp \
    XDG_CACHE_HOME=/tmp/.cache
COPY --from=builder /opt/venv /opt/venv
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/*
RUN groupadd --system app && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app \
 && mkdir -p /app/data /models /reports \
 && chown -R app:app /app /models /reports
WORKDIR /app
COPY --chown=app:app backend/app ./app
COPY --chown=app:app ml/models/ /models/
COPY --chown=app:app ml/reports/ /reports/
USER app
EXPOSE 10000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers --forwarded-allow-ips '*'"]
