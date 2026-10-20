#!/usr/bin/env python3
"""Login a Garmin Connect (una sola vez, desde la Mac) y guarda la sesión en los secrets del repo.

    pip install garminconnect
    python3 scripts/garmin_login.py

Pide mail, contraseña y el código de verificación si la cuenta lo tiene. La contraseña
no se guarda en ningún lado: sólo los tokens, que van directo al secret GARMIN_TOKENS
con `gh secret set` (hace falta estar logueado con `gh auth login`).
"""
import getpass, subprocess
from garminconnect import Garmin

api = Garmin(input("Mail de Garmin: ").strip(), getpass.getpass("Contraseña: "),
             prompt_mfa=lambda: input("Código de verificación: ").strip())
api.login()
print("ok, logueado como", api.get_full_name())

subprocess.run(["gh", "secret", "set", "GARMIN_TOKENS", "--repo", "NicolasFerencz/plan-cruce-andes-2026"],
               input=api.client.dumps(), text=True, check=True)
print("sesión guardada en el secret GARMIN_TOKENS")
