# Módulo de usuarios

Este módulo implementa el servicio de gestión de usuarios y sus datos asociados (registro, autenticación, puntuaciones, etc.). Está diseñado como un servicio Node.js que se conecta a una base de datos MySQL.

## Ejecutar en local 

1. Inicia la base de datos MySQL usando Docker Compose:

```powershell
docker compose up -d mysql
```

2. Configura las variables de entorno necesarias antes de arrancar el servicio:

```powershell
$env:DB_HOST="127.0.0.1"; $env:DB_USER="root"; $env:DB_PASSWORD="rootpassword"; $env:DB_NAME="yovi_db";
```

3. Arranca el servicio:

```powershell
npm start
```

#Adicional
Si es necesario borrar la bd y sus volumenes, para por ejemplo usar un nuevo init
```powershell
docker compose down -v
```
