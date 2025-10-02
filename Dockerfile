FROM node:20-alpine

WORKDIR /app

# Copia package.json primeiro
COPY package.json ./

# Instala dependências (sem lock file para evitar conflitos)
RUN npm install

# Copia o resto do código
COPY . .

# Expõe a porta 8080
EXPOSE 8080

# Comando para desenvolvimento
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8080"]
