# syntax=docker/dockerfile:1.7
# Optional: run the full training pipeline in a container (docker compose --profile train run --rm trainer)
FROM python:3.12-slim-bookworm
ENV PIP_NO_CACHE_DIR=1 PYTHONUNBUFFERED=1 MPLBACKEND=Agg
# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY ml/requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt
RUN groupadd --system ml && useradd --system --gid ml --create-home ml
WORKDIR /work
USER ml
CMD ["sh", "-c", "python ml/data/download.py && python ml/prepare.py && python ml/eda.py && python ml/build_reputation.py && python ml/train.py"]
