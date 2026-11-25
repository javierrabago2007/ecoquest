"""Publica EcoQuest en Firebase Hosting con la sesion de Cloud Shell (API oficial de Google).
Solo sube los archivos publicos de la pagina. No activa pagos ni borra nada."""
import gzip, hashlib, json, os, subprocess, sys, urllib.error, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
SITIO = "ecoquest-sonora"
PROYECTO = os.environ.get("DEVSHELL_PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT") or "ecoquest-sonora"
API = os.environ.get("FB_API", "https://firebasehosting.googleapis.com/v1beta1")


def token():
    if os.environ.get("FB_PRUEBA"):
        return "prueba"
    r = subprocess.run(["gcloud", "auth", "print-access-token"], capture_output=True, text=True)
    if r.returncode or not r.stdout.strip():
        print("ERROR: esta consola no tiene permiso para usar tu cuenta.")
        print("Cierra esta ventana, abre de nuevo el enlace y marca CONFIAR EN EL REPOSITORIO.")
        print(r.stderr.strip()[:300])
        sys.exit(1)
    return r.stdout.strip()


def pedir(metodo, url, datos=None, crudo=None):
    cab = {"Authorization": "Bearer " + TOKEN, "x-goog-user-project": PROYECTO}
    if crudo is not None:
        cuerpo = crudo
        cab["Content-Type"] = "application/octet-stream"
    else:
        cuerpo = json.dumps(datos).encode() if datos is not None else b""
        cab["Content-Type"] = "application/json"
    s = urllib.request.Request(url, data=cuerpo, method=metodo, headers=cab)
    with urllib.request.urlopen(s, timeout=90) as r:
        t = r.read()
        return json.loads(t) if t.strip() else {}


TOKEN = token()
print("Proyecto:", PROYECTO, "  Sitio:", SITIO)
try:
    try:
        pedir("POST", f"{API}/projects/{PROYECTO}/sites?siteId={SITIO}", {})
        print("1/4 Direccion reservada")
    except urllib.error.HTTPError as e:
        m = e.read().decode(errors="replace")
        if e.code == 409 or "already" in m.lower() or "reserved" in m.lower():
            print("1/4 La direccion ya estaba reservada")
        else:
            print("1/4 Aviso", e.code, m[:400])
    archivos, contenido = {}, {}
    for raiz, carpetas, nombres in os.walk(AQUI):
        carpetas[:] = [c for c in carpetas if not c.startswith(".")]
        for n in nombres:
            ruta = os.path.join(raiz, n)
            rel = os.path.relpath(ruta, AQUI).replace(os.sep, "/")
            permitido = rel.startswith(("datos/", "imagenes/", "lib/")) or ("/" not in rel and rel.endswith((".html", ".css", ".js")))
            if n.startswith(".") or not permitido:
                continue
            with open(ruta, "rb") as f:
                gz = gzip.compress(f.read(), 9, mtime=0)
            h = hashlib.sha256(gz).hexdigest()
            archivos["/" + rel] = h
            contenido[h] = gz
    if "/index.html" not in archivos:
        sys.exit("ERROR: no se encontro index.html")
    print("2/4 Archivos preparados:", len(archivos))
    cfg = {"config": {"headers": [{"glob": "**/*.@(html|json)", "headers": {"Cache-Control": "no-cache"}}]}}
    ver = pedir("POST", f"{API}/sites/{SITIO}/versions", cfg)["name"]
    r = pedir("POST", f"{API}/{ver}:populateFiles", {"files": archivos})
    faltan = r.get("uploadRequiredHashes", [])
    for i, h in enumerate(faltan, 1):
        pedir("POST", r["uploadUrl"] + "/" + h, crudo=contenido[h])
        print(f"3/4 Subiendo {i} de {len(faltan)}", end="\r", flush=True)
    print()
    pedir("PATCH", f"{API}/{ver}?update_mask=status", {"status": "FINALIZED"})
    pedir("POST", f"{API}/sites/{SITIO}/releases?versionName={ver}", {})
    print("4/4 Publicado")
    print(f"\n=== LISTO === https://{SITIO}.web.app")
except urllib.error.HTTPError as e:
    print("\n=== ERROR", e.code, "=== manda captura de esta pantalla")
    print(e.read().decode(errors="replace")[:1200])
    sys.exit(1)
