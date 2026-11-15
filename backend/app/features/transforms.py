"""Picklable numeric transforms used inside saved sklearn pipelines.

They live in the shared package so that a model trained in ``ml/`` can be
unpickled by the backend without importing training code.
"""

from __future__ import annotations

import numpy as np


def signed_log1p(x):
    """sign(x) * log(1 + |x|) - tames heavy-tailed counts, safe for negatives."""
    x = np.asarray(x, dtype=float)
    return np.sign(x) * np.log1p(np.abs(x))
