"""Preprocesses an uploaded face image and runs it through the loaded
emotion-recognition model.

The preprocessing and prediction steps here intentionally mirror the
training notebook's `load_image` / `predict_emotion` functions and the
values recorded in emotion_model_metadata.json:

- decode as grayscale (channels = metadata["input_channels"])
- resize to metadata["image_size"] with antialiasing (tf.image.resize(...,
  antialias=True), same as training/eval)
- cast to float32 and leave pixel values in [0, 255] (metadata
  ["input_pixel_range"]) — the model's own Rescaling(1/255) layer (the
  first layer after the input, confirmed in the saved model's config)
  performs the 0-1 normalization, so this code does not divide by 255
  itself
- average the prediction for the image with the prediction for its
  horizontally-flipped version, weighted by metadata["tta_flip_weight"]
  (test-time augmentation), exactly as the notebook's predict_emotion()
  does

No preprocessing constant here is invented; everything comes from
emotion_model_metadata.json (loaded via model_state.metadata) or is a
direct match of the notebook.
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import tensorflow as tf

from model import model_state

logger = logging.getLogger("motiva.predict")

# --- Temporary diagnostic instrumentation -----------------------------------
# Requested while tracking down the "always predicts fear" bug: logs the
# input tensor shape/min/max and all 7 raw probabilities for every request,
# and saves the most recent crop to disk for visual inspection. Safe to flip
# off (or delete this block) once the pipeline is confirmed correct.
DEBUG_PREDICT = True
DEBUG_DIR = Path(__file__).resolve().parent / "debug_output"
# ------------------------------------------------------------------------


class PredictionError(Exception):
    """Raised for problems that should be reported back to the API caller."""


def _decode_and_resize(image_bytes: bytes) -> tf.Tensor:
    metadata = model_state.metadata
    image_size = tuple(metadata["image_size"])
    channels = metadata["input_channels"]

    try:
        image = tf.io.decode_image(image_bytes, channels=channels, expand_animations=False)
    except Exception as exc:  # noqa: BLE001 - any decode failure is "invalid image"
        raise PredictionError(f"Could not decode image: {exc}") from exc

    image.set_shape([None, None, channels])
    image = tf.image.resize(image, image_size, antialias=True)
    return tf.cast(image, tf.float32)


def predict_emotion(image_bytes: bytes) -> dict:
    """Run one uploaded image through the model and return class probabilities."""
    if not model_state.loaded or model_state.model is None:
        raise PredictionError("Model is not available.")

    if not image_bytes:
        raise PredictionError("No image data received.")

    if DEBUG_PREDICT:
        DEBUG_DIR.mkdir(exist_ok=True)
        (DEBUG_DIR / "last_received_crop.jpg").write_bytes(image_bytes)

    image = _decode_and_resize(image_bytes)
    batch = tf.expand_dims(image, axis=0)

    if DEBUG_PREDICT:
        logger.info(
            "input tensor shape=%s dtype=%s min=%.3f max=%.3f",
            tuple(batch.shape),
            batch.dtype,
            float(tf.reduce_min(batch)),
            float(tf.reduce_max(batch)),
        )
        # Save exactly what the model receives (pre-Rescaling, still 0-255)
        # as a viewable PNG, so it can be compared by eye against the
        # training-sample crops.
        model_input_png = tf.io.encode_png(tf.cast(batch[0], tf.uint8))
        (DEBUG_DIR / "last_model_input.png").write_bytes(model_input_png.numpy())

    flip_weight = float(model_state.metadata["tta_flip_weight"])
    flipped_batch = tf.image.flip_left_right(batch)

    original_probs = np.asarray(model_state.model.predict(batch, verbose=0)[0], dtype=float)
    flipped_probs = np.asarray(model_state.model.predict(flipped_batch, verbose=0)[0], dtype=float)
    probs = (1.0 - flip_weight) * original_probs + flip_weight * flipped_probs

    labels = model_state.labels
    top_index = int(np.argmax(probs))

    if DEBUG_PREDICT:
        logger.info("labels=%s", labels)
        logger.info(
            "original=%s",
            {label: round(float(v), 4) for label, v in zip(labels, original_probs)},
        )
        logger.info(
            "flipped=%s",
            {label: round(float(v), 4) for label, v in zip(labels, flipped_probs)},
        )
        logger.info(
            "combined (flip_weight=%.2f)=%s",
            flip_weight,
            {label: round(float(v), 4) for label, v in zip(labels, probs)},
        )

    probabilities = {label: round(float(value), 4) for label, value in zip(labels, probs)}

    return {
        "prediction": labels[top_index],
        "confidence": round(float(probs[top_index]), 4),
        "probabilities": probabilities,
    }
