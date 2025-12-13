# RealTimeVideoCamBackend
Backend de camara para RealTime

## Requisitos
- Node.js 16 o superior
- Cuenta de Firebase con un Service Account para Firestore

## Configuracion rapida
1. Copia el archivo `.env.example` a `.env` y completa los valores de Firebase.
2. Instala las dependencias:
	```sh
	npm install
	```
3. Genera los archivos compilados (opcional en desarrollo):
	```sh
	npm run build
	```
4. Arranca el servidor en modo desarrollo:
	```sh
	npm run dev
	```

Si no configuras Firebase, el servidor seguira arrancando, pero no validara reuniones contra Firestore (solo util para pruebas locales).
