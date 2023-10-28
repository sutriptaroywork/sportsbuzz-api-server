FROM jaydobariya/fanstasy-node-phantom-16:latest

WORKDIR /app

COPY package* /app/

COPY . /app

ENV OPENSSL_CONF=/dev/null

ENV NODE_ENV=production 

RUN npm ci --production --legacy-peer-deps
RUN pm2 install pm2-metrics

EXPOSE 1338
EXPOSE 9209

CMD ["pm2-runtime", "start", "index.js", "-i", "max"]
