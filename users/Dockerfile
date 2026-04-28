FROM node:20-alpine

WORKDIR /app

# Instalar solo dependencias de producción de forma determinista
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

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

EXPOSE 3000
CMD ["node", "users-service.js"]
