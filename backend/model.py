"""Loads the trained Keras emotion-recognition model, its class labels, and metadata.

This module only handles loading — no prediction logic lives here yet.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger("motiva.model")

MODELS_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODELS_DIR / "emotion_resnet_se_96x96_final.keras"
LABELS_PATH = MODELS_DIR / "emotion_labels.json"
METADATA_PATH = MODELS_DIR / "emotion_model_metadata.json"


class ModelState:
    """Holds the loaded model plus its labels/metadata, and the load status."""

    def __init__(self) -> None:
        self.model: Any | None = None
        self.labels: list[str] | None = None
        self.metadata: dict[str, Any] | None = None
        self.loaded: bool = False
        self.error: str | None = None

    def load(self) -> None:
        """Load labels, metadata, and the model. Never raises — failures are
        recorded on self.error and logged, so the API can still start and
        report an accurate health status."""
        try:
            self.labels = _load_labels()
            self.metadata = _load_metadata()
            self.model = _load_model()
            self.loaded = True
            self.error = None
            logger.info(
                "Emotion model loaded successfully (%s, labels=%s)",
                MODEL_PATH.name,
                self.labels,
            )
        except Exception as exc:  # noqa: BLE001 - capture any load failure
            self.model = None
            self.loaded = False
            self.error = f"{type(exc).__name__}: {exc}"
            logger.exception("Failed to load emotion model: %s", exc)


def _load_labels() -> list[str]:
    if not LABELS_PATH.exists():
        raise FileNotFoundError(f"Labels file not found at {LABELS_PATH}")
    with LABELS_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data["class_names"]


def _load_metadata() -> dict[str, Any]:
    if not METADATA_PATH.exists():
        raise FileNotFoundError(f"Metadata file not found at {METADATA_PATH}")
    with METADATA_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _load_model() -> Any:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")

    # Imported lazily so the module (and the rest of the API) can still be
    # imported even in an environment where tensorflow isn't installed yet.
    from tensorflow import keras

    return keras.models.load_model(MODEL_PATH)


# Single shared instance used by the FastAPI app.
model_state = ModelState()
