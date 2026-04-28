FROM node:20-alpine

WORKDIR /app

# Instalar solo dependencias de producción de forma determinista
COPY package.json package-lock.json ./
<<<<<<< HEAD
RUN npm ci --omit=dev

# Copiar solo el código necesario para el runtime del módulo users
COPY users-service.js ./
COPY db.js ./
COPY userDb.js ./
COPY gameDb.js ./
COPY openapi.yaml ./

COPY services ./services
COPY repositories ./repositories
COPY auth ./auth
COPY middleware ./middleware
=======
RUN npm ci --silent
>>>>>>> 2744755f0f0077ee9b9690edbcd3a26a54c6d5f7

EXPOSE 3000
CMD ["node", "users-service.js"]
