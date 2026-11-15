# syntax=docker/dockerfile:1.7
# ---------- stage 1: build a self-contained virtualenv ----------
FROM python:3.12-slim-bookworm AS builder
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install pip==24.3.1 && pip install -r /tmp/requirements.txt

# ---------- stage 2: slim runtime with headless Chromium ----------
FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/opt/venv/bin:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    MODELS_DIR=/models \
    REPORTS_DIR=/reports \
    DATA_DIR=/app/data \
    HOME=/tmp \
    XDG_CACHE_HOME=/tmp/.cache \
    NUMBA_CACHE_DIR=/tmp/numba \
    MPLCONFIGDIR=/tmp/mpl
COPY --from=builder /opt/venv /opt/venv
# libgomp1: OpenMP runtime for LightGBM. Playwright installs Chromium's system deps itself.
# Debian package versions are not pinned on purpose: security updates come from the base image tag.
# hadolint ignore=DL3008
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 \
 && playwright install --with-deps --only-shell chromium \
 && rm -rf /var/lib/apt/lists/* /root/.cache
RUN groupadd --system app && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app \
 && mkdir -p /app/data/screenshots /models /reports \
 && chown -R app:app /app /ms-playwright
WORKDIR /app
COPY --chown=app:app backend/app ./app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
