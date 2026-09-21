import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from model import model_state
from predict import PredictionError, predict_emotion

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("motiva.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_state.load()
    yield


app = FastAPI(title="Motiva Backend", lifespan=lifespan)

# The Motiva frontend (Vite dev server) runs on a different origin/port
# (e.g. http://localhost:5173 or :5174), so the browser needs an explicit
# CORS allowance to call this API from the page's fetch() — without this,
# requests that work fine from curl are silently blocked by the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    payload: dict = {"status": "ok", "model_loaded": model_state.loaded}
    if not model_state.loaded and model_state.error:
        payload["model_error"] = model_state.error
    return payload


@app.post("/predict-emotion")
async def predict_emotion_endpoint(file: UploadFile | None = File(default=None)) -> dict:
    if not model_state.loaded:
        raise HTTPException(status_code=503, detail="Model is not available.")

    if file is None:
        raise HTTPException(status_code=400, detail="No image file provided.")

    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        return predict_emotion(image_bytes)
    except PredictionError as exc:
        logger.warning("Prediction request failed: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
