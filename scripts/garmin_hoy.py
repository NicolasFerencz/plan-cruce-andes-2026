#!/usr/bin/env python3
"""Sube un trabajo del plan a Garmin Connect y lo agenda para una fecha.

Lo corre el workflow `garmin.yml` cuando se toca "Hacer hoy" en la página.
Uso: garmin_hoy.py <semana-NN-sesion-N> <AAAA-MM-DD>

La sesión de Garmin viene en la variable GARMINTOKENS (JSON). Si Garmin la
renueva durante la corrida, la nueva se escribe en el archivo de GARMIN_TOKENS_OUT
para que el workflow la guarde de vuelta en los secrets.
"""
import json, os, pathlib, re, sys
from garminconnect import Garmin

trabajo, fecha = sys.argv[1], sys.argv[2]
if not re.fullmatch(r"semana-\d\d-sesion-\d", trabajo) or not re.fullmatch(r"\d{4}-\d\d-\d\d", fecha):
    sys.exit(f"argumentos inválidos: {trabajo!r} {fecha!r}")

workout = json.loads((pathlib.Path(__file__).parent.parent / "garmin" / f"{trabajo}.json").read_text())
PROPIO = re.compile(r"^S\d+ · ")          # los nombres que pone el plan: "S11 · Cuestas"

api = Garmin()
api.login(os.environ["GARMINTOKENS"])
try:
    # Uno por vez: se borran los que haya subido antes el plan (y con ellos su lugar en el calendario).
    for w in api.get_workouts(0, 200, my_workouts_only=True):
        if PROPIO.match(w.get("workoutName", "")):
            api.delete_workout(w["workoutId"])
            print("borrado:", w["workoutName"])

    nuevo = api.upload_workout(workout)
    api.schedule_workout(nuevo["workoutId"], fecha)
    print(f"agendado: {workout['workoutName']} → {fecha}")
finally:
    # aunque algo falle, la sesión pudo haberse renovado y la vieja ya no sirve
    if out := os.environ.get("GARMIN_TOKENS_OUT"):
        pathlib.Path(out).write_text(api.client.dumps())
